/**
 * D17 — yasama sırasında ofis sahibinin KAMU eli: sağ el yelpaze tutuşunda,
 * elinde kapalı kart SIRTLARI (3 = başkan, 2 = şansölye).
 *
 * `ShootingArm`/`EmoteArms` kalıbı: yalnız o koltukta ve yalnız ilgili fazda
 * mount edilir → diğer koltuklarda ek çizim 0. Kart sırtları TEK `InstancedMesh`
 * (tek çizim, paylaşılan sırt dokusu); el pişmiş kavrama geometrisidir.
 *
 * Gizlilik: yüz, sıra ya da hangi kartın atıldığı bilgisi buraya girmez —
 * yalnız `officeHandState` sonucundaki ADET ve tutuş.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { ActiveCue } from '../animation/cues';
import { progress } from '../animation/cues';
import { CARD_FRAMES } from '../hands/poses';
import { fanCard } from '../prototype/grip';
import { SPEC, characterSpec } from '../characters/spec';
import type { SkinId } from '../characters/spec';
import { drawCard } from '../materials/cardArt';
import { canvasTexture } from '../materials/SceneMaterials';
import { sharedGripHand } from './PublicArms';
import type { OfficeHandFlow, OfficeHandGrip } from './officeHands';

const HAND_SCALE = SPEC.wrist.handScale;
const HAND_X = SPEC.wrist.publicArmsHandX;
/** `PublicArms` elinin hafif dışa dönüşü. */
const HAND_YAW = -.13;
/** Dinlenmedeki bilek noktası (el şablonu orijini) — `PublicArms` ile aynı. */
const WRIST = [0, -.004, -.312] as const;
/**
 * Bilek DİNLENME noktasında kalır (yalnız 2 cm kalkar): karakterin masadaki
 * önkolu elle doğal birleşir, havada kopuk el olmaz. Paket yukarı bakan bilek
 * dönüşünden doğar: el sırtı karşıya, kart SIRTLARI masanın ortasına döner.
 * `HAND_TILT` = paket normalinin (0, .5, −.85) yönüne gelmesi için gereken açı.
 */
const LIFT = { y: .02, z: .01 } as const;
const HAND_TILT = 2.74;
/** Kart tasarım ölçüsü (`PhysicalCard`) el ölçeğinden bağımsız kalır. */
const CARD = { w: .19, h: .272, t: .008 } as const;

/** Sırt deseni bütün ofis elleri için tek dokudur. */
let backTexture: ReturnType<typeof canvasTexture> | null = null;
function cardBack() {
  backTexture ??= canvasTexture(256, 366, (ctx) => drawCard(ctx, 256, 366, { kind: 'back' }));
  return backTexture;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number) => { const p = clamp01(t); return p * p * (3 - 2 * p); };

