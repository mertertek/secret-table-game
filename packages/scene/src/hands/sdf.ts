/**
 * D1 §b — elin işaretli uzaklık alanı (23 ilkel, polinom smooth-min birleşimi).
 * Alan BIND pozunda (bütün eklem açıları 0) hesaplanır: parmaklar −Z boyunca düz,
 * baş parmak taban çerçevesi yönünde. Rest açıları kemiklere uygulanır (skeleton.ts).
 *
 * Hız notu: değerlendirme kutu-ızgarada milyonlarca kez çağrılır. Bu yüzden hiçbir
 * fonksiyon nesne/dizi ayırmaz, tüm koordinatlar skaler geçer ve her ilkel grubu
 * kendi AABB'sine olan alt sınırla atlanabilir (`smin(a,b,k) === a` when `b > a + k`).
 */
import { FINGER, FINGERS, HYPOTHENAR, K, PALM, THENAR, THUMB, THUMB_WEB, WEB, WRIST } from './anatomy';
import type { V3 } from './anatomy';

/**
 * Genel ilkeller `../sdf/primitives` içinde paylaşılır (D3 karakterleri aynı
 * fonksiyonları kullanır); D1 API'si bozulmasın diye buradan yeniden dışa
 * aktarılır.
 */
export { sdEllipsoid, sdRoundBox, sdRoundCone, smax, smin } from '../sdf/primitives';
import { boxLower, sdEllipsoid, sdRoundBox, sdRoundCone, smax, smin } from '../sdf/primitives';

const add = (p: V3, d: V3, t: number): V3 => [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t];

/** Baş parmak taban çerçevesinin yerel −Z ekseni (bind yönü). */
export function thumbAxis(): V3 {
  const [ex, ey] = THUMB.euler;
  return [-Math.sin(ey), Math.sin(ex) * Math.cos(ey), -Math.cos(ex) * Math.cos(ey)];
}

/** BIND pozundaki eklem noktaları: her parmak için [MCP, PIP, DIP, uç]. */
export type BindJoints = { readonly [name: string]: readonly V3[] };
export function bindJoints(): BindJoints {
  const out: Record<string, readonly V3[]> = {};
  for (const name of FINGERS) {
    const f = FINGER[name]; const p0 = f.mcp;
    const p1 = add(p0, [0, 0, -1], f.lengths[0]);
    const p2 = add(p1, [0, 0, -1], f.lengths[1]);
    out[name] = [p0, p1, p2, add(p2, [0, 0, -1], f.lengths[2])];
  }
  const d = thumbAxis(); const t0 = THUMB.cmc;
  const t1 = add(t0, d, THUMB.lengths[0]), t2 = add(t1, d, THUMB.lengths[1]);
  out.thumb = [t0, t1, t2, add(t2, d, THUMB.lengths[2])];
  return out;
}

/**
 * D1 tur 6 — PARMAK ARASI YARIK. Kapsüller arası boşluk bind pozunda ~4 mm
 * olsa da parmak↔avuç `smin`i kök çevresinde şişip boşluğu kapatıyor, marching
 * cubes orada iki parmağı TEK yüzeyde birleştiriyordu; poz verilince bu köprü
 * ince bir levha gibi geriliyordu ("yapışık yerler").
 *
 * Çözüm: komşu parmak eksenlerinin TAM ORTASINDAN geçen ince dilimler alandan
 * ÇIKARILIR (`smax(d, −slab, k)`). Yarı kalınlık 3 mm: kökte parmak yüzeyine
 * 1 mm girer (hafif düzleşme), köprü bırakmaz (1,8 mm denendi, kesilen köprüden
 * parmağın iç duvarında düz bir "yelken" kalıyordu). İki dilim var: serbest
 * falanks bölgesi (z ≤ −0,100) her yönden, boğum arası oluk (−0,100…−0,076)
 * yalnız EL SIRTI tarafında — avuç içindeki perde korunur.
 */
export const SPLIT = {
  halfX: .0030,
  k: .0022,
  /** Serbest falankslar: her yönden ayrık (avuç içi + sırt). */
  distal: { cy: 0, hy: .050, z0: -.100, z1: -.300 },
  /**
   * Boğum arası oluk: YALNIZ EL SIRTI tarafı (y ≥ −2 mm). Avuç içindeki perde
   * gerçek elde vardır ve burada korunur; kesilirse avuçta yarık açılırdı.
   */
  root: { cy: .024, hy: .026, z0: -.076, z1: -.100 },
} as const;
const SPLIT_X: readonly number[] = [0, 1, 2].map((i) =>
  (FINGER[FINGERS[i]!].mcp[0] + FINGER[FINGERS[i + 1]!].mcp[0]) / 2);
