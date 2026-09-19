/**
 * D10 — politika tahtası çizim katmanı (`docs/design/D10-boards.md`).
 *
 * Ölçü uzayı tasarım belgesiyle birebir: **1940 × 450 px = 1,94 × 0,45 m** (1 px = 1 mm).
 * `PolicyBoard.draw` tuvali bu uzaya ölçekler, buradaki bütün sayılar mm'dir.
 *
 * Kural kaynağı `BOARD_LAYOUTS` (contracts): yuva → yetki eşlemesi burada YAZILMAZ,
 * `boardSlotPlans()` ile türetilir. Tahta kuralın resmidir, kaynağı değildir.
 * İkon path'leri `docs/design/d10/icons.json` kopyasıdır (viewBox 0 0 100 100, yalnız dolgu,
 * delikler aynı dizgi içinde alt yol → `evenodd`).
 */
import { BOARD_LAYOUTS } from '@secret-table/contracts';
import type { BoardVariant, ExecutivePower, PolicyType } from '@secret-table/contracts';
import { palette, board as tokens } from '../materials/palette';
import { sceneText, type SceneLanguage } from '../i18n/sceneText';

export type BoardIconKey = ExecutivePower | 'victory';

/** `docs/design/d10/icons.json` — viewBox 0 0 100 100, `fill-rule: evenodd`. */
export const BOARD_ICONS: Readonly<Record<BoardIconKey, readonly string[]>> = {
  investigate_loyalty: [
    'M42 16 a26 26 0 1 0 0 52 a26 26 0 1 0 0 -52 Z M42 25 a17 17 0 1 0 0 34 a17 17 0 1 0 0 -34 Z',
    'M55.8 64.2 L83.8 92.2 L92.2 83.8 L64.2 55.8 Z',
    'M34 30 h16 v24 h-16 Z M37 33 h10 v18 h-10 Z',
  ],
  call_special_election: [
    'M10 40 h80 v8 h-4 v44 h-72 v-44 h-4 Z M36 40 h28 v8 h-28 Z',
    'M40 4 h26 l-6 30 h-26 Z M42 18 l5 5 l10 -10 l3 3 l-13 13 l-8 -8 Z',
  ],
  policy_peek: [
    'M50 6 C66 6 78 16 86 22 C78 28 66 38 50 38 C34 38 22 28 14 22 C22 16 34 6 50 6 Z M50 14 a8 8 0 1 0 0 16 a8 8 0 1 0 0 -16 Z',
    'M8 46 h24 v46 h-24 Z',
    'M38 42 h24 v50 h-24 Z',
    'M68 46 h24 v46 h-24 Z',
  ],
  execution: [
    'M52.7 92.3 L33.7 56.5 C25.9 41.9 26.3 27.1 31.0 16.3 C42.6 18.4 55.1 26.4 62.9 41.0 L81.9 76.7 Z M38.6 58.0 L61.4 46.0 64.0 50.8 41.2 62.9 Z M43.8 67.8 L66.6 55.7 68.7 59.8 46.0 71.9 Z',
    'M48.6 94.4 L86.0 74.6 89.0 80.2 51.6 100.1 Z',
  ],
  victory: [
    'M50 10 L58.2 32.7 L82.3 33.5 L63.3 48.3 L70 71.5 L50 58 L30 71.5 L36.7 48.3 L17.7 33.5 L41.8 32.7 Z',
    'M28 73 L20 95 L31 90 L37 99 L44 78 Z',
    'M72 73 L80 95 L69 90 L63 99 L56 78 Z',
  ],
};

/**
 * Büyük harf etiketler **sabit dizgi**dir (`toUpperCase()` Türkçe'de 'i' → 'I' hatası yapar).
 * Bant iki satıra kadar; tek satırlı etiket dikeyde ortalanmaz, ilk satırda kalır (SVG ile aynı).
 * D23: dil `sceneText` üzerinden gelir, varsayılan `tr` (fixtures/testler değişmez).
 */
