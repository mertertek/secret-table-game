import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ActiveCue } from '../animation/cues';
import { progress } from '../animation/cues';
import { bakedPose, tintVertexColors } from '../hands/geometry';
import type { GripName } from '../hands/poses';
import { SPEC, characterSpec, skinTones } from '../characters/spec';
import type { SkinId } from '../characters/spec';

/**
 * D1 §g + D3 §a — masadaki eller: aynı SDF üretimi, `distant` kademe,
 * `restTable` pozu CPU'da PİŞİRİLMİŞ statik geometri (skin yok).
 *
 * D3'te kolluk ve manşet silindirleri KARAKTER GÖVDE MESH'İNE taşındı
 * (`forearm`/`cuff` ilkelleri, giysi rengi); burada yalnız el kalır. Chibi
 * oranla uyum için el ×1,15 ölçeklenir — bilek noktası (±0,220·t, 0,035, −0,324)
 * değişmez, çünkü el şablonunun orijini bileğin kendisidir.
 *
 * İki el TEK geometride birleşir → oyuncu başına 1 çizim (gövde + yüz ile 3).
 */
const HAND_SCALE = SPEC.wrist.handScale;
const HAND_X = SPEC.wrist.publicArmsHandX;

/** Ayna ölçeği sarım yönünü tersine çevirir; iki el tek mesh'te birleştiği için elle düzeltilir. */
function flipWinding(geometry: BufferGeometry): void {
  for (const attribute of Object.values(geometry.attributes)) {
    const array = attribute.array as Float32Array;
    const size = attribute.itemSize;
    for (let t = 0; t + 2 < attribute.count; t += 3) {
      for (let c = 0; c < size; c++) {
        const a = (t + 1) * size + c, b = (t + 2) * size + c;
        const tmp = array[a]!; array[a] = array[b]!; array[b] = tmp;
      }
    }
  }
}

/** D3.4 — ten boyaması tek kaynaktan (`hands/geometry.tintVertexColors`). */
function tintToSkin(geometry: BufferGeometry, skin: SkinId): void {
  tintVertexColors(geometry, skinTones(skin).base);
}

function handsGeometry(shoulders: number, skin: SkinId, sides: readonly number[], grip: GripName): BufferGeometry {
  const parts = sides.map((side) => {
    // El şablonu: bilek orijin, parmaklar −Z, avuç −Y. Ölçek bileğin çevresinde
    // olduğu için bilek noktası (0, −,004, −,312) değişmez.
    const hand = bakedPose('distant', grip);
    hand.scale(HAND_SCALE, HAND_SCALE, HAND_SCALE);
    hand.translate(0, -.004, -.312);
    const flat = hand.toNonIndexed(); hand.dispose();
    if (side < 0) { flat.scale(-1, 1, 1); flipWinding(flat); }
    flat.rotateY(side * -.13);
    flat.translate(side * HAND_X * shoulders, 0, 0);
    return flat;
  });
  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  tintToSkin(merged, skin);
  return merged;
}

const shared = new Map<string, BufferGeometry>();

/**
 * D12 tur 2 — YERLEŞİMSİZ tek el: yalnız pişmiş poz + ten tonu. Ölçek ve
 * bilek dönüşleri çağıranın gruplarındadır (atış kolu eli bilek ekseninde
 * ~90° yuvarlar: tabanca kabzası avuç içinde dikey durur).
 */
const bare = new Map<string, BufferGeometry>();
export function sharedGripHand(skin: SkinId, grip: GripName, side: -1 | 1 = 1): BufferGeometry {
  const key = `${skin}:${grip}:${side}`;
  let hit = bare.get(key);
  if (!hit) {
    const hand = bakedPose('distant', grip);
    tintToSkin(hand, skin);
    // D16: iki elli jestlerde SOL el aynalanır; ayna sarım yönünü ters çevirir.
    let geometry = hand;
    if (side < 0) {
      geometry = hand.toNonIndexed();
      hand.dispose();
      geometry.scale(-1, 1, 1);
      flipWinding(geometry);
    }
    bare.set(key, geometry);
    hit = geometry;
  }
  return hit;
}

/**
 * Omuz ölçeği + ten + taraf + tutuş başına tek geometri; aynı seçimi kullanan
 * oyuncular paylaşır. D12: infazda sağ el ayrı (`ShootingArm`) çizildiği için
 * masada yalnız SOL el kalır; dinlenmedeki iki-el geometrisi değişmez.
 */
export function sharedHands(shoulders: number, skin: SkinId, sides: readonly number[] = [-1, 1], grip: GripName = 'restTable'): BufferGeometry {
  const rounded = Math.round(shoulders * 100) / 100;
  const key = `${rounded}:${skin}:${sides.join('')}:${grip}`;
  let hit = shared.get(key);
  if (!hit) { hit = handsGeometry(rounded, skin, sides, grip); shared.set(key, hit); }
  return hit;
}

/** Same closed-hand path for every publicly accepted policy/ballot; no selected
 * index, role, private vote or hand contents are accepted by this component. */
export function PublicArms({ active, reducedMotion, character, skin = 'orta', shooting = false, emote = null }: { active?: ActiveCue; reducedMotion: boolean; character?: string; skin?: SkinId; shooting?: boolean;
  /** D16 — jest sırasında o el(ler) `EmoteArms` tarafından çizilir; burada gizlenir. */
  emote?: 'right' | 'both' | null }) {
  const shoulders = character ? characterSpec(character).bodyScale.shoulders : 1;
  // D12 §4: infaz sırasında sağ el silahla kalkar (`ShootingArm`), masada sol el kalır.
  // D16: jestte kalkan el(ler) `EmoteArms`e devredilir; iki elli jestte masada el kalmaz.
  const sides = emote === 'both' ? [] : emote === 'right' || shooting ? [-1] : [-1, 1];
  const geometry = useMemo(() => (sides.length ? sharedHands(shoulders, skin, sides) : null), [shoulders, skin, sides.join('')]);
  const arms = useRef<Group>(null); const { invalidate } = useThree();
  useLayoutEffect(() => { invalidate(); }, [active, reducedMotion, invalidate]);
  useFrame(() => {
    if (!arms.current) return;
    const p = progress(active, performance.now());
    const lift = !reducedMotion && active ? Math.sin(p * Math.PI) : 0;
    arms.current.position.y = .035 + lift * .075;
    arms.current.rotation.x = lift * .24;
    if (p < 1 && !reducedMotion) invalidate();
  });
  return <group ref={arms} position={[0, .035, -.015]} name="PublicHands">
    {geometry && <mesh geometry={geometry} castShadow><meshStandardMaterial vertexColors roughness={.86} /></mesh>}
  </group>;
}
