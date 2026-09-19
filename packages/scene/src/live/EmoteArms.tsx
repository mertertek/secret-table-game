/**
 * D16 §5 — el jestinin KAMU eli(leri). `ShootingArm` kalıbı: yalnız jest
 * etkinken mount edilir, bitince kaldırılır → boşta ek çizim 0, jest sırasında
 * oyuncu başına +1 (tek el) ya da +2 (iki el).
 *
 * Poz/konum saf katmandan gelir (`EmoteOverlay.emoteArmFrame`); burada yalnız
 * pişmiş kavrama geometrisi, dinlenmeden açılma karışımı ve kare isteği vardır.
 * `point` kolu PAYLAŞILAN bakış yaw'ına döner (kaynak: `PeerHeads` örneği).
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group } from 'three';
import { SPEC, characterSpec } from '../characters/spec';
import type { SkinId } from '../characters/spec';
import type { Look } from '../prototype/model';
import { EMOTE_GRIP, EMOTE_TWO_HANDED, emoteArmFrame } from './EmoteOverlay';
import type { ActiveEmote } from './EmoteOverlay';
import { sharedGripHand } from './PublicArms';

const HAND_SCALE = SPEC.wrist.handScale;

export function EmoteArms({ emote, lookOf, character, skin = 'orta', reducedMotion, onEnd }: {
  emote: ActiveEmote;
  /** Gönderenin O ANKİ paylaşılan bakışı (yalnız `point` kullanır). */
  lookOf?: () => Look;
  character?: string;
  skin?: SkinId;
  reducedMotion: boolean;
  /** Jest bitince üst katman mount'u kaldırsın diye bir kare ister. */
  onEnd?: () => void;
}) {
  const shoulders = character ? characterSpec(character).bodyScale.shoulders : 1;
  const grip = EMOTE_GRIP[emote.kind];
  const two = EMOTE_TWO_HANDED.has(emote.kind);
  const right = useMemo(() => sharedGripHand(skin, grip, 1), [skin, grip]);
  const left = useMemo(() => (two ? sharedGripHand(skin, grip, -1) : null), [skin, grip, two]);
  const rightRef = useRef<Group>(null);
  const leftRef = useRef<Group>(null);
  const ended = useRef(false);
  const { invalidate } = useThree();

  const apply = () => {
    const since = performance.now() - emote.startedAt;
    const frame = emoteArmFrame(emote.kind, since, reducedMotion, lookOf?.(), shoulders);
    if (!frame) {
      if (rightRef.current) rightRef.current.visible = false;
      if (leftRef.current) leftRef.current.visible = false;
      if (!ended.current) { ended.current = true; onEnd?.(); }
      return;
    }
    // El KOLUN UCUNA oturur: bilek noktası ve dönüş omuz/dirsek çözümünden gelir.
    const place = (node: Group | null, pose: { wrist: readonly number[]; rotation: readonly number[] } | null) => {
      if (!node) return;
      node.visible = !!pose;
      if (!pose) return;
      node.position.set(pose.wrist[0]!, pose.wrist[1]!, pose.wrist[2]!);
      node.rotation.set(pose.rotation[0]!, pose.rotation[1]!, pose.rotation[2]!);
    };
    place(rightRef.current, frame.right);
    place(leftRef.current, frame.left);
    invalidate();
  };
  useLayoutEffect(() => { apply(); invalidate(); });
  useFrame(apply);

  return <group name="EmoteArms">
    <group ref={rightRef} scale={HAND_SCALE}>
      <mesh geometry={right} castShadow><meshStandardMaterial vertexColors roughness={.86} /></mesh>
    </group>
    {left && <group ref={leftRef} scale={HAND_SCALE}>
      <mesh geometry={left} castShadow><meshStandardMaterial vertexColors roughness={.86} /></mesh>
    </group>}
  </group>;
}
