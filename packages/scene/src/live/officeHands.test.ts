/**
 * D17 — yasamada kamu elinde kart sırtları (saf katman testleri).
 * Yalnız `view.phase` + `office`; kart yüzü/sırası yok.
 */
import { describe, expect, it } from 'vitest';
import type { SceneCue, SceneView } from '@secret-table/contracts';
import { getSceneFixture } from '../../../fixtures/src/index';
import {
  gripForCount,
  officeHandFlow,
  officeHandState,
  officeHandTransition,
  pickOfficeHandCue,
} from './officeHands';

const base = getSceneFixture('legislative-president-seat')!.view;
const withPhase = (phase: SceneView['phase']): SceneView => ({ ...base, phase });
const cue = (count: number, from: 'deck' | 'president' | 'chancellor', to: 'president' | 'chancellor' | 'discard'): SceneCue => ({
  cueId: `c_${from}_${to}`, gameId: base.gameId ?? 'g', revision: base.revision, kind: 'cards_moved', count, from, to,
});
const president = base.players.find((p) => p.office === 'president')!.playerId;
const chancellor = base.players.find((p) => p.office === 'chancellor')!.playerId;

describe('officeHandState', () => {
  it('başkan yasama fazında 3 sırt, şansölye 2 sırt tutar', () => {
    expect(officeHandState(withPhase('president_discard'))).toEqual({
      playerId: president, office: 'president', count: 3, grip: 'holdFan3',
    });
    expect(officeHandState(withPhase('chancellor_choice'))).toEqual({
      playerId: chancellor, office: 'chancellor', count: 2, grip: 'holdFan2',
    });
  });

  it('veto fazında kartlar ŞANSÖLYEDE kalır (cue gerekmez)', () => {
    expect(officeHandState(withPhase('veto_response'))).toMatchObject({ playerId: chancellor, count: 2 });
    // Yeniden bağlanma: cue yok, durum yalnız fazdan türer.
    const reconnect = getSceneFixture('legislative-veto-seat')!;
    expect(reconnect.cues).toHaveLength(0);
    expect(officeHandState(reconnect.view)).toMatchObject({ office: 'chancellor', count: 2, grip: 'holdFan2' });
  });

  it('yasama dışı fazlarda kamu eli YOK', () => {
    for (const phase of ['lobby', 'role_reveal', 'nomination', 'voting', 'election_result',
      'policy_result', 'executive_action', 'game_over'] as const) {
      expect(officeHandState(withPhase(phase)), phase).toBeNull();
    }
  });

  it('ofis sahibi yoksa ya da elenmişse el çizilmez', () => {
    expect(officeHandState({ phase: 'president_discard', players: [] })).toBeNull();
    const dead = withPhase('president_discard');
    expect(officeHandState({
      ...dead,
      players: dead.players.map((p) => (p.office === 'president' ? { ...p, alive: false } : p)),
    })).toBeNull();
  });

  it('adet → tutuş eşlemesi', () => {
    expect(gripForCount(3)).toBe('holdFan3');
    expect(gripForCount(2)).toBe('holdFan2');
    for (const n of [0, 1, 4, -1, 2.5, Number.NaN]) expect(gripForCount(n)).toBeNull();
  });
});

