import { describe, expect, it } from 'vitest';
import type { SceneView } from '@secret-table/contracts';
import { getSceneFixture } from '../../../fixtures/src/index';
import { FanLayout } from '../prototype/FanLayout';
import { fanCard } from '../prototype/grip';
import { LocalMotion } from './LocalMotion';
import { relativeLook, sceneSlots, validSelection } from './inputs';
import { ViewpointAdapter } from './ViewpointAdapter';
import { centeredLook, gestureDuration } from '../prototype/model';
import { ballotSpot, restLeft, restRight, sampleRig, settledRig } from '../prototype/rig';
const view = getSceneFixture('president-discard')!.view;

describe('production input boundary', () => {
  it('returns exact opaque options in the rendered left-to-right card order, regardless of option order', () => {
    const reversed = { ...view, actions: view.actions.map((a) => ({ ...a, options: [...a.options].reverse() })) };
    const slots = sceneSlots(reversed);
    view.privateView.hand.forEach((card, index) => {
      const a = reversed.actions.find((a) => a.options.some((o) => o.cardId === card.cardId))!;
      expect(slots[index]).toEqual({ actionId: a.actionId, optionId: a.options.find((o) => o.cardId === card.cardId)!.optionId });
    });
  });
  it('does not shift slot numbers when a card is unauthorized; rejects old selection and interrupted input', () => {
    const slots = sceneSlots(view); const missing = { ...view, actions: view.actions.map((a) => ({ ...a, options: a.options.filter((o) => o.cardId !== view.privateView.hand[0]!.cardId) })) };
    expect(sceneSlots(missing)).toEqual([null, slots[1], slots[2]]);
    expect(validSelection({ ...view, phaseId: 'new-phase' }, slots[1]!)).toBeNull();
    expect(sceneSlots({ ...view, connection: 'disconnected' })).toEqual([null, null, null]);
    expect(sceneSlots({ ...view, privateView: { ...view.privateView, hand: [] } })).toEqual([]);
  });
  it('relative movement applies sensitivity with correct pitch direction, clamps and ignores malformed deltas', () => {
    expect(relativeLook(centeredLook, 10, 20, 2).yaw).toBeCloseTo(-.048, 10);
    expect(relativeLook(centeredLook, 10, 20, 2).pitch).toBeCloseTo(centeredLook.pitch - .096, 10);
    expect(relativeLook(centeredLook, NaN, 0)).toBe(centeredLook);
    expect(relativeLook(centeredLook, 1e6, 1e6)).toEqual(relativeLook(centeredLook, 1e9, 1e9));
  });
});
describe('card removal without hand jumps', () => {
  it('survivors start at their last drawn selected transform instead of an old resting fan', () => {
    const fan = new FanLayout(); fan.update(['a', 'b', 'c'], 0, false);
    const selected = fanCard(2, 3, .065); fan.remember('c', selected);
    const start = fan.update(['a', 'c'], 100, false, [0, .065]).transforms.get('c')!;
    start.position.forEach((v, i) => expect(v).toBeCloseTo(selected.position[i]!, 12));
    start.rotation.forEach((v, i) => expect(v).toBeCloseTo(selected.rotation[i]!, 12));
  });
  it('3 → 2 → 1 preserves each survivor at the transition start and settles at the common grip', () => {
    const fan = new FanLayout(); const initial = new Map(fan.update(['a', 'b', 'c'], 0, false).transforms);
    const two = new Map(fan.update(['a', 'c'], 500, false).transforms);
    expect(two.get('a')).toEqual(initial.get('a')); expect(two.get('c')).toEqual(initial.get('c')); expect(two.has('b')).toBe(false);
    const mid = new Map(fan.update(['a', 'c'], 620, false).transforms);
    const one = fan.update(['c'], 620, false).transforms;
    expect(one.get('c')).toEqual(mid.get('c')); expect(one.size).toBe(1);
    expect(fan.update(['c'], 900, false).transforms.get('c')).toEqual(fanCard(0, 1));
  });
  it('reduced motion goes directly to layout; removal never retains a private card', () => {
    const fan = new FanLayout(); fan.update(['a', 'b', 'c'], 0, false);
    expect(fan.update(['b'], 1, true).transforms.get('b')).toEqual(fanCard(0, 1));
    expect(fan.update([], 2, false).transforms.size).toBe(0);
  });
});
describe('accepted local choreography lifetime', () => {
  it('selecting during draw starts the new hand path at the rendered pose', () => {
    const m = new LocalMotion(); const draw = m.update(view, null, false, 0, false, 0, false);
    const before = sampleRig(draw, 700, false, 3);
    const selected = m.update(view, sceneSlots(view)[2]!, false, 0, false, 700, false);
    const start = sampleRig(selected, 700, false, 3);
    expect(start.left).toEqual(before.left); expect(start.right).toEqual(before.right); expect(start.fan).toEqual(before.fan);
  });
  const roleView = { ...view, privateView: { ...view.privateView, hand: [], role: 'liberal' as const }, actions: [] };
  it('1650ms envelope survives a 950ms delivery drain and finishes locally without any completion intent', () => {
    const m = new LocalMotion(); m.update(roleView, null, false, 0, false, 0, false);
    expect(m.update(roleView, null, true, 0, false, 100, false).motion?.kind).toBe('envelope');
    expect(m.update(roleView, null, true, 0, false, 1050, false).motion?.startedAt).toBe(100);
    expect(m.update(roleView, null, true, 0, false, 1749, false).motion).not.toBeNull();
    expect(m.update(roleView, null, true, 0, false, 1750, false).motion).toBeNull();
  });
  it.each(['epoch', 'suspend', 'private', 'connection', 'phase'] as const)('%s immediately clears a running envelope without replay on recovery', (cause) => {
    const m = new LocalMotion(); m.update(roleView, null, false, 0, false, 0, false); m.update(roleView, null, true, 0, false, 100, false);
    const changed = cause === 'private' ? { ...roleView, privateView: { ...roleView.privateView, role: null } } : cause === 'connection' ? { ...roleView, connection: 'disconnected' as const } : cause === 'phase' ? { ...roleView, phaseId: 'another' } : roleView;
    const result = m.update(changed, null, true, cause === 'epoch' ? 1 : 0, cause === 'suspend', 300, false);
    expect(result.motion).toBeNull(); expect(result.pose).not.toBe('envelope');
    expect(m.update(roleView, null, true, cause === 'epoch' ? 1 : 0, false, 500, false).motion).toBeNull();
  });
  it('normal updates do not restart draw, new groups replace old generations, reduced snaps', () => {
    const m = new LocalMotion(); const start = m.update(view, null, false, 0, false, 0, false);
    expect(start.motion?.duration).toBe(gestureDuration.draw);
    expect(m.update(view, null, false, 0, false, 950, false).revision).toBe(start.revision);
    const next = m.update({ ...view, revision: view.revision + 1, privateView: { ...view.privateView, hand: view.privateView.hand.slice(1) } }, null, false, 0, false, 1000, false);
    expect(next.motion).toBeNull(); expect(next.pose).toBe('hold'); expect(next.revision).toBeGreaterThan(start.revision);
    expect(new LocalMotion().update(view, null, false, 0, false, 0, true).motion).toBeNull();
  });
});
describe('D1 tur 4 — el boşalırken kart devri ve oy', () => {
  const emptied = getSceneFixture('president-discarded')!.view;
  const voting = getSceneFixture('voting')!.view;
  const voted = getSceneFixture('voting-submitted')!.view;
  const opened = getSceneFixture('election-result')!.view;
  it('aynı sürümde gelen kamu hareketi eldeki kart adedini kapalı sırt olarak oynatır', () => {
    const m = new LocalMotion();
    m.update(view, null, false, 0, false, 0, false);
    const empty = m.update(emptied, null, false, 0, false, 2000, false);
    expect(empty.pose).toBe('rest'); expect(empty.motion).toBeNull();
    const state = m.acceptPublic('cue_moved_21_discard', 'place', 2000, false);
    expect(state.motion?.ghostBacks).toBe(3); expect(state.selected).toBe(2);
    // Hareket boyunca kapalı paket görünür; sonunda hiçbir el yelpaze tutmaz.
    const mid = sampleRig(state, 2000 + gestureDuration.place * .4, false, 0);
    expect(mid.fanVisible).toBe(true); expect(mid.looseKind).toBe('back');
    const done = sampleRig(state, 2000 + gestureDuration.place + 1, false, 0);
    expect(done.fanVisible).toBe(false); expect(done.left).toEqual(restLeft); expect(done.right).toEqual(restRight);
  });
  it('cue gelmeyen boşalma (resync/epoch) hayalet kart üretmez', () => {
    const m = new LocalMotion();
    m.update(view, null, false, 0, false, 0, false);
    expect(m.update(emptied, null, false, 0, false, 2000, false).pose).toBe('rest');
    const later = m.update({ ...emptied, revision: emptied.revision + 1 }, null, false, 0, false, 2100, false);
    expect(m.acceptPublic('cue_late', 'place', 2100, false)).toEqual(later);
    expect(later.motion).toBeNull();
    const epoch = new LocalMotion();
    epoch.update(view, null, false, 0, false, 0, false);
    const dropped = epoch.update({ ...view, privateView: { ...view.privateView, hand: [] }, actions: [] }, null, false, 1, false, 500, false);
    expect(dropped.motion).toBeNull(); expect(dropped.pose).toBe('rest');
  });
  it('oy onayı kapalı kartı masaya koyar ve orada bırakır', () => {
    const m = new LocalMotion();
    m.update(voting, null, false, 0, false, 0, false);
    const state = m.update(voted, null, false, 0, false, 3000, false);
    expect(state.motion?.kind).toBe('ballot'); expect(state.motion?.ghostBacks).toBe(2); expect(state.pose).toBe('voted');
    const settled = sampleRig(state, 3000 + gestureDuration.ballot + 1, false, 0);
    expect(settled.looseVisible).toBe(true); expect(settled.looseKind).toBe('back');
    expect(settled.loose).toEqual(ballotSpot); expect(settled.fanVisible).toBe(false);
    expect(settled.left).toEqual(restLeft); expect(settled.right).toEqual(restRight);
    // Yeniden gönderim yok: aynı durumun tekrarı hareketi yeniden başlatmaz.
    expect(m.update(voted, null, false, 0, false, 5000, false).motion).toBeNull();
  });
  it('oy açıklanınca çevirme hareketi masadaki karttan kesintisiz devam eder', () => {
    const m = new LocalMotion();
    m.update(voting, null, false, 0, false, 0, false);
    m.update(voted, null, false, 0, false, 3000, false);
    const kept = m.update(opened, null, false, 0, false, 5000, false);
    expect(kept.pose).toBe('voted'); // faz değişti ama kart masada kaldı
    const flip = m.acceptPublic('cue_votes_3', 'vote', 5000, false);
    expect(flip.motion?.kind).toBe('vote');
    const start = sampleRig(flip, 5000, false, 0);
    expect(start.loose.position).toEqual(ballotSpot.position);
    expect(start.loose.rotation).toEqual(ballotSpot.rotation);
    expect(start.left).toEqual(restLeft); expect(start.right).toEqual(restRight);
    expect(sampleRig(flip, 5000 + gestureDuration.vote + 1, false, 0)).toEqual(settledRig('vote', flip.selected, 0));
  });
  it('oy vermemiş yerel oyuncuda oy kartları elde kalır', () => {
    const m = new LocalMotion();
    const held = m.update(voting, null, false, 0, false, 0, false);
    expect(held.pose).toBe('hold');
    expect(sampleRig(held, 10000, false, 2).fanVisible).toBe(true);
  });
});
describe('authenticated-head presentation defence', () => {
  it('checks room, seat, time and membership; clamps angles without refreshing repeated receipt time', () => {
    const m = new ViewpointAdapter(); const sample = { roomId: view.roomId, playerId: 'p2', seatIndex: 1, yaw: 2, pitch: .1, t: 1000 };
    const first = m.update(view, [sample, { ...sample, playerId: view.localPlayerId }, { ...sample, playerId: 'foreign' }, { ...sample, roomId: 'foreign' }, { ...sample, seatIndex: 8 }], 1000, 500, true);
    expect(first).toHaveLength(1); expect(first[0]?.yaw).toBe(.65);
    expect(m.update(view, [sample], 1100, 600, true)[0]?.receivedAt).toBe(500);
    expect(m.update(view, [{ ...sample, t: 999 }], 1100, 600, true)).toEqual(first);
    expect(m.update(view, [{ ...sample, yaw: NaN }], 1110, 610, true)).toEqual([]);
    expect(m.update(view, [sample], 1120, 620, true)).toEqual([]);
  });
  it('neutralizes omitted, stale or interrupted samples and waits for a fresh sample after recovery', () => {
    const m = new ViewpointAdapter(); const sample = { roomId: view.roomId, playerId: 'p2', seatIndex: 1, yaw: .4, pitch: .1, t: 1000 };
    m.update(view, [sample], 1000, 500, true);
    expect(m.update(view, [sample], 1010, 510, false)).toEqual([]);
    expect(m.update(view, [sample], 1020, 520, true)).toEqual([]);
    expect(m.update(view, [{ ...sample, t: 1030 }], 1030, 530, true)).toHaveLength(1);
    expect(m.update(view, [], 1040, 540, true)).toEqual([]);
    expect(m.update(view, [{ ...sample, t: 1030 }], 1040, 540, true)).toEqual([]);
    expect(m.update(view, [{ ...sample, t: 1050 }], 6000, 5500, true)).toEqual([]);
  });
});

