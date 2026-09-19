import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { easeOut } from '../animation/cues';
import { cameraFrame, type InspectionMode } from './cameraFraming';
export function SceneCamera({ mode, privateX, reducedMotion }: { mode: InspectionMode; privateX: number; reducedMotion: boolean }) {
  const { camera, size, invalidate } = useThree();
  const animation = useRef<{ start: number; from: Vector3; to: Vector3; lookFrom: Vector3; lookTo: Vector3 } | null>(null);
  const look = useRef(new Vector3(0, 0, .12)); const initialized = useRef(false); const previousSize = useRef('');
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const frame = cameraFrame(mode, size.width, size.height, privateX);
    const to = new Vector3(...frame.eye), lookTo = new Vector3(...frame.target);
    const dimensions = `${size.width}/${size.height}`;
    if (!initialized.current || reducedMotion || previousSize.current !== dimensions) {
      camera.position.copy(to); look.current.copy(lookTo); camera.lookAt(lookTo); animation.current = null;
    } else animation.current = { start: performance.now(), from: camera.position.clone(), to, lookFrom: look.current.clone(), lookTo };
    previousSize.current = dimensions; initialized.current = true;
    camera.fov = 40; camera.updateProjectionMatrix(); invalidate();
  }, [camera, size, invalidate, mode, privateX, reducedMotion]);
  useFrame(() => {
    const a = animation.current; if (!a) return;
    const p = Math.min(1, (performance.now() - a.start) / 500); const eased = easeOut(p);
    camera.position.lerpVectors(a.from, a.to, eased); look.current.lerpVectors(a.lookFrom, a.lookTo, eased);
    camera.lookAt(look.current); if (p < 1) invalidate(); else animation.current = null;
  });
  return null;
}