const SPLIT_BOXES = [SPLIT.distal, SPLIT.root].map((b) => ({
  cy: b.cy, hy: b.hy, cz: (b.z0 + b.z1) / 2, hz: Math.abs(b.z0 - b.z1) / 2,
}));
/** Yarıkların hiçbiri bu x uzaklığının ötesinde alanı değiştiremez. */
const SPLIT_REACH = SPLIT.halfX + SPLIT.k + .001;
/** Yarık bölgesinin en proksimal sınırı (bunun berisinde hiç iş yapılmaz). */
const SPLIT_Z_NEAR = SPLIT.root.z0 + SPLIT.k;

/** Bir kapsül zinciri (parmak) — SDF ve iskelet ağırlığı aynı veriden okur. */
export type Segment = { a: V3; b: V3; ra: number; rb: number };
export function fingerSegments(): Record<string, readonly Segment[]> {
  const j = bindJoints(); const out: Record<string, readonly Segment[]> = {};
  for (const name of FINGERS) {
    const r = FINGER[name].radii; const p = j[name]!;
    out[name] = [0, 1, 2].map((i) => ({ a: p[i]!, b: p[i + 1]!, ra: r[i]!, rb: r[i + 1]! }));
  }
  const r = THUMB.radii; const p = j.thumb!;
  out.thumb = [0, 1, 2].map((i) => ({ a: p[i]!, b: p[i + 1]!, ra: r[i]!, rb: r[i + 1]! }));
  return out;
}

function segmentBox(segments: readonly Segment[], pad: number): Float64Array {
  const b = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  const grow = (p: V3, r: number) => { for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i]!, p[i]! - r - pad); b[i + 3] = Math.max(b[i + 3]!, p[i]! + r + pad); } };
  for (const s of segments) { grow(s.a, s.ra); grow(s.b, s.rb); }
  return b;
}

const SEGMENTS = fingerSegments();
const FINGER_BOX: Record<string, Float64Array> = Object.fromEntries(
  Object.entries(SEGMENTS).map(([name, s]) => [name, segmentBox(s, name === 'thumb' ? K.thumbToThenar : K.fingerToPalm)]),
);
const RAW_BOX: Record<string, Float64Array> = Object.fromEntries(
  Object.entries(SEGMENTS).map(([name, s]) => [name, segmentBox(s, 0)]),
);
/**
 * D1 tur 5 — perde kapsülleri artık BOĞUM ÇİZGİSİNİN ALTINDA kalan minik
 * dolgulardır (y −0,008, r 3,5 mm → tepe noktası y −0,0045, MCP hizasının
 * 4,5 mm altında): avuç içinde parmak köklerini birbirine bağlayan dokuyu
 * verir, siluette ve el sırtında görünmez.
 */
const WEBS: readonly Segment[] = [0, 1, 2].map((i) => ({
  a: [FINGER[FINGERS[i]!].mcp[0], WEB.y, WEB.z] as V3,
  b: [FINGER[FINGERS[i + 1]!].mcp[0], WEB.y, WEB.z] as V3,
  ra: WEB.radius, rb: WEB.radius,
}));
const PALM_RAW = (() => {
  const b = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  const grow = (c: V3, r: V3) => { for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i]!, c[i]! - r[i]!); b[i + 3] = Math.max(b[i + 3]!, c[i]! + r[i]!); } };
  grow(PALM.center, PALM.half); grow(THENAR.center, THENAR.radii); grow(HYPOTHENAR.center, HYPOTHENAR.radii);
  grow([0, 0, -.005], [WRIST.ra, WRIST.ra * WRIST.squashY, .040]);
  for (const w of [...WEBS, { a: THUMB_WEB.a, b: THUMB_WEB.b, ra: THUMB_WEB.radius, rb: THUMB_WEB.radius }]) {
    grow(w.a, [w.ra, w.ra, w.ra]); grow(w.b, [w.rb, w.rb, w.rb]);
  }
  return b;
})();
const PALM_BOX = PALM_RAW.map((v, i) => i < 3 ? v - K.wrist : v + K.wrist) as Float64Array;

/** Avuç kümesi (kutu + thenar + hypothenar + bilek + perdeler) — iskelet `wrist` bölgesi. */
export function palmField(px: number, py: number, pz: number): number {
  let d = sdRoundBox(px, py, pz, PALM.center[0], PALM.center[1], PALM.center[2], PALM.half[0], PALM.half[1], PALM.half[2], PALM.radius);
  d = smin(d, sdEllipsoid(px, py, pz, THENAR.center[0], THENAR.center[1], THENAR.center[2], THENAR.radii[0], THENAR.radii[1], THENAR.radii[2]), K.thenar);
  d = smin(d, sdEllipsoid(px, py, pz, HYPOTHENAR.center[0], HYPOTHENAR.center[1], HYPOTHENAR.center[2], HYPOTHENAR.radii[0], HYPOTHENAR.radii[1], HYPOTHENAR.radii[2]), K.hypothenar);
  // Bilek kapsülü y'de 0.6 ezilmiştir; ölçekli uzayda değerlendirip geri ölçeklemek
  // Lipschitz açısından güvenli bir alt sınırdır.
  d = smin(d, sdRoundCone(px, py / WRIST.squashY, pz, WRIST.a[0], WRIST.a[1], WRIST.a[2], WRIST.b[0], WRIST.b[1], WRIST.b[2], WRIST.ra, WRIST.rb) * WRIST.squashY, K.wrist);
  for (const w of WEBS) d = smin(d, sdRoundCone(px, py, pz, w.a[0], w.a[1], w.a[2], w.b[0], w.b[1], w.b[2], w.ra, w.rb), K.web);
  d = smin(d, sdRoundCone(px, py, pz, THUMB_WEB.a[0], THUMB_WEB.a[1], THUMB_WEB.a[2], THUMB_WEB.b[0], THUMB_WEB.b[1], THUMB_WEB.b[2], THUMB_WEB.radius, THUMB_WEB.radius), K.thumbWeb);
  return d;
}

