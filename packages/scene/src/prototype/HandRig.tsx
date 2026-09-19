import { useCallback, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { SceneQuality, SceneSelection, SceneView } from '@secret-table/contracts';
import { handItems } from '../live/handItems';
import { TargetZone } from '../live/Targeting';
import type { CardArt } from '../materials/cardArt';
import { Block, PrintedFace, lettering } from '../objects/Surface';
import { SkinnedHand } from '../hands/SkinnedHand';
import type { HandHandle } from '../hands/SkinnedHand';
import type { SkinId } from '../characters/spec';
import { PhysicalCard } from './PhysicalCard';
import { privateArt, publicVote } from './model';
import type { CameraMode, RigState, Transform } from './model';
import { cardsAside, mixHand, mixTransform, restRight, sampleRig } from './rig';
import { composeCard, fanCard, handFromCard, propFromHand } from './grip';
import { PROP_FRAMES } from '../hands/poses';
import { GunProp } from '../props/GunProp';
import type { GunHandle } from '../props/GunProp';
import { FanLayout } from './FanLayout';
import { emoteAllowed, emoteFrame } from '../live/EmoteOverlay';
import type { ActiveEmote } from '../live/EmoteOverlay';
import type { Look } from './model';
import { sceneText, useSceneLanguage } from '../i18n/sceneText';

/** Bakış ya doğrudan değerdir (prototip) ya da her karede okunan kanaldır. */
type LookLike = Look | { current: Look };
const readLook = (source: LookLike | undefined): Look =>
  source ? ('current' in source ? source.current : source) : { yaw: 0, pitch: 0 };
const put = (group: Group | null, transform: Transform) => { if (group) { group.position.set(...transform.position); group.rotation.set(...transform.rotation); } };
export function HandRig({ state, view, mode, reducedMotion, onSelect, production = false, slots = [], aimed = null, inspectedIndex = -1, quality = 'standard', emote = null, look, skin = 'orta' }: { state: RigState; view: SceneView; mode: CameraMode; reducedMotion: boolean; onSelect: (i: number) => void; production?: boolean; slots?: readonly (SceneSelection | null)[]; aimed?: SceneSelection | null; inspectedIndex?: number; quality?: SceneQuality;
  /** D16 — yerel oyuncunun oynayan el jesti (yoksa `null`). */
  emote?: ActiveEmote | null;
  /** D16 — `point` yerel bakış yaw'ını izler. */
  look?: LookLike;
  /** D3.4 — yerel oyuncunun seçtiği ten tonu. */
  skin?: SkinId }) {
  const language = useSceneLanguage();
  const left = useRef<HandHandle>(null); const right = useRef<HandHandle>(null);
  const fan = useRef<Group>(null); const loose = useRef<Group>(null); const envelope = useRef<Group>(null); const flap = useRef<Group>(null);
  const cards = useRef<(Group | null)[]>([]); const ghosts = useRef<(Group | null)[]>([]); const looseFront = useRef<Group>(null); const looseBack = useRef<Group>(null);
  // D12 §4: silah yalnız infaz koreografisi boyunca MOUNT edilir.
  const gunGroup = useRef<Group>(null); const gun = useRef<GunHandle>(null);
  // D12 tur 3: silah hem hazır pozda hem koreografi boyunca çizilir.
  const shooting = state.motion?.kind === 'shoot' || state.pose === 'ready';
  const layout = useRef(new FanLayout());
  const { invalidate, gl } = useThree();
  const items = production ? handItems(view) : view.privateView.hand.slice(0, 3).map((card) => ({ id: card.cardId, art: { kind: 'policy' as const, policy: card.policy } }));
  const cardCount = items.length;
  // D1 tur 4: el görünümde boşaldıysa devir/oy hareketi boyunca YALNIZ kapalı
  // sırtlar çizilir (adet kamu bilgisi). Seçilemez, hedef alanı yok, yüz taşımaz.
  const ghostBacks = cardCount ? 0 : state.motion?.ghostBacks ?? 0;
  // D1 tur 3: `inspect` bir OKUMA kipidir. İncelenen kart tek başına kalkar ama
  // sağ el kartı TUTMAZ, `rest` pozunda masada kalır: kol yakın planda görüşü
  // kesmesin, parmak uçları öndeki kartların yüzünde belirmesin. `selected`
  // (E ile gerçek seçim) tutuşu değişmez.
  const reading = inspectedIndex >= 0 && inspectedIndex < cardCount && mode === 'inspect' && !state.motion && (state.pose === 'hold' || state.pose === 'selected');
  const visual = reading ? { ...state, pose: 'selected' as const, selected: inspectedIndex } : state;
  const pose = sampleRig(visual, performance.now(), reducedMotion, cardCount);
  if (reading) pose.right = restRight;
  const vote = publicVote(view);
  const selectable = mode !== 'overview' && (state.pose === 'hold' || state.pose === 'selected' || (production && state.pose === 'placed'));
  let art: CardArt = { kind: 'back' };
  if (state.pose === 'vote' && vote) art = { kind: 'ballot', vote };
  else if (state.pose === 'envelope') art = privateArt(view, mode, 'role');
  else if (!production && state.motion?.kind === 'place') art = privateArt(view, mode, 'policy', state.selected);
  const apply = () => {
    const next = sampleRig(visual, performance.now(), reducedMotion, cardCount);
    if (reading) next.right = restRight;
    // D16 §5 — jest katmanı: el hedeflerini EZER. Silah hazır pozunda ya da infaz
    // koreografisi oynarken jest reddedilir (el meşgul).
    const active = emote && emoteAllowed(state.pose, state.motion)
      ? emoteFrame(emote.kind, performance.now() - emote.startedAt, reducedMotion, readLook(look)) : null;
    if (active) {
      next.right = mixHand(next.right, active.right, active.weight);
      // Kart tutulurken sol el kartları TUTMAYA devam eder; yalnız iki elli
      // jestte bırakır ve paket masaya yaslanır.
      if (active.left) {
        next.left = mixHand(next.left, active.left, active.weight);
        if (next.fanVisible) next.fan = mixTransform(next.fan, cardsAside, active.cardsAside);
      }
      next.done = false;
    }
    put(fan.current, next.fan); put(loose.current, next.loose); put(envelope.current, next.envelope);
    if (fan.current) fan.current.visible = next.fanVisible;
    if (loose.current) loose.current.visible = next.looseVisible;
    if (envelope.current) envelope.current.visible = next.envelopeVisible;
    if (flap.current) flap.current.rotation.x = next.flap;
    if (looseFront.current) looseFront.current.visible = next.looseKind !== 'back';
    if (looseBack.current) looseBack.current.visible = next.looseKind === 'back';
    const lifts = items.map((_, i) => i === next.fanSelected ? next.selectedLift : i === next.previousSelected ? next.previousLift : 0);
    const arranged = layout.current.update(items.map((c) => c.id), performance.now(), reducedMotion, lifts);
    const selectedTransform = arranged.transforms.get(items[next.fanSelected]?.id ?? '');
    if (!active && !reading && arranged.moving && selectedTransform && visual.pose === 'selected') next.right = handFromCard(composeCard(next.fan, selectedTransform), 1, 'holdBallot');
    left.current?.apply(next.left); right.current?.apply(next.right);
    if (gunGroup.current) {
      // Silahı EL taşır: çerçeve `PROP_FRAMES.holdGun`, dünya dönüşümü elden türer.
      const held = propFromHand(next.right, 1, PROP_FRAMES.holdGun!);
      gunGroup.current.position.set(...held.position);
      gunGroup.current.rotation.set(...held.rotation);
      gun.current?.apply(next.gunScale, next.gunSince, reducedMotion);
    }
    cards.current.forEach((g, i) => {
      if (!g) return;
      const base = arranged.transforms.get(items[i]?.id ?? '');
      const transform = base ?? fanCard(i, cardCount);
      put(g, transform); if (items[i]) layout.current.remember(items[i]!.id, transform);
      g.visible = production || !(state.pose === 'placed' && i === state.selected);
    });
    ghosts.current.forEach((g, i) => {
      if (!g) return;
      put(g, fanCard(i, ghostBacks));
      // Taşınan kart `loose` olarak çizilir; yelpazedeki kopyası gizlenir.
      g.visible = next.fanVisible && i !== next.fanSelected;
    });
    gl.domElement.dataset.fpEmote = active ? active.kind : '';
    gl.domElement.dataset.fpMotion = next.done ? 'settled' : state.motion?.kind ?? 'settled';
    gl.domElement.dataset.fpMotionProgress = String(state.motion ? Math.min(1, (performance.now() - state.motion.startedAt) / state.motion.duration).toFixed(3) : 1);
    gl.domElement.dataset.fpPrivateFaces = String(mode !== 'overview' ? (next.fanVisible ? cardCount - (!production && state.pose === 'placed' ? 1 : 0) : state.pose === 'envelope' && next.looseVisible ? 1 : 0) : 0);
    if (!next.done || arranged.moving) invalidate();
  };
  useLayoutEffect(() => { apply(); invalidate(); }); useFrame(apply);
  const envelopePrint = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = '#ad9977'; ctx.lineWidth = 3; ctx.strokeRect(8, 8, w - 16, h - 16);
    lettering(ctx, sceneText(language, 'hand.private'), w / 2, h * .75, h * .075, '#796a50');
  }, [language]);
  return <group name="PrototypeHandRig">
    <SkinnedHand ref={left} side={-1} quality={quality} skin={skin} /><SkinnedHand ref={right} side={1} quality={quality} skin={skin} />
    {shooting && <group ref={gunGroup}><GunProp ref={gun} castShadow={quality !== 'low'} /></group>}
    <group ref={fan} visible={pose.fanVisible}>{items.map((card, index) => <group key={card.id} ref={(g) => { cards.current[index] = g; }}>
      <PhysicalCard art={mode === 'overview' ? { kind: 'back' } : card.art} slot={index} aimed={!!aimed && slots[index]?.actionId === aimed.actionId && slots[index]?.optionId === aimed.optionId} selected={state.pose === 'selected' && index === state.selected} onPick={selectable ? () => onSelect(index) : undefined} />
      {selectable && <TargetZone slot selection={slots[index] ?? null} size={[.19, .015, .272]} />}
      {inspectedIndex === index && mode !== 'overview' && <mesh position={[-.085, .006, -.11]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.006, .009, 12]} /><meshBasicMaterial color="#c9a551" /></mesh>}
    </group>)}
    {Array.from({ length: ghostBacks }, (_unused, index) => <group key={`ghost-${index}`} ref={(g) => { ghosts.current[index] = g; }}>
      <PhysicalCard art={{ kind: 'back' }} />
    </group>)}</group>
    <group ref={loose} visible={pose.looseVisible}>
      <group ref={looseFront}><PhysicalCard art={art} /></group><group ref={looseBack}><PhysicalCard art={{ kind: 'back' }} /></group>
    </group>
    <group ref={envelope} visible={pose.envelopeVisible}>
      <Block size={[.245, .018, .335]} color="#d6c19b" radius={.006} />
      <PrintedFace width={.231} height={.32} position={[0, .01, 0]} draw={envelopePrint} resolution={512} />
      <group ref={flap} position={[0, .012, -.16]}><Block size={[.24, .005, .16]} color="#e3d1ad" position={[0, .002, .08]} radius={.002} /></group>
    </group>
  </group>;
}
