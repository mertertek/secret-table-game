/**
 * Kurulum metaverisi — 5-10 oyuncu için tahta yuvaları, yürütme yetkileri, rol
 * dağılımı ve deste sayısı. Resmî Secret Hitler kuralları.
 *
 * **Tek kaynak (single source of truth).** Bu sabitleri hem saf oyun motoru
 * (`@secret-table/game-core`, kural uygulaması) hem 3D sahne (`@secret-table/scene`,
 * yuva/yetki ikonları) hem sunucu (`@secret-table/server`, projeksiyon) buradan
 * okur. Sahne kendi kural tablosunu üretmez (CODEX-005). Değerler yalnız Claude
 * tarafından değiştirilir (sözleşme sahipliği).
 *
 * Kaynak metin: https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf
 */

import type { BoardVariant, ExecutivePower, PlayerCount } from './scene';

/** Bir faşist yuvanın doldurulmasıyla açılan yetki; `'none'` = yetki yok. */
export type FascistSlotPower = ExecutivePower | 'none';

export type BoardLayout = {
  variant: BoardVariant;
  /** Bu düzeni kullanan başlangıç oyuncu sayıları. */
  playerCounts: readonly PlayerCount[];
  /** Liberal tahtadaki yuva sayısı (kazanmak için gereken liberal politika). */
  liberalSlots: 5;
  /** Faşist tahtadaki yuva sayısı (kazanmak için gereken faşist politika). */
  fascistSlots: 6;
  /**
   * Faşist yuva (0 tabanlı) -> o yuva bir HÜKÜMET politikasıyla dolduğunda
   * başkana verilen yetki. Uzunluk 6; son yuva (`index 5`) faşist zaferi, yetki yok.
   * Kaos (seçim sayacı) politikası yetki açmaz.
   */
  fascistPowers: readonly [
    FascistSlotPower,
    FascistSlotPower,
    FascistSlotPower,
    FascistSlotPower,
    FascistSlotPower,
    FascistSlotPower,
  ];
  /** Bu kadar faşist politika yürürlükteyken veto açılır. */
  vetoUnlockAt: 5;
  /** Bu kadar faşist politika yürürlükteyken Hitler şansölye seçilirse faşistler kazanır. */
  hitlerChancellorWinAt: 3;
};

export const BOARD_LAYOUTS: Readonly<Record<BoardVariant, BoardLayout>> = {
  small: {
    variant: 'small',
    playerCounts: [5, 6],
    liberalSlots: 5,
    fascistSlots: 6,
    fascistPowers: ['none', 'none', 'policy_peek', 'execution', 'execution', 'none'],
    vetoUnlockAt: 5,
    hitlerChancellorWinAt: 3,
  },
  medium: {
    variant: 'medium',
    playerCounts: [7, 8],
    liberalSlots: 5,
    fascistSlots: 6,
    fascistPowers: [
      'none',
      'investigate_loyalty',
      'call_special_election',
      'execution',
      'execution',
      'none',
    ],
    vetoUnlockAt: 5,
    hitlerChancellorWinAt: 3,
  },
  large: {
    variant: 'large',
    playerCounts: [9, 10],
    liberalSlots: 5,
    fascistSlots: 6,
    fascistPowers: [
      'investigate_loyalty',
      'investigate_loyalty',
      'call_special_election',
      'execution',
      'execution',
      'none',
    ],
    vetoUnlockAt: 5,
    hitlerChancellorWinAt: 3,
  },
};

export function boardVariantForPlayerCount(playerCount: PlayerCount): BoardVariant {
  if (playerCount <= 6) return 'small';
  if (playerCount <= 8) return 'medium';
  return 'large';
}

export function boardLayoutForPlayerCount(playerCount: PlayerCount): BoardLayout {
  return BOARD_LAYOUTS[boardVariantForPlayerCount(playerCount)];
}

/** Rol dağılımı. `fascists` Hitler'i saymaz; toplam = liberals + fascists + 1. */
export type RoleSetup = {
  playerCount: PlayerCount;
  liberals: number;
  fascists: number;
  /** Hitler faşistleri baştan biliyor mu? (yalnız 5-6 kişi.) */
  hitlerKnowsFascists: boolean;
};

export const ROLE_SETUPS: Readonly<Record<PlayerCount, RoleSetup>> = {
  5: { playerCount: 5, liberals: 3, fascists: 1, hitlerKnowsFascists: true },
  6: { playerCount: 6, liberals: 4, fascists: 1, hitlerKnowsFascists: true },
  7: { playerCount: 7, liberals: 4, fascists: 2, hitlerKnowsFascists: false },
  8: { playerCount: 8, liberals: 5, fascists: 2, hitlerKnowsFascists: false },
  9: { playerCount: 9, liberals: 5, fascists: 3, hitlerKnowsFascists: false },
  10: { playerCount: 10, liberals: 6, fascists: 3, hitlerKnowsFascists: false },
};

/** Politika destesi: 6 liberal + 11 faşist = 17 kart. */
export const POLICY_DECK_COMPOSITION = { liberal: 6, fascist: 11 } as const;

/** Seçim sayacı bu değere ulaşınca kaos: en üstteki politika otomatik yürürlüğe girer. */
export const ELECTION_TRACKER_MAX = 3 as const;

/** Başkanın çektiği kart sayısı / şansölyeye geçen kart sayısı. */
export const PRESIDENT_DRAW_COUNT = 3 as const;
export const CHANCELLOR_DRAW_COUNT = 2 as const;

/** Bu sayıda (veya az) oyuncu hayattayken yalnız son şansölye tur kısıtlıdır (son başkan değil). */
export const REDUCED_TERM_LIMIT_ALIVE_THRESHOLD = 5 as const;
