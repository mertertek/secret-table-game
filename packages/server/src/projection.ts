/**
 * Oyuncuya göre görünüm projeksiyonu — gizli veri filtreleme.
 *
 * Tam oyun durumu (`GameState`) hiçbir kanaldan istemciye gitmez. Bu işlev her
 * alıcı için yalnız izin verilen alanlardan `SceneView` üretir:
 *  - Rol ve el yalnız sahibine.
 *  - `knownPlayers` yalnız kuralın izin verdiği kişiler (faşist tanışması,
 *    Hitler'in bilmesi, kendi yaptığın inceleme).
 *  - Oy tercihi yalnız sahibine; sonuç açıklanınca `lastElection` üzerinden herkese.
 *  - `inspection` yalnız yetkiyi kullanan başkana.
 *  - Oyun sonu rolleri yalnız `result.revealedRoles`.
 *
 * `SceneCue`'lar da alıcı bazında süzülür (`eventsToCues`).
 */

import type {
  AllowedAction,
  AvatarSelection,
  ConnectionStatus,
  GameEndReason,
  PauseState,
  PlayerCount,
  PlayerView,
  PublicHistoryEntry,
  SceneCue,
  SceneView,
  VoteValue,
} from '@secret-table/contracts';
import { PROTOCOL_VERSION, avatarForSeat, suggestSkin } from '@secret-table/contracts';
import type { GameEvent, GameState } from '@secret-table/game-core';
import {
  eligibleChancellorIds,
  investigatableTargetIds,
  knownPlayersFor,
  otherAliveTargetIds,
} from '@secret-table/game-core';

export type ProjectionMeta = {
  roomId: string;
  gameId: string;
  /** playerId -> bağlı mı (sunucu oturum/heartbeat bilgisinden). */
  connectedByPlayerId: Readonly<Record<string, boolean>>;
  /** Yerel oyuncunun bağlantı durumu (istemci adaptörü de düzeltebilir). */
  localConnection: ConnectionStatus;
  paused: PauseState | null;
  /**
   * D3.4 — playerId -> lobide SEÇİLMİŞ karakter. Eksik kayıt koltuk sırasından
   * türetilen varsayılana düşer, bu yüzden alan opsiyoneldir (eski çağrı
   * noktaları ve testler değişmeden aynı görüntüyü üretir).
   */
  avatarByPlayerId?: Readonly<Record<string, AvatarSelection>>;
};

/**
 * D3.4 — odadaki HER üye için görünen karakteri çözer.
 *
 * 1. Açık seçimler olduğu gibi korunur (kullanıcının seçimi ASLA değiştirilmez;
 *    iki oyuncu aynı karakter+teni seçebilir — benzersizlik kuralı yok).
 * 2. Seçim yapmamış üyeye koltuk varsayılanı verilir; o karakter odada zaten
 *    kullanılıyorsa varsayılan TEN farklıya kaydırılır (`suggestSkin`) — masada
 *    iki özdeş karakter görünmesin diye sunucunun ÖNERİSİ budur.
 *
 * Saf ve deterministik: lobi görünümü ile oyun projeksiyonu aynı sonucu verir.
 */
export function resolveAvatars(
  members: readonly { playerId: string; seatIndex: number; avatar: AvatarSelection | null }[],
): Record<string, AvatarSelection> {
  const ordered = [...members].sort((a, b) => a.seatIndex - b.seatIndex);
  const out: Record<string, AvatarSelection> = {};
  const taken: AvatarSelection[] = [];

  for (const member of ordered) {
    if (!member.avatar) continue;
    out[member.playerId] = member.avatar;
    taken.push(member.avatar);
  }
  for (const member of ordered) {
    if (member.avatar) continue;
    const base = avatarForSeat(member.seatIndex);
    const resolved = { character: base.character, skin: suggestSkin(base.character, taken, base.skin) };
    out[member.playerId] = resolved;
    taken.push(resolved);
  }
  return out;
}

const PHASE_MAP = {
  role_reveal: 'role_reveal',
  nomination: 'nomination',
  voting: 'voting',
  legislative_president: 'president_discard',
  legislative_chancellor: 'chancellor_choice',
  veto_response: 'veto_response',
  executive_action: 'executive_action',
  game_over: 'game_over',
} as const;

export function phaseIdOf(state: GameState, gameId: string): string {
  return `${gameId}:${state.phaseSeq}`;
}

