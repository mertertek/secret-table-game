import type { RevealedRole, SceneCue } from '@secret-table/contracts';

import type { SceneFixture } from '../types';
import { makePlayers, makeView } from '../builders';

const players = makePlayers({ count: 7 });

const revealedRoles: readonly RevealedRole[] = [
  { playerId: 'p1', role: 'liberal' },
  { playerId: 'p2', role: 'fascist' },
  { playerId: 'p3', role: 'hitler' },
  { playerId: 'p4', role: 'liberal' },
  { playerId: 'p5', role: 'liberal' },
  { playerId: 'p6', role: 'fascist' },
  { playerId: 'p7', role: 'liberal' },
];

const gameEnded: SceneCue = {
  cueId: 'cue_end_1',
  gameId: 'game_demo',
  revision: 60,
  kind: 'game_ended',
  winner: 'liberal',
  reason: 'hitler_executed',
};

export const gameOverLiberalFixture: SceneFixture = {
  id: 'game-over-liberal',
  title: 'Oyun sonu — liberaller kazandı',
  description: 'Hitler infaz edildi. result kazananı, nedeni ve açıklanan rolleri taşır. Yeniden oynama HTML katmanında.',
  view: makeView({
    phase: 'game_over',
    phaseId: 'game_over_1',
    revision: 60,
    localPlayerId: 'p4',
    players: makePlayers({
      count: 7,
      overrides: { 2: { alive: false } },
    }),
    table: {
      liberalPolicies: 4,
      fascistPolicies: 5,
      drawCount: 3,
      discardCount: 9,
      publicHistory: [{ entryId: 'h_exec_1', kind: 'player_executed', targetId: 'p3' }],
    },
    result: { winner: 'liberal', reason: 'hitler_executed', revealedRoles },
  }),
  cues: [gameEnded],
  selection: null,
};

export const gameOverFascistFixture: SceneFixture = {
  id: 'game-over-fascist',
  title: 'Oyun sonu — faşistler kazandı',
  description: '6 faşist politika yürürlüğe girdi. Farklı kazanan ve neden.',
  view: makeView({
    phase: 'game_over',
    phaseId: 'game_over_1',
    revision: 58,
    localPlayerId: 'p4',
    players,
    table: { liberalPolicies: 3, fascistPolicies: 6, drawCount: 1, discardCount: 10 },
    result: { winner: 'fascist', reason: 'fascist_policies_enacted', revealedRoles },
  }),
  cues: [],
  selection: null,
};

// --- Kesintiler ------------------------------------------------------------

export const disconnectedPeerFixture: SceneFixture = {
  id: 'disconnected-peer',
  title: 'Duraklama — başka oyuncu çevrimdışı',
  description:
    'Benim bağlantım açık (reconnecting değil) ama gerekli oyuncu offline. paused dolu, aksiyonlar durdu.',
  view: makeView({
    phase: 'voting',
    phaseId: 'voting_2',
    revision: 44,
    connection: 'connected',
    localPlayerId: 'p2',
    players: makePlayers({
      count: 7,
      overrides: { 4: { connected: false } },
    }),
    paused: { reason: 'player_offline', waitingForPlayerIds: ['p5'] },
    table: { liberalPolicies: 2, fascistPolicies: 2, drawCount: 12, discardCount: 3 },
    actions: [],
  }),
  cues: [],
  selection: null,
};

export const reconnectingSelfFixture: SceneFixture = {
  id: 'reconnecting-self',
  title: 'Bağlantı — kendim yeniden bağlanıyorum',
  description: 'connection reconnecting: işlem düğmeleri durur, sahne son görünümü tutar.',
  view: makeView({
    phase: 'nomination',
    phaseId: 'nomination_5',
    revision: 45,
    connection: 'reconnecting',
    localPlayerId: 'p2',
    players: makePlayers({
      count: 7,
      overrides: { 0: { isPresidentialCandidate: true } },
    }),
    table: { liberalPolicies: 2, fascistPolicies: 2, drawCount: 12, discardCount: 3 },
    actions: [],
  }),
  cues: [],
  selection: null,
};
