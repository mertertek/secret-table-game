/**
 * Üst bilgi şeridi metni — ROADMAP A2/2 birim testleri.
 *
 * Saf fonksiyon; DOM yok. Metinlerin Türkçe olduğu, ham anahtar/İngilizce
 * sızmadığı ve "kimin sırası / ne yapmalı" bilgisinin doğru üretildiği sınanır.
 */
import type { SceneCue, SceneView } from '@secret-table/contracts';
import { getSceneFixture } from '@secret-table/fixtures';
import { describe, expect, it } from 'vitest';

import { statusLine, statusLineText } from './statusLine';

const fixture = (id: string) => getSceneFixture(id)!;
const line = (view: SceneView, cues: readonly SceneCue[] = []) =>
  statusLineText(statusLine(view, cues));

describe('statusLine', () => {
  it('sıra sendeyken ne yapılacağını söyler (adaylık)', () => {
    const text = line(fixture('nomination').view);
    expect(text).toContain('Aday belirleme');
    expect(text).toContain('Sıra sende: şansölye adayını seç');
  });

  it('oylamada henüz oy verilmediğini söyler', () => {
    const text = line(fixture('voting').view);
    expect(text).toContain('Oylama — sen henüz oy vermedin');
    expect(statusLine(fixture('voting').view).tone).toBe('you');
  });

  it('oy gönderildiyse bekleyen oyuncu sayısını söyler', () => {
    const text = line(fixture('voting-submitted').view);
    expect(text).toContain('Oyunu verdin');
    expect(text).toMatch(/Bekleyen|açılıyor/);
  });

  it('kart atma sırasında elin büyüklüğünü söyler', () => {
    const text = line(fixture('president-discard').view);
    expect(text).toContain('Sıra sende: 3 karttan birini at');
  });

  it('kanun seçiminde iki karttan birini söyler', () => {
    const text = line(fixture('chancellor-choice').view);
    expect(text).toContain('iki karttan birini yürürlüğe koy');
  });

  it('cards_dealt cue geldiyse kısa vurgu başlığı gösterir', () => {
    const f = fixture('president-discard');
    const text = line(f.view, f.cues);
    expect(text.startsWith('Kartlar dağıtıldı')).toBe(true);
  });

  it('sıra başkasındayken kimin ne yaptığını söyler', () => {
    const base = fixture('president-discard').view;
    // Yerel oyuncu masadaki başka bir koltuk: eylem yok, izleyici metni.
    const watcher: SceneView = { ...base, localPlayerId: 'p5', actions: [], privateView: { ...base.privateView, hand: [] } };
    const text = line(watcher, fixture('president-discard').cues);
    expect(text).toContain('Başkan Mert');
    expect(text).toContain('3 karttan birini atıyor');
    // Yerel oyuncuya ait olmayan dağıtım cue'su vurgu üretmez.
    expect(text.startsWith('Başkan kart atıyor')).toBe(true);
  });

  it('adaylık aşamasında başkanı adıyla söyler', () => {
    const base = fixture('nomination').view;
    const watcher: SceneView = { ...base, localPlayerId: 'p5', actions: [] };
    expect(line(watcher)).toContain('Başkan Mert şansölye adayını seçiyor');
  });

  it('duraklamada bekleneni söyler', () => {
    const base = fixture('nomination').view;
    const paused: SceneView = {
      ...base,
      actions: [],
      paused: { reason: 'player_offline', waitingForPlayerIds: ['p3'] },
    };
    const result = statusLine(paused);
    expect(result.tone).toBe('warn');
    expect(statusLineText(result)).toContain('Deniz');
    expect(statusLineText(result)).toContain('duraklatıldı');
  });

  it('oyun sonunda kazananı söyler', () => {
    const result = statusLine(fixture('game-over-liberal').view);
    expect(statusLineText(result)).toBe('Oyun bitti — Liberaller kazandı');
    expect(result.tone).toBe('result');
  });

  it('başkanlık yetkisinde yetkinin ne olduğunu söyler', () => {
    const base = fixture('executive-action').view;
    expect(line(base)).toMatch(/Sıra sende: .*oyuncu seç/);
    const watcher: SceneView = { ...base, localPlayerId: 'p5', actions: [] };
    expect(line(watcher)).toContain('kullanıyor');
  });

  // --- D5: oy durumu ve oy sonucu -------------------------------------------

  it('oylamada bekleyen oyuncuları isimle sayar', () => {
    const text = line(fixture('voting-waiting').view);
    expect(text).toContain('Bekleyen: Deniz, Ada');
    // Elenen oyuncu beklenenler arasında değildir.
    expect(text).not.toContain('Barış');
    // Oy veren isimler oylama sırasında sızmaz (yalnız bekleyenler görünür).
    expect(text).not.toContain('Elif');
  });

  it('bekleyen listesi en fazla dört isim + kalanı gösterir', () => {
    const base = fixture('voting').view;
    const many: SceneView = {
      ...base,
      actions: [],
      players: base.players.map((p) => ({ ...p, hasVoted: false })),
    };
    const text = line(many);
    expect(text).toContain('Bekleyen: Mert, Elif, Deniz, Kaan (sen) +3');
  });

  it('oylar açılınca sayacı ve kimin ne oy verdiğini söyler', () => {
    const f = fixture('election-result-close');
    const result = statusLine(f.view, f.cues);
    const text = statusLineText(result);
    expect(result.headline).toBe('Hükümet kuruldu: Elif / Selin');
    expect(text).toContain('Evet 4 · Hayır 3');
    expect(text).toContain('Evet: Mert (sen), Elif, Selin, Ada');
    expect(text).toContain('Hayır: Deniz, Kaan, Barış');
    expect(result.tone).toBe('result');
  });

  it('reddedilen seçimde başlık reddi söyler', () => {
    const base = fixture('election-result-close').view;
    const rejected: SceneView = {
      ...base,
      table: { ...base.table, lastElection: { ...base.table.lastElection!, outcome: 'rejected' } },
    };
    expect(statusLine(rejected).headline).toBe('Hükümet reddedildi');
  });

  it('motorda election_result aşaması yok: cue geldiğinde sonraki aşamada da sayacı gösterir', () => {
    const f = fixture('election-result-close');
    // Gerçek oyunda oylar açılırken aşama çoktan kanun aşamasına geçmiştir.
    const next: SceneView = { ...f.view, phase: 'president_discard', phaseId: 'president_discard_4' };
    const text = statusLineText(statusLine(next, f.cues));
    expect(text).toContain('Hükümet kuruldu');
    expect(text).toContain('Evet 4 · Hayır 3');
  });

  it('kendi sıran varken sonuç sayacı kısa biçimde eklenir', () => {
    const f = fixture('election-result-close');
    const president: SceneView = {
      ...f.view,
      phase: 'president_discard',
      phaseId: 'president_discard_4',
      localPlayerId: 'p2',
      actions: [
        {
          actionId: 'act_discard',
          kind: 'discard_policy',
          phaseId: 'president_discard_4',
          requiresConfirmation: false,
          options: [{ optionId: 'c1', labelKey: 'card' }, { optionId: 'c2', labelKey: 'card' }, { optionId: 'c3', labelKey: 'card' }],
        },
      ],
    };
    const text = statusLineText(statusLine(president, f.cues));
    expect(text).toContain('Sıra sende: 3 karttan birini at');
    expect(text).toContain('Evet 4 · Hayır 3');
  });

  it('cue yokken ve aşama geçmişken eski seçim şeride yapışmaz', () => {
    const f = fixture('election-result-close');
    const later: SceneView = { ...f.view, phase: 'president_discard', phaseId: 'president_discard_4' };
    const text = statusLineText(statusLine(later, []));
    expect(text).not.toContain('Evet 4');
    expect(text).toContain('Başkan kart atıyor');
  });

  it('hiçbir aşamada ham anahtar veya İngilizce sızmaz', () => {
    for (const id of [
      'nomination',
      'voting',
      'voting-submitted',
      'election-result',
      'election-result-close',
      'voting-waiting',
      'president-discard',
      'chancellor-choice',
      'veto-response',
      'policy-result',
      'executive-action',
      'role-reveal-liberal',
      'game-over-liberal',
    ]) {
      const text = line(fixture(id).view, fixture(id).cues);
      expect(text.length).toBeGreaterThan(3);
      expect(text).not.toMatch(/_/); // snake_case anahtar
      expect(text).not.toMatch(/\b(president|chancellor|policy|vote|liberal|fascist)\b/i);
    }
  });
});
