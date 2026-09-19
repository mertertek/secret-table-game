// @vitest-environment jsdom
/**
 * D21 — `useRoomState` inceleme düzeltmeleri (istemci tarafı).
 *
 * Doğrulanan:
 *  A. oyun sonu → lobiye dönüş: `view` yanıtı `roomStatus: 'lobby'` derse lobi
 *     yoluna düşülür, ve yedek yoklama (`revision: -1`) TAM tur yapar
 *     (`lobby_view` + `view`) — böylece sinyal kaçsa da lobi görülür;
 *  B. yarış: aynı oyunun ESKİ sürümünü taşıyan gecikmiş yanıt görünümü geriye
 *     sarmaz (ters sırada gelen iki yanıt dahil);
 *  D. `resync` bayrağı tüketilmez: istek SÜRERKEN bağlantı toparlanırsa o yanıt
 *     resync olarak uygulanır (cue kuyruğu boşalır, `resetEpoch` artar).
 *
 * Ağ katmanı taklit edilir; `roomChannel` sinyali elle tetiklememizi sağlar.
 * Sunucu tarafı `packages/server/src/service.room-status.test.ts` içindedir.
 */
import type { PlayerViewResponse, SceneCue, SceneView } from '@secret-table/contracts';
import { getSceneFixture } from '@secret-table/fixtures';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ViewCall = { resync: boolean; sinceRevision: number | undefined; sinceGameId?: string };
type ViewResult =
  | { ok: true; data: PlayerViewResponse }
  | { ok: false; status: number; error: string };

const hoisted = vi.hoisted(() => ({
  viewCalls: [] as ViewCall[],
  lobbyCalls: 0,
  lobbyStatus: 'in_game' as 'in_game' | 'lobby',
  /** Çağrı sırasına göre yanıt üretir (söz döndürerek elle çözdürülebilir). */
  handler: null as null | ((index: number) => ViewResult | Promise<ViewResult>),
  onRevision: null as null | ((signal: { roomId: string; revision: number }) => void),
}));

vi.mock('./guestSession', () => ({
  ensureGuestSession: async () => ({ mode: 'memory' }),
  currentAccessToken: async () => 'token',
}));

vi.mock('./roomChannel', () => ({
  watchRoomRevision: (opts: {
    onRevision: (signal: { roomId: string; revision: number }) => void;
  }) => {
    hoisted.onRevision = opts.onRevision;
    return { stop: () => {}, reauth: async () => {}, poke: () => {} };
  },
}));

vi.mock('./viewpointChannel', () => ({
  openViewpointChannel: () => ({
    sync: () => {},
    stop: () => {},
    reauth: async () => {},
    send: () => false,
    sendEmote: () => false,
  }),
}));

vi.mock('./apiClient', () => ({
  createRoom: async () => ({ ok: true, data: { roomId: 'r1', inviteCode: 'AAAAAA' } }),
  joinRoom: async () => ({ ok: true, data: { roomId: 'r1' } }),
  fetchLobby: async () => {
    hoisted.lobbyCalls += 1;
    return {
      ok: true,
      data: {
        status: hoisted.lobbyStatus,
        roomId: 'r1',
        inviteCode: 'AAAAAA',
        localPlayerId: 'p1',
        isHost: true,
        members: [],
        minPlayers: 5,
        maxPlayers: 10,
        canStart: false,
      },
    };
  },
  fetchView: (
    _token: string,
    _roomId: string,
    resync: boolean,
    sinceRevision: number | undefined,
    sinceGameId: string | undefined,
  ) => {
    const index = hoisted.viewCalls.length;
    hoisted.viewCalls.push({ resync, sinceRevision, sinceGameId });
    return Promise.resolve(hoisted.handler?.(index) ?? { ok: false, status: 0, error: 'NO_HANDLER' });
  },
  sendCommand: async () => ({ ok: false, status: 0, error: 'NETWORK_ERROR' }),
  sendLobbyCommand: async () => ({ ok: true, data: { ok: true } }),
  sendHeartbeat: async () => ({ ok: true, data: { ok: true, sessionGeneration: 1 } }),
  claimControl: async () => ({ ok: true, data: { sessionGeneration: 1 } }),
}));

