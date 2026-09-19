/**
 * D14 (D19'da genişletildi) — YALNIZ GELİŞTİRME senaryo atlaması.
 *
 * Geç aşamaları (D12 infaz sahnesi, yürütme yetkileri, veto, Hitler bölgesi,
 * kaos) oyunu baştan oynamadan denemek için durumu ileri sarar. Saf işlev:
 * girdiyi değiştirmez, `structuredClone` kopyası üzerinde çalışır ve
 * `applyCommand` ile aynı sonuç/hata birliğini döner.
 *
 * **Gizlilik ve bütünlük kuralları (docs/ROADMAP.md D14):**
 * - Roller DEĞİŞMEZ.
 * - Oyuncuların gizli elleri DEĞİŞMEZ (bu senaryolar yasama aşamasında çalışmaz;
 *   el taşıyan aşamalar yeni faza geçerken kartlar desteye/çöpe geri konur).
 * - Deste İÇERİĞİ değişmez: 6 liberal + 11 faşist toplamı ve kartların kimliği
 *   korunur; yalnız SIRA değişir ve tahtaya konan kartlar aynı havuzdan alınır.
 * - Sunucu bu işlevi yalnız `SECRET_TABLE_DEV_TOOLS=1` iken çağırır.
 */

import type { DevScenarioName, ExecutivePower } from '@secret-table/contracts';
import {
  CHANCELLOR_DRAW_COUNT,
  ELECTION_TRACKER_MAX,
  PRESIDENT_DRAW_COUNT,
} from '@secret-table/contracts';

import { EngineError } from './errors';
import type { EngineErrorCode } from './errors';
import type { GameEvent } from './events';
import type { DealtCard, EnginePlayer, GameState, Government, PolicyCard } from './types';

export type DevScenarioInput = {
  scenario: DevScenarioName;
  /** Senaryonun merkezine alınacak oyuncu (yerel oyuncu). */
  actorId: string;
};

export type DevScenarioResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; code: EngineErrorCode };

/**
 * Durumu istenen senaryoya kurar. Başarılıysa `revision` bir artar ve
 * `phaseSeq` yeni faz kimliği üretecek biçimde ilerler.
 */
