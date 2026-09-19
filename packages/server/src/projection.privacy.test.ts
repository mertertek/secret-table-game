/**
 * RULES-AUDIT 2026-09-12 — yetkili görünüm gizlilik denetimi.
 *
 * Rastgele oynanan oyunlarda HER adımda HER oyuncu için `projectView` üretilir
 * ve şu sızıntılar sistematik olarak aranır:
 *
 *  - Başkasının gizli rolü (herkese açık `players[]` veya başka bir alan).
 *  - Başkasının eli (`privateView.hand` yalnız yetkili taşıyıcıya).
 *  - Açıklanmamış oy tercihi (`hasVoted` boolean dışında hiçbir yerde).
 *  - `knownPlayers` yalnız kuralın izin verdiği kaynaklarla dolu; Hitler 7+
 *    oyuncuda faşistleri GÖRMEZ.
 *  - `inspection` (inceleme sonucu / deste tepesi) yalnız yetkiyi kullanan
 *    başkana.
 *  - `publicHistory` içinde inceleme SONUCU (parti) veya gizli kart kimliği yok.
 *  - `cues` alıcı bazında süzülmüş; `cards_dealt` yalnız sahibine.
 *
 * Sürücü gerçek sunucu yolunu kullanır: `projectActions` -> `resolveEngineCommand`
 * -> `applyCommand`. Yani istemcinin görebildiği eylemler dışında komut üretilmez.
 */

import { describe, expect, it } from 'vitest';

import type { SceneView } from '@secret-table/contracts';
import { applyCommand, createGame, createRng } from '@secret-table/game-core';
import type { GameState } from '@secret-table/game-core';

import { resolveEngineCommand } from './engine-map';
import { eventsToCues, phaseIdOf, projectActions, projectView } from './projection';
import type { ProjectionMeta } from './projection';

const GAME_ID = 'game1';

