import { describe, expect, it } from 'vitest';

import { applyCommand, createGame, eligibleChancellorIds } from '@secret-table/game-core';
import type { GameEvent, GameState } from '@secret-table/game-core';

import { eventsToCues, projectView } from './projection';
import type { ProjectionMeta } from './projection';

function meta(state: GameState): ProjectionMeta {
  const connected: Record<string, boolean> = {};
  for (const p of state.players) connected[p.playerId] = true;
  return {
    roomId: 'room1',
    gameId: 'game1',
    connectedByPlayerId: connected,
    localConnection: 'connected',
    paused: null,
  };
}

const names = (state: GameState): Record<string, string> =>
  Object.fromEntries(state.players.map((p) => [p.playerId, `İsim-${p.seatIndex}`]));

function seats(count: number) {
  return Array.from({ length: count }, (_u, i) => ({ playerId: `p${i + 1}`, seatIndex: i }));
}

describe('projectView gizlilik', () => {
  it('rol yalnız sahibine; herkese açık oyuncu nesnesi rol/parti taşımaz', () => {
    const state = createGame({
      players: seats(5),
      seed: 1,
      overrides: {
        roles: { p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'fascist', p5: 'hitler' },
        firstPresidentSeat: 0,
      },
    });
    const p1View = projectView(state, 'p1', meta(state), names(state));
    const p4View = projectView(state, 'p4', meta(state), names(state));

    expect(p1View.privateView.role).toBe('liberal');
    expect(p4View.privateView.role).toBe('fascist');
    for (const player of p1View.players) {
      expect(Object.keys(player).sort()).toEqual(
        [
          'alive', 'avatar', 'connected', 'displayName', 'hasVoted', 'isChancellorCandidate',
          'isHost', 'isPresidentialCandidate', 'office', 'playerId', 'ready', 'seatIndex',
        ].sort(),
      );
    }
  });

  it('displayName sunucu meta isimlerinden gelir, playerId sızmaz', () => {
    const state = createGame({ players: seats(5), seed: 2 });
    const view = projectView(state, 'p1', meta(state), names(state));
    expect(view.players[0]?.displayName).toBe('İsim-0');
  });

  it('sadakat incelemesi sonucu yalnız yetkiyi kullanan başkana görünür', () => {
    // 7 kişi: 2. faşist yuva investigate. Kısa yol: durumu elle kurmak yerine
    // motoru investigate aşamasına getirene kadar oyna.
    let state = createGame({
      players: seats(7),
      seed: 5,
      overrides: {
        roles: {
          p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'liberal',
          p5: 'fascist', p6: 'fascist', p7: 'hitler',
        },
        firstPresidentSeat: 0,
        deck: [
          'fascist', 'fascist', 'fascist', 'fascist', 'fascist', 'fascist',
          'fascist', 'fascist', 'fascist', 'fascist', 'fascist',
          'liberal', 'liberal', 'liberal', 'liberal', 'liberal', 'liberal',
        ],
      },
    });
    for (const p of state.players) state = must(applyCommand(state, { type: 'ack_role', playerId: p.playerId }));

    const play = (): void => {
      let guard = 0;
      while (
        state.phase.kind !== 'executive_action' &&
        state.phase.kind !== 'game_over' &&
        guard < 50
      ) {
        guard += 1;
        const phase = state.phase;
        if (phase.kind === 'nomination') {
          const target = eligibleChancellorIds(state, phase.presidentId).find((id) => id !== 'p7');
          if (!target) throw new Error('uygun şansölye yok');
          state = must(applyCommand(state, { type: 'nominate', playerId: phase.presidentId, chancellorId: target }));
        } else if (phase.kind === 'voting') {
          for (const p of state.players.filter((pl) => pl.alive)) {
            if (state.phase.kind === 'voting' && state.phase.votes[p.playerId] === undefined) {
              state = must(applyCommand(state, { type: 'vote', playerId: p.playerId, vote: 'yes' }));
            }
          }
        } else if (phase.kind === 'legislative_president') {
          state = must(applyCommand(state, {
            type: 'discard_policy',
            playerId: phase.government.presidentId,
            cardId: phase.drawnCards[0]?.cardId as string,
          }));
        } else if (phase.kind === 'legislative_chancellor') {
          state = must(applyCommand(state, {
            type: 'enact_policy',
            playerId: phase.government.chancellorId,
            cardId: phase.handCards[0]?.cardId as string,
          }));
        } else {
          break;
        }
      }
    };
    play();

    expect(state.phase.kind).toBe('executive_action');
    if (state.phase.kind !== 'executive_action') return;
    expect(state.phase.power).toBe('investigate_loyalty');
    const president = state.phase.government.presidentId;
    const target = state.players.find((p) => p.alive && p.playerId !== president)?.playerId as string;
    state = must(applyCommand(state, { type: 'use_power', playerId: president, targetId: target }));

    const presidentView = projectView(state, president, meta(state), names(state));
    expect(presidentView.privateView.inspection?.kind).toBe('party_membership');
    expect(presidentView.table.currentPower?.power).toBe('investigate_loyalty');

    for (const other of state.players) {
      if (other.playerId === president) continue;
      const view = projectView(state, other.playerId, meta(state), names(state));
      expect(view.privateView.inspection).toBeNull();
      // currentPower herkese açık (kim, hangi yetki) ama sonuç değil.
      expect(view.table.currentPower?.power).toBe('investigate_loyalty');
    }
  });
});

