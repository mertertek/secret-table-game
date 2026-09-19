/**
 * D19 — "Nasıl oynanır" sekmesinin İÇERİĞİ (saf veri, DOM/React yok).
 *
 * Kullanıcı 2026-09-12: "menüye nasıl oynanır sekmesi, kuralları şu olursa
 * şuradan kullanırsın diye yaz". Bu yüzden her bölüm hem KURALI hem de bu
 * oyunda O KURALIN NEREDEN kullanıldığını (tuş, HUD, el) söyler.
 *
 * **Tek kaynak:** oyuncu sayısına bağlı sayılar burada ELLE yazılmaz. Rol
 * dağılımı `ROLE_SETUPS`, yetki yuvaları `BOARD_LAYOUTS`, sayaç/deste
 * sabitleri `rules.ts`, jest listesi `EMOTE_KINDS`/`EMOTE_LABEL` ve tuşlar
 * `controlScheme.ts` üzerinden TÜRETİLİR (test bunu doğrular). Kurallar
 * değişirse bu sekme kendiliğinden doğru kalır.
 */

import {
  BOARD_LAYOUTS,
  CHANCELLOR_DRAW_COUNT,
  ELECTION_TRACKER_MAX,
  EMOTE_KINDS,
  POLICY_DECK_COMPOSITION,
  PRESIDENT_DRAW_COUNT,
  REDUCED_TERM_LIMIT_ALIVE_THRESHOLD,
  ROLE_SETUPS,
  boardVariantForPlayerCount,
  type BoardLayout,
  type BoardVariant,
  type ExecutivePower,
  type PlayerCount,
  type PolicyType,
} from '@secret-table/contracts';
/**
 * D29 — görseller 3D masanın çizim sabitlerini kullanır (tek kaynak).
 * `@secret-table/scene/art` alt yolu `three`/R3F İÇERMEZ (bkz. `art.ts`).
 */
import { boardSlotPlans, hitlerStripSlots, type BoardIconKey } from '@secret-table/scene/art';

import { currentLanguage, t, type TextKey } from '../i18n';
import { OPTION_DIGITS } from '../immersive/controlScheme';
import { emoteLabel } from './emoteText';
import { powerName, powerNames } from './text';

// ---------------------------------------------------------------------------
// Blok tipleri
// ---------------------------------------------------------------------------

/** D29 — bölüm başına bir görsel (satır içi SVG, dış dosya yok). */
export type HowToPlayArtId =
  | 'roles'
  | 'round'
  | 'legislation'
  | 'tracker'
  | 'termLimit'
  | 'boards'
  | 'veto'
  | 'hitlerZone'
  | 'victory';

export type HowToPlayBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: readonly string[] }
  /** Tuş / kontrol satırları (`kbd` + açıklama). */
  | { kind: 'keys'; rows: readonly { keys: string; label: string }[] }
  /** D29 — çizim `howToPlayArt.tsx` içindedir; burada yalnız kimlik + altyazı. */
  | { kind: 'art'; art: HowToPlayArtId; caption: string }
  | {
      kind: 'table';
      /** Tablonun ne anlattığı (ekran okuyucu için `caption`). */
      caption: string;
      head: readonly string[];
      rows: readonly (readonly string[])[];
    };

export type HowToPlaySection = {
  id: string;
  title: string;
  blocks: readonly HowToPlayBlock[];
};

// ---------------------------------------------------------------------------
// rules.ts'den türetilen tablolar
// ---------------------------------------------------------------------------

const PLAYER_COUNTS = Object.keys(ROLE_SETUPS)
  .map((key) => Number(key) as PlayerCount)
  .sort((a, b) => a - b);

/** Oyuncu sayısı × rol dağılımı. `ROLE_SETUPS` tek kaynaktır. */
export function roleSetupTable(): Extract<HowToPlayBlock, { kind: 'table' }> {
  return {
    kind: 'table',
    caption: t('howto.roleTable.caption'),
    head: [
      t('howto.roleTable.players'),
      t('howto.roleTable.liberal'),
      t('howto.roleTable.fascist'),
      t('howto.roleTable.hitler'),
      t('howto.roleTable.knows'),
    ],
    rows: PLAYER_COUNTS.map((count) => {
      const setup = ROLE_SETUPS[count];
      return [
        `${setup.playerCount}`,
        `${setup.liberals}`,
        `${setup.fascists}`,
        '1',
        setup.hitlerKnowsFascists ? t('howto.yes') : t('howto.no'),
      ];
    }),
  };
}