function meta(state: GameState): ProjectionMeta {
  const connected: Record<string, boolean> = {};
  for (const p of state.players) connected[p.playerId] = true;
  return {
    roomId: 'room1',
    gameId: GAME_ID,
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

/** Görünümdeki tüm `key` yollarını toplar (dizi indeksleri `[]` ile normalize). */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => keyPaths(item, `${prefix}[]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
      const path = prefix ? `${prefix}.${k}` : k;
      return [path, ...keyPaths(v, path)];
    });
  }
  return [];
}

/** Rol/parti taşımasına İZİN VERİLEN tek yollar. */
const ALLOWED_ROLE_PATHS = new Set([
  'privateView.role',
  'privateView.knownPlayers[].knowledge.role',
  'result.revealedRoles[].role',
]);
const ALLOWED_PARTY_PATHS = new Set([
  'privateView.knownPlayers[].knowledge.party',
  'privateView.inspection.party',
]);
/** Oy DEĞERİ taşımasına izin verilen yollar (açıklanmış seçim + kendi oyum). */
const ALLOWED_VOTE_PATHS = new Set([
  'privateView.submittedVote',
  'table.lastElection.votes[].vote',
  // Bana SUNULAN seçenek ("evet"/"hayır" düğmeleri) — başkasının tercihi değil.
  'actions[].options[].vote',
]);
/** Kart türü taşımasına izin verilen yollar. */
const ALLOWED_POLICY_PATHS = new Set([
  'table.enactedPolicies[].policy',
  'table.publicHistory[].policy',
  'privateView.hand[].policy',
  // Deste tepesi: yalnız yetkiyi kullanan başkana (aşağıdaki 7. kontrol doğrular).
  'privateView.inspection.upcoming',
  'privateView.inspection.upcoming[]',
  'actions[].options[].labelKey', // "policy.liberal" etiketi yalnız yetkili ele ait
]);

type Violation = string;

function auditView(
  state: GameState,
  view: SceneView,
  forPlayerId: string,
  out: Violation[],
): void {
  const push = (m: string): void => {
    out.push(`${forPlayerId}: ${m}`);
  };
  const me = state.players.find((p) => p.playerId === forPlayerId);
  const paths = new Set(keyPaths(view));

  // --- 1. Rol / parti yalnız izinli yollarda ---
  for (const path of paths) {
    if (path.endsWith('.role') || path === 'role') {
      if (!ALLOWED_ROLE_PATHS.has(path)) push(`izinsiz rol yolu: ${path}`);
    }
    if (path.endsWith('.party') || path === 'party') {
      if (!ALLOWED_PARTY_PATHS.has(path)) push(`izinsiz parti yolu: ${path}`);
    }
    if (path.endsWith('.vote') || path === 'vote' || path === 'privateView.submittedVote') {
      if (!ALLOWED_VOTE_PATHS.has(path)) push(`izinsiz oy yolu: ${path}`);
    }
    if (path.endsWith('.policy') || path.startsWith('privateView.inspection.upcoming')) {
      if (!ALLOWED_POLICY_PATHS.has(path)) push(`izinsiz kart yolu: ${path}`);
    }
  }

  // --- 2. Herkese açık oyuncu nesnesi gizli alan taşımaz ---
  const publicKeys = new Set([
    'playerId',
    'seatIndex',
    'displayName',
    'connected',
    'ready',
    'alive',
    'isHost',
    'office',
    'isPresidentialCandidate',
    'isChancellorCandidate',
    'hasVoted',
    'avatar',
  ]);
  for (const p of view.players) {
    for (const key of Object.keys(p)) {
      if (!publicKeys.has(key)) push(`players[] beklenmeyen alan: ${key}`);
    }
  }

  // --- 3. Kendi rolüm doğru, başkasının rolü yok ---
  if (view.privateView.role !== (me?.role ?? null)) push('privateView.role kendi rolüm değil');

  // --- 4. knownPlayers yalnız kural kaynaklarıyla ---
  for (const known of view.privateView.knownPlayers) {
    const target = state.players.find((p) => p.playerId === known.playerId);
    if (!target) {
      push(`knownPlayers bilinmeyen oyuncu: ${known.playerId}`);
      continue;
    }
    if (known.playerId === forPlayerId) push('knownPlayers kendimi içeriyor');
    switch (known.source) {
      case 'fascists_know_each_other':
        if (me?.role !== 'fascist') push('faşist tanışması ama ben faşist değilim');
        if (target.role === 'liberal') push('faşist tanışması liberal oyuncuyu gösteriyor');
        break;
      case 'hitler_knows_fascists':
        if (me?.role !== 'hitler') push('hitler_knows_fascists ama ben Hitler değilim');
        if (!state.roleSetup.hitlerKnowsFascists) {
          push(`Hitler ${state.playerCount} oyuncuda faşistleri GÖRMEMELİ`);
        }
        if (target.role !== 'fascist') push('hitler_knows_fascists faşist olmayanı gösteriyor');
        break;
      case 'investigate_loyalty': {
        const record = state.investigations.find(
          (i) => i.actorId === forPlayerId && i.targetId === known.playerId,
        );
        if (!record) push('inceleme bilgisi ama bu oyuncu o incelemeyi yapmadı');
        break;
      }
      default:
        push(`bilinmeyen knownPlayers kaynağı: ${String(known.source)}`);
    }
  }

  // Hitler 7+ oyuncuda hiçbir takım arkadaşını bilmez (yalnız kendi incelemeleri).
  if (me?.role === 'hitler' && !state.roleSetup.hitlerKnowsFascists) {
    const teamKnowledge = view.privateView.knownPlayers.filter(
      (k) => k.source !== 'investigate_loyalty',
    );
    if (teamKnowledge.length > 0) push('Hitler 7+ oyuncuda takım bilgisi aldı');
  }
  // Liberal hiçbir takım bilgisi almaz.
  if (me?.role === 'liberal') {
    const teamKnowledge = view.privateView.knownPlayers.filter(
      (k) => k.source !== 'investigate_loyalty',
    );
    if (teamKnowledge.length > 0) push('liberal oyuncu takım bilgisi aldı');
  }

  // --- 5. El yalnız yetkili taşıyıcıya ---
  const { phase } = state;
  let authorizedHand = 0;
  if (phase.kind === 'legislative_president' && phase.government.presidentId === forPlayerId) {
    authorizedHand = phase.drawnCards.length;
  } else if (
    (phase.kind === 'legislative_chancellor' || phase.kind === 'veto_response') &&
    phase.government.chancellorId === forPlayerId
  ) {
    authorizedHand = phase.handCards.length;
  } else if (phase.kind === 'veto_response' && phase.government.presidentId === forPlayerId) {
    // Başkan üç kartı çekip birini attığı için kalan ikisini ZATEN bilir (resmî
    // kural: veto onayı başkanın bilgisiyle verilir).
    authorizedHand = phase.handCards.length;
  }
  if (view.privateView.hand.length !== authorizedHand) {
    push(
      `el uzunluğu ${view.privateView.hand.length}, yetkili ${authorizedHand} (${phase.kind})`,
    );
  }

  // --- 6. Oy tercihi ---
  const myVote = phase.kind === 'voting' ? (phase.votes[forPlayerId] ?? null) : null;
  if (view.privateView.submittedVote !== myVote) push('submittedVote kendi oyum değil');
  if (phase.kind === 'voting') {
    // Devam eden seçimin oyları hiçbir yerde açık olmamalı.
    const current = view.table.lastElection;
    if (
      current &&
      current.presidentId === phase.presidentId &&
      current.chancellorId === phase.chancellorId &&
      Object.keys(phase.votes).length < state.players.filter((p) => p.alive).length
    ) {
      push('devam eden seçimin oyları lastElection ile açıldı');
    }
  }

  // --- 7. inspection yalnız yetkili başkana ---
  const authorizedInspection =
    phase.kind === 'executive_action' &&
    phase.government.presidentId === forPlayerId &&
    phase.inspection !== null;
  if (!authorizedInspection && view.privateView.inspection !== null) {
    push('yetkisiz inspection (inceleme sonucu / deste tepesi) sızdı');
  }
  if (view.privateView.inspection?.kind === 'policy_peek') {
    if (!authorizedInspection) push('deste tepesi yetkisiz oyuncuya gitti');
  }

  // --- 8. publicHistory inceleme SONUCU taşımaz ---
  for (const entry of view.table.publicHistory) {
    if (entry.kind === 'power_used' && 'party' in entry) {
      push('publicHistory inceleme sonucunu (parti) taşıyor');
    }
    if (entry.kind === 'power_used' && 'cards' in entry) {
      push('publicHistory deste tepesini taşıyor');
    }
  }

  // --- 9. result yalnız oyun bitince ---
  if (view.result !== null && state.phase.kind !== 'game_over') {
    push('oyun sürerken result (roller) açıldı');
  }
  if (view.result === null && state.phase.kind === 'game_over') {
    push('oyun bitti ama result yok');
  }

  // --- 10. actions yalnız bu oyuncuya ait seçenekleri taşır ---
  for (const action of view.actions) {
    if (action.phaseId !== view.phaseId) push('action.phaseId güncel değil');
    for (const option of action.options) {
      if (option.cardId) {
        const mine = view.privateView.hand.some((c) => c.cardId === option.cardId);
        if (!mine) push('elimde olmayan kart için seçenek verildi');
      }
    }
  }
}

function auditCues(state: GameState, events: readonly Parameters<typeof eventsToCues>[0][number][], out: Violation[]): void {
  for (const p of state.players) {
    const cues = eventsToCues(events, p.playerId, GAME_ID, state.revision);
    for (const cue of cues) {
      if (cue.kind === 'cards_dealt' && cue.toPlayerId !== p.playerId) {
        out.push(`${p.playerId}: başkasının cards_dealt cue'su geldi`);
      }
      const paths = keyPaths(cue);
      for (const path of paths) {
        if (path.endsWith('role') || path.endsWith('party')) {
          out.push(`${p.playerId}: cue içinde gizli alan: ${cue.kind}.${path}`);
        }
      }
      if (cue.kind === 'player_eliminated' && 'role' in cue) {
        out.push('player_eliminated cue rol taşıyor');
      }
    }
  }
}

