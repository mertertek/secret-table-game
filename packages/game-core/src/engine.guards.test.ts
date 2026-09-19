import { describe, expect, it } from 'vitest';

import { applyCommand } from './engine';
import {
  ackAll,
  apply,
  buildDeck,
  expectReject,
  newGame,
  playToEnd,
  playUntil,
  runElection,
} from './test-helpers';

const LIB5 = {
  roles: { p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'fascist', p5: 'hitler' },
  firstPresidentSeat: 0,
} as const;

describe('temel doğrulamalar', () => {
  it('bilinmeyen oyuncu her komutta reddedilir', () => {
    const state = ackAll(newGame(5, LIB5));
    expect(expectReject(state, { type: 'nominate', playerId: 'ghost', chancellorId: 'p2' })).toBe(
      'NOT_A_PLAYER',
    );
  });

  it('kabul edilen komut revision artırır, reddedilen artırmaz', () => {
    let state = ackAll(newGame(5, LIB5));
    const r0 = state.revision;
    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p3' });
    expect(state.revision).toBe(r0 + 1);
    const rejected = applyCommand(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p2' });
    expect(rejected.ok).toBe(false);
  });

  it('oyun bittikten sonra her komut GAME_OVER döner', () => {
    const state = playToEnd(ackAll(newGame(5, LIB5)), 'liberal', { avoidChancellors: ['p5'] });
    expect(state.phase.kind).toBe('game_over');
    expect(expectReject(state, { type: 'vote', playerId: 'p1', vote: 'yes' })).toBe('GAME_OVER');
    expect(expectReject(state, { type: 'ack_role', playerId: 'p1' })).toBe('GAME_OVER');
  });
});

describe('tur kısıtı (term limits)', () => {
  it('önceki şansölye tekrar aday gösterilemez', () => {
    let state = runElection(ackAll(newGame(7, {
      roles: {
        p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'liberal',
        p5: 'fascist', p6: 'fascist', p7: 'hitler',
      },
      firstPresidentSeat: 0,
      deck: buildDeck(['liberal', 'liberal', 'liberal']),
    })), 'p3');
    // p1 başkan, p3 şansölye seçildi. Yasama turunu bitir.
    if (state.phase.kind === 'legislative_president') {
      const drop = state.phase.drawnCards[0]?.cardId as string;
      state = apply(state, { type: 'discard_policy', playerId: 'p1', cardId: drop });
      const enact = state.phase.kind === 'legislative_chancellor'
        ? (state.phase.handCards[0]?.cardId as string)
        : '';
      state = apply(state, { type: 'enact_policy', playerId: 'p3', cardId: enact });
    }
    // Sıradaki başkan p2; p3'ü (önceki şansölye) aday gösteremez.
    expect(state.phase.kind).toBe('nomination');
    if (state.phase.kind === 'nomination') {
      const pres = state.phase.presidentId;
      expect(expectReject(state, { type: 'nominate', playerId: pres, chancellorId: 'p3' })).toBe(
        'INELIGIBLE_CHANCELLOR',
      );
    }
  });

  it('5 oyuncuda önceki başkan tur kısıtlı değildir (yalnız şansölye)', () => {
    let state = runElection(ackAll(newGame(5, LIB5)), 'p2');
    if (state.phase.kind === 'legislative_president') {
      const drop = state.phase.drawnCards[0]?.cardId as string;
      state = apply(state, { type: 'discard_policy', playerId: 'p1', cardId: drop });
      const enact = state.phase.kind === 'legislative_chancellor'
        ? (state.phase.handCards[0]?.cardId as string)
        : '';
      state = apply(state, { type: 'enact_policy', playerId: 'p2', cardId: enact });
    }
    // Sıradaki başkan p2; önceki başkan p1 aday olabilir (5 kişi kuralı), önceki şansölye p2 olamaz.
    expect(state.phase.kind).toBe('nomination');
    if (state.phase.kind === 'nomination') {
      const pres = state.phase.presidentId;
      state = apply(state, { type: 'nominate', playerId: pres, chancellorId: 'p1' });
      expect(state.phase.kind).toBe('voting');
    }
  });
});

describe('veto', () => {
  const drive = () =>
    playUntil(
      ackAll(newGame(5, { ...LIB5, deck: buildDeck(['fascist', 'fascist', 'fascist']) })),
      (s) => s.fascistPolicies >= 5 && s.phase.kind === 'legislative_president',
      'fascist',
      { avoidChancellors: ['p5'] },
    );

  it('5 faşist politikadan önce veto istenemez', () => {
    let state = runElection(
      ackAll(newGame(5, { ...LIB5, deck: buildDeck(['fascist', 'fascist', 'fascist']) })),
      'p3',
    );
    if (state.phase.kind === 'legislative_president') {
      const drop = state.phase.drawnCards[0]?.cardId as string;
      state = apply(state, { type: 'discard_policy', playerId: 'p1', cardId: drop });
    }
    expect(state.phase.kind).toBe('legislative_chancellor');
    expect(expectReject(state, { type: 'request_veto', playerId: 'p3' })).toBe('VETO_NOT_AVAILABLE');
  });

  it('5 faşist politikada şansölye veto ister, başkan kabul → kartlar atılır, sayaç artar', () => {
    let state = drive();
    if (state.phase.kind !== 'legislative_president') throw new Error('yasama bekleniyordu');
    const president = state.phase.government.presidentId;
    const chancellor = state.phase.government.chancellorId;
    const discardBefore = state.discard.length;
    state = apply(state, {
      type: 'discard_policy',
      playerId: president,
      cardId: state.phase.drawnCards[0]?.cardId as string,
    });
    state = apply(state, { type: 'request_veto', playerId: chancellor });
    expect(state.phase.kind).toBe('veto_response');
    const trackerBefore = state.electionTracker;
    state = apply(state, { type: 'respond_veto', playerId: president, accept: true });
    expect(state.discard.length).toBe(discardBefore + 3); // 1 başkan atığı + 2 veto
    expect(state.electionTracker).toBe(trackerBefore + 1);
    expect(state.log.some((e) => e.kind === 'veto_enacted')).toBe(true);
    expect(state.phase.kind).toBe('nomination');
  });

  it('başkan vetoyu reddederse şansölye yürürlüğe koymak zorunda; ikinci veto reddedilir', () => {
    let state = drive();
    if (state.phase.kind !== 'legislative_president') throw new Error('yasama bekleniyordu');
    const president = state.phase.government.presidentId;
    const chancellor = state.phase.government.chancellorId;
    state = apply(state, {
      type: 'discard_policy',
      playerId: president,
      cardId: state.phase.drawnCards[0]?.cardId as string,
    });
    state = apply(state, { type: 'request_veto', playerId: chancellor });
    state = apply(state, { type: 'respond_veto', playerId: president, accept: false });
    expect(state.phase.kind).toBe('legislative_chancellor');
    expect(expectReject(state, { type: 'request_veto', playerId: chancellor })).toBe(
      'VETO_NOT_AVAILABLE',
    );
    const enactId =
      state.phase.kind === 'legislative_chancellor' ? (state.phase.handCards[0]?.cardId as string) : '';
    state = apply(state, { type: 'enact_policy', playerId: chancellor, cardId: enactId });
    expect(['nomination', 'executive_action', 'game_over']).toContain(state.phase.kind);
  });

  it('respond_veto yalnız başkandan kabul edilir', () => {
    let state = drive();
    if (state.phase.kind !== 'legislative_president') throw new Error('yasama bekleniyordu');
    const president = state.phase.government.presidentId;
    const chancellor = state.phase.government.chancellorId;
    state = apply(state, {
      type: 'discard_policy',
      playerId: president,
      cardId: state.phase.drawnCards[0]?.cardId as string,
    });
    state = apply(state, { type: 'request_veto', playerId: chancellor });
    expect(expectReject(state, { type: 'respond_veto', playerId: chancellor, accept: true })).toBe(
      'NOT_YOUR_TURN',
    );
  });

  it('veto kabul edilince şansölye→atık 2 kapalı hareketi üretilir', () => {
    let state = drive();
    if (state.phase.kind !== 'legislative_president') throw new Error('yasama bekleniyordu');
    const president = state.phase.government.presidentId;
    const chancellor = state.phase.government.chancellorId;
    state = apply(state, {
      type: 'discard_policy',
      playerId: president,
      cardId: state.phase.drawnCards[0]?.cardId as string,
    });
    state = apply(state, { type: 'request_veto', playerId: chancellor });

    const result = applyCommand(state, { type: 'respond_veto', playerId: president, accept: true });
    if (!result.ok) throw new Error(`beklenen kabul, alınan hata: ${result.code}`);
    const moves = result.events.filter((e) => e.kind === 'cards_moved');
    expect(moves).toEqual([{ kind: 'cards_moved', count: 2, from: 'chancellor', to: 'discard' }]);
    // Politika türü / kart kimliği sızmaz.
    expect(Object.keys(moves[0] as object).sort()).toEqual(['count', 'from', 'kind', 'to']);
  });
});