describe('D27 — canlı oyunda infaz koreografisi', () => {
  const choose = getSceneFixture('execution-choose')!.view;
  const shotBase = getSceneFixture('execution-shot-local')!.view;
  // Canlı sunucu: cue'nun geldiği sürümde faz ve başkanlık çoktan ilerlemiştir.
  const afterShot = { ...shotBase, revision: choose.revision + 1, phaseId: 'next-nomination',
    players: shotBase.players.map((p) => ({ ...p, office: p.playerId === 'p2' ? 'president' as const : null })) } as SceneView;
  it('silah az önce eldeyse atış HAZIR pozdan başlar ve sonraki sürümde kesilmez', () => {
    const m = new LocalMotion();
    expect(m.update(choose, null, false, 0, false, 0, false).pose).toBe('ready');
    m.update(afterShot, null, false, 0, false, 1000, false);
    const shot = m.acceptExecution('cue_shot_live', .4, 1000);
    expect(shot.motion?.kind).toBe('shoot'); expect(shot.motion?.from).toBe('ready');
    // 500 ms sonra sıradaki başkan aday gösterdi: yeni sürüm + yeni faz.
    const later = m.update({ ...afterShot, revision: afterShot.revision + 1, phaseId: 'voting-1' }, null, false, 0, false, 1500, false);
    expect(later.motion?.kind).toBe('shoot'); expect(later.motion?.startedAt).toBe(1000); expect(later.pose).toBe('aim');
    // Süre dolunca el dinlenmeye döner.
    const done = m.update({ ...afterShot, revision: afterShot.revision + 1, phaseId: 'voting-1' }, null, false, 0, false, 1000 + gestureDuration.shoot + 1, false);
    expect(done.motion).toBeNull(); expect(done.pose).toBe('rest');
  });
  it.each(['suspend', 'epoch', 'connection'] as const)('%s atışı yine anında keser', (cause) => {
    const m = new LocalMotion();
    m.update(choose, null, false, 0, false, 0, false); m.update(afterShot, null, false, 0, false, 1000, false);
    m.acceptExecution('cue_shot_live', .4, 1000);
    const changed = cause === 'connection' ? { ...afterShot, connection: 'disconnected' as const } : afterShot;
    const result = m.update({ ...changed, revision: afterShot.revision + 1 }, null, false, cause === 'epoch' ? 1 : 0, cause === 'suspend', 1300, false);
    expect(result.motion).toBeNull();
  });
});

