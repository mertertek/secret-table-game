/**
 * D16 §5 — el jestlerinin SAF katmanı (`docs/design/D16-emotes.md`).
 *
 * Burada React, three ya da DOM yoktur: jestin o andaki el hedefleri, kart
 * görünürlüğü ve baş sapması hesaplanır. İlk şahıs (`HandRig`) ve kamu
 * (`EmoteArms`) aynı tablodan okur; testler bu fonksiyonlara bakar.
 *
 * Zaman: `since` = jestin YEREL başlangıcından beri geçen ms (alıcı saati).
 * Süre dolunca `null` döner → katman kalkar, çizim sıfırlanır.
 */
import { EMOTE_DURATION_MS, EMOTE_KINDS, EMOTE_LABEL, EMOTE_SYMBOL, type EmoteKind, type EmoteSignal } from '@secret-table/contracts';
import { Euler, Quaternion, Vector3 } from 'three';
import type { HandPose, Look, PoseName, Vec3 } from '../prototype/model';

export type { EmoteKind };

/** Sembol ve etiket tek kaynaktan (sözleşme) gelir; sahne yalnız yeniden yayar. */
export { EMOTE_LABEL, EMOTE_SYMBOL };

/** İki el gereken jestler (kartlar masaya yaslanır). */
export const EMOTE_TWO_HANDED: ReadonlySet<EmoteKind> = new Set<EmoteKind>(['hands_up', 'clap']);

/** Katman giriş/çıkış yumuşaması (ms). */
export const EMOTE_FADE_IN_MS = 180;
export const EMOTE_FADE_OUT_MS = 240;
/** İki elli jestte kartların masaya yaslanma süresi (tasarım §5). */
export const EMOTE_CARDS_ASIDE_MS = 250;
/** `point` kolunun kamu tarafında izlediği pitch sınırı (±20°). */
export const EMOTE_POINT_PITCH = 20 * Math.PI / 180;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (t: number) => { const p = clamp01(t); return p * p * (3 - 2 * p); };

/**
 * Jest bu ilk-şahıs pozunda reddedilir (tasarım §5): silah hazır pozdayken ya
 * da infaz koreografisi oynarken el meşguldür.
 */
export function emoteAllowed(pose: PoseName, motion?: { kind: string } | null): boolean {
  return pose !== 'ready' && pose !== 'aim' && motion?.kind !== 'shoot';
}

export type EmoteFrame = {
  kind: EmoteKind;
  /** Katman ağırlığı 0…1 (giriş/çıkış). */
  weight: number;
  /** Sağ el hedefi (her jestte var). */
  right: HandPose;
  /** Sol el hedefi — yalnız iki elli jestlerde. */
  left: HandPose | null;
  /** Kartların masaya yaslanma oranı 0…1 (iki elli jest). */
  cardsAside: number;
  /** İlk şahısta kart yelpazesi çizilsin mi. */
  cardsVisible: boolean;
  /** Baş ek eğimi (kamu): `facepalm` öne eğer. */
  headPitch: number;
};

const hand = (position: Vec3, rotation: Vec3, grip: HandPose['grip']): HandPose => ({ position, rotation, grip });

/** Yaw ekseni etrafında bir çıpaya göre konum (kol omuzdan döner). */
function swing(pivot: Vec3, offset: Vec3, yaw: number): Vec3 {
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  return [pivot[0] + offset[0] * cos + offset[2] * sin, pivot[1] + offset[1], pivot[2] - offset[0] * sin + offset[2] * cos];
}

// --- İlk şahıs (dünya uzayı; göz ≈ (0, 0.51, 2.035), ileri −Z) ---------------

/** `point` kolunun omuz çıpası. */
export const EMOTE_POINT_PIVOT: Vec3 = [0, .36, 1.96];
const POINT_OFFSET: Vec3 = [.22, .08, -.50];
/**
 * El bakışın 23° SAĞINDA durur ve parmak içeri (bakışa) doğru kırılır: yoksa
 * parmak kameranın tam ekseninde kalır ve yumruk gibi görünür. Bilek
 * yuvarlanması avucu içe çevirir, işaret parmağı yandan okunur.
 */
