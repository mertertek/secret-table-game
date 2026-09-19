import { Euler, Quaternion, Vector3 } from 'three';
import { CARD_FRAMES } from '../hands/poses';
import type { CardFrame, GripName } from '../hands/poses';
import type { HandPose, Transform, Vec3 } from './model';

/** D1 §e: yelpaze pivotu kart merkez çizgisinden BAŞ PARMAK YASTIĞINA taşındı.
 * Kartlar bu nokta etrafında Y'de döner; köşe etiketleri (üst şerit ve sol dikey
 * şerit) baş parmağın altında kalmaz. */
export const FAN_PIVOT = { x: -.062, z: .110 } as const;

/** Cards pivot around the thumb pad, so removing one leaves a held packet. */
export function fanCard(index: number, count: number, lift = 0): Transform {
  const slot = index - (count - 1) / 2;
  const raised = Math.min(1, lift / .065);
  const angle = slot * -.80 * (1 - raised);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return {
    position: [FAN_PIVOT.x - (FAN_PIVOT.x * cos + FAN_PIVOT.z * sin) + slot * (.021 * (1 - raised) + .13 * raised),
      slot * .004 + lift * .45,
      FAN_PIVOT.z - (-FAN_PIVOT.x * sin + FAN_PIVOT.z * cos) - lift * 1.4],
    rotation: [0, angle, 0],
  };
}
export function composeCard(parent: Transform, child: Transform): Transform {
  const position = new Vector3(...child.position).applyEuler(new Euler(...parent.rotation)).add(new Vector3(...parent.position));
  // Fan rotates around its own Y before the shared X tilt.
  return { position: position.toArray() as [number, number, number], rotation: [parent.rotation[0], child.rotation[1], parent.rotation[2]] };
}

/** Kart sayısına karşılık gelen yelpaze tutuşu (§d). */
export const fanGrip = (count: number): GripName => count >= 3 ? 'holdFan3' : count === 2 ? 'holdFan2' : 'holdFan1';

/** Şablon çerçevesini sol ele aynalar: `C.x → −C.x`, Euler `(a,b,c) → (a,−b,−c)`. */
export function mirrorFrame(frame: CardFrame, side: -1 | 1): CardFrame {
  if (side === 1) return frame;
  return { ...frame, C: [-frame.C[0], frame.C[1], frame.C[2]], euler: [frame.euler[0], -frame.euler[1], -frame.euler[2]] };
}

const scratch = { q: new Quaternion(), frame: new Quaternion(), e: new Euler(), out: new Euler(), c: new Vector3(), p: new Vector3() };

/**
 * D1 §e — EL KARTI TAŞIR. Kart paketinin el uzayındaki çerçevesi sabittir; el
 * dünya dönüşümü kartınkinden türetilir:
 *   `R_hand = R_card · R_cardInHandᵀ`, `p_hand = p_card − R_hand · C`.
 * Eski `cardGrip` ofsetlerinin (sol [−.075,−.035,.175]) yerine geçer.
 */
export function handFromCard(card: Transform, side: -1 | 1, grip: GripName, override?: CardFrame): HandPose {
  const frame = override ?? CARD_FRAMES[grip];
  if (!frame) return { position: card.position, rotation: card.rotation, grip };
  const mirrored = mirrorFrame(frame, side);
  scratch.q.setFromEuler(scratch.e.set(card.rotation[0], card.rotation[1], card.rotation[2], 'XYZ'));
  scratch.frame.setFromEuler(scratch.e.set(mirrored.euler[0], mirrored.euler[1], mirrored.euler[2], 'XYZ')).invert();
  scratch.q.multiply(scratch.frame);
  scratch.c.set(mirrored.C[0], mirrored.C[1], mirrored.C[2]).applyQuaternion(scratch.q);
  scratch.p.set(card.position[0], card.position[1], card.position[2]).sub(scratch.c);
  scratch.out.setFromQuaternion(scratch.q, 'XYZ');
  // −0 ile 0 farkı testlerde ve karşılaştırmalarda gürültü yapar.
  const z = (v: number) => v === 0 ? 0 : v;
  return { position: [z(scratch.p.x), z(scratch.p.y), z(scratch.p.z)], rotation: [z(scratch.out.x), z(scratch.out.y), z(scratch.out.z)], grip };
}

/**
 * D12 — `handFromCard`ın TERSİ: elin dünya dönüşümünden nesnenin (silah)
 * dünya dönüşümü. `p_prop = p_hand + R_hand·C`, `R_prop = R_hand · R_frame`.
 */
export function propFromHand(hand: Transform, side: -1 | 1, frame: CardFrame): Transform {
  const mirrored = mirrorFrame(frame, side);
  scratch.q.setFromEuler(scratch.e.set(hand.rotation[0], hand.rotation[1], hand.rotation[2], 'XYZ'));
  scratch.c.set(mirrored.C[0], mirrored.C[1], mirrored.C[2]).applyQuaternion(scratch.q);
  scratch.p.set(hand.position[0], hand.position[1], hand.position[2]).add(scratch.c);
  scratch.frame.setFromEuler(scratch.e.set(mirrored.euler[0], mirrored.euler[1], mirrored.euler[2], 'XYZ'));
  scratch.out.setFromQuaternion(scratch.q.multiply(scratch.frame), 'XYZ');
  const z = (v: number) => v === 0 ? 0 : v;
  return { position: [z(scratch.p.x), z(scratch.p.y), z(scratch.p.z)], rotation: [z(scratch.out.x), z(scratch.out.y), z(scratch.out.z)] };
}

/** El dönüşünü kuaterniyonla karıştırır: Euler ±π sıçraması eli ters çevirmesin. */
export function slerpRotation(a: Vec3, b: Vec3, t: number): Vec3 {
  const qa = new Quaternion().setFromEuler(new Euler(a[0], a[1], a[2], 'XYZ'));
  const qb = new Quaternion().setFromEuler(new Euler(b[0], b[1], b[2], 'XYZ'));
  const e = new Euler().setFromQuaternion(qa.slerp(qb, Math.max(0, Math.min(1, t))), 'XYZ');
  return [e.x === 0 ? 0 : e.x, e.y === 0 ? 0 : e.y, e.z === 0 ? 0 : e.z];
}
