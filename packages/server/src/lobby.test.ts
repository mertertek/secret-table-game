import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '@secret-table/contracts';

import { InMemoryGateway } from './memory-gateway';
import { GameService } from './service';

type Setup = {
  service: GameService;
  gateway: InMemoryGateway;
  roomId: string;
  inviteCode: string;
  clock: { ms: number };
};

async function makeLobby(memberCount: number): Promise<Setup> {
  const gateway = new InMemoryGateway();
  const clock = { ms: Date.parse('2026-09-09T12:00:00.000Z') };
  let idc = 0;
  const service = new GameService(gateway, {
    now: () => new Date(clock.ms),
    newId: () => `id_${(idc += 1)}`,
    newInviteCode: () => 'LOBBYA',
    reconnectSeconds: 600,
  });

  const created = await service.createRoom({ userId: 'u1', displayName: 'Host' });
  for (let i = 2; i <= memberCount; i += 1) {
    const r = await service.joinRoom({
      inviteCode: created.inviteCode,
      userId: `u${i}`,
      displayName: `Oyuncu ${i}`,
    });
    if (!r.ok) throw new Error(`join: ${r.error}`);
  }
  // Herkes bağlı sayılsın.
  for (let i = 1; i <= memberCount; i += 1) {
    await service.heartbeat({ roomId: created.roomId, userId: `u${i}` });
  }
  return { service, gateway, roomId: created.roomId, inviteCode: created.inviteCode, clock };
}

async function readyAll(s: Setup, count: number): Promise<void> {
  for (let i = 1; i <= count; i += 1) {
    await s.service.submitLobbyCommand(
      { roomId: s.roomId, userId: `u${i}` },
      { protocolVersion: PROTOCOL_VERSION, commandId: `rdy_${i}`, type: 'set_ready', ready: true },
    );
  }
}

