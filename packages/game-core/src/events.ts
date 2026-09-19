/**
 * Motor olayları. Sunucu bunları izinli `SceneCue`'lara (dar payload + `cueId`)
 * eşler; alıcı bazında filtreler. Motor olayları görsel süreye göre beklemez.
 */

import type { GameEndReason, Party, PolicyType, VoteValue } from '@secret-table/contracts';

export type GameEvent =
  | { kind: 'cards_dealt'; toPlayerId: string; cards: readonly PolicyType[] }
  /**
   * Herkese açık kapalı kart hareketi. Politika türü, kart kimliği veya sıra
   * bilgisi TAŞIMAZ (CONTRACT.md §7 gizlilik). Yalnız adet ve uçlar.
   */
  | {
      kind: 'cards_moved';
      count: number;
      from: 'deck' | 'president' | 'chancellor';
      to: 'president' | 'chancellor' | 'discard';
    }
  | {
      kind: 'votes_revealed';
      electionId: string;
      outcome: 'elected' | 'rejected';
      votes: readonly { playerId: string; vote: VoteValue }[];
    }
  | { kind: 'policy_enacted'; board: 'liberal' | 'fascist'; slotIndex: number; policy: PolicyType }
  | { kind: 'office_moved'; office: 'president' | 'chancellor'; toPlayerId: string }
  | { kind: 'player_eliminated'; playerId: string }
  | { kind: 'game_ended'; winner: Party; reason: GameEndReason };
