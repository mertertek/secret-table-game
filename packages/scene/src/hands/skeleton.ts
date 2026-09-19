/**
 * D1 §c — 16 kemikli iskelet, bind matrisleri ve köşe başına en yakın 2 kemik
 * ağırlığı (σ = 4 mm, toplam 1). Geometri BIND pozunda üretildiği için bind
 * dünya matrisleri = yerel zincirin kendisidir (grup dönüşümü dahil değildir).
 */
import { Bone, Euler, Matrix4, Quaternion, Skeleton, Vector3 } from 'three';
import { BONES, FINGER, FINGERS, THENAR, THUMB } from './anatomy';
import type { BoneName, V3 } from './anatomy';
import { bindJoints, palmField, sdEllipsoid, sdRoundCone } from './sdf';
import type { Segment } from './sdf';
import { fingerSegments } from './sdf';
import type { Pose } from './poses';

export type BoneDef = { name: BoneName; parent: number; position: V3; quaternion: readonly [number, number, number, number] };

const IDENTITY_Q = [0, 0, 0, 1] as const;

/** Bind yerel dönüşümler. Yalnız baş parmak CMC'nin taban çerçevesi sıfırdan farklı. */
export function boneDefs(): readonly BoneDef[] {
  const q = new Quaternion().setFromEuler(new Euler(THUMB.euler[0], THUMB.euler[1], THUMB.euler[2], 'XYZ'));
  const defs: BoneDef[] = [{ name: 'wrist', parent: -1, position: [0, 0, 0], quaternion: IDENTITY_Q }];
  defs.push({ name: 'thumb.cmc', parent: 0, position: THUMB.cmc, quaternion: [q.x, q.y, q.z, q.w] });
  defs.push({ name: 'thumb.mcp', parent: 1, position: [0, 0, -THUMB.lengths[0]], quaternion: IDENTITY_Q });
  defs.push({ name: 'thumb.ip', parent: 2, position: [0, 0, -THUMB.lengths[1]], quaternion: IDENTITY_Q });
  for (const finger of FINGERS) {
    const f = FINGER[finger]; const base = defs.length;
    defs.push({ name: `${finger}.mcp` as BoneName, parent: 0, position: f.mcp, quaternion: IDENTITY_Q });
    defs.push({ name: `${finger}.pip` as BoneName, parent: base, position: [0, 0, -f.lengths[0]], quaternion: IDENTITY_Q });
    defs.push({ name: `${finger}.dip` as BoneName, parent: base + 1, position: [0, 0, -f.lengths[1]], quaternion: IDENTITY_Q });
  }
  if (defs.map((d) => d.name).join() !== BONES.join()) throw new Error('D1: kemik sırası bozuldu');
  return defs;
}

export const BONE_INDEX: Readonly<Record<BoneName, number>> = Object.fromEntries(BONES.map((b, i) => [b, i])) as Record<BoneName, number>;
const DEFS = boneDefs();
const THUMB_BASE_Q = new Quaternion().setFromEuler(new Euler(THUMB.euler[0], THUMB.euler[1], THUMB.euler[2], 'XYZ'));
const scratch = { e: new Euler(), q: new Quaternion(), inner: new Quaternion(), p: new Vector3(), one: new Vector3(1, 1, 1), local: new Matrix4() };

/** Kemik → ağırlık/temas için kapsül; `wrist` avuç kümesinin kendisidir (segment yok). */
export function boneSegments(): readonly (Segment | null)[] {
  const chains = fingerSegments();
  const out: (Segment | null)[] = [null];
  for (const s of chains.thumb!) out.push(s);
  for (const finger of FINGERS) for (const s of chains[finger]!) out.push(s);
  return out;
}

const SEGMENTS = boneSegments();

/** Bir kemiğe poz açılarını uygula (kuaterniyon). Bind dönüşü korunur. */
export function boneQuaternion(name: BoneName, values: readonly number[], out = new Quaternion()): Quaternion {
  if (name === 'wrist') return out.identity();
  if (name === 'thumb.cmc') {
    scratch.e.set(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, 'XYZ');
    scratch.inner.setFromEuler(scratch.e);
    return out.copy(THUMB_BASE_Q).multiply(scratch.inner);
  }
  const abd = name.endsWith('.mcp') && name !== 'thumb.mcp' ? -(values[1] ?? 0) : 0;
  return out.setFromEuler(scratch.e.set(-(values[0] ?? 0), abd, 0, 'XYZ'));
}

export type HandSkeleton = { root: Bone; bones: Bone[]; skeleton: Skeleton };

