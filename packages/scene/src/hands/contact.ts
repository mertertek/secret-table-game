/**
 * D1 §e — çalışma zamanı iç içe geçme önleme. Kart düzlemi el çerçevesine göre
 * sabittir (el kartı taşır); parmak kapsülleri kart dikdörtgeninin içinde kalan
 * örnek noktalarda `|d| − r − h ≥ 0.002` şartını sağlamazsa MCP/PIP fleksiyonu
 * 0.02 rad adımlarla (en çok 0.25 rad) açılır, DIP bağlaşımı korunur.
 */
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { BONES, FINGERS } from './anatomy';
import type { BoneName } from './anatomy';
import { DIP_COUPLING, clampBone } from './poses';
import type { CardFrame, Pose } from './poses';
import { boneSegments, forwardKinematics } from './skeleton';

/** Falanks başına örnek nokta sayısı (§e-2). */
export const SAMPLES = 8;
export const CLEARANCE = .002;
const STEP = .02, MAX_RELIEF = .25, THUMB_STEP = .05;

const SEGMENTS = boneSegments();
const CHAIN: Readonly<Record<string, readonly BoneName[]>> = {
  thumb: ['thumb.cmc', 'thumb.mcp', 'thumb.ip'],
  ...Object.fromEntries(FINGERS.map((f) => [f, [`${f}.mcp`, `${f}.pip`, `${f}.dip`] as BoneName[]])),
};

export type ContactSample = { chain: string; gap: number; inside: boolean };

const scratch = { p: new Vector3(), q: new Quaternion(), e: new Euler(), inverse: new Matrix4() };

/** Kart çerçevesinin el uzayındaki tersi — örnek noktaları kart uzayına taşır. */
export function cardInverse(frame: CardFrame, out = new Matrix4()): Matrix4 {
  scratch.e.set(frame.euler[0], frame.euler[1], frame.euler[2], 'XYZ');
  scratch.q.setFromEuler(scratch.e);
  scratch.p.set(frame.C[0], frame.C[1], frame.C[2]);
  return out.compose(scratch.p, scratch.q, new Vector3(1, 1, 1)).invert();
}

/** Bir poz için bütün falanks örneklerinin kart yüzeyine boşluğu. */
export function sampleContacts(pose: Pose, frame: CardFrame, matrices = forwardKinematics(pose)): ContactSample[] {
  const inverse = cardInverse(frame, scratch.inverse);
  const out: ContactSample[] = [];
  const point = new Vector3();
  for (let b = 1; b < BONES.length; b++) {
    const segment = SEGMENTS[b]!;
    const chain = BONES[b]!.split('.')[0]!;
    const length = Math.hypot(segment.b[0] - segment.a[0], segment.b[1] - segment.a[1], segment.b[2] - segment.a[2]);
    for (let s = 0; s < SAMPLES; s++) {
      const t = (s + .5) / SAMPLES;
      const radius = segment.ra + (segment.rb - segment.ra) * t;
      point.set(0, 0, -length * t).applyMatrix4(matrices[b]!).applyMatrix4(inverse);
      const inside = Math.abs(point.x) <= frame.halfWidth && Math.abs(point.z) <= frame.halfHeight;
      out.push({ chain, gap: Math.abs(point.y) - radius - frame.halfThickness, inside });
    }
  }
  return out;
}

/** Kart sınırı içindeki en küçük boşluk (negatif = kesişme). */
export const worstGap = (samples: readonly ContactSample[], chain?: string): number =>
  samples.reduce((m, s) => s.inside && (!chain || s.chain === chain) ? Math.min(m, s.gap) : m, Infinity);

const relax = (pose: Pose, chain: string, relief: number, thumbRelief: number): Pose => {
  const next: Record<string, number[]> = {};
  for (const bone of BONES) next[bone] = [...(pose[bone] ?? [])];
  if (chain === 'thumb') {
    next['thumb.ip']![0] = Math.max(0, (next['thumb.ip']![0] ?? 0) - relief);
    next['thumb.cmc']![0] = (next['thumb.cmc']![0] ?? 0) + thumbRelief;
  } else {
    const mcp = next[`${chain}.mcp`]!, pip = next[`${chain}.pip`]!, dip = next[`${chain}.dip`]!;
    mcp[0] = Math.max(0, (mcp[0] ?? 0) - relief);
    pip[0] = Math.max(0, (pip[0] ?? 0) - relief);
    dip[0] = pip[0] * DIP_COUPLING;
  }
  for (const bone of BONES) next[bone] = clampBone(bone, next[bone]!);
  return next as unknown as Pose;
};

export type Resolved = { pose: Pose; penetrations: number; relieved: number };

/** §e-2/§e-4: ihlal eden zincirleri kademeli açarak pozu düzeltir. */
export function resolveContact(pose: Pose, frame: CardFrame | undefined): Resolved {
  if (!frame) return { pose, penetrations: 0, relieved: 0 };
  let current = pose, relieved = 0;
  for (const chain of Object.keys(CHAIN)) {
    let relief = 0, thumbRelief = 0, candidate = current;
    for (let step = 0; step <= Math.round(MAX_RELIEF / STEP); step++) {
      if (worstGap(sampleContacts(candidate, frame), chain) >= CLEARANCE) break;
      relief = Math.min(MAX_RELIEF, relief + STEP);
      if (chain === 'thumb' && relief > MAX_RELIEF / 2) thumbRelief = Math.min(MAX_RELIEF, thumbRelief + THUMB_STEP);
      candidate = relax(current, chain, relief, thumbRelief);
    }
    if (relief > 0) relieved++;
    current = candidate;
  }
  const remaining = sampleContacts(current, frame).filter((s) => s.inside && s.gap < 0).length;
  return { pose: current, penetrations: remaining, relieved };
}