function runPrivacySweep(playerCount: number, seed: number, out: Violation[]): number {
  const rng = createRng(seed ^ 0x1234567);
  let state = createGame({ players: seats(playerCount), seed });
  let steps = 0;

  while (state.phase.kind !== 'game_over' && steps < 800) {
    // Her adımda TÜM oyuncular için görünüm denetle.
    const m = meta(state);
    const n = names(state);
    for (const p of state.players) {
      auditView(state, projectView(state, p.playerId, m, n), p.playerId, out);
    }

    // Gerçek sunucu yolu: yalnız projectActions'ın verdiği seçenekler.
    const phaseId = phaseIdOf(state, GAME_ID);
    const candidates: { playerId: string; actionId: string; optionId: string | undefined }[] = [];
    for (const p of state.players) {
      for (const action of projectActions(state, p.playerId, phaseId)) {
        if (action.options.length === 0) {
          candidates.push({ playerId: p.playerId, actionId: action.actionId, optionId: undefined });
          continue;
        }
        for (const option of action.options) {
          candidates.push({
            playerId: p.playerId,
            actionId: action.actionId,
            optionId: option.optionId,
          });
        }
      }
    }
    if (candidates.length === 0) {
      out.push(`kilitlenme: ${state.phase.kind} aşamasında hiçbir oyuncunun eylemi yok`);
      break;
    }
    const chosen = candidates[Math.floor(rng() * candidates.length)] as (typeof candidates)[number];
    const resolved = resolveEngineCommand(
      state,
      chosen.playerId,
      GAME_ID,
      phaseId,
      chosen.actionId,
      chosen.optionId,
    );
    if (!resolved.ok) {
      out.push(`resolveEngineCommand reddetti: ${resolved.error} (${state.phase.kind})`);
      break;
    }
    const applied = applyCommand(state, resolved.command);
    if (!applied.ok) {
      out.push(`applyCommand reddetti: ${applied.code} (${state.phase.kind})`);
      break;
    }
    auditCues(applied.state, applied.events, out);
    state = applied.state;
    steps += 1;
  }

  // Oyun sonu görünümü de denetlenir (result açıldı).
  const m = meta(state);
  const n = names(state);
  for (const p of state.players) {
    auditView(state, projectView(state, p.playerId, m, n), p.playerId, out);
  }
  return steps;
}

