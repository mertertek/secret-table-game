/**
 * D3 §b/§d — karakterin işaretli uzaklık alanı: 23 taban ilkeli + aksesuar
 * grupları (kesme düzlemi ve çıkarma ile), polinom smooth-min birleşimi.
 *
 * Alan BIND pozunda (bütün kemik açıları 0) hesaplanır. Sayılar
 * `docs/design/d3/characters.json` içinden gelir; burada yalnız §e gövde oran
 * ölçekleri (`bodyScale`) ve kademe süzgeci uygulanır.
 *
 * Hız notu (`hands/sdf.ts` ile aynı düzen): hiçbir değerlendirme nesne ayırmaz
 * ve her ilkel/grup kendi AABB'sine olan alt sınırla atlanır —
 * `smin(a, b, k) === a` when `b > a + k`.
 */
import { boxLower, boxLower2, inverseEulerXYZ, sdEllipsoid, sdRoundBox, sdRoundCone, sdSphere, sdTorus, smax, smin } from '../sdf/primitives';
import { ACCESSORY_LIFT, SPEC, characterSpec } from './spec';
import type { AccessorySpec, CharacterSpec, PrimSpec, Region, Tier, V3 } from './spec';

/** 0 küre · 1 elipsoid · 2 kapsül · 3 yuvarlatılmış kutu · 4 torus. */
export type PrimKind = 0 | 1 | 2 | 3 | 4;

export type Prim = {
  readonly id: string;
  readonly kind: PrimKind;
  readonly cx: number; readonly cy: number; readonly cz: number;
  readonly rx: number; readonly ry: number; readonly rz: number;
  readonly ax: number; readonly ay: number; readonly az: number;
  readonly bx: number; readonly by: number; readonly bz: number;
  readonly r0: number; readonly r1: number;
  readonly corner: number;
  readonly axis: 0 | 1 | 2;
  readonly rot: Float64Array | null;
  /** Ham Euler XYZ (tel aksesuarları gerçek geometriyle üretmek için). */
  readonly rotEuler: readonly [number, number, number] | null;
  readonly k: number;
  readonly region: Region;
  /** Aksesuar ilkellerinde doğrudan renk; taban ilkellerinde null (§e kuralları uygular). */
  readonly color: string | null;
  /** Aksesuar kimliği (taban ilkellerinde null) — skin/renk kuralları için. */
  readonly accessory: string | null;
  readonly aabb: Float64Array;
};

export type AccessoryGroup = {
  readonly id: string;
  readonly prims: readonly Prim[];
  /** Gövdeye birleşim k'sı = grubun ilk ilkelinin k'sı (§d). */
  readonly joinK: number;
  /**
   * Normalize edilmiş kesme düzlemi: `dot(p − point, n) ≥ 0` kalır. YALNIZ
   * grubun ilk ilkeline (saç kapağı / şapka kubbesi) uygulanır — §d'de kesme
   * kubbeyi biçimlendirir; favori, siperlik, ponpon ve bant etkilenmez.
   */
  readonly clip: { px: number; py: number; pz: number; nx: number; ny: number; nz: number; k: number } | null;
  readonly subtract: Prim | null;
  readonly subtractK: number;
  readonly aabb: Float64Array;
};

