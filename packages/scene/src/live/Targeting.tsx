import { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Frustum, Matrix4, Mesh, Raycaster, Vector2 } from 'three';
import type { SceneSelection } from '@secret-table/contracts';
import { selectionKey } from './inputs';
type Target = { mesh: Mesh; selection: SceneSelection; slot: boolean };
const Registry = createContext<Map<Mesh, Target> | null>(null);
export function Targeting({ enabled, onTarget, onSlotsVisible, children }: { enabled: boolean; onTarget: (selection: SceneSelection | null) => void; onSlotsVisible: (keys: readonly string[]) => void; children: ReactNode }) {
  const targets = useMemo(() => new Map<Mesh, Target>(), []);
  const raycaster = useMemo(() => new Raycaster(), []); const center = useMemo(() => new Vector2(), []);
  const last = useRef(''); const { camera, invalidate } = useThree();
  const lastSlots = useRef(''); const frustum = useMemo(() => new Frustum(), []); const matrix = useMemo(() => new Matrix4(), []);
  useLayoutEffect(() => { if (!enabled) { last.current = ''; onTarget(null); } invalidate(); }, [enabled, onTarget, invalidate]);
  useFrame(() => {
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const shown: Mesh[] = []; const slots: string[] = [];
    for (const { mesh, selection, slot } of targets.values()) {
      let visible = true; for (let parent = mesh.parent; parent; parent = parent.parent) if (!parent.visible) { visible = false; break; }
      if (!visible) continue;
      mesh.updateWorldMatrix(true, false);
      if (!frustum.intersectsObject(mesh)) continue;
      shown.push(mesh); if (slot) slots.push(selectionKey(selection));
    }
    const keySlots = JSON.stringify(slots.sort());
    if (keySlots !== lastSlots.current) { lastSlots.current = keySlots; onSlotsVisible(slots); }
    if (!enabled) return;
    raycaster.setFromCamera(center, camera);
    const hits = raycaster.intersectObjects(shown, false);
    const result = hits.length ? targets.get(hits[0]!.object as Mesh)?.selection ?? null : null;
    const key = selectionKey(result);
    if (key !== last.current) { last.current = key; onTarget(result); }
  });
  return <Registry.Provider value={targets}>{children}</Registry.Provider>;
}
/** Invisible to the renderer; ray-tested only while registered and authorized.
 * No DOM/global input listener, no command dispatch, no private payload. */
export function TargetZone({ selection, size, position = [0, 0, 0], slot = false }: { selection: SceneSelection | null; size: [number, number, number]; position?: [number, number, number]; slot?: boolean }) {
  const registry = useContext(Registry); const mesh = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const object = mesh.current;
    if (!object || !registry || !selection) return;
    registry.set(object, { mesh: object, selection, slot }); invalidate();
    return () => { registry.delete(object); invalidate(); };
  }, [registry, selection?.actionId, selection?.optionId, slot, invalidate]);
  if (!selection) return null;
  return <mesh ref={mesh} position={position} visible={false}><boxGeometry args={size} /><meshBasicMaterial /></mesh>;
}
