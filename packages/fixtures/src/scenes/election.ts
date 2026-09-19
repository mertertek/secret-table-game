import type { AllowedAction, PublicElection, SceneCue } from '@secret-table/contracts';

import type { SceneFixture } from '../types';
import { makePlayers, makeView } from '../builders';

// --- Adaylık ------------------------------------------------------------------

const nominate: AllowedAction = {
  actionId: 'act_nominate',
  kind: 'nominate',
  phaseId: 'nomination_1',
  requiresConfirmation: true,
  options: [
    { optionId: 'nom_p3', labelKey: 'player.name', targetPlayerId: 'p3' },
    { optionId: 'nom_p4', labelKey: 'player.name', targetPlayerId: 'p4' },
    { optionId: 'nom_p6', labelKey: 'player.name', targetPlayerId: 'p6' },
  ],
};

export const nominationFixture: SceneFixture = {
  id: 'nomination',
  title: 'Adaylık — başkan seçiyor',
  description:
    'Yerel oyuncu başkan adayı. nominate aksiyonu uygun şansölye adaylarını taşır; seçim ayrı onayla kesinleşir.',
  view: makeView({
    phase: 'nomination',
    phaseId: 'nomination_1',
    revision: 12,
    localPlayerId: 'p1',
    players: makePlayers({
      count: 7,
      overrides: { 0: { isPresidentialCandidate: true } },
    }),
    table: { liberalPolicies: 1, fascistPolicies: 1, drawCount: 14, discardCount: 1 },
    actions: [nominate],
  }),
  cues: [],
  selection: null,
};

// --- Oylama -----------------------------------------------------------------

const vote: AllowedAction = {
  actionId: 'act_vote',
  kind: 'vote',
  phaseId: 'voting_1',
  requiresConfirmation: false,
  options: [
    { optionId: 'vote_yes', labelKey: 'vote.yes', vote: 'yes' },
    { optionId: 'vote_no', labelKey: 'vote.no', vote: 'no' },
  ],
};

// Yerel oyuncu p4 (koltuk 3) HENÜZ oy vermedi: elinde iki oy kartı durur.
const votingPlayers = makePlayers({
  count: 7,
  overrides: {
    0: { isPresidentialCandidate: true, hasVoted: true },
    2: { isChancellorCandidate: true, hasVoted: true },
    4: { hasVoted: true },
    5: { hasVoted: true },
  },
});

export const votingFixture: SceneFixture = {
  id: 'voting',
  title: 'Oylama — oy bekleniyor',
  description:
    'Gizli oylama. hasVoted yalnızca gönderim durumunu gösterir. Yerel oyuncu henüz oy vermedi.',
  view: makeView({
    phase: 'voting',
    phaseId: 'voting_1',
    revision: 13,
    localPlayerId: 'p4',
    players: votingPlayers,
    table: { liberalPolicies: 1, fascistPolicies: 1, drawCount: 14, discardCount: 1 },
    actions: [vote],
  }),
  cues: [],
  selection: null,
};

export const votingSubmittedFixture: SceneFixture = {
  id: 'voting-submitted',
  title: 'Oylama — oy verildi',
  description: 'Yerel oyuncu oyunu gönderdi. submittedVote dolu, aksiyon listesi boş.',
  view: makeView({
    phase: 'voting',
    phaseId: 'voting_1',
    revision: 13,
    localPlayerId: 'p4',
    players: makePlayers({
      count: 7,
      overrides: {
        0: { isPresidentialCandidate: true, hasVoted: true },
        2: { isChancellorCandidate: true, hasVoted: true },
        3: { hasVoted: true },
      },
    }),
    table: { liberalPolicies: 1, fascistPolicies: 1, drawCount: 14, discardCount: 1 },
    privateView: { submittedVote: 'yes' },
    actions: [],
  }),
  cues: [],
  selection: null,
};

/**
 * D5 — baş üstü rozetleri için: yerel oyuncu oyunu verdi, bir koltuk elendi,
 * iki koltuk hâlâ bekliyor. Rozet durumları tek karede görünür.
 */
export const votingWaitingFixture: SceneFixture = {
  id: 'voting-waiting',
  title: 'Oylama — kısmen oy verildi',
  description:
    'Yerel oyuncu (p1) oyunu gönderdi; Deniz ve Ada bekleniyor; Barış elendiği için oy kullanmıyor. Baş üstü rozetleri: tik / soluk bekleme.',
  view: makeView({
    phase: 'voting',
    phaseId: 'voting_2',
    revision: 17,
    localPlayerId: 'p1',
    players: makePlayers({
      count: 7,
      overrides: {
        0: { hasVoted: true },
        1: { isPresidentialCandidate: true, hasVoted: true },
        3: { isChancellorCandidate: true, hasVoted: true },
        4: { hasVoted: true },
        5: { alive: false },
      },
    }),
    table: { liberalPolicies: 2, fascistPolicies: 1, drawCount: 11, discardCount: 4, electionTracker: 1 },
    privateView: { submittedVote: 'yes' },
    actions: [],
  }),
  cues: [],
  selection: null,
};

