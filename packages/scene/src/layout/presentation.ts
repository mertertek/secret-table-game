import type { ActionOption, AllowedAction, SceneIntent, SceneSelection, SceneView } from '@secret-table/contracts';
import type { InspectionMode } from './cameraFraming';
/** Inspect is an opening request; concealing a local role must never reopen HTML. */
export function roleToggleIntent(isOpen: boolean, controlled = false): SceneIntent | null {
  if (controlled) return { type: 'inspect_own_role', open: !isOpen };
  return isOpen ? null : { type: 'inspect_own_role' };
}
export function availableSceneActions(view: SceneView): readonly AllowedAction[] {
  return view.connection === 'connected' && !view.paused ? view.actions.filter((action) => action.phaseId === view.phaseId) : [];
}
export function selectedSceneOption(actions: readonly AllowedAction[], selection: SceneSelection | null) {
  return actions.find((action) => action.actionId === selection?.actionId)?.options.find((option) => option.optionId === selection?.optionId);
}
export function pickOption(actions: readonly AllowedAction[], match: (option: ActionOption) => boolean): SceneIntent | null {
  for (const action of actions) {
    const option = action.options.find(match);
    if (option) return { type: 'select_option', actionId: action.actionId, optionId: option.optionId };
  }
  return null;
}

/** Never place another player's private role or a previous election's vote on the table. */
export function publicSeatCard(view: SceneView, playerId: string) {
  if (view.phase === 'game_over') {
    const role = view.result?.revealedRoles.find((item) => item.playerId === playerId)?.role;
    if (role) return { kind: 'role' as const, role };
  }
  if (view.phase === 'election_result') {
    const vote = view.table.lastElection?.votes.find((item) => item.playerId === playerId)?.vote;
    if (vote) return { kind: 'ballot' as const, vote };
  }
  const player = view.players.find((item) => item.playerId === playerId);
  if (view.phase === 'voting' && player?.hasVoted) return { kind: 'ballot' as const };
  return { kind: 'envelope' as const };
}

// --- D11: tek sağ üst araç çubuğu ------------------------------------------

/**
 * Uygulamanın sürdüğü tahta incelemesi. `off` → genel masa.
 * D15: `lean` KOLTUK kipinde tahtaların üstüne eğilmedir (tepeden inceleme değil);
 * genel bakışta eski `liberal`/`fascist` tepeden kadrajı sürer.
 */
export type BoardInspection = 'off' | 'liberal' | 'fascist' | 'lean';

/**
 * Sahnenin kendi sağ üst kamera/inceleme şeridi (`.st-inspection-nav`) çizilsin mi.
 * Varsayılan `true`: `/dev/scene` ve prototip sayfaları bozulmaz. Üretimde
 * uygulama `showInspectionNav={false}` verir ve TEK araç çubuğunu HUD'da çizer.
 */
export function inspectionNavVisible(showInspectionNav?: boolean): boolean {
  return showInspectionNav !== false;
}

/**
 * İnceleme kipinin tek kaynağı. Özel alan her zaman önceliklidir; tahta
 * incelemesi verilmişse UYGULAMA denetimlidir, verilmemişse sahnenin kendi
 * yerel durumu (prototip / bağımsız kullanım) geçerlidir.
 */
export function resolveInspectionMode(params: {
  inspectOpen?: boolean;
  boardInspection?: BoardInspection;
  fallback: InspectionMode;
}): InspectionMode {
  if (params.inspectOpen) return 'private';
  if (params.boardInspection !== undefined) {
    return params.boardInspection === 'off' ? 'overview' : params.boardInspection;
  }
  return params.fallback;
}

/** Sahne içi düğme bir kipe geçtiğinde uygulamaya bildirilecek tahta durumu. */
export function boardInspectionForMode(mode: InspectionMode): BoardInspection {
  return mode === 'liberal' || mode === 'fascist' || mode === 'lean' ? mode : 'off';
}

/** D15: eğilme yalnız koltuk kamerasında anlamlıdır; genel bakışta tepeden inceleme sürer. */
export function boardInspectionForToggle(current: BoardInspection, seat: boolean): BoardInspection {
  if (current !== 'off') return 'off';
  return seat ? 'lean' : 'fascist';
}
