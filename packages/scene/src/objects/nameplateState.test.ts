import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@secret-table/contracts';
import { avatarForSeat } from '@secret-table/contracts';
import { label, palette } from '../materials/palette';
import { clipName, nameplateOffice, nameplateState } from './nameplateState';
import type { NameplateContext } from './nameplateState';

const player = (overrides: Partial<PlayerView> = {}): PlayerView => ({
  playerId: 'p4', seatIndex: 3, displayName: 'Kaan', connected: true, ready: false, alive: true,
  isHost: false, office: 'none', isPresidentialCandidate: false, isChancellorCandidate: false, hasVoted: false,
  avatar: avatarForSeat(3),
  ...overrides,
});

const ctx = (overrides: Partial<NameplateContext> = {}): NameplateContext => ({
  local: false, lobby: false, targetable: false, hovered: false, aimed: false, selected: false, vote: null,
  ...overrides,
});

describe('satır 2 kelime önceliği', () => {
  it('ELENDİ her şeyin önüne geçer ve makam simgesi düşer', () => {
    const state = nameplateState(
      player({ alive: false, connected: false, office: 'president' }),
      ctx({ selected: true, targetable: true, vote: { kind: 'vote', vote: 'yes' } }),
    );
    expect(state.text).toBe('ELENDİ');
    expect(state.glyph).toBeNull();
    expect(state.chip).toBeNull();
    expect(state.dead).toBe(true);
  });

  it('BAĞLANTI YOK seçimin ve makamın önündedir, simge kalır', () => {
    const state = nameplateState(player({ connected: false, office: 'president' }), ctx({ selected: true, targetable: true }));
    expect(state.text).toBe('BAĞLANTI YOK');
    expect(state.textColor).toBe(label.warn);
    expect(state.glyph).toEqual({ kind: 'disc', candidate: false, color: label.ink });
  });

  it('SEÇİLDİ, HEDEF SEÇ ve makamın önündedir', () => {
    const state = nameplateState(player({ office: 'chancellor' }), ctx({ selected: true, targetable: true }));
    expect(state.text).toBe('SEÇİLDİ');
    expect(state.bg).toBe(label.selectedBg);
    expect(state.nameColor).toBe(label.ink);
  });

  it('HEDEF SEÇ makamın önündedir; hover/aimed altın, sade hedefte yeşil', () => {
    expect(nameplateState(player({ office: 'president' }), ctx({ targetable: true })).text).toBe('HEDEF SEÇ');
    expect(nameplateState(player(), ctx({ targetable: true })).textColor).toBe(label.target);
    expect(nameplateState(player(), ctx({ targetable: true, hovered: true })).textColor).toBe(label.gold);
    expect(nameplateState(player(), ctx({ targetable: true, aimed: true })).textColor).toBe(label.gold);
  });

  it('makam kelimesi HAZIR ve KOLTUK dolgusunun önündedir', () => {
    const state = nameplateState(player({ office: 'president', ready: true }), ctx({ lobby: true }));
    expect(state.text).toBe('BAŞKAN');
    expect(state.textColor).toBe(label.gold);
  });

  it('HAZIR yalnız lobide çıkar, sonra KOLTUK dolgusu döner', () => {
    expect(nameplateState(player({ ready: true }), ctx({ lobby: true })).text).toBe('HAZIR');
    expect(nameplateState(player({ ready: true }), ctx({ lobby: true })).textColor).toBe(label.ready);
    expect(nameplateState(player({ ready: true }), ctx()).text).toBe('KOLTUK 04');
  });

  it('dolgu iki haneli koltuk numarası verir', () => {
    expect(nameplateState(player({ seatIndex: 0 }), ctx()).text).toBe('KOLTUK 01');
    expect(nameplateState(player({ seatIndex: 9 }), ctx()).text).toBe('KOLTUK 10');
  });
});

