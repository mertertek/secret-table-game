import type { SceneSelection, SceneView } from '@secret-table/contracts';
import { VIEWPOINT_YAW_LIMIT } from '@secret-table/contracts';
import { availableSceneActions, pickOption } from '../layout/presentation';
import { clamp, lookLimits } from '../prototype/model';
import type { Look } from '../prototype/model';

/** Slot positions are never compacted: a missing permission leaves a null slot. */
export function sceneSlots(view: SceneView): readonly (SceneSelection | null)[] {
  const actions = availableSceneActions(view);
  const matches = view.privateView.hand.length ? view.privateView.hand.slice(0, 3).map((card) =>
    pickOption(actions, (option) => option.cardId === card.cardId)) : view.phase === 'voting' ? (['yes', 'no'] as const).map((vote) =>
    pickOption(actions, (option) => option.vote === vote)) : [];
  return matches.map((intent) => intent?.type === 'select_option' ? { actionId: intent.actionId, optionId: intent.optionId } : null);
}
export function validSelection(view: SceneView, selection: SceneSelection | null): SceneSelection | null {
  if (!selection) return null;
  return availableSceneActions(view).some((a) => a.actionId === selection.actionId && a.options.some((o) => o.optionId === selection.optionId)) ? selection : null;
}
export function relativeLook(look: Look, dx: number, dy: number, sensitivity = 1): Look {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return look;
  const speed = clamp(sensitivity, .2, 3);
  // Pointer Lock reports downwards-positive movementY; looking down is negative pitch.
  return { yaw: clamp(look.yaw - dx * .0024 * speed, -VIEWPOINT_YAW_LIMIT, VIEWPOINT_YAW_LIMIT), pitch: clamp(look.pitch - dy * .0024 * speed, lookLimits.pitchMin, lookLimits.pitchMax) };
}
export const selectionKey = (s: SceneSelection | null) => s ? `${s.actionId}/${s.optionId}` : '';
