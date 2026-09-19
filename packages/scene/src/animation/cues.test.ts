import { describe, expect, it } from 'vitest';
import type { Office, PlayerView, SceneCue, SceneView } from '@secret-table/contracts';
import { avatarForSeat } from '@secret-table/contracts';
import { CueLedger, cueMatchesView, cueOfficePlayerId } from './cues';
const view: SceneView = {
  protocolVersion: 1, roomId: 'synthetic', gameId: 'demo', revision: 8, phaseId: 'hand', phase: 'president_discard',
  connection: 'connected', paused: null, playerCountAtStart: 7, boardVariant: 'medium', localPlayerId: 'p1', players: [],
  table: { liberalPolicies: 1, fascistPolicies: 0, electionTracker: 0, drawCount: 14, discardCount: 0,
    enactedPolicies: [{ board: 'liberal', slotIndex: 0, policy: 'liberal' }], lastElection: null, currentPower: null, publicHistory: [] },
  privateView: { role: null, hand: [{ cardId: 'actionable', policy: 'liberal' }], knownPlayers: [], submittedVote: null, inspection: null }, actions: [], result: null,
};
const deal: SceneCue = { cueId: 'deal', gameId: 'demo', revision: 8, kind: 'cards_dealt', toPlayerId: 'p1', cards: [{ cardId: 'event-only', policy: 'liberal' }] };
const enact: SceneCue = { cueId: 'enact', gameId: 'demo', revision: 8, kind: 'policy_enacted', board: 'liberal', slotIndex: 0, policy: 'liberal' };
describe('current-view cue lifecycle', () => {
  it('keeps input order and plays every cueId once, even in a cumulative array', () => {
    const ledger = new CueLedger();
    expect(ledger.update(view, [deal, enact, deal], 0, true, false).added.map((a) => a.cue.cueId)).toEqual(['deal', 'enact']);
    expect(ledger.update(view, [{ ...deal }, enact], 10, true, false).added).toEqual([]);
    expect(ledger.update(view, [deal, enact], 900, true, false).active).toEqual([]);
    expect(ledger.update({ ...view, revision: 9 }, [{ ...deal, revision: 9 }], 1000, true, false).added).toEqual([]);
  });
  it('never schedules stale, future or foreign game cues', () => {
    const ledger = new CueLedger();
    expect(ledger.update(view, [7, 9].map((revision) => ({ ...deal, revision })), 0, true, false).added).toEqual([]);
    expect(ledger.update(view, [{ ...deal, gameId: 'foreign' }], 0, true, false).added).toEqual([]);
  });
  it('newer view cancels old decoration without needing new cues', () => {
    const ledger = new CueLedger(); ledger.update(view, [deal], 0, true, false);
    expect(ledger.update({ ...view, revision: 9 }, [deal], 10, true, false).active).toEqual([]);
    expect(ledger.update(view, [deal], 15, true, false).active).toEqual([]);
  });
  it('normal empty drain retains accepted motion; explicit same-revision reset cancels without replay', () => {
    const ledger = new CueLedger(); ledger.update(view, [deal], 0, true, false);
    expect(ledger.update(view, [], 50, true, false).active).toHaveLength(1);
    expect(ledger.update(view, [deal], 60, true, false).added).toEqual([]);
    expect(ledger.update(view, [deal, enact], 70, true, false, 1).active).toEqual([]);
    expect(ledger.update(view, [deal, enact], 80, true, false, 1).added).toEqual([]);
  });
  it.each(['hidden', 'paused', 'disconnected'] as const)('%s cancels active and consumes incoming without replay', (mode) => {
    const ledger = new CueLedger(); ledger.update(view, [deal], 0, true, false);
    const interrupted = mode === 'paused' ? { ...view, paused: { reason: 'host_review' as const, waitingForPlayerIds: [] } } : mode === 'disconnected' ? { ...view, connection: 'disconnected' as const } : view;
    expect(ledger.update(interrupted, [deal, enact], 40, mode !== 'hidden', false).active).toEqual([]);
    expect(ledger.update(view, [deal, enact], 50, true, false).added).toEqual([]);
  });
  it('game change resets identity and allows a fresh cue', () => {
    const ledger = new CueLedger(); ledger.update(view, [deal], 0, true, false);
    expect(ledger.update({ ...view, gameId: 'new' }, [{ ...deal, gameId: 'new' }], 50, true, false).added).toHaveLength(1);
  });
  it('reduced motion uses a 100ms lifetime and expires without frame callbacks', () => {
    const ledger = new CueLedger();
    expect(ledger.update(view, [deal], 0, true, true).active[0]?.duration).toBe(100);
    expect(ledger.update(view, [deal], 101, true, true).active).toEqual([]);
  });
  it('rejects wrong recipient or removed private hand, but accepts event-only IDs', () => {
    expect(cueMatchesView(deal, view)).toBe(true);
    expect(cueMatchesView({ ...deal, toPlayerId: 'p2' }, view)).toBe(false);
    expect(cueMatchesView(deal, { ...view, privateView: { ...view.privateView, hand: [] } })).toBe(false);
    expect(cueMatchesView(deal, { ...view, privateView: { ...view.privateView, hand: [{ cardId: 'a', policy: 'fascist' }] } })).toBe(false);
  });
  it('rejects historical election, nonexistent tile and premature public roles', () => {
    expect(cueMatchesView({ cueId: 'v', gameId: 'demo', revision: 8, kind: 'votes_revealed', electionId: 'old', votes: [], outcome: 'elected' }, view)).toBe(false);
    expect(cueMatchesView({ ...enact, slotIndex: 3 }, view)).toBe(false);
    expect(cueMatchesView({ cueId: 'end', gameId: 'demo', revision: 8, kind: 'game_ended', winner: 'liberal', reason: 'hitler_executed' }, view)).toBe(false);
  });
  it('accepts public election result during an already advanced legislative phase', () => {
    const votes = [{ playerId: 'p1', vote: 'yes' as const }];
    const cue: SceneCue = { cueId: 'v', gameId: 'demo', revision: 8, kind: 'votes_revealed', electionId: 'current', votes, outcome: 'elected' };
    expect(cueMatchesView(cue, { ...view, table: { ...view.table, lastElection: { electionId: 'current', presidentId: 'p1', chancellorId: 'p2', outcome: 'elected', votes } } })).toBe(true);
  });
});

