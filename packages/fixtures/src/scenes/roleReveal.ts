import type { AllowedAction } from '@secret-table/contracts';

import type { SceneFixture } from '../types';
import { makePlayers, makeView } from '../builders';

const players = makePlayers({ count: 7 });

const ackRole: AllowedAction = {
  actionId: 'act_ack_role',
  kind: 'ack_role',
  phaseId: 'role_reveal_1',
  requiresConfirmation: false,
  options: [{ optionId: 'ack', labelKey: 'role.ready' }],
};

export const roleRevealFascistFixture: SceneFixture = {
  id: 'role-reveal-fascist',
  title: 'Rol tanışması — faşist',
  description:
    'Yerel oyuncu faşist. knownPlayers başlangıç kuralıyla Hitler ve diğer faşisti içerir. Sadece ack_role aksiyonu.',
  view: makeView({
    phase: 'role_reveal',
    phaseId: 'role_reveal_1',
    revision: 8,
    players,
    localPlayerId: 'p1',
    privateView: {
      role: 'fascist',
      knownPlayers: [
        {
          playerId: 'p3',
          knowledge: { kind: 'role', role: 'hitler' },
          source: 'fascists_know_each_other',
        },
        {
          playerId: 'p6',
          knowledge: { kind: 'role', role: 'fascist' },
          source: 'fascists_know_each_other',
        },
      ],
    },
    actions: [ackRole],
  }),
  cues: [],
  selection: null,
};

export const roleRevealLiberalFixture: SceneFixture = {
  id: 'role-reveal-liberal',
  title: 'Rol tanışması — liberal',
  description: 'Yerel oyuncu liberal. knownPlayers boş; yalnızca kendi rolünü görür.',
  view: makeView({
    phase: 'role_reveal',
    phaseId: 'role_reveal_1',
    revision: 8,
    players,
    localPlayerId: 'p2',
    privateView: { role: 'liberal' },
    actions: [ackRole],
  }),
  cues: [],
  selection: null,
};