function currentGovernment(state: GameState): { presidentId: string; chancellorId: string } | null {
  const { phase } = state;
  if (
    phase.kind === 'legislative_president' ||
    phase.kind === 'legislative_chancellor' ||
    phase.kind === 'veto_response' ||
    phase.kind === 'executive_action'
  ) {
    return phase.government;
  }
  return null;
}

function projectPlayers(state: GameState, meta: ProjectionMeta): PlayerView[] {
  const gov = currentGovernment(state);
  const { phase } = state;
  const nominationPresident =
    phase.kind === 'nomination' || phase.kind === 'voting' ? phase.presidentId : null;
  const votingChancellor = phase.kind === 'voting' ? phase.chancellorId : null;

  return state.players.map((player): PlayerView => {
    let office: PlayerView['office'] = 'none';
    if (gov?.presidentId === player.playerId) office = 'president';
    else if (gov?.chancellorId === player.playerId) office = 'chancellor';

    return {
      playerId: player.playerId,
      seatIndex: player.seatIndex,
      displayName: player.playerId, // gerçek isim sunucu meta'sından enjekte edilir (aşağıda)
      connected: meta.connectedByPlayerId[player.playerId] ?? false,
      ready: phase.kind === 'role_reveal' ? phase.ackedPlayerIds.includes(player.playerId) : true,
      alive: player.alive,
      isHost: player.seatIndex === 0,
      office,
      isPresidentialCandidate: nominationPresident === player.playerId,
      isChancellorCandidate: votingChancellor === player.playerId,
      hasVoted: phase.kind === 'voting' ? phase.votes[player.playerId] !== undefined : false,
      // Seçim yoksa koltuk varsayılanı: alan HER ZAMAN doludur (sözleşme).
      avatar: meta.avatarByPlayerId?.[player.playerId] ?? avatarForSeat(player.seatIndex),
    };
  });
}

function projectPublicHistory(state: GameState): PublicHistoryEntry[] {
  const out: PublicHistoryEntry[] = [];
  for (const entry of state.log) {
    const entryId = `h_${entry.seq}`;
    switch (entry.kind) {
      case 'game_started':
        out.push({ entryId, kind: 'game_started', playerCount: entry.playerCount });
        break;
      case 'nomination':
        out.push({
          entryId,
          kind: 'nomination',
          presidentId: entry.presidentId,
          chancellorId: entry.chancellorId,
        });
        break;
      case 'election':
        out.push({ entryId, kind: 'election', electionId: entry.electionId, outcome: entry.outcome });
        break;
      case 'policy_enacted':
        out.push({ entryId, kind: 'policy_enacted', board: entry.board, policy: entry.policy });
        break;
      case 'chaos_policy':
        out.push({ entryId, kind: 'chaos_policy', policy: entry.policy });
        break;
      case 'election_tracker':
        out.push({ entryId, kind: 'election_tracker', tracker: entry.tracker });
        break;
      case 'power_used':
        out.push({
          entryId,
          kind: 'power_used',
          power: entry.power,
          actorId: entry.actorId,
          targetId: entry.targetId,
        });
        break;
      case 'player_executed':
        out.push({ entryId, kind: 'player_executed', targetId: entry.targetId });
        break;
      case 'veto_enacted':
      case 'game_over':
        break;
      default: {
        const _exhaustive: never = entry;
        void _exhaustive;
      }
    }
  }
  return out;
}

