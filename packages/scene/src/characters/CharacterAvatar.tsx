/**
 * D3 — prosedürel karakter: tek `SkinnedMesh`, 8 kemik, 2 malzeme grubu
 * (gövde = vertex renk, yüz = tuval dokusu). Oyuncu başına 2 çizim; eller
 * `PublicArms` ile 3'e tamamlanır (§g).
 *
 * Baş yönü kanalı (`PeerHeads`) boyun %40 + baş %60 olarak dağıtılır (§c);
 * D24'ten beri hedef ara değerli pozdur ve üstel yumuşatma katsayısı gönderim
 * aralığına bağlıdır (yerel örnek yolunda eski 12/s sabiti korunur).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Matrix4, SkinnedMesh } from 'three';
import type { SceneQuality } from '@secret-table/contracts';
import type { PeerHeads } from '../live/PeerHeads';
import { HEAD_TTL, headTarget } from '../prototype/model';
import type { HeadSample } from '../prototype/model';
import { characterGeometry, requestCharacterGeometry, TIERS } from './geometry';
import type { CharacterBuild } from './geometry';
import { boundaryMaterial } from './boundaryMaterial';
import { buildRig } from './skeleton';
import { BLINK_MS, FaceTexture, blinkLid, nextBlinkDelay } from './face';
import { SPEC, characterSpec, skinTones } from './spec';
import type { ExpressionName, SkinId, Tier } from './spec';
import { EXECUTION, flinchOffset, slumpAmount } from '../animation/execution';
import { emoteArmFrame } from '../live/EmoteOverlay';
import type { ActiveEmote } from '../live/EmoteOverlay';
import type { Look } from '../prototype/model';
import type { MotionTime } from '../animation/cues';

/** §0 karakter uzayı orijini minder üstüdür; koltuk grubunda dünya y −0,305. */
export const SEAT_OFFSET_Y = SPEC.frame.seatTopWorldY;
const CHANNEL = SPEC.skin.headChannel;

export type CharacterAvatarProps = {
  character: string;
  skin: SkinId;
  expression?: ExpressionName;
  /** `fpHeadYaw{index}` veri özniteliği için koltuk sırası. */
  index: number;
  sample?: HeadSample;
  heads?: PeerHeads;
  playerId?: string;
  connected: boolean;
  alive?: boolean;
  /**
   * D12 §4 — `alive === false` iken gövdenin yana devrildiği yön (atıcıdan UZAĞA).
   * Atıcı bilinmiyorsa −1.
   */
  slumpSide?: -1 | 1;
  /** D12 §4 — infaz cue'su etkinse çöküş 1380–2000 ms arası animasyonludur. */
  execution?: MotionTime;
  reducedMotion: boolean;
  quality?: SceneQuality;
  staleAfter?: number;
  /**
   * D16 §5 — jest sırasında baş hedefine EKLENEN eğim (rad, negatif = öne).
   * `facepalm` başı 10° öne eğer; `point` zaten paylaşılan yaw'ı izler.
   */
  headPitchOffset?: number;
  /**
   * D16 §5 — oynayan el jesti: omuz + dirsek kemikleri buna göre döner, el
   * (`EmoteArms`) kolun ucuna oturur. Jest yoksa kollar dinlenmede kalır.
   */
  emote?: ActiveEmote | null;
  /** Jest kolu `point`te bu bakışa nişan alır (paylaşılan yaw). */
  lookOf?: () => Look;
};

