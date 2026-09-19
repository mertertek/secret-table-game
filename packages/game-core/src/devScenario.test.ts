/**
 * D14 — geliştirici senaryo atlaması (`devScenario`).
 *
 * Kontroller: her tahta düzeninde (5-6 / 7-8 / 9-10) faşist sayaç doğru, kart
 * sayıları korunur, roller değişmez ve senaryodan sonra GERÇEK motor akışı
 * (`applyCommand`) infaza kadar ilerler.
 */

import { describe, expect, it } from 'vitest';

import { BOARD_LAYOUTS, boardLayoutForPlayerCount } from '@secret-table/contracts';

import { applyCommand } from './engine';
import { devScenario } from './devScenario';
import { eligibleChancellorIds, investigatableTargetIds } from './selectors';
import { ackAll, apply, newGame, pickChancellor, roles, runElection } from './test-helpers';
import type { GameState } from './types';

/** deste + çöp + tahtadaki kartlar + elde tutulan kartlar = 17 (6L + 11F). */
function cardTotals(s: GameState): { liberal: number; fascist: number; total: number } {
  const cards = [...s.deck, ...s.discard];
  for (const entry of s.enactedPolicies) cards.push(entry.policy);
  const { phase } = s;
  if (phase.kind === 'legislative_president') {
    for (const c of phase.drawnCards) cards.push(c.policy);
  } else if (phase.kind === 'legislative_chancellor' || phase.kind === 'veto_response') {
    for (const c of phase.handCards) cards.push(c.policy);
  }
  return {
    liberal: cards.filter((c) => c === 'liberal').length,
    fascist: cards.filter((c) => c === 'fascist').length,
    total: cards.length,
  };
}

function ok(result: ReturnType<typeof devScenario>): GameState {
  if (!result.ok) throw new Error(`devScenario reddetti: ${result.code}`);
  return result.state;
}

/** Her düzenden bir oyuncu sayısı; ilk infaz yuvası (1 tabanlı). */
const LAYOUT_CASES = [
  { playerCount: 5, variant: 'small' as const },
  { playerCount: 6, variant: 'small' as const },
  { playerCount: 7, variant: 'medium' as const },
  { playerCount: 8, variant: 'medium' as const },
  { playerCount: 9, variant: 'large' as const },
  { playerCount: 10, variant: 'large' as const },
];

function firstExecutionSlot(playerCount: number): number {
  const layout = boardLayoutForPlayerCount(playerCount as 5);
  return layout.fascistPowers.indexOf('execution') + 1;
}

describe('devScenario — düzen başına sayaçlar', () => {
  it('her düzende ilk infaz yuvası tanımlı', () => {
    for (const layout of Object.values(BOARD_LAYOUTS)) {
      expect(layout.fascistPowers.indexOf('execution')).toBeGreaterThanOrEqual(0);
    }
  });

  for (const { playerCount, variant } of LAYOUT_CASES) {
    it(`${playerCount} kişi (${variant}): execution_now sayacı ilk infaz yuvasına eşitler`, () => {
      const start = ackAll(newGame(playerCount));
      const actorId = start.players[2]?.playerId as string;
      const next = ok(devScenario(start, { scenario: 'execution_now', actorId }));

      const slot = firstExecutionSlot(playerCount);
      expect(next.fascistPolicies).toBe(slot);
      expect(next.layout.fascistPowers[slot - 1]).toBe('execution');
      expect(next.phase.kind).toBe('executive_action');
      if (next.phase.kind !== 'executive_action') throw new Error('beklenmeyen faz');
      expect(next.phase.power).toBe('execution');
      expect(next.phase.government.presidentId).toBe(actorId);
      expect(next.phase.targetId).toBeNull();
      expect(next.phase.resolved).toBe(false);
      expect(next.electionTracker).toBe(0);
      expect(next.presidentSeat).toBe(2);
      expect(next.revision).toBe(start.revision + 1);
      expect(next.phaseSeq).toBeGreaterThan(start.phaseSeq);
    });

    it(`${playerCount} kişi (${variant}): execution_round sayacı yuvanın bir eksiği + deste üstü faşist`, () => {
      const start = ackAll(newGame(playerCount));
      const actorId = start.players[1]?.playerId as string;
      const next = ok(devScenario(start, { scenario: 'execution_round', actorId }));

      const slot = firstExecutionSlot(playerCount);
      expect(next.fascistPolicies).toBe(slot - 1);
      expect(next.deck.slice(0, 3)).toEqual(['fascist', 'fascist', 'fascist']);
      expect(next.phase).toEqual({ kind: 'nomination', presidentId: actorId });
      expect(next.presidentSeat).toBe(1);
      expect(next.lastGovernment).toBeNull();
    });

    it(`${playerCount} kişi (${variant}): kart sayıları ve roller korunur`, () => {
      const start = ackAll(newGame(playerCount));
      const before = cardTotals(start);
      expect(before).toEqual({ liberal: 6, fascist: 11, total: 17 });
      const rolesBefore = start.players.map((p) => `${p.playerId}:${p.role}`);

      for (const scenario of ['execution_now', 'execution_round'] as const) {
        const actorId = start.players[0]?.playerId as string;
        const next = ok(devScenario(start, { scenario, actorId }));
        expect(cardTotals(next)).toEqual({ liberal: 6, fascist: 11, total: 17 });
        expect(next.players.map((p) => `${p.playerId}:${p.role}`)).toEqual(rolesBefore);
        expect(next.enactedPolicies.filter((e) => e.board === 'fascist')).toHaveLength(
          next.fascistPolicies,
        );
      }
    });
  }
});

