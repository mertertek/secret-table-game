// @vitest-environment jsdom
/**
 * D20 — oda sürüm sinyali izleyicisi.
 *
 * Doğrulanan:
 *  1. kanal ve olay adları DB tarafıyla (0002 `notify_room_revision`) birebir
 *     aynı sabitlerden gelir ve kanal ÖZEL abone olunur,
 *  2. (yeniden) abonelikte "bilinmiyor" (-1) tetiklenir, hata durumları
 *     bağlantıyı `reconnecting`e düşürür,
 *  3. yayın mesajı sürümü yukarı verir, 1 s içindeki aynı sürüm tekrarı düşer,
 *  4. yedek yoklama `BACKUP_POLL_MS` (D21: 10 s) aralıklıdır, `poke()` sayacı
 *     sıfırlar ve `backupEnabled` false iken tur atlanır (kota),
 *  5. `stop()` her şeyi kapatır: ne yoklama ne yeniden yetkilendirme kalır.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ channel: vi.fn(), removeChannel: vi.fn(), setAuth: vi.fn(), client: { value: true } }));
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () =>
    mock.client.value
      ? { channel: mock.channel, removeChannel: mock.removeChannel, realtime: { setAuth: mock.setAuth } }
      : null,
}));

import { BACKUP_POLL_MS, ROOM_CHANNEL_EVENT, roomChannelTopic, watchRoomRevision } from './roomChannel';

const ROOM = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
type Entry = {
  topic: string;
  config: unknown;
  event?: string;
  handler?: (message: { payload: unknown }) => void;
  status?: (status: string, err?: Error) => void;
};
let entries: Entry[] = [];
const watchers: ReturnType<typeof watchRoomRevision>[] = [];

function open(options: Partial<Parameters<typeof watchRoomRevision>[0]> = {}) {
  const onRevision = vi.fn();
  const onConnState = vi.fn();
  const w = watchRoomRevision({ roomId: ROOM, onRevision, onConnState, getToken: async () => 'jwt', ...options });
  watchers.push(w);
  return { w, onRevision: (options.onRevision ?? onRevision) as ReturnType<typeof vi.fn>, onConnState };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  vi.clearAllMocks();
  entries = [];
  mock.client.value = true;
  mock.setAuth.mockResolvedValue(undefined);
  mock.removeChannel.mockResolvedValue('ok');
  mock.channel.mockImplementation((topic: string, config: unknown) => {
    const e: Entry = { topic, config };
    const api = {
      on: vi.fn((_type: string, filter: { event: string }, cb: Entry['handler']) => {
        e.event = filter.event;
        e.handler = cb;
        return api;
      }),
      subscribe: vi.fn((cb: Entry['status']) => {
        e.status = cb;
        return api;
      }),
    };
    entries.push(e);
    return api;
  });
});

afterEach(() => {
  watchers.splice(0).forEach((w) => w.stop());
  vi.useRealTimers();
});

describe('room revision watcher', () => {
  it('kanal/olay adları DB tarafıyla eşleşir', () => {
    expect(ROOM_CHANNEL_EVENT).toBe('room_revision_changed');
    expect(roomChannelTopic(ROOM)).toBe(`room:${ROOM}`);
    // D21 — canlı yük düzeltmesi: 3 s → 10 s (sinyal yolu zaten ~363 ms;
    // yoklama yalnız güvenlik ağı). Kota: 10 oyuncu × 6 istek/dk.
    expect(BACKUP_POLL_MS).toBe(10_000);
  });

  it('özel kanala abone olur ve yalnız o olayı dinler', async () => {
    open();
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.setAuth).toHaveBeenCalledWith('jwt');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.topic).toBe(roomChannelTopic(ROOM));
    expect(entries[0]!.config).toEqual({ config: { private: true } });
    expect(entries[0]!.event).toBe(ROOM_CHANNEL_EVENT);
  });

  it('abonelik durumu bağlantıyı bildirir ve kaçan sürümleri toplar', async () => {
    const { onRevision, onConnState } = open();
    await vi.advanceTimersByTimeAsync(1);
    entries[0]!.status!('SUBSCRIBED');
    expect(onConnState).toHaveBeenCalledWith('connected');
    expect(onRevision).toHaveBeenCalledWith({ roomId: ROOM, revision: -1 });
    entries[0]!.status!('CHANNEL_ERROR', new Error('boom'));
    expect(onConnState).toHaveBeenLastCalledWith('reconnecting');
    entries[0]!.status!('TIMED_OUT');
    expect(onConnState).toHaveBeenLastCalledWith('reconnecting');
  });

  it('yayın mesajı sürümü verir; 1 s içindeki aynı sürüm tekrarı düşer', async () => {
    const { onRevision } = open();
    await vi.advanceTimersByTimeAsync(1);
    entries[0]!.handler!({ payload: { roomId: ROOM, revision: 7 } });
    entries[0]!.handler!({ payload: { roomId: ROOM, revision: 7 } });
    expect(onRevision.mock.calls.filter((c) => c[0].revision === 7)).toHaveLength(1);
    // Sürüm alanı yoksa hiç tetiklenmez (gizli/bozuk yük kabul edilmez).
    entries[0]!.handler!({ payload: { roomId: ROOM } });
    expect(onRevision.mock.calls.filter((c) => c[0].revision === undefined)).toHaveLength(0);
    // 1 s sonra aynı sürüm yeniden kabul edilir (kaçan görünüm güvencesi).
    await vi.advanceTimersByTimeAsync(1_100);
    entries[0]!.handler!({ payload: { roomId: ROOM, revision: 7 } });
    expect(onRevision.mock.calls.filter((c) => c[0].revision === 7)).toHaveLength(2);
  });

  it('yedek yoklama BACKUP_POLL_MS aralıklıdır ve poke() sayacı sıfırlar', async () => {
    const { w, onRevision } = open();
    await vi.advanceTimersByTimeAsync(1);
    const backups = () => onRevision.mock.calls.filter((c) => c[0].revision === -1).length;
    const base = backups();
    await vi.advanceTimersByTimeAsync(BACKUP_POLL_MS - 100);
    expect(backups()).toBe(base);
    await vi.advanceTimersByTimeAsync(200);
    expect(backups()).toBe(base + 1);
    // poke: süre dolmadan sıfırlanınca beklenen anda yoklama GİTMEZ.
    await vi.advanceTimersByTimeAsync(BACKUP_POLL_MS - 200);
    w.poke();
    await vi.advanceTimersByTimeAsync(300);
    expect(backups()).toBe(base + 1);
    // Sıfırlanan sayaç kendi süresini doldurunca yine yoklar.
    await vi.advanceTimersByTimeAsync(BACKUP_POLL_MS - 200);
    expect(backups()).toBe(base + 2);
  });

  // D21/I — lobide çağıranın kendi yoklaması iş görüyor; kanal yoklaması susar.
  it('backupEnabled false iken yedek tur atlanır, true olunca döner', async () => {
    let enabled = false;
    const { onRevision } = open({ backupEnabled: () => enabled });
    await vi.advanceTimersByTimeAsync(1);
    const backups = () => onRevision.mock.calls.filter((c) => c[0].revision === -1).length;
    const base = backups();
    await vi.advanceTimersByTimeAsync(BACKUP_POLL_MS * 3);
    expect(backups()).toBe(base);
    enabled = true;
    await vi.advanceTimersByTimeAsync(BACKUP_POLL_MS + 100);
    expect(backups()).toBe(base + 1);
  });

  it('stop() sonrası yoklama da yeniden yetkilendirme de olmaz', async () => {
    const { w, onRevision } = open();
    await vi.advanceTimersByTimeAsync(1);
    w.stop();
    const after = onRevision.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onRevision.mock.calls).toHaveLength(after);
    expect(mock.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('Realtime yapılandırılmamışsa yalnız yedek yoklama çalışır', async () => {
    mock.client.value = false;
    const { onRevision, onConnState } = open();
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.channel).not.toHaveBeenCalled();
    expect(onConnState).toHaveBeenCalledWith('connected');
    await vi.advanceTimersByTimeAsync(BACKUP_POLL_MS + 100);
    expect(onRevision).toHaveBeenCalledWith({ roomId: ROOM, revision: -1 });
  });
});
