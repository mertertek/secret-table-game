/**
 * D16 — dairesel jest menüsü (çark) — SAF katman.
 *
 * Kullanıcı kararı (2026-09-12): alt şeritte çip sırası yerine `G` ile açılan,
 * ekranın ortasında 8 dilimli çark. Burada DOM/React yoktur: dilim geometrisi,
 * işaretçi → dilim çözümü, basılı tutma kuralı ve ölçek. `useEmoteWheel` ve
 * `EmoteWheel` bunu tüketir; testler buraya bakar.
 */
import { EMOTE_KINDS, type EmoteKind } from '@secret-table/contracts';

/** Dilim sayısı = jest sayısı (tasarım §2 sırası). */
export const EMOTE_SLOTS = EMOTE_KINDS.length;
/** `G` bu süreden uzun basılı tutulursa bırakınca vurgulu dilim seçilir. */
export const EMOTE_HOLD_MS = 250;
/** Merkeze bu kadar yakın işaretçi dilim seçmez (kazara seçim yok). */
export const EMOTE_DEADZONE = 26;
/** Pointer Lock'ta fare deltası bu yarıçapta gezer. */
export const EMOTE_POINTER_RADIUS = 130;
/** Çark en küçük çapı (telefon dikey). */
export const EMOTE_WHEEL_MIN = 260;
export const EMOTE_WHEEL_MAX = 420;

/** Yuva sırası → jest (sıra dışıysa `null`). */
export function emoteForSlot(slot: number): EmoteKind | null {
  return Number.isInteger(slot) && slot >= 0 && slot < EMOTE_SLOTS ? EMOTE_KINDS[slot]! : null;
}

/**
 * İşaretçi vektöründen dilim sırası. 0 = yukarı, saat yönünde artar; ölü
 * bölgede `null` (vurgu değişmez).
 */
export function sliceAt(dx: number, dy: number, deadzone = EMOTE_DEADZONE, count = EMOTE_SLOTS): number | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.hypot(dx, dy) < deadzone) return null;
  const turn = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1;
  return Math.round(turn * count) % count;
}

/** Ok tuşları / WASD: bir dilim ilerle (vurgu yoksa ilk/son dilim). */
export function stepSlice(index: number | null, dir: -1 | 1, count = EMOTE_SLOTS): number {
  if (index === null || !Number.isInteger(index)) return dir === 1 ? 0 : count - 1;
  return (index + dir + count) % count;
}

/** Basılı tutma bırakıldığında seçim olur mu (kısa basış menüyü açık bırakır). */
export function holdSelects(pressedAt: number, releasedAt: number, holdMs = EMOTE_HOLD_MS): boolean {
  return releasedAt - pressedAt >= holdMs;
}

/** Dilim merkezinin birim yönü (çizim + klavye gezinme göstergesi). */
export function sliceVector(index: number, count = EMOTE_SLOTS): { x: number; y: number } {
  const angle = (index / count) * Math.PI * 2;
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

/** Pointer Lock birikimini çark yarıçapına kırpar. */
export function clampPointer(x: number, y: number, radius = EMOTE_POINTER_RADIUS): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= radius) return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
  return { x: (x / length) * radius, y: (y / length) * radius };
}

/** Çark çapı (px): ekranın kısa kenarına göre, 260–420 arası. */
export function wheelSize(width: number, height: number): number {
  const short = Math.min(Math.max(0, width), Math.max(0, height));
  return Math.round(Math.max(EMOTE_WHEEL_MIN, Math.min(EMOTE_WHEEL_MAX, short * .78)));
}

/** Bir dilimin SVG yol verisi (halka dilimi). */
export function slicePath(index: number, outer: number, inner: number, count = EMOTE_SLOTS): string {
  const half = Math.PI / count;
  const center = (index / count) * Math.PI * 2;
  const a0 = center - half + .012, a1 = center + half - .012;
  const p = (angle: number, r: number) => `${(Math.sin(angle) * r).toFixed(2)} ${(-Math.cos(angle) * r).toFixed(2)}`;
  return `M ${p(a0, inner)} A ${inner} ${inner} 0 0 1 ${p(a1, inner)} L ${p(a1, outer)} A ${outer} ${outer} 0 0 0 ${p(a0, outer)} Z`;
}
