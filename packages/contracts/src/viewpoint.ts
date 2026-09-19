/**
 * Geçici baş yönü paylaşımı (FINISH_PLAN §4). Oyuncular koltuklarından bakışırken
 * uzak avatarların başı yumuşak dönsün diye kullanılır.
 *
 * Kural:
 * - DB'de saklanmaz, `revision` / komut defterini değiştirmez, her karede Function
 *   çağrısı yoktur.
 * - Ayrı özel Realtime kanalı `room:<roomId>:viewpoint:<gameId>:<playerId>` üzerinden taşınır; oda
 *   üyeliğiyle yetkilendirilir. Alıcı `playerId`yi yetkili `SceneView.players`
 *   listesiyle doğrular ve kendi `localPlayerId`sini yok sayar (docs/CONTRACT.md §4).
 * - Özel seçim/inceleme kamerası bu mesaja GİRMEZ; yalnız koltuk bakışı (yaw/pitch).
 * - Kamera koltuktan ayrılmaz; konum paylaşılmaz, yalnız yön.
 *
 * Sürüm 0.2.0 (sabit). Bu dosya additive: yeni tip + sabitler, mevcut alan
 * değişmedi. D16: `HeadViewpoint.emote` isteğe bağlı alanı eklendi (additive).
 */

import type { PlayerId, RoomId } from './ids';

// ---------------------------------------------------------------------------
// Sınırlar (radyan)
// ---------------------------------------------------------------------------

/** Yatay bakış sınırı (~±80°). Kamera bu aralığın dışına çıkmaz. */
export const VIEWPOINT_YAW_LIMIT = 1.4;
/** Dikey bakış sınırı (~±34°). */
export const VIEWPOINT_PITCH_LIMIT = 0.6;

// ---------------------------------------------------------------------------
// Gönderim politikası (FINISH_PLAN §4: eşik + hız sınırı, boşta dururken sus)
// ---------------------------------------------------------------------------

/** Bu radyan değişimin altındaki hareket gönderilmez. */
export const VIEWPOINT_MIN_DELTA = 0.015;
/** İki gönderim arası en az süre (ms); ~8 Hz yerel görünüm yenileme üst sınırı; ağ gönderimi oyuncu sayısına göre daha düşüktür. */
export const VIEWPOINT_SEND_INTERVAL_MS = 120;
/** Bu süre boyunca eşik üstü değişim yoksa gönderim durur (idle). */
export const VIEWPOINT_IDLE_STOP_MS = 1500;
/** Alıcı: bundan daha eski örnek "bayat" sayılır ve nötr poza dönülür. */
export const VIEWPOINT_STALE_MS = 4000;

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

/**
 * Sahnenin ürettiği, uygulamanın ağa verdiği yerel kamera yönü.
 * `yaw` ∈ [−VIEWPOINT_YAW_LIMIT, +], `pitch` ∈ [−VIEWPOINT_PITCH_LIMIT, +].
 */
export type LocalViewpoint = {
  yaw: number;
  pitch: number;
};

/**
 * Sahneye verilen doğrulanmış baş yönü. Kimlik yetkili topic ve roster kaynaklıdır.
 * Alıcı `playerId`yi yetkili görünümle doğrular; `seatIndex` yalnız çapraz
 * kontrol içindir, tek başına güvenilmez.
 */
export type HeadViewpoint = LocalViewpoint & {
  roomId: RoomId;
  /** Gönderen koltuğun oyuncu kimliği. */
  playerId: PlayerId;
  /** Gönderenin ilan ettiği koltuk sırası (çapraz kontrol). */
  seatIndex: number;
  /** Alıcı istemcinin yerel alım saati (epoch ms); sahne bayatlığı içindir. Ağ sırası ayrı epoch/seq ile doğrulanır. */
  t: number;
  /**
   * D16 — isteğe bağlı el jesti. Bilinmeyen `kind` doğrulamada DÜŞER, paket
   * kabul edilir. Alan yoksa jest yoktur; sahne jesti kendi saatinde latch'ler.
   */
  emote?: EmoteSignal;
};

