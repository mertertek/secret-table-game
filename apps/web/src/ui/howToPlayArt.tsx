/**
 * D29 — "Nasıl oynanır" görselleri: SATIR İÇİ SVG, dış dosya yok.
 *
 * **Tek kaynak.** Renkler `@secret-table/scene/art` üzerinden 3D masanın
 * paletinden (`materials/palette.ts`), yetki ikonlarının yolları aynı paketteki
 * `BOARD_ICONS`tan, kart yüzü yerleşimi `materials/cardArt.ts`in oranlarından,
 * yuva → yetki eşlemesi ise `boardSlotArt()` (yani `BOARD_LAYOUTS`) üzerinden
 * gelir. Burada elle yazılmış kural YOKTUR.
 *
 * **Sapma (bilerek):** oyundaki tahtanın ölçüsü 1940 × 450 (4,3:1) ve bant
 * yazıları 15 px'tir; 360 px genişlikte bu yazı 2,5 px'e iner, okunmaz. Bu
 * yüzden tahta burada YENİDEN YERLEŞTİRİLDİ (daha dar yuva, yazı yerine ikon)
 * ve yetki adları tahtanın altındaki HTML açıklama listesinde verildi. Aynı
 * nedenle yuva ikonları oyundaki "hayalet" tonunda değil, parti renginde
 * çizilir: orada dekor, burada bilgidir.
 *
 * Metin: prose/altyazı web `i18n`inden (`howto.art.*`), kartların ve tahtanın
 * ÜZERİNE BASILI büyük harf etiketler ise sahnenin kendi iki dilli sözlüğünden
 * (`sceneText`) gelir — 3D masadaki kartla birebir aynı dizgi olsun diye.
 */
import { useId, useState, type ReactNode } from 'react';
import {
  CHANCELLOR_DRAW_COUNT,
  ELECTION_TRACKER_MAX,
  PRESIDENT_DRAW_COUNT,
  BOARD_LAYOUTS,
  type BoardVariant,
  type PolicyType,
} from '@secret-table/contracts';
import {
  BOARD_ICONS,
  board as boardTokens,
  palette,
  sceneText,
  type BoardIconKey,
} from '@secret-table/scene/art';

import { useLanguage, useT, type TextKey } from '../i18n';
import { boardSlotArt, boardVariantOptions, variantForPlayers, type HowToPlayArtId } from './howToPlay';
import { powerName, winnerName } from './text';

/** `cardArt.ts` içindeki kart çerçevesi / dipnot tonları (palette'te yok). */
const CARD_EDGE = '#bca57c';
const CARD_FOOT = '#7a705b';

// ---------------------------------------------------------------------------
// Ortak parçalar
// ---------------------------------------------------------------------------

/**
 * `BOARD_ICONS` yol dizisi (viewBox 0 0 100 100, yalnız dolgu, delikler
 * `evenodd`). 3D tahtadaki `drawIcon()` ile AYNI yollar.
 */
function Glyph({
  icon,
  x,
  y,
  size,
  color,
  opacity = 1,
}: {
  icon: BoardIconKey;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${size / 100})`}
      fill={color}
      fillOpacity={opacity}
      fillRule="evenodd"
    >
      {BOARD_ICONS[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

/**
 * Tek başına duran yetki ikonu. Küçük boy açıklama listesinde satır içi,
 * `large` ise bir bölümün tek görseli olarak kullanılır.
 */
export function PowerGlyph({
  icon,
  color,
  large = false,
}: {
  icon: BoardIconKey;
  color: string;
  large?: boolean;
}) {
  return (
    <svg
      className={`howto-art__glyph${large ? ' howto-art__glyph--lg' : ''}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <Glyph icon={icon} x={0} y={0} size={100} color={color} />
    </svg>
  );
}