export function devScenario(state: GameState, input: DevScenarioInput): DevScenarioResult {
  const s = structuredClone(state);
  const events: GameEvent[] = [];

  try {
    if (s.phase.kind === 'game_over') throw new EngineError('GAME_OVER');
    const actor = s.players.find((p) => p.playerId === input.actorId);
    if (!actor) throw new EngineError('NOT_A_PLAYER');
    if (!actor.alive) throw new EngineError('PLAYER_DEAD');

    switch (input.scenario) {
      case 'execution_now':
        setupPowerNow(s, events, actor, 'execution');
        break;
      case 'execution_round':
        setupExecutionRound(s, actor);
        break;
      case 'investigate_now':
        setupPowerNow(s, events, actor, 'investigate_loyalty');
        break;
      case 'special_election_now':
        setupPowerNow(s, events, actor, 'call_special_election');
        break;
      case 'policy_peek_now':
        setupPowerNow(s, events, actor, 'policy_peek');
        break;
      case 'veto_round':
        setupVetoRound(s, events, actor, 'chancellor');
        break;
      case 'veto_round_president':
        setupVetoRound(s, events, actor, 'president');
        break;
      case 'hitler_zone_round':
        setupHitlerZoneRound(s, actor);
        break;
      case 'chaos_round':
        setupChaosRound(s, actor);
        break;
      default: {
        const _exhaustive: never = input.scenario;
        void _exhaustive;
        throw new EngineError('WRONG_PHASE');
      }
    }

    s.revision += 1;
    return { ok: true, state: s, events };
  } catch (error) {
    if (error instanceof EngineError) return { ok: false, code: error.code };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Senaryolar
// ---------------------------------------------------------------------------

/**
 * Faz doğrudan yürütme yetkisi: `currentPower = { power, actorId, targetId:
 * null }`. Faşist sayaç bu düzenin İLK `power` yuvasına eşitlenir (ör. infaz
 * 5-6 / 7-8 / 9-10 düzenlerinde yuva 4). Seçim sayacı sıfırlanır, başkanlık
 * ofisi `actorId`'ye taşınır.
 *
 * D19: yetki bu tahta düzeninde yoksa `SCENARIO_NEEDS_PLAYERS`. D21/I — eşleme
 * artık açıkça yazılı (eski yorum ters okunabiliyordu), kaynak
 * `contracts/rules.ts` `BOARD_LAYOUTS`:
 *  - `policy_peek` YALNIZ 5-6 kişilik düzende var (7+ masada yoktur),
 *  - `investigate_loyalty` YALNIZ 7-10 kişilik düzende var (5-6 masada yoktur),
 *  - `call_special_election` 7-10, `execution` her düzende.
 */
function setupPowerNow(
  s: GameState,
  events: GameEvent[],
  actor: EnginePlayer,
  power: ExecutivePower,
): void {
  const slot = firstPowerSlot(s, power);
  releaseHeldCards(s);
  setFascistBoard(s, slot);
  s.electionTracker = 0;
  s.specialElection = null;
  s.presidentSeat = actor.seatIndex;

  const chancellorId = pickChancellorId(s, actor.playerId);
  const government: Government = { presidentId: actor.playerId, chancellorId };
  s.lastGovernment = { ...government };

  s.phaseSeq += 1;
  s.phase = {
    kind: 'executive_action',
    government,
    power,
    inspection: null,
    targetId: null,
    resolved: false,
  };

  events.push({ kind: 'office_moved', office: 'president', toPlayerId: government.presidentId });
  events.push({ kind: 'office_moved', office: 'chancellor', toPlayerId: government.chancellorId });
}

/**
 * Bir tur öncesi: faşist sayaç ilk infaz yuvasının BİR EKSİĞİ, aday belirleme
 * fazı ve başkan `actorId`. Destenin üstündeki ilk 3 kart faşist olacak biçimde
 * yeniden dizilir (kart EKLENMEZ), böylece seçilen hükümet ne yaparsa yapsın
 * faşist kanun geçer ve infaz yetkisi açılır.
 */
function setupExecutionRound(s: GameState, actor: EnginePlayer): void {
  const slot = firstPowerSlot(s, 'execution');
  releaseHeldCards(s);
  setFascistBoard(s, slot - 1);
  s.electionTracker = 0;
  s.specialElection = null;
  s.presidentSeat = actor.seatIndex;
  // Tur kısıtı kalksın: her hayatta oyuncu şansölye adayı olabilsin.
  s.lastGovernment = null;

  stackFascistTop(s, PRESIDENT_DRAW_COUNT);

  s.phaseSeq += 1;
  s.phase = { kind: 'nomination', presidentId: actor.playerId };
}

/**
 * D19 — veto turu. Faşist sayaç `vetoUnlockAt`e (5) çıkar ve yasama aşaması
 * ŞANSÖLYE elinde 2 FAŞİST kartla kurulur, böylece veto gerçekten anlamlıdır.
 *
 * - `local === 'chancellor'`: yerel oyuncu şansölye, başkan sıradaki oyuncu
 *   (dev odasında bot) → yerel oyuncu "veto öner" düğmesini görür.
 * - `local === 'president'`: doğrudan `veto_response` fazı; yerel oyuncu
 *   başkandır ve veto isteğini kabul/ret edebilir (şansölye bot).
 *
 * Kart korunumu: eldeki kartlar önce çöpe döner, sonra desteden 2 kart ALINIR
 * (kart yaratılmaz); toplam yine 17.
 */
function setupVetoRound(
  s: GameState,
  events: GameEvent[],
  actor: EnginePlayer,
  local: 'chancellor' | 'president',
): void {
  releaseHeldCards(s);
  setFascistBoard(s, s.layout.vetoUnlockAt);
  // Seçim sayacı KORUNUR (D19): `chaos_round` ile sayaç 2'ye çekilip veto kabul
  // edilirse üçüncü başarısız seçim → kaos, oyun rastgele oylamaya bırakılmadan
  // denenebilir. Senaryo yalnız gerekli alanları değiştirir.
  s.specialElection = null;

  const other = pickChancellorId(s, actor.playerId);
  const government: Government =
    local === 'chancellor'
      ? { presidentId: other, chancellorId: actor.playerId }
      : { presidentId: actor.playerId, chancellorId: other };
  s.lastGovernment = { ...government };
  s.presidentSeat = playerOf(s, government.presidentId).seatIndex;

  const handCards = takeHand(s, CHANCELLOR_DRAW_COUNT);

  s.phaseSeq += 1;
  s.phase =
    local === 'chancellor'
      ? { kind: 'legislative_chancellor', government, handCards, vetoRequested: false }
      : { kind: 'veto_response', government, handCards };

  events.push({ kind: 'office_moved', office: 'president', toPlayerId: government.presidentId });
  events.push({ kind: 'office_moved', office: 'chancellor', toPlayerId: government.chancellorId });
}

/**
 * D19 — Hitler bölgesi. Faşist sayaç `hitlerChancellorWinAt`e (3) çıkar ve
 * yerel oyuncu BAŞKAN olarak aday belirleme fazına alınır. Tur kısıtı kalkar
 * (`lastGovernment = null`) ki Hitler de aday gösterilebilsin; Hitler seçilirse
 * motor `hitler_elected_chancellor` ile faşist zaferi verir.
 */
function setupHitlerZoneRound(s: GameState, actor: EnginePlayer): void {
  releaseHeldCards(s);
  setFascistBoard(s, s.layout.hitlerChancellorWinAt);
  s.electionTracker = 0;
  s.specialElection = null;
  s.presidentSeat = actor.seatIndex;
  s.lastGovernment = null;

  s.phaseSeq += 1;
  s.phase = { kind: 'nomination', presidentId: actor.playerId };
}

/**
 * D19 — kaos turu. Seçim sayacı `ELECTION_TRACKER_MAX - 1` (2) olur ve yerel
 * oyuncu başkan olarak aday belirler: bir sonraki BAŞARISIZ seçim (veya kabul
 * edilen veto) destenin tepesini otomatik yürürlüğe koyar, tur kısıtları
 * sıfırlanır ve yetki AÇILMAZ.
 *
 * Tahta değişmez. Kısıtların gerçekten sıfırlandığı görülebilsin diye
 * `lastGovernment` yerel oyuncu DIŞINDAKİ iki koltuğa kurulur.
 */
function setupChaosRound(s: GameState, actor: EnginePlayer): void {
  releaseHeldCards(s);
  s.electionTracker = ELECTION_TRACKER_MAX - 1;
  s.specialElection = null;
  s.presidentSeat = actor.seatIndex;

  const pastPresident = pickChancellorId(s, actor.playerId);
  const pastChancellor = pickChancellorId(s, pastPresident, [actor.playerId]);
  s.lastGovernment = { presidentId: pastPresident, chancellorId: pastChancellor };

  s.phaseSeq += 1;
  s.phase = { kind: 'nomination', presidentId: actor.playerId };
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

/**
 * Bu düzenin ilk `power` yuvasının 1 tabanlı numarası (faşist politika sayısı).
 * Yetki bu düzende yoksa senaryo oyuncu sayısına uymuyor demektir.
 */
function firstPowerSlot(s: GameState, power: ExecutivePower): number {
  const index = s.layout.fascistPowers.indexOf(power);
  if (index < 0) throw new EngineError('SCENARIO_NEEDS_PLAYERS');
  return index + 1;
}

function playerOf(s: GameState, playerId: string): EnginePlayer {
  const found = s.players.find((p) => p.playerId === playerId);
  if (!found) throw new EngineError('NOT_A_PLAYER');
  return found;
}

/**
 * Destenin üstünden `count` FAŞİST kart alır ve `DealtCard`e çevirir. Kart
 * yaratılmaz: `stackFascistTop` yalnız SIRAYI değiştirir, sonra kartlar
 * desteden çıkar ve ele geçer (toplam 17 korunur). `cardId` motorun
 * `dealCards` biçimiyle aynıdır (`c<phaseSeq>_<index>`), böylece istemci
 * tarafında ayırt edilemez.
 */
function takeHand(s: GameState, count: number): DealtCard[] {
  stackFascistTop(s, count);
  const taken = s.deck.slice(0, count);
  if (taken.length < count) throw new EngineError('UNKNOWN_CARD');
  s.deck = s.deck.slice(count);
  // `phaseSeq` bu çağrıdan sonra artırılacağı için kimlikte +1 kullanılır.
  return taken.map((policy, index) => ({ cardId: `c${s.phaseSeq + 1}_${index}`, policy }));
}

/**
 * Başkan dışında hayatta ilk oyuncu (koltuk sırasında başkandan sonraki).
 * `exclude` içindeki oyuncular da atlanır (D19 kaos senaryosu).
 */
function pickChancellorId(
  s: GameState,
  presidentId: string,
  exclude: readonly string[] = [],
): string {
  const seats = [...s.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const start = seats.findIndex((p) => p.playerId === presidentId);
  for (let step = 1; step <= seats.length; step += 1) {
    const candidate = seats[(start + step) % seats.length];
    if (
      candidate &&
      candidate.alive &&
      candidate.playerId !== presidentId &&
      !exclude.includes(candidate.playerId)
    ) {
      return candidate.playerId;
    }
  }
  throw new EngineError('INVALID_TARGET');
}

/**
 * Yasama/veto aşamasında elde tutulan kartları çöpe geri koyar. Böylece toplam
 * kart sayısı (deste + çöp + tahta = 17) her senaryoda korunur ve hiçbir gizli
 * el yeni faza sızmaz.
 */
function releaseHeldCards(s: GameState): void {
  const { phase } = s;
  if (phase.kind === 'legislative_president') {
    for (const card of phase.drawnCards) s.discard.push(card.policy);
  } else if (phase.kind === 'legislative_chancellor' || phase.kind === 'veto_response') {
    for (const card of phase.handCards) s.discard.push(card.policy);
  }
}

/**
 * Faşist tahtayı `target` yuvaya getirir. Eksikse deste/çöp havuzundan faşist
 * kart ÇEKİLİR (kart yaratılmaz), fazlaysa tahtadaki kart destenin altına döner.
 * Liberal tahta ve kart kimlikleri etkilenmez.
 */
function setFascistBoard(s: GameState, target: number): void {
  if (target < 0) throw new EngineError('WRONG_PHASE');
  if (target >= s.layout.fascistSlots) throw new EngineError('WRONG_PHASE');

  let current = s.enactedPolicies.filter((e) => e.board === 'fascist').length;

  while (current > target) {
    const index = lastIndexOf(s.enactedPolicies, (e) => e.board === 'fascist');
    if (index < 0) break;
    s.enactedPolicies.splice(index, 1);
    s.deck.push('fascist');
    current -= 1;
  }

  while (current < target) {
    takeFascistCard(s);
    s.enactedPolicies.push({ board: 'fascist', slotIndex: current, policy: 'fascist' });
    s.log.push({ seq: s.seq, kind: 'policy_enacted', board: 'fascist', policy: 'fascist' });
    s.seq += 1;
    current += 1;
  }

  // Yuva numaraları 0..n-1 sırayla kalsın (ara silme sonrası).
  let slot = 0;
  for (const entry of s.enactedPolicies) {
    if (entry.board === 'fascist') {
      entry.slotIndex = slot;
      slot += 1;
    }
  }
  s.fascistPolicies = target;
}

function lastIndexOf<T>(list: readonly T[], predicate: (item: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    if (item !== undefined && predicate(item)) return i;
  }
  return -1;
}

/** Deste, yoksa çöp yığınından bir faşist kart çıkarır. */
function takeFascistCard(s: GameState): void {
  const deckIndex = s.deck.indexOf('fascist');
  if (deckIndex >= 0) {
    s.deck.splice(deckIndex, 1);
    return;
  }
  const discardIndex = s.discard.indexOf('fascist');
  if (discardIndex >= 0) {
    s.discard.splice(discardIndex, 1);
    return;
  }
  throw new EngineError('UNKNOWN_CARD');
}

/**
 * Destenin ilk `count` kartını faşist yapar. Kart EKLENMEZ: deste içindeki
 * faşist kartlar öne alınır; deste yetmezse çöp yığını desteye katılır
 * (motorun `ensureDeck` davranışıyla aynı mantık, ama karıştırma yerine
 * belirlenimci yeniden dizme).
 */
function stackFascistTop(s: GameState, count: number): void {
  // Deste yetmiyorsa VEYA destede yeterli faşist kart kalmadıysa çöp katılır.
  if (s.deck.length < count || s.deck.filter((c) => c === 'fascist').length < count) {
    s.deck = s.deck.concat(s.discard);
    s.discard = [];
    s.reshuffles += 1;
  }
  const fascists: PolicyCard[] = [];
  const rest: PolicyCard[] = [];
  for (const card of s.deck) {
    if (card === 'fascist' && fascists.length < count) fascists.push(card);
    else rest.push(card);
  }
  if (fascists.length < count) throw new EngineError('UNKNOWN_CARD');
  s.deck = [...fascists, ...rest];
}
