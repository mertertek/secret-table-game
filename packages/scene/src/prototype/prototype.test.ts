import { Euler, Vector3 } from 'three';
import { FAN_PIVOT, composeCard, fanCard, fanGrip, handFromCard } from './grip';
import { describe, expect, it } from 'vitest';
import { getSceneFixture, makePlayers } from '../../../fixtures/src/index';
import { layoutSeats } from '../layout/seats';
import { acceptHead, centeredLook, constrainLook, draggedLook, gestureDuration, HEAD_TTL, headTarget, INITIAL_RIG, isDrag, lookLimits, poseAfter, privateArt, publicVote } from './model';
import type { Gesture, HeadSample } from './model';
import { ballotSpot, elbow, restLeft, restRight, sampleRig, settledRig } from './rig';
import { GRIPS } from '../hands/poses';
const fixture = getSceneFixture('president-discard')!.view;

describe('first person local input and seat anchor', () => {
  it.each([5, 6, 7, 8, 9, 10] as const)('%i seats: every selectable local player has their own anchor', (count) => {
    const players = makePlayers({ count });
    for (const player of players) {
      const seats = layoutSeats({ players, localPlayerId: player.playerId, playerCountAtStart: count });
      expect(seats.find((s) => s.player.playerId === player.playerId)?.chair).toEqual([0, -.74, 2]);
      expect(seats).toHaveLength(count);
    }
  });
  it('clamps finite and invalid look input without moving the seat', () => {
    expect(constrainLook({ yaw: 99, pitch: -99 })).toEqual({ yaw: lookLimits.yaw, pitch: lookLimits.pitchMin });
    expect(constrainLook({ yaw: NaN, pitch: Infinity })).toEqual({ yaw: 0, pitch: 0 });
    expect(draggedLook(centeredLook, 10000, 10000)).toEqual({ yaw: -lookLimits.yaw, pitch: lookLimits.pitchMax });
  });
  it('distinguishes small tap jitter from a drag at the threshold', () => {
    expect(isDrag(2, 2)).toBe(false); expect(isDrag(5, 0)).toBe(false); expect(isDrag(6, 0)).toBe(true); expect(isDrag(0, -7)).toBe(true);
  });
});
describe('private face boundary', () => {
  it('overview never constructs a private face; local modes use only current authorized fields', () => {
    const view = { ...fixture, privateView: { ...fixture.privateView, role: 'hitler' as const } };
    for (const mode of ['seat', 'inspect'] as const) {
      expect(privateArt(view, mode, 'role')).toEqual({ kind: 'role', role: 'hitler' });
      expect(privateArt(view, mode, 'policy', 0)).toEqual({ kind: 'policy', policy: 'liberal' });
    }
    expect(privateArt(view, 'overview', 'role')).toEqual({ kind: 'back' });
    expect(privateArt(view, 'overview', 'policy')).toEqual({ kind: 'back' });
    expect(privateArt({ ...view, privateView: { ...view.privateView, hand: [], role: null } }, 'seat', 'policy')).toEqual({ kind: 'back' });
    expect(privateArt({ ...view, privateView: { ...view.privateView, role: null } }, 'inspect', 'role')).toEqual({ kind: 'back' });
  });
  it('a hidden submitted vote cannot provide an open ballot face', () => {
    expect(publicVote({ ...fixture, privateView: { ...fixture.privateView, submittedVote: 'yes' } })).toBeUndefined();
    const open = getSceneFixture('election-result')!.view;
    expect(publicVote(open)).toBe('no');
  });
});
describe('finite hand motion and cancellation', () => {
  it.each(Object.keys(gestureDuration) as Gesture[])('%s reaches a deterministic final pose; reduced motion jumps directly', (kind) => {
    const start = { ...INITIAL_RIG, pose: kind === 'cancel' || kind === 'place' ? 'selected' as const : 'hold' as const };
    const state = poseAfter(start, kind, 1000, false);
    const expected = settledRig(state.pose, state.selected);
    expect(sampleRig(state, 1000 + gestureDuration[kind] + 1, false)).toEqual(expected);
    // D12 §8: infaz KOREOGRAFİSİ azaltılmış hareketde de tam süre oynar (silah
    // baştan nişanda durur); diğer hareketler son poza atlar.
    if (kind === 'shoot') expect(sampleRig(state, 1000, true).gunScale).toBe(1);
    else expect(sampleRig(state, 1000, true)).toEqual(expected);
    for (let i = 0; i <= 40; i++) {
      const sample = sampleRig(state, 1000 + gestureDuration[kind] * i / 40, false);
      for (const [hand, side] of [[sample.left, -1], [sample.right, 1]] as const) {
        expect([...hand.position, ...hand.rotation].every(Number.isFinite)).toBe(true);
        expect(GRIPS).toContain(hand.grip);
        // Wrist + forearm clearance; final mesh/card contact is checked in the browser.
        // D1: el kartı §e çerçevesinden taşıyor. Ölçülen uçlar: en alçak bilek
        // 0.071 m (oy/zarf), en uzun erişim 1.058 m (oy; dirsek çıpası tur 2'de geri çekildi). Eski .075 / 1.05
        // sınırları eski `cardGrip` ofsetlerine aitti; yeni değerler daha dar.
        expect(hand.position[1]).toBeGreaterThanOrEqual(.065);
        const base = elbow(side); const reach = Math.hypot(...hand.position.map((v, j) => v - base[j]!));
        expect(reach).toBeLessThan(1.09);
      }
    }
  });
  it('selection/cancellation has no final placement and increments local motion generation', () => {
    const selected = poseAfter({ ...INITIAL_RIG, pose: 'hold' }, 'select', 0, false, 2);
    const canceled = poseAfter(selected, 'cancel', 10, false);
    expect(canceled.pose).toBe('hold'); expect(canceled.revision).toBe(selected.revision + 1);
    expect(sampleRig(canceled, 10000, false).looseVisible).toBe(false);
  });
  it('completed placement is concealed regardless of the input card policy', () => {
    const state = poseAfter({ ...INITIAL_RIG, pose: 'selected' }, 'place', 0, false);
    expect(sampleRig(state, 1400, false).looseKind).toBe('back');
    const beforeEnd = sampleRig(state, gestureDuration.place - .001, false).right;
    const atEnd = sampleRig(state, gestureDuration.place, false).right;
    expect(Math.hypot(...beforeEnd.position.map((v, i) => v - atEnd.position[i]!))).toBeLessThan(.00001);
  });
});
describe('synthetic head samples (no network authorization claim)', () => {
  const sample: HeadSample = { playerId: 'p2', yaw: .4, pitch: .1, sequence: 3, receivedAt: 1000 };
  it('limits angles and refuses foreign, non-finite, old and out-of-order samples', () => {
    expect(acceptHead(undefined, { ...sample, yaw: 9, pitch: -9 }, ['p2'], 1000)).toMatchObject({ yaw: .65, pitch: -.25 });
    expect(acceptHead(undefined, sample, ['p3'], 1000)).toBeUndefined();
    expect(acceptHead(sample, { ...sample, yaw: NaN, sequence: 4 }, ['p2'], 1000)).toBe(sample);
    expect(acceptHead(sample, { ...sample, sequence: 2 }, ['p2'], 1000)).toBe(sample);
    expect(acceptHead(undefined, sample, ['p2'], 1000 + HEAD_TTL + 1)).toBeUndefined();
  });
  it('returns to neutral on timeout or disconnection; no gaze target is inferred', () => {
    expect(headTarget(sample, 1100, true)).toEqual({ yaw: .4, pitch: .1 });
    expect(headTarget(sample, 1000 + HEAD_TTL, true)).toEqual({ yaw: 0, pitch: 0 });
    expect(headTarget(sample, 1100, false)).toEqual({ yaw: 0, pitch: 0 });
  });
});

