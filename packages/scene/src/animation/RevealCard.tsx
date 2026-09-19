import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { CardArt } from '../materials/cardArt';
import { CardBody } from '../objects/CardBody';
import type { ActiveCue } from './cues';
import { easeOut, progress } from './cues';
const back: CardArt = { kind: 'back' };
/** Two authorized surfaces, with a real turn around the card's long axis. */
export function RevealCard({ art, active, reducedMotion }: { art: CardArt; active?: ActiveCue; reducedMotion: boolean }) {
  const group = useRef<Group>(null); const face = useRef<Group>(null); const concealed = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const apply = () => {
    if (!group.current || !face.current || !concealed.current) return;
    const p = reducedMotion ? 1 : progress(active, performance.now());
    const angle = Math.PI * (1 - easeOut(p));
    group.current.rotation.z = angle; group.current.position.y = .025 + Math.sin(p * Math.PI) * .075;
    face.current.visible = angle <= Math.PI / 2; concealed.current.visible = angle > Math.PI / 2;
    if (p < 1) invalidate();
  };
  useLayoutEffect(() => { apply(); invalidate(); }); useFrame(apply);
  return <group ref={group}><group ref={face}><CardBody art={art} reducedMotion={reducedMotion} /></group>
    {active && <group ref={concealed} rotation={[0, 0, Math.PI]}><CardBody art={back} reducedMotion={reducedMotion} /></group>}
    {!active && <group ref={concealed} visible={false} />}
  </group>;
}
