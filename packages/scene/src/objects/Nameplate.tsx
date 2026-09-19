/**
 * D6 — baş üstü isim etiketi (`docs/design/D6-nameplate.md`).
 *
 * Bir oyuncu, bir etiket: isim + makam + durum + D5 oy çipi tek panoda.
 * Masa üstü isimlik ve makam plakası kalktı; etiket avatarın başının üstünde,
 * her zaman kameraya dönük (billboard), alt-merkez pivotlu (büyürken yukarı
 * büyür, başa girmez), unlit ve `depthTest` kapalı (lamba/avatar örtemez).
 *
 * Karar katmanı `nameplateState.ts` (saf, test edilir); burada yalnız çizim,
 * kameraya dönme, ölçek, çakışma ve geçiş animasyonları vardır.
 * drei `Html` YOK — DOM düğmesi ve hover balonu kaldırıldı (isim zaten okunuyor,
 * tam ad HUD oyuncu listesinde). Oyuncu başına en çok 2 çizim çağrısı:
 * pano + (varsa) oy çipi.
 */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Mesh, Quaternion, Vector3 } from 'three';
import type { PlayerView } from '@secret-table/contracts';
import { canvasTexture, useSceneMaterials } from '../materials/SceneMaterials';
import { label as token } from '../materials/palette';
import { PrintedFace } from './Surface';
import { nameplateState } from './nameplateState';
import { useSceneLanguage } from '../i18n/sceneText';
import type { NameplateChip, NameplateGlyph, NameplateVisual } from './nameplateState';
import { VOTE_BADGE_ENTER_MS } from './voteState';
import type { VoteBadgeState } from './voteState';
import { EMOTE_SYMBOL } from '../live/EmoteOverlay';
import type { EmoteKind } from '../live/EmoteOverlay';

// --- Ölçüler (metre) — D6-nameplate.md §2 ------------------------------------
const W = .60, H = .18, R = .032;
const H_COMPACT = .11, R_COMPACT = .026;
/** Pano dışına taşan öğeler (köşe kancaları, SEN rozeti) için tuval payı. */
const MARGIN = .02;
const PAD = .03;
const NAME_SIZE = .066, NAME_CY = .064, NAME_MAX = .50;
const META_SIZE = .038, META_CY = .135, META_TRACK = .06;
const GLYPH_D = .026, GLYPH_GAP = .012;
const CHIP_H = .060, CHIP_PADX = .020, CHIP_GLYPH_R = .014, CHIP_TEXT = .034, CHIP_GAP = .014, CHIP_ICON_GAP = .010;
const CHIP_MARGIN = .005;
const TAG_W = .090, TAG_H = .034, TAG_TEXT = .022, TAG_X = .030, TAG_Y = -.012;
const BRACKET = .030, BRACKET_OUT = .010;
const C_NAME_SIZE = .056, C_NAME_CY = .055;
/** D16 — jest sembolü: panonun sol üstünde küçük madalyon (yalnız jest boyunca). */
const EMOTE_D = .085, EMOTE_MARGIN = .006;
/** Tuval yoğunluğu: 0,60 m = 1024 px (PrintedFace resolution=1024 ile aynı). */
const PPM = 1024 / W;

// --- Ekran kuralları ---------------------------------------------------------
/** Etiket ekranda en az bu kadar yüksek kalır (css px). */
const MIN_PX = 48, MIN_PX_COMPACT = 32, MAX_ZOOM = 2.4;
/** İki etiketin ekran dikdörtgeni bu orandan çok kesişirse uzaktaki kompakt olur. */
const OVERLAP_RATIO = .15, OVERLAP_HOLD_MS = 300;

// --- Animasyon (ms) — §6 -----------------------------------------------------
const OFFICE_MS = 300, OFFICE_OUT_MS = 100, OFFICE_IN_MS = 200, OFFICE_RISE = .006;
const FRAME_MS = 120, SELECT_MS = 160, DEAD_MS = 300;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** Geçişlerde renk karışımı; token'lar hep 6 haneli hex. */
function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

