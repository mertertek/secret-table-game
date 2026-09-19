/**
 * D3 §b–§f — `docs/design/d3/characters.json` tip güvenli içe aktarımı.
 *
 * JSON tasarım belgesinin (`docs/design/D3-characters.md`) makine okunur ikizidir
 * ve TASARIM SAHİPLİĞİNDEDİR: burada sayı türetilmez, yalnız okunur. Kod tarafında
 * tek yaptığımız şeması doğrulanmış tiplere bağlamaktır.
 */
import { AVATAR_SKIN_IDS, avatarForSeat } from '@secret-table/contracts';
import type { AvatarSelection, AvatarSkinId } from '@secret-table/contracts';
import spec from '../../../../docs/design/d3/characters.json';

export type V3 = readonly [number, number, number];
export type Region = 'torso' | 'neck' | 'head' | 'nose' | 'ear' | 'upperArm' | 'forearm' | 'cuff' | 'leg' | 'hair' | 'hat' | 'facial' | 'acc';

export type PrimSpec = {
  readonly id: string;
  readonly type: 'sphere' | 'ellipsoid' | 'capsule' | 'roundedBox' | 'torus';
  readonly c?: readonly number[];
  readonly r?: number | readonly number[];
  readonly a?: readonly number[];
  readonly b?: readonly number[];
  readonly r0?: number;
  readonly r1?: number;
  readonly half?: readonly number[];
  readonly corner?: number;
  readonly axis?: 'x' | 'y' | 'z';
  readonly R?: number;
  readonly rot?: readonly number[];
  readonly k: number;
  readonly region: Region;
  readonly target?: string;
};

export type ClipSpec = { readonly point: readonly number[]; readonly normal: readonly number[]; readonly k: number };

export type AccessorySpec = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  /** `standard`: yalnız standard kademede üretilir (zincir, küpe, düğmeler). */
  readonly tier: 'low' | 'standard';
  readonly labelLift: number;
  readonly mouthOffset: number;
  readonly primitives: readonly PrimSpec[];
  readonly clip?: ClipSpec;
  readonly subtract?: PrimSpec;
  readonly colors?: Readonly<Record<string, string>>;
};

export type OutfitSlot = 'outfit' | 'outfitDark' | 'shirt' | 'skin';
export type FrontRule = {
  readonly shape: 'V' | 'Vband' | 'strip';
  readonly color: OutfitSlot;
  readonly y: readonly number[];
  readonly halfWidthAt?: readonly number[];
  readonly halfWidth?: number;
  readonly band?: number;
};
export type OutfitSpec = {
  readonly name: string;
  readonly torso: OutfitSlot;
  readonly shoulders: OutfitSlot;
  readonly upperArm: OutfitSlot;
  readonly forearm: OutfitSlot;
  readonly cuff: OutfitSlot | null;
  readonly neckRing: number | null;
  readonly front: readonly FrontRule[];
  readonly shirt: string | null;
  readonly buttons: string | null;
};

export type FaceSpec = {
  readonly brows: { readonly color: string; readonly weight: number; readonly asym: number };
  readonly cheeks: { readonly color: string; readonly alphaScale: number };
  readonly freckles: boolean;
  readonly mouthStyle: 'default' | 'grin';
  readonly defaultExpression: ExpressionName;
};

export type CharacterSpec = {
  readonly id: string;
  readonly name: string;
  readonly accessories: readonly { readonly id: string; readonly color?: string; readonly colors?: Readonly<Record<string, string>> }[];
  readonly bodyScale: { readonly belly: number; readonly shoulders: number; readonly head: number };
  readonly accent: string;
  readonly outfit: keyof typeof SPEC.outfits;
  readonly outfitColor: string;
  readonly skins: readonly string[];
  readonly face: FaceSpec;
  readonly tagline: string;
};

export type BoneSpec = {
  readonly name: BoneName;
  readonly parent: BoneName | null;
  readonly head: readonly number[];
  readonly tail: readonly number[];
  readonly headChannel?: number;
};