describe('projectView — sistematik gizlilik süpürmesi', () => {
  for (const playerCount of [5, 6, 7, 8, 9, 10]) {
    it(`${playerCount} oyuncu × 12 rastgele oyun, her adımda her oyuncunun görünümü`, () => {
      const out: Violation[] = [];
      for (let i = 0; i < 12; i += 1) {
        runPrivacySweep(playerCount, playerCount * 7919 + i, out);
      }
      expect([...new Set(out)].slice(0, 15)).toEqual([]);
    });
  }
});

describe('projectView — noktasal gizlilik kontrolleri', () => {
  it('Hitler 5-6 oyuncuda faşisti bilir, 7+ oyuncuda bilmez', () => {
    for (const count of [5, 6, 7, 8, 9, 10]) {
      const state = createGame({ players: seats(count), seed: 99 });
      const hitler = state.players.find((p) => p.role === 'hitler') as { playerId: string };
      const view = projectView(state, hitler.playerId, meta(state), names(state));
      const team = view.privateView.knownPlayers.filter((k) => k.source === 'hitler_knows_fascists');
      if (count <= 6) {
        expect(team.length).toBe(state.roleSetup.fascists);
      } else {
        expect(team).toEqual([]);
        expect(view.privateView.knownPlayers).toEqual([]);
      }
    }
  });

  it('faşistler birbirini ve Hitler’i bilir; liberaller kimseyi bilmez', () => {
    const state = createGame({ players: seats(9), seed: 7 });
    for (const p of state.players) {
      const view = projectView(state, p.playerId, meta(state), names(state));
      const known = view.privateView.knownPlayers;
      if (p.role === 'fascist') {
        const expected = state.players.filter(
          (o) => o.playerId !== p.playerId && o.role !== 'liberal',
        ).length;
        expect(known.length).toBe(expected);
      } else {
        expect(known).toEqual([]);
      }
    }
  });

  it('oylama sırasında başkasının oy tercihi görünmez, yalnız hasVoted', () => {
    let state = createGame({ players: seats(5), seed: 3, overrides: { firstPresidentSeat: 0 } });
    for (const p of state.players) {
      const r = applyCommand(state, { type: 'ack_role', playerId: p.playerId });
      if (!r.ok) throw new Error(r.code);
      state = r.state;
    }
    const nominate = applyCommand(state, {
      type: 'nominate',
      playerId: 'p1',
      chancellorId: 'p2',
    });
    if (!nominate.ok) throw new Error(nominate.code);
    const voted = applyCommand(nominate.state, { type: 'vote', playerId: 'p1', vote: 'no' });
    if (!voted.ok) throw new Error(voted.code);
    state = voted.state;

    const mine = projectView(state, 'p1', meta(state), names(state));
    expect(mine.privateView.submittedVote).toBe('no');

    const other = projectView(state, 'p2', meta(state), names(state));
    expect(other.privateView.submittedVote).toBeNull();
    expect(other.players.find((p) => p.playerId === 'p1')?.hasVoted).toBe(true);
    // p1'in oy DEĞERİ hiçbir yerde yok (kendi oy düğmelerim hariç).
    expect(JSON.stringify(other.players)).not.toContain('vote');
    expect(JSON.stringify(other.privateView)).not.toContain('"no"');
    expect(JSON.stringify(other.table)).not.toContain('vote');
    expect(other.table.lastElection).toBeNull();
  });

  it('deste tepesi (policy_peek) yalnız başkana; publicHistory kart göstermez', () => {
    const state = createGame({ players: seats(5), seed: 11, overrides: { firstPresidentSeat: 0 } });
    state.fascistPolicies = 3;
    state.enactedPolicies = [
      { board: 'fascist', slotIndex: 0, policy: 'fascist' },
      { board: 'fascist', slotIndex: 1, policy: 'fascist' },
      { board: 'fascist', slotIndex: 2, policy: 'fascist' },
    ];
    state.deck = state.deck.slice(3);
    state.phase = {
      kind: 'executive_action',
      government: { presidentId: 'p1', chancellorId: 'p2' },
      power: 'policy_peek',
      inspection: null,
      targetId: null,
      resolved: false,
    };
    const used = applyCommand(state, { type: 'use_power', playerId: 'p1' });
    if (!used.ok) throw new Error(used.code);
    const next = used.state;

    const president = projectView(next, 'p1', meta(next), names(next));
    expect(president.privateView.inspection?.kind).toBe('policy_peek');

    for (const other of ['p2', 'p3', 'p4', 'p5']) {
      const view = projectView(next, other, meta(next), names(next));
      expect(view.privateView.inspection).toBeNull();
      expect(JSON.stringify(view)).not.toContain('upcoming');
      expect(view.table.currentPower?.power).toBe('policy_peek'); // yetki TÜRÜ açık
    }
    for (const entry of president.table.publicHistory) {
      if (entry.kind === 'power_used') expect('cards' in entry).toBe(false);
    }
  });

  it('inceleme sonucu yalnız başkana; hedef kimliği herkese açık', () => {
    const state = createGame({ players: seats(9), seed: 13, overrides: { firstPresidentSeat: 0 } });
    state.fascistPolicies = 1;
    state.enactedPolicies = [{ board: 'fascist', slotIndex: 0, policy: 'fascist' }];
    state.deck = state.deck.slice(1);
    state.phase = {
      kind: 'executive_action',
      government: { presidentId: 'p1', chancellorId: 'p2' },
      power: 'investigate_loyalty',
      inspection: null,
      targetId: null,
      resolved: false,
    };
    const used = applyCommand(state, { type: 'use_power', playerId: 'p1', targetId: 'p4' });
    if (!used.ok) throw new Error(used.code);
    const next = used.state;

    const president = projectView(next, 'p1', meta(next), names(next));
    expect(president.privateView.inspection).toEqual({
      kind: 'party_membership',
      targetId: 'p4',
      party: next.players.find((p) => p.playerId === 'p4')?.role === 'liberal' ? 'liberal' : 'fascist',
    });

    for (const other of ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']) {
      const view = projectView(next, other, meta(next), names(next));
      expect(view.privateView.inspection).toBeNull();
      expect(view.privateView.knownPlayers.some((k) => k.source === 'investigate_loyalty')).toBe(
        false,
      );
      // Kimin incelendiği herkese açık, SONUÇ değil.
      expect(view.table.currentPower).toEqual({
        power: 'investigate_loyalty',
        actorId: 'p1',
        targetId: 'p4',
      });
      expect(JSON.stringify(view.table.publicHistory)).not.toContain('"party"');
    }
  });

  it('infaz edilen oyuncunun rolü açılmaz', () => {
    const state = createGame({ players: seats(7), seed: 17, overrides: { firstPresidentSeat: 0 } });
    const victim = state.players.find((p) => p.role === 'fascist' && p.playerId !== 'p1');
    state.fascistPolicies = 4;
    state.enactedPolicies = Array.from({ length: 4 }, (_u, i) => ({
      board: 'fascist' as const,
      slotIndex: i,
      policy: 'fascist' as const,
    }));
    state.deck = state.deck.slice(4);
    state.phase = {
      kind: 'executive_action',
      government: { presidentId: 'p1', chancellorId: 'p2' },
      power: 'execution',
      inspection: null,
      targetId: null,
      resolved: false,
    };
    const used = applyCommand(state, {
      type: 'use_power',
      playerId: 'p1',
      targetId: victim?.playerId as string,
    });
    if (!used.ok) throw new Error(used.code);
    const next = used.state;

    for (const p of next.players) {
      const view = projectView(next, p.playerId, meta(next), names(next));
      const shown = view.players.find((x) => x.playerId === victim?.playerId);
      expect(shown?.alive).toBe(false);
      expect(Object.keys(shown ?? {})).not.toContain('role');
      if (p.role === 'liberal') expect(view.privateView.knownPlayers).toEqual([]);
    }
    const cues = eventsToCues(used.events, 'p3', GAME_ID, next.revision);
    const elim = cues.find((c) => c.kind === 'player_eliminated');
    expect(elim).toBeDefined();
    expect(Object.keys(elim ?? {})).not.toContain('role');
  });
});
