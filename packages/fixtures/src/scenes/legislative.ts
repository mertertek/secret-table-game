import type { AllowedAction, HandCard, SceneCue } from '@secret-table/contracts';

import type { SceneFixture } from '../types';
import { makePlayers, makeView } from '../builders';

const govPlayers = makePlayers({
  count: 7,
  overrides: {
    0: { office: 'president' },
    2: { office: 'chancellor' },
  },
});

// --- Başkan kart atıyor ------------------------------------------------------

const presidentHand: readonly HandCard[] = [
  { cardId: 'c_a', policy: 'liberal' },
  { cardId: 'c_b', policy: 'fascist' },
  { cardId: 'c_c', policy: 'fascist' },
];

const discardPolicy: AllowedAction = {
  actionId: 'act_discard',
  kind: 'discard_policy',
  phaseId: 'president_discard_1',
  requiresConfirmation: true,
  options: presidentHand.map((card) => ({
    optionId: `discard_${card.cardId}`,
    labelKey: `policy.${card.policy}`,
    cardId: card.cardId,
  })),
};

export const presidentDiscardFixture: SceneFixture = {
  id: 'president-discard',
  title: 'Yasama — başkan kart atıyor',
  description: 'Başkanın elinde 3 kart özel alanda görünür. discard_policy her kart için bir seçenek taşır.',
  view: makeView({
    phase: 'president_discard',
    phaseId: 'president_discard_1',
    revision: 20,
    localPlayerId: 'p1',
    players: govPlayers,
    table: { liberalPolicies: 2, fascistPolicies: 2, drawCount: 11, discardCount: 3 },
    privateView: { hand: presidentHand },
    actions: [discardPolicy],
  }),
  cues: [{
    cueId: 'cue_deal_20',
    gameId: 'game_demo',
    revision: 20,
    kind: 'cards_dealt',
    toPlayerId: 'p1',
    cards: presidentHand,
  }],
  selection: null,
};

/**
 * Başkan kartı attıktan SONRAKİ görünüm (D1 tur 4): el boşaldı ve aynı revizyonda
 * iki kamu hareketi geldi. `president-discard` ile aynı oda/oyun/yerel oyuncu
 * kimliğini taşır; `/dev/game` içinde ikisi arasında geçiş gerçek devri oynatır.
 */
export const presidentDiscardedFixture: SceneFixture = {
  id: 'president-discarded',
  title: 'Yasama — başkan kartı bıraktı',
  description: 'Başkanın eli boşaldı; cards_moved president→discard 1 ve president→chancellor 2 aynı revizyonda geldi.',
  view: makeView({
    phase: 'chancellor_choice',
    phaseId: 'chancellor_choice_1',
    revision: 21,
    localPlayerId: 'p1',
    players: govPlayers,
    table: { liberalPolicies: 2, fascistPolicies: 2, drawCount: 11, discardCount: 4 },
    actions: [],
  }),
  cues: [
    { cueId: 'cue_moved_21_discard', gameId: 'game_demo', revision: 21, kind: 'cards_moved', count: 1, from: 'president', to: 'discard' },
    { cueId: 'cue_moved_21_hand', gameId: 'game_demo', revision: 21, kind: 'cards_moved', count: 2, from: 'president', to: 'chancellor' },
  ],
  selection: null,
};

// --- Şansölye kart seçiyor --------------------------------------------------

const chancellorHand: readonly HandCard[] = [
  { cardId: 'c_d', policy: 'liberal' },
  { cardId: 'c_e', policy: 'fascist' },
];

const enactPolicy: AllowedAction = {
  actionId: 'act_enact',
  kind: 'enact_policy',
  phaseId: 'chancellor_choice_1',
  requiresConfirmation: true,
  options: chancellorHand.map((card) => ({
    optionId: `enact_${card.cardId}`,
    labelKey: `policy.${card.policy}`,
    cardId: card.cardId,
  })),
};