/** Bir düzenin oyuncu sayılarını "5-6" gibi okunur yazar. */
function layoutLabel(layout: BoardLayout): string {
  const counts = [...layout.playerCounts];
  const first = counts[0];
  const last = counts[counts.length - 1];
  return first === last ? `${first}` : `${first}-${last}`;
}

function powerCell(): Readonly<Record<ExecutivePower | 'none', string>> {
  return { ...powerNames(), none: '—' };
}

/**
 * Oyuncu sayısı × faşist yuva → yetki tablosu. `BOARD_LAYOUTS.fascistPowers`
 * tek kaynaktır; son yuva faşist zaferi olduğu için "oyun biter" yazılır.
 */
export function powerTable(): Extract<HowToPlayBlock, { kind: 'table' }> {
  const layouts = Object.values(BOARD_LAYOUTS);
  const slots = layouts[0]?.fascistSlots ?? 6;
  return {
    kind: 'table',
    caption: t('howto.powerTable.caption'),
    head: [t('howto.roleTable.players'), ...Array.from({ length: slots }, (_u, i) => `${i + 1}.`)],
    rows: layouts.map((layout) => {
      const cells = powerCell();
      return [
        layoutLabel(layout),
        ...layout.fascistPowers.map((power, index) =>
          index === layout.fascistSlots - 1 && power === 'none'
            ? t('howto.powerTable.gameEnds')
            : cells[power],
        ),
      ];
    }),
  };
}

/** Hitler'in faşistleri bildiği oyuncu sayıları (`ROLE_SETUPS` tek kaynak). */
export function hitlerKnowsFascistsCounts(): PlayerCount[] {
  return PLAYER_COUNTS.filter((count) => ROLE_SETUPS[count].hitlerKnowsFascists);
}

/** Hangi yetki hangi oyuncu sayılarında var? (yetki bölümü başlıkları için.) */
export function playerCountsWithPower(power: ExecutivePower): PlayerCount[] {
  const out: PlayerCount[] = [];
  for (const layout of Object.values(BOARD_LAYOUTS)) {
    if (layout.fascistPowers.includes(power)) out.push(...layout.playerCounts);
  }
  return out.sort((a, b) => a - b);
}

function powerCountsLabel(power: ExecutivePower): string {
  const counts = playerCountsWithPower(power);
  if (counts.length === 0) return t('howto.powerCounts.none');
  const first = counts[0];
  const last = counts[counts.length - 1];
  return first === last
    ? t('howto.powerCounts.one', { count: first ?? 0 })
    : t('howto.powerCounts.range', { first: first ?? 0, last: last ?? 0 });
}

/**
 * Her yetki için "bu oyunda" satırı: kural + nereden kullanıldığı.
 * Metinler yetkinin gerçekten bulunduğu oyuncu sayılarını `BOARD_LAYOUTS`tan
 * okur, elle yazmaz.
 */
