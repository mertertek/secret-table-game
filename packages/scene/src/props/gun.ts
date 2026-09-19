/**
 * D12 §2 — infaz tabancası. D1/D3 ile AYNI boru hattı: ilkel SDF → polinom
 * smooth-min → marching cubes → köşe kümeleme → **Newton iso-yüzey yansıtma**
 * → hafif Taubin → **SDF gradyan normalleri** → köşe renkleri + sınır verisi.
 *
 * Birimler EL ŞABLONUDUR (`docs/design/d1/poses.json` `frame`: bilek orijin,
 * parmaklar −Z, avuç −Y, baş parmak −X, sağ el). El uzunluğu 0,19; silah
 * toplam 0,361 = 1,90 el (tur 4).
 *
 * NESNENİN ORİJİNİ KABZA MERKEZİDİR (yumruğun içi): `PROP_FRAMES.holdGun.C`
 * doğrudan avuçtaki tutuş noktasına oturur, namlu işaret parmağı hizasında öne
 * bakar.
 *
 * Tur 5 (kullanıcı "grafikler yüklenmemiş gibi duruyor"): ızgara sıklaştı,
 * kümeleme hücresi 22 → 8 mm indi (≈2,5 k üçgen), birleşimler keskinleşti,
 * horoz / ön nişangâh / tambur pimi / kabza vidası eklendi ve her köşe
 * **iki bölge rengi + sınıra işaretli uzaklık** (D3 kenar-yumuşatma kalıbı) ile
 * **bölge malzemesi** (metal / ahşap / pirinç) taşır.
 *
 * Üretim TEMBEL ve PAYLAŞIMLIDIR: ilk infazda bir kez üretilir, sonra
 * önbellekten gelir. Tek örnek sahnede yalnız infaz boyunca görünür; bütçe
 * 3 000 üçgen.
 */
import { BufferAttribute, BufferGeometry, Color } from 'three';
import { clusterDecimate, gradientNormals, marchField, projectToSurface, taubinSmooth } from '../hands/marchingCubes';
import { sdRoundBox, sdRoundCone, sdSphere, sdTorus, smax, smin } from '../sdf/primitives';
import { prop } from '../materials/palette';

/**
 * Tur 4 — GÖVDE ölçeği tek çarpanla büyür (namlu, tambur, korkuluk, namlu
 * ağzı), KABZA ise yumruğa oturmaya devam etsin diye yalnız biraz uzar; kabza
 * YARIÇAPI sabittir (yumruk tüpü yarıçapı .029). Toplam uzunluk 1,90 el.
 */
export const BODY_SCALE = 1.7;
const GRIP_SCALE = 1.2;

/** §2 ölçü tablosu (el birimi, orijin = kabza merkezi). Tek kaynak burasıdır. */
export const GUN = {
  /** Gövde ölçeği; flaş/duman gibi efektler de bunu kullanır. */
  scale: BODY_SCALE,
  /** Namlu: −Z ekseni, tamburun ekseniyle aynı yükseklikte. */
  barrel: { y: .042 * BODY_SCALE, from: -.050 * BODY_SCALE, to: -.150 * BODY_SCALE, r: .020 * BODY_SCALE },
  /** Tambur: belirgin, 6 sığ oluklu. */
  drum: {
    c: [0, .042 * BODY_SCALE, -.022 * BODY_SCALE] as const, r: .045 * BODY_SCALE, half: .0225 * BODY_SCALE,
    flute: { at: .041 * BODY_SCALE, r: .006 * BODY_SCALE, count: 6 },
  },
  /** Kabza: dikeyden 20° geri; yarıçap yumruk tüpüne göre SABİT. */
  grip: { top: [0, .020 * BODY_SCALE, -.004 * BODY_SCALE] as const, tilt: 20 * Math.PI / 180, length: .085 * GRIP_SCALE, r0: .026, r1: .030 },
  /** Tetik korkuluğu: X normalli tor, tamburun altında. */
  guard: { c: [0, -.012 * BODY_SCALE, -.048 * BODY_SCALE] as const, ring: .026 * BODY_SCALE, tube: .006 * BODY_SCALE },
  /** Namlu ağzı pirinç halkası. */
  muzzle: { z: -.150 * BODY_SCALE, ring: .024 * BODY_SCALE, tube: .0055 * BODY_SCALE },
  /** Tur 5 ayrıntıları: horoz, ön nişangâh, tambur ekseni pimi, kabza vidası. */
  hammer: { c: [0, .066 * BODY_SCALE, .012 * BODY_SCALE] as const, half: [.007, .018, .011] as const, corner: .005 },
  sight: { c: [0, .064 * BODY_SCALE, -.140 * BODY_SCALE] as const, half: [.004, .010, .008] as const, corner: .003 },
  pin: { r: .008 * BODY_SCALE, half: .026 * BODY_SCALE },
  screw: { c: [0, -.028, .012] as const, r: .010 },
  /** Tur 5: birleşim yumuşaklığı yarıya indi — parça sınırları okunur kalsın. */
  k: .006 * BODY_SCALE,
} as const;

