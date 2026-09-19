/**
 * D26 — solo masadaki botlar.
 *
 * `dev/botRunner.ts` ile AYNI karar mantığını kullanır (`botBrain.ts`), ama:
 *  - Supabase / anonim hesap YOK: her botun kimliği `solo:bot-<n>` dizgesidir.
 *  - HTTP YOK: komutlar doğrudan tarayıcıdaki `GameService` örneğine gider.
 *  - `heartbeat` YOK: oturum tazeliğini zaten görünüm okumaları yazar.
 *
 * Bot hâlâ YALNIZ kendi yetkili görünümünü görür ve yalnız kendi sırasında
 * oynar; kuralları motor uygular. İnsan gibi görünmesi için her hamleden önce
 * 400–1200 ms rastgele bekler.
 */

import { PROTOCOL_VERSION, type AllowedAction, type SceneView } from '@secret-table/contracts';

import type { ApiResult } from '../multiplayer/apiClient';
import { actorPlayerId, chooseMove, chooseVote, pick } from './botBrain';

/** Solo masadaki bot adları (5 bot + insan = 6 kişilik masa). */
export const SOLO_BOT_NAMES = ['Ada', 'Bora', 'Cem', 'Derya', 'Efe'] as const;

/** İnsan gibi görünsün diye hamle öncesi bekleme aralığı. */
export const THINK_MIN_MS = 400;
export const THINK_MAX_MS = 1_200;

/** Görünüm yoklaması (yerel çağrı; ağ yok, ucuz). */
const TICK_MS = 350;

export type SoloCall = <T>(
  action: string,
  payload: Record<string, unknown>,
  accessToken: string,
) => Promise<ApiResult<T>>;

export type SoloBot = {
  readonly label: string;
  readonly token: string;
  playerId: string | null;
};

export type SoloBotRunner = {
  readonly bots: readonly SoloBot[];
  stop: () => void;
};

export type StartSoloBotsOptions = {
  roomId: string;
  bots: SoloBot[];
  call: SoloCall;
  random?: () => number;
  /** Test kancası: gerçek beklemeyi atlamak için. */
  sleep?: (ms: number) => Promise<void>;
};

export type SoloBotCtx = Required<Omit<StartSoloBotsOptions, 'bots'>> & {
  bots: SoloBot[];
  stopped: boolean;
};
type Ctx = SoloBotCtx;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let commandSeq = 0;
function nextCommandId(): string {
  commandSeq += 1;
  return `solo_${Date.now().toString(36)}_${commandSeq.toString(36)}`;
}

/** Hamle öncesi "düşünme" süresi: 400–1200 ms. */
function thinkMs(random: () => number): number {
  return THINK_MIN_MS + Math.floor(random() * (THINK_MAX_MS - THINK_MIN_MS));
}

async function readView(ctx: Ctx, bot: SoloBot): Promise<SceneView | null> {
  if (ctx.stopped) return null;
  const res = await ctx.call<{ view: SceneView }>('view', { roomId: ctx.roomId }, bot.token);
  return res.ok ? res.data.view : null;
}

async function send(
  ctx: Ctx,
  bot: SoloBot,
  view: SceneView,
  action: AllowedAction,
  optionId: string | undefined,
): Promise<boolean> {
  if (ctx.stopped) return false;
  const res = await ctx.call<{ ok: boolean }>(
    'command',
    {
      roomId: ctx.roomId,
      command: {
        protocolVersion: PROTOCOL_VERSION,
        gameId: view.gameId ?? '',
        phaseId: view.phaseId,
        commandId: nextCommandId(),
        actionId: action.actionId,
        optionId,
      },
    },
    bot.token,
  );
  return res.ok && res.data.ok === true;
}

