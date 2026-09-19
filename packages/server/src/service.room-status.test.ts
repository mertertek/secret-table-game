/**
 * D21/A — oyun sonundan lobiye dönüş (ENGELLEYİCİ bulgunun sunucu tarafı).
 *
 * Sorun: `cancel_game` yalnız `rooms.status`'u `'lobby'` yapıyordu.
 * `game_states` satırına dokunulmadığı için (a) 0003'teki sürüm tetikleyicisi
 * hiç çalışmıyor, (b) `getView` hâlâ geçerli bir oyun görünümü döndürüyordu.
 * Sonuç: host "Lobiye dön" dediğinde diğer oyuncular oyun-sonu ekranında
 * takılı kalıyordu.
 *
 * Burada doğrulanan sözleşme:
 *  1. `cancel_game` sonrası `getView` yanıtı `roomStatus: 'lobby'` bildirir
 *     (görünüm alanları değişmez; alan ADDITIVE),
 *  2. oyun sürerken `roomStatus: 'in_game'`,
 *  3. `cancel_game` gateway üzerinden sürüm sinyali yayınlar (durum satırına
 *     dokunmadan),
 *  4. host olmayan `cancel_game` gönderemez (mevcut kural korunur).
 */

import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, type RoomRevisionSignal } from '@secret-table/contracts';

import { ackAllRoles, makeStartedGame } from './test-harness';

function cancel(h: Awaited<ReturnType<typeof makeStartedGame>>, userId: string) {
  return h.service.submitLobbyCommand(
    { roomId: h.roomId, userId },
    { protocolVersion: PROTOCOL_VERSION, commandId: `cancel_${userId}`, type: 'cancel_game' },
  );
}

describe('D21/A — cancel_game sonrası görünüm lobiyi bildirir', () => {
  it('oyun sürerken roomStatus in_game, cancel_game sonrası lobby', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);

    const during = await h.service.getView({ roomId: h.roomId, userId: 'u2' });
    expect(during.ok).toBe(true);
    if (!during.ok) return;
    expect(during.response.roomStatus).toBe('in_game');

    expect(await cancel(h, 'u1')).toEqual({ ok: true });

    // Oyun durumu satırı SİLİNMEZ: görünüm yine gelir ama oda lobide.
    const after = await h.service.getView({ roomId: h.roomId, userId: 'u2' });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.response.roomStatus).toBe('lobby');
    expect(after.response.view.gameId).toBe(during.response.view.gameId);

    // Lobi görünümü de aynı şeyi söyler (istemcinin düştüğü tam yol).
    const lobby = await h.service.getLobby({ roomId: h.roomId, userId: 'u2' });
    expect(lobby.ok).toBe(true);
    if (!lobby.ok) return;
    expect(lobby.snapshot.status).toBe('lobby');
  });

  it('cancel_game sürüm sinyali yayınlar (game_states yazımı olmadan)', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);

    const seen: RoomRevisionSignal[] = [];
    const stop = h.gateway.onRevision((signal) => seen.push(signal));
    const stateBefore = await h.gateway.getGameState(h.roomId);

    expect(await cancel(h, 'u1')).toEqual({ ok: true });
    stop();

    expect(seen).toHaveLength(1);
    expect(seen[0]?.roomId).toBe(h.roomId);
    expect(seen[0]?.revision).toBe(stateBefore?.revision);

    // Durum satırı DEĞİŞMEDİ (sürüm uydurulmadı, durum yeniden yazılmadı).
    const stateAfter = await h.gateway.getGameState(h.roomId);
    expect(stateAfter?.revision).toBe(stateBefore?.revision);
    expect(stateAfter?.updatedAt).toBe(stateBefore?.updatedAt);
  });

  it('host olmayan cancel_game gönderemez', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    expect(await cancel(h, 'u3')).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    const view = await h.service.getView({ roomId: h.roomId, userId: 'u3' });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.response.roomStatus).toBe('in_game');
  });
});
