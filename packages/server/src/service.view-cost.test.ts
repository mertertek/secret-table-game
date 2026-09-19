/**
 * D21/J — `view` / `lobby_view` isteğinin kalıcılık maliyeti.
 *
 * Eskiden her `view` isteği: `getRoom` + `getMembershipByUser` + `getGameState`
 * + `listMembers` (displayName) + `touchSession` YAZIMI + `projectionMeta`
 * içinde ikinci `listMembers` + ÜYE BAŞINA `getSession` + üçüncü `getGameState`
 * çağırıyordu. 10 kişilik odada istek başına ~13 ardışık Supabase turu; D20'nin
 * 3 s'lik yedek yoklamasıyla oda başına dakikada binlerce sorgu.
 *
 * Sözleşme: 10 üyeli odada bir `view` isteği ≤ 4 gateway çağrısı yapar
 * (`getRoom`, `listMembers`, `getGameState`, `listSessions`) ve üye başına
 * `getSession` çağrısı YOKTUR. `touchSession` yalnız oturum bayatladıysa (≥30 s)
 * fazladan bir yazım ekler.
 */

import { describe, expect, it } from 'vitest';

import { InMemoryGateway } from './memory-gateway';
import { ackAllRoles, makeStartedGame } from './test-harness';

type Counts = Record<string, number>;

/** `GameGateway` arayüzünün metodları (özel yardımcılar sayıma girmez). */
const GATEWAY_METHODS = [
  'getRoom',
  'getRoomByInvite',
  'createRoom',
  'joinRoom',
  'listMembers',
  'getMembershipByUser',
  'setMemberReady',
  'setMemberAvatar',
  'startGame',
  'restartGame',
  'getGameState',
  'getProcessedCommand',
  'commitMove',
  'getSession',
  'listSessions',
  'touchSession',
  'bumpSessionGeneration',
  'setRoomStatus',
  'notifyRevision',
] as const;

/** Gateway metod çağrılarını sayan şeffaf sarmalayıcı. */
function countCalls(gateway: InMemoryGateway): { counts: Counts; reset: () => void } {
  const counts: Counts = {};
  for (const name of GATEWAY_METHODS) {
    const original = (gateway as unknown as Record<string, unknown>)[name];
    if (typeof original !== 'function') continue;
    (gateway as unknown as Record<string, unknown>)[name] = function patched(
      ...args: unknown[]
    ): unknown {
      counts[name] = (counts[name] ?? 0) + 1;
      return (original as (...a: unknown[]) => unknown).apply(gateway, args);
    };
  }
  return {
    counts,
    reset: () => {
      for (const key of Object.keys(counts)) delete counts[key];
    },
  };
}

function total(counts: Counts): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

describe('D21/J — view isteğinin gateway maliyeti', () => {
  it('10 üyeli odada view ≤ 4 çağrı; üye başına getSession yok', async () => {
    const h = await makeStartedGame(10);
    await ackAllRoles(h);
    // İlk istek oturumu tazeler; ölçüm bir sonraki (kararlı durum) istekte.
    await h.service.getView({ roomId: h.roomId, userId: 'u5' });

    const probe = countCalls(h.gateway);
    const res = await h.service.getView({ roomId: h.roomId, userId: 'u5' });
    expect(res.ok).toBe(true);

    expect(probe.counts.getSession ?? 0).toBe(0);
    expect(probe.counts.touchSession ?? 0).toBe(0);
    expect(probe.counts.listMembers ?? 0).toBe(1);
    expect(probe.counts.getGameState ?? 0).toBe(1);
    expect(probe.counts.listSessions ?? 0).toBe(1);
    expect(total(probe.counts)).toBeLessThanOrEqual(4);
  });

  it('oturum bayatlayınca (≥30 s) tek ek yazım yapılır', async () => {
    const h = await makeStartedGame(10);
    await ackAllRoles(h);
    await h.service.getView({ roomId: h.roomId, userId: 'u5' });

    h.advance(31);
    const probe = countCalls(h.gateway);
    await h.service.getView({ roomId: h.roomId, userId: 'u5' });
    expect(probe.counts.touchSession ?? 0).toBe(1);
    expect(total(probe.counts)).toBeLessThanOrEqual(5);
  });

  it('lobby_view de üye başına getSession yapmaz', async () => {
    const h = await makeStartedGame(10);
    await h.service.getLobby({ roomId: h.roomId, userId: 'u5' });

    const probe = countCalls(h.gateway);
    const res = await h.service.getLobby({ roomId: h.roomId, userId: 'u5' });
    expect(res.ok).toBe(true);
    expect(probe.counts.getSession ?? 0).toBe(0);
    expect(probe.counts.listSessions ?? 0).toBe(1);
    expect(probe.counts.listMembers ?? 0).toBe(1);
    expect(total(probe.counts)).toBeLessThanOrEqual(3);
  });

  it('bağlantı durumu doğru kalır: bayat oturum "bağlı değil" görünür', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    // Yalnız u1 dokunuyor; diğerleri reconnect penceresinin (600 s) dışına çıkar.
    h.advance(700);
    await h.service.getView({ roomId: h.roomId, userId: 'u1' });
    const res = await h.service.getView({ roomId: h.roomId, userId: 'u1' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const others = res.response.view.players.filter(
      (p) => p.playerId !== h.playerIdByUser.u1,
    );
    expect(others.every((p) => p.connected === false)).toBe(true);
    expect(res.response.view.players.find((p) => p.playerId === h.playerIdByUser.u1)?.connected)
      .toBe(true);
  });
});
