import { describe, expect, it } from 'vitest';

import { applyCommand } from './engine';
import {
  ackAll,
  apply,
  buildDeck,
  currentPresidentId,
  expectReject,
  newGame,
  pickChancellor,
  runElection,
} from './test-helpers';

const LIB5 = {
  roles: { p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'fascist', p5: 'hitler' },
  firstPresidentSeat: 0,
} as const;

describe('rol tanışması', () => {
  it('herkes onaylayınca adaylığa geçer', () => {
    let state = newGame(7);
    expect(state.phase.kind).toBe('role_reveal');
    state = ackAll(state);
    expect(state.phase.kind).toBe('nomination');
    if (state.phase.kind === 'nomination') {
      expect(state.phase.presidentId).toBe(state.players[state.presidentSeat]?.playerId);
    }
  });

  it('iki kez onay reddedilir', () => {
    let state = newGame(5);
    state = apply(state, { type: 'ack_role', playerId: 'p1' });
    expect(expectReject(state, { type: 'ack_role', playerId: 'p1' })).toBe('ALREADY_ACKED');
  });

  it('onaylar bitmeden aday gösterilemez', () => {
    let state = newGame(5);
    state = apply(state, { type: 'ack_role', playerId: 'p1' });
    expect(expectReject(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p2' })).toBe(
      'WRONG_PHASE',
    );
  });
});

describe('adaylık kısıtları', () => {
  it('yalnız başkan aday gösterebilir', () => {
    const state = ackAll(newGame(5, LIB5));
    const president = currentPresidentId(state);
    const other = state.players.find((p) => p.playerId !== president)?.playerId as string;
    expect(expectReject(state, { type: 'nominate', playerId: other, chancellorId: 'p3' })).toBe(
      'NOT_YOUR_TURN',
    );
  });

  it('başkan kendini aday gösteremez', () => {
    const state = ackAll(newGame(5, LIB5));
    expect(expectReject(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p1' })).toBe(
      'INVALID_TARGET',
    );
  });

  it('bilinmeyen oyuncu reddedilir', () => {
    const state = ackAll(newGame(5, LIB5));
    expect(expectReject(state, { type: 'nominate', playerId: 'p1', chancellorId: 'pX' })).toBe(
      'INVALID_TARGET',
    );
  });

  it('geçerli aday → oylama aşaması', () => {
    let state = ackAll(newGame(5, LIB5));
    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p3' });
    expect(state.phase.kind).toBe('voting');
  });
});

describe('oylama sonucu', () => {
  it('çoğunluk EVET → hükümet kurulur, başkan 3 kart çeker', () => {
    const state = runElection(ackAll(newGame(5, LIB5)), 'p3');
    expect(state.phase.kind).toBe('legislative_president');
    if (state.phase.kind === 'legislative_president') {
      expect(state.phase.drawnCards).toHaveLength(3);
      expect(state.phase.government).toEqual({ presidentId: 'p1', chancellorId: 'p3' });
    }
    expect(state.deck).toHaveLength(14);
    expect(state.lastGovernment).toEqual({ presidentId: 'p1', chancellorId: 'p3' });
  });

  it('5 kişide 3-2 EVET geçer, 2-3 EVET düşer', () => {
    const pass = runElection(ackAll(newGame(5, LIB5)), 'p3', {
      p1: 'yes', p2: 'yes', p3: 'yes', p4: 'no', p5: 'no',
    });
    expect(pass.lastElection?.outcome).toBe('elected');

    const fail = runElection(ackAll(newGame(5, LIB5)), 'p3', {
      p1: 'yes', p2: 'yes', p3: 'no', p4: 'no', p5: 'no',
    });
    expect(fail.lastElection?.outcome).toBe('rejected');
    expect(fail.electionTracker).toBe(1);
  });

  it('6 kişide 3-3 beraberlik düşer', () => {
    const state = runElection(ackAll(newGame(6, {
      roles: { p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'liberal', p5: 'fascist', p6: 'hitler' },
      firstPresidentSeat: 0,
    })), 'p3', { p1: 'yes', p2: 'yes', p3: 'yes', p4: 'no', p5: 'no', p6: 'no' });
    expect(state.lastElection?.outcome).toBe('rejected');
  });

  it('düşen seçimde başkanlık sonraki koltuğa geçer', () => {
    let state = ackAll(newGame(5, LIB5));
    expect(currentPresidentId(state)).toBe('p1');
    state = runElection(state, 'p3', { p1: 'no', p2: 'no', p3: 'no', p4: 'no', p5: 'no' });
    expect(state.phase.kind).toBe('nomination');
    expect(currentPresidentId(state)).toBe('p2');
  });

  it('iki kez oy reddedilir (aynı komut tekrarı motorda da yakalanır)', () => {
    let state = ackAll(newGame(5, LIB5));
    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p3' });
    state = apply(state, { type: 'vote', playerId: 'p2', vote: 'yes' });
    expect(expectReject(state, { type: 'vote', playerId: 'p2', vote: 'yes' })).toBe('ALREADY_VOTED');
    expect(expectReject(state, { type: 'vote', playerId: 'p2', vote: 'no' })).toBe('ALREADY_VOTED');
  });

  it('eşzamanlı oylar teker teker uygulanır, hepsi gelince çözülür', () => {
    let state = ackAll(newGame(5, LIB5));
    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p3' });
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      state = apply(state, { type: 'vote', playerId: id, vote: 'yes' });
      expect(state.phase.kind).toBe('voting');
    }
    state = apply(state, { type: 'vote', playerId: 'p5', vote: 'yes' });
    expect(state.phase.kind).toBe('legislative_president');
  });

  it('3 kez üst üste düşen seçim → kaos: üstteki politika yürürlüğe girer, sayaç sıfırlanır', () => {
    const deck = buildDeck(['liberal']); // üst kart liberal
    let state = ackAll(newGame(5, { ...LIB5, deck }));
    const noAll = { p1: 'no', p2: 'no', p3: 'no', p4: 'no', p5: 'no' } as const;

    state = runElection(state, pickChancellor(state), noAll);
    expect(state.electionTracker).toBe(1);
    state = runElection(state, pickChancellor(state), noAll);
    expect(state.electionTracker).toBe(2);
    state = runElection(state, pickChancellor(state), noAll);

    expect(state.electionTracker).toBe(0);
    expect(state.liberalPolicies).toBe(1);
    expect(state.lastGovernment).toBeNull();
    expect(state.phase.kind).toBe('nomination');
    expect(state.log.some((e) => e.kind === 'chaos_policy')).toBe(true);
  });

  it('oylama dışı oy reddedilir', () => {
    const state = ackAll(newGame(5, LIB5));
    expect(expectReject(state, { type: 'vote', playerId: 'p1', vote: 'yes' })).toBe('WRONG_PHASE');
  });

  it('geçersiz komut durumu değiştirmez', () => {
    const state = ackAll(newGame(5, LIB5));
    const before = structuredClone(state);
    applyCommand(state, { type: 'vote', playerId: 'p1', vote: 'yes' });
    expect(state).toEqual(before);
  });
});