/** Ayrık (sahneye eklenmemiş) bind iskeleti — boneInverses şablon uzayındadır. */
export function buildSkeleton(): HandSkeleton {
  const defs = boneDefs();
  const bones = defs.map((d) => {
    const bone = new Bone();
    bone.name = d.name;
    bone.position.set(d.position[0], d.position[1], d.position[2]);
    bone.quaternion.set(d.quaternion[0], d.quaternion[1], d.quaternion[2], d.quaternion[3]);
    return bone;
  });
  defs.forEach((d, i) => { if (d.parent >= 0) bones[d.parent]!.add(bones[i]!); });
  const root = bones[0]!;
  root.updateMatrixWorld(true);
  return { root, bones, skeleton: new Skeleton(bones) };
}

/** Poz → her kemiğin ŞABLON uzayındaki dünya matrisi (grup dönüşümü yok). */
export function forwardKinematics(pose: Pose, out?: Matrix4[]): Matrix4[] {
  const result = out ?? DEFS.map(() => new Matrix4());
  const { q, p, one, local } = scratch;
  DEFS.forEach((d, i) => {
    boneQuaternion(d.name, pose[d.name] ?? [], q);
    p.set(d.position[0], d.position[1], d.position[2]);
    local.compose(p, q, one);
    if (d.parent < 0) result[i]!.copy(local); else result[i]!.multiplyMatrices(result[d.parent]!, local);
  });
  return result;
}

/** Poz → kemik dönüşlerini mevcut `Bone` dizisine yaz. */
export function applyPose(bones: readonly Bone[], pose: Pose): void {
  const q = new Quaternion();
  DEFS.forEach((d, i) => { bones[i]?.quaternion.copy(boneQuaternion(d.name, pose[d.name] ?? [], q)); });
}

const SIGMA = .004;
/** Bandın dışında (2 kemik arası fark bu değerden büyükse) tek kemik 1.0 olur. */
const BAND = .005;
/**
 * D1 tur 5 — KOMŞU PARMAĞA SIZMA YOK. Perdeler kalkıp parmak arası boşluk
 * 4 mm'ye inince, bir parmağın iç duvarındaki köşeler BAND içinde kalan komşu
 * parmağın kemiğinden ağırlık alıyordu (o parmak büküldüğünde yandaki parmağın
 * yüzü sürükleniyordu). Karışım yalnız AYNI zincirde ya da avuçla (`wrist`)
 * yapılır; iki farklı parmak arasında asla.
 */
const CHAIN_OF: readonly string[] = BONES.map((b) => b.split('.')[0]!);
const blendable = (a: number, b: number): boolean =>
  a === b || CHAIN_OF[a] === CHAIN_OF[b] || CHAIN_OF[a] === 'wrist' || CHAIN_OF[b] === 'wrist';

export type SkinData = { index: Uint16Array; weight: Float32Array };

/**
 * Köşe başına en yakın 2 kemik: `d_i = |p − seg_i| − r_i`, `w_i ∝ exp(−d_i/σ)`.
 * `wrist` uzaklığı avuç kümesinin SDF'sidir; thenar içi köşeler wrist 0.7 /
 * thumb.cmc 0.3 ile sabitlenir (§c).
 */
export function skinWeights(positions: Float32Array): SkinData {
  const count = positions.length / 3;
  const index = new Uint16Array(count * 4);
  const weight = new Float32Array(count * 4);
  const thumbCmc = BONE_INDEX['thumb.cmc'];
  for (let v = 0; v < count; v++) {
    const x = positions[v * 3]!, y = positions[v * 3 + 1]!, z = positions[v * 3 + 2]!;
    let i0 = 0, d0 = palmField(x, y, z), i1 = -1, d1 = Infinity;
    for (let b = 1; b < SEGMENTS.length; b++) {
      const s = SEGMENTS[b]!;
      const d = sdRoundCone(x, y, z, s.a[0], s.a[1], s.a[2], s.b[0], s.b[1], s.b[2], s.ra, s.rb);
      if (d < d0) { i1 = i0; d1 = d0; i0 = b; d0 = d; } else if (d < d1) { i1 = b; d1 = d; }
    }
    let w0 = 1, w1 = 0;
    if (i1 >= 0 && d1 - d0 <= BAND && blendable(i0, i1)) {
      const e0 = 1, e1 = Math.exp(-(d1 - d0) / SIGMA);
      w0 = e0 / (e0 + e1); w1 = 1 - w0;
    } else i1 = i0;
    // Thenar tepesi: baş parmak CMC'si ile paylaşılır, aksi hâlde karşı-tutuşta yırtılır.
    if (i0 === 0 && sdEllipsoid(x, y, z, THENAR.center[0], THENAR.center[1], THENAR.center[2], THENAR.radii[0], THENAR.radii[1], THENAR.radii[2]) <= .002) {
      i1 = thumbCmc; w0 = .7; w1 = .3;
    }
    index[v * 4] = i0; index[v * 4 + 1] = i1;
    weight[v * 4] = w0; weight[v * 4 + 1] = w1;
  }
  return { index, weight };
}

/** Bind pozundaki eklem noktaları (testler ve temas hesabı için yeniden dışa açılır). */
export const BIND_JOINTS = bindJoints();
