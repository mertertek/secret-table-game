/**
 * Ekran ortası duyuruları — ROADMAP D9 birim testleri.
 *
 * Saf fonksiyon; DOM yok. Tekillik (aynı duyuru iki kez çıkmaz), yeniden
 * bağlanmada geçmiş fazın duyurulmaması, yerel oyuncuya özel `you` tonu,
 * cue temelli sonuçlar ve kural hatırlatmaları sınanır.
 */
import type { PublicVote, SceneCue, SceneView } from '@secret-table/contracts';
import { getSceneFixture } from '@secret-table/fixtures';
import { describe, expect, it } from 'vitest';

import {
  ANNOUNCEMENT_QUEUE_MAX,
  EXECUTION_FIRE_MS,
  EXECUTION_TOTAL_MS,
  PHASE_MS,
  RESULT_MS,
  announcementCandidates,
  announcementsFor,
  enqueueAnnouncements,
  type Announcement,
} from './announcements';

const fixture = (id: string) => getSceneFixture(id)!;
const keysOf = (list: readonly Announcement[]) => list.map((a) => a.key);
/** İlk yükleme tohumu: eldeki adaylar "görülmüş" sayılır. */
const seed = (view: SceneView, cues: readonly SceneCue[] = []) =>
  keysOf(announcementCandidates(view, cues));

const cue = (extra: Partial<SceneCue> & Pick<SceneCue, 'kind'>): SceneCue =>
  ({ cueId: 'cue_test', gameId: 'game_demo', revision: 1, ...extra }) as SceneCue;

describe('announcementsFor — tekillik ve yaşam döngüsü', () => {
  it('ilk yüklemede (previous yok) hiçbir duyuru üretmez', () => {
    expect(announcementsFor(fixture('nomination').view)).toEqual([]);
    expect(announcementsFor(fixture('voting').view, fixture('voting').cues)).toEqual([]);
  });

  it('yeniden bağlanmada geçmiş faz duyurulmaz, sonraki değişim duyurulur', () => {
    const voting = fixture('voting');
    // Yeniden bağlandık: eldeki aşama tohumlanır, ekrana bir şey çıkmaz.
    const seen = seed(voting.view, voting.cues);
    expect(announcementsFor(voting.view, voting.cues, seen)).toEqual([]);

    // Aşama gerçekten değişince duyuru gelir.
    const next = announcementsFor(fixture('president-discard').view, [], seen);
    expect(next).toHaveLength(1);
    expect(next[0]!.title).toBe('YASAMA');
  });

  it('aynı aşama tekrar tekrar gelse de duyuru bir kez çıkar', () => {
    const view = fixture('nomination').view;
    const seen: string[] = [];
    const first = announcementsFor(view, [], seen);
    expect(first).toHaveLength(1);
    seen.push(...keysOf(first));
    expect(announcementsFor(view, [], seen)).toEqual([]);
    expect(announcementsFor(view, [], seen)).toEqual([]);
  });

  it('anahtar phaseId / cueId üzerinden tekildir', () => {
    const view = fixture('nomination').view;
    expect(announcementsFor(view, [], [])[0]!.key).toBe(`phase:${view.phaseId}`);
    const f = fixture('election-result-close');
    const votes = announcementsFor(f.view, f.cues, []).find((a) => a.key.startsWith('cue:'));
    expect(votes?.key).toBe(`cue:${f.cues[0]!.cueId}`);
  });
});