/** D12 §7: `ko` infazdan sonraki kalıcı ifade (X gözler, sarkık dil). */
export type ExpressionName = 'neutral' | 'smile' | 'surprised' | 'grumpy' | 'ko';
/** D12 §7 — göz çizimi: normal (bebek + parlaklık) ya da X. */
export type EyeSpec = { readonly type: 'x'; readonly weight: number; readonly span: number };
export type MouthSpec =
  | { readonly type: 'arc'; readonly p: readonly (readonly number[])[]; readonly lowerLip?: { readonly c: readonly number[]; readonly rx: number; readonly ry: number; readonly alpha: number } }
  | { readonly type: 'o'; readonly c: readonly number[]; readonly rx: number; readonly ry: number; readonly tongue?: { readonly c: readonly number[]; readonly r: number; readonly color: string } }
  | { readonly type: 'grin'; readonly p: readonly (readonly number[])[] };
export type ExpressionSpec = {
  readonly brow: readonly (readonly number[])[];
  readonly eyes?: EyeSpec;
  readonly eyeScale: number;
  readonly pupilDy: number;
  readonly pupilR?: number;
  readonly lid: number;
  readonly cheekAlpha: number;
  readonly cheekR: number;
  readonly mouth: MouthSpec;
};

export type SpecFile = {
  readonly version: string;
  readonly frame: { readonly seatTopWorldY: number; readonly seatGroupOffset: readonly number[]; readonly tableSurfaceLocalY: number };
  readonly sittingHeight: number;
  readonly head: { readonly c: readonly number[]; readonly r: readonly number[]; readonly eyeY: number };
  readonly wrist: { readonly L: readonly number[]; readonly R: readonly number[]; readonly publicArmsHandX: number; readonly handScale: number; readonly wristRadius: number };
  readonly base: {
    readonly box: { readonly min: readonly number[]; readonly max: readonly number[] };
    readonly voxel: { readonly standard: number; readonly low: number };
    readonly primitives: readonly PrimSpec[];
  };
  readonly bones: readonly BoneSpec[];
  readonly skin: { readonly nearest: number; readonly sigma: number; readonly headChannel: { readonly neck: number; readonly head: number; readonly yawMax: number; readonly pitchMax: number } };
  readonly accessories: Readonly<Record<string, AccessorySpec>>;
  readonly outfits: Readonly<Record<'vest' | 'sweater' | 'jacket' | 'cardigan' | 'tshirt', OutfitSpec>>;
  readonly legColor: string;
  readonly skins: readonly { readonly id: string; readonly base: string; readonly shadow: string }[];
  readonly characters: readonly CharacterSpec[];
  readonly faces: {
    readonly canvas: { readonly w: number; readonly h: number };
    readonly window: { readonly x: readonly number[]; readonly y: readonly number[] };
    readonly membership: { readonly normalZmax: number };
    readonly features_mm: {
      readonly eye: { readonly c: readonly number[]; readonly rx: number; readonly ry: number; readonly pupil: { readonly dy: number; readonly r: number }; readonly highlight: { readonly d: readonly number[]; readonly r: number }; readonly highlight2: { readonly d: readonly number[]; readonly r: number }; readonly white: string; readonly ink: string };
      readonly browWidth: number;
      readonly cheek: { readonly c: readonly number[]; readonly r: number; readonly rxScale: number };
      readonly mouthWidth: number;
      readonly freckles: readonly (readonly number[])[];
      readonly freckle: { readonly r: number; readonly color: string; readonly alpha: number };
      readonly teeth: { readonly rect: readonly number[]; readonly gap: readonly number[]; readonly color: string };
      readonly lensHighlight: { readonly r: number; readonly color: string; readonly alpha: number };
    };
    readonly expressions: Readonly<Record<ExpressionName, ExpressionSpec>>;
    readonly grinMouth: { readonly p: readonly (readonly number[])[] };
    readonly blink: { readonly downMs: number; readonly upMs: number; readonly intervalS: readonly number[] };
  };
  readonly budget: { readonly tiers: Readonly<Record<'standard' | 'low', { readonly voxel: number; readonly triangles: number; readonly castShadow: boolean; readonly faceCanvas: readonly number[] }>>; readonly generationMs: number };
  readonly camera: { readonly seatPrivate: { readonly now: number }; readonly seatFree: { readonly now: number } };
  readonly label: { readonly baseWorldY: number; readonly gap: number; readonly perCharacter: Readonly<Record<string, number>> };
};