describe('QA-R06 packet support', () => {
  it('reaches a card before lifting it and maintains the pinch until cancellation lowers it', () => {
    for (const selected of [0, 1, 2]) {
      const state = poseAfter({ ...INITIAL_RIG, pose: 'hold' }, 'select', 0, false, selected);
      expect(sampleRig(state, gestureDuration.select * .2, false).selectedLift).toBe(0);
      for (const p of [.35, .5, .8, 1]) {
        const pose = sampleRig(state, gestureDuration.select * p, false);
        const contact = handFromCard(composeCard(pose.fan, fanCard(selected, 3, pose.selectedLift)), 1, 'holdBallot');
        pose.right.position.forEach((v, i) => expect(v).toBeCloseTo(contact.position[i]!, 12));
        pose.right.rotation.forEach((v, i) => expect(v).toBeCloseTo(contact.rotation[i]!, 12));
      }
      const cancel = poseAfter({ ...state, motion: null }, 'cancel', 1000, false, selected);
      for (const p of [.2, .4, .6]) {
        const pose = sampleRig(cancel, 1000 + gestureDuration.cancel * p, false);
        const contact = handFromCard(composeCard(pose.fan, fanCard(selected, 3, pose.selectedLift)), 1, 'holdBallot');
        pose.right.position.forEach((v, i) => expect(v).toBeCloseTo(contact.position[i]!, 12));
        pose.right.rotation.forEach((v, i) => expect(v).toBeCloseTo(contact.rotation[i]!, 12));
      }
    }
  });
  it.each([1, 2, 3])('%i cards: picked card starts exactly at its visible selected position', (count) => {
    for (let selected = 0; selected < count; selected++) {
      const state = poseAfter({ ...INITIAL_RIG, pose: 'selected', selected }, 'place', 0, false, selected);
      const start = sampleRig(state, 0, false, count);
      const expected = composeCard(start.fan, fanCard(selected, count, .065));
      start.loose.position.forEach((v, i) => expect(v).toBeCloseTo(expected.position[i]!, 10));
      start.loose.rotation.forEach((v, i) => expect(v).toBeCloseTo(expected.rotation[i]!, 10));
      expect(start.right).toEqual(handFromCard(start.loose, 1, 'holdBallot'));
    }
  });
  it('remaining packet stays anchored to the left hand during placement, with no post-release jump', () => {
    const state = poseAfter({ ...INITIAL_RIG, pose: 'selected' }, 'place', 0, false);
    for (let t = 0; t <= gestureDuration.place; t += 25) {
      const pose = sampleRig(state, t, false);
      const grip = handFromCard(pose.fan, -1, fanGrip(3));
      pose.left.position.forEach((v, i) => expect(v).toBeCloseTo(grip.position[i]!, 10));
      pose.left.rotation.forEach((v, i) => expect(v).toBeCloseTo(grip.rotation[i]!, 10));
    }
  });
  it('a moving drawn packet carries its wrist after the pickup transition', () => {
    const state = poseAfter(INITIAL_RIG, 'draw', 0, false);
    for (const progress of [.65, .75, .9, 1]) {
      const pose = sampleRig(state, gestureDuration.draw * progress, false);
      const grip = handFromCard(pose.fan, -1, fanGrip(3));
      pose.left.position.forEach((v, i) => expect(v).toBeCloseTo(grip.position[i]!, 10));
      pose.left.rotation.forEach((v, i) => expect(v).toBeCloseTo(grip.rotation[i]!, 10));
    }
  });
  it('D1 tur 4: boş elde hiçbir poz yelpaze tutuşu bırakmaz', () => {
    for (const pose of ['rest', 'hold', 'selected', 'placed'] as const) {
      const settled = settledRig(pose, 0, 0);
      expect(settled.fanVisible).toBe(false);
      expect(settled.left).toEqual(restLeft); expect(settled.right).toEqual(restRight);
      expect(settled.selectedLift).toBe(0);
    }
    // Kart da hayalet de yokken bırakma hareketi boyunca da sol el dinlenmede.
    const empty = poseAfter({ ...INITIAL_RIG, pose: 'selected' }, 'place', 0, false);
    for (const p of [0, .3, .6, .95]) {
      const pose = sampleRig(empty, gestureDuration.place * p, false, 0);
      expect(pose.fanVisible).toBe(false); expect(pose.left).toEqual(restLeft);
    }
    // Kart varken davranış değişmedi.
    expect(settledRig('hold', 1, 3).fanVisible).toBe(true);
    expect(settledRig('selected', 1, 3)).toEqual(settledRig('selected', 1));
  });
  it('D1 tur 4: hayalet sırtlı devir paketi taşır, bitişte iki el de dinlenmede', () => {
    const state = poseAfter({ ...INITIAL_RIG, pose: 'rest' }, 'place', 0, false, 2, 3);
    expect(state.motion?.ghostBacks).toBe(3);
    const start = sampleRig(state, 0, false, 0);
    expect(start.fanVisible).toBe(true);
    // Taşınan kart tam olarak yelpazedeki dış kartın görünür yerinden başlar.
    const expected = composeCard(start.fan, fanCard(2, 3, .065));
    start.loose.position.forEach((v, i) => expect(v).toBeCloseTo(expected.position[i]!, 10));
    expect(start.looseKind).toBe('back');
    expect(start.left).toEqual(handFromCard(start.fan, -1, fanGrip(3)));
    for (let t = 0; t <= gestureDuration.place; t += 25) {
      const pose = sampleRig(state, t, false, 0);
      expect(pose.looseKind).toBe('back');
      for (const hand of [pose.left, pose.right]) expect(hand.position[1]).toBeGreaterThanOrEqual(.065);
    }
    const end = sampleRig(state, gestureDuration.place + 1, false, 0);
    expect(end.fanVisible).toBe(false); expect(end.left).toEqual(restLeft); expect(end.right).toEqual(restRight);
  });
  it('D1 tur 4: oy jesti kapalı kartı masaya koyar, çevirme aynı noktadan başlar', () => {
    const state = poseAfter({ ...INITIAL_RIG, pose: 'selected', selected: 1 }, 'ballot', 0, false, 1, 2);
    const start = sampleRig(state, 0, false, 0);
    const expected = composeCard(start.fan, fanCard(1, 2, .065));
    start.loose.position.forEach((v, i) => expect(v).toBeCloseTo(expected.position[i]!, 10));
    for (let t = 0; t <= gestureDuration.ballot; t += 20) {
      const pose = sampleRig(state, t, false, 0);
      expect(pose.looseKind).toBe('back'); expect(pose.looseVisible).toBe(true);
    }
    const settled = sampleRig(state, gestureDuration.ballot + 1, false, 0);
    expect(settled.loose).toEqual(ballotSpot); expect(settled.fanVisible).toBe(false);
    // Çevirme hareketi tam bu noktadan devam eder (yoktan kart belirmez).
    const flip = poseAfter({ ...state, motion: null }, 'vote', 2000, false);
    const flipStart = sampleRig(flip, 2000, false, 0);
    expect(flipStart.loose.position).toEqual(ballotSpot.position);
    expect(flipStart.loose.rotation).toEqual(ballotSpot.rotation);
  });
  it('fan bottom edges overlap at the grip instead of leaving unsupported separated cards', () => {
    // D1: ortak pivot artık baş parmak yastığı (§e). Bütün kartlar bu noktada üst üste gelir.
    const pivots = [0, 1, 2].map((i) => {
      const c = fanCard(i, 3);
      return new Vector3(FAN_PIVOT.x, 0, FAN_PIVOT.z).applyEuler(new Euler(...c.rotation)).add(new Vector3(...c.position));
    });
    // Pivot z'si bütün yuvalarda aynıdır; yalnız yuva kaydırması (slot·0.021) kalır.
    pivots.forEach((p) => expect(p.z).toBeCloseTo(pivots[1]!.z, 12));
    expect(pivots[0]!.distanceTo(pivots[2]!)).toBeLessThan(.05);
  });
});
