import { describe, expect, it } from 'vitest';

import type { PlayerCount } from '@secret-table/contracts';
import { ROLE_SETUPS } from '@secret-table/contracts';

import { ackAll, newGame, playToEnd } from './test-helpers';

const COUNTS = [5, 6, 7, 8, 9, 10] as const;

describe('tam oyun — 5-10 oyuncu', () => {
  it.each(COUNTS)('%i oyunculuk oyun kurala uygun biter', (count) => {
    const state = playToEnd(ackAll(newGame(count, undefined, 100 + count)), 'fascist');

    expect(state.phase.kind).toBe('game_over');
    expect(['liberal', 'fascist']).toContain(state.winner);
    expect(state.endReason).not.toBeNull();
    expect(state.revision).toBeGreaterThan(0);

    // Rol sayıları oyun boyunca korunur.
    const setup = ROLE_SETUPS[count as PlayerCount];
    expect(state.players.filter((p) => p.role === 'liberal')).toHaveLength(setup.liberals);
    expect(state.players.filter((p) => p.role === 'fascist')).toHaveLength(setup.fascists);
    expect(state.players.filter((p) => p.role === 'hitler')).toHaveLength(1);

    // Log game_started ile başlar, game_over ile biter; sıra numaraları artan.
    expect(state.log[0]?.kind).toBe('game_started');
    expect(state.log.at(-1)?.kind).toBe('game_over');
    const seqs = state.log.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));

    // Kazanma nedeni tutarlı.
    if (state.winner === 'liberal') {
      expect(['liberal_policies_enacted', 'hitler_executed']).toContain(state.endReason);
    } else {
      expect(['fascist_policies_enacted', 'hitler_elected_chancellor']).toContain(state.endReason);
    }

    // Politika sayıları tahta sınırları içinde.
    expect(state.liberalPolicies).toBeLessThanOrEqual(5);
    expect(state.fascistPolicies).toBeLessThanOrEqual(6);
  });

  it('aynı tohum aynı oyun sonucunu verir (belirlenimci)', () => {
    const a = playToEnd(ackAll(newGame(7, undefined, 777)), 'fascist');
    const b = playToEnd(ackAll(newGame(7, undefined, 777)), 'fascist');
    expect(a.winner).toBe(b.winner);
    expect(a.endReason).toBe(b.endReason);
    expect(a.revision).toBe(b.revision);
    expect(a.log.length).toBe(b.log.length);
  });

  it('liberal tercihiyle oynanan oyun da kurala uygun biter', () => {
    for (const count of COUNTS) {
      const state = playToEnd(ackAll(newGame(count, undefined, 500 + count)), 'liberal');
      expect(state.phase.kind).toBe('game_over');
      expect(['liberal', 'fascist']).toContain(state.winner);
    }
  });
});
