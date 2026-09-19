/**
 * Oda sürüm sinyali: özel Realtime kanalı `room:<roomId>` yalnız
 * `{roomId, revision}` taşır. Sinyal gelince (veya yedek kontrolde) çağıran
 * yetkili görünümü HTTP'den yeniden alır.
 *
 * Kaçan bildirime karşı: kanal yeniden abonelik, sekme tekrar etkinleşince
 * kontrol, çevrimiçi/çevrimdışı olayları ve düşük sıklıklı yedek HTTP kontrolü.
 *
 * Özel kanal için Realtime soketi kullanıcı JWT'siyle yetkilendirilmelidir
 * (`realtime.setAuth`). Token yenilenince yeniden yetkilendirilir.
 */

import type { RoomRevisionSignal } from '@secret-table/contracts';

import { getSupabaseClient } from './supabaseClient';

/** İstemci-tarafı bağlantı durumu (sunucu görünümüne adaptör tarafından işlenir). */
export type RealtimeConnState = 'connected' | 'reconnecting' | 'disconnected';

/**
 * Kanal ve olay adları DB tarafıyla harfi harfine eşleşmelidir:
 * `public.notify_room_revision` (supabase/migrations/0002_functions.sql) topic'i
 * `'room:' || room_id` ve olayı `room_revision_changed` olarak yazar. Test bu
 * sabitleri doğrular; adlar burada tek yerde durur.
 */
export const ROOM_CHANNEL_EVENT = 'room_revision_changed';
export const roomChannelTopic = (roomId: string): string => `room:${roomId}`;

/**
 * Yedek HTTP yoklama aralığı. **D21 — 3 s → 10 s.**
 *
 * D20 3 s'ye indirmişti; canlıda (Vercel, 7 gerçek oyuncu) bu yük sunucuyu
 * dayanılmaz hâle getirdi: 7 oyuncu × 20 istek/dk = 140 `view` isteği/dk ve o
 * dönemde her istek 10+ ardışık Supabase turu yapıyordu (D21/J). Sinyal yolu
 * ZATEN çalışıyor (ölçüldü ~363 ms, docs/qa/claude/D20-realtime.md), bu yüzden
 * yoklama görünür gecikmeyi belirlemiyor; yalnız kaçan bildirim, kopmuş kanal
 * ve arka plana alınmış sekme için GÜVENLİK AĞIdır.
 *
 * **D21/I — yorum düzeltmesi.** Eski yorum "DB→Realtime özel yayını hiç teslim
 * edilmiyor" diyordu; D20 ölçümü bunun TERSİNİ gösterdi. Eski yorumun andığı
 * `viewpointChannel.sendRevision` de DENENDİ ve GERİ ALINDI; öyle bir işlev
 * yok — zamanlayıcıyı `poke()` sıfırlar (komut yanıtı / uygulanan görünüm).
 *
 * Yeni üst sınır: 10 oyuncu × 6 istek/dk = ~60 `view` isteği/dk oyun başına
 * (3 s'de 200/dk idi); `poke()` ve lobide yoklamanın durması (`backupEnabled`)
 * bunu daha da aşağı çeker.
 */
export const BACKUP_POLL_MS = 10_000;

export type RevisionWatcherOptions = {
  roomId: string;
  /** Yeni (daha yüksek olabilecek) sürüm haberi geldiğinde. `revision: -1` → "yeniden al". */
  onRevision: (signal: RoomRevisionSignal) => void;
  /** Realtime kanal / ağ durumu değişince. */
  onConnState?: (state: RealtimeConnState) => void;
  /** Her (yeniden) abonelikte güncel access token. Özel kanal yetkisi için. */
  getToken?: () => Promise<string | null>;
  /** Yedek kontrol aralığı (ms). Varsayılan `BACKUP_POLL_MS` (3 sn). */
  backupIntervalMs?: number;
  /**
   * D21/I — yedek yoklama ŞU AN gerekli mi. `false` dönerse tur atlanır
   * (zamanlayıcı çalışmaya devam eder, istek gitmez). Lobide çağıranın kendi
   * lobi yoklaması iş görüyor; aynı işi iki yerden yapmak kotayı boşa harcar.
   */
  backupEnabled?: () => boolean;
};

export type RoomWatcher = {
  stop: () => void;
  /** Token yenilendiğinde çağır: Realtime soketini yeni JWT ile yetkilendirir. */
  reauth: () => Promise<void>;
  /**
   * D20 — görünüm başka bir yoldan (komut yanıtı, eş sürüm ipucu) tazelendi:
   * yedek yoklama sayacını sıfırla. Böylece etkin oyunda gereksiz `view`
   * isteği gitmez; en kötü gecikme yine `backupIntervalMs` ile sınırlı kalır.
   */
  poke: () => void;
};

