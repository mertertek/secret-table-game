/**
 * D2 oda kabuğunun SAF geometri matematiği (`docs/design/D2-room.md` §2).
 *
 * Burada three sınıfı yok: yalnız sayı üreten fonksiyonlar, böylece bütçe ve
 * sis testleri DOM/WebGL olmadan çalışır. Üçgen üretimi `roomMeshes.ts`te.
 *
 * Sahne birimi metre; masa yüzeyi y=0, zemin y=−0,81. `h` = zeminden yükseklik.
 */

export const ROOM = {
  /** Zemin düzlemi (dünya y). */
  floorY: -.81,
  /** Sekizgen yarı ölçüleri ve köşe pahı. */
  halfX: 4.6, halfZ: 4.0, chamfer: 1.5,
  /** Yükseklikler (zeminden). */
  wainscotH: 1.35, railH: 1.35, ceilingH: 3.3,
  baseboardH: .12, corniceH: .12,
  /** Kahraman bant: koltuk kamerasının yatay bakışında dolu kalması gereken şerit. */
  heroBand: [1.6, 2.6] as const,
  /** Avize halkası (zeminden) ve yarıçapı. */
  chandelierH: 2.76, chandelierR: .65,
} as const;

/** Dünya y'si: zeminden yükseklik → sahne koordinatı. */
export const atHeight = (h: number) => ROOM.floorY + h;

export type Point2 = readonly [number, number];

/**
 * Uzatılmış sekizgenin köşeleri (x, z), saat yönünde; `inset` duvarı içeri çeker
 * (lambri gövdesi duvar kâğıdının 2 cm önünde durur). Sıra inward normal üretir:
 * A→B kenarının iç normali `(-dz, dx)`.
 */
export function octagonOutline(inset = 0): Point2[] {
  const hx = ROOM.halfX - inset, hz = ROOM.halfZ - inset;
  // Pah, kenar kısalması insetten bağımsız kalsın diye sabit tutulur.
  const c = Math.min(ROOM.chamfer, hx, hz);
  return [
    [-hx + c, -hz], [hx - c, -hz], [hx, -hz + c], [hx, hz - c],
    [hx - c, hz], [-hx + c, hz], [-hx, hz - c], [-hx, -hz + c],
  ];
}

export type WallSegment = {
  /** Kenarın başlangıç/bitiş köşeleri. */
  a: Point2; b: Point2;
  /** Kenar ortası, uzunluğu ve iç normali (birim). */
  center: Point2; length: number; normal: Point2;
  /** Kenarın +x'e göre açısı; `rotation-y` olarak `-angle` kullanılır. */
  angle: number;
};

/** Sekizgenin 8 kenarı; duvar şeritleri ve duvara asılan öğeler bunu kullanır. */
export function wallSegments(inset = 0): WallSegment[] {
  const points = octagonOutline(inset);
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length]!;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    return {
      a, b,
      center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      length,
      normal: [-dz / length, dx / length],
      angle: Math.atan2(dz, dx),
    };
  });
}

/** Sekizgenin çevresi (duvar kâğıdı U tekrarı bunun üstünden hesaplanır). */
export const roomPerimeter = (inset = 0) =>
  wallSegments(inset).reduce((sum, wall) => sum + wall.length, 0);

/** Zemin alanı (kayık kenarlı sekizgen; ayakkabı bağı formülü). */
export function roomFloorArea(inset = 0): number {
  const points = octagonOutline(inset);
  let twice = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    twice += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(twice) / 2;
}

/**
 * Sis (`docs/design/D2-room.md` §4). Koltukta sabit 6/18; genel bakış ve tahta
 * incelemesinde kamera odanın DIŞINDA olabildiği için uzaklığa oranlanır —
 * sabit değer telefon dikey kadrajında (d ≈ 16) arka duvarı yutuyordu.
 */
export function fogFor(mode: 'seat' | 'overview', cameraDistance = 0): { near: number; far: number } {
  if (mode === 'seat') return { near: 6, far: 18 };
  const d = Math.max(7.8, cameraDistance);
  return { near: d * .9, far: d * 2.4 };
}

/** `layout/cameraFraming.ts` genel bakış uzaklığı; sis için yeniden türetilir. */
export function overviewDistance(width: number, height: number): number {
  const aspect = width / Math.max(height, 1);
  const tangent = Math.tan(40 * Math.PI / 360);
  return Math.max(7.8, 3.3 / (tangent * aspect));
}

export type RoomQuality = 'low' | 'standard';
export type RoomBudget = { draws: number; triangles: number; pointLights: number; textureBytes: number };

/**
 * Oda katmanının ÇİZİM/ÜÇGEN tahmini. Gerçek `gl.info.render` sayımı sahne
 * geneline aittir (masa, karakterler, HUD); bu fonksiyon yalnız oda bütçesini
 * korur ve testte üst sınırlara karşı doğrulanır.
 *
 * Kaynak: `roomMeshes.ts` içindeki birleştirilmiş geometriler, her biri tek çizim.
 */
export function roomBudget(quality: RoomQuality): RoomBudget {
  // ÖLÇÜLDÜ (2026-09-12, `roomMeshes.ts` geometrileri): kabuk = zemin 2 + halı 96 +
  // duvar kâğıdı 16 + lambri 16 + tavan 6 + trim 2 144/512 + pirinç 1 872/944 +
  // ışıltı 972/640 + avize abajurları 224/112.
  if (quality === 'low') return { draws: 9, triangles: 2_400, pointLights: 1, textureBytes: 7_321_682 };
  return {
    // Kabuk 8 + avize abajuru 1 + mobilya 6 (ahşap, kitaplar, cam, perde, abajur,
    // cam takımı) + süs 3 (harita, afiş atlası, yeşillik) = 18 çizim.
    draws: 18,
    // 12 836 ölçüldü; pay bırakıldı.
    triangles: 13_000,
    pointLights: 3,
    textureBytes: 11_549_082,
  };
}

/**
 * Eski `objects/RoomDecor.tsx` çizim sayısı (zemin, halı, arka pano, 9 dikme, ray,
 * 2 lamba × 3 parça). Bütçe farkı buna göre ölçülür; yeni oda daha AZ çizim yapar.
 */
export const LEGACY_ROOM_DRAWS = 19;

/** Sözleşmeli üst sınırlar (D2 görev tanımı + tasarım §7). */
export const ROOM_LIMITS = {
  extraDraws: 30, triangles: 60_000, textureBytes: 12 * 1024 * 1024, pointLights: 3,
} as const;
