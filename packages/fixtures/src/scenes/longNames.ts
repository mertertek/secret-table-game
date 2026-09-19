import type { AllowedAction } from '@secret-table/contracts';

import type { SceneFixture } from '../types';
import { makePlayers, makeView } from '../builders';

/**
 * CODEX-005 isteği: 23+ karakter ve Türkçe uzun isim örneği. Nameplate 23
 * karakterden sonra üç nokta koyup tam adı hover/title ile verir (ASSETS A03).
 * Bu fixture o davranışı tarayıcıda doğrulamak içindir.
 */
const players = makePlayers({
  count: 7,
  overrides: {
    0: { isPresidentialCandidate: true },
  },
});

// Türkçe karakterli, farklı uzunluklarda adlar.
const longNames = [
  'Şükrü',
  'Ayşegül Müberra Çelikkoloğlu', // 28
  'İbrahim',
  'Zeynep Nur',
  'Konstantinopolisleştiremediklerimizden', // çok uzun
  'Cemre',
  'Ömür Ali Gökçeoğluları Karahisarlı', // 34
];

const withNames = players.map((player, index) => ({
  ...player,
  displayName: longNames[index] ?? player.displayName,
}));

const nominate: AllowedAction = {
  actionId: 'act_nominate',
  kind: 'nominate',
  phaseId: 'nomination_longnames',
  requiresConfirmation: true,
  options: [
    { optionId: 'nom_p2', labelKey: 'player.name', targetPlayerId: 'p2' },
    { optionId: 'nom_p5', labelKey: 'player.name', targetPlayerId: 'p5' },
    { optionId: 'nom_p7', labelKey: 'player.name', targetPlayerId: 'p7' },
  ],
};

export const longNamesFixture: SceneFixture = {
  id: 'long-names',
  title: 'Uzun isimler — kısaltma / hover',
  description:
    '23+ karakter ve Türkçe karakterli isimler. İsimlik kısaltmasını ve tam ad erişimini (hover/title) doğrulamak için.',
  view: makeView({
    phase: 'nomination',
    phaseId: 'nomination_longnames',
    revision: 11,
    localPlayerId: 'p1',
    players: withNames,
    table: { liberalPolicies: 1, fascistPolicies: 1, drawCount: 14, discardCount: 1 },
    actions: [nominate],
  }),
  cues: [],
  selection: null,
};