const gripEnd = [
  GUN.grip.top[0],
  GUN.grip.top[1] - Math.cos(GUN.grip.tilt) * GUN.grip.length,
  GUN.grip.top[2] + Math.sin(GUN.grip.tilt) * GUN.grip.length,
] as const;

/** Namlu ucu ↔ kabza altı; testler bu oranı el uzunluğuna karşı ölçer. */
export const GUN_LENGTH = Math.hypot(
  GUN.barrel.y - gripEnd[1]! + GUN.grip.r1,
  GUN.muzzle.z - GUN.muzzle.tube - (gripEnd[2]! + GUN.grip.r1),
);

function barrelField(x: number, y: number, z: number): number {
  const b = GUN.barrel;
  // Silindirik namlu (uçta yalnız %4 incelme): huni görünümü olmasın.
  const barrel = sdRoundCone(x, y, z, 0, b.y, b.from, 0, b.y, b.to, b.r * .86, b.r * .82);
  // Ön nişangâh: namlu ucunun üstünde küçük dikdörtgen.
  const s = GUN.sight;
  const sight = sdRoundBox(x, y, z, s.c[0], s.c[1], s.c[2], s.half[0], s.half[1], s.half[2], s.corner);
  return smin(barrel, sight, .004);
}

/** Tambur + 6 sığ oluk (yumuşak çıkarma) + eksen pimi. */
function drumField(x: number, y: number, z: number): number {
  const d = GUN.drum;
  // Silindir = eksene uzaklık ile kalınlığın kesişimi (yuvarlatılmış kenar).
  const radial = Math.hypot(x - d.c[0], y - d.c[1]) - (d.r - .008);
  const along = Math.abs(z - d.c[2]) - (d.half - .008);
  const outside = Math.hypot(Math.max(radial, 0), Math.max(along, 0)) + Math.min(Math.max(radial, along), 0) - .008;
  let body = outside;
  for (let i = 0; i < d.flute.count; i++) {
    const a = (i + .5) * Math.PI * 2 / d.flute.count;
    const fx = d.c[0] + Math.cos(a) * d.flute.at, fy = d.c[1] + Math.sin(a) * d.flute.at;
    const flute = Math.hypot(x - fx, y - fy) - d.flute.r;
    // Tur 5: oluk kenarı keskinleşti (k .004 → .0022).
    body = smax(body, -flute, .0022);
  }
  // Tambur ekseni pimi: eksende öne taşan kısa silindir.
  const pinRadial = Math.hypot(x - d.c[0], y - d.c[1]) - GUN.pin.r;
  const pinAlong = Math.abs(z - (d.c[2] - GUN.pin.half * .4)) - GUN.pin.half;
  const pin = Math.hypot(Math.max(pinRadial, 0), Math.max(pinAlong, 0)) + Math.min(Math.max(pinRadial, pinAlong), 0);
  return smin(body, pin, .003);
}

function guardField(x: number, y: number, z: number): number {
  const g = GUN.guard;
  return sdTorus(x, y, z, g.c[0], g.c[1], g.c[2], 0, g.ring, g.tube);
}

/** Horoz: tamburun arkasında, yukarı bakan küçük tırtıklı blok. */
function hammerField(x: number, y: number, z: number): number {
  const h = GUN.hammer;
  return sdRoundBox(x, y, z, h.c[0], h.c[1], h.c[2], h.half[0], h.half[1], h.half[2], h.corner);
}

function gripField(x: number, y: number, z: number): number {
  const g = GUN.grip;
  return sdRoundCone(x, y, z, g.top[0], g.top[1], g.top[2], gripEnd[0]!, gripEnd[1]!, gripEnd[2]!, g.r0, g.r1);
}

