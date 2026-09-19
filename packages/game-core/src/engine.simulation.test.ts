/**
 * RULES-AUDIT 2026-09-12 — rastgele simülasyon (fuzz) testi.
 *
 * Her oyuncu sayısı (5-10) için çok sayıda tohumlu rastgele oyun oynanır. Her
 * adımda o aşamada izin verilen komutlardan rastgele biri uygulanır; sonra
 * değişmezler (invariant) kontrol edilir:
 *
 *  1. Toplam kart her zaman 17 (deste + çöp + tahta + elde tutulan).
 *  2. Roller oyun boyunca sabit; koltuk sırası sabit.
 *  3. Elenen oyuncu komut veremez (oy/adaylık/hedef olma).
 *  4. Oyun her zaman biter (adım sınırı 2000).
 *  5. Bitiş nedeni tahta/Hitler durumuyla tutarlı.
 *  6. Seçim sayacı 0-2 arasında kalır (3'e ulaşınca kaos + sıfırlama).
 *  7. Tur kısıtı (term limit) hiç ihlal edilmez.
 *  8. Yetki yalnız doğru faşist yuvada ve yuva başına bir kez tetiklenir.
 *  9. Kaos politikası yetki açmaz ve tur kısıtını siler.
 * 10. `applyCommand` saftır: girdi durumu değişmez, aynı komut aynı sonucu
 *     verir (sunucu `commandId` idempotentliğinin motor tarafı).
 * 11. Geçersiz komutlar durumu HİÇ değiştirmez (snapshot eşitliği).
 *
 * Rapor: `docs/qa/claude/RULES-AUDIT-2026-09-12.md`
 */

import { describe, expect, it } from 'vitest';

import { applyCommand } from './engine';
import type { EngineCommand } from './commands';
import { createRng } from './rng';
import type { Rng } from './rng';
import { eligibleChancellorIds, investigatableTargetIds, otherAliveTargetIds } from './selectors';
import { seatList } from './test-helpers';
import { createGame } from './setup';
import type { GameState } from './types';

const GAMES_PER_COUNT = 300;
const MAX_STEPS = 2000;
const PLAYER_COUNTS = [5, 6, 7, 8, 9, 10] as const;

// ---------------------------------------------------------------------------
// Yasal komut üretimi (motorun kendi seçicilerinden bağımsız kaba liste)
// ---------------------------------------------------------------------------

function legalCommands(s: GameState): EngineCommand[] {
  const { phase } = s;
  switch (phase.kind) {
    case 'role_reveal':
      return s.players
        .filter((p) => !phase.ackedPlayerIds.includes(p.playerId))
        .map((p): EngineCommand => ({ type: 'ack_role', playerId: p.playerId }));

    case 'nomination':
      return eligibleChancellorIds(s, phase.presidentId).map(
        (chancellorId): EngineCommand => ({
          type: 'nominate',
          playerId: phase.presidentId,
          chancellorId,
        }),
      );

    case 'voting': {
      const out: EngineCommand[] = [];
      for (const p of s.players) {
        if (!p.alive || phase.votes[p.playerId] !== undefined) continue;
        out.push({ type: 'vote', playerId: p.playerId, vote: 'yes' });
        out.push({ type: 'vote', playerId: p.playerId, vote: 'no' });
      }
      return out;
    }

    case 'legislative_president':
      return phase.drawnCards.map(
        (card): EngineCommand => ({
          type: 'discard_policy',
          playerId: phase.government.presidentId,
          cardId: card.cardId,
        }),
      );

    case 'legislative_chancellor': {
      const out: EngineCommand[] = phase.handCards.map(
        (card): EngineCommand => ({
          type: 'enact_policy',
          playerId: phase.government.chancellorId,
          cardId: card.cardId,
        }),
      );
      if (s.fascistPolicies >= s.layout.vetoUnlockAt && !phase.vetoRequested) {
        out.push({ type: 'request_veto', playerId: phase.government.chancellorId });
      }
      return out;
    }

    case 'veto_response':
      return [
        { type: 'respond_veto', playerId: phase.government.presidentId, accept: true },
        { type: 'respond_veto', playerId: phase.government.presidentId, accept: false },
      ];

    case 'executive_action': {
      const presidentId = phase.government.presidentId;
      if (phase.resolved) {
        return phase.inspection
          ? [{ type: 'ack_private_result', playerId: presidentId }]
          : [];
      }
      if (phase.power === 'policy_peek') {
        return [{ type: 'use_power', playerId: presidentId }];
      }
      const targets =
        phase.power === 'investigate_loyalty'
          ? investigatableTargetIds(s, presidentId)
          : otherAliveTargetIds(s, presidentId);
      return targets.map((targetId): EngineCommand => ({
        type: 'use_power',
        playerId: presidentId,
        targetId,
      }));
    }

    case 'game_over':
      return [];

    default:
      return [];
  }
}