describe('getLobby', () => {
  it('koltuk sırası, host ve yerel oyuncu işaretli; gizli alan yok', async () => {
    const s = await makeLobby(5);
    const res = await s.service.getLobby({ roomId: s.roomId, userId: 'u3' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const snap = res.snapshot;

    expect(snap.inviteCode).toBe('LOBBYA');
    expect(snap.status).toBe('lobby');
    expect(snap.members).toHaveLength(5);
    expect(snap.members.map((m) => m.seatIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(snap.members[0]?.isHost).toBe(true);
    expect(snap.members.filter((m) => m.isHost)).toHaveLength(1);
    expect(snap.members.find((m) => m.isLocal)?.seatIndex).toBe(2);
    expect(snap.isHost).toBe(false);
    expect(snap.members.every((m) => m.connected)).toBe(true);
    // Gizli alan sızıntısı yok.
    for (const m of snap.members) {
      expect(Object.keys(m)).not.toContain('userId');
      expect(Object.keys(m)).not.toContain('role');
    }
  });

  it('canStart yalnız host + sayı aralıkta + herkes hazır iken true', async () => {
    const s = await makeLobby(5);
    let host = await s.service.getLobby({ roomId: s.roomId, userId: 'u1' });
    expect(host.ok && host.snapshot.canStart).toBe(false); // kimse hazır değil

    await readyAll(s, 4); // biri eksik
    host = await s.service.getLobby({ roomId: s.roomId, userId: 'u1' });
    expect(host.ok && host.snapshot.canStart).toBe(false);

    await readyAll(s, 5);
    host = await s.service.getLobby({ roomId: s.roomId, userId: 'u1' });
    expect(host.ok && host.snapshot.canStart).toBe(true);

    const guest = await s.service.getLobby({ roomId: s.roomId, userId: 'u3' });
    expect(guest.ok && guest.snapshot.canStart).toBe(false); // host değil
  });

  it('yetersiz oyuncuda canStart false kalır', async () => {
    const s = await makeLobby(4);
    await readyAll(s, 4);
    const host = await s.service.getLobby({ roomId: s.roomId, userId: 'u1' });
    expect(host.ok && host.snapshot.canStart).toBe(false);
  });

  it('üye olmayan SESSION_INVALID, bilinmeyen oda ROOM_NOT_FOUND', async () => {
    const s = await makeLobby(5);
    expect(await s.service.getLobby({ roomId: s.roomId, userId: 'stranger' })).toEqual({
      ok: false,
      error: 'SESSION_INVALID',
    });
    expect(await s.service.getLobby({ roomId: 'nope', userId: 'u1' })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
  });

  it('herkes hazır değilken start_game reddedilir; hazır olunca in_game', async () => {
    const s = await makeLobby(5);
    const early = await s.service.submitLobbyCommand(
      { roomId: s.roomId, userId: 'u1' },
      { protocolVersion: PROTOCOL_VERSION, commandId: 'st1', type: 'start_game' },
    );
    expect(early).toEqual({ ok: false, error: 'NOT_ALLOWED' });

    await readyAll(s, 5);
    const ok = await s.service.submitLobbyCommand(
      { roomId: s.roomId, userId: 'u1' },
      { protocolVersion: PROTOCOL_VERSION, commandId: 'st2', type: 'start_game' },
    );
    expect(ok).toEqual({ ok: true });

    const after = await s.service.getLobby({ roomId: s.roomId, userId: 'u2' });
    expect(after.ok && after.snapshot.status).toBe('in_game');
  });
});

// ---------------------------------------------------------------------------
// D3.4 / B3 — karakter seçimi (`set_avatar`)
// ---------------------------------------------------------------------------

describe('set_avatar', () => {
  const cmd = (commandId: string, character: string, skin: string) =>
    ({
      protocolVersion: PROTOCOL_VERSION,
      commandId,
      type: 'set_avatar',
      character,
      skin,
    }) as Parameters<GameService['submitLobbyCommand']>[1];

  it('seçim yapılmadan koltuk varsayılanı döner ve her üyede doludur', async () => {
    const s = await makeLobby(5);
    const res = await s.service.getLobby({ roomId: s.roomId, userId: 'u1' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snapshot.members.map((m) => m.avatar.character)).toEqual([
      'biyikli-amca',
      'gozluklu',
      'topuzlu',
      'fotr',
      'sakalli',
    ]);
    expect(res.snapshot.members.every((m) => m.avatar.skin.length > 0)).toBe(true);
  });

  it('seçim kaydedilir, idempotenttir ve yalnız gönderen koltuğu etkiler', async () => {
    const s = await makeLobby(5);
    const actor = { roomId: s.roomId, userId: 'u3' };
    expect(await s.service.submitLobbyCommand(actor, cmd('a1', 'fotr', 'koyu'))).toEqual({ ok: true });
    expect(await s.service.submitLobbyCommand(actor, cmd('a1', 'fotr', 'koyu'))).toEqual({ ok: true });

    const res = await s.service.getLobby(actor);
    if (!res.ok) throw new Error('lobi yok');
    const mine = res.snapshot.members.find((m) => m.isLocal);
    expect(mine?.avatar).toEqual({ character: 'fotr', skin: 'koyu' });
    // Diğer koltuklar kendi varsayılanlarını korur.
    expect(res.snapshot.members[0]?.avatar.character).toBe('biyikli-amca');
  });

  it('iki oyuncu aynı karakteri seçebilir; zorlama yok', async () => {
    const s = await makeLobby(5);
    await s.service.submitLobbyCommand({ roomId: s.roomId, userId: 'u1' }, cmd('a1', 'fotr', 'orta'));
    await s.service.submitLobbyCommand({ roomId: s.roomId, userId: 'u2' }, cmd('a2', 'fotr', 'orta'));
    const res = await s.service.getLobby({ roomId: s.roomId, userId: 'u1' });
    if (!res.ok) throw new Error('lobi yok');
    expect(res.snapshot.members[0]?.avatar).toEqual({ character: 'fotr', skin: 'orta' });
    expect(res.snapshot.members[1]?.avatar).toEqual({ character: 'fotr', skin: 'orta' });
  });

  it('seçilmemiş koltuğun VARSAYILANI çakışırsa sunucu farklı ten önerir', async () => {
    const s = await makeLobby(5);
    // 3. koltuğun varsayılanı `fotr`/`acik`; host onu açıkça seçerse varsayılan kayar.
    await s.service.submitLobbyCommand({ roomId: s.roomId, userId: 'u1' }, cmd('a1', 'fotr', 'acik'));
    const res = await s.service.getLobby({ roomId: s.roomId, userId: 'u1' });
    if (!res.ok) throw new Error('lobi yok');
    expect(res.snapshot.members[0]?.avatar).toEqual({ character: 'fotr', skin: 'acik' });
    const seat3 = res.snapshot.members[3];
    expect(seat3?.avatar.character).toBe('fotr');
    expect(seat3?.avatar.skin).not.toBe('acik');
  });

  it('geçersiz kimlik INVALID_OPTION ile reddedilir', async () => {
    const s = await makeLobby(5);
    const actor = { roomId: s.roomId, userId: 'u1' };
    expect(await s.service.submitLobbyCommand(actor, cmd('a1', 'yok-boyle', 'koyu'))).toEqual({
      ok: false,
      error: 'INVALID_OPTION',
    });
    expect(await s.service.submitLobbyCommand(actor, cmd('a2', 'fotr', 'mor'))).toEqual({
      ok: false,
      error: 'INVALID_OPTION',
    });
  });

  it('oyun başladıktan sonra NOT_ALLOWED', async () => {
    const s = await makeLobby(5);
    await readyAll(s, 5);
    const start = await s.service.submitLobbyCommand(
      { roomId: s.roomId, userId: 'u1' },
      { protocolVersion: PROTOCOL_VERSION, commandId: 'go', type: 'start_game' },
    );
    expect(start).toEqual({ ok: true });
    expect(
      await s.service.submitLobbyCommand({ roomId: s.roomId, userId: 'u1' }, cmd('a1', 'fotr', 'koyu')),
    ).toEqual({ ok: false, error: 'NOT_ALLOWED' });
  });

  it('lobide seçilen karakter oyun görünümüne (PlayerView.avatar) taşınır', async () => {
    const s = await makeLobby(5);
    await s.service.submitLobbyCommand({ roomId: s.roomId, userId: 'u2' }, cmd('a1', 'kivircik', 'koyu'));
    await readyAll(s, 5);
    await s.service.submitLobbyCommand(
      { roomId: s.roomId, userId: 'u1' },
      { protocolVersion: PROTOCOL_VERSION, commandId: 'go', type: 'start_game' },
    );
    const view = await s.service.getView({ roomId: s.roomId, userId: 'u1' });
    if (!view.ok) throw new Error('görünüm yok');
    const players = view.response.view.players;
    expect(players[1]?.avatar).toEqual({ character: 'kivircik', skin: 'koyu' });
    expect(players.every((p) => p.avatar.character.length > 0)).toBe(true);
    expect(players[0]?.avatar).toEqual({ character: 'biyikli-amca', skin: 'acik' });
  });
});
