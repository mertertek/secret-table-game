/**
 * Yalnız testler için sürücü yardımcıları. `index.ts` bunları dışa vermez;
 * paket derlemesine girmez.
 */

import type { SecretRole, VoteValue } from '@secret-table/contracts';

import { applyCommand } from './engine';
import type { EngineCommand } from './commands';
import { createGame } from './setup';
import type { CreateGameConfig } from './setup';
import type { GameState } from './types';

export type Pol = 'liberal' | 'fascist';

/**
 * `front` kartlarını destenin üstüne koyar, kalanı 6 liberal + 11 faşist olacak
 * şekilde doldurur (fazlalar sona faşist/liberal olarak eklenir).
 */
export function buildDeck(front: readonly Pol[]): Pol[] {
  const libFront = front.filter((c) => c === 'liberal').length;
  const fasFront = front.filter((c) => c === 'fascist').length;
  const libRest = 6 - libFront;
  const fasRest = 11 - fasFront;
  if (libRest < 0 || fasRest < 0) throw new Error('buildDeck: front 6L/11F sınırını aşıyor');
  return [
    ...front,
    ...Array.from({ length: libRest }, (): Pol => 'liberal'),
    ...Array.from({ length: fasRest }, (): Pol => 'fascist'),
  ];
}

export function seatList(count: number): { playerId: string; seatIndex: number }[] {
  return Array.from({ length: count }, (_unused, index) => ({
    playerId: `p${index + 1}`,
    seatIndex: index,
  }));
}

export function newGame(
  count: number,
  overrides?: CreateGameConfig['overrides'],
  seed = 12345,
): GameState {
  return createGame({ players: seatList(count), seed, overrides });
}

export function roles(map: Record<string, SecretRole>): Record<string, SecretRole> {
  return map;
}

export function apply(state: GameState, command: EngineCommand): GameState {
  const result = applyCommand(state, command);
  if (!result.ok) {
    throw new Error(`beklenen kabul, alınan hata: ${result.code} (komut: ${command.type})`);
  }
  return result.state;
}

export function expectReject(state: GameState, command: EngineCommand): string {
  const result = applyCommand(state, command);
  if (result.ok) {
    throw new Error(`beklenen ret, komut kabul edildi: ${command.type}`);
  }
  return result.code;
}

/** Her oyuncu rolünü onaylar; adaylık aşamasına geçer. */
export function ackAll(state: GameState): GameState {
  let next = state;
  for (const player of state.players) {
    next = apply(next, { type: 'ack_role', playerId: player.playerId });
  }
  return next;
}

export function currentPresidentId(state: GameState): string {
  const { phase } = state;
  if (phase.kind === 'nomination' || phase.kind === 'voting') return phase.presidentId;
  if (
    phase.kind === 'legislative_president' ||
    phase.kind === 'legislative_chancellor' ||
    phase.kind === 'veto_response' ||
    phase.kind === 'executive_action'
  ) {
    return phase.government.presidentId;
  }
  throw new Error(`bu aşamada başkan yok: ${phase.kind}`);
}

/** Adaylık + tüm hayatta oyuncuların oyu. `voteMap` verilmezse herkes 'yes'. */
export function runElection(
  state: GameState,
  chancellorId: string,
  voteMap?: Record<string, VoteValue>,
): GameState {
  const presidentId = currentPresidentId(state);
  let next = apply(state, { type: 'nominate', playerId: presidentId, chancellorId });
  for (const player of next.players.filter((p) => p.alive)) {
    const vote = voteMap?.[player.playerId] ?? 'yes';
    next = apply(next, { type: 'vote', playerId: player.playerId, vote });
  }
  return next;
}

/** Tur kısıtı ve hayatta olma kuralına uyan, başkan olmayan bir aday seç. */
export function pickChancellor(state: GameState, avoid: string[] = []): string {
  if (state.phase.kind !== 'nomination') {
    throw new Error(`nomination bekleniyordu, ${state.phase.kind} var`);
  }
  const presidentId = state.phase.presidentId;
  const aliveTotal = state.players.filter((p) => p.alive).length;
  const banned = new Set<string>([presidentId, ...avoid]);
  if (state.lastGovernment) {
    banned.add(state.lastGovernment.chancellorId);
    if (aliveTotal > 5) banned.add(state.lastGovernment.presidentId);
  }
  const candidate = state.players.find((p) => p.alive && !banned.has(p.playerId));
  if (!candidate) throw new Error('uygun şansölye adayı yok');
  return candidate.playerId;
}

/** executive_action aşamasındaysa yetkiyi genel biçimde çöz (hedef gerekirse Hitler olmayan biri). */
export function advanceExecutivePower(state: GameState): GameState {
  if (state.phase.kind !== 'executive_action') return state;
  const phase = state.phase;
  const presidentId = phase.government.presidentId;
  const otherAlive = state.players.filter(
    (p) => p.alive && p.playerId !== presidentId,
  );
  const nonHitler = otherAlive.find((p) => p.role !== 'hitler')?.playerId ?? otherAlive[0]?.playerId;

  switch (phase.power) {
    case 'investigate_loyalty': {
      const target = otherAlive.find(
        // D18/B1 — teklik başkandan bağımsız.
        (p) => !state.investigations.some((i) => i.targetId === p.playerId),
      )?.playerId as string;
      let next = apply(state, { type: 'use_power', playerId: presidentId, targetId: target });
      next = apply(next, { type: 'ack_private_result', playerId: presidentId });
      return next;
    }
    case 'policy_peek': {
      let next = apply(state, { type: 'use_power', playerId: presidentId });
      next = apply(next, { type: 'ack_private_result', playerId: presidentId });
      return next;
    }
    case 'call_special_election':
      return apply(state, {
        type: 'use_power',
        playerId: presidentId,
        targetId: nonHitler as string,
      });
    case 'execution':
      return apply(state, {
        type: 'use_power',
        playerId: presidentId,
        targetId: nonHitler as string,
      });
    default:
      return state;
  }
}