describe('announcementsFor — aşama metinleri', () => {
  it('adaylık: sıra sendeyse you tonu ve kısa emir', () => {
    const [a] = announcementsFor(fixture('nomination').view, [], []);
    expect(a!.title).toBe('ADAY SEÇİMİ');
    expect(a!.subtitle).toBe('Şansölye adayını seç');
    expect(a!.tone).toBe('you');
    expect(a!.durationMs).toBe(PHASE_MS);
  });

  it('adaylık: başkası seçiyorsa adını söyler, tonu nötr', () => {
    const base = fixture('nomination').view;
    const view: SceneView = { ...base, localPlayerId: 'p5', actions: [] };
    const [a] = announcementsFor(view, [], []);
    expect(a!.subtitle).toBe('Başkan Mert şansölye adayını seçiyor');
    expect(a!.tone).toBe('phase');
  });

  it('oylama: herkeste OYLAMA yazar ve hükümet çiftini söyler', () => {
    const base = fixture('voting').view;
    const [mine] = announcementsFor(base, [], []);
    expect(mine!.title).toBe('OYLAMA');
    expect(mine!.subtitle).toBe('Mert / Deniz hükümeti için oy ver');
    expect(mine!.tone).toBe('you');

    // Oy hakkı olmayan (izleyen) oyuncuda da başlık aynıdır, ton nötr.
    const watcher: SceneView = { ...base, localPlayerId: 'p2', actions: [] };
    const [other] = announcementsFor(watcher, [], []);
    expect(other!.title).toBe('OYLAMA');
    expect(other!.tone).toBe('phase');
  });

  it('oyunu verdiysen alt satır "Oyunu verdin" olur', () => {
    const [a] = announcementsFor(fixture('voting-submitted').view, [], []);
    expect(a!.title).toBe('OYLAMA');
    expect(a!.subtitle).toBe('Oyunu verdin');
  });

  it('yasama: kart atma ve kanun seçimi', () => {
    const discard = announcementsFor(fixture('president-discard').view, [], []).at(-1)!;
    expect(discard.title).toBe('YASAMA');
    expect(discard.subtitle).toBe('Bir kart at');
    expect(discard.tone).toBe('you');

    const choice = announcementsFor(fixture('chancellor-choice').view, [], []).at(-1)!;
    expect(choice.subtitle).toBe('Kanunu seç');
  });

  it('veto yanıtı aşaması VETO başlığıyla duyurulur', () => {
    const [a] = announcementsFor(fixture('veto-response').view, [], []);
    expect(a!.title).toBe('VETO');
    expect(a!.tone).toBe('you');
  });

  it('başkanlık yetkisi: yetki adı + ne yapılacağı', () => {
    const f = fixture('executive-action');
    const [mine] = announcementsFor(f.view, [], []);
    expect(mine!.title).toBe('BAŞKANLIK YETKİSİ');
    expect(mine!.subtitle).toBe('Sadakat incelemesi · Bir oyuncu seç');
    expect(mine!.tone).toBe('you');

    const watcher: SceneView = { ...f.view, localPlayerId: 'p5', actions: [] };
    const [other] = announcementsFor(watcher, [], []);
    expect(other!.subtitle).toBe('Sadakat incelemesi · Başkan Mert oyuncu seçiyor');
  });

  it('rol dağıtımı duyurusu kimliğe bakmayı hatırlatır', () => {
    const [a] = announcementsFor(fixture('role-reveal-liberal').view, [], []);
    expect(a!.title).toBe('ROLLER DAĞITILDI');
    expect(a!.subtitle).toContain('Kimliğine bak');
  });

  it('lobide duyuru üretilmez', () => {
    expect(announcementsFor(fixture('lobby').view, [], [])).toEqual([]);
  });
});