/** Verilen yön bileşenini kendi sınırına kırpar. */
export function clampViewpoint(input: LocalViewpoint): LocalViewpoint {
  const clamp = (v: number, limit: number): number =>
    Number.isFinite(v) ? Math.max(-limit, Math.min(limit, v)) : 0;
  return {
    yaw: clamp(input.yaw, VIEWPOINT_YAW_LIMIT),
    pitch: clamp(input.pitch, VIEWPOINT_PITCH_LIMIT),
  };
}

/** İki yön arasında eşik üstü fark var mı (gönderim kararı). */
export function viewpointChanged(a: LocalViewpoint, b: LocalViewpoint): boolean {
  return (
    Math.abs(a.yaw - b.yaw) >= VIEWPOINT_MIN_DELTA ||
    Math.abs(a.pitch - b.pitch) >= VIEWPOINT_MIN_DELTA
  );
}

// ---------------------------------------------------------------------------
// D16 — el jestleri (emote). ADDITIVE: bakış paketine isteğe bağlı alan.
// Sunucu ve DB görmez; oyun kuralına dokunmaz (docs/design/D16-emotes.md §4).
// ---------------------------------------------------------------------------

/** Tasarım §2 sırası; jest paleti ve `1–8` kısayolu bu sırayı kullanır. */
export const EMOTE_KINDS = [
  'point',
  'hands_up',
  'thumbs_up',
  'thumbs_down',
  'middle',
  'wave',
  'clap',
  'facepalm',
] as const;
export type EmoteKind = (typeof EMOTE_KINDS)[number];

/** Jest süreleri (ms) — tasarım §2 tablosu. */
export const EMOTE_DURATION_MS: Readonly<Record<EmoteKind, number>> = {
  point: 3000,
  hands_up: 3000,
  thumbs_up: 2500,
  thumbs_down: 2500,
  middle: 2500,
  wave: 2000,
  clap: 2500,
  facepalm: 2500,
};

/** En uzun jest; alıcı tarafında latch penceresi bunun üstünde tutulur. */
export const EMOTE_MAX_DURATION_MS = 3000;

/** Yerel hız sınırı: 1 jest / 1,2 s (tasarım §3). */
export const EMOTE_COOLDOWN_MS = 1200;

/** Kayıp telafisi: jest paketinin aynı `seq` ile tekrar gönderim gecikmeleri (ms). */
export const EMOTE_REPEAT_MS: readonly number[] = [250, 600];

/**
 * Bakış paketine eklenen jest sinyali. `at` GÖNDERENİN epoch ms'idir ve yalnız
 * sıralama içindir; alıcı kendi saatine göre `receivedAt` kullanır. Aynı
 * gönderenin aynı `seq`i bir kez oynatılır.
 */
export type EmoteSignal = {
  kind: EmoteKind;
  /** Gönderen başına artan tam sayı (≥ 1). */
  seq: number;
  /** Gönderenin epoch ms damgası; yalnız sıralama/teşhis. */
  at: number;
};

/**
 * Etiket sembolü ve Türkçe ad. Metin olmasına rağmen SÖZLEŞMEDE durur: hem
 * sahne (isim etiketi) hem HUD (jest çarkı) aynı tabloyu okur ve HUD sahne
 * paketini (three) içe aktarmak zorunda kalmaz.
 */
export const EMOTE_SYMBOL: Readonly<Record<EmoteKind, string>> = {
  point: '☝',
  hands_up: '🙌',
  thumbs_up: '👍',
  thumbs_down: '👎',
  middle: '🖕',
  wave: '👋',
  clap: '👏',
  facepalm: '🤦',
};

export const EMOTE_LABEL: Readonly<Record<EmoteKind, string>> = {
  point: 'İşaret',
  hands_up: 'Teslim',
  thumbs_up: 'Onay',
  thumbs_down: 'Ret',
  middle: 'Orta parmak',
  wave: 'Selam',
  clap: 'Alkış',
  facepalm: 'Yüz avuçlama',
};

const EMOTE_SET: ReadonlySet<string> = new Set(EMOTE_KINDS);

/** Bilinmeyen jest adı alanı düşürür (paket yine kabul edilir). */
export function isEmoteKind(value: unknown): value is EmoteKind {
  return typeof value === 'string' && EMOTE_SET.has(value);
}

/** Jest süresi dolmuş mu (alıcı saatiyle ölçülen geçen süre). */
export function emoteExpired(kind: EmoteKind, since: number): boolean {
  return !(since >= 0) || since >= EMOTE_DURATION_MS[kind];
}