function powerLabels(power: ExecutivePower, language: SceneLanguage): readonly string[] {
  const lines = [sceneText(language, `board.power.${power}.1` as never)];
  const second = power === 'execution' ? null : sceneText(language, `board.power.${power}.2` as never);
  return second ? [...lines, second] : lines;
}

function victoryLabels(party: PolicyType, language: SceneLanguage): readonly string[] {
  return [
    sceneText(language, `board.win.${party}.1` as never),
    sceneText(language, `board.win.${party}.2` as never),
  ];
}

export const HITLER_STRIP_TEXT = 'HİTLER ŞANSÖLYE SEÇİLİRSE FAŞİSTLER KAZANIR';
export const CHAOS_STRIP_TEXT = '3 BAŞARISIZ SEÇİM → ÜSTTEKİ KANUN UYGULANIR';
export const VETO_TEXT = 'VETO AÇILDI';

/** Tuval ölçüleri (mm). `PolicyBoard` bu uzaya ölçekler. */
export const BOARD_GEOMETRY = {
  w: 1940, h: 450,
  slotX0: 601, pitch: 211.5, slotW: 186,
  topY0: 20, topY1: 62,
  slotY0: 72, slotY1: 334,
  bandY0: 342, bandY1: 436,
  iconSize: 64, ghostSize: 100,
  /** Kart merkezi = yuva merkezi; kart 177×253 (CardBody 0,19×0,272 m × .93). */
  slotCenterY: 203,
} as const;

export const slotLeft = (i: number) => BOARD_GEOMETRY.slotX0 + i * BOARD_GEOMETRY.pitch;
export const slotCenterX = (i: number) => slotLeft(i) + BOARD_GEOMETRY.slotW / 2;

export type BoardBandPlan = {
  icon: BoardIconKey;
  lines: readonly string[];
  /** Zafer bandı: parti dolgusu + krem yazı. */
  victory: boolean;
  /** Yalnız `vetoUnlockAt` yuvasında: "VETO AÇILDI" rozeti. */
  veto: boolean;
};
export type BoardSlotPlan = {
  index: number;
  /** Yuva içi hayalet ikon; `'none'` yetkili olmayan yuvalarda yok. */
  ghost?: BoardIconKey;
  /** Yuva altı bant; yetkisiz yuvada yok (orijinaldeki gibi boş). */
  band?: BoardBandPlan;
};

/** Düzen `BOARD_LAYOUTS`'tan türetilir; burada sabit yetki tablosu yoktur. */
export function boardSlotPlans(
  party: PolicyType,
  variant: BoardVariant,
  language: SceneLanguage = 'tr',
): readonly BoardSlotPlan[] {
  const layout = BOARD_LAYOUTS[variant];
  const slots = party === 'liberal' ? layout.liberalSlots : layout.fascistSlots;
  return Array.from({ length: slots }, (_, index): BoardSlotPlan => {
    if (index === slots - 1) {
      return { index, ghost: 'victory', band: { icon: 'victory', lines: victoryLabels(party, language), victory: true, veto: false } };
    }
    const power = party === 'liberal' ? 'none' : layout.fascistPowers[index] ?? 'none';
    if (power === 'none') return { index };
    return {
      index, ghost: power,
      band: { icon: power, lines: powerLabels(power, language), victory: false, veto: index + 1 === layout.vetoUnlockAt },
    };
  });
}

/** Hitler bölgesi şeridi: `hitlerChancellorWinAt`. yuvadan son yuvaya (0 tabanlı, kapsayıcı). */
export function hitlerStripSlots(party: PolicyType, variant: BoardVariant): { from: number; to: number } | null {
  if (party === 'liberal') return null;
  const layout = BOARD_LAYOUTS[variant];
  return { from: layout.hitlerChancellorWinAt - 1, to: layout.fascistSlots - 1 };
}