describe('çerçeve önceliği', () => {
  it('seçili > hedeflendi > hover > elendi > bağlantı yok > hedef > sen > varsayılan', () => {
    const frame = (c: Partial<NameplateContext>, p: Partial<PlayerView> = {}) => nameplateState(player(p), ctx(c)).frame;
    expect(frame({ selected: true, aimed: true }, { alive: false })).toBe(label.gold);
    expect(frame({ aimed: true }, { alive: false })).toBe(label.gold);
    expect(frame({ hovered: true }, { connected: false })).toBe(label.gold);
    expect(frame({ targetable: true }, { alive: false })).toBe(label.lineDead);
    expect(frame({ targetable: true }, { connected: false })).toBe(label.warn);
    expect(frame({ targetable: true, local: true })).toBe(label.target);
    expect(frame({ local: true })).toBe(label.lineLocal);
    expect(frame({})).toBe(label.line);
  });

  it('yalnız klavye hedeflemesi kalın çerçeve ve köşe kancası çizer', () => {
    expect(nameplateState(player(), ctx({ aimed: true })).frameWidth).toBeCloseTo(.010);
    expect(nameplateState(player(), ctx({ aimed: true })).brackets).toBe(true);
    expect(nameplateState(player(), ctx({ hovered: true })).frameWidth).toBeCloseTo(.006);
    expect(nameplateState(player(), ctx({ hovered: true })).brackets).toBe(false);
  });
});

describe('makam simgesi', () => {
  it('aday makamı seçilmiş makamın önündedir', () => {
    expect(nameplateOffice(player({ isPresidentialCandidate: true, office: 'chancellor' }))).toBe('president_candidate');
    expect(nameplateOffice(player({ isChancellorCandidate: true }))).toBe('chancellor_candidate');
    expect(nameplateOffice(player({ office: 'chancellor' }))).toBe('chancellor');
    expect(nameplateOffice(player())).toBeNull();
  });

  it('başkan ailesi disk, şansölye ailesi halka; adaylar kesikli', () => {
    expect(nameplateState(player({ office: 'president' }), ctx()).glyph)
      .toEqual({ kind: 'disc', candidate: false, color: label.gold });
    expect(nameplateState(player({ isChancellorCandidate: true }), ctx()).glyph)
      .toEqual({ kind: 'ring', candidate: true, color: label.gold });
    expect(nameplateState(player({ isChancellorCandidate: true }), ctx()).text).toBe('ŞANSÖLYE ADAYI');
  });
});

describe('oy çipi (D5 gömülü)', () => {
  it('dolgu metni düşer, makam kelimesi kalır', () => {
    expect(nameplateState(player(), ctx({ vote: { kind: 'waiting' } })).text).toBeNull();
    expect(nameplateState(player({ office: 'president' }), ctx({ vote: { kind: 'voted' } })).text).toBe('BAŞKAN');
  });

  it('kelime ve koyu ton D5 kararlarını korur', () => {
    expect(nameplateState(player(), ctx({ vote: { kind: 'waiting' } })).chip)
      .toEqual({ accent: palette.voteIdle, ink: palette.voteIdleText, label: 'BEKLİYOR', mark: 'idle', alpha: .78 });
    expect(nameplateState(player(), ctx({ vote: { kind: 'voted' } })).chip?.label).toBe('OY VERDİ');
    expect(nameplateState(player(), ctx({ vote: { kind: 'vote', vote: 'yes' } })).chip)
      .toEqual({ accent: palette.voteYes, ink: palette.voteYesText, label: 'EVET', mark: 'yes', alpha: 1 });
    expect(nameplateState(player(), ctx({ vote: { kind: 'vote', vote: 'no' } })).chip)
      .toEqual({ accent: palette.voteNo, ink: palette.voteNoText, label: 'HAYIR', mark: 'no', alpha: 1 });
  });

  it('yerel oyuncuda ve elenende çip yoktur', () => {
    expect(nameplateState(player(), ctx({ local: true, vote: { kind: 'voted' } })).chip).toBeNull();
    expect(nameplateState(player({ alive: false }), ctx({ vote: { kind: 'voted' } })).chip).toBeNull();
  });
});

describe('isim', () => {
  it('15 karakterden uzun ad 14 + üç nokta olur', () => {
    expect(clipName('Ayşegül Demirtaşoğlu')).toBe('Ayşegül Demirt…');
    expect(Array.from(clipName('Ayşegül Demirtaşoğlu')).length).toBe(15);
    expect(clipName('Mehmet Ali Kaan')).toBe('Mehmet Ali Kaan');
  });

  it('yerel oyuncu SEN rozeti taşır, başkası taşımaz', () => {
    expect(nameplateState(player(), ctx({ local: true })).tag).toBe('SEN');
    expect(nameplateState(player(), ctx()).tag).toBeNull();
  });
});
