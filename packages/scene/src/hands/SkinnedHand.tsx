/**
 * D1 — tek parça, 16 kemikli el. Geometri kalite kademesi başına bir kez SDF +
 * marching cubes ile üretilir ve paylaşılır; iskelet el başınadır.
 *
 * Çizim çağrısı: 1 `SkinnedMesh` (el) + 1 `InstancedMesh` (kol/manşet) = 2.
 */
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, Group, InstancedMesh, Matrix4, Quaternion, SkinnedMesh, Vector3 } from 'three';
import type { SceneQuality } from '@secret-table/contracts';
import type { HandPose } from '../prototype/model';
import { elbow } from '../prototype/rig';
import { handGeometry, tintedHandGeometry } from './geometry';
import type { HandTier } from './geometry';
import { skinTones } from '../characters/spec';
import type { SkinId } from '../characters/spec';
import { CARD_FRAMES, POSES, mixPose } from './poses';
import type { GripName, Pose } from './poses';
import { resolveContact } from './contact';
import { applyPose, buildSkeleton } from './skeleton';

const COAT = '#354f49', CUFF = '#e1d4b8';
/** Kol ölçüleri (D1 tur 2/3). Silindir geometrisi .72 konikliğinde: önkol
 * dirsekte .042 → bilekte .030, manşet .034 → .025. Eskiden .066/.076 idi ve
 * yakın planda dev bir tüp gibi görünüyordu.
 * Tur 3: manşet önkolu SIKI sarıyor (kol ucunda 3 mm pay). Daha geniş manşette
 * uç kapağı 1 cm'lik bir halka olarak görünüyor ve içi boş tüp izlenimi veriyordu. */
const FOREARM = .042, CUFF_R = .039, BEHIND_ELBOW = .30, CUFF_OVERLAP = .060;
/** Manşet TERS yönde yerleşir: dar ucu (.72·R = .0281) kola bakar ve önkolun
 * o noktadaki yarıçapından (.0304) İNCEDİR — böylece manşetin kol tarafındaki
 * kapağı tamamen önkolun içinde kalır, "içi boş tüp" halkası görünmez. Geniş ucu
 * (.039) bileğe bakar; kapalı kapağı bileğin çıktığı kapalı manşet yüzüdür. */
const CUFF_BACK = .050, CUFF_LEN = .046;
/** Karışım t'si 1/32'ye yuvarlanır; çözülmüş poz önbelleğe girer (temas çözümü pahalı). */
const STEPS = 32;
const solved = new Map<string, { pose: Pose; penetrations: number }>();

export function resolveGrip(grip: GripName, blend?: { to: GripName; t: number }): { pose: Pose; penetrations: number } {
  const active = blend && blend.to !== grip ? blend : undefined;
  const t = active ? Math.round(Math.max(0, Math.min(1, active.t)) * STEPS) / STEPS : 0;
  const key = active ? `${grip}>${active.to}@${t}` : grip;
  const hit = solved.get(key);
  if (hit) return hit;
  const blended = active ? mixPose(POSES[grip], POSES[active.to], t) : POSES[grip];
  const frame = CARD_FRAMES[active && t >= .5 ? active.to : grip];
  const result = resolveContact(blended, frame);
  const value = { pose: result.pose, penetrations: result.penetrations };
  if (solved.size < 600) solved.set(key, value);
  return value;
}

export type HandHandle = { apply: (pose: HandPose) => void };