export const chancellorChoiceFixture: SceneFixture = {
  id: 'chancellor-choice',
  title: 'Yasama — şansölye yürürlüğe koyuyor',
  description: 'Şansölyenin elinde 2 kart. enact_policy seçilen kartı yürürlüğe koyar; diğerini motor ele alır.',
  view: makeView({
    phase: 'chancellor_choice',
    phaseId: 'chancellor_choice_1',
    revision: 21,
    localPlayerId: 'p3',
    players: govPlayers,
    table: { liberalPolicies: 2, fascistPolicies: 3, drawCount: 11, discardCount: 4 },
    privateView: { hand: chancellorHand },
    actions: [enactPolicy],
  }),
  cues: [],
  selection: null,
};

const requestVeto: AllowedAction = {
  actionId: 'act_request_veto',
  kind: 'request_veto',
  phaseId: 'chancellor_choice_veto_1',
  requiresConfirmation: false,
  options: [{ optionId: 'veto', labelKey: 'veto.request' }],
};

export const chancellorChoiceVetoFixture: SceneFixture = {
  id: 'chancellor-choice-veto',
  title: 'Yasama — veto hakkı açık',
  description: '5 faşist politika sonrası şansölye enact_policy yanında request_veto aksiyonuna da sahip.',
  view: makeView({
    phase: 'chancellor_choice',
    phaseId: 'chancellor_choice_veto_1',
    revision: 30,
    localPlayerId: 'p3',
    players: govPlayers,
    table: { liberalPolicies: 3, fascistPolicies: 5, drawCount: 6, discardCount: 8 },
    privateView: { hand: chancellorHand },
    actions: [
      { ...enactPolicy, phaseId: 'chancellor_choice_veto_1' },
      requestVeto,
    ],
  }),
  cues: [],
  selection: null,
};

// --- Başkan vetoya yanıt veriyor -----------------------------------------------

const respondVeto: AllowedAction = {
  actionId: 'act_respond_veto',
  kind: 'respond_veto',
  phaseId: 'veto_response_1',
  requiresConfirmation: true,
  options: [
    { optionId: 'veto_accept', labelKey: 'veto.accept' },
    { optionId: 'veto_reject', labelKey: 'veto.reject' },
  ],
};

export const vetoResponseFixture: SceneFixture = {
  id: 'veto-response',
  title: 'Yasama — başkan vetoyu yanıtlıyor',
  description: 'Şansölye veto istedi. Başkan respond_veto ile kabul veya ret verir.',
  view: makeView({
    phase: 'veto_response',
    phaseId: 'veto_response_1',
    revision: 31,
    localPlayerId: 'p1',
    players: govPlayers,
    table: { liberalPolicies: 3, fascistPolicies: 5, drawCount: 6, discardCount: 8 },
    actions: [respondVeto],
  }),
  cues: [],
  selection: null,
};

// --- Politika sonucu --------------------------------------------------------

const policyEnacted: SceneCue = {
  cueId: 'cue_policy_22',
  gameId: 'game_demo',
  revision: 22,
  kind: 'policy_enacted',
  board: 'fascist',
  slotIndex: 3,
  policy: 'fascist',
};

export const policyResultFixture: SceneFixture = {
  id: 'policy-result',
  title: 'Sonuç — politika tahtaya yerleşti',
  description: 'enactedPolicies büyüdü, sayaçlar sunucudan geldi. policy_enacted cue oynatılır; bloklamaz.',
  view: makeView({
    phase: 'policy_result',
    phaseId: 'policy_result_1',
    revision: 22,
    localPlayerId: 'p4',
    players: govPlayers,
    table: {
      liberalPolicies: 2,
      fascistPolicies: 4,
      drawCount: 10,
      discardCount: 5,
      enactedPolicies: [
        { board: 'liberal', slotIndex: 0, policy: 'liberal' },
        { board: 'liberal', slotIndex: 1, policy: 'liberal' },
        { board: 'fascist', slotIndex: 0, policy: 'fascist' },
        { board: 'fascist', slotIndex: 1, policy: 'fascist' },
        { board: 'fascist', slotIndex: 2, policy: 'fascist' },
        { board: 'fascist', slotIndex: 3, policy: 'fascist' },
      ],
      publicHistory: [
        { entryId: 'h_pol_22', kind: 'policy_enacted', board: 'fascist', policy: 'fascist' },
      ],
    },
    actions: [],
  }),
  cues: [policyEnacted],
  selection: null,
};