/**
 * Herhangi bir aşamada bir "tur" oynatır: rol onayı, adaylık+oy, yasama
 * (tercihe göre kart) veya yetki. `pref` yönünde politika koymaya çalışır.
 * Oyun bitene kadar döngüde kullanılır.
 */
export function playRound(
  state: GameState,
  pref: Pol,
  opts?: { avoidChancellors?: string[]; voteMap?: Record<string, VoteValue> },
): GameState {
  const disfavored: Pol = pref === 'fascist' ? 'liberal' : 'fascist';
  switch (state.phase.kind) {
    case 'role_reveal':
      return ackAll(state);
    case 'nomination':
      return runElection(state, pickChancellor(state, opts?.avoidChancellors), opts?.voteMap);
    case 'voting':
      throw new Error('playRound: yarım kalmış oylama');
    case 'legislative_president': {
      const president = state.phase.government.presidentId;
      const drop =
        state.phase.drawnCards.find((c) => c.policy === disfavored) ?? state.phase.drawnCards[0];
      if (!drop) throw new Error('playRound: başkan eli boş');
      const next = apply(state, { type: 'discard_policy', playerId: president, cardId: drop.cardId });
      return enactPreferred(next, pref);
    }
    case 'legislative_chancellor':
      return enactPreferred(state, pref);
    case 'veto_response':
      return apply(state, {
        type: 'respond_veto',
        playerId: state.phase.government.presidentId,
        accept: false,
      });
    case 'executive_action':
      return advanceExecutivePower(state);
    case 'game_over':
      return state;
    default: {
      const _exhaustive: never = state.phase;
      void _exhaustive;
      return state;
    }
  }
}

function enactPreferred(state: GameState, pref: Pol): GameState {
  if (state.phase.kind !== 'legislative_chancellor') return state;
  const chancellor = state.phase.government.chancellorId;
  const pick =
    state.phase.handCards.find((c) => c.policy === pref) ?? state.phase.handCards[0];
  if (!pick) throw new Error('playRound: şansölye eli boş');
  return apply(state, { type: 'enact_policy', playerId: chancellor, cardId: pick.cardId });
}

/** Verilen koşul sağlanana (veya oyun bitene) kadar `playRound` çağırır. */
export function playUntil(
  state: GameState,
  predicate: (s: GameState) => boolean,
  pref: Pol,
  opts?: { avoidChancellors?: string[]; maxRounds?: number },
): GameState {
  let next = state;
  const limit = opts?.maxRounds ?? 200;
  let guard = 0;
  while (!predicate(next) && next.phase.kind !== 'game_over' && guard < limit) {
    guard += 1;
    next = playRound(next, pref, { avoidChancellors: opts?.avoidChancellors });
  }
  if (!predicate(next)) {
    throw new Error(`playUntil: koşul sağlanmadı (aşama: ${next.phase.kind})`);
  }
  return next;
}

/** Oyun bitene kadar `playRound` çağırır (koruma sınırıyla). */
export function playToEnd(
  state: GameState,
  pref: Pol,
  opts?: { avoidChancellors?: string[]; maxRounds?: number },
): GameState {
  let next = state;
  const limit = opts?.maxRounds ?? 200;
  let guard = 0;
  while (next.phase.kind !== 'game_over' && guard < limit) {
    guard += 1;
    next = playRound(next, pref, { avoidChancellors: opts?.avoidChancellors });
  }
  if (next.phase.kind !== 'game_over') throw new Error('playToEnd: oyun bitmedi (koruma sınırı)');
  return next;
}

/** legislative_president + legislative_chancellor: başkan `presidentDiscards` politikasını atar, şansölye kalanlardan `chancellorEnacts` olanı koyar. */
export function runLegislative(
  state: GameState,
  presidentDiscards: 'liberal' | 'fascist',
  chancellorEnacts: 'liberal' | 'fascist',
): GameState {
  if (state.phase.kind !== 'legislative_president') {
    throw new Error(`legislative_president bekleniyordu, ${state.phase.kind} var`);
  }
  const presidentId = state.phase.government.presidentId;
  const chancellorId = state.phase.government.chancellorId;

  const toDiscard = state.phase.drawnCards.find((c) => c.policy === presidentDiscards);
  if (!toDiscard) throw new Error(`başkan elinde ${presidentDiscards} yok`);
  let next = apply(state, { type: 'discard_policy', playerId: presidentId, cardId: toDiscard.cardId });

  if (next.phase.kind !== 'legislative_chancellor') {
    throw new Error(`legislative_chancellor bekleniyordu, ${next.phase.kind} var`);
  }
  const toEnact = next.phase.handCards.find((c) => c.policy === chancellorEnacts);
  if (!toEnact) throw new Error(`şansölye elinde ${chancellorEnacts} yok`);
  return apply(next, { type: 'enact_policy', playerId: chancellorId, cardId: toEnact.cardId });
}