export function powerUsageBlocks(): Extract<HowToPlayBlock, { kind: 'list' }> {
  return {
    kind: 'list',
    items: [
      t('howto.s6.investigate', {
        power: powerName('investigate_loyalty'),
        counts: powerCountsLabel('investigate_loyalty'),
      }),
      t('howto.s6.special', {
        power: powerName('call_special_election'),
        counts: powerCountsLabel('call_special_election'),
      }),
      t('howto.s6.peek', {
        power: powerName('policy_peek'),
        counts: powerCountsLabel('policy_peek'),
        president: PRESIDENT_DRAW_COUNT,
      }),
      t('howto.s6.execution', {
        power: powerName('execution'),
        counts: powerCountsLabel('execution'),
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// D29 — tahta görselinin veri planı
// ---------------------------------------------------------------------------

/** Bir tahta yuvasının görsel planı. Kaynak `BOARD_LAYOUTS` (dolaylı). */
export type BoardSlotArt = {
  /** 0 tabanlı yuva numarası. */
  index: number;
  /** Yuva dolunca açılan yetki; yetkisiz ve zafer yuvasında `null`. */
  power: ExecutivePower | null;
  /** Yuvaya çizilecek ikon (`BOARD_ICONS` anahtarı); boş yuvada `null`. */
  icon: BoardIconKey | null;
  /** Tahtanın son yuvası: dolunca o parti kazanır. */
  victory: boolean;
  /** Bu yuva dolunca veto açılır (`vetoUnlockAt`). */
  veto: boolean;
  /** Hitler bölgesi (`hitlerChancellorWinAt` → son yuva), yalnız faşist tahta. */
  hitlerZone: boolean;
  /** Tahtanın kendi bandındaki büyük harf etiket (sahne metniyle aynı). */
  lines: readonly string[];
};

/**
 * Yuva → yetki/ikon planı. ELLE YAZILMAZ: `boardSlotPlans()` (scene) üzerinden
 * `BOARD_LAYOUTS`tan türer, yani 3D masadaki tahtanın birebir aynı planıdır.
 * `BOARD_LAYOUTS` değişirse görsel de değişir (test bunu doğrular).
 */
export function boardSlotArt(party: PolicyType, variant: BoardVariant): readonly BoardSlotArt[] {
  const zone = hitlerStripSlots(party, variant);
  const veto = BOARD_LAYOUTS[variant].vetoUnlockAt;
  return boardSlotPlans(party, variant, currentLanguage()).map((plan) => {
    const ghost = plan.ghost ?? null;
    return {
      index: plan.index,
      power: ghost && ghost !== 'victory' ? ghost : null,
      icon: ghost,
      victory: plan.band?.victory ?? false,
      veto: party === 'fascist' && plan.index + 1 === veto,
      hitlerZone: zone ? plan.index >= zone.from && plan.index <= zone.to : false,
      lines: plan.band?.lines ?? [],
    };
  });
}

/** Görselde gösterilecek tahta düzenleri (oyuncu sayısı etiketiyle). */
export function boardVariantOptions(): readonly { variant: BoardVariant; label: string }[] {
  return Object.values(BOARD_LAYOUTS).map((layout) => ({
    variant: layout.variant,
    label: layoutLabel(layout),
  }));
}

/** Oyuncu sayısı → tahta düzeni; sayı bilinmiyorsa en küçük masa. */
export function variantForPlayers(playerCount: number | undefined): BoardVariant {
  if (playerCount === undefined) return 'small';
  const clamped = Math.min(10, Math.max(5, Math.round(playerCount))) as PlayerCount;
  return boardVariantForPlayerCount(clamped);
}

// ---------------------------------------------------------------------------
// Kontroller
// ---------------------------------------------------------------------------

/**
 * Klavye satırları. Tuş adları `controlScheme.ts` bağlamalarıyla aynı fiziksel
 * tuşlardır (`E`, `1–9`, `Enter`, `Backspace`, `H`, `V`, `B`, `G`, `M`, `Esc`).
 * Tuş adları (`E`, `Enter`, `1–9`) dile göre DEĞİŞMEZ; yalnız açıklama çevrilir.
 */
export function keyboardRows(): readonly { keys: string; label: string }[] {
  return [
    { keys: t('howto.key.activateKeys'), label: t('howto.key.activate') },
    { keys: `1–${OPTION_DIGITS}`, label: t('howto.key.digits') },
    { keys: '← →', label: t('howto.key.arrows') },
    { keys: 'Enter', label: t('howto.key.enter') },
    { keys: 'Backspace', label: t('howto.key.backspace') },
    { keys: 'H', label: t('howto.key.identity') },
    { keys: 'V', label: t('howto.key.camera') },
    { keys: 'B', label: t('howto.key.lean') },
    { keys: 'G', label: t('howto.key.emote') },
    { keys: 'M', label: t('howto.key.menu') },
    { keys: 'Esc', label: t('howto.key.escape') },
  ];
}

/** Jest çarkındaki 8 jest — `EMOTE_KINDS` sırası (tasarım D16 §2). */
export function emoteRows(): readonly { keys: string; label: string }[] {
  return EMOTE_KINDS.map((kind, index) => ({
    keys: `${index + 1}`,
    label: emoteLabel(kind),
  }));
}

// ---------------------------------------------------------------------------
// Bölümler
// ---------------------------------------------------------------------------

/**
 * D29 — bölüm görseli. Altyazı anahtarları AÇIKÇA yazılır (şablon dizgi + cast
 * değil): eksik anahtar derlemede yakalansın.
 */
const ART_CAPTION: Readonly<Record<HowToPlayArtId, TextKey>> = {
  roles: 'howto.art.roles',
  round: 'howto.art.round',
  legislation: 'howto.art.legislation',
  tracker: 'howto.art.tracker',
  termLimit: 'howto.art.termLimit',
  boards: 'howto.art.boards',
  veto: 'howto.art.veto',
  hitlerZone: 'howto.art.hitlerZone',
  victory: 'howto.art.victory',
};

function art(id: HowToPlayArtId): Extract<HowToPlayBlock, { kind: 'art' }> {
  return { kind: 'art', art: id, caption: t(ART_CAPTION[id]) };
}

export function howToPlaySections(): readonly HowToPlaySection[] {
  return [
    {
      id: 'amac',
      title: t('howto.s1.title'),
      blocks: [
        { kind: 'text', text: t('howto.s1.text') },
        art('roles'),
        roleSetupTable(),
        {
          kind: 'list',
          items: [
            t('howto.s1.i1'),
            t('howto.s1.i2', { counts: hitlerKnowsFascistsCounts().join('-') }),
            t('howto.s1.i3'),
            t('howto.s1.i4'),
          ],
        },
      ],
    },
    {
      id: 'tur',
      title: t('howto.s2.title'),
      blocks: [
        art('round'),
        {
          kind: 'list',
          items: [
            t('howto.s2.i1'),
            t('howto.s2.i2', { digits: OPTION_DIGITS }),
            t('howto.s2.i3'),
            t('howto.s2.i4'),
            t('howto.s2.i5'),
          ],
        },
      ],
    },
    {
      id: 'yasama',
      title: t('howto.s3.title'),
      blocks: [
        art('legislation'),
        {
          kind: 'list',
          items: [
            t('howto.s3.i1', {
              liberal: POLICY_DECK_COMPOSITION.liberal,
              fascist: POLICY_DECK_COMPOSITION.fascist,
              total: POLICY_DECK_COMPOSITION.liberal + POLICY_DECK_COMPOSITION.fascist,
            }),
            t('howto.s3.i2', {
              president: PRESIDENT_DRAW_COUNT,
              chancellor: CHANCELLOR_DRAW_COUNT,
            }),
            t('howto.s3.i3', { president: PRESIDENT_DRAW_COUNT }),
            t('howto.s3.i4', {
              president: PRESIDENT_DRAW_COUNT,
              chancellor: CHANCELLOR_DRAW_COUNT,
            }),
            t('howto.s3.i5'),
          ],
        },
      ],
    },
    {
      id: 'sayac',
      title: t('howto.s4.title'),
      blocks: [
        art('tracker'),
        {
          kind: 'list',
          items: [
            t('howto.s4.i1', { max: ELECTION_TRACKER_MAX }),
            t('howto.s4.i2'),
            t('howto.s4.i3'),
            t('howto.s4.i4'),
            t('howto.s4.i5'),
          ],
        },
      ],
    },
    {
      id: 'kisit',
      title: t('howto.s5.title'),
      blocks: [
        art('termLimit'),
        {
          kind: 'list',
          items: [
            t('howto.s5.i1'),
            t('howto.s5.i2', { threshold: REDUCED_TERM_LIMIT_ALIVE_THRESHOLD }),
            t('howto.s5.i3'),
            t('howto.s5.i4'),
          ],
        },
      ],
    },
    {
      id: 'yetkiler',
      title: t('howto.s6.title'),
      blocks: [
        { kind: 'text', text: t('howto.s6.text') },
        art('boards'),
        powerTable(),
        powerUsageBlocks(),
        { kind: 'text', text: t('howto.s6.after') },
      ],
    },
    {
      id: 'veto',
      title: t('howto.s7.title'),
      blocks: [
        art('veto'),
        {
          kind: 'list',
          items: [
            t('howto.s7.i1', { slot: BOARD_LAYOUTS.small.vetoUnlockAt }),
            t('howto.s7.i2'),
            t('howto.s7.i3'),
            t('howto.s7.i4'),
            t('howto.s7.i5'),
          ],
        },
      ],
    },
    {
      id: 'hitler',
      title: t('howto.s8.title'),
      blocks: [
        art('hitlerZone'),
        {
          kind: 'list',
          items: [
            t('howto.s8.i1', { slot: BOARD_LAYOUTS.small.hitlerChancellorWinAt }),
            t('howto.s8.i2'),
            t('howto.s8.i3'),
            t('howto.s8.i4'),
          ],
        },
      ],
    },
    {
      id: 'zafer',
      title: t('howto.s9.title'),
      blocks: [
        art('victory'),
        {
          kind: 'list',
          items: [
            t('howto.s9.i1', { slots: BOARD_LAYOUTS.small.liberalSlots }),
            t('howto.s9.i2'),
            t('howto.s9.i3', { slots: BOARD_LAYOUTS.small.fascistSlots }),
            t('howto.s9.i4', { slot: BOARD_LAYOUTS.small.hitlerChancellorWinAt }),
            t('howto.s9.i5'),
          ],
        },
      ],
    },
    {
      id: 'kontrol',
      title: t('howto.s10.title'),
      blocks: [
        { kind: 'text', text: t('howto.s10.text') },
        { kind: 'keys', rows: keyboardRows() },
        {
          kind: 'list',
          items: [
            t('howto.s10.i1'),
            t('howto.s10.i2'),
            t('howto.s10.i3'),
            t('howto.s10.i4'),
          ],
        },
        { kind: 'text', text: t('howto.s10.emotes') },
        { kind: 'keys', rows: emoteRows() },
      ],
    },
  ];
}