export function projectActions(
  state: GameState,
  forPlayerId: string,
  phaseId: string,
): AllowedAction[] {
  const { phase } = state;
  const mk = (
    actionId: string,
    kind: AllowedAction['kind'],
    options: AllowedAction['options'],
    requiresConfirmation: boolean,
  ): AllowedAction => ({ actionId, kind, phaseId, options, requiresConfirmation });

  switch (phase.kind) {
    case 'role_reveal':
      if (phase.ackedPlayerIds.includes(forPlayerId)) return [];
      return [mk('act_ack_role', 'ack_role', [{ optionId: 'ack', labelKey: 'role.ready' }], false)];

    case 'nomination':
      if (phase.presidentId !== forPlayerId) return [];
      return [
        mk(
          'act_nominate',
          'nominate',
          eligibleChancellorIds(state, forPlayerId).map((pid) => ({
            optionId: `nom_${pid}`,
            labelKey: 'player.name',
            targetPlayerId: pid,
          })),
          true,
        ),
      ];

    case 'voting': {
      const me = state.players.find((p) => p.playerId === forPlayerId);
      if (!me?.alive || phase.votes[forPlayerId] !== undefined) return [];
      return [
        mk(
          'act_vote',
          'vote',
          [
            { optionId: 'vote_yes', labelKey: 'vote.yes', vote: 'yes' },
            { optionId: 'vote_no', labelKey: 'vote.no', vote: 'no' },
          ],
          false,
        ),
      ];
    }

    case 'legislative_president':
      if (phase.government.presidentId !== forPlayerId) return [];
      return [
        mk(
          'act_discard',
          'discard_policy',
          phase.drawnCards.map((card) => ({
            optionId: `discard_${card.cardId}`,
            labelKey: `policy.${card.policy}`,
            cardId: card.cardId,
          })),
          true,
        ),
      ];

    case 'legislative_chancellor': {
      if (phase.government.chancellorId !== forPlayerId) return [];
      const actions: AllowedAction[] = [
        mk(
          'act_enact',
          'enact_policy',
          phase.handCards.map((card) => ({
            optionId: `enact_${card.cardId}`,
            labelKey: `policy.${card.policy}`,
            cardId: card.cardId,
          })),
          true,
        ),
      ];
      if (state.fascistPolicies >= state.layout.vetoUnlockAt && !phase.vetoRequested) {
        actions.push(
          mk('act_request_veto', 'request_veto', [{ optionId: 'veto', labelKey: 'veto.request' }], false),
        );
      }
      return actions;
    }

    case 'veto_response':
      if (phase.government.presidentId !== forPlayerId) return [];
      return [
        mk(
          'act_respond_veto',
          'respond_veto',
          [
            { optionId: 'veto_accept', labelKey: 'veto.accept' },
            { optionId: 'veto_reject', labelKey: 'veto.reject' },
          ],
          true,
        ),
      ];

    case 'executive_action': {
      if (phase.government.presidentId !== forPlayerId) return [];
      if (phase.resolved) {
        if (phase.inspection) {
          return [
            mk(
              'act_ack_private',
              'ack_private_result',
              [{ optionId: 'ack', labelKey: 'inspection.ack' }],
              false,
            ),
          ];
        }
        return [];
      }
      if (phase.power === 'policy_peek') {
        return [mk('act_use_power', 'use_power', [{ optionId: 'peek', labelKey: 'power.peek' }], true)];
      }
      const targets =
        phase.power === 'investigate_loyalty'
          ? investigatableTargetIds(state, forPlayerId)
          : otherAliveTargetIds(state, forPlayerId);
      return [
        mk(
          'act_use_power',
          'use_power',
          targets.map((pid) => ({
            optionId: `power_${pid}`,
            labelKey: 'player.name',
            targetPlayerId: pid,
          })),
          true,
        ),
      ];
    }

    case 'game_over':
      return [];

    default: {
      const _exhaustive: never = phase;
      void _exhaustive;
      return [];
    }
  }
}

