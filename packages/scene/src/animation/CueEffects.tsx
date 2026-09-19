import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import type { Mesh, MeshBasicMaterial } from 'three';
import type { SceneView } from '@secret-table/contracts';
import { CardBody } from '../objects/CardBody';
import { layoutSeats } from '../layout/seats';
import { Motion } from './Motion';
import { cueOfficePlayerId, progress } from './cues';
import type { ActiveCue } from './cues';
export function CueEffects({ active, view, reducedMotion }: { active: readonly ActiveCue[]; view: SceneView; reducedMotion: boolean }) {
  const seats = layoutSeats(view);
  const endpoint = (point: 'deck' | 'discard' | 'president' | 'chancellor'): readonly [number, number, number] | undefined => {
    if (point === 'deck') return [-1.28, .16, -.07];
    if (point === 'discard') return [1.28, .16, -.07];
    const officeId = cueOfficePlayerId(view, point);
    const seat = seats.find((s) => s.player.playerId === officeId);
    return seat?.player.playerId === view.localPlayerId ? [0, .12, .97] : seat?.cards;
  };
  return <group name="CueEffects">{active.map((a) => {
    const cue = a.cue;
    if (cue.kind === 'cards_moved' && !reducedMotion) {
      // A local deal already animates the authoritative hand; do not double the cards.
      if (active.some((other) => other.cue.kind === 'cards_dealt') && cueOfficePlayerId(view, cue.to) === view.localPlayerId) return null;
      const from = endpoint(cue.from); const to = endpoint(cue.to); if (!from || !to) return null;
      return <group key={cue.cueId} position={[...to]}>{Array.from({ length: Math.min(cue.count, 3) }, (_, i) =>
        <group key={i} position={[i * .035, i * .012, 0]}><Motion active={a} reducedMotion={false} delay={i * 35} from={[from[0] - to[0], .15, from[2] - to[2]]}>
          <CardBody art={{ kind: 'back' }} /></Motion></group>)}</group>;
    }
    if (cue.kind === 'game_ended') return <ResultHalo key={cue.cueId} active={a} reducedMotion={reducedMotion} />;
    return null;
  })}</group>;
}
function ResultHalo({ active, reducedMotion }: { active: ActiveCue; reducedMotion: boolean }) {
  const mesh = useRef<Mesh>(null); const invalidate = useThree((s) => s.invalidate);
  const apply = () => {
    if (!mesh.current) return;
    // D12 §4: infazla aynı pakette gelen oyun sonu halesi koreografi bitene kadar bekler.
    const p = progress(active, performance.now(), active.delay ?? 0);
    (mesh.current.material as MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * (reducedMotion ? .09 : .25);
    if (p < 1) invalidate();
  };
  useLayoutEffect(() => { apply(); invalidate(); }); useFrame(apply);
  return <mesh ref={mesh} position={[0, .013, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.42, 1, 1]}>
    <ringGeometry args={[1.42, 1.44, 96]} /><meshBasicMaterial color="#e7c781" transparent opacity={0} depthWrite={false} />
  </mesh>;
}
