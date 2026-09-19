/**
 * QA-R01 regresyonu: bitmiş oyundan doğrudan "Yeniden oyna".
 *
 * Beklenen: yetkili + atomik geçiş; aktif (bitmemiş) oyun yanlışlıkla sıfırlanamaz;
 * yeni oyun revision'ı oda ömrü boyunca monoton (biten oyundan +1 devam eder).
 */

import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '@secret-table/contracts';

import { InMemoryGateway } from './memory-gateway';
import { makeStartedGame } from './test-harness';
import type { Harness } from './test-harness';

/** Servis çağrılarıyla oyunu game_over'a kadar oynatır (faşist tercih ederek). */
async function playToGameOver(h: Harness): Promise<void> {
  for (let guard = 0; guard < 400; guard += 1) {
    if ((await h.view('u1')).phase === 'game_over') return;
    let acted = false;
    for (const userId of h.userIds) {
      const view = await h.view(userId);
      if (view.phase === 'game_over') return;
      const action = view.actions[0];
      if (!action) continue;
      const option =
        action.kind === 'enact_policy' || action.kind === 'discard_policy'
          ? (action.options.find((o) => o.labelKey === 'policy.fascist') ?? action.options[0])
          : action.options[0];
      const res = await h.submit(userId, action.actionId, option?.optionId);
      expect(res.ok).toBe(true);
      acted = true;
    }
    if (!acted) throw new Error('kimse hareket edemedi');
  }
  throw new Error('oyun game_over olmadı (koruma sınırı)');
}

function playAgain(h: Harness, userId: string) {
  return h.service.submitLobbyCommand(
    { roomId: h.roomId, userId },
    { protocolVersion: PROTOCOL_VERSION, commandId: `pa_${userId}_${Math.random()}`, type: 'play_again' },
  );
}

describe('QA-R01 — doğrudan "Yeniden oyna"', () => {
  it('host: bitmiş oyundan yeni oyuna atomik geçiş; revision +1 devam eder', async () => {
    const h = await makeStartedGame(5, { seed: 20 });
    await playToGameOver(h);

    const finished = await h.gateway.getGameState(h.roomId);
    expect(finished?.state.phase.kind).toBe('game_over');
    const finishedGameId = finished?.gameId as string;
    const finishedRevision = finished?.revision as number;

    const res = await playAgain(h, 'u1');
    expect(res).toEqual({ ok: true });

    const next = await h.gateway.getGameState(h.roomId);
    expect(next?.state.phase.kind).toBe('role_reveal');
    expect(next?.gameId).not.toBe(finishedGameId);
    expect(next?.revision).toBe(finishedRevision + 1);

    const room = await h.gateway.getRoom(h.roomId);
    expect(room?.status).toBe('in_game');
    expect(room?.gameId).toBe(next?.gameId);

    // Yeni oyunda oyuncular normal akışa devam edebiliyor.
    const view = await h.view('u1');
    expect(view.phase).toBe('role_reveal');
    expect(view.players).toHaveLength(5);
    const ack = view.actions.find((a) => a.kind === 'ack_role');
    expect(ack).toBeTruthy();
    const acked = await h.submit('u1', ack?.actionId as string, ack?.options[0]?.optionId);
    expect(acked.ok).toBe(true);
  });

  it('host olmayan oyuncu "Yeniden oyna" yapamaz', async () => {
    const h = await makeStartedGame(5, { seed: 21 });
    await playToGameOver(h);
    const res = await playAgain(h, 'u2');
    expect(res).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    // Bitmiş oyun bozulmadı.
    expect((await h.gateway.getGameState(h.roomId))?.state.phase.kind).toBe('game_over');
  });

  it('devam eden (bitmemiş) oyun "Yeniden oyna" ile sıfırlanamaz', async () => {
    const h = await makeStartedGame(5, { seed: 22 });
    const before = await h.gateway.getGameState(h.roomId);
    expect(before?.state.phase.kind).not.toBe('game_over');

    const res = await playAgain(h, 'u1');
    expect(res).toEqual({ ok: false, error: 'NOT_ALLOWED' });

    const after = await h.gateway.getGameState(h.roomId);
    expect(after?.gameId).toBe(before?.gameId);
    expect(after?.revision).toBe(before?.revision);
    expect(after?.state.phase.kind).toBe(before?.state.phase.kind);
  });

  it('"Lobiye dön" sonrası (status=lobby) "Yeniden oyna" çalışır', async () => {
    const h = await makeStartedGame(5, { seed: 23 });
    await playToGameOver(h);

    const cancel = await h.service.submitLobbyCommand(
      { roomId: h.roomId, userId: 'u1' },
      { protocolVersion: PROTOCOL_VERSION, commandId: 'cancel', type: 'cancel_game' },
    );
    expect(cancel).toEqual({ ok: true });
    expect((await h.gateway.getRoom(h.roomId))?.status).toBe('lobby');

    const res = await playAgain(h, 'u1');
    expect(res).toEqual({ ok: true });
    expect((await h.gateway.getGameState(h.roomId))?.state.phase.kind).toBe('role_reveal');
  });

  it('gateway.restartGame: in_game + game_over değil → reddeder', async () => {
    const gateway = new InMemoryGateway();
    const now = '2026-09-09T12:00:00.000Z';
    const room = await gateway.createRoom({
      roomId: 'r1',
      inviteCode: 'AAAAAA',
      hostUserId: 'h',
      hostPlayerId: 'p0',
      hostDisplayName: 'Host',
      reconnectSeconds: 600,
      now,
    });
    // Sahte "devam eden" oyun durumu.
    await gateway.startGame({
      roomId: room.roomId,
      gameId: 'g1',
      state: { phase: { kind: 'role_reveal', ackedPlayerIds: [] }, revision: 3 } as never,
      now,
    });

    await expect(
      gateway.restartGame({
        roomId: room.roomId,
        gameId: 'g2',
        state: { phase: { kind: 'role_reveal', ackedPlayerIds: [] }, revision: 4 } as never,
        now,
      }),
    ).rejects.toThrow(/sürüyor/);
  });
});