async function playRoleReveal(ctx: Ctx, view: SceneView): Promise<void> {
  for (const bot of ctx.bots) {
    if (ctx.stopped) return;
    const seat = view.players.find((p) => p.playerId === bot.playerId);
    if (!seat || seat.ready) continue;
    const own = await readView(ctx, bot);
    const ack = own?.actions.find((a) => a.kind === 'ack_role');
    if (!own || !ack) continue;
    await ctx.sleep(thinkMs(ctx.random));
    await send(ctx, bot, own, ack, pick(ack.options, ctx.random)?.optionId);
  }
}

async function playVoting(ctx: Ctx, view: SceneView): Promise<void> {
  for (const bot of ctx.bots) {
    if (ctx.stopped) return;
    const seat = view.players.find((p) => p.playerId === bot.playerId);
    if (!seat || !seat.alive || seat.hasVoted) continue;
    const own = await readView(ctx, bot);
    const vote = own?.actions.find((a) => a.kind === 'vote');
    if (!own || !vote) continue;
    await ctx.sleep(thinkMs(ctx.random));
    await send(ctx, bot, own, vote, chooseVote(vote, ctx.random));
  }
}

async function playActor(ctx: Ctx, bot: SoloBot): Promise<void> {
  const own = await readView(ctx, bot);
  if (!own) return;
  const move = chooseMove(own, ctx.random);
  if (!move) return;
  await ctx.sleep(thinkMs(ctx.random));
  if (!(await send(ctx, bot, own, move.action, move.optionId)) || ctx.stopped) return;
  // Özel sonuç (inceleme / deste bakma) hemen onaylanır ki faz ilerlesin.
  const after = await readView(ctx, bot);
  const ack = after?.actions.find((a) => a.kind === 'ack_private_result');
  if (after && ack) await send(ctx, bot, after, ack, pick(ack.options, ctx.random)?.optionId);
}

/**
 * Bir tur: görünümü oku, gerekiyorsa oyna. Test bu adımı doğrudan çağırabilsin
 * diye döngüden ayrıdır. Dönen değer "oyun hâlâ sürüyor mu".
 */
export async function soloBotTick(ctx: Ctx): Promise<boolean> {
  const lead = ctx.bots[0];
  if (!lead || ctx.stopped) return false;
  const view = await readView(ctx, lead);
  if (!view) return true;
  if (view.phase === 'game_over') return true;
  if (view.phase === 'role_reveal') {
    await playRoleReveal(ctx, view);
    return true;
  }
  if (view.phase === 'voting') {
    await playVoting(ctx, view);
    return true;
  }
  const actorId = actorPlayerId(view);
  const bot = actorId ? ctx.bots.find((b) => b.playerId === actorId) : undefined;
  // İnsanın koltuğu: hiçbir şey gönderilmez, sırası beklenir.
  if (bot) await playActor(ctx, bot);
  return true;
}

export function startSoloBots(options: StartSoloBotsOptions): SoloBotRunner {
  const ctx: Ctx = {
    roomId: options.roomId,
    bots: options.bots,
    call: options.call,
    random: options.random ?? Math.random,
    sleep: options.sleep ?? defaultSleep,
    stopped: false,
  };

  const stop = (): void => {
    ctx.stopped = true;
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', stop);
  };
  if (typeof window !== 'undefined') window.addEventListener('pagehide', stop);

  void (async () => {
    while (!ctx.stopped) {
      try {
        await soloBotTick(ctx);
      } catch {
        /* yutulur: bir sonraki tur yeniden dener */
      }
      if (ctx.stopped) return;
      await ctx.sleep(TICK_MS);
    }
  })();

  return { bots: ctx.bots, stop };
}

/** `soloBotTick` için bağlam kurar (test yardımcısı ve `startSolo` ortak yolu). */
export function soloBotContext(options: StartSoloBotsOptions): Ctx {
  return {
    roomId: options.roomId,
    bots: options.bots,
    call: options.call,
    random: options.random ?? Math.random,
    sleep: options.sleep ?? defaultSleep,
    stopped: false,
  };
}