export const SkinnedHand = forwardRef<HandHandle, { side: -1 | 1; quality?: SceneQuality; arm?: boolean; skin?: SkinId }>(
  function SkinnedHand({ side, quality = 'standard', arm: showArm = true, skin = 'orta' }, ref) {
  const tier: HandTier = quality === 'low' ? 'low' : 'standard';
  const build = useMemo(() => handGeometry(tier), [tier]);
  // D3.4 — ilk şahıs eli oyuncunun seçtiği ten tonunda (kamu elleriyle aynı kural).
  const geometry = useMemo(() => tintedHandGeometry(tier, skinTones(skin).base), [tier, skin]);
  const rig = useMemo(buildSkeleton, []);
  const wrist = useRef<Group>(null);
  const mesh = useRef<SkinnedMesh>(null);
  const arm = useRef<InstancedMesh>(null);
  const { gl } = useThree();
  const scratch = useMemo(() => ({
    from: new Vector3(...elbow(side)), to: new Vector3(), dir: new Vector3(), up: new Vector3(0, 1, 0),
    q: new Quaternion(), back: new Quaternion(), flip: new Vector3(), p: new Vector3(), s: new Vector3(), m: new Matrix4(),
  }), [side]);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    // Kemikler ayrık bind pozunda kurulduğu için bind matrisi birimdir; `attached`
    // kipinde three her karede grup dönüşümünü kendisi sadeleştirir.
    mesh.current.bind(rig.skeleton, new Matrix4());
  }, [rig, geometry]);
  useLayoutEffect(() => {
    if (!arm.current) return;
    [COAT, CUFF].forEach((color, i) => arm.current!.setColorAt(i, new Color(color)));
    if (arm.current.instanceColor) arm.current.instanceColor.needsUpdate = true;
  }, []);
  useEffect(() => {
    const data = gl.domElement.dataset;
    data.fpHandTriangles = String(build.triangles);
    data.fpHandBuildMs = build.buildMs.toFixed(1);
  }, [gl, build]);

  useImperativeHandle(ref, () => ({
    apply(pose) {
      if (!wrist.current || !arm.current) return;
      wrist.current.position.set(...pose.position);
      wrist.current.rotation.set(...pose.rotation);
      const { pose: joints, penetrations } = resolveGrip(pose.grip, pose.blend);
      applyPose(rig.bones, joints);
      if (side === -1) gl.domElement.dataset.fpHandPenetration = String(penetrations);
      const { from, to, dir, up, q, back, flip, p, s, m } = scratch;
      to.set(...pose.position); dir.subVectors(to, from);
      const reach = Math.max(.02, dir.length()); dir.normalize();
      q.setFromUnitVectors(up, dir);
      // Ölçek yalnız Y'de; yarıçap kol uzunluğundan bağımsızdır (şişmez).
      // 0: önkol — dirseğin BEHIND_ELBOW kadar gerisinden başlar (kesik ucu kameranın
      // arkasında kalsın, üst kol parçasına gerek kalmasın), manşetin altında biter.
      const length = reach + BEHIND_ELBOW - CUFF_OVERLAP;
      arm.current.setMatrixAt(0, m.compose(p.copy(from).addScaledVector(dir, (reach - BEHIND_ELBOW - CUFF_OVERLAP) / 2), q, s.set(FOREARM, length, FOREARM)));
      // 1: manşet — bileğin hemen gerisinde, ters yönde (geniş uç bileğe bakar).
      back.setFromUnitVectors(up, flip.copy(dir).negate());
      arm.current.setMatrixAt(1, m.compose(p.copy(to).addScaledVector(dir, -CUFF_BACK), back, s.set(CUFF_R, CUFF_LEN, CUFF_R)));
      arm.current.instanceMatrix.needsUpdate = true;
    },
  }), [rig, scratch, side, gl]);

  return <group name={side === 1 ? 'RightHand' : 'LeftHand'}>
    {/* D1 tur 6: inceleme görünümünde (`/dev/hands`) önkol çizilmez. */}
    <instancedMesh ref={arm} args={[undefined, undefined, 2]} castShadow={quality !== 'low'} frustumCulled={false} visible={showArm}>
      <cylinderGeometry args={[.72, 1, 1, 18, 1, false]} />
      <meshStandardMaterial roughness={.89} />
    </instancedMesh>
    <group ref={wrist}><group scale={[side, 1, 1]}>
      <primitive object={rig.root} />
      <skinnedMesh ref={mesh} geometry={geometry} castShadow={quality !== 'low'} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={.72} metalness={0} />
      </skinnedMesh>
    </group></group>
  </group>;
});
