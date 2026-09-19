/**
 * D1 — SDF → marching cubes → seyreltme → vertex renk + skin ağırlığı → tek
 * `BufferGeometry`. Geometri kalite kademesi başına BİR kez üretilir ve bütün
 * eller onu paylaşır (iskelet el başınadır).
 */
import { BufferAttribute, BufferGeometry, Color, Matrix3, Vector3 } from 'three';
import { FINGERS } from './anatomy';
import type { V3 } from './anatomy';
import { bindJoints, chainField, handBounds, handField, palmField } from './sdf';
import { clusterDecimate, marchField } from './marchingCubes';
import { forwardKinematics, skinWeights } from './skeleton';
import { BIND_POSE, POSES } from './poses';
import type { GripName } from './poses';

export type HandTier = 'standard' | 'low' | 'distant';
/** §g: standard 3.0 mm, low 4.5 mm. `distant` PublicArms içindir (masadaki eller). */
export const TIERS: Readonly<Record<HandTier, { voxel: number; cluster: number }>> = {
  standard: { voxel: .0030, cluster: .0052 },
  low: { voxel: .0045, cluster: .0072 },
  distant: { voxel: .0060, cluster: .0120 },
};

/** §f ten paleti (palette.ts cream/walnut türevi). */
export const SKIN = { base: '#c9a184', pad: '#d7a08a', knuckle: '#bd9276', palm: '#d2a58b' } as const;

const JOINTS = bindJoints();
const TIPS: V3[] = [...FINGERS.map((f) => JOINTS[f]![3]!), JOINTS.thumb![3]!];
const KNUCKLES: V3[] = [...FINGERS.flatMap((f) => [JOINTS[f]![0]!, JOINTS[f]![1]!]), JOINTS.thumb![1]!];
const BANDS: V3[] = [...FINGERS.flatMap((f) => JOINTS[f]!.slice(0, 3)), ...JOINTS.thumb!.slice(0, 3)] as V3[];

const near = (x: number, y: number, z: number, points: readonly V3[]): number => {
  let best = Infinity;
  for (const p of points) { const d = (x - p[0]) ** 2 + (y - p[1]) ** 2 + (z - p[2]) ** 2; if (d < best) best = d; }
  return Math.sqrt(best);
};

/** §f bölge kuralları → köşe renkleri (lineer uzay; `Color` dönüşümü yapar). */
export function vertexColors(positions: Float32Array): Float32Array {
  const base = new Color(SKIN.base), pad = new Color(SKIN.pad), knuckle = new Color(SKIN.knuckle), palm = new Color(SKIN.palm);
  const out = new Float32Array(positions.length);
  const c = new Color();
  for (let v = 0; v < positions.length / 3; v++) {
    const x = positions[v * 3]!, y = positions[v * 3 + 1]!, z = positions[v * 3 + 2]!;
    c.copy(base);
    if (y < -.006 && palmField(x, y, z) < .004) c.lerp(palm, .5);
    const tip = near(x, y, z, TIPS);
    if (tip < .012) c.lerp(pad, 1 - tip / .012);
    const ridge = near(x, y, z, KNUCKLES);
    if (ridge < .006 && y > 0) c.lerp(knuckle, .4 * (1 - ridge / .006));
    out[v * 3] = c.r; out[v * 3 + 1] = c.g; out[v * 3 + 2] = c.b;
  }
  return out;
}

const jointBand = (x: number, y: number, z: number) => near(x, y, z, BANDS) < .005;

/**
 * D1 tur 6 — köşe kümeleme grubu: köşe HANGİ parçaya ait (avuç = 0, parmaklar
 * 1…4, baş parmak 5). Farklı gruplar aynı hücrede birleşmez; komşu parmakların
 * karşı duvarları tek köşeye inip pozda ince perde yaması üretemez.
 */
const GROUP_ORDER = ['index', 'middle', 'ring', 'pinky', 'thumb'] as const;
function vertexGroup(x: number, y: number, z: number): number {
  let best = palmField(x, y, z), id = 0;
  for (let i = 0; i < GROUP_ORDER.length; i++) {
    const d = chainField(x, y, z, GROUP_ORDER[i]!);
    if (d < best) { best = d; id = i + 1; }
  }
  return id;
}

export type HandBuild = { geometry: BufferGeometry; triangles: number; vertices: number; buildMs: number };

const cache = new Map<HandTier, HandBuild>();

/** Kalite kademesi başına tek üretim (`performance.now()` ile ölçülür). */
export function handGeometry(tier: HandTier): HandBuild {
  const hit = cache.get(tier);
  if (hit) return hit;
  const started = performance.now();
  const { voxel, cluster } = TIERS[tier];
  const bounds = handBounds(.010);
  const raw = marchField(handField, bounds.min, bounds.max, voxel);
  const mesh = clusterDecimate(raw, cluster, jointBand, .55, vertexGroup);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(mesh.normals, 3));
  geometry.setAttribute('color', new BufferAttribute(vertexColors(mesh.positions), 3));
  const skin = skinWeights(mesh.positions);
  geometry.setAttribute('skinIndex', new BufferAttribute(skin.index, 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(skin.weight, 4));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  geometry.computeBoundingSphere();
  const build: HandBuild = { geometry, triangles: mesh.indices.length / 3, vertices: mesh.positions.length / 3, buildMs: performance.now() - started };
  cache.set(tier, build);
  return build;
}