describe('cards_moved office resolution', () => {
  const seat = (playerId: string, seatIndex: number, office: Office): PlayerView => ({
    playerId, seatIndex, displayName: playerId, connected: true, ready: true, alive: true,
    isHost: seatIndex === 0, office, isPresidentialCandidate: false, isChancellorCandidate: false, hasVoted: false,
    avatar: avatarForSeat(seatIndex),
  });
  const election = { electionId: 'e1', presidentId: 'p1', chancellorId: 'p2', outcome: 'elected' as const, votes: [] };
  // The authoritative view drops `office` as soon as the round advances to
  // nomination, but the public discard belongs to the government that just acted.
  const nomination: SceneView = {
    ...view, phase: 'nomination', players: [seat('p1', 0, 'none'), seat('p2', 1, 'none')],
    table: { ...view.table, lastElection: election },
    privateView: { ...view.privateView, hand: [] },
  };
  const moved: SceneCue = { cueId: 'm', gameId: 'demo', revision: 8, kind: 'cards_moved', count: 1, from: 'chancellor', to: 'discard' };

  it('accepts the chancellor discard once offices are already cleared', () => {
    expect(cueMatchesView(moved, nomination)).toBe(true);
    expect(cueOfficePlayerId(nomination, 'chancellor')).toBe('p2');
    expect(cueOfficePlayerId(nomination, 'president')).toBe('p1');
    expect(cueOfficePlayerId(nomination, 'deck')).toBeUndefined();
    expect(cueOfficePlayerId(nomination, 'discard')).toBeUndefined();
    expect(new CueLedger().update(nomination, [moved], 0, true, false).added).toHaveLength(1);
  });

  it('prefers the current office over the last election', () => {
    const special: SceneView = { ...nomination, players: [...nomination.players, seat('p3', 2, 'president')] };
    expect(cueOfficePlayerId(special, 'president')).toBe('p3');
    expect(cueOfficePlayerId(special, 'chancellor')).toBe('p2');
  });

  it('never invents a seat: rejected, missing or absent election is not a fallback', () => {
    const rejected = { ...nomination, table: { ...nomination.table, lastElection: { ...election, outcome: 'rejected' as const } } };
    expect(cueMatchesView(moved, rejected)).toBe(false);
    expect(cueMatchesView(moved, { ...nomination, table: { ...nomination.table, lastElection: null } })).toBe(false);
    expect(cueMatchesView(moved, { ...nomination, players: [seat('p1', 0, 'none')] })).toBe(false);
  });

  it('still bounds the count and keeps deck/discard endpoints free of a seat', () => {
    expect(cueMatchesView({ ...moved, count: 0 }, nomination)).toBe(false);
    expect(cueMatchesView({ ...moved, count: 18 }, nomination)).toBe(false);
    expect(cueMatchesView({ ...moved, count: 1.5 }, nomination)).toBe(false);
    expect(cueMatchesView({ ...moved, from: 'deck', to: 'president', count: 3 }, { ...nomination, table: { ...nomination.table, lastElection: null }, players: [seat('p1', 0, 'president'), seat('p2', 1, 'none')] })).toBe(true);
  });
});