export function CharacterAvatar({
  character, skin, expression, index, sample, heads, playerId,
  connected, alive = true, slumpSide = -1, execution, reducedMotion, quality = 'standard', staleAfter = HEAD_TTL,
  headPitchOffset = 0, emote = null, lookOf,
}: CharacterAvatarProps) {
  const tier: Tier = quality === 'low' ? 'low' : 'standard';
  const spec = useMemo(() => characterSpec(character), [character]);
  const rig = useMemo(() => buildRig(spec), [spec]);
  const mesh = useRef<SkinnedMesh>(null);
  const root = useRef<Group>(null);
  const { invalidate, gl } = useThree();
  // §g: ilk kare LOW kademeyle çizilir (~0,1 s), standard üretim kuyrukta yapılır.
  const [build, setBuild] = useState<CharacterBuild>(() => characterGeometry(character, skin, 'low'));
  useEffect(() => {
    if (tier === 'low') { setBuild(characterGeometry(character, skin, 'low')); return; }
    let live = true;
    setBuild(characterGeometry(character, skin, 'low'));
    requestCharacterGeometry(character, skin, (next) => { if (live) { setBuild(next); invalidate(); } });
    return () => { live = false; };
  }, [character, skin, tier, invalidate]);
  // D12 §4/§7: vurulan oyuncu `ko` ifadesinde KALIR. Cue etkinse ifade tepki
  // anında (t = 1380) değişir; cue yoksa (yeniden bağlanma) anında.
  const [hit, setHit] = useState(() => !alive && !execution);
  useEffect(() => {
    if (alive) { setHit(false); return; }
    if (!execution) { setHit(true); return; }
    const left = execution.startedAt + EXECUTION.slumpFrom - performance.now();
    if (left <= 0) { setHit(true); return; }
    setHit(false);
    const timer = window.setTimeout(() => setHit(true), left);
    return () => window.clearTimeout(timer);
  }, [alive, execution]);
  const mood: ExpressionName = !alive && hit ? 'ko' : expression ?? spec.face.defaultExpression;

  // Doku anizotropisi renderer'ın izin verdiği en büyük değerde (Metal/ANGLE'da
  // 16): yüz penceresi eğik bakışta güçlü eğimlidir, mipmap tek başına bulanıklaştırır.
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const face = useMemo(() => new FaceTexture(tier, maxAnisotropy), [tier, maxAnisotropy]);
  /** Kaş tavanı: yüz grubunun görünen üst kenarı (baş merkezine göre mm). */
  const faceTopMm = (build.faceTop - SPEC.head.c[1]!) * 1000;
  useEffect(() => () => face.dispose(), [face]);
  useLayoutEffect(() => {
    if (face.draw(spec, skinTones(skin).base, mood, mood === 'grumpy' ? SPEC.faces.expressions.grumpy.lid : 0, faceTopMm)) invalidate();
  }, [face, spec, skin, mood, faceTopMm, invalidate]);

  // §f göz kırpma: `frameloop="demand"` altında kare zamanlayıcıyla istenir.
  useEffect(() => {
    if (reducedMotion || mood === 'surprised' || mood === 'ko') return;
    let timer = 0;
    const base = mood === 'grumpy' ? SPEC.faces.expressions.grumpy.lid : 0;
    const run = (startedAt: number) => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= BLINK_MS) {
        if (face.draw(spec, skinTones(skin).base, mood, base, faceTopMm)) invalidate();
        timer = window.setTimeout(() => run(performance.now()), nextBlinkDelay());
        return;
      }
      if (face.draw(spec, skinTones(skin).base, mood, Math.max(base, blinkLid(elapsed)), faceTopMm)) invalidate();
      timer = window.setTimeout(() => run(startedAt), 40);
    };
    timer = window.setTimeout(() => run(performance.now()), nextBlinkDelay());
    return () => clearTimeout(timer);
  }, [face, spec, skin, mood, reducedMotion, faceTopMm, invalidate]);

  const tint = alive ? '#ffffff' : '#777777';
  // Tur 4 — gövde malzemesi imperatif kurulur: `onBeforeCompile` yaması
  // (renk sınırı kenar-yumuşatması) ve program önbelleği anahtarı gerekiyor.
  const body = useMemo(() => boundaryMaterial(), []);
  useEffect(() => () => body.dispose(), [body]);
  useLayoutEffect(() => { body.color.set(tint); invalidate(); }, [body, tint, invalidate]);

  useLayoutEffect(() => { mesh.current?.bind(rig.skeleton, new Matrix4()); }, [rig, build]);
  useEffect(() => {
    const data = gl.domElement.dataset;
    data.d3Triangles = String(build.triangles);
    data.d3BuildMs = build.buildMs.toFixed(1);
  }, [gl, build]);
  useEffect(() => {
    if (!sample || heads) return;
    const timer = setTimeout(invalidate, Math.max(0, sample.receivedAt + staleAfter - performance.now()) + 5);
    return () => clearTimeout(timer);
  }, [sample, heads, invalidate, staleAfter]);
  useLayoutEffect(() => { invalidate(); }, [sample, connected, alive, hit, execution, reducedMotion, headPitchOffset, emote, invalidate]);

  const smoothed = useRef({ yaw: 0, pitch: 0 });
  useFrame((state, delta) => {
    if (heads) heads.frame(state.clock.elapsedTime, performance.now(), Date.now());
    // D24: uzak baş ara değerle okunur (`pose`); `reducedMotion` eski davranışta
    // kalır (ham son örnek + anında geçiş). Yerel `sample` yolu değişmez.
    const current = heads && playerId ? (reducedMotion ? heads.get(playerId) : heads.pose(playerId)) : sample;
    const base = headTarget(current, performance.now(), connected && alive, staleAfter);
    // D16: jest sapması baş hedefine eklenir (kanal verisi değişmez).
    const target = headPitchOffset ? { yaw: base.yaw, pitch: base.pitch + headPitchOffset } : base;
    // Yumuşatma katsayısı gönderim aralığına bağlıdır (5 kişi 500 ms, 10 kişi 1500 ms).
    const rate = heads && playerId && !reducedMotion ? heads.rate(playerId) : 12;
    const weight = reducedMotion ? 1 : 1 - Math.exp(-rate * Math.min(delta, .05));
    const s = smoothed.current;
    s.yaw += (target.yaw - s.yaw) * weight;
    s.pitch += (target.pitch - s.pitch) * weight;
    if (Math.abs(target.yaw - s.yaw) + Math.abs(target.pitch - s.pitch) > .001) invalidate();
    else { s.yaw = target.yaw; s.pitch = target.pitch; }
    // Hedefe oturulmuş olsa bile tamponda oynatılacak örnek varsa kare istenir.
    if (heads?.pending && !reducedMotion) invalidate();
    rig.byName.neck.rotation.set(s.pitch * CHANNEL.neck, s.yaw * CHANNEL.neck, 0);
    rig.byName.head.rotation.set(s.pitch * CHANNEL.head, s.yaw * CHANNEL.head, 0);
    // D16 §5 — jest kolu: omuz + dirsek kemikleri saf katmandan sürülür.
    const arms = emote ? emoteArmFrame(emote.kind, performance.now() - emote.startedAt, reducedMotion, lookOf?.(), spec.bodyScale.shoulders) : null;
    for (const side of ['R', 'L'] as const) {
      const pose = !arms ? null : side === 'R' ? arms.right : arms.left;
      const shoulder = rig.byName[`shoulder.${side}`], elbow = rig.byName[`elbow.${side}`];
      if (pose) {
        shoulder.rotation.set(pose.shoulder[0], pose.shoulder[1], pose.shoulder[2]);
        elbow.rotation.set(pose.elbow[0], 0, 0);
      } else if (shoulder.rotation.x || shoulder.rotation.y || shoulder.rotation.z || elbow.rotation.x) {
        shoulder.rotation.set(0, 0, 0);
        elbow.rotation.set(0, 0, 0);
      }
    }
    if (arms) invalidate();
    // D12 §4 — çöküş: kök grup yana devrilir, öne eğilir ve iner. Cue bitince
    // (ya da hiç gelmediyse) poz KALICI olarak çöküktür.
    if (root.current) {
      const fall = alive ? 0 : slumpAmount(performance.now(), execution?.startedAt, reducedMotion);
      root.current.rotation.z = slumpSide * EXECUTION.slump.roll * fall;
      root.current.rotation.x = EXECUTION.slump.pitch * fall;
      root.current.position.y = SEAT_OFFSET_Y - EXECUTION.slump.drop * fall;
      // Tur 4: çöküşten önce 80 ms'lik kısa sarsılma (mermi değdi).
      const flinch = alive ? 0 : flinchOffset(performance.now(), execution?.startedAt, reducedMotion);
      root.current.position.x = flinch;
      if (flinch !== 0) invalidate();
      if (!alive && fall < 1) invalidate();
    }
    const data = gl.domElement.dataset;
    data[`fpHeadYaw${index}`] = s.yaw.toFixed(3);
    data[`fpHeadPitch${index}`] = s.pitch.toFixed(3);
  });

  const shadow = TIERS[tier].castShadow;
  return <group ref={root} name="CharacterAvatar" position={[0, SEAT_OFFSET_Y, 0]}>
    <primitive object={rig.root} />
    <skinnedMesh ref={mesh} geometry={build.geometry} castShadow={shadow} frustumCulled={false}>
      <primitive object={body} attach="material-0" />
      <meshStandardMaterial attach="material-1" map={face.texture} color={tint} roughness={.85} metalness={0} />
    </skinnedMesh>
  </group>;
}
