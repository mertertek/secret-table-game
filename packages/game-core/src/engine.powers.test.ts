import { describe, expect, it } from 'vitest';

import { investigatableTargetIds } from './selectors';
import type { GameState } from './types';
import {
  ackAll,
  apply,
  buildDeck,
  currentPresidentId,
  expectReject,
  newGame,
  pickChancellor,
  playUntil,
  runElection,
} from './test-helpers';

/** 7 kişi (medium): faşist yuva güçleri [none, investigate, special_election, execution, execution]. */
const SEVEN = {
  roles: {
    p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'liberal',
    p5: 'fascist', p6: 'fascist', p7: 'hitler',
  },
  firstPresidentSeat: 0,
  deck: buildDeck(['fascist', 'fascist', 'fascist']),
} as const;

/** 5 kişi (small): faşist yuva güçleri [none, none, policy_peek, execution, execution]. */
const FIVE = {
  roles: { p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'fascist', p5: 'hitler' },
  firstPresidentSeat: 0,
  deck: buildDeck(['fascist', 'fascist', 'fascist']),
} as const;

const atPower = (s: GameState): boolean => s.phase.kind === 'executive_action';

describe('sadakat incelemesi (investigate_loyalty)', () => {
  it('başkan hedefin parti üyeliğini özel görür; kayıt tutulur', () => {
    const state = playUntil(ackAll(newGame(7, SEVEN)), atPower, 'fascist', {
      avoidChancellors: ['p7'],
    });
    expect(state.phase.kind).toBe('executive_action');
    if (state.phase.kind !== 'executive_action') return;
    expect(state.phase.power).toBe('investigate_loyalty');

    const president = state.phase.government.presidentId;
    const target = state.players.find((p) => p.alive && p.playerId !== president)?.playerId as string;
    const after = apply(state, { type: 'use_power', playerId: president, targetId: target });

    expect(after.phase.kind).toBe('executive_action');
    if (after.phase.kind !== 'executive_action') return;
    expect(after.phase.inspection).toEqual({
      kind: 'party_membership',
      targetId: target,
      party: after.players.find((p) => p.playerId === target)?.role === 'liberal' ? 'liberal' : 'fascist',
    });
    expect(after.investigations).toContainEqual(
      expect.objectContaining({ actorId: president, targetId: target }),
    );

    const done = apply(after, { type: 'ack_private_result', playerId: president });
    expect(done.phase.kind).toBe('nomination');
  });

  it('Hitler incelemede faşist görünür', () => {
    let state = playUntil(ackAll(newGame(7, SEVEN)), atPower, 'fascist', {
      avoidChancellors: ['p7'],
    });
    if (state.phase.kind !== 'executive_action') throw new Error('yetki bekleniyordu');
    const president = state.phase.government.presidentId;
    state = apply(state, { type: 'use_power', playerId: president, targetId: 'p7' });
    if (state.phase.kind !== 'executive_action') throw new Error('yetki sonucu bekleniyordu');
    expect(state.phase.inspection).toEqual({
      kind: 'party_membership',
      targetId: 'p7',
      party: 'fascist',
    });
  });

  it('aynı hedef iki kez incelenemez', () => {
    let state = playUntil(ackAll(newGame(7, SEVEN)), atPower, 'fascist', {
      avoidChancellors: ['p7'],
    });
    if (state.phase.kind !== 'executive_action') throw new Error('yetki bekleniyordu');
    const president = state.phase.government.presidentId;
    const target = state.players.find((p) => p.alive && p.playerId !== president)?.playerId as string;
    state = apply(state, { type: 'use_power', playerId: president, targetId: target });
    state = apply(state, { type: 'ack_private_result', playerId: president });

    // Sonraki investigate yetkisine kadar ilerle (9 kişi büyük düzende iki investigate olurdu;
    // 7 kişide bir sonraki güç special_election. Bunun yerine aynı başkanı tekrar getirmek yerine
    // özel seçim gücünde farklı doğrulama var; burada yalnız kayıt korunuyor mu bakılır).
    expect(state.investigations.some((i) => i.actorId === president && i.targetId === target)).toBe(true);
  });

  it('9 kişide ikinci investigate aynı hedefi HER BAŞKAN için reddeder (D18/B1)', () => {
    const NINE = {
      roles: {
        p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'liberal', p5: 'liberal',
        p6: 'fascist', p7: 'fascist', p8: 'fascist', p9: 'hitler',
      },
      firstPresidentSeat: 0,
      deck: buildDeck(['fascist', 'fascist', 'fascist']),
    } as const;
    let state = playUntil(ackAll(newGame(9, NINE)), atPower, 'fascist', { avoidChancellors: ['p9'] });
    if (state.phase.kind !== 'executive_action') throw new Error('yetki bekleniyordu');
    let president = state.phase.government.presidentId;
    const target = state.players.find((p) => p.alive && p.playerId !== president)?.playerId as string;
    state = apply(state, { type: 'use_power', playerId: president, targetId: target });
    state = apply(state, { type: 'ack_private_result', playerId: president });

    state = playUntil(state, atPower, 'fascist', { avoidChancellors: ['p9'] });
    if (state.phase.kind !== 'executive_action' || state.phase.power !== 'investigate_loyalty') {
      throw new Error('ikinci investigate bekleniyordu');
    }
    president = state.phase.government.presidentId;
    // D18/B1 — resmî kural teklik başkandan BAĞIMSIZ: ikinci başkan farklı
    // olsa da aynı hedef reddedilir (eski test bu dalı koşullu atlıyordu).
    expect(expectReject(state, { type: 'use_power', playerId: president, targetId: target })).toBe(
      'INVALID_TARGET',
    );
    expect(investigatableTargetIds(state, president)).not.toContain(target);
  });
});

