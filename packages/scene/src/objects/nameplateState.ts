/**
 * Baş üstü isim etiketinin SAF karar katmanı (ROADMAP D6).
 *
 * `docs/design/D6-nameplate.md` §5 durum matrisinin birebir karşılığı.
 * R3F'e bağımlı değildir, ölçüm (canvas) yapmaz: `Nameplate.tsx` yalnız
 * burada üretilen kararı çizer. Yalnız KAMU alanları okunur
 * (`PlayerView` + zaten kamu olan `voteState`); `privateView` buraya girmez.
 *
 * Çerçeve önceliği:  seçili > hedeflendi > hover > elendi > bağlantı yok >
 *                    hedef seçilebilir > sen > varsayılan
 * Satır 2 önceliği:  ELENDİ > BAĞLANTI YOK > SEÇİLDİ > HEDEF SEÇ > makam >
 *                    HAZIR (lobi) > KOLTUK NN
 * Makam SİMGESİ kelimeden bağımsız her zaman kalır (ör. kopuk başkan).
 */

import type { PlayerView } from '@secret-table/contracts';
import { label, palette } from '../materials/palette';
import { sceneText, type SceneLanguage } from '../i18n/sceneText';
import type { VoteBadgeState } from './voteState';

/** İsim bu karakter sayısını aşarsa `NAME_CHARS - 1` + "…" olarak kırpılır. */
export const NAME_CHARS = 15;

export type NameplateGlyph = {
  /** başkan ailesi = dolu/kesikli disk, şansölye ailesi = halka */
  kind: 'disc' | 'ring';
  candidate: boolean;
  color: string;
};

export type NameplateChip = {
  /** Çip kenarı — D5 vurgusu (`voteYes/voteNo/voteIdle`). */
  accent: string;
  /** Krem dolgu üstündeki kelime + simge rengi (koyu ton, ≥ 4,5:1). */
  ink: string;
  label: string;
  mark: 'yes' | 'no' | 'idle';
  alpha: number;
};

export type NameplateVisual = {
  frame: string;
  /** Çerçeve kalınlığı (m). */
  frameWidth: number;
  bg: string;
  bgAlpha: number;
  /** Kırpılmış görünen ad. */
  name: string;
  nameColor: string;
  glyph: NameplateGlyph | null;
  /** Satır 2 kelimesi; çipe yer açmak için dolgu düşerse `null`. */
  text: string | null;
  textColor: string;
  chip: NameplateChip | null;
  dead: boolean;
  /** Yerel oyuncu rozeti ("SEN"). */
  tag: string | null;
  /** Klavye ile hedeflendi: köşe kancaları. */
  brackets: boolean;
  /** Makam değişimi çapraz solmasının kimliği (kelime + simge). */
  officeKey: string;
};

export type NameplateContext = {
  /** Yerel oyuncu (genel masada "SEN" rozeti, oy çipi yok). */
  local: boolean;
  /** Lobi aşaması — "HAZIR" yalnız burada çıkar. */
  lobby: boolean;
  targetable: boolean;
  hovered: boolean;
  aimed: boolean;
  selected: boolean;
  vote: VoteBadgeState | null;
};

/** Çerçeve kalınlıkları (m) — §2 ölçü tablosu. */
export const FRAME_WIDTH = .006;
export const FRAME_WIDTH_AIMED = .010;

const OFFICE_KINDS = [
  'president',
  'chancellor',
  'president_candidate',
  'chancellor_candidate',
] as const;

type OfficeKind = (typeof OFFICE_KINDS)[number];

/** Aday makamı seçilmiş makamdan önce gelir (adaylık aşaması aktif bilgidir). */
export function nameplateOffice(player: PlayerView): OfficeKind | null {
  if (player.isPresidentialCandidate) return 'president_candidate';
  if (player.isChancellorCandidate) return 'chancellor_candidate';
  if (player.office === 'president') return 'president';
  if (player.office === 'chancellor') return 'chancellor';
  return null;
}

