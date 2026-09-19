/**
 * A6 — geliştirme bot modu (ROADMAP A6).
 *
 * YALNIZ `import.meta.env.DEV` iken çağrılır: `Lobby` düğmesi bu modülü
 * `import()` ile tembel yükler, üretim paketinde ne düğme ne bu chunk bulunur.
 *
 * Mantık `scratchpad/party.mjs` yardımcısının tarayıcıya taşınmış hâlidir:
 * odadaki eksik koltuklar GERÇEK (anonim) kimliklerle doldurulur, botlar hazır
 * olur ve oyun boyunca YALNIZ kendi sıralarında oynar. Fark: seçim `actions[0]`
 * değil, botun KENDİ yetkili görünümündeki `view.actions` içinden RASTGELE
 * geçerli bir `actionId`/`optionId` çiftidir.
 *
 * Sınırlar:
 * - Sunucuya yeni komut/uç eklenmez; yalnız mevcut `apiClient` çağrıları.
 * - Oyun kuralı istemcide çalıştırılmaz; her hamle sunucuda doğrulanır.
 * - Kullanıcının koltuğu için ASLA hamle gönderilmez.
 * - Kullanıcının kendi Supabase oturumu (localStorage) etkilenmez: her bot
 *   kalıcı olmayan, ayrı `storageKey`li kendi istemcisini kullanır.
 */

import {
  PROTOCOL_VERSION,
  type AllowedAction,
  type AvatarSelection,
  type SceneView,
} from '@secret-table/contracts';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import * as api from '../multiplayer/apiClient';
import type { LobbyView } from '../multiplayer/apiClient';
import { getSupabaseConfig } from '../multiplayer/supabaseClient';
import { isRateLimitError } from '../multiplayer/guestSession';
/**
 * D26 — KARAR mantığı artık paylaşılan saf modülde (`solo/botBrain.ts`); bu
 * koşucu yalnız kimlik + HTTP tarafını yürütür. Davranış değişmedi; dışa açık
 * adlar (test ve eski çağıranlar için) buradan yeniden dışa verilir.
 */
import {
  VETO_ACCEPT_RATE,
  VETO_REQUEST_RATE,
  YES_RATE,
  actorPlayerId,
  chooseMove,
  chooseVote,
  pick,
  pickBotAvatar,
} from '../solo/botBrain';

export {
  VETO_ACCEPT_RATE,
  VETO_REQUEST_RATE,
  YES_RATE,
  actorPlayerId,
  chooseMove,
  pickBotAvatar,
};

/**
 * Bot adları; lobide insan oyunculardan ayırt edilsin diye "Bot-" öneki.
 * D19: 5 → 9 (1 insan + 8 bot ile 9 kişilik masa kurulabilsin; 10 kişilik masa
 * için ikinci bir insan bağlamı gerekir).
 */
export const BOT_NAMES = [
  'Bot-Ada',
  'Bot-Bora',
  'Bot-Cem',
  'Bot-Derya',
  'Bot-Efe',
  'Bot-Fikret',
  'Bot-Gonca',
  'Bot-Hakan',
  'Bot-Irmak',
] as const;

/** Oyunun başlamasını beklerken lobi yoklaması. */
const LOBBY_POLL_MS = 2_500;
/** Oyun içi tur aralığı (bir botun görünümü okunur, gerekiyorsa hamle gider). */
const TURN_MS = 1_200;
/** Bağlı görünmek için (sunucu `heartbeat`). */
const HEARTBEAT_MS = 30_000;

export type BotRunner = {
  readonly roomId: string;
  /** Odaya gerçekten katılabilmiş bot sayısı. */
  readonly count: number;
  stop: () => void;
};

export type StartBotsOptions = {
  roomId: string;
  /** Lobiden alınan davet kodu (`snapshot.inviteCode`). */
  inviteCode: string;
  /** Toplam oyuncu hedefi (kullanıcı dahil). */
  target?: number;
  /** Odadaki mevcut üye sayısı (kaç bot ekleneceğini belirler). */
  currentMembers?: number;
  /** Test kancası. */
  random?: () => number;
  /** Test kancası; varsayılan kısa `[bots]` konsol satırı. */
  log?: (line: string) => void;
  /**
   * Test kancası: gerçek anonim oturum yerine sahte kimlik (ağ yok).
   * Üçüncü parametre (D21/H) kimlik alınamama NEDENİNİ bildirir; iki
   * parametreli eski kancalar aynen çalışır.
   */
  createAuth?: (
    index: number,
    label: string,
    report?: (issue: string) => void,
  ) => Promise<BotAuth | null>;
};