/** Pirinç: namlu ağzı halkası + kabza vidası. */
function brassField(x: number, y: number, z: number): number {
  const ring = sdTorus(x, y, z, 0, GUN.barrel.y, GUN.muzzle.z, 2, GUN.muzzle.ring, GUN.muzzle.tube);
  const s = GUN.screw;
  // Vida iki yanda: |x| kabza yüzeyine oturur.
  const screw = sdSphere(Math.abs(x), y, z, GUN.grip.r0 * .75, s.c[1], s.c[2], s.r);
  return Math.min(ring, screw);
}

/** Metal gövde: namlu + nişangâh + tambur + pim + korkuluk + horoz. */
const metalField = (x: number, y: number, z: number): number =>
  // Namlu–tambur birleşimi DAHA KESKİN (k .004): daha geniş bir yumuşatma
  // namluyu tamburdan açılan bir huni gibi gösteriyordu (tur 5 kullanıcı notu).
  smin(smin(smin(barrelField(x, y, z), drumField(x, y, z), .004), guardField(x, y, z), GUN.k), hammerField(x, y, z), GUN.k);

export function gunField(x: number, y: number, z: number): number {
  return smin(smin(metalField(x, y, z), gripField(x, y, z), GUN.k), brassField(x, y, z), .004);
}

/** İlkellerin en dış kabuğu + yumuşatma payı; yüzey KUTUDAN taşmaz. */
const BOUNDS = {
  min: [-.11, -.12, -.30] as const,
  max: [.11, .17, .09] as const,
};

/**
 * Tur 5 çözünürlüğü. 6,5 mm voxel oluk (Ø 20 mm), pim, nişangâh ve horoz gibi
 * ayrıntıları çözer; 11,5 mm kümeleme ≈ 2,8 k üçgen bırakır (bütçe 3 000).
 * Newton yansıtma kümelemenin içe çökmesini düzeltir, SDF gradyan normali
 * seyrek ağdaki faseti kaldırır. Ölçülen üretim: ~75 ms (bütçe 80).
 */
type GunTier = 'low' | 'hd';
const GRID: Readonly<Record<GunTier, { voxel: number; cell: number; project: number; smooth: number }>> = {
  /** İlk kare: tur 4 kabası (~700 üçgen, ~20 ms) — HD hazır olana kadar. */
  low: { voxel: .0045 * BODY_SCALE, cell: .013 * BODY_SCALE, project: 1, smooth: 0 },
  hd: { voxel: .0065, cell: .0115, project: 2, smooth: 1 },
};

/** Bölge kimlikleri; köşe rengi ve malzemesi buradan türer. */
const REGION = { metal: 0, wood: 1, brass: 2 } as const;
type Region = typeof REGION[keyof typeof REGION];

/** §3 bölge malzemesi: metal gövde, ahşap kabza, pirinç halka/vida. */
const MATERIAL: Readonly<Record<Region, { metalness: number; roughness: number }>> = {
  [REGION.metal]: { metalness: .75, roughness: .32 },
  [REGION.wood]: { metalness: 0, roughness: .60 },
  [REGION.brass]: { metalness: .80, roughness: .28 },
};

const COLOR: Readonly<Record<Region, Color>> = {
  [REGION.metal]: new Color(prop.gunBody),
  [REGION.wood]: new Color(prop.gunGrip),
  [REGION.brass]: new Color(prop.gunBrass),
};

/** Bir noktanın üç bölgeye uzaklığı (en yakın ikisi renk sınırını verir). */
function regionDistances(x: number, y: number, z: number): [number, number, number] {
  return [metalField(x, y, z), gripField(x, y, z), brassField(x, y, z)];
}

export type GunBuild = {
  geometry: BufferGeometry;
  triangles: number;
  vertices: number;
  buildMs: number;
};

const cache = new Map<GunTier, GunBuild>();

/**
 * İlk çağrıda üretir, sonra aynı `BufferGeometry`yi paylaşır (D1 `geometry.ts`
 * kalıbı). Geometri NON-INDEXED'tır: her üçgenin üç köşesi AYNI renk çiftini
 * taşır, böylece `fwidth` sınır karışımı üçgen boyunca doğru çalışır (D3 §e).
 */