const { useRoomState } = await import('./useRoomState');

const base = getSceneFixture('voting')!.view;
const gameId = base.gameId as string;

function viewAt(revision: number): SceneView {
  return { ...base, revision, connection: 'connected' };
}

function cueAt(revision: number, index = 0): SceneCue {
  return {
    gameId,
    revision,
    cueId: `${gameId}:${revision}:${index}`,
    kind: 'player_eliminated',
    playerId: base.players[1]!.playerId,
  };
}

function ok(
  revision: number,
  extra: { cues?: readonly SceneCue[]; roomStatus?: 'lobby' | 'in_game' } = {},
): ViewResult {
  return {
    ok: true,
    data: {
      view: viewAt(revision),
      cues: extra.cues ?? [],
      resync: false,
      ...(extra.roomStatus ? { roomStatus: extra.roomStatus } : {}),
    },
  };
}

/** Sinyal / yoklama tetikler ve mikro görevleri boşaltır. */
async function signal(revision: number): Promise<void> {
  await act(async () => {
    hoisted.onRevision?.({ roomId: 'r1', revision });
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  hoisted.viewCalls.length = 0;
  hoisted.lobbyCalls = 0;
  hoisted.lobbyStatus = 'in_game';
  hoisted.handler = null;
  hoisted.onRevision = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
});

describe('D21/A — oyun sonu → lobiye dönüş', () => {
  it('view yanıtı roomStatus=lobby derse lobi ekranına geçilir', async () => {
    hoisted.handler = (i) => (i === 0 ? ok(10) : ok(10, { roomStatus: 'lobby' }));
    const { result } = renderHook(() => useRoomState('r1'));
    await waitFor(() => expect(result.current.phase).toBe('game'));

    // Host "Lobiye dön" dedi: oda durumu değişti, oyun durumu satırı DURUYOR.
    hoisted.lobbyStatus = 'lobby';
    await signal(11);

    await waitFor(() => expect(result.current.phase).toBe('lobby'));
  });

  it('yedek yoklama (-1) TAM tur yapar; gerçek sinyal yalnız view turu', async () => {
    hoisted.handler = () => ok(10);
    const { result } = renderHook(() => useRoomState('r1'));
    await waitFor(() => expect(result.current.phase).toBe('game'));

    const lobbyAfterMount = hoisted.lobbyCalls;
    const viewsAfterMount = hoisted.viewCalls.length;

    // Gerçek sürüm sinyali: hızlı yol (D20 kazancı korunur).
    await signal(11);
    await waitFor(() => expect(hoisted.viewCalls.length).toBe(viewsAfterMount + 1));
    expect(hoisted.lobbyCalls).toBe(lobbyAfterMount);

    // Yedek yoklama / yeniden abonelik: tam tur (oda durumu da görülür).
    await signal(-1);
    await waitFor(() => expect(hoisted.lobbyCalls).toBe(lobbyAfterMount + 1));
  });
});

describe('D21/B — eski yanıt görünümü geriye sarmaz', () => {
  it('gecikmiş ESKİ sürüm yanıtı uygulanmaz', async () => {
    hoisted.handler = (i) => (i === 0 ? ok(10) : i === 1 ? ok(12, { cues: [cueAt(12)] }) : ok(10));
    const { result } = renderHook(() => useRoomState('r1'));
    await waitFor(() => expect(result.current.phase).toBe('game'));

    await signal(12);
    await waitFor(() => {
      if (result.current.phase !== 'game') throw new Error('oyun değil');
      expect(result.current.view.revision).toBe(12);
    });

    // Gecikmiş, ESKİ sürümü taşıyan yanıt: görünüm 12'de kalır, cue düşmez.
    await signal(13);
    await waitFor(() => expect(hoisted.viewCalls.length).toBeGreaterThan(2));
    if (result.current.phase !== 'game') throw new Error('oyun değil');
    expect(result.current.view.revision).toBe(12);
    expect(result.current.cues.map((c) => c.cueId)).toEqual([`${gameId}:12:0`]);
  });

  it('ters sırada çözülen iki istekte görünüm en YENİ sürümde kalır', async () => {
    const pending = new Map<number, (value: ViewResult) => void>();
    hoisted.handler = (i) => {
      if (i === 0) return ok(10);
      return new Promise<ViewResult>((resolve) => pending.set(i, resolve));
    };
    const { result } = renderHook(() => useRoomState('r1'));
    await waitFor(() => expect(result.current.phase).toBe('game'));

    // İki isteği paralel başlat (biri yoklama, biri açık `refresh`).
    await act(async () => {
      if (result.current.phase === 'game') result.current.refresh();
      await Promise.resolve();
    });
    await act(async () => {
      if (result.current.phase === 'game') result.current.refresh();
      await Promise.resolve();
    });
    await waitFor(() => expect(pending.size).toBe(2));

    const [firstIndex, secondIndex] = [...pending.keys()].sort((a, b) => a - b);
    // DAHA YENİ istek (ikinci) önce döner: sürüm 11.
    await act(async () => {
      pending.get(secondIndex!)!(ok(11, { cues: [cueAt(11)] }));
      await Promise.resolve();
    });
    // Gecikmiş İLK istek eski sürümle döner: uygulanmamalı.
    await act(async () => {
      pending.get(firstIndex!)!(ok(10));
      await Promise.resolve();
    });

    await waitFor(() => {
      if (result.current.phase !== 'game') throw new Error('oyun değil');
      expect(result.current.view.revision).toBe(11);
    });
    if (result.current.phase !== 'game') throw new Error('oyun değil');
    expect(result.current.cues.map((c) => c.cueId)).toEqual([`${gameId}:11:0`]);
  });
});

describe('D21/D — resync bayrağı tüketilmez', () => {
  it('istek sürerken bağlantı toparlanırsa o yanıt resync olarak uygulanır', async () => {
    // 0: ok(10) → uygulanır, `needResync` temizlenir.
    // 1: ağ hatası → bağlantı "reconnecting".
    // 2: ok(11) + cue → `noteHttp(true)` `needResync`'i açar; yanıt RESYNC olmalı.
    hoisted.handler = (i) => {
      if (i === 0) return ok(10);
      if (i === 1) return { ok: false as const, status: 0, error: 'NETWORK_ERROR' };
      return ok(11, { cues: [cueAt(11)] });
    };
    const { result } = renderHook(() => useRoomState('r1'));
    await waitFor(() => expect(result.current.phase).toBe('game'));
    if (result.current.phase !== 'game') throw new Error('oyun değil');
    const epochBefore = result.current.resetEpoch;

    await signal(11);
    await waitFor(() => expect(hoisted.viewCalls.length).toBeGreaterThanOrEqual(2));
    await signal(11);
    await waitFor(() => {
      if (result.current.phase !== 'game') throw new Error('oyun değil');
      expect(result.current.view.revision).toBe(11);
    });
    if (result.current.phase !== 'game') throw new Error('oyun değil');

    // Resync uygulandı: açık reset nesli arttı ve cue kuyruğu boş kaldı
    // (birikmiş koreografi yeniden oynamaz).
    expect(result.current.resetEpoch).toBeGreaterThan(epochBefore);
    expect(result.current.cues).toEqual([]);

    // Bayrak TÜKETİLDİ: sonraki istek resync istemez ve son sürümü bildirir.
    await signal(12);
    await waitFor(() => {
      const last = hoisted.viewCalls[hoisted.viewCalls.length - 1];
      expect(last).toMatchObject({ resync: false, sinceRevision: 11, sinceGameId: gameId });
    });
  });
});
