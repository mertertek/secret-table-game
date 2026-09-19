import type { HandPose, PoseName, RigState, Transform, Vec3 } from './model';
import { clamp } from './model';
import type { GripName } from '../hands/poses';
import { composeCard, fanCard, fanGrip, handFromCard, slerpRotation } from './grip';
import { EXECUTION, aimSettle, executionFrame } from '../animation/execution';
export const smooth = (p: number) => { const t = clamp(p, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix3 = (a: Vec3, b: Vec3, p: number): Vec3 => [lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p)];
export const mixTransform = (a: Transform, b: Transform, p: number): Transform => ({ position: mix3(a.position, b.position, p), rotation: mix3(a.rotation, b.rotation, p) });
const hand = (position: Vec3, rotation: Vec3 = [0, 0, 0], grip: GripName = 'rest'): HandPose => ({ position, rotation, grip });
const card = (position: Vec3, rotation: Vec3 = [0, 0, 0]): Transform => ({ position, rotation });
export type RigPose = { left: HandPose; right: HandPose; fan: Transform; loose: Transform; envelope: Transform; flap: number; fanVisible: boolean; looseVisible: boolean; envelopeVisible: boolean; looseKind: 'back' | 'policy' | 'vote' | 'role'; fanSelected: number; selectedLift: number; previousSelected: number; previousLift: number; done: boolean;
  /** D12 §4 — ilk şahıs silah: ölçek 0…1; `gunSince` ateşten beri geçen ms
   * (ateş yoksa `null`) — flaş, duman ve kıvılcımlar bundan türer (tur 4). */
  gunScale: number; gunSince: number | null };
/** D1 tur 2: dinlenme elleri 4 cm dışa, 3 cm geri (eski ±.40 / 1.35); yeni el
 * şablonu parmak ucuna kadar 0.19 m, eski konumda yelpazeye fazla yaklaşıyordu. */
export const restLeft = hand([-.44, .098, 1.38], [.05, -.09, -.08]);
export const restRight = hand([.44, .098, 1.38], [.05, .09, .08]);
const heldFan = card([0, .29, 1.22], [1.18, 0, 0]);
const holdRight = restRight;
const source = card([-.70, .065, .94]);
const tray = card([.70, .039, .94], [0, -.12, 0]);
/**
 * §e/§d sapması (gerekçeli): şartnamenin `pinchCard` çerçevesi kartı ÜST kenardan
 * tutuyor. Kart 0.272 m (gerçek kartın ~3 katı) olduğu için bilek kartın 9.6 cm
 * ÜSTÜNDE kalıyor, dirsek çıpası ise masa hizasında (y 0.14): önkol birinci şahıs
 * görüşünü çaprazlama kesiyordu. Alt kenardan tutuş ise bileği masaya (y 0.054)
 * indiriyor, manşet masayı deliyordu. Seçili/taşınan kart bu yüzden §e'nin YAN
 * TUTUŞ çerçevesiyle (`holdBallot`: sağ kenardan, bilek kart orta yüksekliğinde)
 * tutulur; `pinchCard` açı seti yalnız temas testlerinde doğrulanır.
 */
/** Rol kartı zarf ölçüsünde değil; §e holdEnvelope çerçevesi kart genişliğine göre
 * kaydırılır (sağ kenar el uzayında aynı z'de kalsın). */
const ROLE_ENVELOPE = { C: [0, -.061, -.1835] as const, euler: [-3.142, 1.571, 0] as const, halfThickness: .008, halfWidth: .095, halfHeight: .136 };
/** El dönüşü kuaterniyonla, konum doğrusal karışır; tutuş adı hedefe geçer.
 * D16: jest katmanı (`EmoteOverlay`) da bu karışımı kullanır. */
export function mixHand(a: HandPose, b: HandPose, t: number): HandPose {
  const p = clamp(t, 0, 1);
  if (p <= 0) return a;
  if (p >= 1) return b;
  const next: HandPose = { position: mix3(a.position, b.position, p), rotation: slerpRotation(a.rotation, b.rotation, p), grip: a.grip };
  if (a.grip !== b.grip) next.blend = { to: b.grip, t: p };
  else { const carried = p < .5 ? a.blend : b.blend; if (carried) next.blend = carried; }
  return next;
}
/** Kart düzleminde verilen ofsetle bir el konumu (bırakma anı, avuç kartın üstünde). */
const offsetInCard = (card: Transform, offset: Vec3): Transform => ({
  position: composeCard(card, { position: offset, rotation: [0, 0, 0] }).position, rotation: card.rotation,
});
const holdLeft = (count: number): HandPose => handFromCard(heldFan, -1, fanGrip(count));
/** Oy kartının masadaki yeri: yüzü aşağı (`z = π`) konur, açılırken aynı noktada çevrilir. */
export const ballotSpot: Transform = card([0, .035, 1.08], [0, 0, Math.PI]);
/**
 * D16 §5 — iki elli jestte (teslim/alkış) elden bırakılan kart paketi 250 ms'de
 * masaya YASLANIR ve jest bitince geri gelir. Yüz taşımaz, seçim değişmez.
 */
export const cardsAside: Transform = card([-.29, .085, 1.31], [1.28, .18, 0]);
/** Devir hareketi sonunda elde kalan kapalı kartların bırakıldığı yerler. */
const handoffAway = card([0, .05, .55], [0, 0, 0]);
const ballotAway = card([-.34, .045, 1.05], [0, 0, 0]);
/**
 * D12 tur 3 — hazır poz: silah elde ama nişanda değil. El sağ altta, namlu
 * masaya doğru eğik; kartları, tahtayı ve HUD'u kapatmaz.
 */
export const readyHand = (): HandPose => ({ position: [.475, .115, 1.52], rotation: [-.32, .12, -Math.PI / 2], grip: 'holdGun' });
/**
 * D1 tur 4: BOŞ elde asla yelpaze pozu yok. `hold/selected/placed` pozları da
 * kart sayısı 0 iken yelpazeyi göstermez ve iki el de dinlenmede kalır; eskiden
 * kanun atıldıktan sonra sol el havada boş yelpaze tutuşunda takılı kalıyordu.
 */
export function settledRig(pose: PoseName, selected: number, cardCount = 3): RigPose {
  const held = cardCount > 0 && (pose === 'hold' || pose === 'selected' || pose === 'placed');
  const result: RigPose = { left: restLeft, right: restRight, fan: heldFan, loose: tray, envelope: card([0, .026, 1.04]), flap: 0, gunScale: 0, gunSince: null,
    fanVisible: held, looseVisible: pose === 'placed' || pose === 'vote' || pose === 'voted' || pose === 'envelope', envelopeVisible: pose === 'envelope',
    looseKind: pose === 'vote' ? 'vote' : pose === 'envelope' ? 'role' : 'back', fanSelected: selected, selectedLift: pose === 'selected' && cardCount > 0 ? .065 : 0, previousSelected: -1, previousLift: 0, done: true };
  if (result.fanVisible) { result.left = holdLeft(cardCount); result.right = holdRight; }
  if (pose === 'placed') result.right = restRight;
  if (pose === 'selected' && cardCount > 0) result.right = handFromCard(composeCard(heldFan, fanCard(selected, cardCount, .065)), 1, 'holdBallot');
  if (pose === 'ready') { result.right = readyHand(); result.gunScale = 1; }
  if (pose === 'vote') result.loose = card([0, .035, 1.08]);
  if (pose === 'voted') result.loose = card(ballotSpot.position, ballotSpot.rotation);
  if (pose === 'envelope') {
    result.loose = card([0, .26, 1.23], [1.18, 0, 0]); result.flap = -2.85;
    result.left = handFromCard(result.loose, -1, 'holdEnvelope', ROLE_ENVELOPE);
    result.right = handFromCard(result.loose, 1, 'holdEnvelope', ROLE_ENVELOPE);
  }
  return result;
}
/**
 * D12 §5 — nişandaki sağ el. Omuz çıpası etrafında yaw'a döner; el uzayı dünya
 * uzayıdır (ilk şahıs rig kameraya bağlı DEĞİL, koltuğun önünde durur), bu yüzden
 * bakış yaw'ı çıkarılmaz: silah kafa nereye bakarsa baksın hedefi gösterir.
 */
export const AIM_PIVOT: Vec3 = [0, .105, 1.94];
/** Tur 2: el kamera ekseninin sağında ve hemen altında (göz 0,51 · bakış −15°);
 * silah kadrajın merkezine yakın durur ve YAN PROFİLİ okunur (namlu, tambur,
 * tetik korkuluğu görünür). */
const AIM_OFFSET: Vec3 = [.255, .175, -.58];
/** Namlunun hedefe göre hafif yukarı açısı (§2/§4: +6°). */
const BARREL_LIFT = .105;
/** Bilek ekseninde yuvarlanma: avuç içe döner, kabza yumrukta dikey kalır. */
const HAND_ROLL = -Math.PI / 2;
export function aimedHand(yaw: number, recoil = 0): HandPose {
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const back = EXECUTION.recoil.back * recoil;
  const x = AIM_OFFSET[0], z = AIM_OFFSET[2] + back;
  return {
    position: [AIM_PIVOT[0] + x * cos + z * sin, AIM_PIVOT[1] + AIM_OFFSET[1], AIM_PIVOT[2] - x * sin + z * cos],
    rotation: [BARREL_LIFT + EXECUTION.recoil.lift * recoil, yaw, HAND_ROLL],
    grip: 'holdGun',
  };
}
export function sampleRig(state: RigState, now: number, reduced: boolean, cardCount = 3): RigPose {
  const end = settledRig(state.pose, state.selected, cardCount); const motion = state.motion;
  // D12 §8: azaltılmış hareketde bile infaz koreografisi TAM süre oynar (silah
  // nişanda sabit durur, 1300'de ateş eder); diğer hareketler anında biter.
  if (!motion || (reduced && motion.kind !== 'shoot') || now >= motion.startedAt + motion.duration) return end;
  // Hayalet sırtlar: el zaten boşaldıysa devir hareketi boyunca kart sayısı yerine
  // kamu adedi (`ghostBacks`) kullanılır; hareket bitince settled poz geri döner.
  const ghosts = motion.ghostBacks ?? 0;
  const cards = ghosts > 0 ? ghosts : cardCount;
  const t = clamp((now - motion.startedAt) / motion.duration, 0, 1); end.done = false;
  const begin = motion.fromFrame ?? settledRig(motion.from, motion.fromSelected ?? state.selected, cards);
  if (motion.kind === 'draw') {
    const reach = hand([-.54, .11, 1.095], [.16, .63, -.08], 'openPlace');
    const pull = smooth((t - .34) / .66);
    end.left = mixHand(restLeft, reach, smooth(t / .34));
    end.right = mixHand(restRight, holdRight, smooth((t - .45) / .55));
    end.fanVisible = t >= .30; end.fan = mixTransform(source, heldFan, pull);
    end.fan.position = [end.fan.position[0], end.fan.position[1] + Math.sin(pull * Math.PI) * .13, end.fan.position[2]];
    if (t >= .34) end.left = mixHand(reach, handFromCard(end.fan, -1, fanGrip(cards)), smooth(pull / .28));
  } else if (motion.kind === 'select' || motion.kind === 'cancel') {
    const p = smooth(t); end.left = mixHand(begin.left, end.left, p);
    end.fan = mixTransform(begin.fan, end.fan, p);
    if (motion.kind === 'select') {
      const previous = begin.fanSelected;
      const switching = begin.selectedLift > 0 && previous !== state.selected;
      const reachEnd = switching ? .55 : .35;
      end.selectedLift = .065 * smooth((t - reachEnd) / (1 - reachEnd));
      const contact = handFromCard(composeCard(end.fan, fanCard(state.selected, cards, end.selectedLift)), 1, 'holdBallot');
      if (switching) {
        end.previousSelected = previous; end.previousLift = begin.selectedLift * (1 - smooth(t / .25));
        const previousContact = handFromCard(composeCard(end.fan, fanCard(previous, cards, end.previousLift)), 1, 'holdBallot');
        end.right = t < .25 ? mixHand(begin.right, previousContact, smooth(t / .08)) : mixHand(previousContact, contact, smooth((t - .25) / .30));
      } else end.right = mixHand(begin.right, contact, smooth(t / reachEnd));
      // Reach first; once the pinch closes, the hand carries the card throughout
      // its lift. The remaining packet stays supported by the left hand.
      if (t >= reachEnd) end.right = contact;
    } else {
      end.selectedLift = begin.selectedLift * (1 - smooth(t / .65));
      const contact = handFromCard(composeCard(end.fan, fanCard(state.selected, cards, end.selectedLift)), 1, 'holdBallot');
      end.right = t < .65 ? mixHand(begin.right, contact, smooth(t / .12)) : mixHand(contact, end.right, smooth((t - .65) / .35));
    }
  } else if (motion.kind === 'place') {
    const selectedStart = composeCard(heldFan, fanCard(state.selected, cards, .065));
    const lift = card([selectedStart.position[0] + .08, .42, 1.13], selectedStart.rotation);
    end.looseKind = t < .32 ? 'policy' : 'back';
    end.loose = t < .26 ? mixTransform(selectedStart, lift, smooth(t / .26)) : mixTransform(lift, tray, smooth((t - .26) / .65));
    const contact = handFromCard(end.loose, 1, 'holdBallot');
    // §e çerçevesi kartın ARKASINDAN ve 0.23 m gerisinden tutar; kart yatınca bu
    // el masanın altında ve kolun erişemeyeceği kadar uzakta kalırdı. Kart
    // düzleştikçe el kartın ÜSTÜNE yuvarlanır (avuç aşağı) ve açık ele geçer.
    const flat = clamp(1 - end.loose.rotation[0] / 1.18, 0, 1);
    const above: HandPose = { ...offsetInCard(end.loose, [.030, .105, .130]), grip: 'openPlace' };
    const carry = mixHand(contact, above, flat);
    end.right = t < .90 ? carry : mixHand(carry, restRight, smooth((t - .90) / .10));
    // Kart ayrılınca kalan paket 3 → 2 tutuşuna geçer (§d).
    const shrink = smooth((t - .26) / .19);
    end.left = shrink <= 0 ? holdLeft(cards) : { ...holdLeft(cards), blend: { to: fanGrip(Math.max(1, cards - 1)), t: shrink } };
    if (ghosts > 0) {
      // Devir: el görünümde zaten boş. Kapalı paket hareket boyunca görünür kalır,
      // dış kart tepsiye gider, kalan sırtlar masa ortasına bırakılıp kaybolur.
      end.fanVisible = true; end.looseKind = 'back';
      end.fan = mixTransform(heldFan, handoffAway, smooth((t - .45) / .55));
      end.left = mixHand(holdLeft(cards), restLeft, smooth((t - .42) / .40));
    }
  } else if (motion.kind === 'ballot') {
    // Oy: kapalı kart sağ elle masaya konur ve ORADA KALIR (`voted`). Yüz yok;
    // kalan kapalı kart sol elle önüne bırakılır.
    const selectedStart = composeCard(heldFan, fanCard(state.selected, cards, .065));
    const lift = card([selectedStart.position[0] * .55, .38, 1.15], selectedStart.rotation);
    end.fanVisible = cards > 0; end.looseVisible = true; end.looseKind = 'back';
    end.loose = t < .28 ? mixTransform(selectedStart, lift, smooth(t / .28)) : mixTransform(lift, ballotSpot, smooth((t - .28) / .62));
    // Kartın kendi `z` çevrilmesi ele yansıtılmaz: tutuş çerçevesi ters dönerse
    // bilek masanın ALTINA düşerdi. El düz kart düzlemini takip eder.
    const grasped = { position: end.loose.position, rotation: [end.loose.rotation[0], end.loose.rotation[1], 0] as Vec3 };
    const flat = clamp(1 - grasped.rotation[0] / 1.18, 0, 1);
    const carry = mixHand(handFromCard(grasped, 1, 'holdBallot'), { ...offsetInCard(grasped, [.030, .105, .130]), grip: 'openPlace' }, flat);
    end.right = t < .90 ? carry : mixHand(carry, restRight, smooth((t - .90) / .10));
    end.fan = mixTransform(heldFan, ballotAway, smooth((t - .40) / .60));
    end.left = mixHand(holdLeft(cards), restLeft, smooth((t - .40) / .45));
  } else if (motion.kind === 'vote') {
    const p = smooth(t);
    end.loose.position = [0, .035 + Math.sin(p * Math.PI) * .13, 1.08]; end.loose.rotation = [0, 0, Math.PI * (1 - p)];
    end.right = mixHand(restRight, handFromCard(end.loose, 1, 'holdBallot'), smooth(Math.sin(t * Math.PI)));
    end.left = mixHand(restLeft, hand([-.17, .08, 1.2], [.2, -.35, -.06], 'openPlace'), smooth(Math.sin(t * Math.PI)));
  } else if (motion.kind === 'envelope') {
    end.flap = -2.85 * smooth((t - .10) / .43);
    end.looseVisible = t >= .43;
    end.loose = mixTransform(card([0, .049, 1.05]), end.loose, smooth((t - .43) / .57));
    // Kart masada yatarken §e çerçevesi bilekleri kartın 6 cm ALTINA koyar; eller
    // önce zarfa uzanır (açık el), kart kalktıkça tutuşa geçer.
    const leftContact = handFromCard(end.loose, -1, 'holdEnvelope', ROLE_ENVELOPE);
    const rightContact = handFromCard(end.loose, 1, 'holdEnvelope', ROLE_ENVELOPE);
    const leftReach = hand([-.20, .095, 1.10], [.30, -.28, -.06], 'openPlace');
    const rightReach = hand([.20, .095, 1.10], [.30, .28, .06], 'openPlace');
    end.left = t < .45 ? mixHand(restLeft, leftReach, smooth(t / .45)) : mixHand(leftReach, leftContact, smooth((t - .45) / .35));
    end.right = t < .45 ? mixHand(restRight, rightReach, smooth(t / .45)) : mixHand(rightReach, rightContact, smooth((t - .45) / .35));
  }
  else if (motion.kind === 'shoot') {
    // D12 §4/§5 — ilk şahıs infaz: sağ el silahla kalkar, hedefe döner, ateş
    // eder, iner. Sol el masada kalır; hiçbir kart görünmez.
    const f = executionFrame(now, motion.startedAt, reduced);
    const yaw = (motion.aimYaw ?? 0) * f.aim + aimSettle(now, motion.startedAt, reduced);
    end.fanVisible = false; end.looseVisible = false; end.envelopeVisible = false;
    end.left = restLeft;
    // Tur 3: koreografi HAZIR POZDAN başlar (silah zaten elde); hazır poz yoksa
    // el dinlenmeden kalkar ve silah ilk 150 ms'de belirir.
    const fromReady = motion.from === 'ready';
    end.right = mixHand(fromReady ? readyHand() : restRight, aimedHand(yaw, f.recoil), f.raise);
    end.gunScale = fromReady ? Math.max(f.scale, clamp((motion.startedAt + motion.duration - now) / EXECUTION.scaleOutMs, 0, 1)) : f.scale;
    end.gunSince = now - motion.startedAt - EXECUTION.fireAt;
  }
  // Ne kart ne hayalet varsa hiçbir dal boş yelpaze tutuşu bırakamaz.
  if (!cards && motion.kind !== 'vote' && motion.kind !== 'envelope') { end.fanVisible = false; end.left = restLeft; }
  return end;
}
/** D1 tur 2: dirsek çıpası aşağı, dışa ve kameranın hizasına çekildi
 * (eski [±.49, .14, 1.87]). Böylece önkol kamera düzlemine paralel uzanmak yerine
 * aşağıdan geliyor ve yakın planda kadrajı çaprazlama kesmiyor. */
export const elbow = (side: -1 | 1): Vec3 => [side * .43, .035, 1.985];