/** 15 karakterden uzun ad: ilk 14 + "…" (tam ad HUD oyuncu listesinde). */
export function clipName(name: string): string {
  const chars = Array.from(name);
  return chars.length > NAME_CHARS ? `${chars.slice(0, NAME_CHARS - 1).join('')}…` : name;
}

function chipTable(language: SceneLanguage) {
  return {
    waiting: { accent: palette.voteIdle, ink: palette.voteIdleText, label: sceneText(language, 'plate.waiting'), mark: 'idle' as const, alpha: .78 },
    voted: { accent: palette.voteYes, ink: palette.voteYesText, label: sceneText(language, 'plate.voted'), mark: 'yes' as const, alpha: 1 },
    yes: { accent: palette.voteYes, ink: palette.voteYesText, label: sceneText(language, 'card.yes'), mark: 'yes' as const, alpha: 1 },
    no: { accent: palette.voteNo, ink: palette.voteNoText, label: sceneText(language, 'card.no'), mark: 'no' as const, alpha: 1 },
  };
}

function chipKey(state: VoteBadgeState): 'waiting' | 'voted' | 'yes' | 'no' {
  if (state.kind === 'waiting') return 'waiting';
  if (state.kind === 'voted') return 'voted';
  return state.vote === 'yes' ? 'yes' : 'no';
}

export function nameplateState(
  player: PlayerView,
  ctx: NameplateContext,
  language: SceneLanguage = 'tr',
): NameplateVisual {
  const dead = !player.alive;
  const offline = player.alive && !player.connected;

  const frame = ctx.selected || ctx.aimed || ctx.hovered ? label.gold
    : dead ? label.lineDead
      : offline ? label.warn
        : ctx.targetable ? label.target
          : ctx.local ? label.lineLocal
            : label.line;
  const frameWidth = !ctx.selected && ctx.aimed ? FRAME_WIDTH_AIMED : FRAME_WIDTH;

  const bg = ctx.selected ? label.selectedBg : dead ? label.bgDead : label.bg;
  const bgAlpha = ctx.selected ? label.selectedBgAlpha : dead ? label.bgDeadAlpha : label.bgAlpha;
  const nameColor = ctx.selected ? label.ink : dead ? label.cream3 : label.cream;

  const office = dead ? null : nameplateOffice(player);
  const glyph: NameplateGlyph | null = office
    ? {
      kind: office.startsWith('president') ? 'disc' : 'ring',
      candidate: office.endsWith('candidate'),
      color: ctx.selected ? label.ink : label.gold,
    }
    : null;

  let text: string | null;
  let textColor: string;
  const seatWord = language === 'tr' ? 'KOLTUK' : 'SEAT';
  if (dead) { text = sceneText(language, 'plate.dead'); textColor = label.cream3; }
  else if (offline) { text = sceneText(language, 'plate.offline'); textColor = label.warn; }
  else if (ctx.selected) { text = sceneText(language, 'plate.selected'); textColor = label.ink; }
  else if (ctx.targetable) { text = sceneText(language, 'plate.targetable'); textColor = ctx.aimed || ctx.hovered ? label.gold : label.target; }
  else if (office) { text = sceneText(language, `plate.${office}` as never); textColor = label.gold; }
  else if (ctx.lobby && player.ready) { text = language === 'tr' ? 'HAZIR' : 'READY'; textColor = label.ready; }
  else { text = `${seatWord} ${String(player.seatIndex + 1).padStart(2, '0')}`; textColor = label.cream3; }
  const filler = text.startsWith(seatWord);

  let chip: NameplateChip | null = null;
  if (ctx.vote && !dead && !ctx.local) {
    chip = { ...chipTable(language)[chipKey(ctx.vote)] };
    // Dolgu metni ("KOLTUK NN") çipe yer açar; makam/durum kelimesi kalır.
    if (filler) text = null;
  }

  return {
    frame, frameWidth, bg, bgAlpha,
    name: clipName(player.displayName), nameColor,
    glyph, text, textColor, chip, dead,
    tag: ctx.local ? 'SEN' : null,
    brackets: ctx.aimed,
    officeKey: `${office ?? 'none'}|${text ?? ''}`,
  };
}