export function OfficeHand({ grip, count, character, skin = 'orta', flow, active, target, flight = true, reducedMotion, quality = 'standard' }: {
  grip: OfficeHandGrip;
  count: 2 | 3;
  character?: string;
  skin?: SkinId;
  /** Bu koltuğu ilgilendiren `cards_moved` akışı (yoksa durağan el). */
  flow?: OfficeHandFlow | null;
  active?: ActiveCue;
  /** Akışın karşı ucunun DÜNYA konumu (deste/atık/öteki koltuk). */
  target?: readonly [number, number, number] | null;
  /**
   * Uçuşu BU bileşen mi çizecek? Koltuk kamerasında evet; genel bakışta
   * `CueEffects` zaten uçan sırtları çiziyor (çift çizim olmasın) — o zaman
   * yelpaze yalnız adet geçişini gösterir.
   */
  flight?: boolean;
  reducedMotion: boolean;
  quality?: 'standard' | 'low';
}) {
  const shoulders = character ? characterSpec(character).bodyScale.shoulders : 1;
  const hand = useMemo(() => sharedGripHand(skin, grip, 1), [skin, grip]);
  const frame = CARD_FRAMES[grip]!;
  const arm = useRef<Group>(null);
  const packet = useRef<Group>(null);
  const cards = useRef<InstancedMesh>(null);
  const { invalidate } = useThree();
  const scratch = useMemo(() => ({
    m: new Matrix4(), q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3(1, 1, 1), away: new Vector3(),
  }), []);
  const texture = cardBack();

  /** Gelen/giden kartların yelpazedeki yuvası ile karşı uç arasındaki karışım. */
  const apply = () => {
    const node = cards.current;
    if (!node || !arm.current) return;
    const p = active ? progress(active, performance.now()) : 1;
    const moving = !!active && !reducedMotion && p < 1;
    // Kol, devir sırasında `PublicArms` ile aynı dille hafifçe kalkar.
    const lift = moving ? Math.sin(p * Math.PI) : 0;
    arm.current.rotation.set(lift * .14, 0, 0);
    arm.current.position.set(0, .035 + lift * .03, -.015);
    // Karşı uç, kart paketinin YEREL uzayına çevrilir (koltuk dönüşü dahil).
    scratch.away.set(0, 0, 0);
    if (target && packet.current) {
      scratch.away.set(target[0], target[1], target[2]);
      packet.current.updateWorldMatrix(true, false);
      packet.current.worldToLocal(scratch.away);
    }
    const fly = moving && flight && !!target;
    const leaving = fly && flow?.direction === 'out' ? flow.count : 0;
    const arriving = fly && flow?.direction === 'in' ? flow.count : 0;
    const total = count + leaving;
    for (let i = 0; i < total; i++) {
      // Giden kartlar yelpazenin DIŞ kenarındaki yuvalardan çıkar.
      const slot = fanCard(Math.min(i, total - 1), total);
      // Kartlar sırayla uçar (üst üste binip tek karta benzemesin).
      const step = .14, span = 1 - step * 2;
      let t = 0;
      if (leaving && i >= count) {
        t = smooth((p - (i - count) * step) / span);
      } else if (arriving && i >= count - arriving) {
        t = 1 - smooth((p - (count - 1 - i) * step) / span);
      }
      scratch.p.set(slot.position[0], slot.position[1], slot.position[2]).lerp(scratch.away, t);
      // Uçuş yolu hafif yay çizer ve kartlar ayrı ayrı okunur.
      if (t > 0) {
        scratch.p.y += Math.sin(t * Math.PI) * .12;
        scratch.p.x += t * (i % 2 === 0 ? .05 : -.05);
      }
      scratch.q.setFromEuler(scratch.e.set(slot.rotation[0], slot.rotation[1], slot.rotation[2], 'XYZ'));
      const scale = 1 - t * .35;
      scratch.s.set(scale, scale, scale);
      node.setMatrixAt(i, scratch.m.compose(scratch.p, scratch.q, scratch.s));
    }
    node.count = count + leaving;
    node.instanceMatrix.needsUpdate = true;
    if (moving) invalidate();
  };

  useLayoutEffect(() => { apply(); invalidate(); });
  useFrame(apply);
  useEffect(() => { invalidate(); }, [grip, count, flow, active, invalidate]);

  return <group ref={arm} name="OfficeHand" position={[0, .035, -.015]}>
    <group position={[HAND_X * shoulders + WRIST[0], WRIST[1] + LIFT.y, WRIST[2] + LIFT.z]}
      rotation={[HAND_TILT, HAND_YAW, 0]} scale={HAND_SCALE}>
      <mesh geometry={hand} castShadow={quality !== 'low'}><meshStandardMaterial vertexColors roughness={.86} /></mesh>
      {/* Kart paketi el şablonu çerçevesinde; kart ölçüsü el ölçeğinden bağımsız. */}
      <group ref={packet} position={[frame.C[0], frame.C[1], frame.C[2]]}
        rotation={[frame.euler[0], frame.euler[1], frame.euler[2]]} scale={1 / HAND_SCALE}>
        <instancedMesh ref={cards} args={[undefined, undefined, 4]} castShadow={quality !== 'low'} frustumCulled={false}>
          <boxGeometry args={[CARD.w, CARD.t, CARD.h]} />
          <meshStandardMaterial map={texture} roughness={.92} metalness={0} />
        </instancedMesh>
      </group>
    </group>
  </group>;
}