// --- Çizim yardımcıları ------------------------------------------------------

function spacing(ctx: CanvasRenderingContext2D, value: number) {
  // Chrome 99+/Safari 17+; desteklenmeyen tarayıcıda atama sessizce yok sayılır ve
  // tasarım 0 aralıkla da sığar (en uzun satır "İNCELEMESİ" 15 px ≈ 96 < 100).
  ctx.letterSpacing = `${value}px`;
}

/** Sola yaslı, **taban çizgisi** hizalı yazı (`lettering()` ortalı ve orta hizalıdır). */
export function letteringLeft(ctx: CanvasRenderingContext2D, text: string, x: number, baseline: number,
  size: number, color: string, weight = 700, track = 0) {
  ctx.save();
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `${weight} ${size}px "Table Sans", sans-serif`;
  spacing(ctx, track);
  ctx.fillText(text, x, baseline);
  ctx.restore();
}

/** Ortalı, taban çizgisi hizalı yazı (şerit ve sayaç sütunu metinleri). */
export function letteringMid(ctx: CanvasRenderingContext2D, text: string, cx: number, baseline: number,
  size: number, color: string, weight = 700, track = 0) {
  ctx.save();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `${weight} ${size}px "Table Sans", sans-serif`;
  spacing(ctx, track);
  ctx.fillText(text, cx, baseline);
  ctx.restore();
}

/** 100×100 ikon; delikler `evenodd` ile aynı path içinde. */
export function drawIcon(ctx: CanvasRenderingContext2D, key: BoardIconKey, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(size / 100, size / 100);
  ctx.fillStyle = color;
  for (const d of BOARD_ICONS[key]) ctx.fill(new Path2D(d), 'evenodd');
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
}

/** Yuva çerçevesi + numarası + (varsa) hayalet ikon. */
export function drawSlot(ctx: CanvasRenderingContext2D, plan: BoardSlotPlan) {
  const { slotY0, slotY1, slotW, ghostSize, slotCenterY } = BOARD_GEOMETRY;
  const left = slotLeft(plan.index);
  ctx.strokeStyle = tokens.line; ctx.lineWidth = 2;
  ctx.strokeRect(left, slotY0, slotW, slotY1 - slotY0);
  letteringLeft(ctx, String(plan.index + 1).padStart(2, '0'), left + 12, 98, 26, tokens.num, 600);
  if (plan.ghost) {
    drawIcon(ctx, plan.ghost, slotCenterX(plan.index) - ghostSize / 2, slotCenterY - ghostSize / 2, ghostSize, tokens.ghost);
  }
}

/** Yuva altı bant: sol ikon + sağda 1–2 satır etiket (koltuk kamerası dikeyi 3× sıkıştırır). */
export function drawBand(ctx: CanvasRenderingContext2D, index: number, band: BoardBandPlan, party: PolicyType, language: SceneLanguage = 'tr') {
  const { bandY0, bandY1, slotW, iconSize } = BOARD_GEOMETRY;
  const left = slotLeft(index);
  const text = band.victory ? palette.cream : tokens.ink;
  roundRect(ctx, left, bandY0, slotW, bandY1 - bandY0, 8, band.victory ? palette[party] : tokens.paper2);
  drawIcon(ctx, band.icon, left + 8, bandY0 + 15, iconSize, band.victory ? palette.cream : palette[party]);
  band.lines.forEach((line, n) => letteringLeft(ctx, line, left + 82, 383 + n * 22, 15, text, 700, .8));
  if (band.veto) {
    roundRect(ctx, left + 80, 396, 98, 24, 5, palette.brass);
    letteringMid(ctx, sceneText(language, 'board.veto'), left + 129, 413, 12.5, tokens.ink, 700, 1);
  }
}

