import type { SceneFixture } from './types';
import { lobbyAvatarsFixture, lobbyFixture } from './scenes/lobby';
import { roleRevealFascistFixture, roleRevealLiberalFixture } from './scenes/roleReveal';
import {
  electionResultCloseFixture,
  electionResultFixture,
  nominationFixture,
  votingFixture,
  votingSubmittedFixture,
  votingWaitingFixture,
} from './scenes/election';
import {
  legislativeSeatIdleFixture,
  chancellorChoiceFixture,
  chancellorChoiceVetoFixture,
  legislativeChancellorSeatFixture,
  legislativeChancellorSeatTwoCuesFixture,
  legislativePresidentSeatFixture,
  legislativeVetoSeatFixture,
  policyFascistThirdFixture,
  policyResultFixture,
  presidentDiscardFixture,
  presidentDiscardedFixture,
  vetoResponseFixture,
} from './scenes/legislative';
import {
  executionResultFixture,
  executiveActionFixture,
  inspectionResultFixture,
  policyPeekFixture,
} from './scenes/executive';
import {
  disconnectedPeerFixture,
  gameOverFascistFixture,
  gameOverLiberalFixture,
  reconnectingSelfFixture,
} from './scenes/endAndInterrupt';
import {
  executionChooseFixture,
  executionChooseSeatFixture,
  executionShotFixture,
  executionShotLocalFixture,
  executionShotSeatFixture,
  executionShotVictimFixture,
} from './scenes/execution';
import {
  emoteCrowdFixture,
  emoteLocalFixture,
  emoteLocalHandFixture,
  emotePeerFixtures,
} from './scenes/emotes';
import { longNamesFixture } from './scenes/longNames';
import { tableSizeFixtures } from './scenes/tableSizes';

/** /dev/scene sırasıyla gösterir: oyun akışı, sonra masa boyutları. */
export const sceneFixtureList: readonly SceneFixture[] = [
  lobbyFixture,
  lobbyAvatarsFixture,
  roleRevealFascistFixture,
  roleRevealLiberalFixture,
  nominationFixture,
  votingFixture,
  votingSubmittedFixture,
  votingWaitingFixture,
  electionResultFixture,
  electionResultCloseFixture,
  presidentDiscardFixture,
  presidentDiscardedFixture,
  chancellorChoiceFixture,
  chancellorChoiceVetoFixture,
  vetoResponseFixture,
  legislativePresidentSeatFixture,
  legislativeChancellorSeatFixture,
  legislativeChancellorSeatTwoCuesFixture,
  legislativeVetoSeatFixture,
  legislativeSeatIdleFixture,
  policyResultFixture,
  policyFascistThirdFixture,
  executiveActionFixture,
  inspectionResultFixture,
  policyPeekFixture,
  executionResultFixture,
  executionChooseFixture,
  executionChooseSeatFixture,
  executionShotFixture,
  executionShotLocalFixture,
  executionShotVictimFixture,
  executionShotSeatFixture,
  ...emotePeerFixtures,
  emoteCrowdFixture,
  emoteLocalFixture,
  emoteLocalHandFixture,
  gameOverLiberalFixture,
  gameOverFascistFixture,
  disconnectedPeerFixture,
  reconnectingSelfFixture,
  longNamesFixture,
  ...tableSizeFixtures,
];

export const sceneFixtures: Readonly<Record<string, SceneFixture>> = Object.fromEntries(
  sceneFixtureList.map((fixture) => [fixture.id, fixture]),
);

export const DEFAULT_FIXTURE_ID = lobbyFixture.id;

export function getSceneFixture(id: string): SceneFixture | undefined {
  return sceneFixtures[id];
}
