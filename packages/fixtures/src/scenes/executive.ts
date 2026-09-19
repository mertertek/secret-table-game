import type { AllowedAction } from '@secret-table/contracts';

import type { SceneFixture } from '../types';
import { makePlayers, makeView } from '../builders';

const players = makePlayers({
  count: 9,
  overrides: {
    0: { office: 'president' },
    4: { office: 'chancellor' },
  },
});

// --- Yetki kullanımı: hedef seçimi ------------------------------------------

const investigate: AllowedAction = {
  actionId: 'act_use_power',
  kind: 'use_power',
  phaseId: 'executive_action_1',
  requiresConfirmation: true,
  options: [
    { optionId: 'target_p2', labelKey: 'player.name', targetPlayerId: 'p2' },
    { optionId: 'target_p6', labelKey: 'player.name', targetPlayerId: 'p6' },
    { optionId: 'target_p8', labelKey: 'player.name', targetPlayerId: 'p8' },
  ],
};

export const executiveActionFixture: SceneFixture = {
  id: 'executive-action',
  title: 'Yetki — sadakat incelemesi hedefi',
  description:
    'currentPower herkese açık: investigate_loyalty, aktör p1, hedef henüz yok. use_power hedef seçenekleri taşır.',
  view: makeView({
    phase: 'executive_action',
    phaseId: 'executive_action_1',
    revision: 40,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players,
    table: {
      liberalPolicies: 2,
      fascistPolicies: 3,
      drawCount: 9,
      discardCount: 6,
      currentPower: { power: 'investigate_loyalty', actorId: 'p1', targetId: null },
    },
    actions: [investigate],
  }),
  cues: [],
  selection: null,
};

// --- Özel inceleme sonucu + onay ---------------------------------------------

const ackPrivateResult: AllowedAction = {
  actionId: 'act_ack_private',
  kind: 'ack_private_result',
  phaseId: 'executive_action_1',
  requiresConfirmation: false,
  options: [{ optionId: 'ack', labelKey: 'inspection.ack' }],
};

export const inspectionResultFixture: SceneFixture = {
  id: 'inspection-result',
  title: 'Yetki — parti incelemesi sonucu',
  description:
    'Yalnız aktöre gönderilen inspection: p6 partisi fascist. currentPower.targetId dolu. ack_private_result ile kapatılır.',
  view: makeView({
    phase: 'executive_action',
    phaseId: 'executive_action_1',
    revision: 41,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players,
    table: {
      liberalPolicies: 2,
      fascistPolicies: 3,
      drawCount: 9,
      discardCount: 6,
      currentPower: { power: 'investigate_loyalty', actorId: 'p1', targetId: 'p6' },
    },
    privateView: {
      inspection: { kind: 'party_membership', targetId: 'p6', party: 'fascist' },
    },
    actions: [ackPrivateResult],
  }),
  cues: [],
  selection: null,
};

export const policyPeekFixture: SceneFixture = {
  id: 'policy-peek',
  title: 'Yetki — deste bakma sonucu',
  description: 'policy_peek: aktör destenin üç kartını görür. Sonuç yalnız ona gönderilir.',
  view: makeView({
    phase: 'executive_action',
    phaseId: 'executive_action_2',
    revision: 42,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players,
    table: {
      liberalPolicies: 3,
      fascistPolicies: 3,
      drawCount: 8,
      discardCount: 6,
      currentPower: { power: 'policy_peek', actorId: 'p1', targetId: null },
    },
    privateView: {
      inspection: { kind: 'policy_peek', upcoming: ['fascist', 'liberal', 'fascist'] },
    },
    actions: [{ ...ackPrivateResult, phaseId: 'executive_action_2' }],
  }),
  cues: [],
  selection: null,
};

// --- İnfaz sonucu (D9 duyuru önizlemesi) ------------------------------------

/**
 * İnfaz yetkisi uygulandı: hedef koltuk elendi ve `player_eliminated` cue'su
 * geldi. D9 ekran ortası duyurusunun `danger` tonunu gerçek tarayıcıda görmek
 * için eklendi; additive.
 */
export const executionResultFixture: SceneFixture = {
  id: 'execution-result',
  title: 'Yetki — infaz uygulandı',
  description:
    'player_eliminated cue geldi; hedef koltuk artık ölü. Duyuru katmanı infazı büyük başlıkla söyler.',
  view: makeView({
    phase: 'nomination',
    phaseId: 'nomination_5',
    revision: 44,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players: makePlayers({
      count: 9,
      overrides: {
        0: { office: 'president' },
        4: { office: 'chancellor' },
        5: { alive: false },
        1: { isPresidentialCandidate: true },
      },
    }),
    table: {
      liberalPolicies: 2,
      fascistPolicies: 4,
      drawCount: 8,
      discardCount: 7,
      currentPower: { power: 'execution', actorId: 'p1', targetId: 'p6' },
      publicHistory: [
        { entryId: 'h_pow_44', kind: 'power_used', power: 'execution', actorId: 'p1', targetId: 'p6' },
        { entryId: 'h_exec_44', kind: 'player_executed', targetId: 'p6' },
      ],
    },
    actions: [],
  }),
  cues: [
    {
      cueId: 'cue_exec_44',
      gameId: 'game_demo',
      revision: 44,
      kind: 'player_eliminated',
      playerId: 'p6',
    },
  ],
  selection: null,
};
