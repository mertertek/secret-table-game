/**
 * D5 — baş üstü oy rozetinin saf karar katmanı.
 *
 * R3F yok: yalnız `voteBadgeState` girdileri ve çıktısı sınanır. Kural,
 * gizlilik (yalnız kamu alanları) ve görünürlük penceresi buradadır.
 */
import { describe, expect, it } from 'vitest';
import type { PlayerView, PublicElection, SceneView } from '@secret-table/contracts';
import { avatarForSeat } from '@secret-table/contracts';
import { VOTE_REVEAL_MS, voteBadgeKey, voteBadgeLabel, voteBadgeState } from './voteState';

const players = (count: number): PlayerView[] => Array.from({ length: count }, (_, seatIndex) => ({
  playerId: `p${seatIndex}`, seatIndex, displayName: `Oyuncu ${seatIndex}`, connected: true, ready: false,
  alive: true, isHost: seatIndex === 0, office: 'none', isPresidentialCandidate: false,
  isChancellorCandidate: false, hasVoted: false, avatar: avatarForSeat(seatIndex),
}));

const election: PublicElection = {
  electionId: 'elec_1', presidentId: 'p0', chancellorId: 'p1', outcome: 'elected',
  votes: [
    { playerId: 'p0', vote: 'yes' }, { playerId: 'p1', vote: 'yes' }, { playerId: 'p2', vote: 'no' },
    { playerId: 'p3', vote: 'yes' }, { playerId: 'p4', vote: 'no' },
  ],
};

const view = (overrides: Partial<SceneView> = {}): SceneView => ({
  protocolVersion: 1, roomId: 'synthetic', gameId: 'synthetic-game', revision: 1, phaseId: 'phase-1',
  phase: 'voting', connection: 'connected', paused: null, playerCountAtStart: 5, boardVariant: 'small',
  localPlayerId: 'p0', players: players(5),
  table: { liberalPolicies: 0, fascistPolicies: 0, electionTracker: 0, drawCount: 17, discardCount: 0,
    enactedPolicies: [], lastElection: null, currentPower: null, publicHistory: [] },
  privateView: { role: 'liberal', knownPlayers: [], hand: [], submittedVote: 'no', inspection: null },
  actions: [], result: null, ...overrides,
});

const at = (v: SceneView, id: string, now = 0, revealedAt: number | null = null) => {
  const player = v.players.find((p) => p.playerId === id)!;
  return voteBadgeState({ view: v, player, local: player.playerId === v.localPlayerId, now, revealedAt });
};

describe('voteBadgeState — oylama', () => {
  it('oy veren için tik, vermeyen için soluk bekleme rozeti', () => {
    const list = players(5);
    list[1] = { ...list[1]!, hasVoted: true };
    const current = view({ players: list, localPlayerId: 'p0' });
    expect(at(current, 'p1')).toEqual({ kind: 'voted' });
    expect(at(current, 'p2')).toEqual({ kind: 'waiting' });
  });

  it('ölen oyuncuda rozet yok', () => {
    const list = players(5);
    list[3] = { ...list[3]!, alive: false, hasVoted: false };
    expect(at(view({ players: list }), 'p3')).toBeNull();
  });

  it('yerel oyuncunun kendi rozeti çizilmez (HUD söyler)', () => {
    const list = players(5);
    list[0] = { ...list[0]!, hasVoted: true };
    expect(at(view({ players: list, localPlayerId: 'p0' }), 'p0')).toBeNull();
  });

  it('yalnız kamu alanı okunur: submittedVote rozete sızmaz', () => {
    const list = players(5);
    list[1] = { ...list[1]!, hasVoted: true };
    const current = view({ players: list, privateView: { role: 'liberal', knownPlayers: [], hand: [], submittedVote: 'yes', inspection: null } });
    expect(voteBadgeLabel(at(current, 'p1')!)).toBe('OY VERDİ');
  });
});

describe('voteBadgeState — sonuç', () => {
  const resulting = (phase: SceneView['phase']) =>
    view({ phase, localPlayerId: 'p0', table: { ...view().table, lastElection: election } });

  it('election_result aşamasında evet/hayır rozeti gösterir', () => {
    const current = resulting('election_result');
    expect(at(current, 'p1')).toEqual({ kind: 'vote', vote: 'yes' });
    expect(at(current, 'p2')).toEqual({ kind: 'vote', vote: 'no' });
    expect(voteBadgeLabel({ kind: 'vote', vote: 'yes' })).toBe('EVET');
    expect(voteBadgeLabel({ kind: 'vote', vote: 'no' })).toBe('HAYIR');
  });

  it('aşama ilerlese de açılıştan sonra en az 5 sn görünür', () => {
    const current = resulting('president_discard');
    expect(at(current, 'p1', 1_000, 1_000)).toEqual({ kind: 'vote', vote: 'yes' });
    expect(at(current, 'p1', 1_000 + VOTE_REVEAL_MS - 1, 1_000)).toEqual({ kind: 'vote', vote: 'yes' });
    expect(at(current, 'p1', 1_000 + VOTE_REVEAL_MS, 1_000)).toBeNull();
  });

  it('cue görülmediyse (yeniden bağlanma) eski seçim rozet açmaz', () => {
    expect(at(resulting('president_discard'), 'p1', 9_999, null)).toBeNull();
  });

  it('oy listesinde olmayan (o turda ölü) oyuncuda rozet yok', () => {
    const current = resulting('election_result');
    expect(at(current, 'p0')).toBeNull(); // yerel
    const watcher = { ...current, localPlayerId: 'p4' };
    const absent: PlayerView = { ...players(6)[5]!, playerId: 'p9', seatIndex: 5 };
    expect(voteBadgeState({ view: watcher, player: absent, local: false, now: 0, revealedAt: 0 })).toBeNull();
  });

  it('yeni oylama başladıysa önceki seçimin penceresi geçersizdir', () => {
    const list = players(5);
    list[1] = { ...list[1]!, hasVoted: false };
    const current = view({ phase: 'voting', players: list, table: { ...view().table, lastElection: election } });
    expect(at(current, 'p1', 500, 400)).toEqual({ kind: 'waiting' });
  });
});

describe('voteBadgeKey', () => {
  it('durum değişince kimlik değişir (giriş animasyonu yeniden oynar)', () => {
    expect(voteBadgeKey({ kind: 'waiting' })).not.toBe(voteBadgeKey({ kind: 'voted' }));
    expect(voteBadgeKey({ kind: 'vote', vote: 'yes' })).not.toBe(voteBadgeKey({ kind: 'vote', vote: 'no' }));
  });
});
