// @vitest-environment jsdom
/**
 * D26 — solo kipte canlı döngünün kapsam dışı bıraktıkları.
 *
 * Doğrulanan: gerçek `useRoomState` solo masaya bağlanırken
 *  1. `fetch` HİÇ çağrılmaz (ne `/api/game` ne başka bir uç),
 *  2. `ensureGuestSession` HİÇ çağrılmaz (anonim Supabase hesabı açılmaz),
 *  3. Realtime sürüm kanalı ve bakış kanalı AÇILMAZ,
 *  4. yine de oyun görünümü gelir ve bot hamlesi ekrana yansır.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  guestCalls: 0,
  watchCalls: 0,
  viewpointCalls: 0,
}));

vi.mock('../multiplayer/guestSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../multiplayer/guestSession')>();
  return {
    ...actual,
    ensureGuestSession: async () => {
      hoisted.guestCalls += 1;
      throw new Error('solo kipte misafir oturumu açılmamalı');
    },
  };
});

vi.mock('../multiplayer/roomChannel', () => ({
  watchRoomRevision: () => {
    hoisted.watchCalls += 1;
    return { stop: () => {}, reauth: async () => {}, poke: () => {} };
  },
  BACKUP_POLL_MS: 10_000,
  ROOM_CHANNEL_EVENT: 'room_revision_changed',
  roomChannelTopic: (roomId: string) => `room:${roomId}`,
}));

vi.mock('../multiplayer/viewpointChannel', () => ({
  openViewpointChannel: () => {
    hoisted.viewpointCalls += 1;
    return {
      sync: () => {},
      stop: () => {},
      reauth: async () => {},
      send: () => false,
      sendEmote: () => false,
    };
  },
}));

const { useRoomState } = await import('../multiplayer/useRoomState');
const { startSolo, stopSolo, SOLO_HUMAN_TOKEN } = await import('./startSolo');
const { resetSoloService } = await import('./soloService');
const { resetSoloMode } = await import('./soloMode');
const { soloCall } = await import('./soloTransport');

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  hoisted.guestCalls = 0;
  hoisted.watchCalls = 0;
  hoisted.viewpointCalls = 0;
  resetSoloService();
  resetSoloMode();
  fetchSpy = vi.fn(() => {
    throw new Error('solo kipte ağa çıkılmamalı');
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  cleanup();
  stopSolo();
  resetSoloService();
  resetSoloMode();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useRoomState — solo kip', () => {
  it('ağa çıkmadan, misafir oturumu açmadan ve kanal kurmadan oyunu gösterir', async () => {
    const { roomId } = await startSolo({ displayName: 'You', startBots: false });

    const { result } = renderHook(() => useRoomState(roomId));

    await waitFor(() => {
      expect(result.current.phase).toBe('game');
    });

    expect(hoisted.guestCalls).toBe(0);
    expect(hoisted.watchCalls).toBe(0);
    expect(hoisted.viewpointCalls).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    if (result.current.phase !== 'game') throw new Error('oyun bekleniyordu');
    expect(result.current.view.players).toHaveLength(6);
    expect(result.current.view.phase).toBe('role_reveal');
    // Solo kipte jest yerelde oynar (bakış kanalı olmadan).
    expect(result.current.sendEmote('hands_up')).toBe(true);
  });

  it('yerel sürüm sinyali görünümü tazeler (Realtime yok)', async () => {
    const { roomId } = await startSolo({ displayName: 'You', startBots: false });
    const { result } = renderHook(() => useRoomState(roomId));
    await waitFor(() => {
      expect(result.current.phase).toBe('game');
    });
    if (result.current.phase !== 'game') throw new Error('oyun bekleniyordu');
    const before = result.current.view.revision;

    // İnsan kendi rolünü onaylar: yerel servis sürüm yazar → kanca yeniden alır.
    await act(async () => {
      const view = result.current.phase === 'game' ? result.current.view : null;
      const ack = view?.actions.find((a) => a.kind === 'ack_role');
      await soloCall(
        'command',
        {
          roomId,
          command: {
            protocolVersion: view!.protocolVersion,
            gameId: view!.gameId ?? '',
            phaseId: view!.phaseId,
            commandId: 'solo-test-ack',
            actionId: ack!.actionId,
            optionId: ack!.options[0]?.optionId,
          },
        },
        SOLO_HUMAN_TOKEN,
      );
    });

    await waitFor(() => {
      if (result.current.phase !== 'game') throw new Error('oyun bekleniyordu');
      expect(result.current.view.revision).toBeGreaterThan(before);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(hoisted.guestCalls).toBe(0);
  });
});