export function gunGeometry(tier: GunTier = 'hd'): GunBuild {
  const hit = cache.get(tier);
  if (hit) return hit;
  const started = Date.now();
  const grid = GRID[tier];
  const raw = marchField(gunField, BOUNDS.min, BOUNDS.max, grid.voxel);
  const clustered = clusterDecimate(raw, grid.cell);
  // Kümeleme köşeleri hücre ortalamasına taşır → iso-yüzeyin içine çöker.
  clustered.positions = projectToSurface(
    clustered.positions, gunField, grid.voxel / 2, grid.project, grid.cell / 2,
  );
  const mesh = grid.smooth > 0 ? taubinSmooth(clustered, grid.smooth, .5, -.53) : clustered;
  mesh.normals = gradientNormals(mesh.positions, gunField, grid.voxel / 2);

  const triangles = mesh.indices.length / 3;
  const count = triangles * 3;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const colorsB = new Float32Array(count * 3);
  const boundary = new Float32Array(count);
  const material = new Float32Array(count * 2);
  const distance: [number, number, number][] = [];
  const region: Region[] = [];
  const vertexCount = mesh.positions.length / 3;
  for (let v = 0; v < vertexCount; v++) {
    const d = regionDistances(mesh.positions[v * 3]!, mesh.positions[v * 3 + 1]!, mesh.positions[v * 3 + 2]!);
    distance.push(d);
    region.push((d[1] < d[0] && d[1] <= d[2] ? REGION.wood : d[2] < d[0] && d[2] < d[1] ? REGION.brass : REGION.metal) as Region);
  }
  for (let t = 0; t < triangles; t++) {
    const ids = [mesh.indices[t * 3]!, mesh.indices[t * 3 + 1]!, mesh.indices[t * 3 + 2]!];
    // Üçgenin rengi: köşelerin en yakın bölgesi; ikinci renk = ilk FARKLI bölge.
    let best = ids[0]!, bestValue = Infinity;
    for (const id of ids) {
      const value = distance[id]![region[id]!]!;
      if (value < bestValue) { bestValue = value; best = id; }
    }
    const main = region[best]!;
    let other: Region | undefined;
    for (const id of ids) if (region[id]! !== main) { other = region[id]!; break; }
    const second = other ?? main;
    for (let i = 0; i < 3; i++) {
      const id = ids[i]!, at = (t * 3 + i);
      for (let a = 0; a < 3; a++) {
        positions[at * 3 + a] = mesh.positions[id * 3 + a]!;
        normals[at * 3 + a] = mesh.normals[id * 3 + a]!;
      }
      const a = COLOR[main], b = COLOR[second];
      colors[at * 3] = a.r; colors[at * 3 + 1] = a.g; colors[at * 3 + 2] = a.b;
      colorsB[at * 3] = b.r; colorsB[at * 3 + 1] = b.g; colorsB[at * 3 + 2] = b.b;
      // Sınıra işaretli uzaklık: ana bölgenin içinde pozitif.
      boundary[at] = other === undefined ? 1 : (distance[id]![second]! - distance[id]![main]!) / 2;
      // Malzeme köşenin KENDİ bölgesinden gelir (sınırda doğal geçiş).
      const own = MATERIAL[region[id]!];
      material[at * 2] = own.metalness; material[at * 2 + 1] = own.roughness;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setAttribute('colorB', new BufferAttribute(colorsB, 3));
  geometry.setAttribute('dBoundary', new BufferAttribute(boundary, 1));
  geometry.setAttribute('gunMaterial', new BufferAttribute(material, 2));
  geometry.computeBoundingSphere();
  const build: GunBuild = { geometry, triangles, vertices: count, buildMs: Date.now() - started };
  cache.set(tier, build);
  return build;
}

type IdleHost = { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number };

/**
 * HD geometriyi BOŞTA ZAMANDA üretir (ölçülen ~85 ms; ilk karede kare
 * düşürmesin). Zaten önbellekteyse eşzamanlı döner ve `true` verir; değilse
 * çağıran ilk kareyi `low` sürümle çizer, hazır olunca `onReady` gelir.
 */
export function requestGunGeometry(onReady: (build: GunBuild) => void): boolean {
  const ready = cache.get('hd');
  if (ready) { onReady(ready); return true; }
  const run = () => onReady(gunGeometry('hd'));
  const idle = (globalThis as unknown as IdleHost).requestIdleCallback;
  if (idle) idle(run, { timeout: 400 }); else setTimeout(run, 0);
  return false;
}

/** Testler ve HMR için. */
export function disposeGunGeometry(): void {
  for (const build of cache.values()) build.geometry.dispose();
  cache.clear();
}