describe('announcementsFor — cue temelli sonuçlar', () => {
  it('votes_revealed: hükümet kuruldu + sayaç', () => {
    const f = fixture('election-result-close');
    const a = announcementsFor(f.view, f.cues, []).find((x) => x.key.startsWith('cue:'))!;
    expect(a.title).toBe('HÜKÜMET KURULDU');
    expect(a.subtitle).toBe('Evet 4 · Hayır 3');
    expect(a.tone).toBe('result');
    expect(a.durationMs).toBe(RESULT_MS);
  });

  it('votes_revealed: reddedildiyse seçim sayacı ikinci satıra yazılır', () => {
    const base = fixture('election-result-close');
    const votes: PublicVote[] = [
      { playerId: 'p1', vote: 'no' },
      { playerId: 'p2', vote: 'no' },
      { playerId: 'p3', vote: 'yes' },
    ];
    const view: SceneView = {
      ...base.view,
      table: { ...base.view.table, electionTracker: 2 },
    };
    const rejected = cue({
      kind: 'votes_revealed',
      cueId: 'cue_v1',
      electionId: 'e1',
      outcome: 'rejected',
      votes,
    });
    const a = announcementsFor(view, [rejected], []).find((x) => x.key === 'cue:cue_v1')!;
    expect(a.title).toBe('HÜKÜMET REDDEDİLDİ');
    expect(a.subtitle).toBe('Evet 1 · Hayır 2');
    expect(a.note).toBe('Seçim sayacı 2/3');
  });

  it('policy_enacted: tahta durumu ile birlikte duyurulur', () => {
    const base = fixture('policy-result');
    const view: SceneView = {
      ...base.view,
      table: { ...base.view.table, liberalPolicies: 2, fascistPolicies: 2 },
    };
    const a = announcementsFor(view, base.cues, []).find((x) => x.key.startsWith('cue:'))!;
    expect(a.title).toBe('FAŞİST KANUN');
    expect(a.subtitle).toBe('Tahta: 2 liberal · 2 faşist');
    expect(a.tone).toBe('result');
  });

  it('3. faşist kanunda Hitler uyarısı düşer (tehlike tonu)', () => {
    const base = fixture('policy-result');
    const view: SceneView = {
      ...base.view,
      table: { ...base.view.table, liberalPolicies: 2, fascistPolicies: 3 },
    };
    const a = announcementsFor(view, base.cues, []).find((x) => x.key.startsWith('cue:'))!;
    expect(a.tone).toBe('danger');
    expect(a.note).toBe('Hitler artık şansölye seçilirse oyun biter');
    expect(a.durationMs).toBe(RESULT_MS);
  });

  it('5. faşist kanunda veto açıldığı duyurulur', () => {
    const base = fixture('policy-result');
    const view: SceneView = {
      ...base.view,
      table: { ...base.view.table, fascistPolicies: 5 },
    };
    const a = announcementsFor(view, base.cues, []).find((x) => x.key.startsWith('cue:'))!;
    expect(a.note).toBe('Veto açıldı');
  });

  it('liberal kanun ayrı başlıkla çıkar', () => {
    const base = fixture('policy-result');
    const view: SceneView = {
      ...base.view,
      table: { ...base.view.table, liberalPolicies: 3, fascistPolicies: 2 },
    };
    const liberal = cue({
      kind: 'policy_enacted',
      cueId: 'cue_lib',
      board: 'liberal',
      slotIndex: 2,
      policy: 'liberal',
    });
    const a = announcementsFor(view, [liberal], []).find((x) => x.key === 'cue:cue_lib')!;
    expect(a.title).toBe('LİBERAL KANUN');
    expect(a.subtitle).toBe('Tahta: 3 liberal · 2 faşist');
  });

  it('player_eliminated: infaz tehlike tonuyla ve ateş anında (D12) duyurulur', () => {
    const view = fixture('executive-action').view;
    const shot = cue({ kind: 'player_eliminated', cueId: 'cue_x', playerId: 'p3' });
    const a = announcementsFor(view, [shot], []).find((x) => x.key === 'cue:cue_x')!;
    expect(a.title).toBe('İNFAZ');
    expect(a.subtitle).toBe('Deniz vuruldu');
    expect(a.tone).toBe('danger');
    expect(a.delayMs).toBe(EXECUTION_FIRE_MS);
  });

  it('D12 §4: Hitler vurulduysa oyun sonu duyurusu koreografiyi bekler', () => {
    const over = fixture('game-over-liberal');
    const shot = cue({ kind: 'player_eliminated', cueId: 'cue_x', playerId: 'p3', revision: 60 });
    const ended = over.cues[0]!;
    const list = announcementsFor(over.view, [shot, ended], []);
    expect(list.find((x) => x.key === `cue:${ended.cueId}`)!.delayMs).toBe(EXECUTION_TOTAL_MS);
    // İnfaz olmayan oyun sonunda gecikme yok.
    expect(announcementsFor(over.view, [ended], []).find((x) => x.key === `cue:${ended.cueId}`)!.delayMs)
      .toBeUndefined();
  });

  it('office_moved yalnız özel seçimde duyurulur', () => {
    const base = fixture('executive-action').view;
    const moved = cue({
      kind: 'office_moved',
      cueId: 'cue_o',
      office: 'president',
      toPlayerId: 'p3',
    });
    // Olağan başkanlık sırası: duyuru yok.
    expect(announcementsFor(base, [moved], []).some((a) => a.key === 'cue:cue_o')).toBe(false);

    const special: SceneView = {
      ...base,
      table: {
        ...base.table,
        currentPower: { power: 'call_special_election', actorId: 'p1', targetId: 'p3' },
      },
    };
    const a = announcementsFor(special, [moved], []).find((x) => x.key === 'cue:cue_o')!;
    expect(a.title).toBe('ÖZEL SEÇİM');
    expect(a.subtitle).toBe('Mert sonraki başkanı seçti: Deniz');
  });

  it('game_ended: kazanan ve neden', () => {
    const f = fixture('game-over-liberal');
    const a = announcementsFor(f.view, f.cues, []).find((x) => x.key.startsWith('cue:'))!;
    expect(a.title).toBe('LİBERALLER KAZANDI');
    expect(a.subtitle.length).toBeGreaterThan(0);
    expect(a.tone).toBe('result');
  });

  it('veto kabulü: kanun çıkmadan şansölye eli atıldıysa VETO duyurulur', () => {
    const base = fixture('veto-response').view;
    const view: SceneView = { ...base, table: { ...base.table, electionTracker: 1 } };
    const discarded = cue({
      kind: 'cards_moved',
      cueId: 'cue_veto',
      count: 2,
      from: 'chancellor',
      to: 'discard',
    });
    const a = announcementsFor(view, [discarded], []).find((x) => x.key === 'cue:cue_veto')!;
    expect(a.title).toBe('VETO');
    expect(a.note).toBe('Seçim sayacı 1/3');

    // Aynı grupta kanun çıktıysa bu normal yasama akışıdır: veto duyurusu yok.
    const enacted = cue({
      kind: 'policy_enacted',
      cueId: 'cue_p',
      board: 'fascist',
      slotIndex: 1,
      policy: 'fascist',
    });
    const withPolicy = announcementsFor(view, [discarded, enacted], []);
    expect(withPolicy.some((x) => x.key === 'cue:cue_veto')).toBe(false);
  });

  it('kaos: genel geçmişteki yeni chaos_policy girişi duyurulur', () => {
    const base = fixture('nomination').view;
    const view: SceneView = {
      ...base,
      table: {
        ...base.table,
        publicHistory: [
          ...base.table.publicHistory,
          { entryId: 'h_chaos_1', kind: 'chaos_policy', policy: 'fascist' },
        ],
      },
    };
    const a = announcementsFor(view, [], []).find((x) => x.key === 'history:h_chaos_1')!;
    expect(a.title).toBe('KAOS');
    expect(a.subtitle).toBe('Üç başarısız seçim: üstteki kanun uygulandı');
    expect(a.tone).toBe('danger');
  });

  it('cards_dealt ekran ortasını kaplamaz (üst şeride bırakılır)', () => {
    const f = fixture('president-discard');
    const list = announcementsFor(f.view, f.cues, []);
    expect(list.every((a) => !a.key.startsWith('cue:') || a.title !== 'Kartlar dağıtıldı')).toBe(
      true,
    );
    expect(list.filter((a) => a.key.startsWith('cue:'))).toEqual([]);
  });

  it('sonuç duyurusu yeni aşama duyurusundan önce sıralanır', () => {
    // Motorda ayrı `election_result` aşaması yok: oylar açılır açılmaz yasama
    // aşaması gelir, yani cue ve yeni aşama AYNI görünümde bulunur (D5).
    const f = fixture('president-discard');
    const votes = cue({
      kind: 'votes_revealed',
      cueId: 'cue_v9',
      electionId: 'e9',
      outcome: 'elected',
      votes: [
        { playerId: 'p1', vote: 'yes' },
        { playerId: 'p2', vote: 'yes' },
      ],
    });
    const list = announcementsFor(f.view, [votes], []);
    expect(list.length).toBeGreaterThan(1);
    expect(list[0]!.key.startsWith('cue:')).toBe(true);
    expect(list.at(-1)!.key.startsWith('phase:')).toBe(true);
  });
});