export type BotAuth = {
  label: string;
  getToken: () => Promise<string | null>;
  dispose: () => void;
};

type Bot = {
  label: string;
  auth: BotAuth;
  playerId: string | null;
};

type Ctx = {
  roomId: string;
  inviteCode: string;
  target: number;
  random: () => number;
  log: (line: string) => void;
  bots: Bot[];
  botIds: Set<string>;
  /** D3.4 — bu koşucudaki botların seçtiği karakterler (tekrarı önler). */
  pickedAvatars: string[];
  stopped: boolean;
  createAuth: (
    index: number,
    label: string,
    report?: (issue: string) => void,
  ) => Promise<BotAuth | null>;
};

/** Oda başına tek koşucu: aynı odaya iki kez bot eklenmez. */
const runners = new Map<string, BotRunner>();

export function runningBotCount(roomId: string): number {
  return runners.get(roomId)?.count ?? 0;
}

export function botRunnerFor(roomId: string): BotRunner | null {
  return runners.get(roomId) ?? null;
}

let commandSeq = 0;
function nextCommandId(): string {
  commandSeq += 1;
  return `bot_${Date.now().toString(36)}_${commandSeq.toString(36)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ---------------------------------------------------------------------------
// Kimlik
// ---------------------------------------------------------------------------

/**
 * D21/H — bot oturumları anonim giriş KOTASINI tüketmesin.
 *
 * Supabase anonim giriş sınırı IP başına ~30/saat. Her "bot ekle" tıklamasında
 * her bot yeni bir anonim kullanıcı açtığı için 9 botlu iki-üç tur sınırı
 * doldurup gerçek oyuncunun oturumunu da engelliyordu. Çözüm: bot oturumları
 * BOT ADINA göre `localStorage`'da saklanır ve sonraki koşularda yeniden
 * kullanılır (`guestSession.ts` kalıbı; kullanıcının kendi oturumu ayrı anahtar,
 * ayrı istemci, dokunulmaz). Yalnız dev derlemesinde çalışan modül.
 */
const BOT_SESSION_PREFIX = 'secret-table:dev-bot-session:';

/** Kota dolduğunda kullanıcıya gösterilecek açık mesaj (429). */
export const BOT_QUOTA_MESSAGE =
  'anonim giriş sınırı aşıldı (Supabase ~30 giriş/saat/IP); ~1 saat bekle ya da ' +
  'bellek kipinde (VITE_SUPABASE_URL boş) dene';

type StoredBotSession = { access_token: string; refresh_token: string };

function botSessionKey(label: string): string {
  return `${BOT_SESSION_PREFIX}${label}`;
}

export function readBotSession(label: string): StoredBotSession | null {
  try {
    const raw = localStorage.getItem(botSessionKey(label));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredBotSession>;
    if (typeof parsed.access_token !== 'string' || typeof parsed.refresh_token !== 'string') {
      return null;
    }
    return { access_token: parsed.access_token, refresh_token: parsed.refresh_token };
  } catch {
    return null;
  }
}

export function writeBotSession(label: string, session: StoredBotSession): void {
  try {
    localStorage.setItem(
      botSessionKey(label),
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
    );
  } catch {
    /* yutulur: kota/gizli pencere */
  }
}

export function clearBotSession(label: string): void {
  try {
    localStorage.removeItem(botSessionKey(label));
  } catch {
    /* yutulur */
  }
}

/** Supabase "oran sınırı" kontrolü üretim yolundan paylaşılır (tek kaynak). */
export { isRateLimitError };

/**
 * Her bot için AYRI, kalıcı olmayan Supabase istemcisi + anonim oturum.
 * Supabase yapılandırılmamışsa (yerel bellek kipi) `dev:bot-<rastgele>` token'ı.
 *
 * D21/H — önce saklanmış oturum geri yüklenir (`setSession`); yalnız o da
 * olmazsa YENİ anonim giriş açılır ve saklanır. 429'da `report` ile anlaşılır
 * mesaj verilir ve `null` dönülerek denemeler durdurulur.
 */
async function createBotAuth(
  index: number,
  label: string,
  report?: (issue: string) => void,
): Promise<BotAuth | null> {
  const config = getSupabaseConfig();
  if (!config) {
    const token = `dev:bot-${Math.random().toString(36).slice(2, 10)}`;
    return { label, getToken: async () => token, dispose: () => undefined };
  }

  let client: SupabaseClient;
  try {
    client = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // Bot adına bağlı: aynı bot yeniden kurulunca aynı yuvayı kullanır.
        storageKey: `st-bot-${label}`,
      },
    });

    const wrap = (fallbackToken: string): BotAuth => ({
      label,
      // Her istekten önce güncel token (SDK gerekiyorsa yeniler).
      getToken: async () => {
        try {
          const { data } = await client.auth.getSession();
          const token = data.session?.access_token;
          // Yenilenen oturumu sakla: sonraki koşu yeni giriş açmasın.
          if (data.session?.refresh_token && token) {
            writeBotSession(label, {
              access_token: token,
              refresh_token: data.session.refresh_token,
            });
          }
          return token ?? fallbackToken;
        } catch {
          return fallbackToken;
        }
      },
      dispose: () => {
        try {
          void client.auth.stopAutoRefresh();
        } catch {
          /* yutulur */
        }
      },
    });

    // 1) Saklanmış oturumu geri yükle (kota harcamaz).
    const stored = readBotSession(label);
    if (stored) {
      try {
        const restored = await client.auth.setSession(stored);
        if (!restored.error && restored.data.session) {
          writeBotSession(label, {
            access_token: restored.data.session.access_token,
            refresh_token: restored.data.session.refresh_token,
          });
          return wrap(restored.data.session.access_token);
        }
      } catch {
        /* düşer: yeni giriş */
      }
      // Bozuk / süresi geçmiş kayıt: temizle.
      clearBotSession(label);
    }

    // 2) Yeni anonim giriş (kota harcar).
    const created = await client.auth.signInAnonymously();
    if (created.error || !created.data.session) {
      if (isRateLimitError(created.error)) report?.(BOT_QUOTA_MESSAGE);
      else if (created.error?.message) report?.(created.error.message);
      return null;
    }
    writeBotSession(label, {
      access_token: created.data.session.access_token,
      refresh_token: created.data.session.refresh_token,
    });
    void index;
    return wrap(created.data.session.access_token);
  } catch (cause) {
    report?.(cause instanceof Error ? cause.message : String(cause));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ağ sarmalayıcıları — durdurulduysa istek gitmez, hatalar yutulur
// ---------------------------------------------------------------------------

async function tokenOf(ctx: Ctx, bot: Bot): Promise<string | null> {
  if (ctx.stopped) return null;
  try {
    return await bot.auth.getToken();
  } catch {
    return null;
  }
}

async function readLobby(ctx: Ctx, bot: Bot): Promise<LobbyView | null> {
  const token = await tokenOf(ctx, bot);
  if (!token || ctx.stopped) return null;
  const res = await api.fetchLobby(token, ctx.roomId);
  return res.ok ? res.data : null;
}

async function readView(ctx: Ctx, bot: Bot): Promise<SceneView | null> {
  const token = await tokenOf(ctx, bot);
  if (!token || ctx.stopped) return null;
  const res = await api.fetchView(token, ctx.roomId);
  return res.ok ? res.data.view : null;
}

async function setReady(ctx: Ctx, bot: Bot): Promise<void> {
  const token = await tokenOf(ctx, bot);
  if (!token || ctx.stopped) return;
  await api.sendLobbyCommand(token, ctx.roomId, {
    protocolVersion: PROTOCOL_VERSION,
    commandId: nextCommandId(),
    type: 'set_ready',
    ready: true,
  });
}

/**
 * D3.4 — bot lobide RASTGELE ama odada KULLANILMAMIŞ bir karakter seçer, böylece
 * masada 8 karakter birden görünür. Yalnız geliştirme yolu; hata yutulur.
 */
async function setAvatar(ctx: Ctx, bot: Bot, avatar: AvatarSelection): Promise<void> {
  const token = await tokenOf(ctx, bot);
  if (!token || ctx.stopped) return;
  await api.sendLobbyCommand(token, ctx.roomId, {
    protocolVersion: PROTOCOL_VERSION,
    commandId: nextCommandId(),
    type: 'set_avatar',
    character: avatar.character,
    skin: avatar.skin,
  });
}

/** Botun kendi görünümündeki bir aksiyonu gönderir. Hata (STALE_ACTION vb.) yutulur. */
async function send(
  ctx: Ctx,
  bot: Bot,
  view: SceneView,
  action: AllowedAction,
  optionId: string | undefined,
): Promise<boolean> {
  const token = await tokenOf(ctx, bot);
  if (!token || ctx.stopped) return false;
  const res = await api.sendCommand(token, ctx.roomId, {
    protocolVersion: PROTOCOL_VERSION,
    gameId: view.gameId ?? '',
    phaseId: view.phaseId,
    commandId: nextCommandId(),
    actionId: action.actionId,
    optionId,
  });
  return res.ok && res.data.ok === true;
}

// ---------------------------------------------------------------------------
// Katılım
// ---------------------------------------------------------------------------

async function joinBots(ctx: Ctx, currentMembers: number): Promise<void> {
  const need = Math.max(0, Math.min(BOT_NAMES.length, ctx.target - currentMembers));
  for (let i = 0; i < need; i += 1) {
    if (ctx.stopped) return;
    if (i > 0 && ctx.bots.length > 0) {
      const lobby = await readLobby(ctx, ctx.bots[0]!);
      if (lobby && lobby.members.length >= ctx.target) break;
    }
    const label = BOT_NAMES[i]!;
    // D21/H — kimlik alınamama nedeni (ör. anonim giriş kotası) loglanır ve
    // denemeler DURUR: sınırı zorlamak gerçek oyuncunun oturumunu da engelliyor.
    let issue: string | null = null;
    const auth = await ctx.createAuth(i, label, (reason) => {
      issue = reason;
    });
    if (!auth || ctx.stopped) {
      auth?.dispose();
      ctx.log(issue ? `${label} kimlik alamadı: ${issue}` : `${label} kimlik alamadı`);
      break;
    }
    const token = await auth.getToken();
    if (!token || ctx.stopped) {
      auth.dispose();
      break;
    }
    const joined = await api.joinRoom(token, ctx.inviteCode, label);
    if (!joined.ok) {
      auth.dispose();
      ctx.log(`${label} katılamadı (${joined.error})`);
      break;
    }
    const bot: Bot = { label, auth, playerId: null };
    ctx.bots.push(bot);
    const lobby = await readLobby(ctx, bot);
    if (lobby?.localPlayerId) {
      bot.playerId = lobby.localPlayerId;
      ctx.botIds.add(lobby.localPlayerId);
    }
    if (lobby) {
      // İnsan oyuncuların görünen karakteri + daha önce SEÇEN botlar. Henüz
      // seçmemiş botların koltuk varsayılanı havuzu daraltmasın.
      const humans = lobby.members
        .filter((m) => m.playerId !== lobby.localPlayerId && !ctx.botIds.has(m.playerId as string))
        .map((m) => m.avatar.character);
      const avatar = pickBotAvatar([...humans, ...ctx.pickedAvatars], ctx.random);
      ctx.pickedAvatars.push(avatar.character);
      await setAvatar(ctx, bot, avatar);
    }
    await setReady(ctx, bot);
  }
}

/** Lobiye dönülürse (oyun iptali / rematch öncesi) botlar yeniden hazır olur. */
async function keepReady(ctx: Ctx, lobby: LobbyView): Promise<void> {
  const notReady = new Set(
    lobby.members.filter((m) => !m.ready).map((m) => m.playerId as string),
  );
  for (const bot of ctx.bots) {
    if (ctx.stopped) return;
    if (bot.playerId && notReady.has(bot.playerId)) await setReady(ctx, bot);
  }
}

// ---------------------------------------------------------------------------
// Oyun döngüsü
// ---------------------------------------------------------------------------

async function playRoleReveal(ctx: Ctx, view: SceneView): Promise<void> {
  for (const bot of ctx.bots) {
    if (ctx.stopped) return;
    const seat = view.players.find((p) => p.playerId === bot.playerId);
    if (!seat || seat.ready) continue;
    const own = await readView(ctx, bot);
    if (!own) continue;
    const ack = own.actions.find((a) => a.kind === 'ack_role');
    if (!ack) continue;
    await send(ctx, bot, own, ack, pick(ack.options, ctx.random)?.optionId);
  }
}

async function playVoting(ctx: Ctx, view: SceneView): Promise<void> {
  for (const bot of ctx.bots) {
    if (ctx.stopped) return;
    const seat = view.players.find((p) => p.playerId === bot.playerId);
    if (!seat || !seat.alive || seat.hasVoted) continue;
    const own = await readView(ctx, bot);
    if (!own) continue;
    const vote = own.actions.find((a) => a.kind === 'vote');
    if (!vote) continue;
    await send(ctx, bot, own, vote, chooseVote(vote, ctx.random));
  }
}

async function playActor(ctx: Ctx, bot: Bot): Promise<void> {
  const own = await readView(ctx, bot);
  if (!own) return;
  const move = chooseMove(own, ctx.random);
  if (!move) return;
  const ok = await send(ctx, bot, own, move.action, move.optionId);
  ctx.log(`${bot.label} ${move.action.kind}${ok ? '' : ' (reddedildi)'}`);
  if (!ok || ctx.stopped) return;
  // Özel sonuç (inceleme / deste bakma) hemen onaylanır ki faz ilerlesin.
  const after = await readView(ctx, bot);
  const ack = after?.actions.find((a) => a.kind === 'ack_private_result');
  if (after && ack) await send(ctx, bot, after, ack, pick(ack.options, ctx.random)?.optionId);
}

async function loop(ctx: Ctx): Promise<void> {
  let mode: 'lobby' | 'game' = 'lobby';
  let lastKey = '';
  while (!ctx.stopped) {
    const lead = ctx.bots[0];
    if (!lead) return;

    if (mode === 'lobby') {
      const lobby = await readLobby(ctx, lead);
      if (ctx.stopped) return;
      if (lobby?.status === 'in_game') {
        mode = 'game';
        continue;
      }
      if (lobby) await keepReady(ctx, lobby);
      await sleep(LOBBY_POLL_MS);
      continue;
    }

    const view = await readView(ctx, lead);
    if (ctx.stopped) return;
    if (!view) {
      // Oyun iptal edildi / lobiye dönüldü: yeniden lobi kipine düş.
      mode = 'lobby';
      await sleep(LOBBY_POLL_MS);
      continue;
    }

    const key = `${view.gameId ?? '-'}#${view.phase}#${view.revision}`;
    if (key !== lastKey) {
      lastKey = key;
      ctx.log(`faz=${view.phase} rev=${view.revision}`);
    }

    if (view.phase === 'game_over') {
      // Rematch beklenir: yeni `gameId` gelince aynı döngü devam eder.
      await sleep(LOBBY_POLL_MS);
      continue;
    }
    if (view.phase === 'role_reveal') {
      await playRoleReveal(ctx, view);
      await sleep(TURN_MS);
      continue;
    }
    if (view.phase === 'voting') {
      await playVoting(ctx, view);
      await sleep(TURN_MS);
      continue;
    }

    const actorId = actorPlayerId(view);
    // Kullanıcının koltuğu: hiçbir şey gönderilmez, sırası beklenir.
    const bot = actorId ? ctx.bots.find((b) => b.playerId === actorId) : undefined;
    if (bot) await playActor(ctx, bot);
    await sleep(TURN_MS);
  }
}

