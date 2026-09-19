/**
 * @secret-table/scene — 3D masa sahnesi paketi.
 *
 * Dışa açılan tek bileşen `TableScene` ve prop tipleridir. Uygulama iç
 * `objects/`, `materials/`, `layout/` yollarına bağımlı olmaz.
 *
 * C00 devrinden sonra bu paketin sahibi Codex'tir (docs/COORDINATION.md).
 */

export { TableScene } from './TableScene';
/** D11 — sözleşme dışı yerleşim propsları (sahne şeridi / tahta incelemesi). */
export type { TableSceneLayoutProps } from './TableScene';
export { boardInspectionForMode, inspectionNavVisible, resolveInspectionMode } from './layout/presentation';
export type { BoardInspection } from './layout/presentation';
/** D23 — sahne metinleri (dil sahneye propla gelir; web'in i18n'i içe aktarılmaz). */
export { sceneText, SceneLanguageContext, useSceneLanguage } from './i18n/sceneText';
export type { SceneLanguage, SceneTextKey } from './i18n/sceneText';
/** D3 QA görünümü — yalnız `/dev/characters` (import.meta.env.DEV) kullanır. */
export { CharacterGallery } from './characters/CharacterGallery';
export type { CharacterGalleryProps } from './characters/CharacterGallery';
/** D1 QA görünümü — yalnız `/dev/hands` (import.meta.env.DEV) kullanır. */
export { HandGallery } from './hands/HandGallery';
export type { HandGalleryProps, HandGalleryView } from './hands/HandGallery';
export type { GripName } from './hands/poses';
export type {
  SceneCue,
  SceneIntent,
  SceneQuality,
  SceneSelection,
  SceneView,
  TableSceneProps,
  ImmersiveSceneProps,
  SceneController,
  SceneTargets,
  HeadViewpoint,
  LocalViewpoint,
} from '@secret-table/contracts';
