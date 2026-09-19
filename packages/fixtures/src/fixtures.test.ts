import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '@secret-table/contracts';

import { sceneFixtureList, sceneFixtures } from './registry';

const PUBLIC_PLAYER_KEYS = new Set([
  // D3.4: karakter seçimi herkese açıktır ve rol ima etmez.
  'avatar',
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
]);

describe('sahne örnekleri', () => {
  it('kimlikler benzersiz ve registry ile tutarlı', () => {
    const ids = sceneFixtureList.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(sceneFixtures).sort()).toEqual([...ids].sort());
  });

  it('devir kontrolü kapsamı: 5-10 masa, oy sonucu, özel el, yetki, veto, kesinti, oyun sonu', () => {
    const ids = new Set(Object.keys(sceneFixtures));
    for (const count of [5, 6, 7, 8, 9, 10]) {
      expect(ids.has(`table-size-${count}`)).toBe(true);
    }
    expect(ids.has('election-result')).toBe(true);
    expect(ids.has('president-discard')).toBe(true);
    expect(ids.has('inspection-result')).toBe(true);
    expect(ids.has('veto-response')).toBe(true);
    expect(ids.has('disconnected-peer')).toBe(true);
    expect(ids.has('game-over-liberal')).toBe(true);
  });

  it.each(sceneFixtureList.map((fixture) => [fixture.id, fixture] as const))(
    '%s: SceneView değişmezleri',
    (_id, fixture) => {
      const { view } = fixture;

      expect(view.protocolVersion).toBe(PROTOCOL_VERSION);

      // Koltuklar 0..n-1 sırayla.
      view.players.forEach((player, index) => {
        expect(player.seatIndex).toBe(index);
      });

      // Tam olarak bir oda sahibi.
      expect(view.players.filter((player) => player.isHost)).toHaveLength(1);

      // localPlayerId gerçek bir koltuk.
      expect(view.players.some((player) => player.playerId === view.localPlayerId)).toBe(true);

      // Herkese açık oyuncu nesnesi rol/parti/el sızdırmaz.
      for (const player of view.players) {
        for (const key of Object.keys(player)) {
          expect(PUBLIC_PLAYER_KEYS.has(key)).toBe(true);
        }
      }

      // Aksiyonlar mevcut phaseId ile aynı pencerede.
      for (const action of view.actions) {
        expect(action.phaseId).toBe(view.phaseId);
        expect(action.options.length).toBeGreaterThan(0);
      }

      // Lobi/oyun ayrımı.
      if (view.phase === 'lobby') {
        expect(view.gameId).toBeNull();
        expect(view.playerCountAtStart).toBeNull();
      } else {
        expect(view.gameId).not.toBeNull();
        expect(view.playerCountAtStart).toBe(view.players.length);
        expect(view.players.length).toBeGreaterThanOrEqual(5);
        expect(view.players.length).toBeLessThanOrEqual(10);
      }

      // result yalnızca game_over'da dolu.
      if (view.phase === 'game_over') {
        expect(view.result).not.toBeNull();
      } else {
        expect(view.result).toBeNull();
      }

      // cue'lar bu oyuna ait.
      for (const cue of fixture.cues) {
        expect(cue.gameId).toBe(view.gameId);
      }
    },
  );
});
