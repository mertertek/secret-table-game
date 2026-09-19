import { describe, expect, it } from 'vitest';

import { applyCommand } from './engine';
import type { EngineCommand } from './commands';
import type { GameEvent } from './events';
import type { GameState } from './types';
import {
  ackAll,
  apply,
  buildDeck,
  expectReject,
  newGame,
  playRound,
  playToEnd,
  runElection,
  runLegislative,
} from './test-helpers';

const LIB5 = {
  roles: { p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'fascist', p5: 'hitler' },
  firstPresidentSeat: 0,
} as const;

describe('yasama turu', () => {
  it('başkan atar, şansölye yürürlüğe koyar; deste ve atık güncellenir', () => {
    const deck = buildDeck(['fascist', 'fascist', 'liberal']);
    let state = runElection(ackAll(newGame(5, { ...LIB5, deck })), 'p3');
    state = runLegislative(state, 'fascist', 'liberal');

    expect(state.liberalPolicies).toBe(1);
    expect(state.fascistPolicies).toBe(0);
    expect(state.deck).toHaveLength(14);
    expect(state.discard).toHaveLength(2);
    expect(state.enactedPolicies).toEqual([{ board: 'liberal', slotIndex: 0, policy: 'liberal' }]);
    expect(state.phase.kind).toBe('nomination');
    expect(state.electionTracker).toBe(0);
  });

  it('yanlış oyuncu yürürlüğe koyamaz', () => {
    const deck = buildDeck(['liberal', 'liberal', 'liberal']);
    let state = runElection(ackAll(newGame(5, { ...LIB5, deck })), 'p3');
    const cardId = state.phase.kind === 'legislative_president' ? state.phase.drawnCards[0]?.cardId : '';
    state = apply(state, { type: 'discard_policy', playerId: 'p1', cardId: cardId ?? '' });
    const handId = state.phase.kind === 'legislative_chancellor' ? state.phase.handCards[0]?.cardId : '';
    expect(expectReject(state, { type: 'enact_policy', playerId: 'p1', cardId: handId ?? '' })).toBe(
      'NOT_YOUR_TURN',
    );
  });

  it('bilinmeyen kart reddedilir', () => {
    const deck = buildDeck(['liberal', 'liberal', 'liberal']);
    const state = runElection(ackAll(newGame(5, { ...LIB5, deck })), 'p3');
    expect(expectReject(state, { type: 'discard_policy', playerId: 'p1', cardId: 'nope' })).toBe(
      'UNKNOWN_CARD',
    );
  });

  const NINE = {
    roles: {
      p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'liberal', p5: 'liberal',
      p6: 'fascist', p7: 'fascist', p8: 'fascist', p9: 'hitler',
    },
    firstPresidentSeat: 0,
  } as const;

  it('5. liberal politika → liberaller kazanır', () => {
    const state = playToEnd(
      ackAll(newGame(9, { ...NINE, deck: buildDeck(['liberal', 'liberal', 'liberal']) })),
      'liberal',
      { avoidChancellors: ['p9'] },
    );
    expect(state.winner).toBe('liberal');
    expect(state.endReason).toBe('liberal_policies_enacted');
    expect(state.liberalPolicies).toBe(5);
  });

  it('6. faşist politika → faşistler kazanır (yetkiler dahil tam akış)', () => {
    const state = playToEnd(
      ackAll(newGame(9, { ...NINE, deck: buildDeck(['fascist', 'fascist', 'fascist']) })),
      'fascist',
      { avoidChancellors: ['p9'] }, // Hitler şansölye zaferi yolunu kapat
    );
    expect(state.winner).toBe('fascist');
    expect(state.endReason).toBe('fascist_policies_enacted');
    expect(state.fascistPolicies).toBe(6);
  });
});

describe('Hitler şansölye zaferi', () => {
  it('3+ faşist politika varken Hitler şansölye seçilirse faşistler kazanır', () => {
    let state = ackAll(newGame(7, {
      roles: {
        p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'liberal',
        p5: 'fascist', p6: 'fascist', p7: 'hitler',
      },
      firstPresidentSeat: 0,
      deck: buildDeck(['fascist', 'fascist', 'fascist']),
    }));

    // 3 faşist politikaya kadar getir; Hitler'i şansölye yapma. Yetki aşamalarını da bitir.
    let guard = 0;
    while (
      !(state.fascistPolicies >= 3 && state.phase.kind === 'nomination') &&
      state.phase.kind !== 'game_over' &&
      guard < 40
    ) {
      guard += 1;
      state = playRound(state, 'fascist', { avoidChancellors: ['p7'] });
    }

    expect(state.fascistPolicies).toBe(3);
    expect(state.phase.kind).toBe('nomination');

    // Şimdi Hitler'i (p7) şansölye seç.
    state = runElection(state, 'p7');
    expect(state.phase.kind).toBe('game_over');
    expect(state.winner).toBe('fascist');
    expect(state.endReason).toBe('hitler_elected_chancellor');
  });

  it('3 faşist politikadan önce Hitler şansölye olursa oyun sürer', () => {
    let state = ackAll(newGame(5, LIB5));
    state = runElection(state, 'p5'); // p5 = hitler, 0 faşist politika
    expect(state.phase.kind).toBe('legislative_president');
    expect(state.winner).toBeNull();
  });
});

