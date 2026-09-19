/**
 * @secret-table/fixtures — yalnızca sentetik sahne görünümleri.
 * Üretim oyununa dahil edilmez; sahne geliştirme ve testler içindir.
 */

export * from './builders';
export type { PeerFixture, SceneFixture } from './types';
export {
  DEFAULT_FIXTURE_ID,
  getSceneFixture,
  sceneFixtures,
  sceneFixtureList,
} from './registry';