export type CharacterField = {
  readonly character: CharacterSpec;
  readonly tier: Tier;
  readonly base: readonly Prim[];
  readonly groups: readonly AccessoryGroup[];
  /**
   * SDF'e GİRMEYEN ince tel aksesuarları (§d riski: 8 mm boru 9 mm voxelde
   * kopuyor/lekeleniyor). Bunlar gerçek torus/silindir geometrisi olarak aynı
   * `BufferGeometry`'ye eklenir — ek çizim yok, ağırlık head 1,0.
   */
  readonly wires: readonly Prim[];
  /** Bütün ilkeller (renk/skin için sırayla taranır). */
  readonly all: readonly Prim[];
  /**
   * Renk bölgelerine katılan ilkeller (taban + aksesuar grupları, TELLER
   * HARİÇ) — düz sırada. Tur 4 sınır alanı bu sıraya göre indekslenir.
   */
  readonly colorPrims: readonly Prim[];
  /**
   * `colorPrims` için 0/1 geçerlilik maskesi: kesme düzlemiyle kesilmiş ya da
   * çıkarılmış ilkeller o noktada renk sahibi olamaz (`nearest2` ile aynı kural).
   */
  readonly colorEligible: (x: number, y: number, z: number, out: Uint8Array) => Uint8Array;
  readonly bounds: { min: V3; max: V3 };
  readonly field: (x: number, y: number, z: number) => number;
  /** Köşenin en yakın (kesilmemiş) ilkeli — §e renk ve §c skin kuralları buradan okur. */
  readonly nearest: (x: number, y: number, z: number) => Prim;
  /**
   * En yakın İKİ ilkel ve uzaklıkları. İki ilkel birbirine yakınsa (bir hücre
   * kadar) renkleri karıştırılır: aksi hâlde bölge sınırları köşe ızgarası
   * boyunca "yırtık kâğıt" gibi zikzak yapar.
   */
  readonly nearest2: (x: number, y: number, z: number, out: Nearest2) => Nearest2;
};

export type Nearest2 = { a: Prim; da: number; b: Prim | null; db: number };

const num = (v: readonly number[] | undefined, i: number, fallback = 0): number => v?.[i] ?? fallback;

/** |R|·h ile döndürülmüş kutunun eksen hizalı yarı boyutu (kutu için kesin, elipsoid için üst sınır). */
function rotatedHalf(ex: number, ey: number, ez: number, hx: number, hy: number, hz: number): [number, number, number] {
  const cx = Math.cos(ex), sx = Math.sin(ex), cy = Math.cos(ey), sy = Math.sin(ey), cz = Math.cos(ez), sz = Math.sin(ez);
  const ae = cx * cz, af = cx * sz, be = sx * cz, bf = sx * sz;
  const m = [cy * cz, -cy * sz, sy, af + be * sy, ae - bf * sy, -sx * cy, bf - ae * sy, be + af * sy, cx * cy];
  return [
    Math.abs(m[0]!) * hx + Math.abs(m[1]!) * hy + Math.abs(m[2]!) * hz,
    Math.abs(m[3]!) * hx + Math.abs(m[4]!) * hy + Math.abs(m[5]!) * hz,
    Math.abs(m[6]!) * hx + Math.abs(m[7]!) * hy + Math.abs(m[8]!) * hz,
  ];
}

const AXIS: Record<string, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/**
 * §d "Alternatif: ince telleri TorusGeometry/TubeGeometry olarak aynı
 * BufferGeometry'ye eklemek". Gözlük halkası 8 mm, zincir 7 mm; 9 mm voxelde
 * marching cubes bunları lekeye çeviriyordu.
 */
const WIRE_ACCESSORIES = new Set(['glasses', 'glasses-chain']);

/**
 * Tur 3 — sakal/bıyık gövdeye BU k ile katılır (§d'deki 30 mm yerine). Dolgun
 * sakalın `beardChin` k'sı 30 mm; yanağa/boyna o kadar yumuşak bağlanınca
 * sakal ayrı bir hacim olarak okunmuyor, yüze eriyordu. Grubun KENDİ İÇİNDEKİ
 * k'lar değişmez (sakal tek kütle kalır), yalnız gövdeye birleşim sıkılır.
 */
const FACIAL_JOIN_K = .018;

/** Aksesuar yükseltmesi (`ACCESSORY_LIFT`): bütün y koordinatları birlikte kayar. */
function raiseY(spec: PrimSpec, lift: number): PrimSpec {
  if (!lift) return spec;
  const shift = (v: readonly number[] | undefined) => v ? [v[0]!, v[1]! + lift, v[2]!] : undefined;
  return { ...spec, c: shift(spec.c), a: shift(spec.a), b: shift(spec.b) };
}

