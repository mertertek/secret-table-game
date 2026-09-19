import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SceneController as Controller, SceneTargets as Targets, SceneSelection, SceneView } from '@secret-table/contracts';
import { clampViewpoint } from '@secret-table/contracts';
import { LEAN_LOOK } from '../layout/cameraFraming';
import { centeredLook, clamp, isDrag } from '../prototype/model';
import type { Look } from '../prototype/model';
import { LookChannel } from './lookChannel';
import { relativeLook, sceneSlots, selectionKey, validSelection } from './inputs';

/** `lean` (D15): kamera tahtaların üstüne eğilmiş; el/hedefleme kapalı ama göz gezdirme açık. */
type Inputs = { view: SceneView; selection: SceneSelection | null; seat: boolean; pointerLocked: boolean; suspended: boolean; privateReady: boolean; inspectOpen: boolean; lean?: boolean; sensitivity: number; onLook?: (look: Look) => void; onController?: (controller: Controller | null) => void; onTargetsChange?: (targets: Targets) => void };
/** App owns all global keyboard/lock events. These callbacks only act on presentation. */
export function useSceneControls(inputs: Inputs) {
  // PERF-C1 §4/1: bakış React state'i değil; kamera `useFrame` içinde okur.
  const channel = useRef<LookChannel | null>(null);
  const look = (channel.current ??= new LookChannel(centeredLook));
  const [inspectedIndex, setInspectedIndex] = useState(0);
  const [hovered, setHovered] = useState<SceneSelection | null>(null); const hoverNow = useRef<SceneSelection | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<readonly string[]>([]); const visibleNow = useRef<readonly string[]>([]);
  const latest = useRef(inputs); latest.current = inputs;
  const suppressUntil = useRef(0);
  /**
   * D15 — eğilmeye girerken okunan bakış. Eğilmede bakış bu çapanın ±12°/±8°
   * penceresinde KALIR: kanal da sınırlandığı için eğilmeden çıkınca koltuk
   * yönü kaymaz (kamera kadrajı `SeatCamera` tarafında ayrıca kırpılır).
   */
  const leanBase = useRef<Look | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; look: Look; moved: boolean } | null>(null);
  const count = inputs.view.privateView.hand.length || (inputs.view.phase === 'voting' ? 2 : inputs.view.privateView.inspection?.kind === 'policy_peek' ? inputs.view.privateView.inspection.upcoming.length : 1);
  const ready = !inputs.suspended && (!inputs.seat || inputs.privateReady);
  const slots = ready ? sceneSlots(inputs.view).map((s) => s && visibleKeys.includes(selectionKey(s)) ? s : null) : [];
  const index = Math.min(inspectedIndex, Math.max(0, count - 1));
  // A newly selected card comes fully into view. Subsequent inspection arrows
  // may browse another card without altering that application selection.
  const selectedKey = selectionKey(inputs.selection);
  useLayoutEffect(() => {
    if (!selectedKey) return;
    const selectedIndex = sceneSlots(inputs.view).findIndex((s) => selectionKey(s) === selectedKey);
    if (selectedIndex >= 0) setInspectedIndex(selectedIndex);
  }, [selectedKey]);
  // Kamera değeri hemen görür (ref + `invalidate`); uygulamaya/ağa bildirim
  // eskisi gibi rAF başına en fazla bir kez ve aynı kapılardan geçerek gider.
  if (!inputs.lean) leanBase.current = null;
  else leanBase.current ??= { ...look.current };
  const withinLean = (value: Look): Look => {
    const base = leanBase.current;
    if (!base) return value;
    return { yaw: clamp(value.yaw, base.yaw - LEAN_LOOK.yaw, base.yaw + LEAN_LOOK.yaw),
      pitch: clamp(value.pitch, base.pitch - LEAN_LOOK.pitch, base.pitch + LEAN_LOOK.pitch) };
  };
  const pushLook = (raw: Look) => look.set(withinLean(raw), (current) => {
    const now = latest.current;
    if (now.suspended || !now.seat || now.inspectOpen) return;
    now.onLook?.(clampViewpoint(current));
  });
  const controller = useMemo<Controller>(() => ({
    lookBy(dx, dy) { const i = latest.current; if (i.pointerLocked && i.seat && !i.suspended && (i.lean || (!i.inspectOpen && i.privateReady))) pushLook(relativeLook(look.current, dx, dy, i.sensitivity)); },
    inspectBy(step) { const i = latest.current; if (i.suspended || (step !== -1 && step !== 1)) return; const count = i.view.privateView.hand.length || (i.view.phase === 'voting' ? 2 : i.view.privateView.inspection?.kind === 'policy_peek' ? i.view.privateView.inspection.upcoming.length : 1); setInspectedIndex((n) => (Math.min(n, count - 1) + step + count) % count); },
    selectSlot(index) { const i = latest.current; if (i.suspended || (i.seat && !i.privateReady) || !Number.isInteger(index) || index < 0 || index > 2) return null; const slot = sceneSlots(i.view)[index] ?? null; return slot && visibleNow.current.includes(selectionKey(slot)) ? slot : null; },
    target() { const i = latest.current; return i.suspended || !i.pointerLocked || !i.privateReady || i.inspectOpen ? null : validSelection(i.view, hoverNow.current); },
    resetLook() { const i = latest.current; if (!i.suspended && i.seat && !i.inspectOpen) pushLook({ ...centeredLook }); },
  }), []);
  useLayoutEffect(() => { inputs.onController?.(controller); return () => inputs.onController?.(null); }, [inputs.onController, controller]);
  useLayoutEffect(() => () => { inputs.onTargetsChange?.({ slots: [], hovered: null, inspectedIndex: 0 }); }, [inputs.onTargetsChange]);
  useLayoutEffect(() => () => look.dispose(), [look]);
  const slotKey = JSON.stringify(slots); const hoveredValid = ready && inputs.pointerLocked ? validSelection(inputs.view, hovered) : null;
  useLayoutEffect(() => { inputs.onTargetsChange?.({ slots, hovered: hoveredValid, inspectedIndex: index }); }, [inputs.onTargetsChange, slotKey, selectionKey(hoveredValid), index]);
  const onTarget = useCallback((target: SceneSelection | null) => { hoverNow.current = target; setHovered((p) => selectionKey(p) === selectionKey(target) ? p : target); }, []);
  const onSlotsVisible = useCallback((keys: readonly string[]) => { visibleNow.current = keys; setVisibleKeys(keys); }, []);
  const stop = (e: ReactPointerEvent<HTMLDivElement>) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); drag.current = null; };
  const handlers = {
    onPointerDownCapture(e: ReactPointerEvent<HTMLDivElement>) {
      if (!(e.target instanceof HTMLCanvasElement) || !e.isPrimary || e.button !== 0 || inputs.pointerLocked || inputs.suspended) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, look: look.current, moved: false };
    },
    onPointerMoveCapture(e: ReactPointerEvent<HTMLDivElement>) {
      const start = drag.current; if (!start || start.id !== e.pointerId || inputs.pointerLocked || inputs.suspended) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!start.moved && isDrag(dx, dy)) { start.moved = true; e.currentTarget.setPointerCapture(e.pointerId); }
      if (start.moved) { e.stopPropagation(); if (inputs.seat && (inputs.lean || !inputs.inspectOpen)) pushLook(relativeLook(start.look, dx, -dy, inputs.sensitivity)); }
    },
    onPointerUpCapture(e: ReactPointerEvent<HTMLDivElement>) {
      if (drag.current?.moved) { suppressUntil.current = performance.now() + 450; e.stopPropagation(); } stop(e);
    },
    onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) { suppressUntil.current = performance.now() + 450; stop(e); },
    onLostPointerCapture() { drag.current = null; },
  };
  return { look, index, hovered: hoveredValid, onTarget, onSlotsVisible, controller, handlers, canPick: () => !latest.current.suspended && (!latest.current.seat || latest.current.privateReady) && !latest.current.pointerLocked && document.pointerLockElement === null && performance.now() >= suppressUntil.current };
}
