/**
 * Saf oyun motoru — resmî Secret Hitler kuralları, 5-10 oyuncu.
 *
 * `applyCommand(state, command)` girdi durumunu değiştirmez; `structuredClone`
 * ile kopya alır, kopyayı işler ve döndürür. Geçersiz komutlarda durum
 * değişmeden `{ ok: false, code }` döner (sunucu bunu ağ hatasına eşler).
 *
 * Kaynak: https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf
 */

import type { ExecutivePower, GameEndReason, Party, VoteValue } from '@secret-table/contracts';
import { ELECTION_TRACKER_MAX, PRESIDENT_DRAW_COUNT } from '@secret-table/contracts';

import type { EngineCommand } from './commands';
import { EngineError } from './errors';
import type { EngineErrorCode } from './errors';
import type { GameEvent } from './events';
import { createRng, shuffle } from './rng';
import { eligibleChancellorIds } from './selectors';
import type {
  DealtCard,
  DistributiveOmit,
  EnginePlayer,
  GameLogEntry,
  GameState,
  Government,
  PolicyCard,
  PublicVoteRecord,
} from './types';

export type ApplyOutcome = { state: GameState; events: GameEvent[] };

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; code: EngineErrorCode };

export function applyCommand(state: GameState, command: EngineCommand): ApplyResult {
  const s = structuredClone(state);
  const events: GameEvent[] = [];

  try {
    if (s.phase.kind === 'game_over') throw new EngineError('GAME_OVER');
    if (!s.players.some((p) => p.playerId === command.playerId)) {
      throw new EngineError('NOT_A_PLAYER');
    }

    switch (command.type) {
      case 'ack_role':
        handleAckRole(s, events, command.playerId);
        break;
      case 'nominate':
        handleNominate(s, events, command.playerId, command.chancellorId);
        break;
      case 'vote':
        handleVote(s, events, command.playerId, command.vote);
        break;
      case 'discard_policy':
        handleDiscardPolicy(s, events, command.playerId, command.cardId);
        break;
      case 'enact_policy':
        handleEnactPolicy(s, events, command.playerId, command.cardId);
        break;
      case 'request_veto':
        handleRequestVeto(s, events, command.playerId);
        break;
      case 'respond_veto':
        handleRespondVeto(s, events, command.playerId, command.accept);
        break;
      case 'use_power':
        handleUsePower(s, events, command.playerId, command.targetId);
        break;
      case 'ack_private_result':
        handleAckPrivateResult(s, events, command.playerId);
        break;
      default: {
        const _exhaustive: never = command;
        void _exhaustive;
        throw new EngineError('WRONG_PHASE');
      }
    }

    s.revision += 1;
    return { ok: true, state: s, events };
  } catch (error) {
    if (error instanceof EngineError) {
      return { ok: false, code: error.code };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Ortak yardımcılar
// ---------------------------------------------------------------------------

function player(s: GameState, id: string): EnginePlayer {
  const found = s.players.find((p) => p.playerId === id);
  if (!found) throw new EngineError('NOT_A_PLAYER');
  return found;
}

function aliveCount(s: GameState): number {
  return s.players.filter((p) => p.alive).length;
}

function nextAliveSeatAfter(s: GameState, seat: number): number {
  const n = s.players.length;
  for (let step = 1; step <= n; step += 1) {
    const idx = (seat + step) % n;
    if (s.players[idx]?.alive) return idx;
  }
  throw new Error('engine: hayatta oyuncu yok');
}

function normalizePresidentSeat(s: GameState): void {
  if (!s.players[s.presidentSeat]?.alive) {
    s.presidentSeat = nextAliveSeatAfter(s, s.presidentSeat);
  }
}

function nextSeq(s: GameState): number {
  const value = s.seq;
  s.seq += 1;
  return value;
}

function bumpPhase(s: GameState): void {
  s.phaseSeq += 1;
}

function pushLog(s: GameState, entry: DistributiveOmit<GameLogEntry, 'seq'>): void {
  s.log.push({ seq: nextSeq(s), ...entry } as GameLogEntry);
}

function ensureDeck(s: GameState, needed: number): void {
  if (s.deck.length >= needed) return;
  const seed = (s.deckSeed ^ Math.imul(0x9e3779b9, s.reshuffles + 1)) >>> 0;
  s.deck = shuffle(s.deck.concat(s.discard), createRng(seed));
  s.discard = [];
  s.reshuffles += 1;
}

function dealCards(s: GameState, cards: readonly PolicyCard[]): DealtCard[] {
  return cards.map((policy, index) => ({ cardId: `c${s.phaseSeq}_${index}`, policy }));
}

// ---------------------------------------------------------------------------
// Aşama akışı
// ---------------------------------------------------------------------------

function startNomination(s: GameState, _events: GameEvent[]): void {
  let presidentId: string;
  if (s.specialElection) {
    presidentId = s.specialElection.presidentId;
  } else {
    normalizePresidentSeat(s);
    presidentId = s.players[s.presidentSeat]?.playerId ?? '';
  }
  bumpPhase(s);
  s.phase = { kind: 'nomination', presidentId };
}

function advanceRotation(s: GameState): void {
  if (s.specialElection) {
    s.presidentSeat = s.specialElection.returnToSeat;
    s.specialElection = null;
    normalizePresidentSeat(s);
  } else {
    s.presidentSeat = nextAliveSeatAfter(s, s.presidentSeat);
  }
}

function concludeRound(s: GameState, events: GameEvent[]): void {
  advanceRotation(s);
  startNomination(s, events);
}

function endGame(s: GameState, events: GameEvent[], winner: Party, reason: GameEndReason): void {
  s.winner = winner;
  s.endReason = reason;
  bumpPhase(s);
  s.phase = { kind: 'game_over', winner, reason };
  pushLog(s, { kind: 'game_over', winner, reason });
  events.push({ kind: 'game_ended', winner, reason });
}

/** Politika yürürlüğe girer. `true` -> oyun bitti. */
function enactPolicy(
  s: GameState,
  events: GameEvent[],
  policy: PolicyCard,
  chaos: boolean,
): boolean {
  let board: 'liberal' | 'fascist';
  let slotIndex: number;
  if (policy === 'liberal') {
    s.liberalPolicies += 1;
    slotIndex = s.liberalPolicies - 1;
    board = 'liberal';
  } else {
    s.fascistPolicies += 1;
    slotIndex = s.fascistPolicies - 1;
    board = 'fascist';
  }
  s.enactedPolicies.push({ board, slotIndex, policy });
  s.electionTracker = 0;

  if (chaos) {
    s.lastGovernment = null;
    pushLog(s, { kind: 'chaos_policy', policy });
  } else {
    pushLog(s, { kind: 'policy_enacted', board, policy });
  }
  events.push({ kind: 'policy_enacted', board, slotIndex, policy });

  if (s.liberalPolicies >= s.layout.liberalSlots) {
    endGame(s, events, 'liberal', 'liberal_policies_enacted');
    return true;
  }
  if (s.fascistPolicies >= s.layout.fascistSlots) {
    endGame(s, events, 'fascist', 'fascist_policies_enacted');
    return true;
  }
  return false;
}

function failElection(s: GameState, events: GameEvent[]): void {
  s.electionTracker += 1;
  pushLog(s, { kind: 'election_tracker', tracker: s.electionTracker });
  if (s.electionTracker >= ELECTION_TRACKER_MAX) {
    chaosPolicy(s, events);
    return;
  }
  advanceRotation(s);
  startNomination(s, events);
}

function chaosPolicy(s: GameState, events: GameEvent[]): void {
  ensureDeck(s, 1);
  const top = s.deck.shift();
  if (!top) throw new Error('engine: deste boş (kaos)');
  const ended = enactPolicy(s, events, top, true);
  if (ended) return;
  advanceRotation(s);
  startNomination(s, events);
}

function resolveVote(s: GameState, events: GameEvent[]): void {
  if (s.phase.kind !== 'voting') return;
  const phase = s.phase;

  const aliveIds = s.players.filter((p) => p.alive).map((p) => p.playerId);
  const votes: PublicVoteRecord[] = aliveIds.map((id) => ({
    playerId: id,
    vote: phase.votes[id] as VoteValue,
  }));
  const yes = votes.filter((v) => v.vote === 'yes').length;
  const elected = yes * 2 > aliveIds.length;
  const outcome: 'elected' | 'rejected' = elected ? 'elected' : 'rejected';
  const electionId = `elec_${nextSeq(s)}`;

  s.lastElection = {
    electionId,
    presidentId: phase.presidentId,
    chancellorId: phase.chancellorId,
    outcome,
    votes,
  };
  pushLog(s, { kind: 'election', electionId, outcome });
  events.push({ kind: 'votes_revealed', electionId, outcome, votes: votes.map((v) => ({ ...v })) });

  if (!elected) {
    failElection(s, events);
    return;
  }

  const government: Government = {
    presidentId: phase.presidentId,
    chancellorId: phase.chancellorId,
  };
  s.lastGovernment = { ...government };
  events.push({ kind: 'office_moved', office: 'president', toPlayerId: government.presidentId });
  events.push({ kind: 'office_moved', office: 'chancellor', toPlayerId: government.chancellorId });

  const chancellor = player(s, government.chancellorId);
  if (chancellor.role === 'hitler' && s.fascistPolicies >= s.layout.hitlerChancellorWinAt) {
    endGame(s, events, 'fascist', 'hitler_elected_chancellor');
    return;
  }

  ensureDeck(s, PRESIDENT_DRAW_COUNT);
  const drawn = s.deck.slice(0, PRESIDENT_DRAW_COUNT);
  s.deck = s.deck.slice(PRESIDENT_DRAW_COUNT);
  bumpPhase(s);
  s.phase = { kind: 'legislative_president', government, drawnCards: dealCards(s, drawn) };
  // Kapalı hareket herkese; açık el yalnız başkana.
  events.push({ kind: 'cards_moved', count: drawn.length, from: 'deck', to: 'president' });
  events.push({ kind: 'cards_dealt', toPlayerId: government.presidentId, cards: drawn });
}

/** Faşist politika sonrası yetki varsa yürütme aşamasına geçir, yoksa turu bitir. */
function afterFascistPolicy(s: GameState, events: GameEvent[], government: Government): void {
  const power: ExecutivePower | 'none' = s.layout.fascistPowers[s.fascistPolicies - 1] ?? 'none';
  if (power === 'none') {
    concludeRound(s, events);
    return;
  }
  bumpPhase(s);
  s.phase = {
    kind: 'executive_action',
    government,
    power,
    inspection: null,
    targetId: null,
    resolved: false,
  };
}

// ---------------------------------------------------------------------------
// Komut işleyicileri
// ---------------------------------------------------------------------------

function handleAckRole(s: GameState, events: GameEvent[], playerId: string): void {
  if (s.phase.kind !== 'role_reveal') throw new EngineError('WRONG_PHASE');
  if (s.phase.ackedPlayerIds.includes(playerId)) throw new EngineError('ALREADY_ACKED');
  s.phase.ackedPlayerIds.push(playerId);
  if (s.phase.ackedPlayerIds.length >= s.players.length) {
    startNomination(s, events);
  }
}

function handleNominate(
  s: GameState,
  events: GameEvent[],
  playerId: string,
  chancellorId: string,
): void {
  if (s.phase.kind !== 'nomination') throw new EngineError('WRONG_PHASE');
  if (s.phase.presidentId !== playerId) throw new EngineError('NOT_YOUR_TURN');

  const target = s.players.find((p) => p.playerId === chancellorId);
  if (!target) throw new EngineError('INVALID_TARGET');
  if (target.playerId === playerId) throw new EngineError('INVALID_TARGET');
  if (!target.alive) throw new EngineError('PLAYER_DEAD');

  if (!eligibleChancellorIds(s, playerId).includes(target.playerId)) {
    throw new EngineError('INELIGIBLE_CHANCELLOR');
  }

  pushLog(s, { kind: 'nomination', presidentId: playerId, chancellorId });
  bumpPhase(s);
  s.phase = { kind: 'voting', presidentId: playerId, chancellorId, votes: {} };
  void events;
}

function handleVote(
  s: GameState,
  events: GameEvent[],
  playerId: string,
  vote: VoteValue,
): void {
  if (s.phase.kind !== 'voting') throw new EngineError('WRONG_PHASE');
  if (!player(s, playerId).alive) throw new EngineError('PLAYER_DEAD');
  if (s.phase.votes[playerId] !== undefined) throw new EngineError('ALREADY_VOTED');

  s.phase.votes[playerId] = vote;
  if (Object.keys(s.phase.votes).length >= aliveCount(s)) {
    resolveVote(s, events);
  }
}

function handleDiscardPolicy(
  s: GameState,
  events: GameEvent[],
  playerId: string,
  cardId: string,
): void {
  if (s.phase.kind !== 'legislative_president') throw new EngineError('WRONG_PHASE');
  if (s.phase.government.presidentId !== playerId) throw new EngineError('NOT_YOUR_TURN');

  const index = s.phase.drawnCards.findIndex((c) => c.cardId === cardId);
  if (index === -1) throw new EngineError('UNKNOWN_CARD');

  const [discarded] = s.phase.drawnCards.splice(index, 1);
  if (!discarded) throw new EngineError('UNKNOWN_CARD');
  s.discard.push(discarded.policy);

  const remaining = s.phase.drawnCards.map((c) => c.policy);
  const government = s.phase.government;
  bumpPhase(s);
  s.phase = {
    kind: 'legislative_chancellor',
    government,
    handCards: dealCards(s, remaining),
    vetoRequested: false,
  };
  events.push({ kind: 'cards_moved', count: 1, from: 'president', to: 'discard' });
  if (remaining.length > 0) {
    events.push({ kind: 'cards_moved', count: remaining.length, from: 'president', to: 'chancellor' });
  }
  events.push({ kind: 'cards_dealt', toPlayerId: government.chancellorId, cards: remaining });
}

function handleEnactPolicy(
  s: GameState,
  events: GameEvent[],
  playerId: string,
  cardId: string,
): void {
  if (s.phase.kind !== 'legislative_chancellor') throw new EngineError('WRONG_PHASE');
  if (s.phase.government.chancellorId !== playerId) throw new EngineError('NOT_YOUR_TURN');

  const chosen = s.phase.handCards.find((c) => c.cardId === cardId);
  if (!chosen) throw new EngineError('UNKNOWN_CARD');

  const government = s.phase.government;
  let discarded = 0;
  for (const card of s.phase.handCards) {
    if (card.cardId !== cardId) {
      s.discard.push(card.policy);
      discarded += 1;
    }
  }
  if (discarded > 0) {
    events.push({ kind: 'cards_moved', count: discarded, from: 'chancellor', to: 'discard' });
  }

  const ended = enactPolicy(s, events, chosen.policy, false);
  if (ended) return;

  if (chosen.policy === 'fascist') {
    afterFascistPolicy(s, events, government);
  } else {
    concludeRound(s, events);
  }
}

function handleRequestVeto(s: GameState, events: GameEvent[], playerId: string): void {
  if (s.phase.kind !== 'legislative_chancellor') throw new EngineError('WRONG_PHASE');
  if (s.phase.government.chancellorId !== playerId) throw new EngineError('NOT_YOUR_TURN');
  if (s.fascistPolicies < s.layout.vetoUnlockAt) throw new EngineError('VETO_NOT_AVAILABLE');
  if (s.phase.vetoRequested) throw new EngineError('VETO_NOT_AVAILABLE');

  const government = s.phase.government;
  const handCards = s.phase.handCards;
  bumpPhase(s);
  s.phase = { kind: 'veto_response', government, handCards };
  void events;
}

function handleRespondVeto(
  s: GameState,
  events: GameEvent[],
  playerId: string,
  accept: boolean,
): void {
  if (s.phase.kind !== 'veto_response') throw new EngineError('WRONG_PHASE');
  if (s.phase.government.presidentId !== playerId) throw new EngineError('NOT_YOUR_TURN');

  const government = s.phase.government;
  const handCards = s.phase.handCards;

  if (accept) {
    for (const card of handCards) s.discard.push(card.policy);
    if (handCards.length > 0) {
      events.push({ kind: 'cards_moved', count: handCards.length, from: 'chancellor', to: 'discard' });
    }
    pushLog(s, { kind: 'veto_enacted' });
    failElection(s, events);
    return;
  }

  bumpPhase(s);
  s.phase = {
    kind: 'legislative_chancellor',
    government,
    handCards: dealCards(
      s,
      handCards.map((c) => c.policy),
    ),
    vetoRequested: true,
  };
}

function handleUsePower(
  s: GameState,
  events: GameEvent[],
  playerId: string,
  targetId: string | undefined,
): void {
  if (s.phase.kind !== 'executive_action') throw new EngineError('WRONG_PHASE');
  if (s.phase.government.presidentId !== playerId) throw new EngineError('NOT_YOUR_TURN');
  if (s.phase.resolved) throw new EngineError('WRONG_PHASE');

  const phase = s.phase;
  const presidentId = phase.government.presidentId;

  const requireTarget = (): EnginePlayer => {
    if (!targetId) throw new EngineError('POWER_NEEDS_TARGET');
    const target = s.players.find((p) => p.playerId === targetId);
    if (!target) throw new EngineError('INVALID_TARGET');
    if (target.playerId === presidentId) throw new EngineError('INVALID_TARGET');
    if (!target.alive) throw new EngineError('PLAYER_DEAD');
    return target;
  };

  switch (phase.power) {
    case 'investigate_loyalty': {
      const target = requireTarget();
      // D18/B1 — "No player may be investigated twice in the same game":
      // teklik BAŞKANDAN BAĞIMSIZ (bkz. investigatableTargetIds).
      if (s.investigations.some((i) => i.targetId === target.playerId)) {
        throw new EngineError('INVALID_TARGET');
      }
      const party: Party = target.role === 'liberal' ? 'liberal' : 'fascist';
      s.investigations.push({ actorId: presidentId, targetId: target.playerId, party });
      pushLog(s, {
        kind: 'power_used',
        power: 'investigate_loyalty',
        actorId: presidentId,
        targetId: target.playerId,
      });
      phase.inspection = { kind: 'party_membership', targetId: target.playerId, party };
      phase.targetId = target.playerId;
      phase.resolved = true;
      break;
    }
    case 'policy_peek': {
      if (targetId) throw new EngineError('POWER_HAS_NO_TARGET');
      ensureDeck(s, PRESIDENT_DRAW_COUNT);
      const cards = s.deck.slice(0, PRESIDENT_DRAW_COUNT);
      pushLog(s, { kind: 'power_used', power: 'policy_peek', actorId: presidentId, targetId: null });
      phase.inspection = { kind: 'policy_peek', cards };
      phase.resolved = true;
      break;
    }
    case 'call_special_election': {
      const target = requireTarget();
      s.specialElection = {
        presidentId: target.playerId,
        returnToSeat: nextAliveSeatAfter(s, player(s, presidentId).seatIndex),
      };
      pushLog(s, {
        kind: 'power_used',
        power: 'call_special_election',
        actorId: presidentId,
        targetId: target.playerId,
      });
      phase.targetId = target.playerId;
      phase.resolved = true;
      startNomination(s, events);
      break;
    }
    case 'execution': {
      const target = requireTarget();
      target.alive = false;
      pushLog(s, {
        kind: 'power_used',
        power: 'execution',
        actorId: presidentId,
        targetId: target.playerId,
      });
      pushLog(s, { kind: 'player_executed', targetId: target.playerId });
      events.push({ kind: 'player_eliminated', playerId: target.playerId });
      phase.targetId = target.playerId;
      phase.resolved = true;
      if (target.role === 'hitler') {
        endGame(s, events, 'liberal', 'hitler_executed');
        return;
      }
      concludeRound(s, events);
      break;
    }
    default: {
      const _exhaustive: never = phase.power;
      void _exhaustive;
      throw new EngineError('WRONG_PHASE');
    }
  }
}

function handleAckPrivateResult(s: GameState, events: GameEvent[], playerId: string): void {
  if (s.phase.kind !== 'executive_action') throw new EngineError('WRONG_PHASE');
  if (!s.phase.resolved || s.phase.inspection === null) throw new EngineError('WRONG_PHASE');
  if (s.phase.government.presidentId !== playerId) throw new EngineError('NOT_YOUR_TURN');
  concludeRound(s, events);
}