/** §e `bodyScale`: göbek (x,z) ve omuz (x) ölçekleri taban ilkellerine uygulanır. */
function scalePrim(spec: PrimSpec, belly: number, shoulders: number): PrimSpec {
  const bellyIds = new Set(['hip', 'rump', 'belly']);
  const chestScale = 1 + (belly - 1) * .5;
  const shoulderIds = new Set(['shoulders', 'upperArm.L', 'upperArm.R', 'forearm.L', 'forearm.R', 'cuff.L', 'cuff.R']);
  if (bellyIds.has(spec.id) || spec.id === 'chest') {
    const s = spec.id === 'chest' ? chestScale : belly;
    const r = spec.r as readonly number[];
    return { ...spec, r: [r[0]! * s, r[1]!, r[2]! * s] };
  }
  if (spec.id === 'deltoid.L' || spec.id === 'deltoid.R') {
    const c = spec.c!;
    return { ...spec, c: [c[0]! * shoulders, c[1]!, c[2]!] };
  }
  if (shoulderIds.has(spec.id)) {
    const a = spec.a!, b = spec.b!;
    return { ...spec, a: [a[0]! * shoulders, a[1]!, a[2]!], b: [b[0]! * shoulders, b[1]!, b[2]!] };
  }
  return spec;
}

function makePrim(spec: PrimSpec, color: string | null, accessory: string | null): Prim {
  const rotArr = spec.rot;
  const rot = rotArr ? inverseEulerXYZ(rotArr[0]!, rotArr[1]!, rotArr[2]!) : null;
  const base = {
    id: spec.id, k: spec.k, region: spec.region, color, accessory, rot,
    rotEuler: rotArr ? [rotArr[0]!, rotArr[1]!, rotArr[2]!] as const : null,
    cx: num(spec.c, 0), cy: num(spec.c, 1), cz: num(spec.c, 2),
    ax: num(spec.a, 0), ay: num(spec.a, 1), az: num(spec.a, 2),
    bx: num(spec.b, 0), by: num(spec.b, 1), bz: num(spec.b, 2),
    r0: spec.r0 ?? 0, r1: spec.r1 ?? 0, corner: spec.corner ?? 0,
    axis: AXIS[spec.axis ?? 'y']!,
  };
  let kind: PrimKind = 0, rx = 0, ry = 0, rz = 0;
  const aabb = new Float64Array(6);
  const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number) => {
    const [gx, gy, gz] = rotArr ? rotatedHalf(rotArr[0]!, rotArr[1]!, rotArr[2]!, hx, hy, hz) : [hx, hy, hz];
    aabb.set([cx - gx, cy - gy, cz - gz, cx + gx, cy + gy, cz + gz]);
  };
  switch (spec.type) {
    case 'sphere': {
      kind = 0; rx = spec.r as number; ry = rx; rz = rx;
      box(base.cx, base.cy, base.cz, rx, rx, rx); break;
    }
    case 'ellipsoid': {
      kind = 1; const r = spec.r as readonly number[];
      rx = r[0]!; ry = r[1]!; rz = r[2]!;
      box(base.cx, base.cy, base.cz, rx, ry, rz); break;
    }
    case 'capsule': {
      kind = 2; const r = Math.max(base.r0, base.r1);
      aabb.set([
        Math.min(base.ax, base.bx) - r, Math.min(base.ay, base.by) - r, Math.min(base.az, base.bz) - r,
        Math.max(base.ax, base.bx) + r, Math.max(base.ay, base.by) + r, Math.max(base.az, base.bz) + r,
      ]);
      break;
    }
    case 'roundedBox': {
      kind = 3; const h = spec.half!;
      rx = h[0]!; ry = h[1]!; rz = h[2]!;
      box(base.cx, base.cy, base.cz, rx, ry, rz); break;
    }
    case 'torus': {
      kind = 4; const ring = spec.R!, tube = spec.r as number;
      rx = ring; ry = tube; rz = 0;
      const h: [number, number, number] = base.axis === 0 ? [tube, ring + tube, ring + tube]
        : base.axis === 1 ? [ring + tube, tube, ring + tube] : [ring + tube, ring + tube, tube];
      box(base.cx, base.cy, base.cz, h[0], h[1], h[2]); break;
    }
  }
  return { ...base, kind, rx, ry, rz, aabb };
}