describe('officeHandFlow / officeHandTransition', () => {
  it('cue bu koltuğa geliyor mu, gidiyor mu', () => {
    const view = withPhase('president_discard');
    expect(officeHandFlow(view, cue(3, 'deck', 'president'), president)).toEqual({ direction: 'in', count: 3, endpoint: 'deck' });
    expect(officeHandFlow(view, cue(1, 'president', 'discard'), president)).toEqual({ direction: 'out', count: 1, endpoint: 'discard' });
    expect(officeHandFlow(view, cue(2, 'president', 'chancellor'), chancellor)).toEqual({ direction: 'in', count: 2, endpoint: 'president' });
    // İlgisiz koltuk ve ilgisiz cue.
    expect(officeHandFlow(view, cue(3, 'deck', 'president'), chancellor)).toBeNull();
    expect(officeHandFlow(view, { cueId: 'x', gameId: 'g', revision: 1, kind: 'office_moved', office: 'president', toPlayerId: president }, president)).toBeNull();
  });

  it('cue başlangıç/bitiş tutuşuna eşlenir', () => {
    // Deste → başkan (3): boş el → holdFan3.
    expect(officeHandTransition(withPhase('president_discard'), cue(3, 'deck', 'president'), president))
      .toEqual({ from: null, to: 'holdFan3' });
    // Başkan → şansölye (2): başkanın eli boşalır, şansölye 2'li yelpazeye geçer.
    const chancellorPhase = withPhase('chancellor_choice');
    expect(officeHandTransition(chancellorPhase, cue(2, 'president', 'chancellor'), president))
      .toEqual({ from: 'holdFan2', to: null });
    expect(officeHandTransition(chancellorPhase, cue(2, 'president', 'chancellor'), chancellor))
      .toEqual({ from: null, to: 'holdFan2' });
    // Başkan → atık (1) yasama-başkan fazında hâlâ sürerken: 3+1 → 3 değil,
    // görünüm zaten ilerlediği için bitiş 3'tür (başlangıç 4 → tutuş yok).
    expect(officeHandTransition(withPhase('president_discard'), cue(1, 'president', 'discard'), president))
      .toEqual({ from: null, to: 'holdFan3' });
    // Şansölye → atık (1), faz sonuca geçtiyse: el boşalır.
    // Şansölye → atık (1), faz sonuca geçtiyse: el boşalır (1 kart tutuşu yok).
    expect(officeHandTransition(withPhase('policy_result'), cue(1, 'chancellor', 'discard'), chancellor))
      .toEqual({ from: null, to: null });
    expect(officeHandTransition(withPhase('president_discard'), cue(3, 'deck', 'president'), chancellor)).toBeNull();
  });
});

/**
 * D21/E — başkanın atma turu AYNI sürümde iki `cards_moved` üretir
 * (başkan→atık 1, başkan→şansölye 2). Eski sahne kodu listedeki ilk cue'yu
 * alıp her koltuğa onu soruyordu; şansölye koltuğu için akış her zaman `null`
 * çıkıyor ve iki sırtın uçarak gelişi hiç oynamıyordu.
 */
describe('pickOfficeHandCue (D21/E)', () => {
  const view = withPhase('chancellor_choice');
  const twoCues: readonly SceneCue[] = [
    cue(1, 'president', 'discard'),
    cue(2, 'president', 'chancellor'),
  ];

  it('şansölye koltuğu için İKİNCİ cue seçilir (akış null DEĞİL)', () => {
    const picked = pickOfficeHandCue(view, twoCues, chancellor);
    expect(picked).not.toBeNull();
    expect(picked?.index).toBe(1);
    expect(picked?.flow).toEqual({ direction: 'in', count: 2, endpoint: 'president' });
  });

  it('başkan koltuğu için İLK ilgili cue seçilir', () => {
    const picked = pickOfficeHandCue(view, twoCues, president);
    expect(picked?.index).toBe(0);
    expect(picked?.flow).toEqual({ direction: 'out', count: 1, endpoint: 'discard' });
  });

  it('ilgisiz koltukta ve cue olmayan listede null', () => {
    const other = view.players.find(
      (p) => p.playerId !== president && p.playerId !== chancellor,
    )!.playerId;
    expect(pickOfficeHandCue(view, twoCues, other)).toBeNull();
    expect(pickOfficeHandCue(view, [], chancellor)).toBeNull();
    expect(
      pickOfficeHandCue(
        view,
        [{ cueId: 'x', gameId: 'g', revision: 1, kind: 'office_moved', office: 'president', toPlayerId: president }],
        chancellor,
      ),
    ).toBeNull();
  });
});
