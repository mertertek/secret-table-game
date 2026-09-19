/**
 * D26 — yerel taşıma katmanı: `apiClient` yüzeyi DEĞİŞMEDEN yerel servise
 * düşer, `ApiResult` şekli `/api/game` ile birebir aynıdır ve `fetch` HİÇ
 * çağrılmaz.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../multiplayer/apiClient';
import { resetSoloMode, soloToken } from './soloMode';
import { resetSoloService } from './soloService';
import { soloCall, soloUserId } from './soloTransport';

const HUMAN = soloToken('solo-you');

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetSoloService();
  resetSoloMode();
  fetchSpy = vi.fn(() => {
    throw new Error('solo kipte ağa çıkılmamalı');
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  api.setSoloTransport(null);
  vi.unstubAllGlobals();
  resetSoloService();
  resetSoloMode();
});

describe('soloUserId', () => {
  it('yalnız `solo:` önekli token çözülür', () => {
    expect(soloUserId('solo:abc')).toBe('abc');
    expect(soloUserId('solo:')).toBeNull();
    expect(soloUserId('dev:abc')).toBeNull();
    expect(soloUserId('eyJhbGciOi...')).toBeNull();
  });
});

describe('soloCall — ApiResult şekli', () => {
  it('create_room başarılı sonucu `{ ok: true, data }` olarak verir', async () => {
    const res = await soloCall<{ roomId: string; inviteCode: string; mode: string }>(
      'create_room',
      { displayName: 'Sen' },
      HUMAN,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(typeof res.data.roomId).toBe('string');
    expect(res.data.inviteCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.data.mode).toBe('memory');
  });

  it('token yoksa/bozuksa gerçek API ile aynı 401', async () => {
    expect(await soloCall('create_room', {}, '')).toEqual({
      ok: false,
      status: 401,
      error: 'MISSING_TOKEN',
    });
    expect(await soloCall('create_room', {}, 'dev:x')).toEqual({
      ok: false,
      status: 401,
      error: 'SESSION_INVALID',
    });
  });

  it('bilinmeyen eylem 400, eksik roomId 400, olmayan oda 404', async () => {
    expect(await soloCall('nope', {}, HUMAN)).toEqual({
      ok: false,
      status: 400,
      error: 'UNKNOWN_ACTION',
    });
    expect(await soloCall('view', {}, HUMAN)).toEqual({
      ok: false,
      status: 400,
      error: 'MISSING_ROOM_ID',
    });
    expect(await soloCall('lobby_view', { roomId: 'yok' }, HUMAN)).toEqual({
      ok: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
    });
    expect(await soloCall('join_room', { inviteCode: 'ZZZZZZ' }, HUMAN)).toEqual({
      ok: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
    });
  });

  it('izin verilmeyen lobi komutu 409 döner (api/game.ts eşlemesi)', async () => {
    const created = await soloCall<{ roomId: string }>('create_room', { displayName: 'Sen' }, HUMAN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    // 6 kişilik masa kurulmadan `start_game` reddedilir.
    const started = await soloCall('lobby', {
      roomId: created.data.roomId,
      command: { protocolVersion: 1, commandId: 'c1', type: 'start_game' },
    }, HUMAN);
    expect(started.ok).toBe(false);
    if (started.ok) return;
    expect(started.status).toBe(409);
    expect(started.error).toBe('NOT_ALLOWED');
  });
});

describe('apiClient anahtarı', () => {
  it('setSoloTransport ile bütün yüzey yerel servise düşer, fetch çağrılmaz', async () => {
    api.setSoloTransport(soloCall);
    expect(api.soloTransportActive()).toBe(true);

    const created = await api.createRoom(HUMAN, 'Sen');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const { roomId, inviteCode } = created.data;

    const joined = await api.joinRoom(soloToken('bot-1'), inviteCode, 'Ada');
    expect(joined.ok).toBe(true);

    const lobby = await api.fetchLobby(HUMAN, roomId);
    expect(lobby.ok).toBe(true);
    if (!lobby.ok) return;
    expect(lobby.data.members).toHaveLength(2);
    expect(lobby.data.status).toBe('lobby');

    const heartbeat = await api.sendHeartbeat(HUMAN, roomId);
    expect(heartbeat.ok).toBe(true);

    // Oyun başlamadığı için `view` 409 verir — gerçek API ile aynı.
    const view = await api.fetchView(HUMAN, roomId);
    expect(view.ok).toBe(false);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('setSoloTransport(null) sonrası normal `/api/game` yoluna döner', async () => {
    api.setSoloTransport(soloCall);
    api.setSoloTransport(null);
    expect(api.soloTransportActive()).toBe(false);
    // `fetch` taklidi fırlatıyor → istemci ağ hatası şekline düşer.
    expect(await api.createRoom(HUMAN, 'Sen')).toEqual({
      ok: false,
      status: 0,
      error: 'NETWORK_ERROR',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