// --- 3. faşist kanun: Hitler bölgesi (D9 duyuru önizlemesi) ------------------

const policyEnactedThird: SceneCue = {
  cueId: 'cue_policy_23',
  gameId: 'game_demo',
  revision: 23,
  kind: 'policy_enacted',
  board: 'fascist',
  slotIndex: 2,
  policy: 'fascist',
};

/**
 * Üçüncü faşist kanun tahtaya yeni kondu: bu andan sonra Hitler şansölye
 * seçilirse oyun biter. D9 ekran ortası duyurusunun kural hatırlatmasını
 * (`danger` tonu) gerçek tarayıcıda görmek için eklendi; additive.
 */
export const policyFascistThirdFixture: SceneFixture = {
  id: 'policy-fascist-third',
  title: 'Sonuç — 3. faşist kanun (Hitler bölgesi)',
  description:
    'policy_enacted cue ile üçüncü faşist kanun kondu. Duyuru katmanı kural hatırlatmasını gösterir.',
  view: makeView({
    phase: 'policy_result',
    phaseId: 'policy_result_2',
    revision: 23,
    localPlayerId: 'p4',
    players: govPlayers,
    table: {
      liberalPolicies: 2,
      fascistPolicies: 3,
      drawCount: 11,
      discardCount: 4,
      enactedPolicies: [
        { board: 'liberal', slotIndex: 0, policy: 'liberal' },
        { board: 'liberal', slotIndex: 1, policy: 'liberal' },
        { board: 'fascist', slotIndex: 0, policy: 'fascist' },
        { board: 'fascist', slotIndex: 1, policy: 'fascist' },
        { board: 'fascist', slotIndex: 2, policy: 'fascist' },
      ],
      publicHistory: [
        { entryId: 'h_pol_23', kind: 'policy_enacted', board: 'fascist', policy: 'fascist' },
      ],
    },
    actions: [],
  }),
  cues: [policyEnactedThird],
  selection: null,
};

// --- D17: ofis eli KARŞI koltukta (kamu kart sırtları) ----------------------

/**
 * D17 — yasama kamu görünümü. Yerel oyuncu (p1) hükümette DEĞİL: başkan p4,
 * şansölye p6. Bu senaryolarda kendi özel alanı boştur; masada yalnız ofis
 * sahibinin elindeki KAPALI sırtlar görünür (adet fazdan türer).
 */
const seatGovPlayers = makePlayers({
  count: 9,
  overrides: {
    3: { office: 'president' },
    5: { office: 'chancellor' },
  },
});

const moved = (count: number, from: 'deck' | 'president' | 'chancellor', to: 'president' | 'chancellor' | 'discard', revision: number): SceneCue => ({
  cueId: `cue_move_${revision}_${from}_${to}`, gameId: 'game_demo', revision, kind: 'cards_moved', count, from, to,
});

/** Başkan (p4) 3 kapalı sırt tutuyor; cue: desteden 3 kart geldi. */
export const legislativePresidentSeatFixture: SceneFixture = {
  id: 'legislative-president-seat',
  title: 'Yasama — başkanın elinde 3 sırt (karşı koltuk)',
  description:
    'Yerel oyuncu hükümette değil: karşı koltuktaki başkan (p4) sağ elinde 3 kapalı kart sırtı tutar; cue desteden 3 kartın gelişini oynatır.',
  view: makeView({
    phase: 'president_discard',
    phaseId: 'president_discard_5',
    revision: 40,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players: seatGovPlayers,
    table: { liberalPolicies: 2, fascistPolicies: 3, drawCount: 9, discardCount: 4 },
    actions: [],
  }),
  cues: [moved(3, 'deck', 'president', 40)],
  selection: null,
};