/** `cardArt.ts` amblemleri: liberal yaprak, faşist burç. Birim uzayda çizilir. */
function Emblem({
  party,
  x,
  y,
  r,
  color,
  cutout = palette.cream,
}: {
  party: PolicyType;
  x: number;
  y: number;
  r: number;
  color: string;
  cutout?: string;
}) {
  if (party === 'liberal') {
    return (
      <g transform={`translate(${x} ${y}) scale(${r})`}>
        <path d="M-.48 .65 Q-.15 -.2 .5 -.76 Q.68 .42 -.48 .65 Z" fill={color} />
        <g stroke={cutout} strokeWidth={0.035} fill="none" strokeLinecap="round">
          <path d="M-.5 .7 L.42 -.62" />
          {[0, 1, 2, 3].map((i) => {
            const cy = 0.35 - i * 0.22;
            return <path key={i} d={`M${-0.23 + i * 0.13} ${cy} L${0.1 + i * 0.1} ${cy + 0.04}`} />;
          })}
        </g>
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${r})`}>
      <path
        d="M-.68 .65 L-.68 -.4 L-.35 -.4 L-.35 -.74 L.35 -.74 L.35 -.4 L.68 -.4 L.68 .65 Z"
        fill={color}
      />
      <rect x={-0.12} y={0.03} width={0.24} height={0.62} fill={cutout} />
      <rect x={-0.45} y={-0.21} width={0.14} height={0.15} fill={cutout} />
      <rect x={0.31} y={-0.21} width={0.14} height={0.15} fill={cutout} />
    </g>
  );
}

/**
 * Kart yüzü. Oranlar `cardArt.ts`in `drawCard()` fonksiyonundan alındı
 * (120 × 172 ≈ 0,19 × 0,272 m kart).
 */
function CardFrame({
  party,
  kindLabel,
  title,
  label,
  children,
}: {
  party: PolicyType;
  kindLabel: string;
  title: string;
  label: string;
  children: ReactNode;
}) {
  const color = palette[party];
  return (
    <svg className="howto-art__card" viewBox="0 0 120 172" role="img" aria-label={label}>
      <rect x="0" y="0" width="120" height="172" rx="5" fill={palette.cream} />
      <rect
        x="5.4"
        y="5.7"
        width="109.2"
        height="160.6"
        fill="none"
        stroke={CARD_EDGE}
        strokeWidth="1.1"
      />
      <text
        x="60"
        y="20.6"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        letterSpacing="0.5"
        fill={boardTokens.ink2}
      >
        {kindLabel}
      </text>
      <circle cx="60" cy="74" r="33.6" fill="none" stroke={color} strokeWidth="0.9" />
      {children}
      <text
        x="60"
        y="124"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="17"
        fontWeight="700"
        letterSpacing="0.4"
        fill={color}
      >
        {title}
      </text>
      <rect x="42" y="142.8" width="36" height="1.4" fill={color} />
      <text
        x="60"
        y="155.7"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        letterSpacing="1.1"
        fill={CARD_FOOT}
      >
        SECRET TABLE
      </text>
    </svg>
  );
}

/** Kart ARKASI (kimsenin görmediği kart): koyu yeşil, çapraz tarama, pirinç eşkenar. */
function CardBack({ label }: { label: string }) {
  // `useId()` «r0» gibi ASCII dışı karakter üretir; `url(#…)` içinde güvenli olsun.
  const clip = `howto-back-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className="howto-art__card" viewBox="0 0 120 172" role="img" aria-label={label}>
      <defs>
        <clipPath id={clip}>
          <rect x="12" y="12.9" width="96" height="146.2" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="120" height="172" rx="5" fill={palette.cream} />
      <rect x="9.6" y="10.3" width="100.8" height="151.4" fill="#253c35" />
      <g stroke="#65715a" strokeWidth="0.4" clipPath={`url(#${clip})`}>
        {Array.from({ length: 14 }, (_u, i) => (
          <path key={i} d={`M${-172 + i * 22} 13.8 L${-20 + i * 22} 158.2`} />
        ))}
      </g>
      <g transform="translate(60 86) rotate(45)">
        <rect x="-28.8" y="-28.8" width="57.6" height="57.6" fill="#253c35" />
        <rect
          x="-28.8"
          y="-28.8"
          width="57.6"
          height="57.6"
          fill="none"
          stroke={palette.brass}
          strokeWidth="1.1"
        />
      </g>
      <text
        x="60"
        y="86"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="26"
        fontWeight="700"
        letterSpacing="1"
        fill={palette.cream}
      >
        ST
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Kartlar
// ---------------------------------------------------------------------------

export function PolicyCard({ policy }: { policy: PolicyType }) {
  const language = useLanguage();
  const kind = sceneText(language, 'card.policy');
  const title = sceneText(language, policy === 'liberal' ? 'card.liberal' : 'card.fascist');
  return (
    <CardFrame party={policy} kindLabel={kind} title={title} label={`${kind} · ${title}`}>
      <Emblem party={policy} x={60} y={74} r={31.2} color={palette[policy]} />
    </CardFrame>
  );
}

export function RoleCard({ role }: { role: 'liberal' | 'fascist' | 'hitler' }) {
  const language = useLanguage();
  const party: PolicyType = role === 'liberal' ? 'liberal' : 'fascist';
  const kind = sceneText(language, 'card.role');
  const title = sceneText(
    language,
    role === 'hitler' ? 'card.hitler' : role === 'liberal' ? 'card.liberal' : 'card.fascist',
  );
  return (
    <CardFrame party={party} kindLabel={kind} title={title} label={`${kind} · ${title}`}>
      <Emblem party={party} x={60} y={74} r={31.2} color={palette[party]} />
      {role === 'hitler' ? (
        <circle cx="60" cy="74" r="38.5" fill="none" stroke={palette[party]} strokeWidth="1.6" />
      ) : null}
    </CardFrame>
  );
}

/** Oy pusulası: JA / NEIN (Türkçede EVET / HAYIR). Onay ↔ çarpı `cardArt.ts`ten. */
export function BallotCard({ vote }: { vote: 'yes' | 'no' }) {
  const language = useLanguage();
  const party: PolicyType = vote === 'yes' ? 'liberal' : 'fascist';
  const color = palette[party];
  const kind = sceneText(language, 'card.ballot');
  const title = sceneText(language, vote === 'yes' ? 'card.yes' : 'card.no');
  return (
    <CardFrame party={party} kindLabel={kind} title={title} label={`${kind} · ${title}`}>
      <g stroke={color} strokeWidth="6.6" strokeLinecap="round" fill="none">
        {vote === 'yes' ? (
          <path d="M40.8 72.2 L55.2 86 L81.6 56.8" />
        ) : (
          <>
            <path d="M44.4 58.5 L75.6 87.7" />
            <path d="M75.6 58.5 L44.4 87.7" />
          </>
        )}
      </g>
    </CardFrame>
  );
}

/** Rol zarfı (`H` ile açılan kimlik). */
export function EnvelopeArt() {
  const language = useLanguage();
  const word = sceneText(language, 'envelope.identity');
  return (
    <svg className="howto-art__card howto-art__card--wide" viewBox="0 0 150 106" role="img" aria-label={word}>
      <rect x="2" y="2" width="146" height="102" rx="6" fill={palette.cream} stroke={CARD_EDGE} strokeWidth="1.6" />
      <path d="M2 8 L75 60 L148 8" fill="none" stroke={palette.brass} strokeWidth="2.4" />
      <circle cx="75" cy="66" r="13" fill={palette.brass} />
      <circle cx="75" cy="66" r="13" fill="none" stroke={boardTokens.ink} strokeWidth="1" opacity="0.35" />
      <text
        x="75"
        y="93"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="13"
        fontWeight="700"
        letterSpacing="1.6"
        fill={boardTokens.ink2}
      >
        {word}
      </text>
    </svg>
  );
}

/** Koltuk rozeti: BAŞKAN / ŞANSÖLYE plakası (3D isim plakasıyla aynı dizgi). */
function SeatChip({
  role,
  struck = false,
}: {
  role: 'plate.president' | 'plate.chancellor';
  struck?: boolean;
}) {
  const language = useLanguage();
  const word = sceneText(language, role);
  return (
    <svg className="howto-art__seat" viewBox="0 0 132 92" role="img" aria-label={word}>
      <rect x="2" y="2" width="128" height="88" rx="8" fill="#17241f" stroke={palette.brass} strokeWidth="1.6" />
      <circle cx="66" cy="34" r="13" fill={palette.cream} opacity="0.9" />
      <path d="M45 60 a21 18 0 0 1 42 0 Z" fill={palette.cream} opacity="0.9" />
      <text
        x="66"
        y="76"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="13"
        fontWeight="700"
        letterSpacing="1"
        fill={palette.gold}
      >
        {word}
      </text>
      {struck ? (
        <g stroke={palette.fascist} strokeWidth="6" strokeLinecap="round">
          <path d="M16 78 L116 14" />
        </g>
      ) : null}
    </svg>
  );
}

/** Akış oku (dekoratif). */
function Arrow() {
  return (
    <svg className="howto-art__arrow" viewBox="0 0 34 24" aria-hidden="true" focusable="false">
      <path d="M2 12 H24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M22 5 L32 12 L22 19 Z" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tahta
// ---------------------------------------------------------------------------

const BOARD = { pad: 7, titleW: 104, slotW: 66, slotH: 88, gap: 6, stripH: 20 } as const;
const VARIANT_RANGE: Readonly<Record<BoardVariant, string>> = {
  small: '5–6',
  medium: '7–8',
  large: '9–10',
};

/**
 * Politika tahtası. Yuva sayısı, yuva → yetki eşlemesi, veto yuvası ve Hitler
 * bölgesi `boardSlotArt()` üzerinden `BOARD_LAYOUTS`tan TÜRER.
 */
export function PolicyBoardArt({ party, variant }: { party: PolicyType; variant: BoardVariant }) {
  const t = useT();
  const language = useLanguage();
  const slots = boardSlotArt(party, variant);
  const color = palette[party];
  const strip = party === 'fascist' ? BOARD.stripH : 0;
  const x0 = BOARD.pad + BOARD.titleW + 10;
  const y0 = BOARD.pad + 4 + (strip ? strip + 4 : 0);
  const w = x0 + slots.length * BOARD.slotW + (slots.length - 1) * BOARD.gap + BOARD.pad;
  const h = y0 + BOARD.slotH + BOARD.pad + 4;
  const innerH = h - BOARD.pad * 2;
  const zone = slots.filter((slot) => slot.hitlerZone);
  const slotX = (index: number) => x0 + index * (BOARD.slotW + BOARD.gap);

  return (
    <svg
      className="howto-art__board"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={t('howto.art.board.label', {
        party: sceneText(language, party === 'liberal' ? 'board.liberal' : 'board.fascist'),
        slots: slots.length,
        players: VARIANT_RANGE[variant],
      })}
    >
      <rect x="0" y="0" width={w} height={h} rx="7" fill={palette.cream} />
      <rect x="3" y="3" width={w - 6} height={h - 6} rx="5" fill="none" stroke={color} strokeWidth="2" />

      {/* Sol başlık bloğu — 3D tahtadaki gibi parti rengi + amblem. */}
      <rect x={BOARD.pad} y={BOARD.pad} width={BOARD.titleW} height={innerH} fill={color} />
      <Emblem
        party={party}
        x={BOARD.pad + BOARD.titleW / 2}
        y={BOARD.pad + innerH * 0.3}
        r={innerH * 0.19}
        color={palette.cream}
        cutout={color}
      />
      <text
        x={BOARD.pad + BOARD.titleW / 2}
        y={BOARD.pad + innerH * 0.63}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={innerH * 0.13}
        fontWeight="700"
        letterSpacing="1"
        fill={palette.cream}
      >
        {sceneText(language, party === 'liberal' ? 'board.liberal' : 'board.fascist')}
      </text>
      <text
        x={BOARD.pad + BOARD.titleW / 2}
        y={BOARD.pad + innerH * 0.83}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={innerH * 0.078}
        letterSpacing="0.6"
        fill={palette.cream}
        opacity="0.9"
      >
        {`${VARIANT_RANGE[variant]} ${t('howto.art.board.players')}`}
      </text>

      {/* Hitler bölgesi şeridi (yalnız faşist tahta). */}
      {zone.length > 0 && zone[0] ? (
        <>
          <rect
            x={slotX(zone[0].index)}
            y={BOARD.pad + 4}
            width={
              slotX(zone[zone.length - 1]!.index) + BOARD.slotW - slotX(zone[0].index)
            }
            height={BOARD.stripH}
            rx="4"
            fill={boardTokens.fascistDeep}
          />
          <text
            x={(slotX(zone[0].index) + slotX(zone[zone.length - 1]!.index) + BOARD.slotW) / 2}
            y={BOARD.pad + 4 + BOARD.stripH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="11"
            fontWeight="700"
            letterSpacing="0.6"
            fill={palette.cream}
          >
            {t('howto.art.board.hitlerZone')}
          </text>
        </>
      ) : null}

      {slots.map((slot) => (
        <g key={slot.index}>
          <rect
            x={slotX(slot.index)}
            y={y0}
            width={BOARD.slotW}
            height={BOARD.slotH}
            rx="3"
            fill={slot.victory ? color : 'none'}
            fillOpacity={slot.victory ? 0.12 : 1}
            stroke={boardTokens.line}
            strokeWidth="1.6"
          />
          <text
            x={slotX(slot.index) + 7}
            y={y0 + 13}
            dominantBaseline="central"
            fontSize="12"
            fontWeight="600"
            fill={boardTokens.num}
          >
            {String(slot.index + 1).padStart(2, '0')}
          </text>
          {slot.icon ? (
            <Glyph
              icon={slot.icon}
              x={slotX(slot.index) + (BOARD.slotW - 44) / 2}
              y={y0 + (BOARD.slotH - 44) / 2 - 4}
              size={44}
              color={slot.victory ? palette.brass : color}
              opacity={0.9}
            />
          ) : null}
          {slot.veto ? (
            <>
              <rect
                x={slotX(slot.index) + 9}
                y={y0 + BOARD.slotH - 22}
                width={BOARD.slotW - 18}
                height={15}
                rx="3.5"
                fill={palette.brass}
              />
              <text
                x={slotX(slot.index) + BOARD.slotW / 2}
                y={y0 + BOARD.slotH - 14.5}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="9.5"
                fontWeight="700"
                letterSpacing="0.8"
                fill={boardTokens.ink}
              >
                VETO
              </text>
            </>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

/** Tahtanın altındaki okunur açıklama: yuva numarası → yetki adı. */
function BoardLegend({ party, variant }: { party: PolicyType; variant: BoardVariant }) {
  const t = useT();
  const slots = boardSlotArt(party, variant).filter((slot) => slot.power || slot.victory);
  if (slots.length === 0) return null;
  return (
    <ul className="howto-art__legend">
      {slots.map((slot) => (
        <li key={slot.index}>
          <span className="howto-art__legend-num">{slot.index + 1}</span>
          {slot.icon ? (
            <PowerGlyph icon={slot.icon} color={slot.victory ? palette.brass : palette[party]} />
          ) : null}
          <span>
            {slot.victory
              ? t('howto.art.legend.victory', { winner: winnerName(party) })
              : powerName(slot.power!)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** İki tahta + masa boyu anahtarı. Düzenler `BOARD_LAYOUTS`tan listelenir. */
function BoardsFigure({ playerCount }: { playerCount?: number }) {
  const t = useT();
  const [variant, setVariant] = useState<BoardVariant>(() => variantForPlayers(playerCount));
  return (
    <div className="howto-art__boards">
      <div className="howto-art__variants" role="group" aria-label={t('howto.art.board.size')}>
        <span className="howto-art__variants-label">{t('howto.art.board.size')}</span>
        {boardVariantOptions().map((option) => (
          <button
            key={option.variant}
            type="button"
            className={`howto-art__variant${variant === option.variant ? ' is-on' : ''}`}
            aria-pressed={variant === option.variant}
            onClick={() => setVariant(option.variant)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {(['liberal', 'fascist'] as const).map((party) => (
        <div key={party} className="howto-art__board-row">
          <PolicyBoardArt party={party} variant={variant} />
          <BoardLegend party={party} variant={variant} />
        </div>
      ))}
    </div>
  );
}

/** Dolu/boş yuvalardan oluşan mini şerit (zafer ve Hitler bölgesi görselleri). */
function SlotStrip({
  party,
  filled,
  variant,
  zoneFrom,
}: {
  party: PolicyType;
  filled: number;
  variant: BoardVariant;
  zoneFrom?: number;
}) {
  const t = useT();
  const total = party === 'liberal' ? BOARD_LAYOUTS[variant].liberalSlots : BOARD_LAYOUTS[variant].fascistSlots;
  const w = total * 26 + 4;
  return (
    <svg
      className="howto-art__strip"
      viewBox={`0 0 ${w} 38`}
      role="img"
      aria-label={t('howto.art.strip.label', { filled, total })}
    >
      {Array.from({ length: total }, (_u, i) => (
        <rect
          key={i}
          x={2 + i * 26}
          y={zoneFrom !== undefined && i >= zoneFrom ? 6 : 2}
          width={22}
          height={zoneFrom !== undefined && i >= zoneFrom ? 30 : 34}
          rx="2.5"
          fill={i < filled ? palette[party] : 'none'}
          stroke={i < filled ? palette[party] : boardTokens.line}
          strokeWidth="1.6"
        />
      ))}
      {zoneFrom !== undefined ? (
        <rect
          x={1 + zoneFrom * 26}
          y="1"
          width={(total - zoneFrom) * 26}
          height="36"
          rx="3"
          fill="none"
          stroke={boardTokens.fascistDeep}
          strokeWidth="2"
          strokeDasharray="4 3"
        />
      ) : null}
    </svg>
  );
}

/** Seçim sayacı: `ELECTION_TRACKER_MAX` adım + kaos. */
function TrackerFigure() {
  const t = useT();
  const language = useLanguage();
  const steps = ELECTION_TRACKER_MAX + 1;
  const w = steps * 56 + 8;
  return (
    <svg className="howto-art__tracker" viewBox={`0 0 ${w} 84`} role="img" aria-label={sceneText(language, 'board.tracker')}>
      <rect x="0" y="0" width={w} height="84" rx="6" fill={boardTokens.paper2} />
      <text
        x={w / 2}
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="12"
        fontWeight="700"
        letterSpacing="1.4"
        fill={boardTokens.ink}
      >
        {sceneText(language, 'board.tracker')}
      </text>
      <path
        d={`M${32} 46 H${8 + (steps - 1) * 56 + 24}`}
        stroke={boardTokens.line}
        strokeWidth="2"
      />
      {Array.from({ length: steps }, (_u, i) => {
        const cx = 32 + i * 56;
        const chaos = i === steps - 1;
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy="46"
              r="15"
              fill={chaos ? palette.fascist : boardTokens.paper2}
              stroke={chaos ? palette.fascist : boardTokens.ink2}
              strokeWidth="2"
            />
            <text
              x={cx}
              y="46"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="15"
              fontWeight="700"
              fill={chaos ? palette.cream : boardTokens.ink2}
            >
              {i}
            </text>
          </g>
        );
      })}
      <text
        x={32 + (steps - 1) * 56}
        y="73"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="700"
        letterSpacing="1"
        fill={palette.fascist}
      >
        {t('howto.art.tracker.chaos')}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Bölüm görselleri
// ---------------------------------------------------------------------------

function Step({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="howto-art__step">
      <div className="howto-art__step-art">{children}</div>
      <p className="howto-art__step-cap">{caption}</p>
    </div>
  );
}

/** Anahtarlar açıkça yazılır: eksik çeviri derlemede yakalansın. */
const ROLE_CAPTION = {
  liberal: 'howto.art.role.liberal',
  fascist: 'howto.art.role.fascist',
  hitler: 'howto.art.role.hitler',
} as const satisfies Record<'liberal' | 'fascist' | 'hitler', TextKey>;

function RolesFigure() {
  const t = useT();
  return (
    <div className="howto-art__row">
      {(['liberal', 'fascist', 'hitler'] as const).map((role) => (
        <Step key={role} caption={t(ROLE_CAPTION[role])}>
          <RoleCard role={role} />
        </Step>
      ))}
      <Step caption={t('howto.art.role.envelope')}>
        <EnvelopeArt />
      </Step>
    </div>
  );
}

function RoundFigure() {
  const t = useT();
  return (
    <div className="howto-art__row howto-art__row--flow">
      <Step caption={t('howto.art.round.nominate')}>
        <div className="howto-art__pair">
          <SeatChip role="plate.president" />
          <Arrow />
          <SeatChip role="plate.chancellor" />
        </div>
      </Step>
      <Arrow />
      <Step caption={t('howto.art.round.vote')}>
        <div className="howto-art__pair">
          <BallotCard vote="yes" />
          <BallotCard vote="no" />
        </div>
      </Step>
      <Arrow />
      <Step caption={t('howto.art.round.enact')}>
        <div className="howto-art__pair">
          <PolicyCard policy="liberal" />
          <PolicyCard policy="fascist" />
        </div>
      </Step>
    </div>
  );
}

function LegislationFigure() {
  const t = useT();
  const language = useLanguage();
  return (
    <div className="howto-art__row howto-art__row--flow">
      <Step caption={t('howto.art.legislation.draw', { count: PRESIDENT_DRAW_COUNT })}>
        <div className="howto-art__pair howto-art__pair--tight">
          {Array.from({ length: PRESIDENT_DRAW_COUNT }, (_u, i) => (
            <CardBack key={i} label={sceneText(language, 'card.policy')} />
          ))}
        </div>
      </Step>
      <Arrow />
      <Step caption={t('howto.art.legislation.pass', { count: CHANCELLOR_DRAW_COUNT })}>
        <div className="howto-art__pair howto-art__pair--tight">
          {Array.from({ length: CHANCELLOR_DRAW_COUNT }, (_u, i) => (
            <CardBack key={i} label={sceneText(language, 'card.policy')} />
          ))}
        </div>
      </Step>
      <Arrow />
      <Step caption={t('howto.art.legislation.enact')}>
        <PolicyCard policy="fascist" />
      </Step>
    </div>
  );
}

function TermLimitFigure() {
  const t = useT();
  return (
    <div className="howto-art__row">
      <Step caption={t('howto.art.termLimit.president')}>
        <SeatChip role="plate.president" struck />
      </Step>
      <Step caption={t('howto.art.termLimit.chancellor')}>
        <SeatChip role="plate.chancellor" struck />
      </Step>
    </div>
  );
}

function VetoFigure() {
  const t = useT();
  const language = useLanguage();
  const layout = BOARD_LAYOUTS.small;
  return (
    <div className="howto-art__row howto-art__row--flow">
      <Step caption={t('howto.art.veto.unlock', { slot: layout.vetoUnlockAt })}>
        <SlotStrip party="fascist" variant="small" filled={layout.vetoUnlockAt} />
      </Step>
      <Arrow />
      <Step caption={t('howto.art.veto.propose')}>
        <div className="howto-art__pair howto-art__pair--tight howto-art__pair--stamped">
          <CardBack label={sceneText(language, 'card.policy')} />
          <CardBack label={sceneText(language, 'card.policy')} />
          <span className="howto-art__stamp">{sceneText(language, 'board.veto')}</span>
        </div>
      </Step>
      <Arrow />
      <Step caption={t('howto.art.veto.tracker')}>
        <TrackerFigure />
      </Step>
    </div>
  );
}

function HitlerZoneFigure() {
  const t = useT();
  const layout = BOARD_LAYOUTS.small;
  return (
    <div className="howto-art__row howto-art__row--flow">
      <Step caption={t('howto.art.hitler.zone', { slot: layout.hitlerChancellorWinAt })}>
        <SlotStrip
          party="fascist"
          variant="small"
          filled={layout.hitlerChancellorWinAt}
          zoneFrom={layout.hitlerChancellorWinAt - 1}
        />
      </Step>
      <Arrow />
      <Step caption={t('howto.art.hitler.elected')}>
        <div className="howto-art__pair">
          <RoleCard role="hitler" />
          <SeatChip role="plate.chancellor" />
        </div>
      </Step>
      <Arrow />
      <Step caption={t('howto.art.hitler.win', { winner: winnerName('fascist') })}>
        <PowerGlyph icon="victory" color={palette.fascist} large />
      </Step>
    </div>
  );
}

function VictoryFigure() {
  const t = useT();
  const layout = BOARD_LAYOUTS.small;
  return (
    <div className="howto-art__row howto-art__row--wrap">
      <Step caption={t('howto.art.victory.liberalBoard', { slots: layout.liberalSlots })}>
        <SlotStrip party="liberal" variant="small" filled={layout.liberalSlots} />
      </Step>
      <Step caption={t('howto.art.victory.hitlerDead')}>
        <PowerGlyph icon="execution" color={palette.liberal} large />
      </Step>
      <Step caption={t('howto.art.victory.fascistBoard', { slots: layout.fascistSlots })}>
        <SlotStrip party="fascist" variant="small" filled={layout.fascistSlots} />
      </Step>
      <Step caption={t('howto.art.victory.hitlerChancellor', { slot: layout.hitlerChancellorWinAt })}>
        <RoleCard role="hitler" />
      </Step>
    </div>
  );
}

/** Bölüm kimliği → görsel. `howToPlay.ts`teki `art` bloğu bunu çağırır. */
export function HowToPlayArt({ id, playerCount }: { id: HowToPlayArtId; playerCount?: number }) {
  switch (id) {
    case 'roles':
      return <RolesFigure />;
    case 'round':
      return <RoundFigure />;
    case 'legislation':
      return <LegislationFigure />;
    case 'tracker':
      return <TrackerFigure />;
    case 'termLimit':
      return <TermLimitFigure />;
    case 'boards':
      return <BoardsFigure playerCount={playerCount} />;
    case 'veto':
      return <VetoFigure />;
    case 'hitlerZone':
      return <HitlerZoneFigure />;
    case 'victory':
      return <VictoryFigure />;
    default: {
      const exhaustive: never = id;
      void exhaustive;
      return null;
    }
  }
}
