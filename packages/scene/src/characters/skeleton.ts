/**
 * D3 §c — 8 kemikli iskelet (`hips → spine → neck → head`,
 * `spine → shoulder.L/R → elbow.L/R`) ve köşe başına en yakın 2 kemik ağırlığı
 * (σ = 12 mm, toplam 1). Geometri BIND pozunda üretildiği için bind dünya
 * matrisleri yerel zincirin kendisidir (D1 `hands/skeleton.ts` ile aynı düzen).
 */
import { Bone, Skeleton } from 'three';
import { SPEC } from './spec';
import type { BoneName, CharacterSpec } from './spec';
import type { Prim } from './field';

export type BoneDef = { name: BoneName; parent: number; position: readonly [number, number, number]; head: readonly [number, number, number]; tail: readonly [number, number, number] };

/** §e omuz ölçeği kemiklerde de uygulanır, yoksa skin kayar. */
export function boneDefs(character: CharacterSpec): readonly BoneDef[] {
  const t = character.bodyScale.shoulders;
  const scaled = (name: BoneName, v: readonly number[]): [number, number, number] => {
    const s = name.startsWith('shoulder') || name.startsWith('elbow') ? t : 1;
    return [(v[0] ?? 0) * s, v[1] ?? 0, v[2] ?? 0];
  };
  const names = SPEC.bones.map((b) => b.name);
  const heads = SPEC.bones.map((b) => scaled(b.name, b.head));
  return SPEC.bones.map((b, i) => {
    const parent = b.parent === null ? -1 : names.indexOf(b.parent);
    const head = heads[i]!;
    const origin: [number, number, number] = parent < 0 ? [0, 0, 0] : heads[parent]!;
    return {
      name: b.name, parent, head, tail: scaled(b.name, b.tail),
      position: [head[0] - origin[0], head[1] - origin[1], head[2] - origin[2]] as const,
    };
  });
}

export const BONE_INDEX: Readonly<Record<BoneName, number>> = Object.fromEntries(
  SPEC.bones.map((b, i) => [b.name, i]),
) as Record<BoneName, number>;

export type CharacterRig = { root: Bone; bones: Bone[]; skeleton: Skeleton; byName: Record<BoneName, Bone> };

/** Ayrık (sahneye eklenmemiş) bind iskeleti; `boneInverses` şablon uzayındadır. */
export function buildRig(character: CharacterSpec): CharacterRig {
  const defs = boneDefs(character);
  const bones = defs.map((d) => { const bone = new Bone(); bone.name = d.name; bone.position.set(...d.position); return bone; });
  defs.forEach((d, i) => { if (d.parent >= 0) bones[d.parent]!.add(bones[i]!); });
  const root = bones[0]!;
  root.updateMatrixWorld(true);
  const byName = Object.fromEntries(defs.map((d, i) => [d.name, bones[i]!])) as Record<BoneName, Bone>;
  return { root, bones, skeleton: new Skeleton(bones), byName };
}

/** Nokta → doğru parçası uzaklığı. */
function segmentDistance(x: number, y: number, z: number, a: readonly number[], b: readonly number[]): number {
  const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, dz = b[2]! - a[2]!;
  const l2 = dx * dx + dy * dy + dz * dz;
  let t = l2 === 0 ? 0 : ((x - a[0]!) * dx + (y - a[1]!) * dy + (z - a[2]!) * dz) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (a[0]! + dx * t), y - (a[1]! + dy * t), z - (a[2]! + dz * t));
}

const HEAD_ACCESSORIES = new Set(['hair-side', 'hair-side-curls', 'hair-flat', 'hair-bun', 'hair-curly', 'hair-sideburns', 'hair-tufts', 'beret', 'beanie', 'cap', 'fedora', 'glasses', 'glasses-chain', 'mustache-thick', 'mustache-thin', 'beard-full', 'earrings']);
/** §c: papyon, fular, yaka, düğmeler → spine 1,0. */
const TORSO_ACCESSORIES = new Set(['bowtie', 'scarf', 'collar', 'buttons-brass', 'buttons-cream']);
/** Baş grubunda boyunla karışım yapılan alt bant (sakal ucu, zincir). */
const NECK_BLEND_Y = .66;

const side = (id: string): 'L' | 'R' => id.endsWith('.R') ? 'R' : 'L';

/** §c bölge kuralları → 1 ya da 2 aday kemik (sırayla birincil/ikincil). */
export function boneCandidates(prim: Prim, x: number, y: number): readonly BoneName[] {
  if (prim.accessory) {
    if (TORSO_ACCESSORIES.has(prim.accessory)) return ['spine'];
    if (HEAD_ACCESSORIES.has(prim.accessory)) return y < NECK_BLEND_Y ? ['head', 'neck'] : ['head'];
    return ['spine'];
  }
  switch (prim.region) {
    case 'head': case 'ear': case 'nose': return y < NECK_BLEND_Y ? ['head', 'neck'] : ['head'];
    case 'neck': return ['neck', 'head'];
    case 'leg': return ['hips'];
    case 'upperArm': return [`shoulder.${side(prim.id)}` as BoneName, `elbow.${side(prim.id)}` as BoneName];
    case 'forearm': case 'cuff': return [`elbow.${side(prim.id)}` as BoneName];
    default: {
      if (prim.id === 'shoulders') return ['spine', x < 0 ? 'shoulder.L' : 'shoulder.R'];
      if (prim.id.startsWith('deltoid')) return ['spine', `shoulder.${side(prim.id)}` as BoneName];
      return ['hips', 'spine'];
    }
  }
}

export type SkinData = { index: Uint16Array; weight: Float32Array };

const SIGMA = SPEC.skin.sigma;

/**
 * Köşe başına en fazla 2 kemik: `w_i ∝ exp(−d_i/σ)`, σ = 12 mm, normalize.
 * İkinci kemik 3σ'dan uzaksa tek kemik 1,0 (§c).
 */
export function skinWeights(
  character: CharacterSpec,
  positions: Float32Array,
  prims: readonly Prim[],
): SkinData {
  const defs = boneDefs(character);
  const count = positions.length / 3;
  const index = new Uint16Array(count * 4);
  const weight = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    const x = positions[v * 3]!, y = positions[v * 3 + 1]!, z = positions[v * 3 + 2]!;
    const names = boneCandidates(prims[v]!, x, y);
    let i0 = BONE_INDEX[names[0]!];
    let i1 = i0, w0 = 1, w1 = 0;
    if (names.length > 1) {
      const j = BONE_INDEX[names[1]!];
      const d0 = segmentDistance(x, y, z, defs[i0]!.head, defs[i0]!.tail);
      const d1 = segmentDistance(x, y, z, defs[j]!.head, defs[j]!.tail);
      if (Math.abs(d1 - d0) <= 3 * SIGMA) {
        // Bant içinde: iki kemik σ ile karışır (boyun/omuz dikişi yumuşar).
        const e0 = Math.exp(-d0 / SIGMA), e1 = Math.exp(-d1 / SIGMA);
        w0 = e0 / (e0 + e1); w1 = 1 - w0; i1 = j;
      } else if (d1 < d0) {
        // Bant dışında ve ikinci aday belirgin yakınsa tek kemik odur.
        i0 = j; i1 = j;
      }
    }
    index[v * 4] = i0; index[v * 4 + 1] = i1;
    weight[v * 4] = w0; weight[v * 4 + 1] = w1;
  }
  return { index, weight };
}
