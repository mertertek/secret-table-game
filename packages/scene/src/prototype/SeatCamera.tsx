import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { LookChannel } from '../live/lookChannel';
import type { CameraMode, Look, Vec3 } from './model';
import { clamp, constrainLook } from './model';
import { smooth } from './rig';
import { LEAN_LOOK, cameraFrame, leanFrame } from '../layout/cameraFraming';
import type { InspectionMode } from '../layout/cameraFraming';
/** Bakış ya doğrudan bir değerdir (prototip) ya da her karede okunan kanaldır (canlı sahne). */
export type LookSource = Look | LookChannel;
const readLook = (source: LookSource): Look => 'current' in source ? source.current : source;
/** D15 geçişi: 500 ms ease-in-out + hafif yay (önce yükselir, sonra iner). */
export const LEAN_TRANSITION = { ms: 500, arc: .12 };
const DEFAULT_TRANSITION_MS = 620;
export function SeatCamera({ mode, look, chair, reducedMotion, onPrivateReady, tableInspection = 'overview', privateX = 0, yawLimit }: { onPrivateReady: (ready: boolean) => void; mode: CameraMode; look: LookSource; chair: Vec3; reducedMotion: boolean; tableInspection?: InspectionMode; privateX?: number; yawLimit?: number }) {
  const { camera, size, invalidate, gl } = useThree();
  const previousMode = useRef<string | null>(null);
  const previousSize = useRef('');
  const transition = useRef<{ start: number; from: Vector3; to: Vector3; fromQ: Quaternion; toQ: Quaternion; fromFov: number; toFov: number; duration: number; arc: number } | null>(null);
  const scratch = useMemo(() => ({ eye: new Vector3(), target: new Vector3(), up: new Vector3(0, 1, 0), matrix: new Matrix4(), q: new Quaternion(), dir: new Vector3(), right: new Vector3() }), []);
  /** Eğilmeye girerken okunan bakış; gezdirme sınırına dayanınca çapa birlikte kayar. */
  const leanOrigin = useRef<Look | null>(null);
  const cameraKey = `${mode}/${tableInspection}`;
  /** `scratch.eye/q` hedefi doldurur, fov döndürür. Bakış yalnız serbest koltukta okunur. */
  const place = () => {
    const aspect = size.width / Math.max(1, size.height);
    if (mode === 'seat' && tableInspection === 'lean') {
      const frame = leanFrame(chair, size.width, size.height);
      const angles = constrainLook(readLook(look));
      const origin = (leanOrigin.current ??= { yaw: angles.yaw, pitch: angles.pitch });
      // Sürüklenen çapa: bakış sınırın dışına taşarsa çapa kayar. Böylece eğilmeden
      // çıkınca koltuk bakışı, eğilmede görülen yönün en çok sınır kadar uzağındadır.
      origin.yaw = clamp(origin.yaw, angles.yaw - LEAN_LOOK.yaw, angles.yaw + LEAN_LOOK.yaw);
      origin.pitch = clamp(origin.pitch, angles.pitch - LEAN_LOOK.pitch, angles.pitch + LEAN_LOOK.pitch);
      scratch.eye.set(...frame.eye);
      scratch.dir.set(frame.target[0] - frame.eye[0], frame.target[1] - frame.eye[1], frame.target[2] - frame.eye[2]).normalize();
      scratch.dir.applyAxisAngle(scratch.up, clamp(angles.yaw - origin.yaw, -LEAN_LOOK.yaw, LEAN_LOOK.yaw));
      scratch.right.copy(scratch.dir).cross(scratch.up).normalize();
      scratch.dir.applyAxisAngle(scratch.right, clamp(angles.pitch - origin.pitch, -LEAN_LOOK.pitch, LEAN_LOOK.pitch));
      scratch.target.copy(scratch.eye).add(scratch.dir);
      scratch.q.setFromRotationMatrix(scratch.matrix.lookAt(scratch.eye, scratch.target, scratch.up));
      return frame.fov;
    }
    if (mode === 'overview' || tableInspection !== 'overview') {
      const frame = cameraFrame(tableInspection, size.width, size.height, privateX);
      scratch.eye.set(...frame.eye); scratch.target.set(...frame.target);
      scratch.q.setFromRotationMatrix(scratch.matrix.lookAt(scratch.eye, scratch.target, scratch.up));
      return 40;
    }
    if (mode === 'inspect') {
      scratch.eye.set(chair[0], .47, chair[2] - .08); scratch.target.set(0, .22, 1.20);
      scratch.q.setFromRotationMatrix(scratch.matrix.lookAt(scratch.eye, scratch.target, scratch.up));
      return Math.min(100, Math.max(49, MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(23)) / aspect))));
    }
    const angles = constrainLook(readLook(look));
    const yaw = yawLimit === undefined ? angles.yaw : clamp(angles.yaw, -yawLimit, yawLimit);
    scratch.eye.set(chair[0], .51, chair[2] + .035);
    scratch.dir.set(-Math.sin(yaw) * Math.cos(angles.pitch), Math.sin(angles.pitch), -Math.cos(yaw) * Math.cos(angles.pitch));
    scratch.target.copy(scratch.eye).add(scratch.dir);
    scratch.q.setFromRotationMatrix(scratch.matrix.lookAt(scratch.eye, scratch.target, scratch.up));
    return Math.min(100, Math.max(64, MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(26)) / aspect))));
  };
  // Canlı sahnede bakış kanalı kareyi kendisi ister; prototipte `look` değeri değişince.
  useLayoutEffect(() => {
    if (!('current' in look)) { invalidate(); return; }
    look.invalidate = invalidate;
    return () => { if (look.invalidate === invalidate) look.invalidate = null; };
  }, [look, invalidate]);
  // Kamera KİPİ/ölçü değişimi: uçuş kurulur veya doğrudan yerleşilir. Bakış burada
  // bir bağımlılık DEĞİLDİR; serbest koltuk bakışı her karede uygulanır (PERF-C1 §4/1).
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const fov = place();
    const dimensions = `${size.width}/${size.height}`;
    const active = transition.current;
    // Canvas/layout renders caused by concealing a face must not finish the flight.
    if (active && !reducedMotion && previousMode.current === cameraKey && dimensions === previousSize.current &&
      active.to.distanceToSquared(scratch.eye) < 1e-10 && active.toQ.angleTo(scratch.q) < .00001 && Math.abs(active.toFov - fov) < .00001) {
      invalidate(); return;
    }
    if (reducedMotion || previousMode.current === null || previousMode.current === cameraKey || dimensions !== previousSize.current) {
      camera.position.copy(scratch.eye); camera.quaternion.copy(scratch.q); camera.fov = fov; transition.current = null; onPrivateReady(mode !== 'overview' && tableInspection === 'overview');
    } else {
      // Conceal throughout interrupted/reversed camera flights as well.
      onPrivateReady(false);
      // D15: eğilmeye giriş ve dönüş 500 ms + yay; diğer kamera uçuşları eskisi gibi.
      const leaning = tableInspection === 'lean' || previousMode.current?.endsWith('/lean') === true;
      transition.current = { start: performance.now(), from: camera.position.clone(), to: scratch.eye.clone(), fromQ: camera.quaternion.clone(), toQ: scratch.q.clone(), fromFov: camera.fov, toFov: fov,
        duration: leaning ? LEAN_TRANSITION.ms : DEFAULT_TRANSITION_MS, arc: leaning ? LEAN_TRANSITION.arc : 0 };
    }
    previousMode.current = cameraKey; previousSize.current = dimensions;
    if (tableInspection !== 'lean') leanOrigin.current = null;
    camera.near = .025; camera.far = 100; camera.updateProjectionMatrix(); invalidate();
  }, [cameraKey, chair, reducedMotion, size, camera, invalidate, scratch, onPrivateReady, privateX, yawLimit]);
  useFrame(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const a = transition.current;
    if (a) {
      const p = Math.min(1, (performance.now() - a.start) / a.duration); const t = smooth(p);
      camera.position.lerpVectors(a.from, a.to, t);
      if (a.arc) camera.position.y += a.arc * Math.sin(Math.PI * t); // eğilme yayı
      camera.quaternion.slerpQuaternions(a.fromQ, a.toQ, t);
      camera.fov = MathUtils.lerp(a.fromFov, a.toFov, t); camera.updateProjectionMatrix();
      if (p < 1) invalidate(); else { transition.current = null; onPrivateReady(mode !== 'overview' && tableInspection === 'overview'); }
    } else if (mode === 'seat' && (tableInspection === 'overview' || tableInspection === 'lean')) {
      // Serbest bakış (ve eğilmede göz gezdirme): React render'ı olmadan doğrudan kameraya.
      const fov = place();
      camera.position.copy(scratch.eye); camera.quaternion.copy(scratch.q);
      if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); }
    }
    const data = gl.domElement.dataset;
    data.fpCameraX = camera.position.x.toFixed(3); data.fpCameraY = camera.position.y.toFixed(3); data.fpCameraZ = camera.position.z.toFixed(3);
    data.fpFov = camera.fov.toFixed(2); data.fpCameraMoving = String(transition.current !== null);
  });
  return null;
}
