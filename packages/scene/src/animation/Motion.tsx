import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { MotionTime } from './cues';
import { easeOut, progress } from './cues';

/** Offset only: the current-view object always owns the final position and face. */
export function Motion({ active, from = [0, .15, .15], delay = 0, reducedMotion, children }: {
  active?: MotionTime; from?: readonly [number, number, number]; delay?: number; reducedMotion: boolean; children: ReactNode;
}) {
  const ref = useRef<Group>(null); const invalidate = useThree((s) => s.invalidate);
  const apply = () => {
    if (!ref.current) return;
    const p = reducedMotion ? 1 : progress(active, performance.now(), delay); const remaining = 1 - easeOut(p);
    ref.current.position.set(from[0] * remaining, from[1] * remaining + Math.sin(p * Math.PI) * .07, from[2] * remaining);
    if (p < 1) invalidate();
  };
  useLayoutEffect(() => { apply(); invalidate(); });
  useFrame(apply);
  return <group ref={ref}>{children}</group>;
}
