import type { SceneCue } from '@secret-table/contracts';

import type { SceneFixture } from '../types';
import { makePlayers, makeView } from '../builders';

/**
 * D12 — infaz koreografisi (silah, ateş, çöken karakter).
 *
 * `execution-result` (executive.ts) duyuru önizlemesidir ve DEĞİŞMEZ. Buradaki
 * iki senaryo koreografiyi kadraja alır: atıcı BAŞKANDIR (`cueOfficePlayerId`),
 * hedef `player_eliminated` cue'sunun `playerId`sidir.
 */

const history = (actorId: string, targetId: string) => [
  { entryId: 'h_pow_52', kind: 'power_used' as const, power: 'execution' as const, actorId, targetId },
  { entryId: 'h_exec_52', kind: 'player_executed' as const, targetId },
];

const cue = (playerId: string): SceneCue => ({
  cueId: 'cue_shot_52', gameId: 'game_demo', revision: 52, kind: 'player_eliminated', playerId,
});

/** Atıcı YEREL DEĞİL: kamu kolu + silah masanın karşısından görülür. */
export const executionShotFixture: SceneFixture = {
  id: 'execution-shot',
  title: 'İnfaz — kamu kolu ateş ediyor',
  description:
    'Başkan p3 (yerel değil) hedef p7 koltuğuna nişan alıp ateş eder; 2,6 sn koreografi, hedef kalıcı çökük + "ko".',
  view: makeView({
    phase: 'nomination',
    phaseId: 'nomination_7',
    revision: 52,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players: makePlayers({
      count: 9,
      overrides: {
        2: { office: 'president' },
        6: { alive: false },
        3: { isPresidentialCandidate: true },
      },
    }),
    table: {
      liberalPolicies: 2,
      fascistPolicies: 4,
      drawCount: 8,
      discardCount: 7,
      currentPower: { power: 'execution', actorId: 'p3', targetId: 'p7' },
      publicHistory: history('p3', 'p7'),
    },
    actions: [],
  }),
  cues: [cue('p7')],
  selection: null,
};

/** Atıcı YEREL: ilk şahıs sağ el silahla kalkar (koltuk kamerası). */
export const executionShotLocalFixture: SceneFixture = {
  id: 'execution-shot-local',
  title: 'İnfaz — silah bende (ilk şahıs)',
  description:
    'Yerel oyuncu başkandır: sağ el silahla kalkar, hedef p5 koltuğuna döner ve ateş eder. Koltuk kamerasında dene.',
  view: makeView({
    phase: 'nomination',
    phaseId: 'nomination_7',
    revision: 52,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players: makePlayers({
      count: 9,
      overrides: {
        0: { office: 'president' },
        4: { alive: false },
        1: { isPresidentialCandidate: true },
      },
    }),
    table: {
      liberalPolicies: 2,
      fascistPolicies: 4,
      drawCount: 8,
      discardCount: 7,
      currentPower: { power: 'execution', actorId: 'p1', targetId: 'p5' },
      publicHistory: history('p1', 'p5'),
    },
    actions: [],
  }),
  cues: [cue('p5')],
  selection: null,
};

/** Yerel oyuncu HEDEF: vinyet + "VURULDUN" katmanı (D12 §6) bu görünümde çıkar. */
export const executionShotVictimFixture: SceneFixture = {
  ...executionShotFixture,
  id: 'execution-shot-victim',
  title: 'İnfaz — vurulan bensin',
  description: 'Hedef yerel oyuncudur: ateş anında vinyet ve "VURULDUN" başlığı gelir, kamera oynamaz.',
  view: { ...executionShotFixture.view, localPlayerId: 'p7' },
};

/**
 * D12 tur 2 — KOLTUK görüşü kanıtı: atıcı (p5) ve hedef (p6) masanın karşısında
 * yan yana; yerel oyuncu (p1) kendi koltuğundan ikisini de görür.
 */
export const executionShotSeatFixture: SceneFixture = {
  id: 'execution-shot-seat',
  title: 'İnfaz — koltuktan bakış',
  description:
    'Atıcı ve hedef masanın karşısında: koltuk kamerasından kamu kolu, silah, flaş ve çöküş aynı karede.',
  view: makeView({
    phase: 'nomination',
    phaseId: 'nomination_7',
    revision: 52,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players: makePlayers({
      count: 9,
      overrides: {
        4: { office: 'president' },
        5: { alive: false },
        1: { isPresidentialCandidate: true },
      },
    }),
    table: {
      liberalPolicies: 2,
      fascistPolicies: 4,
      drawCount: 8,
      discardCount: 7,
      currentPower: { power: 'execution', actorId: 'p5', targetId: 'p6' },
      publicHistory: history('p5', 'p6'),
    },
    actions: [],
  }),
  cues: [cue('p6')],
  selection: null,
};

/** D12 tur 3 — hedef seçimi: silah YETKİLİ oyuncunun elinde, hedef seçilmemiş. */
const chooseTargets = {
  actionId: 'act_use_power',
  kind: 'use_power' as const,
  phaseId: 'executive_action_7',
  requiresConfirmation: true,
  options: [
    { optionId: 'target_p2', labelKey: 'player.name', targetPlayerId: 'p2' },
    { optionId: 'target_p4', labelKey: 'player.name', targetPlayerId: 'p4' },
    { optionId: 'target_p6', labelKey: 'player.name', targetPlayerId: 'p6' },
    { optionId: 'target_p7', labelKey: 'player.name', targetPlayerId: 'p7' },
    { optionId: 'target_p9', labelKey: 'player.name', targetPlayerId: 'p9' },
  ],
};

const chooseView = (actorSeat: number) =>
  makeView({
    phase: 'executive_action',
    phaseId: 'executive_action_7',
    revision: 51,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players: makePlayers({
      count: 9,
      overrides: { [actorSeat]: { office: 'president' }, 3: { office: 'chancellor' } },
    }),
    table: {
      liberalPolicies: 2,
      fascistPolicies: 4,
      drawCount: 8,
      discardCount: 7,
      currentPower: { power: 'execution', actorId: `p${actorSeat + 1}`, targetId: null },
    },
    actions: actorSeat === 0 ? [chooseTargets] : [],
  });

/** Yetki YERELDE: ilk şahısta sağ elde hazır poz + 5 hedefli rakamlı çubuk. */
export const executionChooseFixture: SceneFixture = {
  id: 'execution-choose',
  title: 'İnfaz — hedef seçimi (silah bende)',
  description:
    'Yetki yerel oyuncuda, hedef seçilmemiş: silah hazır pozda elde durur, alt çubukta 5 hedef rakamlıdır.',
  view: chooseView(0),
  cues: [],
  selection: null,
};

/** Yetki KARŞIDAKİ oyuncuda: koltuk kamerasından onun elinde silah görünür. */
export const executionChooseSeatFixture: SceneFixture = {
  id: 'execution-choose-seat',
  title: 'İnfaz — hedef seçimi (silah karşıda)',
  description:
    'Yetki karşı koltuktaki oyuncuda: kamu kolu silahı masada hazır tutar, hedefe dönmemiştir.',
  view: chooseView(4),
  cues: [],
  selection: null,
};
