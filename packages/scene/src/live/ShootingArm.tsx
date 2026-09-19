/**
 * D12 §4/§5 — başkanın KAMU sağ kolu.
 *
 * Tur 3: silah İKİ durumda görünür —
 *  1. **Hazır poz** (`ready`): infaz yetkisi işliyor, hedef henüz seçilmemiş.
 *     Kol masada dinlenir, silah elde, namlu aşağı; hedefe DÖNMEZ.
 *  2. **Koreografi** (`active`): cue geldi, kol bu hazır pozdan kalkar, hedef
 *     koltuğa döner, ateş eder ve tekrar iner (§4 zaman çizgisi).
 *
 * Yalnız bu iki durumda mount edilir; dinlenmedeki iki-el geometrisi
 * (`PublicArms`) değişmez, o sırada sol ele iner.
 *
 * El bilek ekseninde −90° yuvarlanır (avuç gövdeye bakar): tabanca kabzası
 * yumruğun içinde dikey durur, namlu işaret parmağı hizasından öne çıkar.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group } from 'three';
import type { MotionTime } from '../animation/cues';
import { EXECUTION, aimSettle, executionFrame } from '../animation/execution';
import { PROP_FRAMES } from '../hands/poses';
import { SPEC, characterSpec } from '../characters/spec';
import type { SkinId } from '../characters/spec';
import { GunProp } from '../props/GunProp';
import type { GunHandle } from '../props/GunProp';
import { sharedGripHand } from './PublicArms';

const HAND_SCALE = SPEC.wrist.handScale;
const HAND_X = SPEC.wrist.publicArmsHandX;
/** `PublicArms` elinin hafif dışa dönüşü; silah eli de aynı çizgide durur. */
const HAND_YAW = -.13;
/** Bilek ekseninde yuvarlanma: avuç içe döner, kabza dikey kalır. */
const HAND_ROLL = -Math.PI / 2;
/** Dinlenmedeki bilek noktası (el şablonu orijini) — `PublicArms` ile aynı. */
const WRIST = [0, -.004, -.312] as const;

/** §4 kolun nişan yüksekliği ve öne eğimi (silah masa kenarının üstüne çıkar). */
const LIFT_Y = .105, LIFT_X = .40;
/** Hazır pozda kol masada: hafif yukarı bakan bilek, namlu aşağı eğik. */
const READY_X = .10;

const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;

export function ShootingArm({ active, ready = false, yaw, character, skin = 'orta', reducedMotion }: {
  active?: MotionTime; ready?: boolean; yaw: number; character?: string; skin?: SkinId; reducedMotion: boolean;
}) {
  const shoulders = character ? characterSpec(character).bodyScale.shoulders : 1;
  const geometry = useMemo(() => sharedGripHand(skin, 'holdGun'), [skin]);
  const frame = PROP_FRAMES.holdGun!;
  const arm = useRef<Group>(null);
  const gun = useRef<GunHandle>(null);
  const mounted = useRef(performance.now());
  /** Silah koreografiden ÖNCE elde miydi? Öyleyse ölçek sıfırdan başlamaz. */
  const held = useRef(false);
  if (ready) held.current = true;
  const { invalidate } = useThree();
  const apply = () => {
    if (!arm.current) return;
    const now = performance.now();
    if (!active) {
      // Hazır poz: kol masada, silah elde, hedefe dönmemiş.
      const fade = reducedMotion ? 1 : clamp01((now - mounted.current) / EXECUTION.scaleOutMs);
      arm.current.rotation.set(READY_X, 0, 0);
      arm.current.position.set(0, .035, -.015);
      arm.current.visible = true;
      gun.current?.apply(fade, null);
      if (fade < 1) invalidate();
      return;
    }
    const f = executionFrame(now, active.startedAt, reducedMotion);
    const aim = yaw * f.aim + aimSettle(now, active.startedAt, reducedMotion);
    const back = EXECUTION.recoil.back * f.recoil;
    const t = now - active.startedAt;
    // Zaten elde olan silah büyüyerek belirmez; yalnız koreografi sonunda iner.
    const out = clamp01((EXECUTION.totalMs - t) / EXECUTION.scaleOutMs);
    const scale = ready ? 1 : held.current ? out : f.scale;
    arm.current.rotation.set(READY_X + (LIFT_X - READY_X) * f.raise + EXECUTION.recoil.lift * f.recoil, aim, 0);
    arm.current.position.set(back * Math.sin(aim), .035 + LIFT_Y * f.raise, -.015 + back * Math.cos(aim));
    arm.current.visible = ready || f.raise > .001 || scale > .001;
    gun.current?.apply(scale, t - EXECUTION.fireAt, reducedMotion);
    if (now < active.startedAt + active.duration) invalidate();
  };
  useLayoutEffect(() => { apply(); invalidate(); });
  useFrame(apply);
  return <group ref={arm} name="ShootingArm" position={[0, .035, -.015]}>
    <group position={[HAND_X * shoulders + WRIST[0], WRIST[1], WRIST[2]]} rotation={[0, HAND_YAW, HAND_ROLL]} scale={HAND_SCALE}>
      <mesh geometry={geometry} castShadow><meshStandardMaterial vertexColors roughness={.86} /></mesh>
      <group position={[frame.C[0], frame.C[1], frame.C[2]]} rotation={[frame.euler[0], frame.euler[1], frame.euler[2]]}>
        <GunProp ref={gun} />
      </group>
    </group>
  </group>;
}
