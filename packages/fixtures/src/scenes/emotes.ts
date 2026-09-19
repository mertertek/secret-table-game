import { EMOTE_KINDS, EMOTE_LABEL, EMOTE_SYMBOL, type EmoteKind } from '@secret-table/contracts';

import type { SceneFixture } from '../types';
import { makePlayers, makeView } from '../builders';

/**
 * D16 — el jestleri (`docs/design/D16-emotes.md`).
 *
 * Jest OYUN DURUMU DEĞİLDİR: bakış kanalının additive alanıyla gelir. Bu yüzden
 * fixture'lar jesti `peers` üzerinden verir; `/dev/scene` onu taze `t` ile
 * gerçek `HeadViewpoint`e çevirir. Yerel (ilk şahıs) jest URL'den gelir:
 * `?fixture=emote-local&emote=point&t=800`.
 */

const quietTable = (localSeat = 0) =>
  makeView({
    phase: 'nomination',
    phaseId: 'nomination_4',
    revision: 30,
    localPlayerId: `p${localSeat + 1}`,
    boardVariant: 'large',
    players: makePlayers({ count: 9, overrides: { 0: { office: 'president' }, 3: { office: 'chancellor' } } }),
    table: { liberalPolicies: 2, fascistPolicies: 3, drawCount: 9, discardCount: 5 },
    actions: [],
  });

/**
 * Karşı koltuktaki oyuncu jest yapıyor — her jest için bir senaryo. Kimlikler:
 * `emote-point-seat`, `emote-hands-up-seat`, kalanlar `emote-peer-<jest>`.
 */
const PEER_TITLE: Readonly<Record<EmoteKind, string>> = {
  point: 'işaret ediyor',
  hands_up: 'teslim oluyor',
  thumbs_up: 'onaylıyor',
  thumbs_down: 'reddediyor',
  middle: 'orta parmak gösteriyor',
  wave: 'selam veriyor',
  clap: 'alkışlıyor',
  facepalm: 'yüzünü avuçluyor',
};
/** `point` bakış yaw'ını izlesin diye 0 DEĞİL (tasarım §2). */
const PEER_YAW: Readonly<Record<EmoteKind, number>> = {
  point: -.45, hands_up: .05, thumbs_up: .12, thumbs_down: -.1,
  middle: .2, wave: -.15, clap: 0, facepalm: .08,
};

export const emotePeerFixtures: readonly SceneFixture[] = EMOTE_KINDS.map((kind) => ({
  id: kind === 'point' ? 'emote-point-seat' : kind === 'hands_up' ? 'emote-hands-up-seat' : `emote-peer-${kind}`,
  title: `Jest — karşıdaki ${PEER_TITLE[kind]}`,
  description: `p5 masanın karşısında ${EMOTE_LABEL[kind].toLocaleLowerCase('tr')} jesti yapar; kamu eli jest boyunca mount edilir, etikette ${EMOTE_SYMBOL[kind]} sembolü çıkar.`,
  view: quietTable(),
  cues: [],
  selection: null,
  peers: [{ playerId: 'p5', seatIndex: 4, yaw: PEER_YAW[kind], pitch: -.06, emote: kind }],
}));

/** Aynı anda üç oyuncu: jest kalabalıkta okunur mu (etiket sembolleri). */
export const emoteCrowdFixture: SceneFixture = {
  id: 'emote-crowd',
  title: 'Jest — üç oyuncu aynı anda',
  description: 'Alkış, onay ve orta parmak aynı karede: kamu kolları ve etiket sembolleri birbirini kapatmıyor.',
  view: quietTable(),
  cues: [],
  selection: null,
  peers: [
    { playerId: 'p4', seatIndex: 3, yaw: .3, pitch: -.05, emote: 'clap' },
    { playerId: 'p5', seatIndex: 4, yaw: 0, pitch: -.05, emote: 'thumbs_up' },
    { playerId: 'p6', seatIndex: 5, yaw: -.3, pitch: -.05, emote: 'middle' },
  ],
};

/** Yerel jest: kamera koltuğa alınır, jest URL parametresinden gelir. */
export const emoteLocalFixture: SceneFixture = {
  id: 'emote-local',
  title: 'Jest — ilk şahıs (URL: &emote=…)',
  description:
    'Kendi koltuğundan jest: `&emote=point|hands_up|thumbs_up|thumbs_down|middle|wave|clap|facepalm` ve `&t=800` ile kare dondurulur.',
  view: quietTable(),
  cues: [],
  selection: null,
};

/** Yerel jest + elde kart (kart tutarken `point`). */
export const emoteLocalHandFixture: SceneFixture = {
  id: 'emote-local-hand',
  title: 'Jest — ilk şahıs, elde kart',
  description: 'Elde iki kanun varken jest: tek elli jestte sol el kartları tutmaya devam eder, iki ellide kartlar masaya yaslanır.',
  view: makeView({
    phase: 'president_discard',
    phaseId: 'president_discard_4',
    revision: 31,
    localPlayerId: 'p1',
    boardVariant: 'large',
    players: makePlayers({ count: 9, overrides: { 0: { office: 'president' }, 3: { office: 'chancellor' } } }),
    table: { liberalPolicies: 2, fascistPolicies: 3, drawCount: 9, discardCount: 5 },
    privateView: {
      role: 'liberal',
      hand: [
        { cardId: 'c1', policy: 'liberal' },
        { cardId: 'c2', policy: 'fascist' },
        { cardId: 'c3', policy: 'fascist' },
      ],
      inspection: null,
    },
    actions: [],
  }),
  cues: [],
  selection: null,
};
