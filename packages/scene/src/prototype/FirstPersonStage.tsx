import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { SceneQuality, SceneView } from '@secret-table/contracts';
import { SceneMaterials } from '../materials/SceneMaterials';
import { room } from '../materials/palette';
import { Table } from '../objects/Table';
import { Chair } from '../objects/Chair';
import { Nameplate } from '../objects/Nameplate';
import { Room, ROOM_LIGHTS } from '../room/Room';
import { PolicyBoard } from '../objects/PolicyBoard';
import { ElectionMarker } from '../objects/ElectionMarker';
import { CardStack } from '../objects/CardStack';
import { Block } from '../objects/Surface';
import { layoutSeats, seatAvatar } from '../layout/seats';
import { SceneDiagnostics } from '../layout/SceneDiagnostics';
import { HandRig } from './HandRig';
import { CharacterAvatar } from '../characters/CharacterAvatar';
import { PhysicalCard } from './PhysicalCard';
import { SeatCamera } from './SeatCamera';
import { centeredLook, constrainLook, draggedLook, isDrag } from './model';
import type { CameraMode, HeadSample, Look, RigState } from './model';

/** Experimental local entry only. Intentionally NOT exported by @secret-table/scene. */
export function FirstPersonStage({ view, mode, look, rig, heads, quality, reducedMotion, onLook, onSelect, onDrag }: {
  view: SceneView; mode: CameraMode; look: Look; rig: RigState; heads: readonly HeadSample[];
  quality: SceneQuality; reducedMotion: boolean; onLook: (look: Look) => void; onSelect: (index: number) => void; onDrag: () => void;
}) {
  const [privateReady, setPrivateReady] = useState(false);
  const seats = useMemo(() => layoutSeats(view), [view.players, view.localPlayerId, view.playerCountAtStart]);
  const local = seats.find((seat) => seat.player.playerId === view.localPlayerId)!;
  const drag = useRef<{ id: number; x: number; y: number; look: Look; moved: boolean } | null>(null);
  const suppressClickUntil = useRef(0);
  return <div className="fp-canvas" tabIndex={0} role="region" aria-label="3D masa ve bakış alanı" aria-describedby="fp-look-help"
    data-fp-mode={mode} data-fp-yaw={look.yaw.toFixed(3)} data-fp-pitch={look.pitch.toFixed(3)}
    onPointerDownCapture={(event) => {
      if (!(event.target instanceof HTMLCanvasElement) || !event.isPrimary || event.button !== 0) return;
      event.currentTarget.focus({ preventScroll: true }); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, look, moved: false };
    }}
    onPointerMoveCapture={(event) => {
      const start = drag.current; if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!start.moved && isDrag(dx, dy)) { start.moved = true; onDrag(); event.currentTarget.setPointerCapture(event.pointerId); }
      if (start.moved) { event.stopPropagation(); event.preventDefault(); if (mode === 'seat') onLook(draggedLook(start.look, dx, dy)); }
    }}
    onPointerUpCapture={(event) => {
      const start = drag.current; if (!start || start.id !== event.pointerId) return;
      if (start.moved) { suppressClickUntil.current = performance.now() + 450; event.stopPropagation(); event.preventDefault(); }
      drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={(event) => { drag.current = null; suppressClickUntil.current = performance.now() + 450; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
    onLostPointerCapture={() => { drag.current = null; }}
    onClickCapture={(event) => { if (performance.now() < suppressClickUntil.current) { event.stopPropagation(); event.preventDefault(); suppressClickUntil.current = 0; } }}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || mode !== 'seat') return;
      const next = { ...look };
      if (event.key === 'ArrowLeft') next.yaw += .08; else if (event.key === 'ArrowRight') next.yaw -= .08;
      else if (event.key === 'ArrowUp') next.pitch += .06; else if (event.key === 'ArrowDown') next.pitch -= .06;
      else if (event.key === 'Home') Object.assign(next, centeredLook); else return;
      event.preventDefault(); onLook(constrainLook(next));
    }}>
    <Canvas frameloop="demand" shadows={quality === 'standard' ? 'percentage' : false} dpr={quality === 'low' ? 1 : [1, 2]}
      camera={{ position: [0, 6, 6], fov: 40, near: .025, far: 100 }} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={[room.fog]} />
      <SeatCamera mode={mode} look={look} chair={local.chair} reducedMotion={reducedMotion} onPrivateReady={setPrivateReady} /><SceneDiagnostics />
      <hemisphereLight args={[ROOM_LIGHTS.hemisphere.sky, ROOM_LIGHTS.hemisphere.ground, ROOM_LIGHTS.hemisphere.intensity]} />
      <directionalLight position={ROOM_LIGHTS.key.position} intensity={ROOM_LIGHTS.key.intensity} color={ROOM_LIGHTS.key.color} castShadow={quality === 'standard'} shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-.0003} shadow-normalBias={.012} />
      <directionalLight position={ROOM_LIGHTS.fill.position} intensity={ROOM_LIGHTS.fill.intensity} color={ROOM_LIGHTS.fill.color} />
      <SceneMaterials><Room quality={quality === 'low' ? 'low' : 'standard'} seat={mode !== 'overview'} /><Table />
        <group position={[0, .01, -.4]}><PolicyBoard party="liberal" count={2} variant={view.boardVariant} enacted={[]} /></group>
        <group position={[0, .01, .16]}><PolicyBoard party="fascist" count={2} variant={view.boardVariant} enacted={[]} /></group>
        <group position={[0, .012, .55]}><ElectionMarker value={1} /></group>
        <group position={[-.7, .009, .94]}><CardStack count={3} /></group>
        <group position={[.7, .009, .94]}><Block size={[.3, .014, .39]} color="#243c33" radius={.018} /></group>
        {seats.map((seat) => {
          const own = seat.player.playerId === view.localPlayerId;
          return <group key={seat.player.playerId}>
            <group position={seat.chair} rotation={[0, seat.angle, 0]}><Chair /></group>
            {(!own || mode === 'overview') && <group position={[seat.chair[0], 0, seat.chair[2]]} rotation={[0, seat.angle, 0]}>
              <CharacterAvatar {...seatAvatar(seat.player)} index={seat.player.seatIndex} sample={own ? undefined : heads.find((h) => h.playerId === seat.player.playerId)} connected={seat.player.connected} reducedMotion={reducedMotion} />
            </group>}
            {!own && <>
              <group position={seat.label}><Nameplate player={seat.player} local={false} targetable={false} selected={false} onPick={() => {}} /></group>
              <group position={seat.cards} scale={.8}><PhysicalCard art={{ kind: 'back' }} /></group>
            </>}
          </group>;
        })}
        <HandRig state={rig} view={view} mode={mode === 'overview' || !privateReady ? 'overview' : mode} reducedMotion={reducedMotion} onSelect={onSelect}
          skin={seatAvatar(seats.find((s) => s.player.playerId === view.localPlayerId)?.player ?? { seatIndex: 0 }).skin} />
      </SceneMaterials>
    </Canvas>
  </div>;
}
