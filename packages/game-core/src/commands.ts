/**
 * Motor iç komutları. Ağ zarfı (`GameCommand`) sunucuda bu tiplere eşlenir;
 * motor ağ/kimlik bilmez, yalnız `playerId` + niyet alır.
 */

import type { VoteValue } from '@secret-table/contracts';

export type EngineCommand =
  | { type: 'ack_role'; playerId: string }
  | { type: 'nominate'; playerId: string; chancellorId: string }
  | { type: 'vote'; playerId: string; vote: VoteValue }
  | { type: 'discard_policy'; playerId: string; cardId: string }
  | { type: 'enact_policy'; playerId: string; cardId: string }
  | { type: 'request_veto'; playerId: string }
  | { type: 'respond_veto'; playerId: string; accept: boolean }
  | { type: 'use_power'; playerId: string; targetId?: string }
  | { type: 'ack_private_result'; playerId: string };

export type EngineCommandType = EngineCommand['type'];
