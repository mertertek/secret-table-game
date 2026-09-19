import { describe, expect, it } from 'vitest';

import { BOARD_LAYOUTS, ROLE_SETUPS } from '@secret-table/contracts';

import { createGame } from './setup';
import { seatList } from './test-helpers';

describe('createGame', () => {
  it.each([5, 6, 7, 8, 9, 10] as const)('%i oyuncu: rol dağılımı resmî kurala uyar', (count) => {
    const state = createGame({ players: seatList(count), seed: 1 });
    const setup = ROLE_SETUPS[count];

    const liberals = state.players.filter((p) => p.role === 'liberal').length;
    const fascists = state.players.filter((p) => p.role === 'fascist').length;
    const hitler = state.players.filter((p) => p.role === 'hitler').length;

    expect(liberals).toBe(setup.liberals);
    expect(fascists).toBe(setup.fascists);
    expect(hitler).toBe(1);
    expect(liberals + fascists + hitler).toBe(count);
  });

  it('deste 6 liberal + 11 faşist = 17 karttır', () => {
    const state = createGame({ players: seatList(7), seed: 3 });
    expect(state.deck).toHaveLength(17);
    expect(state.deck.filter((c) => c === 'liberal')).toHaveLength(6);
    expect(state.deck.filter((c) => c === 'fascist')).toHaveLength(11);
  });

  it('aynı tohum aynı rolleri ve desteyi üretir (belirlenimci)', () => {
    const a = createGame({ players: seatList(8), seed: 42 });
    const b = createGame({ players: seatList(8), seed: 42 });
    expect(a.players.map((p) => p.role)).toEqual(b.players.map((p) => p.role));
    expect(a.deck).toEqual(b.deck);
    expect(a.presidentSeat).toBe(b.presidentSeat);
  });

  it('farklı tohum farklı dağıtım verir', () => {
    const a = createGame({ players: seatList(9), seed: 1 });
    const b = createGame({ players: seatList(9), seed: 2 });
    const sameRoles = a.players.every((p, i) => p.role === b.players[i]?.role);
    const sameDeck = a.deck.every((c, i) => c === b.deck[i]);
    expect(sameRoles && sameDeck).toBe(false);
  });

  it('board varyantı oyuncu sayısına göre seçilir', () => {
    expect(createGame({ players: seatList(5), seed: 1 }).boardVariant).toBe('small');
    expect(createGame({ players: seatList(6), seed: 1 }).boardVariant).toBe('small');
    expect(createGame({ players: seatList(7), seed: 1 }).boardVariant).toBe('medium');
    expect(createGame({ players: seatList(8), seed: 1 }).boardVariant).toBe('medium');
    expect(createGame({ players: seatList(9), seed: 1 }).boardVariant).toBe('large');
    expect(createGame({ players: seatList(10), seed: 1 }).boardVariant).toBe('large');
  });

  it('layout yürütme yetkileri tek kaynaktan gelir', () => {
    const state = createGame({ players: seatList(9), seed: 1 });
    expect(state.layout).toBe(BOARD_LAYOUTS.large);
    expect(state.layout.fascistPowers).toEqual([
      'investigate_loyalty',
      'investigate_loyalty',
      'call_special_election',
      'execution',
      'execution',
      'none',
    ]);
  });

  it('overrides ile rol ve deste sabitlenebilir', () => {
    const state = createGame({
      players: seatList(5),
      seed: 1,
      overrides: {
        roles: { p1: 'hitler', p2: 'fascist', p3: 'liberal', p4: 'liberal', p5: 'liberal' },
        deck: [
          'liberal', 'liberal', 'liberal', 'liberal', 'liberal', 'liberal',
          'fascist', 'fascist', 'fascist', 'fascist', 'fascist', 'fascist',
          'fascist', 'fascist', 'fascist', 'fascist', 'fascist',
        ],
        firstPresidentSeat: 0,
      },
    });
    expect(state.players[0]?.role).toBe('hitler');
    expect(state.deck[0]).toBe('liberal');
    expect(state.presidentSeat).toBe(0);
  });

  it('geçersiz oyuncu sayısı reddedilir', () => {
    expect(() => createGame({ players: seatList(4), seed: 1 })).toThrow();
    expect(() => createGame({ players: seatList(11), seed: 1 })).toThrow();
  });

  it('rol dağıtımından önce phase role_reveal', () => {
    const state = createGame({ players: seatList(7), seed: 1 });
    expect(state.phase.kind).toBe('role_reveal');
    expect(state.revision).toBe(0);
  });
});
