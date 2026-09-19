// @vitest-environment jsdom
/**
 * D18/B4 — `useRoomState` cue dağıtımının istemci tarafı.
 *
 * Doğrulanan:
 *  1. `view` isteği elimizdeki son sürümü `sinceRevision` ile bildirir
 *     (ilk alımda ve `resync` istendiğinde bildirmez),
 *  2. sürüm sinyaliyle gelen cue'lar mevcut kuyruğa eklenir,
 *  3. aynı `cueId` ikinci kez kuyruğa girmez (sahne bir kez oynatır).
 *
 * Ağ katmanı taklit edilir; `roomChannel` sürüm sinyalini elle tetiklememizi
 * sağlar. Sunucu tarafı `packages/server/src/service.cues.test.ts` içindedir.
 */
import type { PlayerViewResponse, SceneCue, SceneView } from '@secret-table/contracts';
import { getSceneFixture } from '@secret-table/fixtures';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  viewCalls: [] as { resync: boolean; sinceRevision: number | undefined }[],
  /** D20 — hızlı yol: sinyal sonrası `lobby_view` turu OLMAMALI. */
  lobbyCalls: 0,
  /** Sıradaki `view` yanıtları; tükenince son yanıt tekrar edilir. */
  viewQueue: [] as PlayerViewResponse[],
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
    sendRevision: () => false,
  }),
}));

vi.mock('./apiClient', () => ({
  createRoom: async () => ({ ok: true, data: { roomId: 'r1', inviteCode: 'AAAAAA' } }),
  joinRoom: async () => ({ ok: true, data: { roomId: 'r1' } }),
  fetchLobby: async () => {
    hoisted.lobbyCalls += 1;
    return {
      ok: true,
      data: { status: 'in_game', roomId: 'r1', inviteCode: 'AAAAAA', members: [] },
    };
  },
  fetchView: async (
    _token: string,
    _roomId: string,
    resync: boolean,
    sinceRevision: number | undefined,
  ) => {
    hoisted.viewCalls.push({ resync, sinceRevision });
    const next =
      hoisted.viewQueue.length > 1 ? hoisted.viewQueue.shift() : hoisted.viewQueue[0];
    return { ok: true, data: next };
  },
  sendCommand: async () => ({ ok: false, status: 0, error: 'NETWORK_ERROR' }),
  sendLobbyCommand: async () => ({ ok: true, data: { ok: true } }),
  sendHeartbeat: async () => ({ ok: true, data: { ok: true, sessionGeneration: 1 } }),
  claimControl: async () => ({ ok: true, data: { sessionGeneration: 1 } }),
}));

const { useRoomState } = await import('./useRoomState');

const base = getSceneFixture('voting')!.view;

function viewAt(revision: number): SceneView {
  return { ...base, revision, connection: 'connected' };
}

function eliminationCue(revision: number, index = 0): SceneCue {
  return {
    gameId: base.gameId as string,
    revision,
    cueId: `${base.gameId}:${revision}:${index}`,
    kind: 'player_eliminated',
    playerId: base.players[1]!.playerId,
  };
}

function response(revision: number, cues: readonly SceneCue[]): PlayerViewResponse {
  return { view: viewAt(revision), cues, resync: false };
}

beforeEach(() => {
  hoisted.viewCalls.length = 0;
  hoisted.viewQueue.length = 0;
  hoisted.lobbyCalls = 0;
  hoisted.onRevision = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
});

describe('useRoomState — cue dağıtımı', () => {
  it('ilk alım sinceRevision göndermez, sonraki alım son sürümü bildirir', async () => {
    hoisted.viewQueue.push(response(10, []), response(11, [eliminationCue(11)]));
    const { result } = renderHook(() => useRoomState('r1'));

    await waitFor(() => expect(result.current.phase).toBe('game'));
    // İlk alım: elimizde sürüm yok + `needResync` → cue istenmez.
    expect(hoisted.viewCalls[0]).toEqual({ resync: true, sinceRevision: undefined });

    await act(async () => {
      hoisted.onRevision?.({ roomId: 'r1', revision: 11 });
      await Promise.resolve();
    });

    await waitFor(() => {
      const last = hoisted.viewCalls[hoisted.viewCalls.length - 1];
      expect(last).toEqual({ resync: false, sinceRevision: 10 });
    });
  });

  it('D20: oyundayken sürüm sinyali yalnız `view` turu yapar (lobi turu yok)', async () => {
    hoisted.viewQueue.push(response(10, []), response(11, []));
    const { result } = renderHook(() => useRoomState('r1'));

    await waitFor(() => expect(result.current.phase).toBe('game'));
    const lobbyAfterMount = hoisted.lobbyCalls;
    const viewsAfterMount = hoisted.viewCalls.length;
    expect(lobbyAfterMount).toBeGreaterThan(0); // ilk yükleme lobi turunu yapar

    await act(async () => {
      hoisted.onRevision?.({ roomId: 'r1', revision: 11 });
      await Promise.resolve();
    });
    await waitFor(() => expect(hoisted.viewCalls.length).toBeGreaterThan(viewsAfterMount));

    // Hızlı yol: sinyal başına TEK `view`, ek `lobby_view` YOK.
    expect(hoisted.lobbyCalls).toBe(lobbyAfterMount);
    expect(hoisted.viewCalls.length).toBe(viewsAfterMount + 1);
  });

  it('sürüm sinyaliyle gelen cue kuyruğa girer', async () => {
    hoisted.viewQueue.push(response(10, []), response(11, [eliminationCue(11)]));
    const { result } = renderHook(() => useRoomState('r1'));
    await waitFor(() => expect(result.current.phase).toBe('game'));

    await act(async () => {
      hoisted.onRevision?.({ roomId: 'r1', revision: 11 });
      await Promise.resolve();
    });

    await waitFor(() => {
      if (result.current.phase !== 'game') throw new Error('oyun değil');
      expect(result.current.cues.map((c) => c.cueId)).toEqual([`${base.gameId}:11:0`]);
    });
  });

  it('aynı cueId ikinci kez kuyruğa girmez', async () => {
    const cue = eliminationCue(11);
    hoisted.viewQueue.push(response(10, []), response(11, [cue]), response(11, [cue]));
    const { result } = renderHook(() => useRoomState('r1'));
    await waitFor(() => expect(result.current.phase).toBe('game'));

    await act(async () => {
      hoisted.onRevision?.({ roomId: 'r1', revision: 11 });
      await Promise.resolve();
    });
    await waitFor(() => {
      if (result.current.phase !== 'game') throw new Error('oyun değil');
      expect(result.current.cues).toHaveLength(1);
    });

    // Aynı sürüm için ikinci alım (kaçan sinyal güvencesi): tekrar oynatma yok.
    await act(async () => {
      if (result.current.phase === 'game') result.current.refresh();
      await Promise.resolve();
    });
    await waitFor(() => {
      if (result.current.phase !== 'game') throw new Error('oyun değil');
      expect(result.current.cues.filter((c) => c.cueId === cue.cueId)).toHaveLength(1);
    });
  });
});