describe('deste bakma (policy_peek)', () => {
  it('başkan destenin üst 3 kartını özel görür; hedef alamaz', () => {
    const state = playUntil(ackAll(newGame(5, FIVE)), atPower, 'fascist', {
      avoidChancellors: ['p5'],
    });
    expect(state.phase.kind).toBe('executive_action');
    if (state.phase.kind !== 'executive_action') return;
    expect(state.phase.power).toBe('policy_peek');
    const president = state.phase.government.presidentId;

    expect(
      expectReject(state, { type: 'use_power', playerId: president, targetId: 'p2' }),
    ).toBe('POWER_HAS_NO_TARGET');

    const after = apply(state, { type: 'use_power', playerId: president });
    if (after.phase.kind !== 'executive_action') throw new Error('sonuç bekleniyordu');
    expect(after.phase.inspection?.kind).toBe('policy_peek');
    if (after.phase.inspection?.kind === 'policy_peek') {
      expect(after.phase.inspection.cards).toEqual(after.deck.slice(0, 3));
    }
    const done = apply(after, { type: 'ack_private_result', playerId: president });
    expect(done.phase.kind).toBe('nomination');
  });
});

describe('infaz (execution)', () => {
  it('başkan bir oyuncuyu eler; elenen oyuncu aday olamaz', () => {
    let state = playUntil(
      ackAll(newGame(5, FIVE)),
      (s) => s.phase.kind === 'executive_action' && s.phase.power === 'execution',
      'fascist',
      { avoidChancellors: ['p5'] },
    );
    if (state.phase.kind !== 'executive_action') throw new Error('infaz gücü bekleniyordu');
    const president = state.phase.government.presidentId;
    const victim = state.players.find(
      (p) => p.alive && p.playerId !== president && p.role !== 'hitler',
    )?.playerId as string;

    state = apply(state, { type: 'use_power', playerId: president, targetId: victim });
    expect(state.players.find((p) => p.playerId === victim)?.alive).toBe(false);
    expect(state.phase.kind).toBe('nomination');

    // Elenen oyuncu aday gösterilemez.
    const pres2 = currentPresidentId(state);
    if (pres2 !== victim) {
      expect(expectReject(state, { type: 'nominate', playerId: pres2, chancellorId: victim })).toBe(
        'PLAYER_DEAD',
      );
    }
  });

  it('Hitler infaz edilirse liberaller kazanır', () => {
    let state = playUntil(
      ackAll(newGame(5, FIVE)),
      (s) => s.phase.kind === 'executive_action' && s.phase.power === 'execution',
      'fascist',
      { avoidChancellors: ['p5'] },
    );
    if (state.phase.kind !== 'executive_action') throw new Error('infaz gücü bekleniyordu');
    const president = state.phase.government.presidentId;
    state = apply(state, { type: 'use_power', playerId: president, targetId: 'p5' });
    expect(state.phase.kind).toBe('game_over');
    expect(state.winner).toBe('liberal');
    expect(state.endReason).toBe('hitler_executed');
  });
});