/** Bu aşamada KESİNLİKLE reddedilmesi gereken komutlar (geçersiz komut süpürmesi). */
function illegalCommands(s: GameState): EngineCommand[] {
  const out: EngineCommand[] = [];
  const alive = s.players.filter((p) => p.alive);
  const dead = s.players.filter((p) => !p.alive);
  const someone = s.players[0]?.playerId ?? 'p1';

  // Oyuncu olmayan kimlik hiçbir aşamada kabul edilmez.
  out.push({ type: 'ack_role', playerId: 'YOK' });
  out.push({ type: 'vote', playerId: 'YOK', vote: 'yes' });
  out.push({ type: 'nominate', playerId: 'YOK', chancellorId: someone });
  out.push({ type: 'use_power', playerId: 'YOK' });

  // Elenen oyuncu hiçbir şey yapamaz ve şansölye adayı olamaz.
  for (const d of dead) {
    out.push({ type: 'vote', playerId: d.playerId, vote: 'yes' });
    out.push({ type: 'ack_role', playerId: d.playerId });
    out.push({ type: 'nominate', playerId: d.playerId, chancellorId: someone });
    out.push({ type: 'use_power', playerId: d.playerId, targetId: someone });
    out.push({ type: 'request_veto', playerId: d.playerId });
    out.push({ type: 'respond_veto', playerId: d.playerId, accept: true });
    out.push({ type: 'discard_policy', playerId: d.playerId, cardId: 'c0_0' });
    out.push({ type: 'enact_policy', playerId: d.playerId, cardId: 'c0_0' });
    out.push({ type: 'ack_private_result', playerId: d.playerId });
    if (s.phase.kind === 'nomination') {
      out.push({
        type: 'nominate',
        playerId: s.phase.presidentId,
        chancellorId: d.playerId,
      });
    }
  }

  // Bilinmeyen kart kimliği.
  if (s.phase.kind === 'legislative_president') {
    out.push({
      type: 'discard_policy',
      playerId: s.phase.government.presidentId,
      cardId: 'kart_yok',
    });
  }
  if (s.phase.kind === 'legislative_chancellor') {
    out.push({
      type: 'enact_policy',
      playerId: s.phase.government.chancellorId,
      cardId: 'kart_yok',
    });
  }

  // Aday kendini şansölye yapamaz; tur kısıtlı oyuncuyu seçemez.
  if (s.phase.kind === 'nomination') {
    const presidentId = s.phase.presidentId;
    out.push({ type: 'nominate', playerId: presidentId, chancellorId: presidentId });
    const eligible = new Set(eligibleChancellorIds(s, presidentId));
    for (const p of alive) {
      if (p.playerId !== presidentId && !eligible.has(p.playerId)) {
        out.push({ type: 'nominate', playerId: presidentId, chancellorId: p.playerId });
      }
    }
    // Başkan olmayan biri aday gösteremez.
    const other = alive.find((p) => p.playerId !== presidentId);
    if (other) {
      out.push({ type: 'nominate', playerId: other.playerId, chancellorId: presidentId });
    }
  }

  // Veto açılmadıysa istenemez.
  if (s.phase.kind === 'legislative_chancellor' && s.fascistPolicies < s.layout.vetoUnlockAt) {
    out.push({ type: 'request_veto', playerId: s.phase.government.chancellorId });
  }

  // Yetki aşamasında başkan olmayan kullanamaz.
  if (s.phase.kind === 'executive_action') {
    const presidentId = s.phase.government.presidentId;
    const other = alive.find((p) => p.playerId !== presidentId);
    if (other) out.push({ type: 'use_power', playerId: other.playerId, targetId: presidentId });
    out.push({ type: 'use_power', playerId: presidentId, targetId: presidentId });
    if (s.phase.power !== 'policy_peek') {
      out.push({ type: 'use_power', playerId: presidentId }); // hedef gerekli
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Değişmez kontrolleri
// ---------------------------------------------------------------------------

const TOTAL_CARDS = 17;

function heldCardCount(s: GameState): number {
  const { phase } = s;
  if (phase.kind === 'legislative_president') return phase.drawnCards.length;
  if (phase.kind === 'legislative_chancellor' || phase.kind === 'veto_response') {
    return phase.handCards.length;
  }
  return 0;
}

function cardTotal(s: GameState): number {
  return s.deck.length + s.discard.length + s.enactedPolicies.length + heldCardCount(s);
}

function deckComposition(s: GameState): { liberal: number; fascist: number } {
  const pool: string[] = [...s.deck, ...s.discard, ...s.enactedPolicies.map((e) => e.policy)];
  const { phase } = s;
  if (phase.kind === 'legislative_president') pool.push(...phase.drawnCards.map((c) => c.policy));
  if (phase.kind === 'legislative_chancellor' || phase.kind === 'veto_response') {
    pool.push(...phase.handCards.map((c) => c.policy));
  }
  return {
    liberal: pool.filter((c) => c === 'liberal').length,
    fascist: pool.filter((c) => c === 'fascist').length,
  };
}

type GameStats = {
  steps: number;
  endReason: string;
  doubleInvestigations: number;
  chaosCount: number;
  executions: number;
};

type Violation = { seed: number; playerCount: number; step: number; message: string };

function pick<T>(list: readonly T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)] as T;
}

function runOne(playerCount: number, seed: number, violations: Violation[]): GameStats {
  const rng = createRng(seed ^ 0x5f3759df);
  let s = createGame({ players: seatList(playerCount), seed });

  const initialRoles = new Map(s.players.map((p) => [p.playerId, p.role]));
  const initialSeats = new Map(s.players.map((p) => [p.playerId, p.seatIndex]));
  const hitlerId = s.players.find((p) => p.role === 'hitler')?.playerId as string;
  const powerSlots = new Set<number>();
  const investigatedTargets = new Map<string, number>();
  let chaosCount = 0;
  let executions = 0;
  let steps = 0;

  const fail = (message: string): void => {
    violations.push({ seed, playerCount, step: steps, message });
  };

  // Geçersiz komut süpürmesini her adımda yapmak pahalı: oyun başına rastgele
  // birkaç adımda çalıştırılır (her oyunda en az bir kez).
  const sweepAt = new Set<number>([0, 1 + Math.floor(rng() * 20), 1 + Math.floor(rng() * 60)]);

  while (s.phase.kind !== 'game_over') {
    if (steps >= MAX_STEPS) {
      fail(`oyun ${MAX_STEPS} adımda bitmedi (aşama: ${s.phase.kind})`);
      break;
    }

    const commands = legalCommands(s);
    if (commands.length === 0) {
      fail(`kilitlenme: ${s.phase.kind} aşamasında yasal komut yok`);
      break;
    }

    // --- (11) Geçersiz komutlar durumu değiştirmez ---
    if (sweepAt.has(steps)) {
      const before = structuredClone(s);
      for (const bad of illegalCommands(s)) {
        const res = applyCommand(s, bad);
        if (res.ok) {
          fail(`geçersiz komut KABUL edildi: ${JSON.stringify(bad)} (${s.phase.kind})`);
        }
      }
      if (JSON.stringify(s) !== JSON.stringify(before)) {
        fail('geçersiz komut süpürmesi durumu değiştirdi');
      }
    }

    const command = pick(commands, rng);

    // --- (7) Tur kısıtı: bağımsız kontrol ---
    if (command.type === 'nominate') {
      const aliveTotal = s.players.filter((p) => p.alive).length;
      const last = s.lastGovernment;
      if (last) {
        if (command.chancellorId === last.chancellorId) {
          fail('tur kısıtı: son şansölye yeniden aday gösterildi');
        }
        if (aliveTotal > 5 && command.chancellorId === last.presidentId) {
          fail('tur kısıtı: son başkan (>5 hayatta) şansölye aday gösterildi');
        }
      }
      if (command.chancellorId === command.playerId) fail('aday kendini şansölye seçti');
      const target = s.players.find((p) => p.playerId === command.chancellorId);
      if (!target?.alive) fail('elenen oyuncu şansölye aday gösterildi');
    }

    if (command.type === 'use_power' && s.phase.kind === 'executive_action') {
      if (s.phase.power === 'investigate_loyalty' && command.targetId) {
        const seen = investigatedTargets.get(command.targetId) ?? 0;
        investigatedTargets.set(command.targetId, seen + 1);
      }
      if (s.phase.power === 'execution') executions += 1;
    }

    // --- (10) Saflık + belirlenimcilik ---
    const snapshot = JSON.stringify(s);
    const first = applyCommand(s, command);
    if (JSON.stringify(s) !== snapshot) fail('applyCommand girdi durumunu DEĞİŞTİRDİ');
    const second = applyCommand(s, command);
    if (JSON.stringify(first) !== JSON.stringify(second)) {
      fail('aynı durum + aynı komut farklı sonuç verdi (belirlenimcilik)');
    }
    if (!first.ok) {
      fail(`yasal sayılan komut reddedildi: ${first.code} ${JSON.stringify(command)}`);
      break;
    }

    // `string` olarak tutulur: aksi halde TS bunu `s.phase` için ayrık birleşim
    // takma adı sayıp aşağıdaki kontrolü `never`e daraltıyor.
    const prevPhaseKind: string = s.phase.kind;
    const prevChaos = s.log.filter((e) => e.kind === 'chaos_policy').length;
    const prevFascist = s.fascistPolicies;
    const prevLiberal = s.liberalPolicies;
    s = first.state;
    steps += 1;

    // --- (1) Kart korunumu ---
    if (cardTotal(s) !== TOTAL_CARDS) {
      fail(`toplam kart ${cardTotal(s)} (17 olmalı) — ${prevPhaseKind} -> ${s.phase.kind}`);
    }
    const comp = deckComposition(s);
    if (comp.liberal !== 6 || comp.fascist !== 11) {
      fail(`deste bileşimi bozuldu: ${comp.liberal}L/${comp.fascist}F`);
    }

    // --- (2) Roller ve koltuklar sabit ---
    for (const p of s.players) {
      if (initialRoles.get(p.playerId) !== p.role) fail(`rol değişti: ${p.playerId}`);
      if (initialSeats.get(p.playerId) !== p.seatIndex) fail(`koltuk değişti: ${p.playerId}`);
    }

    // --- (6) Seçim sayacı 0..2 ---
    if (s.electionTracker < 0 || s.electionTracker >= 3) {
      fail(`seçim sayacı sınır dışı: ${s.electionTracker}`);
    }

    // Politika konulduysa sayaç sıfırlanmış olmalı.
    if (s.fascistPolicies > prevFascist || s.liberalPolicies > prevLiberal) {
      if (s.electionTracker !== 0) fail('politika yürürlüğe girdi ama sayaç sıfırlanmadı');
    }

    // --- (9) Kaos: yetki açılmaz, tur kısıtı silinir ---
    const chaosNow = s.log.filter((e) => e.kind === 'chaos_policy').length;
    if (chaosNow > prevChaos) {
      chaosCount += chaosNow - prevChaos;
      if (s.phase.kind === 'executive_action') {
        fail('kaos politikası yürütme yetkisi açtı');
      }
      if (s.lastGovernment !== null) fail('kaos sonrası tur kısıtı silinmedi');
    }

    // --- (8) Yetki doğru yuvada ve bir kez ---
    if (s.phase.kind === 'executive_action' && prevPhaseKind !== 'executive_action') {
      const slot = s.fascistPolicies - 1;
      const expected = s.layout.fascistPowers[slot];
      if (s.phase.power !== expected) {
        fail(`yuva ${slot} yetkisi ${s.phase.power}, beklenen ${expected}`);
      }
      if (powerSlots.has(slot)) fail(`yuva ${slot} yetkisi ikinci kez tetiklendi`);
      powerSlots.add(slot);
    }

    // --- (3) Elenen oyuncu sıra sahibi olamaz ---
    const activePresident =
      s.phase.kind === 'nomination' || s.phase.kind === 'voting'
        ? s.phase.presidentId
        : s.phase.kind === 'legislative_president' ||
            s.phase.kind === 'legislative_chancellor' ||
            s.phase.kind === 'veto_response' ||
            s.phase.kind === 'executive_action'
          ? s.phase.government.presidentId
          : null;
    if (activePresident) {
      const p = s.players.find((x) => x.playerId === activePresident);
      if (!p?.alive) fail('elenen oyuncu başkan/aday oldu');
    }
    if (s.phase.kind === 'voting') {
      for (const id of Object.keys(s.phase.votes)) {
        if (!s.players.find((p) => p.playerId === id)?.alive) fail('elenen oyuncunun oyu kayıtlı');
      }
    }
  }

  // --- (4)(5) Bitiş nedeni tutarlılığı ---
  if (s.phase.kind !== 'game_over') {
    fail('oyun bitmedi');
    return {
      steps,
      endReason: 'BITMEDI',
      doubleInvestigations: 0,
      chaosCount,
      executions,
    };
  }

  const reason = s.endReason as string;
  const winner = s.winner;
  if (reason === 'liberal_policies_enacted') {
    if (winner !== 'liberal' || s.liberalPolicies !== 5) fail('liberal kanun zaferi tutarsız');
  } else if (reason === 'fascist_policies_enacted') {
    if (winner !== 'fascist' || s.fascistPolicies !== 6) fail('faşist kanun zaferi tutarsız');
  } else if (reason === 'hitler_elected_chancellor') {
    if (winner !== 'fascist' || s.fascistPolicies < 3) fail('Hitler şansölye zaferi tutarsız');
    if (s.lastGovernment?.chancellorId !== hitlerId) fail('Hitler şansölye değil ama bu neden');
  } else if (reason === 'hitler_executed') {
    if (winner !== 'liberal') fail('Hitler infazı liberal zafer olmalı');
    if (s.players.find((p) => p.playerId === hitlerId)?.alive) fail('Hitler yaşıyor ama bu neden');
  } else {
    fail(`bilinmeyen bitiş nedeni: ${reason}`);
  }
  if (s.liberalPolicies > 5) fail(`liberal yuva aşıldı: ${s.liberalPolicies}`);
  if (s.fascistPolicies > 6) fail(`faşist yuva aşıldı: ${s.fascistPolicies}`);
  if (s.phase.kind === 'game_over' && (s.phase.winner !== winner || s.phase.reason !== reason)) {
    fail('faz ile durum bitiş bilgisi uyuşmuyor');
  }

  let doubleInvestigations = 0;
  for (const [, n] of investigatedTargets) if (n > 1) doubleInvestigations += 1;

  return { steps, endReason: reason, doubleInvestigations, chaosCount, executions };
}

// ---------------------------------------------------------------------------
// Testler
// ---------------------------------------------------------------------------

describe('rastgele simülasyon — motor değişmezleri', () => {
  const summary: string[] = [];
  let totalDoubleInvestigationGames = 0;

  for (const playerCount of PLAYER_COUNTS) {
    // Tohumlu fuzz: 300 oyun × 6 masa boyu varsayılan 5 s sınırını aşar.
    it(`${playerCount} oyuncu × ${GAMES_PER_COUNT} rastgele oyun`, { timeout: 120_000 }, () => {
      const violations: Violation[] = [];
      const reasons = new Map<string, number>();
      let totalSteps = 0;
      let chaos = 0;
      let executions = 0;
      let doubleInvestigationGames = 0;

      for (let i = 0; i < GAMES_PER_COUNT; i += 1) {
        const seed = playerCount * 1_000_003 + i;
        const stats = runOne(playerCount, seed, violations);
        totalSteps += stats.steps;
        chaos += stats.chaosCount;
        executions += stats.executions;
        if (stats.doubleInvestigations > 0) doubleInvestigationGames += 1;
        reasons.set(stats.endReason, (reasons.get(stats.endReason) ?? 0) + 1);
      }

      totalDoubleInvestigationGames += doubleInvestigationGames;
      const dist = [...reasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      summary.push(
        `${playerCount} kişi | oyun ${GAMES_PER_COUNT} | ort. adım ${(
          totalSteps / GAMES_PER_COUNT
        ).toFixed(1)} | kaos ${chaos} | infaz ${executions} | çift inceleme oyunu ${doubleInvestigationGames} | ${dist}`,
      );

      if (violations.length > 0) {
        const shown = violations
          .slice(0, 10)
          .map((v) => `seed=${v.seed} n=${v.playerCount} adım=${v.step}: ${v.message}`)
          .join('\n');
        throw new Error(`${violations.length} değişmez ihlali:\n${shown}`);
      }
      expect(violations).toEqual([]);
    });
  }

  it('özet (rapor için)', () => {
    // Vitest çıktısında görünür; RULES-AUDIT raporuna bu satırlar yazılır.
    // eslint-disable-next-line no-console
    console.log(['SIMULASYON ÖZETİ', ...summary].join('\n'));
    // eslint-disable-next-line no-console
    console.log(
      `Aynı oyuncunun iki kez incelendiği oyun sayısı (resmî kural ihlali, bulgu B1): ${totalDoubleInvestigationGames}`,
    );
    expect(summary.length).toBe(PLAYER_COUNTS.length);
  });
});

describe('RULES-AUDIT bulgu B1 — "No player may be investigated twice in the same game"', () => {
  /**
   * Resmî kural (Secret_Hitler_Rules.pdf, PRESIDENTIAL POWERS):
   *   "No player may be investigated twice in the same game."
   *
   * D18/B1 DÜZELTİLDİ: kısıt artık (başkan, hedef) çifti değil, YALNIZ hedef
   * üzerinedir (`selectors.ts` `investigatableTargetIds`, `engine.ts`
   * `investigate_loyalty`). 9-10 kişilik düzende iki `investigate_loyalty`
   * yuvası olduğu için bu durum gerçek oyunda oluşuyordu; artık ikinci deneme
   * hem hedef listesinde görünmez hem de motorda `INVALID_TARGET` ile reddedilir.
   */
  it('farklı başkan da aynı oyuncuyu ikinci kez inceleyemez (D18/B1)', () => {
    const s = createGame({
      players: seatList(9),
      seed: 1,
      overrides: {
        roles: {
          p1: 'fascist',
          p2: 'liberal',
          p3: 'liberal',
          p4: 'liberal',
          p5: 'liberal',
          p6: 'liberal',
          p7: 'fascist',
          p8: 'fascist',
          p9: 'hitler',
        },
        firstPresidentSeat: 0,
      },
    });

    // p1 p3'ü inceler.
    const state = structuredClone(s);
    state.investigations.push({ actorId: 'p1', targetId: 'p3', party: 'liberal' });
    state.fascistPolicies = 2;
    state.enactedPolicies = [
      { board: 'fascist', slotIndex: 0, policy: 'fascist' },
      { board: 'fascist', slotIndex: 1, policy: 'fascist' },
    ];
    state.deck = state.deck.slice(2);
    state.phase = {
      kind: 'executive_action',
      government: { presidentId: 'p2', chancellorId: 'p4' },
      power: 'investigate_loyalty',
      inspection: null,
      targetId: null,
      resolved: false,
    };

    // p3 zaten incelendi: BAŞKA başkan (p2) için de hedef listesinde değil.
    expect(investigatableTargetIds(state, 'p2')).not.toContain('p3');
    const res = applyCommand(state, { type: 'use_power', playerId: 'p2', targetId: 'p3' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_TARGET');

    // Hiç incelenmemiş bir oyuncu hâlâ seçilebilir (kısıt yalnız tekrarı keser).
    expect(investigatableTargetIds(state, 'p2')).toContain('p4');
    expect(applyCommand(state, { type: 'use_power', playerId: 'p2', targetId: 'p4' }).ok).toBe(true);
  });

  it('aynı başkan aynı oyuncuyu ikinci kez inceleyemez (bu kısım doğru)', () => {
    const state = createGame({ players: seatList(9), seed: 2, overrides: { firstPresidentSeat: 0 } });
    state.investigations.push({ actorId: 'p1', targetId: 'p3', party: 'liberal' });
    state.fascistPolicies = 1;
    state.enactedPolicies = [{ board: 'fascist', slotIndex: 0, policy: 'fascist' }];
    state.deck = state.deck.slice(1);
    state.phase = {
      kind: 'executive_action',
      government: { presidentId: 'p1', chancellorId: 'p4' },
      power: 'investigate_loyalty',
      inspection: null,
      targetId: null,
      resolved: false,
    };
    const res = applyCommand(state, { type: 'use_power', playerId: 'p1', targetId: 'p3' });
    expect(res.ok).toBe(false);
  });
});
