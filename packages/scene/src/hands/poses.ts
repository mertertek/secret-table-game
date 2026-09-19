/**
 * D1 §d — poz seti. Sayılar `docs/design/d1/poses.json`'dan OKUNUR; burada
 * kopyalanmaz. JSON tasarım belgesinin parçasıdır ve değiştirilmez.
 */
import data from '../../../../docs/design/d1/poses.json';
import { BONES } from './anatomy';
import type { BoneName } from './anatomy';

/** D16: son dört tutuş el jestleri içindir (kart/nesne taşımaz). */
export type GripName = 'rest' | 'holdFan3' | 'holdFan2' | 'holdFan1' | 'pinchCard' | 'openPlace' | 'holdBallot' | 'holdEnvelope' | 'restTable' | 'holdGun'
  | 'point' | 'openPalm' | 'thumbUp' | 'middleFinger';
export const GRIPS: readonly GripName[] = ['rest', 'holdFan3', 'holdFan2', 'holdFan1', 'pinchCard', 'openPlace', 'holdBallot', 'holdEnvelope', 'restTable', 'holdGun',
  'point', 'openPalm', 'thumbUp', 'middleFinger'];
/** D12 — kart TAŞIMAYAN tutuşlar: çerçeveleri `PROP_FRAMES`e gider, kart çizilmez. */
export const PROP_GRIPS: readonly GripName[] = ['holdGun'];
/** D16 — jest tutuşları: kart çerçevesi YOK, temas çözümü aranmaz. */
export const EMOTE_GRIPS: readonly GripName[] = ['point', 'openPalm', 'thumbUp', 'middleFinger'];

/** Kemik başına açı listesi: parmak MCP [flex, abd], diğerleri [flex], wrist [0,0,0]. */
export type Pose = Readonly<Record<BoneName, readonly number[]>>;
export type CardFrame = { C: readonly [number, number, number]; euler: readonly [number, number, number]; halfThickness: number; halfWidth: number; halfHeight: number };

const raw = data as unknown as {
  thumbBase: { cmc_t: number[]; euler: number[] };
  limits: Record<string, number[] | number[][]>;
  bones: string[];
  poses: Record<string, Record<string, number[]>>;
  cards: Record<string, { C: number[]; euler: number[]; halfThickness: number; halfWidth: number; halfHeight: number }>;
  contacts: Record<string, Record<string, { card_xz: number[]; side: string; skinGap_mm: number }>>;
};

if (raw.bones.join() !== BONES.join()) throw new Error('D1: poses.json kemik sırası anatomy.BONES ile uyuşmuyor');

const limit = (key: string): readonly [number, number] => {
  const v = raw.limits[key] as number[]; return [v[0]!, v[1]!];
};
export const LIMITS = {
  mcpFlex: limit('finger.mcp.flex'), mcpAbd: limit('finger.mcp.abd'),
  pipFlex: limit('finger.pip.flex'), dipFlex: limit('finger.dip.flex'),
  thumbCmc: (raw.limits['thumb.cmc'] as number[][]).map((v) => [v[0]!, v[1]!] as const),
  thumbMcp: limit('thumb.mcp.flex'), thumbIp: limit('thumb.ip.flex'),
} as const;
/** DIP serbest değilse PIP'e bağlanır (§c). */
export const DIP_COUPLING = .70;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));

/** Bir kemiğin açılarını §c sınırlarına kırpar. */
export function clampBone(bone: BoneName, values: readonly number[]): number[] {
  if (bone === 'wrist') return [0, 0, 0];
  if (bone === 'thumb.cmc') return LIMITS.thumbCmc.map((l, i) => clamp(values[i] ?? 0, l[0], l[1]));
  if (bone === 'thumb.mcp') return [clamp(values[0] ?? 0, LIMITS.thumbMcp[0], LIMITS.thumbMcp[1])];
  if (bone === 'thumb.ip') return [clamp(values[0] ?? 0, LIMITS.thumbIp[0], LIMITS.thumbIp[1])];
  if (bone.endsWith('.mcp')) return [clamp(values[0] ?? 0, LIMITS.mcpFlex[0], LIMITS.mcpFlex[1]), clamp(values[1] ?? 0, LIMITS.mcpAbd[0], LIMITS.mcpAbd[1])];
  if (bone.endsWith('.pip')) return [clamp(values[0] ?? 0, LIMITS.pipFlex[0], LIMITS.pipFlex[1])];
  return [clamp(values[0] ?? 0, LIMITS.dipFlex[0], LIMITS.dipFlex[1])];
}

export function clampPose(pose: Pose): Pose {
  const out: Record<string, number[]> = {};
  for (const bone of BONES) out[bone] = clampBone(bone, pose[bone] ?? []);
  return out as unknown as Pose;
}

export const POSES: Readonly<Record<GripName, Pose>> = Object.fromEntries(
  GRIPS.map((name) => [name, clampPose(raw.poses[name] as unknown as Pose)]),
) as Readonly<Record<GripName, Pose>>;

const frames = (pick: (name: string) => boolean): Readonly<Partial<Record<GripName, CardFrame>>> => Object.fromEntries(
  Object.entries(raw.cards).filter(([k]) => pick(k)).map(([k, v]) => [k, {
    C: [v.C[0]!, v.C[1]!, v.C[2]!] as const, euler: [v.euler[0]!, v.euler[1]!, v.euler[2]!] as const,
    halfThickness: v.halfThickness, halfWidth: v.halfWidth, halfHeight: v.halfHeight,
  }]),
);

/** Kart/zarf paketinin el şablon uzayındaki çerçevesi (§e). */
export const CARD_FRAMES = frames((name) => !PROP_GRIPS.includes(name as GripName));

/**
 * D12 — kart olmayan nesnelerin (silah) el şablon uzayındaki çerçevesi. AYRI
 * tutulur: temas çözümü (`resolveContact`) ve kart çizimi yalnız `CARD_FRAMES`
 * üzerinden yürür, `holdGun`da kart/kutu teması aranmaz.
 */
export const PROP_FRAMES = frames((name) => PROP_GRIPS.includes(name as GripName));

/** Şartname §e temas noktaları — testler bu tabloya karşı ölçer. */
export const CONTACTS = raw.contacts;

/** İki pozun doğrusal karışımı; baş parmak Euler bileşenleri ayrı ayrı karışır. */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const p = clamp(t, 0, 1);
  const out: Record<string, number[]> = {};
  for (const bone of BONES) {
    const va = a[bone] ?? [], vb = b[bone] ?? [];
    const n = Math.max(va.length, vb.length);
    const values: number[] = [];
    for (let i = 0; i < n; i++) { const x = va[i] ?? 0, y = vb[i] ?? 0; values.push(x + (y - x) * p); }
    out[bone] = values;
  }
  return out as unknown as Pose;
}

export const posePairs = (pose: Pose): [BoneName, readonly number[]][] => BONES.map((b) => [b, pose[b] ?? []]);

/** Geometrinin üretildiği poz: bütün açılar 0 (baş parmak taban çerçevesi kemikte). */
export const BIND_POSE: Pose = Object.fromEntries(BONES.map((b) => [b, [0, 0, 0]])) as unknown as Pose;