/**
 * İlkelin EN İNCE yarıçapı (m). Taubin yumuşatmasında bu değerin altındaki
 * ayrıntılar (gözlük teli, zincir, siperlik, burun, ince bıyık, düğme)
 * yerinde sabitlenir; yoksa yumuşatma onları eritir.
 */
export function primThinness(p: Prim): number {
  switch (p.kind) {
    case 0: return p.rx;
    case 1: return Math.min(p.rx, p.ry, p.rz);
    case 2: return Math.max(p.r0, p.r1);
    case 3: return Math.min(p.rx, p.ry, p.rz);
    default: return p.ry;      // torus: boru yarıçapı
  }
}

/** Tek ilkelin işaretli uzaklığı (yumuşatma yok). */
export function evalPrim(p: Prim, x: number, y: number, z: number): number {
  let px = x, py = y, pz = z;
  if (p.rot) {
    const dx = x - p.cx, dy = y - p.cy, dz = z - p.cz, m = p.rot;
    px = p.cx + m[0]! * dx + m[1]! * dy + m[2]! * dz;
    py = p.cy + m[3]! * dx + m[4]! * dy + m[5]! * dz;
    pz = p.cz + m[6]! * dx + m[7]! * dy + m[8]! * dz;
  }
  switch (p.kind) {
    case 0: return sdSphere(px, py, pz, p.cx, p.cy, p.cz, p.rx);
    case 1: return sdEllipsoid(px, py, pz, p.cx, p.cy, p.cz, p.rx, p.ry, p.rz);
    case 2: return sdRoundCone(px, py, pz, p.ax, p.ay, p.az, p.bx, p.by, p.bz, p.r0, p.r1);
    case 3: return sdRoundBox(px, py, pz, p.cx, p.cy, p.cz, p.rx, p.ry, p.rz, p.corner);
    default: return sdTorus(px, py, pz, p.cx, p.cy, p.cz, p.axis, p.rx, p.ry);
  }
}

function unionBox(prims: readonly Prim[], pad: number): Float64Array {
  const b = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (const p of prims) for (let i = 0; i < 3; i++) {
    b[i] = Math.min(b[i]!, p.aabb[i]! - pad);
    b[i + 3] = Math.max(b[i + 3]!, p.aabb[i + 3]! + pad);
  }
  return b;
}

/** §d aksesuar renk çözümü: karakterin geçersiz kılması → aksesuar tablosu → aksesuar rengi. */
function accessoryColor(acc: AccessorySpec, entry: { color?: string; colors?: Readonly<Record<string, string>> }, primId: string): string {
  return entry.colors?.[primId] ?? acc.colors?.[primId] ?? entry.color ?? acc.color;
}

const fieldCache = new Map<string, CharacterField>();

/** `karakter:kademe` önbelleğinden alan (ilkel listesi ve AABB'ler yeniden kurulmaz). */
export function characterField(id: string, tier: Tier = 'standard'): CharacterField {
  const key = `${id}:${tier}`;
  const hit = fieldCache.get(key);
  if (hit) return hit;
  const built = buildField(id, tier);
  fieldCache.set(key, built);
  return built;
}

