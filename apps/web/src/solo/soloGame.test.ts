/**
 * D26 — solo masa MOTOR üzerinden sonuna kadar oynanır.
 *
 * Kurulum gerçek yoldur: `startSolo` tarayıcıdaki `GameService` +
 * `InMemoryGateway` ikilisini kurar, 5 botu oturtur ve oyunu başlatır. Sonra
 * bütün koltuklar (insan dahil) `botBrain` kararlarıyla oynanır; hiçbir hamle
 * reddedilmemeli ve oyun kurallara göre bitmelidir.
 *
 * Belirlilik için `Math.random` tohumlanmış bir üreticiyle değiştirilir
 * (motorun deste karıştırma tohumu da oradan gelir).
 */
import { PROTOCOL_VERSION, type CommandResponse, type SceneView } from '@secret-table/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { chooseMove } from './botBrain';
import { resetSoloMode } from './soloMode';
import { resetSoloService } from './soloService';
import { soloCall } from './soloTransport';
import { SOLO_HUMAN_TOKEN, SOLO_TABLE_SIZE, startSolo, stopSolo } from './startSolo';

/** Tohumlanabilir üreteç (mulberry32) — testler tekrar edilebilir olsun. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach(() => {
  resetSoloService();
  resetSoloMode();
});

afterEach(() => {
  stopSolo();
  resetSoloService();
  resetSoloMode();
  vi.restoreAllMocks();
});

type GameOutcome = {
  phases: Set<string>;
  powers: Set<string>;
  finalView: SceneView;
  rejected: string[];
  steps: number;
};

async function viewFor(roomId: string, token: string): Promise<SceneView | null> {
  const res = await soloCall<{ view: SceneView }>('view', { roomId }, token);
  return res.ok ? res.data.view : null;
}

/** Bir masayı sonuna kadar oynar: her tur SIRASI GELEN koltuk hamlesini yapar. */
async function playToEnd(seed: number): Promise<GameOutcome> {
  const random = seeded(seed);
  vi.spyOn(Math, 'random').mockImplementation(random);

  const { roomId, bots } = await startSolo({
    displayName: 'You',
    random,
    startBots: false,
  });
  expect(bots).toHaveLength(SOLO_TABLE_SIZE - 1);

  const tokens = [SOLO_HUMAN_TOKEN, ...bots.map((b) => b.token)];
  const phases = new Set<string>();
  const powers = new Set<string>();
  const rejected: string[] = [];
  let finalView = await viewFor(roomId, SOLO_HUMAN_TOKEN);
  expect(finalView).not.toBeNull();

  let steps = 0;
  for (; steps < 600; steps += 1) {
    const lead = await viewFor(roomId, SOLO_HUMAN_TOKEN);
    if (!lead) break;
    finalView = lead;
    phases.add(lead.phase);
    if (lead.table.currentPower) powers.add(lead.table.currentPower.power);
    if (lead.phase === 'game_over') break;

    let acted = false;
    for (const token of tokens) {
      const own = await viewFor(roomId, token);
      if (!own || own.actions.length === 0) continue;
      const move = chooseMove(own, random);
      if (!move) continue;
      const res = await soloCall<CommandResponse>(
        'command',
        {
          roomId,
          command: {
            protocolVersion: PROTOCOL_VERSION,
            gameId: own.gameId ?? '',
            phaseId: own.phaseId,
            commandId: `t_${steps}_${token}`,
            actionId: move.action.actionId,
            optionId: move.optionId,
          },
        },
        token,
      );
      expect(res.ok).toBe(true);
      if (res.ok && res.data.ok === false) rejected.push(res.data.error);
      acted = true;
    }
    if (!acted) break;
  }

  return { phases, powers, finalView: finalView as SceneView, rejected, steps };
}

describe('solo masa — 5 botla sonuna kadar', () => {
  it('oyun kurulur: 6 koltuk, roller dağıtılmış, herkesin kendi görünümü var', async () => {
    const random = seeded(7);
    vi.spyOn(Math, 'random').mockImplementation(random);
    const { roomId, bots } = await startSolo({ displayName: 'You', random, startBots: false });

    const human = await viewFor(roomId, SOLO_HUMAN_TOKEN);
    expect(human).not.toBeNull();
    expect(human!.players).toHaveLength(SOLO_TABLE_SIZE);
    expect(human!.phase).toBe('role_reveal');
    // İnsanın kendi rolü kendi görünümünde; başkasınınki YOK (projeksiyon).
    expect(human!.privateView.role).toBeTruthy();
    expect(human!.localPlayerId).toBe(human!.players[0]!.playerId);

    // Her botun ayrı, kendi yetkili görünümü var.
    for (const bot of bots) {
      const own = await viewFor(roomId, bot.token);
      expect(own?.localPlayerId).toBe(bot.playerId);
      expect(own?.privateView.role).toBeTruthy();
    }
    // Masada 6 ayrı karakter görünür (bot avatar seçimi çakışmaz).
    const characters = new Set(human!.players.map((p) => p.avatar.character));
    expect(characters.size).toBe(SOLO_TABLE_SIZE);
  });

  it('dört tohumda da oyun hatasız biter; aday/oylama/kanun ve en az bir yetki geçer', async () => {
    const allPhases = new Set<string>();
    const allPowers = new Set<string>();

    for (const seed of [1, 2, 3, 4]) {
      resetSoloService();
      resetSoloMode();
      const outcome = await playToEnd(seed);

      expect(outcome.rejected).toEqual([]);
      expect(outcome.finalView.phase).toBe('game_over');
      expect(outcome.finalView.result?.winner).toMatch(/^(liberal|fascist)$/);
      expect(outcome.steps).toBeLessThan(600);
      for (const phase of outcome.phases) allPhases.add(phase);
      for (const power of outcome.powers) allPowers.add(power);
    }

    for (const phase of ['role_reveal', 'nomination', 'voting', 'president_discard', 'chancellor_choice']) {
      expect(allPhases).toContain(phase);
    }
    expect(allPhases).toContain('executive_action');
    expect(allPowers.size).toBeGreaterThan(0);
  }, 30_000);
});
