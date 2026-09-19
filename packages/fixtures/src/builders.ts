/**
 * Sentetik SceneView üreticileri. Yalnızca uydurma veri; hiçbir gerçek
 * oturum, rol veya DB kaydı içermez (docs/CONTRACT.md bölüm 9 devir kontrolü).
 *
 * Bu yardımcılar sahne geliştirme ve testler içindir; üretim oyununa girmez.
 */

import { PROTOCOL_VERSION, avatarForSeat } from '@secret-table/contracts';
import type {
  AllowedAction,
  BoardVariant,
  PlayerCount,
  PlayerView,
  PrivateView,
  PublicTableView,
  SceneView,
} from '@secret-table/contracts';

/** Kısa Türkçe adlar; koltuk sırasıyla kullanılır. */
export const DEFAULT_NAMES = [
  'Mert',
  'Elif',
  'Deniz',
  'Kaan',
  'Selin',
  'Barış',
  'Ada',
  'Cem',
  'Yağmur',
  'Ozan',
] as const;

export function boardVariantFor(playerCount: number): BoardVariant {
  if (playerCount <= 6) return 'small';
  if (playerCount <= 8) return 'medium';
  return 'large';
}

export type MakePlayerOverride = Partial<Omit<PlayerView, 'playerId' | 'seatIndex' | 'displayName'>>;

export type MakePlayersInput = {
  count: number;
  /** seatIndex -> alan geçersiz kılma. */
  overrides?: Readonly<Record<number, MakePlayerOverride>>;
};

/**
 * `count` kadar koltuğu sabit sırayla üretir. Varsayılan: hepsi hayatta ve
 * bağlı, ilk koltuk oda sahibi, kimse görev almamış.
 */
export function makePlayers({ count, overrides = {} }: MakePlayersInput): PlayerView[] {
  if (count < 1 || count > DEFAULT_NAMES.length) {
    throw new Error(`makePlayers: desteklenmeyen oyuncu sayısı ${count}`);
  }
  return Array.from({ length: count }, (_unused, seatIndex): PlayerView => {
    const base: PlayerView = {
      playerId: `p${seatIndex + 1}`,
      seatIndex,
      displayName: DEFAULT_NAMES[seatIndex] ?? `Oyuncu ${seatIndex + 1}`,
      connected: true,
      ready: false,
      alive: true,
      isHost: seatIndex === 0,
      office: 'none',
      isPresidentialCandidate: false,
      isChancellorCandidate: false,
      hasVoted: false,
      // D3.4: alan sözleşmede zorunlu. Varsayılan koltuk türetmesi sunucununkiyle
      // AYNI işlevden gelir; mevcut fixture görünümleri değişmez.
      avatar: avatarForSeat(seatIndex),
    };
    return { ...base, ...overrides[seatIndex] };
  });
}

export function makeTable(overrides: Partial<PublicTableView> = {}): PublicTableView {
  return {
    liberalPolicies: 0,
    fascistPolicies: 0,
    electionTracker: 0,
    drawCount: 17,
    discardCount: 0,
    enactedPolicies: [],
    lastElection: null,
    currentPower: null,
    publicHistory: [],
    ...overrides,
  };
}

export function makePrivateView(overrides: Partial<PrivateView> = {}): PrivateView {
  return {
    role: null,
    knownPlayers: [],
    hand: [],
    submittedVote: null,
    inspection: null,
    ...overrides,
  };
}

export type MakeViewInput = Partial<
  Omit<SceneView, 'players' | 'table' | 'privateView' | 'actions' | 'protocolVersion'>
> & {
  players?: PlayerView[];
  table?: Partial<PublicTableView>;
  privateView?: Partial<PrivateView>;
  actions?: readonly AllowedAction[];
};

/**
 * Tam bir SceneView üretir. Üst düzey alanlar sığ, `table` ve `privateView`
 * kısmi geçersiz kılma ile birleştirilir.
 */
export function makeView(input: MakeViewInput = {}): SceneView {
  const phase = input.phase ?? 'nomination';
  const players = input.players ?? makePlayers({ count: 7 });
  const playerCountAtStart =
    input.playerCountAtStart ??
    (phase === 'lobby' ? null : (clampPlayerCount(players.length)));

  const firstPlayer = players[0];
  if (!firstPlayer) {
    throw new Error('makeView: en az bir oyuncu gerekir');
  }

  return {
    protocolVersion: PROTOCOL_VERSION,
    roomId: input.roomId ?? 'room_demo',
    gameId: 'gameId' in input ? (input.gameId ?? null) : phase === 'lobby' ? null : 'game_demo',
    revision: input.revision ?? 1,
    phaseId: input.phaseId ?? `${phase}_1`,
    phase,
    connection: input.connection ?? 'connected',
    paused: input.paused ?? null,
    playerCountAtStart,
    boardVariant: input.boardVariant ?? boardVariantFor(players.length),
    localPlayerId: input.localPlayerId ?? firstPlayer.playerId,
    players,
    table: makeTable(input.table),
    privateView: makePrivateView(input.privateView),
    actions: input.actions ?? [],
    result: input.result ?? null,
  };
}

function clampPlayerCount(count: number): PlayerCount {
  const allowed: readonly PlayerCount[] = [5, 6, 7, 8, 9, 10];
  const match = allowed.find((value) => value === count);
  if (!match) {
    throw new Error(`makeView: oyun içi oyuncu sayısı 5-10 olmalı, ${count} verildi`);
  }
  return match;
}