/** Bir parmağın (ya da baş parmağın) 3 kapsülünün yumuşak birleşimi. */
export function chainField(px: number, py: number, pz: number, name: string): number {
  const s = SEGMENTS[name]!; const k = name === 'thumb' ? K.thumb : K.phalanx;
  let d = sdRoundCone(px, py, pz, s[0]!.a[0], s[0]!.a[1], s[0]!.a[2], s[0]!.b[0], s[0]!.b[1], s[0]!.b[2], s[0]!.ra, s[0]!.rb);
  for (let i = 1; i < 3; i++) {
    const c = s[i]!;
    d = smin(d, sdRoundCone(px, py, pz, c.a[0], c.a[1], c.a[2], c.b[0], c.b[1], c.b[2], c.ra, c.rb), k);
  }
  return d;
}

const GROUPS = ['thumb', ...FINGERS] as const;

/** 23 ilkelin tamamı — elin yüzeyi `handField(p) === 0`.
 * Uzaktaki noktalar yalnız 6 kutu testiyle (geçerli, pozitif bir alt sınır) döner. */
export function handField(px: number, py: number, pz: number): number {
  let d = boxLower(px, py, pz, PALM_BOX);
  let near = d <= .02;
  for (const name of GROUPS) if (boxLower(px, py, pz, FINGER_BOX[name]!) <= .02) { near = true; break; }
  if (!near) {
    for (const name of GROUPS) d = Math.min(d, boxLower(px, py, pz, FINGER_BOX[name]!));
    return d;
  }
  d = palmField(px, py, pz);
  // D1 tur 5 — KOMŞU PARMAKLAR BİRBİRİNE KAYNAMAZ: dört parmak önce SERT `min`
  // ile birleşir (aralarında yumuşatma yok → perde yok), birleşim avuca tek bir
  // `smin` ile bağlanır. Eskiden zincirler sırayla akümülatöre smin'leniyor ve
  // her parmak bir öncekiyle 12 mm yumuşak köprü kuruyordu ("balık adam eli").
  let fingers = Infinity;
  for (const name of FINGERS) {
    const lower = boxLower(px, py, pz, FINGER_BOX[name]!);
    // Uzaktaki parmak ne `min`i ne de avuçla `smin`i değiştirir.
    if (lower >= fingers || lower > d + K.fingerToPalm) continue;
    fingers = Math.min(fingers, chainField(px, py, pz, name));
  }
  if (fingers < Infinity) d = smin(d, fingers, K.fingerToPalm);
  // Baş parmak thenar'a kendi (daha geniş) yumuşatmasıyla bağlanır.
  if (boxLower(px, py, pz, FINGER_BOX.thumb!) <= d + K.thumbToThenar) {
    d = smin(d, chainField(px, py, pz, 'thumb'), K.thumbToThenar);
  }
  // Parmak arası yarık: yalnız orta düzlemin ±3 mm'sinde ve boğum çizgisinin
  // ötesinde iş yapar (dışarıda `smax` sonucu zaten `d`dir).
  if (pz < SPLIT_Z_NEAR) {
    for (let i = 0; i < SPLIT_X.length; i++) {
      const x0 = SPLIT_X[i]!;
      if (Math.abs(px - x0) > SPLIT_REACH) continue;
      for (const b of SPLIT_BOXES) {
        const slab = sdRoundBox(px, py, pz, x0, b.cy, b.cz, SPLIT.halfX, b.hy, b.hz, 0);
        d = smax(d, -slab, SPLIT.k);
      }
    }
  }
  return d;
}

/** Üretim kutusu: ilkellerin ham AABB birleşimi + pay. Şartname kutusu (§b) rest
 * pozuna göre yazılmış; BIND pozunda düz baş parmak onu 5–6 mm aşıyor. */
export function handBounds(pad = .006): { min: V3; max: V3 } {
  const b = new Float64Array(PALM_RAW);
  for (const name of GROUPS) {
    const f = RAW_BOX[name]!;
    for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i]!, f[i]!); b[i + 3] = Math.max(b[i + 3]!, f[i + 3]!); }
  }
  return { min: [b[0]! - pad, b[1]! - pad, b[2]! - pad], max: [b[3]! + pad, b[4]! + pad, b[5]! + pad] };
}