export function projectView(
  state: GameState,
  forPlayerId: string,
  meta: ProjectionMeta,
  displayNames: Readonly<Record<string, string>>,
): SceneView {
  const phaseId = phaseIdOf(state, meta.gameId);
  const me = state.players.find((p) => p.playerId === forPlayerId);
  const { phase } = state;

  const players = projectPlayers(state, meta).map((player) => ({
    ...player,
    displayName: displayNames[player.playerId] ?? player.displayName,
  }));

  // --- privateView (yalnız bu oyuncu) ---
  let hand: SceneView['privateView']['hand'] = [];
  if (
    phase.kind === 'legislative_president' &&
    phase.government.presidentId === forPlayerId
  ) {
    hand = phase.drawnCards.map((c) => ({ cardId: c.cardId, policy: c.policy }));
  } else if (
    (phase.kind === 'legislative_chancellor' || phase.kind === 'veto_response') &&
    phase.government.chancellorId === forPlayerId
  ) {
    hand = phase.handCards.map((c) => ({ cardId: c.cardId, policy: c.policy }));
  } else if (phase.kind === 'veto_response' && phase.government.presidentId === forPlayerId) {
    hand = phase.handCards.map((c) => ({ cardId: c.cardId, policy: c.policy }));
  }

  const submittedVote: VoteValue | null =
    phase.kind === 'voting' ? (phase.votes[forPlayerId] ?? null) : null;

  let inspection: SceneView['privateView']['inspection'] = null;
  if (
    phase.kind === 'executive_action' &&
    phase.government.presidentId === forPlayerId &&
    phase.inspection
  ) {
    inspection =
      phase.inspection.kind === 'party_membership'
        ? {
            kind: 'party_membership',
            targetId: phase.inspection.targetId,
            party: phase.inspection.party,
          }
        : { kind: 'policy_peek', upcoming: [...phase.inspection.cards] };
  }

  // --- currentPower (herkese açık) ---
  const currentPower =
    phase.kind === 'executive_action'
      ? { power: phase.power, actorId: phase.government.presidentId, targetId: phase.targetId }
      : null;

  // --- result (yalnız oyun sonunda) ---
  const result =
    state.winner && state.endReason
      ? {
          winner: state.winner,
          reason: state.endReason as GameEndReason,
          revealedRoles: state.players.map((p) => ({ playerId: p.playerId, role: p.role })),
        }
      : null;

  return {
    protocolVersion: PROTOCOL_VERSION,
    roomId: meta.roomId,
    gameId: meta.gameId,
    revision: state.revision,
    phaseId,
    phase: PHASE_MAP[phase.kind],
    connection: meta.localConnection,
    paused: meta.paused,
    playerCountAtStart: state.playerCount as PlayerCount,
    boardVariant: state.boardVariant,
    localPlayerId: forPlayerId,
    players,
    table: {
      liberalPolicies: state.liberalPolicies,
      fascistPolicies: state.fascistPolicies,
      electionTracker: state.electionTracker,
      drawCount: state.deck.length,
      discardCount: state.discard.length,
      enactedPolicies: state.enactedPolicies.map((e) => ({ ...e })),
      lastElection: state.lastElection
        ? {
            electionId: state.lastElection.electionId,
            presidentId: state.lastElection.presidentId,
            chancellorId: state.lastElection.chancellorId,
            outcome: state.lastElection.outcome,
            votes: state.lastElection.votes.map((v) => ({ ...v })),
          }
        : null,
      currentPower,
      publicHistory: projectPublicHistory(state),
    },
    privateView: {
      role: me?.role ?? null,
      knownPlayers: knownPlayersFor(state, forPlayerId).map((k) => ({
        playerId: k.playerId,
        knowledge: k.knowledge,
        source: k.source,
      })),
      hand,
      submittedVote,
      inspection,
    },
    actions: projectActions(state, forPlayerId, phaseId),
    result,
  } satisfies SceneView;
}

/** Motor olaylarını alıcıya izinli `SceneCue`'lara çevirir. */
export function eventsToCues(
  events: readonly GameEvent[],
  forPlayerId: string,
  gameId: string,
  revision: number,
): SceneCue[] {
  const cues: SceneCue[] = [];
  events.forEach((event, index) => {
    const base = { gameId, revision, cueId: `${gameId}:${revision}:${index}` };
    switch (event.kind) {
      case 'cards_dealt':
        if (event.toPlayerId === forPlayerId) {
          cues.push({
            ...base,
            kind: 'cards_dealt',
            toPlayerId: event.toPlayerId,
            cards: event.cards.map((policy, i) => ({ cardId: `${base.cueId}_${i}`, policy })),
          });
        }
        break;
      case 'cards_moved':
        // Kapalı hareket herkese açıktır: alıcı filtresi yok, tür/kimlik yok.
        cues.push({ ...base, kind: 'cards_moved', count: event.count, from: event.from, to: event.to });
        break;
      case 'votes_revealed':
        cues.push({
          ...base,
          kind: 'votes_revealed',
          electionId: event.electionId,
          outcome: event.outcome,
          votes: event.votes.map((v) => ({ ...v })),
        });
        break;
      case 'policy_enacted':
        cues.push({
          ...base,
          kind: 'policy_enacted',
          board: event.board,
          slotIndex: event.slotIndex,
          policy: event.policy,
        });
        break;
      case 'office_moved':
        cues.push({ ...base, kind: 'office_moved', office: event.office, toPlayerId: event.toPlayerId });
        break;
      case 'player_eliminated':
        cues.push({ ...base, kind: 'player_eliminated', playerId: event.playerId });
        break;
      case 'game_ended':
        cues.push({ ...base, kind: 'game_ended', winner: event.winner, reason: event.reason });
        break;
      default: {
        const _exhaustive: never = event;
        void _exhaustive;
      }
    }
  });
  return cues;
}