export function watchRoomRevision(options: RevisionWatcherOptions): RoomWatcher {
  const {
    roomId,
    onRevision,
    onConnState,
    getToken,
    backupIntervalMs = BACKUP_POLL_MS,
    backupEnabled,
  } = options;
  const client = getSupabaseClient();
  const disposers: Array<() => void> = [];
  let stopped = false;

  const setConn = (s: RealtimeConnState): void => onConnState?.(s);

  const reauth = async (): Promise<void> => {
    if (!client || !getToken) return;
    try {
      const token = await getToken();
      // Yalnız GERÇEK token ile çağır. `setAuth(null)` mevcut token'ı siler ve
      // özel kanal aboneliğini anon'a düşürür (401). Token yoksa dokunma.
      if (token) {
        // setAuth imzası sürüme göre sync/async olabilir; ikisini de tolere et.
        await Promise.resolve(client.realtime.setAuth(token));
      }
    } catch {
      /* yut */
    }
  };

  if (client) {
    let channel: ReturnType<typeof client.channel> | null = null;
    // DB her sürüm için iki sinyal üretir (`commit_move` explicit + `game_states`
    // tetikleyicisi). Kısa pencerede aynı sürümü tekrar iletme.
    let lastSignalRevision = -1;
    let lastSignalAt = 0;

    const subscribe = async (): Promise<void> => {
      if (stopped) return;
      await reauth();
      if (stopped) return;
      channel = client.channel(roomChannelTopic(roomId), { config: { private: true } });
      channel
        .on('broadcast', { event: ROOM_CHANNEL_EVENT }, (message) => {
          const payload = message.payload as Partial<RoomRevisionSignal>;
          if (typeof payload.revision !== 'number') return;
          const now = Date.now();
          if (payload.revision === lastSignalRevision && now - lastSignalAt < 1000) return;
          lastSignalRevision = payload.revision;
          lastSignalAt = now;
          onRevision({ roomId, revision: payload.revision });
        })
        .subscribe((status, err) => {
          if (stopped) return;
          // Gizli değer içermez; alan hata ayıklaması için bilgilendirici log.
          if (status !== 'SUBSCRIBED') {
            console.info(`[realtime] room:${roomId} → ${status}`, err?.message ?? '');
          }
          if (status === 'SUBSCRIBED') {
            setConn('connected');
            // (Yeniden) abonelik sonrası kaçmış sürümleri topla.
            onRevision({ roomId, revision: -1 });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConn('reconnecting');
          } else if (status === 'CLOSED') {
            // Supabase kendi içinde yeniden dener; biz de yedek yoklamayla toparlarız.
            setConn('reconnecting');
          }
        });
    };

    void subscribe();
    disposers.push(() => {
      if (channel) void client.removeChannel(channel);
    });
  } else {
    // Realtime yok (yerel `dev:` kipi): yalnız yedek yoklama; durumu bilinmez sayma.
    setConn('connected');
  }

  // Yedek: kaçan sinyal için tetikleme. Kendini yeniden kuran timeout — `poke()`
  // sayacı sıfırlar, böylece başka yoldan gelen tazeleme kotayı boşa harcamaz.
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = (): void => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (stopped) return;
      // D21/I — lobide (ya da çağıranın istemediği durumda) istek atlanır.
      if (backupEnabled?.() !== false) onRevision({ roomId, revision: -1 });
      arm();
    }, backupIntervalMs);
  };
  arm();
  disposers.push(() => {
    if (timer) clearTimeout(timer);
    timer = null;
  });

  // Sekme tekrar öne gelince hemen kontrol.
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') {
      onRevision({ roomId, revision: -1 });
      void reauth();
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  disposers.push(() => document.removeEventListener('visibilitychange', onVisible));

  // Ağ çevrimiçi/çevrimdışı.
  // `online`: iyimser `connected` — bir sonraki HTTP/heartbeat hâlâ bozuksa
  // `noteHttp` durumu tekrar düşürür. Kanal kendi `SUBSCRIBED`/hata callback'iyle
  // gerçek durumu bildirir.
  const onOnline = (): void => {
    setConn('connected');
    onRevision({ roomId, revision: -1 });
    void reauth();
  };
  const onOffline = (): void => setConn('disconnected');
  globalThis.addEventListener?.('online', onOnline);
  globalThis.addEventListener?.('offline', onOffline);
  disposers.push(() => globalThis.removeEventListener?.('online', onOnline));
  disposers.push(() => globalThis.removeEventListener?.('offline', onOffline));

  return {
    stop: () => {
      stopped = true;
      for (const dispose of disposers) dispose();
    },
    reauth,
    poke: arm,
  };
}
