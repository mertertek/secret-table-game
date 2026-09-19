import type { PlayerCount, SecretRole } from '@secret-table/contracts';
import {
  POLICY_DECK_COMPOSITION,
  ROLE_SETUPS,
  boardLayoutForPlayerCount,
  boardVariantForPlayerCount,
} from '@secret-table/contracts';

import { createRng, shuffle } from './rng';
import type { EnginePlayer, GameState, PolicyCard } from './types';

export type CreateGameConfig = {
  players: readonly { playerId: string; seatIndex: number }[];
  /** Belirlenimci tohum. Sunucu üretip saklar; test sabit verir. */
  seed: number;
  overrides?: {
    /** playerId -> rol. Sayılar `ROLE_SETUPS[playerCount]` ile eşleşmeli. */
    roles?: Readonly<Record<string, SecretRole>>;
    /** Deste (üst kart index 0). Sayılar 6 liberal + 11 faşist olmalı. */
    deck?: readonly PolicyCard[];
    /** İlk başkan adayının koltuğu. */
    firstPresidentSeat?: number;
  };
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`createGame: ${message}`);
}

function buildRoleBag(liberals: number, fascists: number): SecretRole[] {
  return [
    ...Array.from({ length: liberals }, (): SecretRole => 'liberal'),
    ...Array.from({ length: fascists }, (): SecretRole => 'fascist'),
    'hitler' as const,
  ];
}

function buildDeck(): PolicyCard[] {
  return [
    ...Array.from({ length: POLICY_DECK_COMPOSITION.liberal }, (): PolicyCard => 'liberal'),
    ...Array.from({ length: POLICY_DECK_COMPOSITION.fascist }, (): PolicyCard => 'fascist'),
  ];
}

export function createGame(config: CreateGameConfig): GameState {
  const { players, seed, overrides } = config;

  const count = players.length;
  assert(count >= 5 && count <= 10, `oyuncu sayısı 5-10 olmalı, ${count} verildi`);
  const playerCount = count as PlayerCount;

  const seats = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  seats.forEach((player, index) => {
    assert(player.seatIndex === index, `koltuklar 0..${count - 1} sırayla olmalı`);
  });
  assert(new Set(players.map((p) => p.playerId)).size === count, 'playerId benzersiz olmalı');

  const roleSetup = ROLE_SETUPS[playerCount];
  const layout = boardLayoutForPlayerCount(playerCount);
  const boardVariant = boardVariantForPlayerCount(playerCount);

  const rng = createRng(seed);
  const shuffledRoles = shuffle(buildRoleBag(roleSetup.liberals, roleSetup.fascists), rng);
  const shuffledDeck = shuffle(buildDeck(), rng);

  let assignedRoles: SecretRole[];
  if (overrides?.roles) {
    assignedRoles = seats.map((player) => {
      const role = overrides.roles?.[player.playerId];
      assert(role !== undefined, `overrides.roles ${player.playerId} için rol vermeli`);
      return role;
    });
    const fascistTotal = assignedRoles.filter((r) => r === 'fascist').length;
    const hitlerTotal = assignedRoles.filter((r) => r === 'hitler').length;
    assert(hitlerTotal === 1, 'tam olarak bir Hitler olmalı');
    assert(fascistTotal === roleSetup.fascists, `faşist sayısı ${roleSetup.fascists} olmalı`);
  } else {
    assignedRoles = shuffledRoles;
  }

  let deck: PolicyCard[];
  if (overrides?.deck) {
    const libs = overrides.deck.filter((c) => c === 'liberal').length;
    const fas = overrides.deck.filter((c) => c === 'fascist').length;
    assert(
      libs === POLICY_DECK_COMPOSITION.liberal && fas === POLICY_DECK_COMPOSITION.fascist,
      'overrides.deck 6 liberal + 11 faşist olmalı',
    );
    deck = [...overrides.deck];
  } else {
    deck = shuffledDeck;
  }

  const firstPresidentSeat =
    overrides?.firstPresidentSeat ?? Math.floor(rng() * count);
  assert(
    firstPresidentSeat >= 0 && firstPresidentSeat < count,
    `firstPresidentSeat 0..${count - 1} olmalı`,
  );

  const enginePlayers: EnginePlayer[] = seats.map((player, index) => ({
    playerId: player.playerId,
    seatIndex: index,
    role: assignedRoles[index] as SecretRole,
    alive: true,
  }));

  return {
    playerCount,
    boardVariant,
    layout,
    roleSetup,
    players: enginePlayers,
    deck,
    discard: [],
    deckSeed: seed >>> 0,
    reshuffles: 0,
    liberalPolicies: 0,
    fascistPolicies: 0,
    enactedPolicies: [],
    electionTracker: 0,
    presidentSeat: firstPresidentSeat,
    specialElection: null,
    lastGovernment: null,
    lastElection: null,
    investigations: [],
    phase: { kind: 'role_reveal', ackedPlayerIds: [] },
    phaseSeq: 1,
    revision: 0,
    winner: null,
    endReason: null,
    log: [{ seq: 0, kind: 'game_started', playerCount }],
    seq: 1,
  };
}
