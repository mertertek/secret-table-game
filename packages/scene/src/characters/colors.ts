/**
 * D3 §e — bölge rengi: en yakın ilkelin bölgesi + giysi kuralları.
 * Parti renkleri (liberal/fascist) hiçbir kuralda geçmez; giysi/vurgu hex'leri
 * tasarım JSON'undan gelir.
 *
 * Tur 4: renk artık köşede KARIŞTIRILMAZ. Her bölge sembolik bir **anahtarla**
 * (`ColorKey`) adlandırılır ve iki bölgenin sınırı, üçgen çözünürlüğünden
 * bağımsız bir **işaretli uzaklık alanıyla** (`boundaryDistance`) tanımlanır.
 * Fragment shader'ı bu uzaklığın ekran uzayındaki türevinden 1 piksellik bir
 * geçiş üretir (`boundaryMaterial.ts`), böylece sınır hem keskin hem
 * kenar-yumuşatmalı olur.
 */
import { Color } from 'three';
import { SPEC } from './spec';
import type { CharacterSpec, FrontRule, OutfitSlot, OutfitSpec } from './spec';
import { boxLower } from '../sdf/primitives';
import { evalPrim } from './field';
import type { Prim } from './field';

export type Palette = {
  readonly outfit: string;
  readonly outfitDark: string;
  readonly shirt: string;
  readonly skin: string;
  readonly skinShadow: string;
  readonly leg: string;
};

/**
 * Bölge kimliği. Ya bir palet yuvası (`outfit` | `outfitDark` | `shirt` |
 * `skin` | `skinShadow` | `leg`) ya da doğrudan bir aksesuar rengi (`#rrggbb`).
 * TEN BAĞIMSIZDIR: taban geometri önbelleği (`karakter:kademe`) bütün tenlerle
 * paylaşıldığı için bölge kimliği renk DEĞERİNDEN değil yuvadan okunur.
 */
export type ColorKey = string;

/** Sınır yokken köşeye yazılan işaretli uzaklık (m) — shader'da smoothstep doyar. */
export const NO_BOUNDARY = 1;
/** İşaretli sınır uzaklığı bu değerde kırpılır (m): uzağı zaten önemsiz. */
export const BOUNDARY_LIMIT = .05;
/**
 * Sınır arayışının yarıçapı (m). `nearest` uzaklığının bu kadar ötesindeki
 * ilkeller elenir; iki bölge gerçekten komşuysa aradaki fark bundan küçüktür.
 */
export const BOUNDARY_SEARCH = 2 * BOUNDARY_LIMIT;

/**
 * §e ince şerit alt sınırı (m). Köşe aralığı 24,5 mm olduğu için bundan dar
 * bir şerit hiçbir köşeye düşmez ve işaretli uzaklık alanında temsil edilemez
 * (shader onu tamamen yutar). Yaka bandı/manşet en az 12 mm.
 */
export const MIN_BAND = .012;