// ---------------------------------------------------------------------------
// Yaşam döngüsü
// ---------------------------------------------------------------------------

export async function startBots(options: StartBotsOptions): Promise<BotRunner> {
  const existing = runners.get(options.roomId);
  if (existing) return existing;

  const log =
    options.log ??
    ((line: string) => {
      console.log(`[bots] ${line}`);
    });

  const ctx: Ctx = {
    roomId: options.roomId,
    inviteCode: options.inviteCode,
    target: options.target ?? 6,
    random: options.random ?? Math.random,
    log,
    bots: [],
    botIds: new Set<string>(),
    pickedAvatars: [],
    stopped: false,
    createAuth: options.createAuth ?? createBotAuth,
  };

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const stop = (): void => {
    if (ctx.stopped) return;
    ctx.stopped = true;
    if (heartbeat !== null) clearInterval(heartbeat);
    heartbeat = null;
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', stop);
    for (const bot of ctx.bots) bot.auth.dispose();
    runners.delete(ctx.roomId);
    log(`durdu (${ctx.bots.length})`);
  };

  const runner: BotRunner = {
    roomId: ctx.roomId,
    get count() {
      return ctx.bots.length;
    },
    stop,
  };
  // Katılım sürerken ikinci tıklama yeni koşucu açmasın.
  runners.set(ctx.roomId, runner);
  if (typeof window !== 'undefined') window.addEventListener('pagehide', stop);

  try {
    await joinBots(ctx, options.currentMembers ?? 1);
  } catch {
    /* yutulur: aşağıda sayı kontrol edilir */
  }

  if (ctx.stopped) return runner;
  if (ctx.bots.length === 0) {
    stop();
    return runner;
  }

  log(`${ctx.bots.length} bot hazır`);
  heartbeat = setInterval(() => {
    void (async () => {
      for (const bot of ctx.bots) {
        const token = await tokenOf(ctx, bot);
        if (!token || ctx.stopped) return;
        await api.sendHeartbeat(token, ctx.roomId);
      }
    })();
  }, HEARTBEAT_MS);

  void loop(ctx).catch(() => undefined);
  return runner;
}