describe('cards_moved olayları (kapalı kamu hareketi)', () => {
  function step(state: GameState, command: EngineCommand): { state: GameState; events: GameEvent[] } {
    const result = applyCommand(state, command);
    if (!result.ok) throw new Error(`beklenen kabul, alınan hata: ${result.code}`);
    return { state: result.state, events: result.events };
  }

  const moves = (events: readonly GameEvent[]) =>
    events.filter((e): e is Extract<GameEvent, { kind: 'cards_moved' }> => e.kind === 'cards_moved');

  /** Olay yalnız adet + uçları taşır: politika türü, kart kimliği, sıra yok. */
  const expectOpaque = (event: GameEvent) =>
    expect(Object.keys(event).sort()).toEqual(['count', 'from', 'kind', 'to']);

  const electedState = () => {
    let state = ackAll(newGame(5, { ...LIB5, deck: buildDeck(['fascist', 'fascist', 'liberal']) }));
    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p3' });
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      state = apply(state, { type: 'vote', playerId: id, vote: 'yes' });
    }
    return step(state, { type: 'vote', playerId: 'p5', vote: 'yes' });
  };

  it('hükümet kurulunca deste→başkan 3 kart, gizli alan taşımadan', () => {
    const elected = electedState();
    expect(moves(elected.events)).toEqual([{ kind: 'cards_moved', count: 3, from: 'deck', to: 'president' }]);
    moves(elected.events).forEach(expectOpaque);
    // Kapalı kamu hareketi, özel dağıtımdan önce gelir.
    const kinds = elected.events.map((e) => e.kind);
    expect(kinds.indexOf('cards_moved')).toBeLessThan(kinds.indexOf('cards_dealt'));
    expect(elected.state.phase.kind).toBe('legislative_president');
  });

  it('başkan attığında başkan→atık 1 ve başkan→şansölye 2', () => {
    const elected = electedState();
    if (elected.state.phase.kind !== 'legislative_president') throw new Error('yasama bekleniyordu');
    const cardId = elected.state.phase.drawnCards[0]?.cardId as string;
    const discarded = step(elected.state, { type: 'discard_policy', playerId: 'p1', cardId });

    expect(moves(discarded.events)).toEqual([
      { kind: 'cards_moved', count: 1, from: 'president', to: 'discard' },
      { kind: 'cards_moved', count: 2, from: 'president', to: 'chancellor' },
    ]);
    moves(discarded.events).forEach(expectOpaque);
    const kinds = discarded.events.map((e) => e.kind);
    expect(kinds.lastIndexOf('cards_moved')).toBeLessThan(kinds.indexOf('cards_dealt'));
  });

  it('şansölye yürürlüğe koyunca şansölye→atık 1, politika olayından önce', () => {
    const elected = electedState();
    if (elected.state.phase.kind !== 'legislative_president') throw new Error('yasama bekleniyordu');
    const discarded = step(elected.state, {
      type: 'discard_policy',
      playerId: 'p1',
      cardId: elected.state.phase.drawnCards[0]?.cardId as string,
    });
    if (discarded.state.phase.kind !== 'legislative_chancellor') throw new Error('şansölye bekleniyordu');
    const enacted = step(discarded.state, {
      type: 'enact_policy',
      playerId: 'p3',
      cardId: discarded.state.phase.handCards[0]?.cardId as string,
    });

    expect(moves(enacted.events)).toEqual([
      { kind: 'cards_moved', count: 1, from: 'chancellor', to: 'discard' },
    ]);
    moves(enacted.events).forEach(expectOpaque);
    const kinds = enacted.events.map((e) => e.kind);
    expect(kinds.indexOf('cards_moved')).toBeLessThan(kinds.indexOf('policy_enacted'));
    // Yerleşen politika `policy_enacted`'te; hareket olayı türü tekrar etmez.
    expect(enacted.state.phase.kind).toBe('nomination');
  });

  it('deste yeniden karıştırılınca ek olay üretilmez; adet 17 sınırında kalır', () => {
    let state = ackAll(newGame(5, { ...LIB5, deck: buildDeck(['liberal', 'liberal', 'fascist']) }));
    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p3' });
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      state = apply(state, { type: 'vote', playerId: id, vote: 'yes' });
    }
    // Çekiş anında deste yetersiz → ensureDeck karıştırır, ama olay üretmez.
    const short: GameState = { ...state, deck: ['liberal'], discard: ['fascist', 'fascist', 'liberal'] };
    const elected = step(short, { type: 'vote', playerId: 'p5', vote: 'yes' });

    expect(elected.state.reshuffles).toBe(1);
    expect(moves(elected.events)).toEqual([
      { kind: 'cards_moved', count: 3, from: 'deck', to: 'president' },
    ]);
    for (const move of moves(elected.events)) {
      expect(move.count).toBeGreaterThan(0);
      expect(move.count).toBeLessThanOrEqual(17);
    }
  });
});