// --- Seçim sonucu --------------------------------------------------------------

const lastElection: PublicElection = {
  electionId: 'elec_3',
  presidentId: 'p1',
  chancellorId: 'p3',
  outcome: 'elected',
  votes: [
    { playerId: 'p1', vote: 'yes' },
    { playerId: 'p2', vote: 'yes' },
    { playerId: 'p3', vote: 'yes' },
    { playerId: 'p4', vote: 'no' },
    { playerId: 'p5', vote: 'yes' },
    { playerId: 'p6', vote: 'no' },
    { playerId: 'p7', vote: 'yes' },
  ],
};

const votesRevealed: SceneCue = {
  cueId: 'cue_votes_3',
  gameId: 'game_demo',
  revision: 14,
  kind: 'votes_revealed',
  electionId: 'elec_3',
  outcome: 'elected',
  votes: lastElection.votes,
};

export const electionResultFixture: SceneFixture = {
  id: 'election-result',
  title: 'Seçim sonucu — hükümet kuruldu',
  description: 'Oylar birlikte açıldı. lastElection kişi başı oyları taşır; votes_revealed cue oynatılır.',
  view: makeView({
    phase: 'election_result',
    phaseId: 'election_result_3',
    revision: 14,
    localPlayerId: 'p4',
    players: makePlayers({
      count: 7,
      overrides: {
        0: { office: 'president', isPresidentialCandidate: true, hasVoted: true },
        2: { office: 'chancellor', isChancellorCandidate: true, hasVoted: true },
        1: { hasVoted: true },
        3: { hasVoted: true },
        4: { hasVoted: true },
        5: { hasVoted: true },
        6: { hasVoted: true },
      },
    }),
    table: {
      liberalPolicies: 1,
      fascistPolicies: 1,
      drawCount: 14,
      discardCount: 1,
      lastElection,
      publicHistory: [
        { entryId: 'h_nom_3', kind: 'nomination', presidentId: 'p1', chancellorId: 'p3' },
        { entryId: 'h_elec_3', kind: 'election', electionId: 'elec_3', outcome: 'elected' },
      ],
    },
    actions: [],
  }),
  cues: [votesRevealed],
  selection: null,
};

// --- Seçim sonucu (kıl payı 4/3) ------------------------------------------------

/** D5 — HUD sayacı ve isim listesi için dört evet / üç hayır örneği. */
const closeElection: PublicElection = {
  electionId: 'elec_4',
  presidentId: 'p2',
  chancellorId: 'p5',
  outcome: 'elected',
  votes: [
    { playerId: 'p1', vote: 'yes' },
    { playerId: 'p2', vote: 'yes' },
    { playerId: 'p3', vote: 'no' },
    { playerId: 'p4', vote: 'no' },
    { playerId: 'p5', vote: 'yes' },
    { playerId: 'p6', vote: 'no' },
    { playerId: 'p7', vote: 'yes' },
  ],
};

export const electionResultCloseFixture: SceneFixture = {
  id: 'election-result-close',
  title: 'Seçim sonucu — 4 evet / 3 hayır',
  description:
    'Kıl payı kurulan hükümet. Her koltuğun üstünde EVET/HAYIR rozeti, üst şeritte sayaç ve isim listesi.',
  view: makeView({
    phase: 'election_result',
    phaseId: 'election_result_4',
    revision: 18,
    localPlayerId: 'p1',
    players: makePlayers({
      count: 7,
      overrides: {
        1: { office: 'president', isPresidentialCandidate: true, hasVoted: true },
        4: { office: 'chancellor', isChancellorCandidate: true, hasVoted: true },
        0: { hasVoted: true },
        2: { hasVoted: true },
        3: { hasVoted: true },
        5: { hasVoted: true },
        6: { hasVoted: true },
      },
    }),
    table: {
      liberalPolicies: 2,
      fascistPolicies: 1,
      drawCount: 11,
      discardCount: 4,
      electionTracker: 1,
      lastElection: closeElection,
      publicHistory: [
        { entryId: 'h_nom_4', kind: 'nomination', presidentId: 'p2', chancellorId: 'p5' },
        { entryId: 'h_elec_4', kind: 'election', electionId: 'elec_4', outcome: 'elected' },
      ],
    },
    actions: [],
  }),
  cues: [
    {
      cueId: 'cue_votes_4',
      gameId: 'game_demo',
      revision: 18,
      kind: 'votes_revealed',
      electionId: 'elec_4',
      outcome: 'elected',
      votes: closeElection.votes,
    },
  ],
  selection: null,
};