/** Şansölye (p6) 2 kapalı sırt tutuyor; cue: başkandan 2 kart geldi. */
export const legislativeChancellorSeatFixture: SceneFixture = {
  id: 'legislative-chancellor-seat',
  title: 'Yasama — şansölyenin elinde 2 sırt (karşı koltuk)',
  description:
    'Karşı koltuktaki şansölye (p6) 2 kapalı sırt tutar; cue başkandan şansölyeye 2 kartın geçişini oynatır. Başkanın eli boştur.',
  view: makeView({
    phase: 'chancellor_choice',
    phaseId: 'chancellor_choice_5',
    revision: 41,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players: seatGovPlayers,
    table: { liberalPolicies: 2, fascistPolicies: 3, drawCount: 9, discardCount: 5 },
    actions: [],
  }),
  cues: [moved(2, 'president', 'chancellor', 41)],
  selection: null,
};

/**
 * D21/E — GERÇEK başkan atma turu: AYNI revizyonda İKİ `cards_moved` cue'su
 * (başkan→atık 1, başkan→şansölye 2). Eski sahne kodu listedeki İLK cue'yu
 * alıp her koltuğa onu sorduğu için şansölye koltuğunda akış hiç oynamıyordu;
 * bu fixture o kusuru görünür kılar (`/dev/scene?fixture=legislative-chancellor-seat-two-cues&camera=seat&t=400`).
 */
export const legislativeChancellorSeatTwoCuesFixture: SceneFixture = {
  id: 'legislative-chancellor-seat-two-cues',
  title: 'Yasama — şansölyeye 2 sırt uçuyor (iki cue, karşı koltuk)',
  description:
    'Başkan attı: aynı revizyonda iki kamu hareketi var (başkan→atık 1, başkan→şansölye 2). Şansölye koltuğunda iki sırt uçarak gelir; başkanın eli boşalır.',
  view: makeView({
    phase: 'chancellor_choice',
    phaseId: 'chancellor_choice_5',
    revision: 41,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players: seatGovPlayers,
    table: { liberalPolicies: 2, fascistPolicies: 3, drawCount: 9, discardCount: 5 },
    actions: [],
  }),
  cues: [moved(1, 'president', 'discard', 41), moved(2, 'president', 'chancellor', 41)],
  selection: null,
};

/** Veto kararı: kartlar HÂLÂ şansölyede (2 sırt), cue yok (yeniden bağlanma). */
export const legislativeVetoSeatFixture: SceneFixture = {
  id: 'legislative-veto-seat',
  title: 'Yasama — veto kararı (şansölyede 2 sırt, cue yok)',
  description:
    'Veto yanıtı beklenirken kartlar şansölyededir; cue gelmese de (yeniden bağlanma) faz + ofisten türeyen 2 sırt anında görünür.',
  view: makeView({
    phase: 'veto_response',
    phaseId: 'veto_response_5',
    revision: 42,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players: seatGovPlayers,
    table: { liberalPolicies: 2, fascistPolicies: 5, drawCount: 9, discardCount: 5 },
    actions: [],
  }),
  cues: [],
  selection: null,
};

/**
 * D17 ÖLÇÜM TABANI: `legislative-president-seat` ile AYNI oyuncular/masa,
 * yalnız faz `nomination` → kamu eli yok. Çizim sayısı farkı bu iki sahnenin
 * karşılaştırmasıyla ölçülür.
 */
export const legislativeSeatIdleFixture: SceneFixture = {
  id: 'legislative-seat-idle',
  title: 'Yasama — ölçüm tabanı (kamu eli yok)',
  description:
    'Aynı masa ve oyuncular, faz `nomination`: hiçbir koltukta kamu kart sırtı yok. D17 çizim farkı ölçümü için.',
  view: {
    ...legislativePresidentSeatFixture.view,
    phase: 'nomination',
    phaseId: 'nomination_5',
    players: legislativePresidentSeatFixture.view.players.map((p) => ({ ...p, office: 'none' as const })),
  },
  cues: [],
  selection: null,
};