describe('devScenario — gerçek motorla devam', () => {
  it('execution_now → use_power hedefi öldürür (player_eliminated)', () => {
    const start = ackAll(
      newGame(7, {
        roles: roles({
          p1: 'liberal',
          p2: 'liberal',
          p3: 'liberal',
          p4: 'liberal',
          p5: 'fascist',
          p6: 'fascist',
          p7: 'hitler',
        }),
      }),
    );
    const state = ok(devScenario(start, { scenario: 'execution_now', actorId: 'p3' }));

    const result = applyCommand(state, { type: 'use_power', playerId: 'p3', targetId: 'p2' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toContainEqual({ kind: 'player_eliminated', playerId: 'p2' });
    expect(result.state.players.find((p) => p.playerId === 'p2')?.alive).toBe(false);
    expect(result.state.log.some((e) => e.kind === 'player_executed')).toBe(true);
    // İnfazdan sonra tur normal akışla kapanır.
    expect(result.state.phase.kind).toBe('nomination');
  });

  it('execution_now → Hitler infazı oyunu liberallerin kazanmasıyla bitirir', () => {
    const start = ackAll(
      newGame(5, {
        roles: roles({ p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'fascist', p5: 'hitler' }),
      }),
    );
    const state = ok(devScenario(start, { scenario: 'execution_now', actorId: 'p1' }));
    const result = applyCommand(state, { type: 'use_power', playerId: 'p1', targetId: 'p5' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({
      kind: 'game_over',
      winner: 'liberal',
      reason: 'hitler_executed',
    });
  });

  it('execution_round → aday, oy, kanun → infaz yetkisi ve gerçekleşen infaz', () => {
    const start = ackAll(
      newGame(7, {
        roles: roles({
          p1: 'liberal',
          p2: 'liberal',
          p3: 'liberal',
          p4: 'liberal',
          p5: 'fascist',
          p6: 'fascist',
          p7: 'hitler',
        }),
      }),
    );
    let state = ok(devScenario(start, { scenario: 'execution_round', actorId: 'p1' }));
    expect(state.fascistPolicies).toBe(3);

    // Aday: Hitler DEĞİL (3 faşist kanunda Hitler şansölye = faşist zafer).
    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p2' });
    for (const player of state.players.filter((p) => p.alive)) {
      state = apply(state, { type: 'vote', playerId: player.playerId, vote: 'yes' });
    }

    expect(state.phase.kind).toBe('legislative_president');
    if (state.phase.kind !== 'legislative_president') throw new Error('beklenmeyen faz');
    expect(state.phase.drawnCards.map((c) => c.policy)).toEqual([
      'fascist',
      'fascist',
      'fascist',
    ]);

    const discard = state.phase.drawnCards[0]?.cardId as string;
    state = apply(state, { type: 'discard_policy', playerId: 'p1', cardId: discard });
    if (state.phase.kind !== 'legislative_chancellor') throw new Error('beklenmeyen faz');
    const enact = state.phase.handCards[0]?.cardId as string;
    state = apply(state, { type: 'enact_policy', playerId: 'p2', cardId: enact });

    expect(state.fascistPolicies).toBe(4);
    expect(state.phase.kind).toBe('executive_action');
    if (state.phase.kind !== 'executive_action') throw new Error('beklenmeyen faz');
    expect(state.phase.power).toBe('execution');
    expect(state.phase.government.presidentId).toBe('p1');

    const after = apply(state, { type: 'use_power', playerId: 'p1', targetId: 'p4' });
    expect(after.players.find((p) => p.playerId === 'p4')?.alive).toBe(false);
    expect(cardTotals(after)).toEqual({ liberal: 6, fascist: 11, total: 17 });
  });

  it('rol onayı yapılmamış oyunda da çalışır (role_reveal → executive_action)', () => {
    const start = newGame(5);
    const actorId = start.players[0]?.playerId as string;
    const state = ok(devScenario(start, { scenario: 'execution_now', actorId }));
    expect(state.phase.kind).toBe('executive_action');
  });

  it('oyun sırasında (yasama aşamasında) da çalışır; eldeki kartlar çöpe döner', () => {
    let state = ackAll(newGame(5));
    state = runElection(state, pickChancellor(state));
    if (state.phase.kind !== 'legislative_president') throw new Error('beklenmeyen faz');
    const president = state.phase.government.presidentId;
    state = apply(state, {
      type: 'discard_policy',
      playerId: president,
      cardId: state.phase.drawnCards[0]?.cardId as string,
    });
    expect(state.phase.kind).toBe('legislative_chancellor');
    const before = cardTotals(state);
    const actorId = state.players[0]?.playerId as string;
    const next = ok(devScenario(state, { scenario: 'execution_now', actorId }));
    expect(cardTotals(next)).toEqual(before);
    expect(next.phase.kind).toBe('executive_action');
  });
});

// ---------------------------------------------------------------------------
// D19 — yetki / veto / Hitler bölgesi / kaos senaryoları
// ---------------------------------------------------------------------------

describe('devScenario — D19 yetki senaryoları', () => {
  const POWER_CASES = [
    { scenario: 'investigate_now' as const, power: 'investigate_loyalty' as const, ok: [7, 8, 9, 10], bad: [5, 6] },
    { scenario: 'special_election_now' as const, power: 'call_special_election' as const, ok: [7, 8, 9, 10], bad: [5, 6] },
    { scenario: 'policy_peek_now' as const, power: 'policy_peek' as const, ok: [5, 6], bad: [7, 8, 9, 10] },
    { scenario: 'execution_now' as const, power: 'execution' as const, ok: [5, 6, 7, 8, 9, 10], bad: [] },
  ];

  for (const { scenario, power, ok: okCounts, bad } of POWER_CASES) {
    for (const playerCount of okCounts) {
      it(`${scenario} ${playerCount} kişide ${power} yetkisini yerel başkana verir`, () => {
        const start = ackAll(newGame(playerCount));
        const actorId = start.players[2]?.playerId as string;
        const next = ok(devScenario(start, { scenario, actorId }));

        const layout = boardLayoutForPlayerCount(playerCount as 5);
        const slot = layout.fascistPowers.indexOf(power) + 1;
        expect(next.fascistPolicies).toBe(slot);
        expect(next.phase.kind).toBe('executive_action');
        if (next.phase.kind !== 'executive_action') throw new Error('beklenmeyen faz');
        expect(next.phase.power).toBe(power);
        expect(next.phase.government.presidentId).toBe(actorId);
        expect(next.phase.resolved).toBe(false);
        expect(next.phase.inspection).toBeNull();
        expect(cardTotals(next)).toEqual({ liberal: 6, fascist: 11, total: 17 });
      });
    }

    for (const playerCount of bad) {
      it(`${scenario} ${playerCount} kişide SCENARIO_NEEDS_PLAYERS`, () => {
        const start = ackAll(newGame(playerCount));
        const actorId = start.players[0]?.playerId as string;
        expect(devScenario(start, { scenario, actorId })).toEqual({
          ok: false,
          code: 'SCENARIO_NEEDS_PLAYERS',
        });
      });
    }
  }

  it('investigate_now → gerçek motorla inceleme sonucu YALNIZ başkanın fazında durur', () => {
    const start = ackAll(
      newGame(7, {
        roles: roles({
          p1: 'liberal', p2: 'fascist', p3: 'liberal', p4: 'liberal',
          p5: 'liberal', p6: 'fascist', p7: 'hitler',
        }),
      }),
    );
    let state = ok(devScenario(start, { scenario: 'investigate_now', actorId: 'p1' }));
    state = apply(state, { type: 'use_power', playerId: 'p1', targetId: 'p2' });
    if (state.phase.kind !== 'executive_action') throw new Error('beklenmeyen faz');
    expect(state.phase.inspection).toEqual({
      kind: 'party_membership',
      targetId: 'p2',
      party: 'fascist',
    });
    expect(state.investigations).toEqual([{ actorId: 'p1', targetId: 'p2', party: 'fascist' }]);

    // Onaydan sonra tur normal akışla kapanır.
    state = apply(state, { type: 'ack_private_result', playerId: 'p1' });
    expect(state.phase.kind).toBe('nomination');
  });

  it('aynı oyuncu ikinci kez incelenemez (başka başkan da olsa) — D18/B1', () => {
    const start = ackAll(newGame(9));
    let state = ok(devScenario(start, { scenario: 'investigate_now', actorId: 'p1' }));
    state = apply(state, { type: 'use_power', playerId: 'p1', targetId: 'p3' });
    state = apply(state, { type: 'ack_private_result', playerId: 'p1' });

    // İkinci inceleme turu: BAŞKA bir başkan aynı hedefi seçmeye çalışır.
    const second = ok(devScenario(state, { scenario: 'investigate_now', actorId: 'p2' }));
    expect(investigatableTargetIds(second, 'p2')).not.toContain('p3');
    const rejected = applyCommand(second, { type: 'use_power', playerId: 'p2', targetId: 'p3' });
    expect(rejected).toEqual({ ok: false, code: 'INVALID_TARGET' });
  });

  it('special_election_now → hedef sonraki başkan olur, sonra sıra kaldığı yerden devam eder', () => {
    const start = ackAll(newGame(7));
    let state = ok(devScenario(start, { scenario: 'special_election_now', actorId: 'p1' }));
    expect(state.presidentSeat).toBe(0);
    state = apply(state, { type: 'use_power', playerId: 'p1', targetId: 'p5' });
    expect(state.phase).toEqual({ kind: 'nomination', presidentId: 'p5' });
    expect(state.specialElection).toEqual({ presidentId: 'p5', returnToSeat: 1 });

    // Özel seçim turu başarısız olsa bile sıra p2'ye (returnToSeat) döner.
    state = apply(state, { type: 'nominate', playerId: 'p5', chancellorId: 'p3' });
    for (const p of state.players.filter((x) => x.alive)) {
      state = apply(state, { type: 'vote', playerId: p.playerId, vote: 'no' });
    }
    expect(state.phase).toEqual({ kind: 'nomination', presidentId: 'p2' });
    expect(state.specialElection).toBeNull();
  });

  it('policy_peek_now → 3 kart yalnız başkanın fazında, deste SIRASI değişmez', () => {
    const start = ackAll(newGame(5));
    let state = ok(devScenario(start, { scenario: 'policy_peek_now', actorId: 'p2' }));
    const deckBefore = [...state.deck];
    state = apply(state, { type: 'use_power', playerId: 'p2' });
    if (state.phase.kind !== 'executive_action') throw new Error('beklenmeyen faz');
    expect(state.phase.inspection).toEqual({ kind: 'policy_peek', cards: deckBefore.slice(0, 3) });
    expect(state.deck).toEqual(deckBefore);
    expect(cardTotals(state)).toEqual({ liberal: 6, fascist: 11, total: 17 });
  });
});

describe('devScenario — D19 veto turu', () => {
  for (const playerCount of [5, 7, 9]) {
    it(`${playerCount} kişi: veto_round yerel oyuncuyu şansölye yapar, sayaç ${5}`, () => {
      const start = ackAll(newGame(playerCount));
      const actorId = start.players[3]?.playerId as string;
      const next = ok(devScenario(start, { scenario: 'veto_round', actorId }));

      expect(next.fascistPolicies).toBe(next.layout.vetoUnlockAt);
      expect(next.phase.kind).toBe('legislative_chancellor');
      if (next.phase.kind !== 'legislative_chancellor') throw new Error('beklenmeyen faz');
      expect(next.phase.government.chancellorId).toBe(actorId);
      expect(next.phase.government.presidentId).not.toBe(actorId);
      expect(next.phase.vetoRequested).toBe(false);
      expect(next.phase.handCards).toHaveLength(2);
      expect(next.phase.handCards.map((c) => c.policy)).toEqual(['fascist', 'fascist']);
      expect(cardTotals(next)).toEqual({ liberal: 6, fascist: 11, total: 17 });
    });
  }

  it('veto_round → şansölye veto önerir, başkan REDDEDER → el geri döner', () => {
    const start = ackAll(newGame(7));
    let state = ok(devScenario(start, { scenario: 'veto_round', actorId: 'p4' }));
    if (state.phase.kind !== 'legislative_chancellor') throw new Error('beklenmeyen faz');
    const presidentId = state.phase.government.presidentId;

    state = apply(state, { type: 'request_veto', playerId: 'p4' });
    expect(state.phase.kind).toBe('veto_response');

    state = apply(state, { type: 'respond_veto', playerId: presidentId, accept: false });
    expect(state.phase.kind).toBe('legislative_chancellor');
    if (state.phase.kind !== 'legislative_chancellor') throw new Error('beklenmeyen faz');
    expect(state.phase.vetoRequested).toBe(true);
    expect(state.phase.handCards).toHaveLength(2);
    expect(state.electionTracker).toBe(0);
    // İkinci veto isteği reddedilir.
    expect(applyCommand(state, { type: 'request_veto', playerId: 'p4' })).toEqual({
      ok: false,
      code: 'VETO_NOT_AVAILABLE',
    });
    expect(cardTotals(state)).toEqual({ liberal: 6, fascist: 11, total: 17 });
  });

  it('veto_round_president → yerel başkan KABUL eder → iki kart çöpe, sayaç +1', () => {
    const start = ackAll(newGame(7));
    let state = ok(devScenario(start, { scenario: 'veto_round_president', actorId: 'p1' }));
    expect(state.phase.kind).toBe('veto_response');
    if (state.phase.kind !== 'veto_response') throw new Error('beklenmeyen faz');
    expect(state.phase.government.presidentId).toBe('p1');
    const discardBefore = state.discard.length;

    state = apply(state, { type: 'respond_veto', playerId: 'p1', accept: true });
    expect(state.electionTracker).toBe(1);
    expect(state.discard.length).toBe(discardBefore + 2);
    expect(state.fascistPolicies).toBe(5);
    expect(state.phase.kind).toBe('nomination');
    expect(state.log.some((e) => e.kind === 'veto_enacted')).toBe(true);
    expect(cardTotals(state)).toEqual({ liberal: 6, fascist: 11, total: 17 });
  });

  it('veto senaryosu seçim sayacını KORUR: sayaç 2 + kabul → kaos (D19)', () => {
    const start = ackAll(newGame(7));
    let state = ok(devScenario(start, { scenario: 'chaos_round', actorId: 'p1' }));
    expect(state.electionTracker).toBe(2);

    state = ok(devScenario(state, { scenario: 'veto_round_president', actorId: 'p1' }));
    expect(state.electionTracker).toBe(2); // sıfırlanmadı
    const boardBefore = state.liberalPolicies + state.fascistPolicies;

    state = apply(state, { type: 'respond_veto', playerId: 'p1', accept: true });
    // Üçüncü başarısız seçim → kaos: deste tepesi yürürlüğe girer, sayaç 0,
    // tur kısıtları sıfırlanır ve yetki AÇILMAZ.
    expect(state.electionTracker).toBe(0);
    expect(state.liberalPolicies + state.fascistPolicies).toBe(boardBefore + 1);
    expect(state.lastGovernment).toBeNull();
    expect(state.log.some((e) => e.kind === 'chaos_policy')).toBe(true);
    expect(state.phase.kind === 'nomination' || state.phase.kind === 'game_over').toBe(true);
    expect(cardTotals(state)).toEqual({ liberal: 6, fascist: 11, total: 17 });
  });

  it('veto 5. faşist kanundan ÖNCE açılmaz (execution_round turunda)', () => {
    const start = ackAll(newGame(7));
    let state = ok(devScenario(start, { scenario: 'execution_round', actorId: 'p1' }));
    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p2' });
    for (const p of state.players.filter((x) => x.alive)) {
      state = apply(state, { type: 'vote', playerId: p.playerId, vote: 'yes' });
    }
    if (state.phase.kind !== 'legislative_president') throw new Error('beklenmeyen faz');
    state = apply(state, {
      type: 'discard_policy',
      playerId: 'p1',
      cardId: state.phase.drawnCards[0]?.cardId as string,
    });
    expect(applyCommand(state, { type: 'request_veto', playerId: 'p2' })).toEqual({
      ok: false,
      code: 'VETO_NOT_AVAILABLE',
    });
  });
});

describe('devScenario — D19 Hitler bölgesi ve kaos', () => {
  it('hitler_zone_round → Hitler şansölye seçilirse faşistler kazanır', () => {
    const start = ackAll(
      newGame(7, {
        roles: roles({
          p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'liberal',
          p5: 'fascist', p6: 'fascist', p7: 'hitler',
        }),
      }),
    );
    let state = ok(devScenario(start, { scenario: 'hitler_zone_round', actorId: 'p1' }));
    expect(state.fascistPolicies).toBe(state.layout.hitlerChancellorWinAt);
    expect(state.phase).toEqual({ kind: 'nomination', presidentId: 'p1' });
    expect(state.lastGovernment).toBeNull();

    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p7' });
    for (const p of state.players.filter((x) => x.alive)) {
      state = apply(state, { type: 'vote', playerId: p.playerId, vote: 'yes' });
    }
    expect(state.phase).toEqual({
      kind: 'game_over',
      winner: 'fascist',
      reason: 'hitler_elected_chancellor',
    });
  });

  it('hitler_zone_round → Hitler REDDEDİLİRSE oyun sürer (sayaç artar)', () => {
    const start = ackAll(
      newGame(7, {
        roles: roles({
          p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'liberal',
          p5: 'fascist', p6: 'fascist', p7: 'hitler',
        }),
      }),
    );
    let state = ok(devScenario(start, { scenario: 'hitler_zone_round', actorId: 'p1' }));
    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p7' });
    for (const p of state.players.filter((x) => x.alive)) {
      state = apply(state, { type: 'vote', playerId: p.playerId, vote: 'no' });
    }
    expect(state.phase.kind).toBe('nomination');
    expect(state.electionTracker).toBe(1);
  });

  it('chaos_round → 3. başarısız seçim deste tepesini yürürlüğe koyar, sınırlar sıfırlanır, yetki yok', () => {
    const start = ackAll(newGame(7));
    let state = ok(devScenario(start, { scenario: 'chaos_round', actorId: 'p1' }));
    expect(state.electionTracker).toBe(2);
    expect(state.phase).toEqual({ kind: 'nomination', presidentId: 'p1' });
    expect(state.lastGovernment).not.toBeNull();
    // Tur kısıtı gerçekten uygulanıyor (önceki şansölye aday olamaz).
    const bannedChancellor = state.lastGovernment?.chancellorId as string;
    expect(eligibleChancellorIds(state, 'p1')).not.toContain(bannedChancellor);

    const topCard = state.deck[0];
    const fascistBefore = state.fascistPolicies;
    const liberalBefore = state.liberalPolicies;

    const candidate = eligibleChancellorIds(state, 'p1')[0] as string;
    state = apply(state, { type: 'nominate', playerId: 'p1', chancellorId: candidate });
    for (const p of state.players.filter((x) => x.alive)) {
      state = apply(state, { type: 'vote', playerId: p.playerId, vote: 'no' });
    }

    expect(state.electionTracker).toBe(0);
    expect(state.lastGovernment).toBeNull(); // sınırlar sıfırlandı
    expect(state.log.some((e) => e.kind === 'chaos_policy')).toBe(true);
    if (topCard === 'fascist') {
      expect(state.fascistPolicies).toBe(fascistBefore + 1);
      // Kaos politikası YETKİ AÇMAZ: faz doğrudan adaylığa döner.
      expect(state.phase.kind).toBe('nomination');
    } else {
      expect(state.liberalPolicies).toBe(liberalBefore + 1);
    }
    expect(cardTotals(state)).toEqual({ liberal: 6, fascist: 11, total: 17 });
  });

  it('chaos_round her düzende çalışır ve kartları korur', () => {
    for (const { playerCount } of LAYOUT_CASES) {
      const start = ackAll(newGame(playerCount));
      const actorId = start.players[0]?.playerId as string;
      const next = ok(devScenario(start, { scenario: 'chaos_round', actorId }));
      expect(next.electionTracker).toBe(2);
      expect(next.lastGovernment?.presidentId).not.toBe(actorId);
      expect(next.lastGovernment?.chancellorId).not.toBe(actorId);
      expect(cardTotals(next)).toEqual({ liberal: 6, fascist: 11, total: 17 });
    }
  });

  it('tüm D19 senaryoları rolleri ve kart toplamını korur (saf, girdi değişmez)', () => {
    const scenarios = [
      'execution_now', 'execution_round', 'investigate_now', 'special_election_now',
      'veto_round', 'veto_round_president', 'hitler_zone_round', 'chaos_round',
    ] as const;
    const start = ackAll(newGame(9));
    const snapshot = structuredClone(start);
    const rolesBefore = start.players.map((p) => `${p.playerId}:${p.role}`);
    for (const scenario of scenarios) {
      const next = ok(devScenario(start, { scenario, actorId: 'p1' }));
      expect(cardTotals(next)).toEqual({ liberal: 6, fascist: 11, total: 17 });
      expect(next.players.map((p) => `${p.playerId}:${p.role}`)).toEqual(rolesBefore);
      expect(next.revision).toBe(start.revision + 1);
      expect(next.phaseSeq).toBeGreaterThan(start.phaseSeq);
    }
    expect(start).toEqual(snapshot);
  });
});

describe('devScenario — ret durumları', () => {
  it('bitmiş oyunda GAME_OVER', () => {
    const start = ackAll(newGame(5));
    const over: GameState = {
      ...start,
      phase: { kind: 'game_over', winner: 'liberal', reason: 'liberal_policies_enacted' },
    };
    const result = devScenario(over, {
      scenario: 'execution_now',
      actorId: start.players[0]?.playerId as string,
    });
    expect(result).toEqual({ ok: false, code: 'GAME_OVER' });
  });

  it('oyuncu olmayan aktör NOT_A_PLAYER', () => {
    const start = ackAll(newGame(5));
    expect(devScenario(start, { scenario: 'execution_now', actorId: 'yabanci' })).toEqual({
      ok: false,
      code: 'NOT_A_PLAYER',
    });
  });

  it('ölü aktör PLAYER_DEAD', () => {
    const start = ackAll(newGame(5));
    const dead: GameState = {
      ...start,
      players: start.players.map((p, i) => (i === 0 ? { ...p, alive: false } : p)),
    };
    expect(
      devScenario(dead, {
        scenario: 'execution_now',
        actorId: start.players[0]?.playerId as string,
      }),
    ).toEqual({ ok: false, code: 'PLAYER_DEAD' });
  });

  it('girdi durumu değişmez (saf işlev)', () => {
    const start = ackAll(newGame(6));
    const snapshot = structuredClone(start);
    ok(devScenario(start, { scenario: 'execution_round', actorId: start.players[0]?.playerId as string }));
    expect(start).toEqual(snapshot);
  });
});