const dark = new Color();
/** `outfitDark` = giysi renginin %12 düşük parlaklığı (§e). */
export function darken(hex: string, factor = .88): string {
  dark.set(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  dark.getHSL(hsl);
  dark.setHSL(hsl.h, hsl.s, hsl.l * factor);
  return `#${dark.getHexString()}`;
}

export function palette(character: CharacterSpec, skin: { base: string; shadow: string }): Palette {
  const outfit = SPEC.outfits[character.outfit];
  return {
    outfit: character.outfitColor,
    outfitDark: darken(character.outfitColor),
    shirt: outfit.shirt ?? '#eee1c7',
    skin: skin.base,
    skinShadow: skin.shadow,
    leg: SPEC.legColor,
  };
}

/** Sembolik bölge anahtarı → gerçek renk. */
export function colorFromKey(key: ColorKey, p: Palette, out = new Color()): Color {
  switch (key) {
    case 'outfit': return out.set(p.outfit);
    case 'outfitDark': return out.set(p.outfitDark);
    case 'shirt': return out.set(p.shirt);
    case 'skin': return out.set(p.skin);
    case 'skinShadow': return out.set(p.skinShadow);
    case 'leg': return out.set(p.leg);
    default: return out.set(key);        // aksesuar rengi ('#rrggbb')
  }
}

/**
 * §e "shoulders/deltoid" sütunu omuz KAPAKLARINI anlatır. `shoulders` kapsülü
 * göğsün tamamını (x ±0,19) kestiği için yelekte üst göğse krem bir bant
 * boyuyor ve `chest` ile yarışıp yırtık bir sınır üretiyordu; bu yüzden yalnız
 * deltoidler omuz yuvasına, `shoulders` gövdeye (V yaka kuralına) bağlanır.
 */
const SHOULDER_IDS = new Set(['deltoid.L', 'deltoid.R']);

/**
 * §e ön bölge kuralının "içeridelik" değeri (m, + = kuralın bölgesinde).
 * Tur 3'teki karışım bandı (`FEATHER`) KALDIRILDI: değer artık işaretli bir
 * uzaklıktır, yumuşatmayı shader yapar. `z < −0,05` kapısı da ayrı bir dal
 * değil, uzaklığın bir terimidir — böylece gövdenin yanındaki dikey sınır da
 * kenar-yumuşatmalı olur.
 */
function ruleInside(rule: FrontRule, x: number, y: number, z: number): number {
  const y0 = rule.y[0]!, y1 = rule.y[1]!;
  const ax = Math.abs(x);
  let inside: number;
  if (rule.shape === 'strip') inside = Math.min(rule.halfWidth! - ax, y - y0, y1 - y);
  else {
    const at = rule.halfWidthAt!;
    const half = at[0]! + (at[1]! - at[0]!) * Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    // V yaka YUKARI AÇIKTIR: y1 üstü hâlâ gömlektir (§e "V kenarı yeleğin üst
    // sınırıdır"). Orta şerit ise kendi y aralığında kalır.
    const band = Math.max(rule.band ?? 0, MIN_BAND);
    inside = rule.shape === 'V' ? half - ax : Math.min(ax - half, half + band - ax);
    inside = Math.min(inside, y - y0);
  }
  return Math.min(inside, -.05 - z);
}

/** §e ön bölgede kazanan yuva (kural yoksa taban gövde yuvası). */
function frontWinner(outfit: OutfitSpec, x: number, y: number, z: number): OutfitSlot {
  let best: OutfitSlot = outfit.torso, top = 0;
  for (const rule of outfit.front) {
    const inside = ruleInside(rule, x, y, z);
    if (inside > top) { top = inside; best = rule.color; }
  }
  return best;
}

/**
 * Bir ön bölge yuvasının işaretli "içeridelik" skoru (m). Taban gövde
 * yuvasının skoru bütün kuralların en büyük içeridelik değerinin negatifidir
 * (taban bölge, kuralların tümleyenidir). İki yuvanın skor FARKININ YARISI
 * aralarındaki sınıra olan işaretli uzaklıktır.
 */
export function frontScore(outfit: OutfitSpec, slot: ColorKey, x: number, y: number, z: number): number {
  if (!outfit.front.length) return NaN;
  let maxInside = -Infinity, own = -Infinity;
  for (const rule of outfit.front) {
    const inside = ruleInside(rule, x, y, z);
    if (inside > maxInside) maxInside = inside;
    if (rule.color === slot && inside > own) own = inside;
  }
  if (own > -Infinity) return own;
  return slot === outfit.torso ? -maxInside : NaN;
}

/** §e boyun halkası: halkanın altı giysi, üstü ten gölgesi. */
export function neckScore(outfit: OutfitSpec, key: ColorKey, y: number): number {
  if (outfit.neckRing === null) return NaN;
  if (key === 'outfit') return outfit.neckRing - y;
  if (key === 'skinShadow') return y - outfit.neckRing;
  return NaN;
}

/** Bir ilkelin BU noktadaki bölge anahtarı (§e kuralları dahil). */
export function primColorKey(prim: Prim, x: number, y: number, z: number, character: CharacterSpec): ColorKey {
  if (prim.color) return prim.color;
  const outfit = SPEC.outfits[character.outfit];
  switch (prim.region) {
    case 'head': return 'skin';
    case 'nose': case 'ear': return 'skinShadow';
    case 'neck': return outfit.neckRing !== null && y < outfit.neckRing ? 'outfit' : 'skinShadow';
    case 'leg': return 'leg';
    case 'upperArm': return outfit.upperArm;
    case 'forearm': return outfit.forearm;
    case 'cuff': return outfit.cuff ?? 'outfit';
    case 'torso': return SHOULDER_IDS.has(prim.id) ? outfit.shoulders : frontWinner(outfit, x, y, z);
    default: return 'skin';
  }
}

/** Köşe rengi (§e). Karışım YOK: tek bölgenin düz rengi. */
export function vertexColor(prim: Prim, x: number, y: number, z: number, character: CharacterSpec, p: Palette, out = new Color()): Color {
  return colorFromKey(primColorKey(prim, x, y, z, character), p, out);
}

/** Sınırın hangi alandan okunduğu. `none` = sınır yok. */
export type BoundaryMech = 'none' | 'prim' | 'front' | 'neck';

/**
 * İki bölge arasındaki işaretli sınır uzaklığı (m, pozitif = `keyA` tarafı).
 *
 * - `prim`: iki bölgenin ilkelleri arasındaki Voronoi sınırı,
 *   `(dB − dA) / 2`; `dA`/`dB` çağıranın köşe başına bir kez ölçtüğü bölge
 *   uzaklıklarıdır (bkz. `primDistances`), bölge yoksa `Infinity`.
 * - `front`: §e ön bölge kurallarının skor farkı.
 * - `neck`: boyun halkası y eşiği.
 *
 * Ölçek bir sabit çarpanına kadar önemsizdir (shader `fwidth` ile ölçekle
 * birlikte büyüyen bir eşik kullanır); ÖNEMLİ OLAN İŞARET ve sıfır düzeyidir.
 */
export function boundaryDistance(
  mech: BoundaryMech, keyA: ColorKey, keyB: ColorKey,
  outfit: OutfitSpec, x: number, y: number, z: number,
  dA = Infinity, dB = Infinity,
): number {
  let value: number;
  if (mech === 'none') return NO_BOUNDARY;
  if (mech === 'prim') {
    // İki bölge de bu noktada temsil edilmiyorsa bu mekanizma TANIMSIZDIR (NaN);
    // çağıran başka bir mekanizmaya düşer.
    if (!Number.isFinite(dA) && !Number.isFinite(dB)) return NaN;
    if (!Number.isFinite(dA)) return -BOUNDARY_LIMIT;
    if (!Number.isFinite(dB)) return BOUNDARY_LIMIT;
    value = (dB - dA) / 2;
  } else if (mech === 'front') {
    value = (frontScore(outfit, keyA, x, y, z) - frontScore(outfit, keyB, x, y, z)) / 2;
  } else {
    value = (neckScore(outfit, keyA, y) - neckScore(outfit, keyB, y)) / 2;
  }
  if (!Number.isFinite(value)) return NaN;
  return Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, value));
}

/**
 * `p` noktasında her bölgenin en yakın ilkeline olan uzaklık. `out` bir
 * `Map` değil, çağıranın ayırdığı `Float64Array`'dir (köşe başına 7 k çağrı):
 * `keyIndex` bölge anahtarını sabit bir sütuna eşler, bulunmayan bölgeler
 * `Infinity` kalır. `cap` (en yakın uzaklık + `BOUNDARY_SEARCH`) ötesindeki
 * ilkeller AABB ile elenir.
 */
export function primDistances(
  prims: readonly Prim[], eligible: Uint8Array,
  keyIndex: ReadonlyMap<ColorKey, number>, character: CharacterSpec,
  x: number, y: number, z: number, cap: number, out: Float64Array,
): void {
  out.fill(Infinity);
  for (let i = 0; i < prims.length; i++) {
    if (!eligible[i]) continue;
    const p = prims[i]!;
    if (boxLower(x, y, z, p.aabb) > cap) continue;
    const d = evalPrim(p, x, y, z);
    if (d > cap) continue;
    const slot = keyIndex.get(primColorKey(p, x, y, z, character));
    if (slot === undefined) continue;
    if (d < out[slot]!) out[slot] = d;
  }
}