const fontOf = (size: number, weight: number) => `${weight} ${size}px "Table Sans", sans-serif`;

function textWidth(ctx: CanvasRenderingContext2D, text: string, size: number, weight: number, tracking = 0) {
  ctx.font = fontOf(size, weight);
  return ctx.measureText(text).width + tracking * size * Math.max(0, Array.from(text).length - 1);
}

function drawText(ctx: CanvasRenderingContext2D, x: number, cy: number, text: string, size: number, weight: number,
  color: string, anchor: 'start' | 'middle', tracking = 0, alpha = 1, maxWidth?: number) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.font = fontOf(size, weight);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const w = textWidth(ctx, text, size, weight, tracking);
  let cursor = anchor === 'middle' ? x - w / 2 : x;
  if (tracking) {
    for (const ch of Array.from(text)) {
      ctx.fillText(ch, cursor, cy);
      cursor += ctx.measureText(ch).width + tracking * size;
    }
  } else ctx.fillText(text, cursor, cy, maxWidth);
  ctx.restore();
}

/** Makam simgesi: başkan ailesi dolu/kesikli disk, şansölye ailesi halka. */
function drawGlyph(ctx: CanvasRenderingContext2D, glyph: NameplateGlyph, cx: number, cy: number, d: number, alpha: number) {
  const rr = d / 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = glyph.color;
  ctx.strokeStyle = glyph.color;
  const ring = (radius: number, width: number, dashed: boolean) => {
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [radius * .6, radius * .45] : []);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (glyph.kind === 'disc' && !glyph.candidate) {
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
  } else if (glyph.kind === 'disc') {
    ring(rr - d * .1, d * .18, true);
    ctx.beginPath(); ctx.arc(cx, cy, rr * .35, 0, Math.PI * 2); ctx.fill();
  } else ring(rr - d * .1, d * (glyph.candidate ? .18 : .2), glyph.candidate);
  ctx.restore();
}