/** Faşist tahtanın üst şeridi: Hitler bölgesi (yuva `from`–`to` üstü). */
export function drawHitlerStrip(ctx: CanvasRenderingContext2D, range: { from: number; to: number }, language: SceneLanguage = 'tr') {
  const { topY0, topY1, slotW } = BOARD_GEOMETRY;
  const x0 = slotLeft(range.from), x1 = slotLeft(range.to) + slotW;
  roundRect(ctx, x0, topY0, x1 - x0, topY1 - topY0, 6, tokens.fascistDeep);
  letteringMid(ctx, sceneText(language, 'board.hitlerStrip'), (x0 + x1) / 2, 49, 24, palette.cream, 700, 2.4);
  // Bölgenin başladığı yuvaya küçük üçgen.
  ctx.beginPath(); ctx.moveTo(x0 + 14, topY1); ctx.lineTo(x0 + 24, topY1 + 6); ctx.lineTo(x0 + 34, topY1);
  ctx.closePath(); ctx.fillStyle = tokens.fascistDeep; ctx.fill();
}

/** Liberal tahta: 1–4. yuvaların altındaki kaos şeridi (○○● + kural cümlesi). */
export function drawChaosStrip(ctx: CanvasRenderingContext2D, language: SceneLanguage = 'tr') {
  const { bandY0, bandY1, slotW } = BOARD_GEOMETRY;
  const x0 = slotLeft(0), x1 = slotLeft(3) + slotW;
  roundRect(ctx, x0, bandY0 + 14, x1 - x0, bandY1 - bandY0 - 28, 6, tokens.liberalDeep);
  for (let k = 0; k < 3; k++) {
    ctx.beginPath(); ctx.arc(x0 + 34 + k * 30, 389, 10, 0, Math.PI * 2);
    if (k === 2) { ctx.fillStyle = palette.cream; ctx.fill(); }
    ctx.strokeStyle = palette.cream; ctx.lineWidth = 2.5; ctx.stroke();
  }
  letteringLeft(ctx, sceneText(language, 'board.chaosStrip'), x0 + 124, 397, 22, palette.cream, 700, 2);
}

/**
 * Liberal tahtanın sağ sütunu: seçim sayacı açıklaması. Altın pul masadaki
 * `ElectionMarker`'da kalır; bu sütun yalnız pulun anlamını söyler.
 */
export function drawTrackerColumn(ctx: CanvasRenderingContext2D, language: SceneLanguage = 'tr') {
  const { slotY0, slotY1, slotW, w } = BOARD_GEOMETRY;
  const x0 = slotLeft(4) + slotW + 28, x1 = w - 24, cx = (x0 + x1) / 2;
  roundRect(ctx, x0, slotY0, x1 - x0, slotY1 - slotY0, 8, tokens.paper2);
  letteringMid(ctx, sceneText(language, 'board.tracker'), cx, 112, 20, tokens.ink, 700, 2);
  for (let k = 0; k < 4; k++) {
    const dotX = cx - 84 + k * 56, chaos = k === 3;
    ctx.beginPath(); ctx.arc(dotX, 176, 19, 0, Math.PI * 2);
    if (chaos) { ctx.fillStyle = palette.fascist; ctx.fill(); }
    else { ctx.strokeStyle = tokens.ink2; ctx.lineWidth = 2.5; ctx.stroke(); }
    letteringMid(ctx, String(k), dotX, 183, 19, chaos ? palette.cream : tokens.ink2, 700);
  }
  letteringMid(ctx, language === 'tr' ? 'KAOS' : 'CHAOS', cx + 84, 226, 16, palette.fascist, 700, 1.5);
  const note = [
    sceneText(language, 'board.trackerNote.1'),
    sceneText(language, 'board.trackerNote.2'),
    sceneText(language, 'board.trackerNote.3'),
  ];
  note.forEach((line, n) => letteringMid(ctx, line, cx, 268 + n * 24, 14, tokens.ink2, 600, 1.2));
}