describe('enqueueAnnouncements', () => {
  const item = (key: string): Announcement => ({
    key,
    title: key,
    subtitle: '',
    tone: 'phase',
    durationMs: PHASE_MS,
  });

  it('kuyruk en çok 3 duyuru tutar, en eski düşer', () => {
    expect(ANNOUNCEMENT_QUEUE_MAX).toBe(3);
    const q = enqueueAnnouncements([], [item('a'), item('b')]);
    expect(keysOf(q)).toEqual(['a', 'b']);
    const full = enqueueAnnouncements(q, [item('c'), item('d')]);
    expect(keysOf(full)).toEqual(['b', 'c', 'd']);
  });

  it('boş ekleme kuyruğu bozmaz', () => {
    expect(keysOf(enqueueAnnouncements([item('a')], []))).toEqual(['a']);
  });
});

describe('gizlilik', () => {
  it('hiçbir duyuruda rol, el ya da oy tercihi geçmez', () => {
    const ids = [
      'role-reveal-fascist',
      'voting',
      'voting-submitted',
      'president-discard',
      'chancellor-choice',
      'veto-response',
      'policy-result',
      'executive-action',
      'inspection-result',
      'policy-peek',
      'game-over-fascist',
    ];
    for (const id of ids) {
      const f = fixture(id);
      const text = announcementsFor(f.view, f.cues, [])
        .map((a) => `${a.title} ${a.subtitle} ${a.note ?? ''}`)
        .join(' | ');
      // Ham anahtar / İngilizce sızıntısı yok.
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
      // Başka oyuncunun rolü ya da gizli el içeriği duyuruya girmez.
      expect(text).not.toMatch(/Hitler’in|liberal kart|faşist kart/i);
    }
  });
});