function buildField(id: string, tier: Tier): CharacterField {
  const character = characterSpec(id);
  const outfit = SPEC.outfits[character.outfit];
  const { belly, shoulders } = character.bodyScale;

  // --- Taban gövde (§b) -----------------------------------------------------
  const base: Prim[] = [];
  for (const spec of SPEC.base.primitives) {
    // Tişörtte manşet ilkeli çıkarılır (kısa kol).
    if (outfit.cuff === null && (spec.id === 'cuff.L' || spec.id === 'cuff.R')) continue;
    base.push(makePrim(scalePrim(spec, belly, shoulders), null, null));
  }

  // --- Aksesuar grupları (§d) ----------------------------------------------
  const groups: AccessoryGroup[] = [];
  const wires: Prim[] = [];
  for (const entry of character.accessories) {
    const acc = SPEC.accessories[entry.id];
    if (!acc) throw new Error(`D3: bilinmeyen aksesuar "${entry.id}"`);
    if (tier === 'low' && acc.tier === 'standard') continue;
    if (WIRE_ACCESSORIES.has(acc.id)) {
      for (const p of acc.primitives) wires.push(makePrim(p, accessoryColor(acc, entry, p.id), acc.id));
      continue;
    }
    const lift = ACCESSORY_LIFT[acc.id] ?? 0;
    const prims = acc.primitives.map((p) => makePrim(raiseY(p, lift), accessoryColor(acc, entry, p.id), acc.id));
    if (!prims.length) continue;
    const clipSpec = acc.clip;
    let clip: AccessoryGroup['clip'] = null;
    if (clipSpec) {
      const n = clipSpec.normal, len = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
      clip = { px: clipSpec.point[0]!, py: clipSpec.point[1]! + lift, pz: clipSpec.point[2]!, nx: n[0]! / len, ny: n[1]! / len, nz: n[2]! / len, k: clipSpec.k };
    }
    const subtract = acc.subtract ? makePrim(raiseY(acc.subtract, lift), null, acc.id) : null;
    const joinK = prims.some((p) => p.region === 'facial')
      ? Math.min(prims[0]!.k, FACIAL_JOIN_K) : prims[0]!.k;
    groups.push({
      id: acc.id, prims, joinK, clip, subtract,
      subtractK: acc.subtract?.k ?? 0,
      aabb: unionBox(prims, Math.max(...prims.map((p) => p.k))),
    });
  }

  const all: Prim[] = [...base, ...groups.flatMap((g) => g.prims), ...wires];
  const voxel = SPEC.base.voxel[tier];
  const raw = unionBox([...base, ...groups.flatMap((g) => g.prims)], 0);
  // smin yüzeyi ilkel birleşiminin en fazla k/4 dışına taşırır; 25 mm emniyet
  // payı en kaba kademenin (11 mm) 2 voxel'ini de kapsar.
  const pad = Math.max(...all.map((p) => p.k)) / 4 + .025;
  const snap = (v: number, dir: -1 | 1) => dir < 0 ? Math.floor((v - pad) / voxel) * voxel : Math.ceil((v + pad) / voxel) * voxel;
  const bounds = {
    min: [snap(raw[0]!, -1), snap(raw[1]!, -1), snap(raw[2]!, -1)] as V3,
    max: [snap(raw[3]!, 1), snap(raw[4]!, 1), snap(raw[5]!, 1)] as V3,
  };

  /**
   * İki katmanlı eleme: ilkeller sıralarını bozmadan 4'lü öbeklere bölünür ve
   * önce öbeğin birleşik AABB'si denenir. `d` yalnız azaldığı için öbek girişindeki
   * eşik içerideki her ilkel için de geçerlidir. Karekök alınmaz (kare karşılaştırma).
   */
  const chunks: { from: number; to: number; maxK: number; box: Float64Array }[] = [];
  for (let i = 1; i < base.length; i += 4) {
    const to = Math.min(base.length, i + 4);
    const slice = base.slice(i, to);
    chunks.push({ from: i, to, maxK: Math.max(...slice.map((p) => p.k)), box: unionBox(slice, 0) });
  }
  const first = base[0]!;

  const field = (x: number, y: number, z: number): number => {
    let d = evalPrim(first, x, y, z);
    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c]!;
      const t = d + chunk.maxK;
      if (boxLower2(x, y, z, chunk.box) > (t > 0 ? t * t : 0)) continue;
      for (let i = chunk.from; i < chunk.to; i++) {
        const p = base[i]!;
        const tp = d + p.k;
        if (boxLower2(x, y, z, p.aabb) > (tp > 0 ? tp * tp : 0)) continue;
        d = smin(d, evalPrim(p, x, y, z), p.k);
      }
    }
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi]!;
      const tg = d + g.joinK;
      if (boxLower2(x, y, z, g.aabb) > (tg > 0 ? tg * tg : 0)) continue;
      let s = evalPrim(g.prims[0]!, x, y, z);
      if (g.clip) {
        const plane = (x - g.clip.px) * g.clip.nx + (y - g.clip.py) * g.clip.ny + (z - g.clip.pz) * g.clip.nz;
        s = smax(s, -plane, g.clip.k);
      }
      for (let i = 1; i < g.prims.length; i++) {
        const p = g.prims[i]!;
        const tp = s + p.k;
        if (boxLower2(x, y, z, p.aabb) > (tp > 0 ? tp * tp : 0)) continue;
        s = smin(s, evalPrim(p, x, y, z), p.k);
      }
      if (g.subtract) s = smax(s, -evalPrim(g.subtract, x, y, z), g.subtractK);
      d = smin(d, s, g.joinK);
    }
    return d;
  };

  const nearest2 = (x: number, y: number, z: number, out: Nearest2): Nearest2 => {
    out.a = base[0]!; out.da = evalPrim(out.a, x, y, z); out.b = null; out.db = Infinity;
    const consider = (p: Prim) => {
      if (boxLower(x, y, z, p.aabb) > out.db) return;
      const d = evalPrim(p, x, y, z);
      if (d < out.da) { out.b = out.a; out.db = out.da; out.a = p; out.da = d; }
      else if (d < out.db) { out.b = p; out.db = d; }
    };
    for (let i = 1; i < base.length; i++) consider(base[i]!);
    for (const g of groups) {
      if (boxLower(x, y, z, g.aabb) > out.db) continue;
      // Çıkarılmış bölgedeki ilkeller renk sahibi olamaz; kesme düzlemi yalnız
      // ilk ilkeli (kubbe/kapak) kısıtlar.
      if (g.subtract && evalPrim(g.subtract, x, y, z) < -.002) continue;
      const cut = g.clip && (x - g.clip.px) * g.clip.nx + (y - g.clip.py) * g.clip.ny + (z - g.clip.pz) * g.clip.nz < -.002;
      for (let i = cut ? 1 : 0; i < g.prims.length; i++) consider(g.prims[i]!);
    }
    return out;
  };
  const scratch: Nearest2 = { a: base[0]!, da: 0, b: null, db: 0 };
  const nearest = (x: number, y: number, z: number): Prim => nearest2(x, y, z, scratch).a;

  const colorPrims: Prim[] = [...base, ...groups.flatMap((g) => g.prims)];
  const colorEligible = (x: number, y: number, z: number, out: Uint8Array): Uint8Array => {
    out.fill(1);
    let at = base.length;
    for (const g of groups) {
      const cut = g.clip !== null &&
        (x - g.clip.px) * g.clip.nx + (y - g.clip.py) * g.clip.ny + (z - g.clip.pz) * g.clip.nz < -.002;
      const gone = g.subtract !== null && evalPrim(g.subtract, x, y, z) < -.002;
      for (let i = 0; i < g.prims.length; i++) out[at + i] = gone || (cut && i === 0) ? 0 : 1;
      at += g.prims.length;
    }
    return out;
  };

  return { character, tier, base, groups, wires, all, colorPrims, colorEligible, bounds, field, nearest, nearest2 };
}

/** Test ve HMR için önbelleği boşaltır. */
export function clearFieldCache(): void {
  fieldCache.clear();
}