/** Oy pusulası kartıyla aynı şekil dili (cardArt.ts): yuvarlak uçlu tik / çarpı. */
function drawMark(ctx: CanvasRenderingContext2D, kind: NameplateChip['mark'], cx: number, cy: number, r: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'idle') {
    ctx.lineWidth = r * .28;
    ctx.beginPath(); ctx.arc(cx, cy, r * .62, 0, Math.PI * 2); ctx.stroke();
  } else {
    const g = r * 1.15;
    ctx.lineWidth = r * .34;
    ctx.beginPath();
    if (kind === 'yes') {
      ctx.moveTo(cx - g * .58, cy + g * .02);
      ctx.lineTo(cx - g * .16, cy + g * .46);
      ctx.lineTo(cx + g * .62, cy - g * .5);
    } else {
      ctx.moveTo(cx - g * .5, cy - g * .5); ctx.lineTo(cx + g * .5, cy + g * .5);
      ctx.moveTo(cx + g * .5, cy - g * .5); ctx.lineTo(cx - g * .5, cy + g * .5);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// --- Yerleşim ölçümü ---------------------------------------------------------

let measurer: CanvasRenderingContext2D | null = null;
function measureContext(): CanvasRenderingContext2D | null {
  if (measurer) return measurer;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 8;
  measurer = canvas.getContext('2d');
  return measurer;
}

type Layout = {
  /** Oy çipi: pano sol-üstüne göre (m). `iconOnly` iken yalnız simge dairesi. */
  chip: { x: number; cy: number; w: number; h: number; iconOnly: boolean } | null;
  /** Satır 2 sol grubunun (simge + kelime) ortalanacağı bölge. */
  zone: [number, number] | null;
  /** Kompakt varyantta isim ve simge yerleşimi. */
  compactName: { glyphX: number | null; nameX: number; nameW: number } | null;
};

function layoutOf(visual: NameplateVisual, compact: boolean): Layout {
  const ctx = measureContext();
  const w = (text: string, size: number, weight: number, tracking = 0) =>
    (ctx ? textWidth(ctx, text, size * PPM, weight, tracking) / PPM : text.length * size * .55);

  if (compact) {
    const itemsW = visual.glyph ? GLYPH_D + GLYPH_GAP : 0;
    const chipW = visual.chip ? CHIP_H * .8 : 0;
    const nameW = Math.min(w(visual.name, C_NAME_SIZE, 550), NAME_MAX - itemsW - chipW);
    const total = itemsW + nameW + (chipW ? chipW + CHIP_GAP : 0);
    let x = W / 2 - total / 2;
    const glyphX = visual.glyph ? x + GLYPH_D / 2 : null;
    if (visual.glyph) x += GLYPH_D + GLYPH_GAP;
    const nameX = x;
    x += nameW + CHIP_GAP;
    return {
      chip: visual.chip ? { x, cy: C_NAME_CY, w: chipW, h: chipW, iconOnly: true } : null,
      zone: null,
      compactName: { glyphX, nameX, nameW },
    };
  }

  let leftW = 0;
  if (visual.glyph) leftW += GLYPH_D + (visual.text ? GLYPH_GAP : 0);
  if (visual.text) leftW += w(visual.text, META_SIZE, 600, META_TRACK);

  if (!visual.chip) return { chip: null, zone: [PAD, W - PAD], compactName: null };

  const full = CHIP_PADX * 2 + CHIP_GLYPH_R * 2 + CHIP_ICON_GAP + w(visual.chip.label, CHIP_TEXT, 650, .04);
  const iconOnly = leftW + (leftW ? CHIP_GAP : 0) + full > W - 2 * PAD;
  const chipW = iconOnly ? CHIP_H : full;
  const x = leftW ? W - PAD - chipW : W / 2 - chipW / 2;
  return {
    chip: { x, cy: META_CY, w: chipW, h: CHIP_H, iconOnly },
    zone: leftW ? [PAD, x - CHIP_GAP] : null,
    compactName: null,
  };
}

// --- Pano çizimi -------------------------------------------------------------

type PaintInput = {
  visual: NameplateVisual; previous: NameplateVisual | null;
  p: number; elapsed: number; word: boolean; pulse: number;
  compact: boolean; layout: Layout;
};

function paintPanel(ctx: CanvasRenderingContext2D, cw: number, ch: number, input: PaintInput) {
  const { visual, previous, p, compact, layout } = input;
  const from = previous ?? visual;
  ctx.clearRect(0, 0, cw, ch);
  const ppm = cw / (W + 2 * MARGIN);
  const m = (v: number) => v * ppm;
  const h = compact ? H_COMPACT : H;
  ctx.save();
  ctx.translate(m(MARGIN), m(MARGIN));

  // Zemin + çerçeve
  const lw = m(from.frameWidth + (visual.frameWidth - from.frameWidth) * p);
  roundRect(ctx, lw / 2, lw / 2, m(W) - lw, m(h) - lw, m(compact ? R_COMPACT : R));
  ctx.globalAlpha = from.bgAlpha + (visual.bgAlpha - from.bgAlpha) * p;
  ctx.fillStyle = mix(from.bg, visual.bg, p);
  ctx.fill();
  ctx.globalAlpha = visual.dead ? .7 : 1;
  ctx.lineWidth = lw;
  ctx.strokeStyle = mix(mix(from.frame, visual.frame, p), token.gold, input.pulse);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Hedeflendi köşe kancaları
  if (visual.brackets) {
    ctx.save();
    ctx.strokeStyle = token.gold;
    ctx.lineWidth = m(.006);
    ctx.lineCap = 'round';
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const x0 = sx > 0 ? m(-BRACKET_OUT) : m(W + BRACKET_OUT);
      const y0 = sy > 0 ? m(-BRACKET_OUT) : m(h + BRACKET_OUT);
      ctx.beginPath();
      ctx.moveTo(x0, y0 + sy * m(BRACKET));
      ctx.lineTo(x0, y0);
      ctx.lineTo(x0 + sx * m(BRACKET), y0);
      ctx.stroke();
    }
    ctx.restore();
  }

  const nameColor = mix(from.nameColor, visual.nameColor, p);
  if (compact && layout.compactName) {
    const { glyphX, nameX, nameW } = layout.compactName;
    if (visual.glyph && glyphX !== null) drawGlyph(ctx, visual.glyph, m(glyphX), m(C_NAME_CY), m(GLYPH_D), 1);
    drawText(ctx, m(nameX), m(C_NAME_CY), visual.name, m(C_NAME_SIZE), 550, nameColor, 'start', 0, 1, m(nameW));
  } else {
    drawText(ctx, m(W / 2), m(NAME_CY), visual.name, m(NAME_SIZE), 550, nameColor, 'middle', 0, 1, m(NAME_MAX));
    // Satır 2: makam değişiminde çapraz solma (eski söner, yeni belirip yukarı kayar).
    const line = (source: NameplateVisual, alpha: number, rise: number) => {
      if (!layout.zone) return;
      const ctxW = measureContext();
      let leftW = 0;
      if (source.glyph) leftW += GLYPH_D + (source.text ? GLYPH_GAP : 0);
      if (source.text && ctxW) leftW += textWidth(ctxW, source.text, META_SIZE * PPM, 600, META_TRACK) / PPM;
      let x = (layout.zone[0] + layout.zone[1]) / 2 - leftW / 2;
      const cy = META_CY + rise;
      if (source.glyph) {
        drawGlyph(ctx, source.glyph, m(x + GLYPH_D / 2), m(cy), m(GLYPH_D), alpha);
        x += GLYPH_D + (source.text ? GLYPH_GAP : 0);
      }
      if (source.text) {
        const color = source === visual ? mix(from.textColor, visual.textColor, p) : source.textColor;
        drawText(ctx, m(x), m(cy), source.text, m(META_SIZE), 600, color, 'start', META_TRACK, alpha);
      }
    };
    if (input.word && previous && input.elapsed < OFFICE_MS) {
      const out = 1 - clamp01(input.elapsed / OFFICE_OUT_MS);
      const into = clamp01((input.elapsed - OFFICE_OUT_MS) / OFFICE_IN_MS);
      if (out > 0) line(previous, out, 0);
      if (into > 0) line(visual, into, (1 - into) * OFFICE_RISE);
    } else line(visual, 1, 0);
  }

  // Yerel oyuncu rozeti
  if (visual.tag) {
    roundRect(ctx, m(TAG_X), m(TAG_Y), m(TAG_W), m(TAG_H), m(TAG_H / 2));
    ctx.fillStyle = token.lineLocal;
    ctx.fill();
    drawText(ctx, m(TAG_X + TAG_W / 2), m(TAG_Y + TAG_H / 2), visual.tag, m(TAG_TEXT), 700, token.ink, 'middle', .12);
  }
  ctx.restore();
}

// --- Çakışma kaydı -----------------------------------------------------------

type ScreenRect = { cx: number; cy: number; w: number; h: number; dist: number };
const Overlap = createContext<Map<string, ScreenRect> | null>(null);

/** 9–10 kişilik masada etiketler kesişirse UZAKTAKİ kompakt varyanta iner. */
export function NameplateLayer({ children }: { children: ReactNode }) {
  const rects = useMemo(() => new Map<string, ScreenRect>(), []);
  return <Overlap.Provider value={rects}>{children}</Overlap.Provider>;
}

function overlapRatio(a: ScreenRect, b: ScreenRect) {
  const dx = Math.min(a.cx + a.w / 2, b.cx + b.w / 2) - Math.max(a.cx - a.w / 2, b.cx - b.w / 2);
  const dy = Math.min(a.cy + a.h / 2, b.cy + b.h / 2) - Math.max(a.cy - a.h / 2, b.cy - b.h / 2);
  if (dx <= 0 || dy <= 0) return 0;
  return (dx * dy) / Math.max(1, Math.min(a.w * a.h, b.w * b.h));
}

// --- Oy çipi -----------------------------------------------------------------

function VoteChip({ chip, box, reducedMotion, order }: {
  chip: NameplateChip; box: { w: number; h: number; iconOnly: boolean }; reducedMotion: boolean; order: RefObject<number>;
}) {
  const group = useRef<Group>(null);
  const mesh = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const started = useRef(performance.now());
  const draw = useCallback((ctx: CanvasRenderingContext2D, cw: number, chh: number) => {
    ctx.clearRect(0, 0, cw, chh);
    const ppm = cw / (box.w + 2 * CHIP_MARGIN);
    const m = (v: number) => v * ppm;
    ctx.save();
    ctx.translate(m(CHIP_MARGIN), m(CHIP_MARGIN));
    ctx.globalAlpha = chip.alpha;
    const gr = m(CHIP_GLYPH_R);
    let gcx: number;
    if (box.iconOnly) {
      ctx.beginPath(); ctx.arc(m(box.w / 2), m(box.h / 2), m(box.h / 2), 0, Math.PI * 2);
      ctx.fillStyle = token.chipFill; ctx.fill();
      ctx.lineWidth = m(.003); ctx.strokeStyle = chip.accent; ctx.stroke();
      gcx = m(box.w / 2);
    } else {
      roundRect(ctx, 0, 0, m(box.w), m(box.h), m(box.h / 2));
      ctx.fillStyle = token.chipFill; ctx.fill();
      ctx.lineWidth = m(.003); ctx.strokeStyle = chip.accent; ctx.stroke();
      gcx = m(CHIP_PADX) + gr;
      drawText(ctx, gcx + gr + m(CHIP_ICON_GAP), m(box.h / 2), chip.label, m(CHIP_TEXT), 650, chip.ink, 'start', .04);
    }
    drawMark(ctx, chip.mark, gcx, m(box.h / 2), gr, chip.ink, 1);
    ctx.globalAlpha = 1;
    ctx.restore();
  }, [chip.accent, chip.alpha, chip.ink, chip.label, chip.mark, box.w, box.h, box.iconOnly]);

  useLayoutEffect(() => { started.current = performance.now(); invalidate(); }, [chip.label, invalidate]);
  useFrame(() => {
    if (mesh.current) mesh.current.renderOrder = order.current + 1;
    if (!group.current) return;
    const p = reducedMotion ? 1 : clamp01((performance.now() - started.current) / VOTE_BADGE_ENTER_MS);
    group.current.scale.setScalar(.6 + .4 * easeOut(p));
    const material = mesh.current?.material;
    if (material && !Array.isArray(material) && 'opacity' in material) material.opacity = p;
    if (p < 1) invalidate();
  });

  return <group ref={group} name="VoteChip">
    <PrintedFace width={box.w + 2 * CHIP_MARGIN} height={box.h + 2 * CHIP_MARGIN} rotation={[0, 0, 0]} position={[0, 0, 0]}
      resolution={Math.max(64, Math.round((box.w + 2 * CHIP_MARGIN) * PPM))} draw={draw} unlit depthTest={false} meshRef={mesh} />
  </group>;
}

// --- Jest sembolü (D16) ------------------------------------------------------

/**
 * Jest süresince etiketin yanında duran küçük sembol. Kamu bilgisidir; YEREL
 * oyuncuda gösterilmez (kendi jestini zaten ilk şahıstan görür). Jest bitince
 * bileşen kaldırılır → boşta ek çizim 0.
 */
function EmoteBadge({ kind, order }: { kind: EmoteKind; order: RefObject<number> }) {
  const mesh = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const draw = useCallback((ctx: CanvasRenderingContext2D, cw: number, ch: number) => {
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, cw / 2 - cw * .06, 0, Math.PI * 2);
    ctx.fillStyle = token.chipFill;
    ctx.fill();
    ctx.lineWidth = cw * .035;
    ctx.strokeStyle = token.gold;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(ch * .56)}px "Table Sans", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.fillText(EMOTE_SYMBOL[kind], cw / 2, ch * .54);
    ctx.restore();
  }, [kind]);
  useLayoutEffect(() => { invalidate(); }, [kind, invalidate]);
  useFrame(() => { if (mesh.current) mesh.current.renderOrder = order.current + 2; });
  return <PrintedFace width={EMOTE_D} height={EMOTE_D} rotation={[0, 0, 0]} position={[0, 0, 0]}
    resolution={128} draw={draw} unlit depthTest={false} meshRef={mesh} />;
}

