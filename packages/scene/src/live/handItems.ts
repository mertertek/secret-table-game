import type { SceneView } from '@secret-table/contracts';
import type { CardArt } from '../materials/cardArt';
export type HandItem = { id: string; art: CardArt };
/** Only current authorized private data; synthetic keys are local geometry keys,
 * never action/option/card IDs sent to the app. */
export function handItems(view: SceneView): readonly HandItem[] {
  if (view.privateView.hand.length) return view.privateView.hand.slice(0, 3).map((c) => ({ id: c.cardId, art: { kind: 'policy', policy: c.policy } }));
  if (view.phase === 'voting' && !view.players.find((p) => p.playerId === view.localPlayerId)?.hasVoted) return (['yes', 'no'] as const).map((vote) => ({ id: `local-ballot-${vote}`, art: { kind: 'ballot', vote } }));
  const inspection = view.privateView.inspection;
  if (inspection?.kind === 'policy_peek') return inspection.upcoming.map((policy, i) => ({ id: `local-peek-${i}`, art: { kind: 'policy', policy } }));
  if (inspection?.kind === 'party_membership') return [{ id: 'local-membership', art: { kind: 'membership', party: inspection.party } }];
  return [];
}