export const SPEC = spec as unknown as SpecFile;

export type BoneName = 'hips' | 'spine' | 'neck' | 'head' | 'shoulder.L' | 'shoulder.R' | 'elbow.L' | 'elbow.R';
export const BONE_NAMES: readonly BoneName[] = SPEC.bones.map((b) => b.name);

export type Tier = 'standard' | 'low';
/** D3.4: ten kimliği artık sözleşmede yaşıyor (sunucu da doğruluyor). */
export type SkinId = AvatarSkinId;

export const CHARACTERS = SPEC.characters;
export const CHARACTER_IDS: readonly string[] = CHARACTERS.map((c) => c.id);
export const SKIN_IDS: readonly SkinId[] = SPEC.skins.map((s) => s.id as SkinId);

export function characterSpec(id: string): CharacterSpec {
  const found = CHARACTERS.find((c) => c.id === id);
  if (!found) throw new Error(`D3: bilinmeyen karakter "${id}"`);
  return found;
}

export function skinTones(id: SkinId): { base: string; shadow: string } {
  const found = SPEC.skins.find((s) => s.id === id);
  if (!found) throw new Error(`D3: bilinmeyen ten "${id}"`);
  return { base: found.base, shadow: found.shadow };
}

/**
 * D3.4: koltuk varsayılanı artık `@secret-table/contracts` içindedir (sunucu ve
 * sahne AYNI türetmeyi kullanmalı). Burada yalnız yeniden dışa verilir; sahne
 * kodu artık her koltuğu `PlayerView.avatar`dan okur, bu işlev fixture ve
 * yedek (avatar alanı olmayan eski görünüm) yoludur.
 */
export { avatarForSeat };
export type { AvatarSelection };

/**
 * `"bereli-teyze:1"` / `"bereli-teyze"` biçimli seçim dizgisini çözer. D3.4'ten
 * sonra ağ yolu `PlayerView.avatar` nesnesidir; bu yalnız dev sayfası / URL
 * parametresi gibi dizgi girişleri içindir.
 */
export function parseAvatar(value: string | undefined, seatIndex: number): AvatarSelection {
  if (!value) return avatarForSeat(seatIndex);
  const [id, tone] = value.split(':');
  if (!id || !CHARACTER_IDS.includes(id)) return avatarForSeat(seatIndex);
  const index = Number(tone);
  const skin = Number.isInteger(index) && index >= 0 && index < AVATAR_SKIN_IDS.length
    ? AVATAR_SKIN_IDS[index]!
    : avatarForSeat(seatIndex).skin;
  return { character: id as AvatarSelection['character'], skin };
}

/**
 * Tur 2 düzeltmesi: KEP 30 mm yükseltildi. §d'de kubbe kesme düzlemi y 0,86;
 * bu, kaş bandının (y 0,858–0,872) tam üstüne denk geliyor ve kaşları örtüyordu.
 * Aksesuarın bütün ilkelleri ve kesme düzlemi birlikte taşınır, etiket yüksekliği
 * de aynı kadar artar. Tasarım JSON'u değişmedi (`docs/design/**` salt okunur).
 */
export const ACCESSORY_LIFT: Readonly<Record<string, number>> = { cap: .03 };

/** §e etiket tablosu: baş/şapka tepesi + 0,05 (dünya y) + tur 2 yükseltmeleri. */
export function labelHeight(character: string): number {
  const base = SPEC.label.perCharacter[character] ?? SPEC.label.baseWorldY;
  const spec = CHARACTERS.find((c) => c.id === character);
  const lift = spec ? Math.max(0, ...spec.accessories.map((a) => ACCESSORY_LIFT[a.id] ?? 0)) : 0;
  return base + lift;
}

/** §f ağız kayması: bıyık/sakal ağzı aşağı iter (m). */
export function mouthOffset(character: CharacterSpec): number {
  let offset = 0;
  for (const entry of character.accessories) {
    const acc = SPEC.accessories[entry.id];
    if (acc) offset += acc.mouthOffset;
  }
  return offset;
}

export function hasAccessory(character: CharacterSpec, id: string): boolean {
  return character.accessories.some((a) => a.id === id);
}
