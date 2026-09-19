/**
 * D26 — solo botların döngüsü: yerel servise doğrudan komut gönderir, yalnız
 * KENDİ sıralarında oynar ve insan gibi görünsün diye 400–1200 ms bekler.
 */
import type { SceneView } from '@secret-table/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SOLO_BOT_NAMES,
  THINK_MAX_MS,
  THINK_MIN_MS,
  soloBotContext,
  soloBotTick,
} from './soloBots';
import { resetSoloMode } from './soloMode';
import { resetSoloService } from './soloService';
import { soloCall } from './soloTransport';
import { SOLO_HUMAN_TOKEN, startSolo, stopSolo } from './startSolo';

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function humanView(roomId: string): Promise<SceneView> {
  const res = await soloCall<{ view: SceneView }>('view', { roomId }, SOLO_HUMAN_TOKEN);
  if (!res.ok) throw new Error(res.error);
  return res.data.view;
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

describe('solo botlar', () => {
  it('5 bot vardır ve hamle öncesi 400–1200 ms bekler', async () => {
    const random = seeded(11);
    vi.spyOn(Math, 'random').mockImplementation(random);
    const { roomId, bots } = await startSolo({ displayName: 'You', random, startBots: false });
    expect(bots).toHaveLength(SOLO_BOT_NAMES.length);

    const waits: number[] = [];
    const ctx = soloBotContext({
      roomId,
      bots: [...bots],
      call: soloCall,
      random,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    for (let i = 0; i < 20; i += 1) await soloBotTick(ctx);

    expect(waits.length).toBeGreaterThan(0);
    for (const ms of waits) {
      expect(ms).toBeGreaterThanOrEqual(THINK_MIN_MS);
      expect(ms).toBeLessThan(THINK_MAX_MS);
    }
  });

  it('insanın sırasında hiçbir bot hamle göndermez (oyun bekler)', async () => {
    const random = seeded(3);
    vi.spyOn(Math, 'random').mockImplementation(random);
    const { roomId, bots } = await startSolo({ displayName: 'You', random, startBots: false });

    const ctx = soloBotContext({
      roomId,
      bots: [...bots],
      call: soloCall,
      random,
      sleep: async () => {},
    });

    // Botlar rolünü onaylar; insan onaylamadıkça oyun `role_reveal`de kalır.
    for (let i = 0; i < 10; i += 1) await soloBotTick(ctx);
    let view = await humanView(roomId);
    expect(view.phase).toBe('role_reveal');
    expect(view.actions.some((a) => a.kind === 'ack_role')).toBe(true);

    // İnsan onaylar → aday belirleme. Sıra kimdeyse orada durulur.
    const ack = view.actions.find((a) => a.kind === 'ack_role')!;
    await soloCall(
      'command',
      {
        roomId,
        command: {
          protocolVersion: view.protocolVersion,
          gameId: view.gameId ?? '',
          phaseId: view.phaseId,
          commandId: 'human-ack',
          actionId: ack.actionId,
          optionId: ack.options[0]?.optionId,
        },
      },
      SOLO_HUMAN_TOKEN,
    );

    for (let i = 0; i < 20; i += 1) await soloBotTick(ctx);
    view = await humanView(roomId);
    // Oyun ilerledi ama insanın kendi hamlesini bekleyen bir yerde durdu:
    // bot koltuğu insanın yerine oynamadı.
    expect(view.phase).not.toBe('role_reveal');
    if (view.actions.length > 0) {
      const revision = view.revision;
      for (let i = 0; i < 10; i += 1) await soloBotTick(ctx);
      expect((await humanView(roomId)).revision).toBe(revision);
    }
  });
});