/** Bind (tüm açılar 0) dünya matrislerinin tersi — CPU'da poz pişirmek için. */
const BIND_INVERSE = forwardKinematics(BIND_POSE).map((m) => m.clone().invert());

/**
 * §g PublicArms: skin yerine POZ PİŞİRİLMİŞ statik geometri. Köşeler CPU'da
 * `Σ w_i · B_i · B0_i⁻¹ · p` ile dönüştürülür, sonuç düz bir `BufferGeometry`.
 */
export function bakedPose(tier: HandTier, grip: GripName): BufferGeometry {
  const source = handGeometry(tier).geometry;
  const position = source.getAttribute('position') as BufferAttribute;
  const normal = source.getAttribute('normal') as BufferAttribute;
  const index = source.getAttribute('skinIndex') as BufferAttribute;
  const weight = source.getAttribute('skinWeight') as BufferAttribute;
  const world = forwardKinematics(POSES[grip]);
  const skinning = world.map((m, i) => m.clone().multiply(BIND_INVERSE[i]!));
  const rotations = skinning.map((m) => new Matrix3().setFromMatrix4(m));
  const positions = new Float32Array(position.count * 3), normals = new Float32Array(position.count * 3);
  const p = new Vector3(), n = new Vector3(), sum = new Vector3(), sumN = new Vector3();
  for (let v = 0; v < position.count; v++) {
    sum.set(0, 0, 0); sumN.set(0, 0, 0);
    for (let s = 0; s < 2; s++) {
      const w = weight.getComponent(v, s);
      if (w <= 0) continue;
      const b = index.getComponent(v, s);
      p.fromBufferAttribute(position, v).applyMatrix4(skinning[b]!);
      n.fromBufferAttribute(normal, v).applyMatrix3(rotations[b]!);
      sum.addScaledVector(p, w); sumN.addScaledVector(n, w);
    }
    sumN.normalize();
    positions[v * 3] = sum.x; positions[v * 3 + 1] = sum.y; positions[v * 3 + 2] = sum.z;
    normals[v * 3] = sumN.x; normals[v * 3 + 1] = sumN.y; normals[v * 3 + 2] = sumN.z;
  }
  const baked = new BufferGeometry();
  baked.setAttribute('position', new BufferAttribute(positions, 3));
  baked.setAttribute('normal', new BufferAttribute(normals, 3));
  baked.setAttribute('color', new BufferAttribute((source.getAttribute('color') as BufferAttribute).array.slice() as Float32Array, 3));
  baked.setIndex(new BufferAttribute((source.getIndex()!.array as Uint32Array).slice(), 1));
  baked.computeBoundingSphere();
  return baked;
}

/**
 * D3.4 — köşe renklerini hedef ten tonuna kaydırır. Yastık/boğum/avuç
 * farkları korunur: renkler lineer uzayda hedef/kaynak ORANIYLA çarpılır
 * (`PublicArms` ile aynı kural, tek kaynak burada).
 */
export function tintVertexColors(geometry: BufferGeometry, base: string): void {
  const target = new Color(base), source = new Color(SKIN.base);
  const rx = target.r / source.r, gx = target.g / source.g, bx = target.b / source.b;
  const color = geometry.getAttribute('color') as BufferAttribute;
  const array = color.array as Float32Array;
  for (let i = 0; i < array.length; i += 3) {
    array[i] = Math.min(1, array[i]! * rx);
    array[i + 1] = Math.min(1, array[i + 1]! * gx);
    array[i + 2] = Math.min(1, array[i + 2]! * bx);
  }
  color.needsUpdate = true;
}

const tinted = new Map<string, BufferGeometry>();

/**
 * D3.4 — İLK ŞAHIS eli oyuncunun seçtiği ten tonunda. Konum/normal/indis ve
 * skin öznitelikleri kademeyle PAYLAŞILIR; yalnız `color` özniteliği tene göre
 * kopyalanır (kademe × ten başına bir kez). Taban ton `SKIN.base` ise üretim
 * geometrisi doğrudan döner.
 */
export function tintedHandGeometry(tier: HandTier, base: string): BufferGeometry {
  const source = handGeometry(tier).geometry;
  if (base === SKIN.base) return source;
  const key = `${tier}:${base}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const geometry = new BufferGeometry();
  for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) {
    geometry.setAttribute(name, source.getAttribute(name)!);
  }
  geometry.setIndex(source.getIndex());
  geometry.setAttribute('color', (source.getAttribute('color') as BufferAttribute).clone());
  tintVertexColors(geometry, base);
  geometry.boundingSphere = source.boundingSphere;
  tinted.set(key, geometry);
  return geometry;
}

/** Sahne kapanışında tüm kademeleri bırakmak için (testler ve HMR). */
export function disposeHandGeometry(): void {
  for (const build of cache.values()) build.geometry.dispose();
  cache.clear();
  // Boyalı kopyalar öznitelikleri paylaşır; yalnız kendi `color` tamponlarını bırakır.
  for (const geometry of tinted.values()) geometry.dispose();
  tinted.clear();
}