// --- Etiket ------------------------------------------------------------------

export function Nameplate({ player, local, targetable, selected, onPick, aimed = false, lobby = false, vote = null, emote = null, reducedMotion = false, children }: {
  player: PlayerView; local: boolean; targetable: boolean; selected: boolean; onPick: () => void;
  aimed?: boolean; lobby?: boolean; vote?: VoteBadgeState | null; reducedMotion?: boolean;
  /** D16 — oynayan el jesti (kamu). Jest bitince `null`. */
  emote?: EmoteKind | null;
  /** Billboard grubunun içine girer (klavye hedeflemesi için `TargetZone`). */
  children?: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [crowded, setCrowded] = useState(false);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const { fontsReady } = useSceneMaterials();
  const rects = useContext(Overlap);
  const compact = size.width < 700 || size.height < 500 || crowded;
  const panelH = compact ? H_COMPACT : H;

  const language = useSceneLanguage();
  const visual = nameplateState(player, { local, lobby, targetable, hovered, aimed, selected, vote }, language);
  const key = JSON.stringify(visual);
  const layout = useMemo(() => layoutOf(visual, compact), [key, compact, fontsReady]);

  // Tuval doğrudan yönetilir: geçişler aynı dokuyu yeniden boyar (ek çizim çağrısı yok).
  const faceW = W + 2 * MARGIN, faceH = panelH + 2 * MARGIN;
  const texture = useMemo(() => canvasTexture(Math.round(faceW * PPM), Math.round(faceH * PPM), () => {}), [faceW, faceH]);
  useEffect(() => () => texture.dispose(), [texture]);

  const anim = useRef<{ visual: NameplateVisual | null; previous: NameplateVisual | null; at: number; duration: number; word: boolean }>({
    visual: null, previous: null, at: 0, duration: 0, word: false,
  });
  const group = useRef<Group>(null);
  const panel = useRef<Mesh>(null);
  const order = useRef(0);
  const scratch = useMemo(() => ({ parent: new Quaternion(), world: new Vector3(), ndc: new Vector3() }), []);
  const pending = useRef(0);

  const paint = useCallback(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const state = anim.current;
    if (!ctx || !state.visual) return false;
    const elapsed = state.duration ? performance.now() - state.at : state.duration;
    const p = state.duration ? clamp01(elapsed / state.duration) : 1;
    const pulse = state.word && state.duration ? Math.sin(clamp01(elapsed / OFFICE_MS) * Math.PI) : 0;
    paintPanel(ctx, canvas.width, canvas.height, {
      visual: state.visual, previous: state.previous, p, elapsed, word: state.word, pulse, compact, layout,
    });
    texture.needsUpdate = true;
    return p < 1;
  }, [texture, compact, layout]);

  useLayoutEffect(() => {
    const previous = anim.current.visual;
    const word = !!previous && previous.officeKey !== visual.officeKey;
    const duration = !previous || reducedMotion ? 0
      : word ? OFFICE_MS
        : previous.dead !== visual.dead ? DEAD_MS
          : previous.bg !== visual.bg ? SELECT_MS : FRAME_MS;
    anim.current = { visual, previous, at: performance.now(), duration, word };
    paint();
    invalidate();
  }, [key, paint, reducedMotion, invalidate, fontsReady]);

  useEffect(() => () => { if (rects) rects.delete(player.playerId); }, [rects, player.playerId]);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    // Kameraya dön: ebeveyn dönüşünü tersleyip kamera dönüşünü uygula.
    node.parent?.getWorldQuaternion(scratch.parent).invert();
    node.quaternion.copy(scratch.parent).multiply(camera.quaternion);
    node.getWorldPosition(scratch.world);
    const distance = camera.position.distanceTo(scratch.world);
    const fov = 'fov' in camera ? (camera.fov as number) : 40;
    const perPixel = (2 * Math.tan((fov * Math.PI) / 360) * distance) / Math.max(1, size.height);
    const zoom = Math.min(MAX_ZOOM, Math.max(1, ((compact ? MIN_PX_COMPACT : MIN_PX) * perPixel) / panelH));
    node.scale.setScalar(zoom);
    // Yakın etiket üstte kalır (depthTest kapalı olduğu için sıra elle verilir).
    order.current = 4000 - Math.round(Math.min(3800, distance * 100));
    if (panel.current) panel.current.renderOrder = order.current;

    if (rects) {
      scratch.ndc.copy(scratch.world).project(camera);
      const mine: ScreenRect = {
        cx: (scratch.ndc.x * .5 + .5) * size.width,
        // Pivot alt-merkez: pano çapanın H/2·zoom üstünde durur.
        cy: (1 - (scratch.ndc.y * .5 + .5)) * size.height - (H / 2 * zoom) / perPixel,
        // Karar hep TAM boyla verilir; kompaktlık kendi kararını beslemez (salınım olmaz).
        w: (W * zoom) / perPixel, h: (H * zoom) / perPixel, dist: distance,
      };
      rects.set(player.playerId, mine);
      let hit = false;
      for (const [id, other] of rects) {
        if (id === player.playerId || other.dist >= distance) continue;
        if (overlapRatio(mine, other) > OVERLAP_RATIO) { hit = true; break; }
      }
      const now = performance.now();
      if (hit !== crowded) {
        if (!pending.current) pending.current = now;
        else if (now - pending.current >= OVERLAP_HOLD_MS) { pending.current = 0; setCrowded(hit); }
        invalidate();
      } else pending.current = 0;
    }

    if (anim.current.duration && paint()) invalidate();
  });

  const chip = layout.chip;
  return <group ref={group} name={`Nameplate:${player.playerId}`}
    onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
    onPointerOut={() => setHovered(false)}
    onClick={(e) => { e.stopPropagation(); onPick(); }}>
    <group position={[0, panelH / 2, 0]}>
      <mesh ref={panel}>
        <planeGeometry args={[faceW, faceH]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} depthTest={false} depthWrite={false} />
      </mesh>
      {emote && <group position={[-W / 2 - EMOTE_D / 2 - EMOTE_MARGIN, panelH / 2 - EMOTE_D / 2, .001]}>
        <EmoteBadge kind={emote} order={order} />
      </group>}
      {visual.chip && chip && <group position={[chip.x + chip.w / 2 - W / 2, panelH / 2 - chip.cy, .001]}>
        <VoteChip chip={visual.chip} box={{ w: chip.w, h: chip.h, iconOnly: chip.iconOnly }} reducedMotion={reducedMotion} order={order} />
      </group>}
      {children}
    </group>
  </group>;
}
