import type { AllowedAction, PlayerCount } from '@secret-table/contracts';

import type { SceneFixture } from '../types';
import { boardVariantFor, makePlayers, makeView } from '../builders';

/**
 * 5-10 oyuncu için masa yerleşimi kapsamı (docs/CONTRACT.md bölüm 9 devir kontrolü).
 * Hepsi adaylık aşamasında; X01 koltuk/kamera yerleşimini bu setle deneyebilir.
 */
const SIZES: readonly PlayerCount[] = [5, 6, 7, 8, 9, 10];

function nominateFor(count: number): AllowedAction {
  const targets = [3, 4, count].filter((seat, index, all) => seat <= count && all.indexOf(seat) === index);
  return {
    actionId: 'act_nominate',
    kind: 'nominate',
    phaseId: `nomination_size_${count}`,
    requiresConfirmation: true,
    options: targets.map((seat) => ({
      optionId: `nom_p${seat}`,
      labelKey: 'player.name',
      targetPlayerId: `p${seat}`,
    })),
  };
}

export const tableSizeFixtures: readonly SceneFixture[] = SIZES.map((count) => ({
  id: `table-size-${count}`,
  title: `Masa — ${count} kişi (${boardVariantFor(count)})`,
  description: `${count} koltuklu adaylık görünümü. boardVariant ${boardVariantFor(count)}.`,
  view: makeView({
    phase: 'nomination',
    phaseId: `nomination_size_${count}`,
    revision: 10,
    localPlayerId: 'p1',
    playerCountAtStart: count,
    players: makePlayers({
      count,
      overrides: { 0: { isPresidentialCandidate: true } },
    }),
    table: { liberalPolicies: 0, fascistPolicies: 0, drawCount: 17 - count, discardCount: 0 },
    actions: [nominateFor(count)],
  }),
  cues: [],
  selection: null,
}));
