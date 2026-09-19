/**
 * D23 — sahne sözlüğü ve dil değişiminde doku yenilenmesi.
 *
 * Sahne paketi web'in i18n modülünü İÇE AKTARMAZ; dil propla gelir ve
 * varsayılanı `tr`dir (fixtures / prototip sayfaları değişmez).
 */
import { describe, expect, it } from 'vitest';

import { sceneText } from './sceneText';
import { boardSlotPlans } from '../objects/boardArt';
import { nameplateState } from '../objects/nameplateState';
import { voteBadgeLabel } from '../objects/voteState';
import type { PlayerView } from '@secret-table/contracts';

const player = (patch: Partial<PlayerView> = {}): PlayerView => ({
  playerId: 'p1',
  displayName: 'Mert',
  seatIndex: 0,
  connected: true,
  alive: true,
  ready: false,
  isHost: false,
  office: 'none',
  isPresidentialCandidate: false,
  isChancellorCandidate: false,
  hasVoted: false,
  avatar: { character: 'fotr', skin: 'orta' },
  ...patch,
});

const ctx = {
  local: false,
  lobby: false,
  targetable: false,
  hovered: false,
  aimed: false,
  selected: false,
  vote: null,
};

describe('sceneText', () => {
  it('varsayılan dil Türkçe kalır', () => {
    expect(sceneText('tr', 'card.policy')).toBe('POLİTİKA');
    expect(sceneText('tr', 'board.veto')).toBe('VETO AÇILDI');
  });

  it('İngilizce karşılıklar resmî oyun terimleridir', () => {
    expect(sceneText('en', 'card.policy')).toBe('POLICY');
    expect(sceneText('en', 'card.yes')).toBe('JA');
    expect(sceneText('en', 'plate.chancellor')).toBe('CHANCELLOR');
    expect(sceneText('en', 'board.power.investigate_loyalty.1')).toBe('INVESTIGATE');
  });

  it('{param} doldurur', () => {
    expect(sceneText('tr', 'nav.cardCount', { index: 2, total: 3 })).toBe('Kart 2 / 3');
    expect(sceneText('en', 'nav.cardCount', { index: 2, total: 3 })).toBe('Card 2 / 3');
  });
});

describe('dil propu çizilen metni değiştirir (doku anahtarı)', () => {
  it('tahta yuva etiketleri dile göre değişir', () => {
    const trLines = boardSlotPlans('fascist', 'large', 'tr').map((s) => s.band?.lines.join(' ') ?? null);
    const enLines = boardSlotPlans('fascist', 'large', 'en').map((s) => s.band?.lines.join(' ') ?? null);
    expect(trLines[0]).toBe('SADAKAT İNCELEMESİ');
    expect(enLines[0]).toBe('INVESTIGATE LOYALTY');
    expect(enLines).not.toEqual(trLines);
  });

  it('dil verilmezse Türkçe kalır (mevcut çağrı yerleri bozulmaz)', () => {
    expect(boardSlotPlans('fascist', 'large')).toEqual(boardSlotPlans('fascist', 'large', 'tr'));
  });

  it('isim plakası metni dile göre değişir, varsayılan Türkçe', () => {
    expect(nameplateState(player({ office: 'president' }), ctx).text).toBe('BAŞKAN');
    expect(nameplateState(player({ office: 'president' }), ctx, 'en').text).toBe('PRESIDENT');
    expect(nameplateState(player({ alive: false }), ctx, 'en').text).toBe('DEAD');
    expect(nameplateState(player(), ctx, 'en').text).toBe('SEAT 01');
  });

  it('oy rozeti etiketi dile göre değişir', () => {
    expect(voteBadgeLabel({ kind: 'voted' })).toBe('OY VERDİ');
    expect(voteBadgeLabel({ kind: 'voted' }, 'en')).toBe('VOTED');
    expect(voteBadgeLabel({ kind: 'vote', vote: 'yes' }, 'en')).toBe('JA');
  });
});