const POINT_HAND_YAW = .52, POINT_HAND_PITCH = .26, POINT_HAND_ROLL = -.30;

/** Dünya dikey ekseni (bakış yaw'ı bu eksende döner). */
const UP = new Vector3(0, 1, 0);
const turnScratch = { q: new Quaternion(), yaw: new Quaternion(), e: new Euler(), out: new Euler() };

/**
 * Tur 3 (kullanıcı: "işaret atınca el dönüyor, diğerlerinde dönmüyor"): eli
 * gövde ekseni (`EMOTE_POINT_PIVOT`) etrafında `yaw` kadar KATI döndürür —
 * konum `swing` ile, dönüş dünya yaw'ının ÖN çarpımıyla. Kamera da aynı eksende
 * döndüğü için el kadrajda aynı yerde kalır. `point` bu yoldan GEÇMEZ (kendi
 * okunabilirlik kaydırması vardır, tur 1/2 çıktısı birebir korunur).
 */
function turnHand(pose: HandPose, yaw: number): HandPose {
  if (!yaw) return pose;
  const [x, y, z] = pose.position;
  const position = swing(EMOTE_POINT_PIVOT,
    [x - EMOTE_POINT_PIVOT[0], y - EMOTE_POINT_PIVOT[1], z - EMOTE_POINT_PIVOT[2]], yaw);
  turnScratch.q.setFromEuler(turnScratch.e.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ'));
  turnScratch.q.premultiply(turnScratch.yaw.setFromAxisAngle(UP, yaw));
  const r = turnScratch.out.setFromQuaternion(turnScratch.q, 'XYZ');
  return { ...pose, position, rotation: [r.x, r.y, r.z] };
}

/** Jest bitiş zamanı geçti mi. */
export const emoteEnded = (kind: EmoteKind, since: number) => !(since >= 0) || since >= EMOTE_DURATION_MS[kind];

/** Giriş/çıkış ağırlığı; `reduced` iken anında 1 (salınım yok, poz hemen). */
export function emoteWeight(kind: EmoteKind, since: number, reduced: boolean): number {
  const total = EMOTE_DURATION_MS[kind];
  if (!(since >= 0) || since >= total) return 0;
  if (reduced) return 1;
  return Math.min(smooth(since / EMOTE_FADE_IN_MS), smooth((total - since) / EMOTE_FADE_OUT_MS));
}

/** Tur 2 salınımları: azaltılmış harekette 0 (poz sabit durur). */
function wobble(kind: EmoteKind, since: number, reduced: boolean): { swingY: number; beat: number; push: number } {
  if (reduced) return { swingY: 0, beat: 0, push: 0 };
  const total = EMOTE_DURATION_MS[kind];
  const p = clamp01(since / total);
  switch (kind) {
    // 3 salınım, ±25° (tasarım §2).
    case 'wave': return { swingY: Math.sin(p * Math.PI * 6) * (25 * Math.PI / 180) * Math.sin(p * Math.PI) ** .5, beat: 0, push: 0 };
    // 4 vuruş: eller 2 cm'ye kadar yaklaşır.
    case 'clap': return { swingY: 0, beat: Math.abs(Math.sin(p * Math.PI * 4)), push: 0 };
    // 2 küçük sıçrama.
    case 'thumbs_up': return { swingY: 0, beat: 0, push: Math.sin(p * Math.PI * 2) * .035 };
    // Aşağı bastırma.
    case 'thumbs_down': return { swingY: 0, beat: 0, push: -Math.abs(Math.sin(p * Math.PI * 2)) * .05 };
    // Avuç yüze yaklaşır ve kalır.
    case 'facepalm': return { swingY: 0, beat: 0, push: smooth(since / 420) };
    default: return { swingY: 0, beat: 0, push: 0 };
  }
}

/**
 * İlk şahıs jest karesi. TÜM jestler yerel bakış yaw'ını izler (tur 3): eller
 * gövde ekseni etrafında `look.yaw` kadar döner, böylece oyuncu sağa sola
 * bakınca kadrajda aynı yerde kalırlar. `look.pitch` yalnız `point` için
 * kullanılır (±20° kırpılmış hafif parmak eğimi).
 */
export function emoteFrame(kind: EmoteKind, since: number, reduced: boolean, look: Look = { yaw: 0, pitch: 0 }): EmoteFrame | null {
  if (emoteEnded(kind, since)) return null;
  const weight = emoteWeight(kind, since, reduced);
  const { swingY, beat, push } = wobble(kind, since, reduced);
  const two = EMOTE_TWO_HANDED.has(kind);
  const cardsAside = two ? (reduced ? 1 : smooth(since / EMOTE_CARDS_ASIDE_MS)) : 0;
  let right: HandPose;
  let left: HandPose | null = null;
  let headPitch = 0;
  switch (kind) {
    case 'point': {
      const pitch = clamp(look.pitch, -EMOTE_POINT_PITCH, EMOTE_POINT_PITCH);
      right = hand(swing(EMOTE_POINT_PIVOT, POINT_OFFSET, look.yaw),
        [POINT_HAND_PITCH + pitch * .6, look.yaw + POINT_HAND_YAW, POINT_HAND_ROLL], 'point');
      break;
    }
    case 'hands_up':
      right = hand([.27, .50, 1.42], [Math.PI / 2 - .22, .14, 0], 'openPalm');
      left = hand([-.27, .50, 1.42], [Math.PI / 2 - .22, -.14, 0], 'openPalm');
      break;
    case 'thumbs_up':
      right = hand([.26, .34 + push, 1.44], [.10, .22, -Math.PI / 2], 'thumbUp');
      break;
    case 'thumbs_down':
      right = hand([.26, .34 + push, 1.44], [-.10, .22, Math.PI / 2], 'thumbUp');
      break;
    case 'middle':
      right = hand([.20, .31, 1.46], [Math.PI / 2, 0, Math.PI], 'middleFinger');
      break;
    case 'wave':
      right = hand([.27, .47, 1.44], [Math.PI / 2 - .15, swingY, 0], 'openPalm');
      break;
    case 'clap': {
      const gap = .13 - beat * .12;
      right = hand([gap, .40, 1.48], [.20, 0, -Math.PI / 2], 'openPalm');
      left = hand([-gap, .40, 1.48], [.20, 0, Math.PI / 2], 'openPalm');
      break;
    }
    default: {
      // facepalm: avuç yüze yaklaşır, kadrajın üstünde durur; baş 10° öne eğilir.
      const near = push;
      right = hand([.06, .44 + near * .04, 1.52 + near * .20], [-1.85, -.10, .18], 'openPalm');
      headPitch = -10 * Math.PI / 180 * near;
      break;
    }
  }
  // Tur 3: `point` dışındaki jestler de bakışla döner (tek yerden, katı dönüş).
  if (kind !== 'point' && look.yaw) {
    right = turnHand(right, look.yaw);
    if (left) left = turnHand(left, look.yaw);
  }
  return { kind, weight, right, left, cardsAside, cardsVisible: !two, headPitch };
}

// --- Kamu (koltuk yerel uzayı; masa yüzeyi y = 0, ileri −Z) ------------------

/**
 * Kamu jesti KARAKTERİN KOLUNU kullanır: omuz + dirsek kemikleri döner
 * (`CharacterAvatar`), el o kolun ucuna oturur (`EmoteArms`). Böylece havada
 * duran kopuk el olmaz. Sayılar `docs/design/d3/characters.json` iskeletinden
 * gelir; karakter uzayı y − 0,305 = koltuk yerel y.
 */
const SEAT_Y = -.305;
/** Omuz eklemi (karakter uzayı → koltuk yerel). */
const SHOULDER_X = .215, SHOULDER_Y = .545 + SEAT_Y;
/** Omuz → dirsek ve dirsek → bilek (bind pozu, sağ kol). */
const UPPER: Vec3 = [.03, -.145, -.17];
const FORE: Vec3 = [-.025, -.06, -.154];

export type EmoteArmPose = {
  /** Omuz kemiği Euler XYZ (karakter iskeleti). */
  shoulder: Vec3;
  /** Dirsek kemiği Euler XYZ (menteşe: yalnız X). */
  elbow: Vec3;
  /** Bilek konumu (koltuk yerel) — el buraya oturur. */
  wrist: Vec3;
  /** Elin dünya Euler'i (kol dönüşü + jest bilek açısı). */
  rotation: Vec3;
};
export type EmoteArmFrame = {
  kind: EmoteKind;
  grip: 'point' | 'openPalm' | 'thumbUp' | 'middleFinger';
  weight: number;
  right: EmoteArmPose;
  left: EmoteArmPose | null;
  /** Baş ek eğimi (öne) — `facepalm`. */
  headPitch: number;
};

export const EMOTE_GRIP: Readonly<Record<EmoteKind, EmoteArmFrame['grip']>> = {
  point: 'point',
  hands_up: 'openPalm',
  thumbs_up: 'thumbUp',
  thumbs_down: 'thumbUp',
  middle: 'middleFinger',
  wave: 'openPalm',
  clap: 'openPalm',
  facepalm: 'openPalm',
};

/** Jest başına hedef bilek noktası (sağ kol) + dirsek bükümü + bilek açısı. */
type ArmTarget = { target: Vec3; bend: number; wrist: Vec3 };

/**
 * İki elli jestlerde (hands_up/clap) uygulanan yaw sınırı (tur 3). Karakterin
 * GÖVDESİ dönmediği için (bilinen sınır) tam ±1,4 rad'da kollar göğsü keserdi;
 * ±60°'de iki kol da gövdenin önünde kalır. NOT: kamu yolunda `ViewpointAdapter`
 * paylaşılan bakışı zaten ±0,65 rad'a (baş/boyun sınırı) kırpıyor; bu sınır saf
 * fonksiyonu daha geniş bir yaw'la çağıranlar için güvenlik ağıdır.
 */
export const EMOTE_TWO_HAND_YAW = Math.PI / 3;

/**
 * Tur 3: jest hedefini koltuk yerel DİKEY eksen etrafında `yaw` kadar döndürür
 * (`point` ile aynı yön kuralı: yaw > 0 → −X). Tek elli jestlerde çıpa omuz
 * (point'teki gibi), iki elli jestlerde gövde merkezidir: böylece iki el katı
 * bir çift olarak döner, aralarındaki mesafe korunur.
 */
function turnTarget(arm: ArmTarget, yaw: number, pivotX: number): ArmTarget {
  if (!yaw) return arm;
  const [x, y, z] = arm.target;
  return { ...arm, target: swing([pivotX, SHOULDER_Y, 0], [x - pivotX, y - SHOULDER_Y, z], yaw) };
}

const scratch = {
  v0: new Vector3(), dir: new Vector3(), q: new Quaternion(), rest: new Quaternion(),
  e: new Euler(), out: new Euler(), point: new Vector3(),
};

/** Dirsek `bend` kadar büküldüğünde omuzdan bileğe giden bind vektörü. */
function bentReach(side: -1 | 1, bend: number, shoulders: number, out: Vector3): Vector3 {
  const cos = Math.cos(bend), sin = Math.sin(bend);
  const fx = FORE[0] * side * shoulders, fy = FORE[1], fz = FORE[2];
  // Dirsek menteşesi X ekseninde.
  const y = fy * cos - fz * sin;
  const z = fy * sin + fz * cos;
  return out.set(UPPER[0] * side * shoulders + fx, UPPER[1] + y, UPPER[2] + z);
}

/**
 * Kolu hedefe NİŞANLAR: kol uzunluğu korunur (esneme yok), bilek gerçek uçta
 * kalır. Dönüş omuz/dirsek kemiği Euler'leri + bilek noktası + el dönüşüdür.
 */
function aimArm(side: -1 | 1, target: Vec3, bend: number, wrist: Vec3, weight: number, shoulders: number): EmoteArmPose {
  const sx = SHOULDER_X * side * shoulders;
  const bentBend = bend * weight;
  const v0 = bentReach(side, bentBend, shoulders, scratch.v0);
  scratch.dir.set(target[0] - sx, target[1] - SHOULDER_Y, target[2]);
  if (scratch.dir.lengthSq() < 1e-8) scratch.dir.copy(v0);
  scratch.q.setFromUnitVectors(scratch.point.copy(v0).normalize(), scratch.dir.normalize());
  // Katman ağırlığı: dinlenmeden hedefe yumuşak geçiş (kol havada belirmez).
  scratch.rest.identity();
  scratch.q.copy(scratch.rest.slerp(scratch.q, clamp01(weight)));
  scratch.point.copy(v0).applyQuaternion(scratch.q);
  const shoulder = scratch.out.setFromQuaternion(scratch.q, 'XYZ');
  const shoulderEuler: Vec3 = [shoulder.x, shoulder.y, shoulder.z];
  // El dünya dönüşü: kol dönüşü · dirsek menteşesi · jest bilek açısı.
  scratch.q.multiply(scratch.rest.setFromEuler(scratch.e.set(bentBend, 0, 0, 'XYZ')));
  scratch.q.multiply(scratch.rest.setFromEuler(scratch.e.set(wrist[0], wrist[1] * side, wrist[2] * side, 'XYZ')));
  const hand = scratch.out.setFromQuaternion(scratch.q, 'XYZ');
  return {
    shoulder: shoulderEuler,
    elbow: [bentBend, 0, 0],
    wrist: [sx + scratch.point.x, SHOULDER_Y + scratch.point.y, scratch.point.z],
    rotation: [hand.x, hand.y, hand.z],
  };
}

/**
 * Kamu jest karesi. `look` PAYLAŞILAN bakıştır (`PeerHeads` örneği). TÜM
 * jestlerin kolu ona döner (tur 3); `point` ayrıca pitch'i ±20° kırpılmış
 * biçimde izler, diğerleri yalnız yaw. İki elli jestlerde yaw ±60°'ye kırpılır.
 */
export function emoteArmFrame(kind: EmoteKind, since: number, reduced: boolean,
  look: Look = { yaw: 0, pitch: 0 }, shoulders = 1): EmoteArmFrame | null {
  if (emoteEnded(kind, since)) return null;
  const weight = emoteWeight(kind, since, reduced);
  const { swingY, beat, push } = wobble(kind, since, reduced);
  let right: ArmTarget;
  let left: ArmTarget | null = null;
  let headPitch = 0;
  switch (kind) {
    case 'point': {
      // Kol PAYLAŞILAN bakışa nişan alır: yön kameranın yön kuralıyla aynı
      // (yaw > 0 → −X), pitch ±20° kırpılır.
      const pitch = clamp(look.pitch, -EMOTE_POINT_PITCH, EMOTE_POINT_PITCH);
      const reach = .40, cp = Math.cos(pitch);
      right = {
        target: [
          SHOULDER_X * shoulders - reach * cp * Math.sin(look.yaw),
          SHOULDER_Y + reach * Math.sin(pitch) + .04,
          -reach * cp * Math.cos(look.yaw),
        ],
        bend: .12,
        wrist: [0, 0, 0],
      };
      break;
    }
    case 'hands_up':
      right = { target: [.34, .60, -.14], bend: .50, wrist: [.55, 0, 0] };
      left = { target: [-.34, .60, -.14], bend: .50, wrist: [.55, 0, 0] };
      break;
    case 'thumbs_up':
      right = { target: [.26, .30 + push, -.36], bend: .80, wrist: [0, 0, -Math.PI / 2] };
      break;
    case 'thumbs_down':
      right = { target: [.26, .20 + push, -.36], bend: .80, wrist: [0, 0, Math.PI / 2] };
      break;
    case 'middle':
      right = { target: [.24, .40, -.34], bend: .70, wrist: [.9, 0, Math.PI] };
      break;
    case 'wave':
      right = { target: [.32, .54, -.20], bend: .55, wrist: [.5, swingY, 0] };
      break;
    case 'clap': {
      const gap = .10 - beat * .08;
      right = { target: [gap, .28, -.38], bend: 1.0, wrist: [0, 0, -Math.PI / 2] };
      left = { target: [-gap, .28, -.38], bend: 1.0, wrist: [0, 0, -Math.PI / 2] };
      break;
    }
    default:
      right = { target: [.10, .46, -.14], bend: 1.05, wrist: [-.5, 0, 0] };
      headPitch = -10 * Math.PI / 180 * push;
      break;
  }
  // Tur 3: `point` dışındaki kollar da paylaşılan bakışa döner.
  if (kind !== 'point' && look.yaw) {
    const two = left !== null;
    const yaw = two ? clamp(look.yaw, -EMOTE_TWO_HAND_YAW, EMOTE_TWO_HAND_YAW) : look.yaw;
    right = turnTarget(right, yaw, two ? 0 : SHOULDER_X * shoulders);
    if (left) left = turnTarget(left, yaw, 0);
  }
  return {
    kind,
    grip: EMOTE_GRIP[kind],
    weight,
    right: aimArm(1, right.target, right.bend, right.wrist, weight, shoulders),
    left: left ? aimArm(-1, left.target, left.bend, left.wrist, weight, shoulders) : null,
    headPitch,
  };
}

// --- Alıcı latch'i -----------------------------------------------------------

export type ActiveEmote = { kind: EmoteKind; seq: number; startedAt: number };

/**
 * Uzak jestleri ALICI saatinde latch'ler: aynı gönderenin aynı `seq`i bir kez
 * oynatılır (250/600 ms tekrarları yalnız kaybı telafi eder), süre dolunca
 * kayıt düşer → boşta ek çizim 0.
 */
export class EmoteRegistry {
  private live = new Map<string, ActiveEmote>();
  private seen = new Map<string, number>();
  /** Yeni bir jest başlattıysa `true` (ses/kare tetikleyicisi). */
  accept(playerId: string, signal: EmoteSignal | undefined | null, now: number): boolean {
    if (!signal) return false;
    const last = this.seen.get(playerId) ?? 0;
    if (signal.seq <= last) return false;
    this.seen.set(playerId, signal.seq);
    this.live.set(playerId, { kind: signal.kind, seq: signal.seq, startedAt: now });
    if (this.seen.size > 64) for (const id of [...this.seen.keys()].slice(0, 32)) { if (!this.live.has(id)) this.seen.delete(id); }
    return true;
  }
  active(playerId: string, now: number): ActiveEmote | null {
    const hit = this.live.get(playerId);
    if (!hit) return null;
    if (emoteEnded(hit.kind, now - hit.startedAt)) { this.live.delete(playerId); return null; }
    return hit;
  }
  /** Oynayan jestlerden en yakın bitiş anı (kare planlamak için). */
  nextEnd(now: number): number | null {
    let best: number | null = null;
    for (const hit of this.live.values()) {
      const end = hit.startedAt + EMOTE_DURATION_MS[hit.kind];
      if (end > now && (best === null || end < best)) best = end;
    }
    return best;
  }
  /** Oyuncu listesi/oturum değişiminde temizlenir. */
  clear() { this.live.clear(); this.seen.clear(); }
  get size() { return this.live.size; }
}

/** Palet sırası (tasarım §2) — `1–8` kısayolu ve çark dilimleri bunu kullanır. */
export const EMOTE_ORDER: readonly EmoteKind[] = EMOTE_KINDS;