describe('özel seçim (call_special_election)', () => {
  it('başkan sonraki başkan adayını seçer; tur sonunda sıra normale döner', () => {
    let state = playUntil(
      ackAll(newGame(7, SEVEN)),
      (s) => s.phase.kind === 'executive_action' && s.phase.power === 'call_special_election',
      'fascist',
      { avoidChancellors: ['p7'] },
    );
    if (state.phase.kind !== 'executive_action') throw new Error('özel seçim gücü bekleniyordu');
    const callingPresident = state.phase.government.presidentId;
    const callerSeat = state.players.find((p) => p.playerId === callingPresident)?.seatIndex as number;
    const special = state.players.find(
      (p) => p.alive && p.playerId !== callingPresident && p.playerId !== 'p7',
    )?.playerId as string;

    state = apply(state, { type: 'use_power', playerId: callingPresident, targetId: special });
    expect(state.phase.kind).toBe('nomination');
    expect(currentPresidentId(state)).toBe(special);

    // Özel seçilen başkanın turunu tamamla.
    state = runElection(state, pickChancellor(state, ['p7']));
    if (state.phase.kind === 'legislative_president') {
      const president = state.phase.government.presidentId;
      const drop = state.phase.drawnCards[0]?.cardId as string;
      state = apply(state, { type: 'discard_policy', playerId: president, cardId: drop });
      if (state.phase.kind === 'legislative_chancellor') {
        const chancellor = state.phase.government.chancellorId;
        const enact = state.phase.handCards[0]?.cardId as string;
        state = apply(state, { type: 'enact_policy', playerId: chancellor, cardId: enact });
      }
    }
    // Yetki tekrar tetiklenmediyse sıra çağıran başkandan sonrakine döner.
    if (state.phase.kind === 'nomination') {
      const expectedSeat = (callerSeat + 1) % state.players.length;
      expect(state.players.find((p) => p.playerId === currentPresidentId(state))?.seatIndex).toBe(
        expectedSeat,
      );
    }
  });
});

describe('yetki kullanımı doğrulamaları', () => {
  it('başkan olmayan yetki kullanamaz', () => {
    const state = playUntil(ackAll(newGame(7, SEVEN)), atPower, 'fascist', {
      avoidChancellors: ['p7'],
    });
    if (state.phase.kind !== 'executive_action') throw new Error('yetki bekleniyordu');
    const presidentId = state.phase.government.presidentId;
    const other = state.players.find((p) => p.playerId !== presidentId)?.playerId as string;
    expect(expectReject(state, { type: 'use_power', playerId: other, targetId: 'p2' })).toBe(
      'NOT_YOUR_TURN',
    );
  });

  it('hedef gerektiren yetkide hedef yoksa reddedilir', () => {
    const state = playUntil(ackAll(newGame(7, SEVEN)), atPower, 'fascist', {
      avoidChancellors: ['p7'],
    });
    if (state.phase.kind !== 'executive_action') throw new Error('yetki bekleniyordu');
    const president = state.phase.government.presidentId;
    expect(expectReject(state, { type: 'use_power', playerId: president })).toBe('POWER_NEEDS_TARGET');
  });

  it('yetki dışı aşamada use_power reddedilir', () => {
    const state = ackAll(newGame(7, SEVEN));
    expect(expectReject(state, { type: 'use_power', playerId: 'p1', targetId: 'p2' })).toBe(
      'WRONG_PHASE',
    );
  });
});