describe('cards_moved sahne uyumluluğu', () => {
  it('şansölye kartı koyduktan sonra office boşalır; hükümet yalnız lastElection ile çözülür', () => {
    let state = createGame({
      players: seats(5),
      seed: 9,
      overrides: {
        roles: { p1: 'liberal', p2: 'liberal', p3: 'liberal', p4: 'fascist', p5: 'hitler' },
        firstPresidentSeat: 0,
        deck: [
          'liberal', 'liberal', 'liberal', 'liberal', 'liberal', 'liberal',
          'fascist', 'fascist', 'fascist', 'fascist', 'fascist', 'fascist',
          'fascist', 'fascist', 'fascist', 'fascist', 'fascist',
        ],
      },
    });
    for (const p of state.players) {
      state = must(applyCommand(state, { type: 'ack_role', playerId: p.playerId }));
    }
    state = must(applyCommand(state, { type: 'nominate', playerId: 'p1', chancellorId: 'p3' }));
    for (const p of state.players) {
      state = must(applyCommand(state, { type: 'vote', playerId: p.playerId, vote: 'yes' }));
    }

    // Yasama sırasında makamlar görünür.
    if (state.phase.kind !== 'legislative_president') throw new Error('yasama bekleniyordu');
    const during = projectView(state, 'p2', meta(state), names(state));
    expect(during.players.find((p) => p.office === 'president')?.playerId).toBe('p1');

    state = must(applyCommand(state, {
      type: 'discard_policy',
      playerId: 'p1',
      cardId: state.phase.drawnCards[0]?.cardId as string,
    }));
    if (state.phase.kind !== 'legislative_chancellor') throw new Error('şansölye bekleniyordu');
    const enact = applyCommand(state, {
      type: 'enact_policy',
      playerId: 'p3',
      cardId: state.phase.handCards[0]?.cardId as string,
    });
    state = must(enact);

    // Aynı revizyonda hem chancellor→discard cue'su var hem de office boşalmış.
    expect(state.phase.kind).toBe('nomination');
    const cues = eventsToCues(
      enact.ok ? enact.events : [],
      'p2',
      'game1',
      state.revision,
    );
    expect(cues.some((c) => c.kind === 'cards_moved' && c.from === 'chancellor' && c.to === 'discard')).toBe(true);

    const after = projectView(state, 'p2', meta(state), names(state));
    expect(after.players.some((p) => p.office === 'chancellor')).toBe(false);
    expect(after.players.some((p) => p.office === 'president')).toBe(false);
    // Sahnenin makamı çözebilmesi için tek kaynak: lastElection.
    expect(after.table.lastElection?.outcome).toBe('elected');
    expect(after.table.lastElection?.presidentId).toBe('p1');
    expect(after.table.lastElection?.chancellorId).toBe('p3');
  });
});

describe('eventsToCues', () => {
  const events: GameEvent[] = [
    { kind: 'cards_dealt', toPlayerId: 'p1', cards: ['liberal', 'fascist', 'fascist'] },
    { kind: 'votes_revealed', electionId: 'e1', outcome: 'elected', votes: [{ playerId: 'p1', vote: 'yes' }] },
    { kind: 'policy_enacted', board: 'fascist', slotIndex: 0, policy: 'fascist' },
    { kind: 'game_ended', winner: 'liberal', reason: 'hitler_executed' },
  ];

  it('cards_dealt yalnız alıcıya', () => {
    const forP1 = eventsToCues(events, 'p1', 'game1', 5);
    const forP2 = eventsToCues(events, 'p2', 'game1', 5);
    expect(forP1.some((c) => c.kind === 'cards_dealt')).toBe(true);
    expect(forP2.some((c) => c.kind === 'cards_dealt')).toBe(false);
  });

  it('cards_moved herkese gider ve yalnız adet + uçları taşır', () => {
    const moved: GameEvent[] = [
      { kind: 'cards_moved', count: 3, from: 'deck', to: 'president' },
      { kind: 'cards_moved', count: 1, from: 'chancellor', to: 'discard' },
    ];
    for (const playerId of ['p1', 'p2', 'p3']) {
      const cues = eventsToCues(moved, playerId, 'game1', 7);
      expect(cues.map((c) => c.kind)).toEqual(['cards_moved', 'cards_moved']);
      for (const cue of cues) {
        // Politika türü, kart kimliği veya sıra bilgisi yok.
        expect(Object.keys(cue).sort()).toEqual(
          ['count', 'cueId', 'from', 'gameId', 'kind', 'revision', 'to'].sort(),
        );
        expect(cue.gameId).toBe('game1');
        expect(cue.revision).toBe(7);
      }
    }
  });

  it('votes_revealed / policy_enacted / game_ended herkese', () => {
    const forP2 = eventsToCues(events, 'p2', 'game1', 5);
    expect(forP2.map((c) => c.kind).sort()).toEqual(
      ['game_ended', 'policy_enacted', 'votes_revealed'].sort(),
    );
    for (const cue of forP2) {
      expect(cue.gameId).toBe('game1');
      expect(cue.revision).toBe(5);
    }
  });
});

function must(result: ReturnType<typeof applyCommand>): GameState {
  if (!result.ok) throw new Error(`motor reddetti: ${result.code}`);
  return result.state;
}
