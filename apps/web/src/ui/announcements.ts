/**
 * Ekran ortası faz / olay duyuruları — ROADMAP D9.
 *
 * Saf katman: yetkili `SceneView` (+ o an elde olan cue kuyruğu) → kısa süreli
 * büyük duyuru listesi. Üst şerit (`statusLine.ts`) "şu an ne oluyor" sorusunu
 * sürekli yanıtlar; buradaki duyuru yalnız **değişim anında** çıkar ve söner.
 *
 * Tekillik: her duyurunun anahtarı `phaseId` ya da `cueId` (ya da genel geçmiş
 * `entryId`) üzerinden türetilir. Daha önce gösterilmiş anahtar tekrar çıkmaz;
 * `previous` verilmezse (ilk yükleme / yeniden bağlanma tohumlaması) hiçbir
 * duyuru üretilmez — geçmiş fazlar yeniden oynatılmaz.
 *
 * Gizlilik: yalnız `SceneView`in kamu alanları (`players`, `table`,
 * `publicHistory`, `currentPower`, `lastElection`) ve yerel oyuncunun KENDİ
 * `privateView` / `actions` alanları okunur. Başka oyuncunun rolü, eli veya oy
 * tercihi hiçbir duyuruya girmez.
 *
 * DOM/React yok; `Announcer.tsx` bunu tüketir, birim testi `announcements.test.ts`.
 */

import {
  BOARD_LAYOUTS,
  ELECTION_TRACKER_MAX,
  type ActionKind,
  type PlayerView,
  type PublicHistoryEntry,
  type SceneCue,
  type SceneView,
} from '@secret-table/contracts';

import { currentLanguage, t } from '../i18n';
import { endReasonName, powerName, winnerName } from './text';

/** `phase`: nötr aşama; `you`: sıra sende; `result`: sonuç; `danger`: tehlike. */
export type AnnouncementTone = 'phase' | 'you' | 'result' | 'danger';

export type AnnouncementKey = string;

export type Announcement = {
  /** Tekil anahtar (`phase:…`, `cue:…`, `history:…`). Aynı anahtar iki kez çıkmaz. */
  key: AnnouncementKey;
  /** Büyük başlık; oyuncunun dilinde, büyük harfli. */
  title: string;
  /** Tek satır açıklama. */
  subtitle: string;
  /** İsteğe bağlı ikinci (küçük) satır: kural hatırlatması / sayaç. */
  note?: string;
  tone: AnnouncementTone;
  durationMs: number;
  /**
   * D12 §4 — duyuru cue geldiği an değil, bu kadar sonra görünür. İnfaz
   * koreografisinde başlık ATEŞ anında (1300 ms) çıkar; aynı pakette gelen
   * oyun sonu duyurusu koreografi bitene kadar (2600 ms) bekler.
   */
  delayMs?: number;
};

/** Nötr aşama duyurusu süresi. */
export const PHASE_MS = 2600;
/** Sonuç / tehlike duyurusu süresi (okunması daha önemli). */
export const RESULT_MS = 3200;
/** D12 §4 — infazda duyuru ateş anında çıkar; koreografinin toplam süresi 2600. */
export const EXECUTION_FIRE_MS = 1300;
export const EXECUTION_TOTAL_MS = 2600;
/** Aynı anda bekleyebilecek en fazla duyuru; fazlası en eskiyi düşürür. */
export const ANNOUNCEMENT_QUEUE_MAX = 3;

function durationFor(tone: AnnouncementTone): number {
  return tone === 'result' || tone === 'danger' ? RESULT_MS : PHASE_MS;
}

function make(
  key: AnnouncementKey,
  title: string,
  subtitle: string,
  tone: AnnouncementTone,
  note?: string,
  delayMs?: number,
): Announcement {
  const base: Announcement = note
    ? { key, title, subtitle, note, tone, durationMs: durationFor(tone) }
    : { key, title, subtitle, tone, durationMs: durationFor(tone) };
  return delayMs ? { ...base, delayMs } : base;
}

function nameOf(players: readonly PlayerView[], id: string | null | undefined): string {
  if (!id) return t('common.player');
  return players.find((p) => p.playerId === id)?.displayName ?? t('common.player');
}

function seatWith(
  players: readonly PlayerView[],
  pick: (p: PlayerView) => boolean,
): PlayerView | null {
  return players.find(pick) ?? null;
}

function hasAction(view: SceneView, kind: ActionKind): boolean {
  return view.actions.some((a) => a.kind === kind);
}

/** Adaylıkta / oylamada başkan tarafı: önce görev, yoksa adaylık. */
function presidentName(view: SceneView): string {
  const player =
    seatWith(view.players, (p) => p.office === 'president') ??
    seatWith(view.players, (p) => p.isPresidentialCandidate);
  return player?.displayName ?? t('office.president');
}

function chancellorName(view: SceneView): string {
  const player =
    seatWith(view.players, (p) => p.office === 'chancellor') ??
    seatWith(view.players, (p) => p.isChancellorCandidate);
  return player?.displayName ?? t('office.chancellor');
}

// ---------------------------------------------------------------------------
// Aşama duyurusu
// ---------------------------------------------------------------------------

/**
 * Aşamanın kendi duyurusu. `lobby`, `election_result`, `policy_result` ve
 * `game_over` burada üretilmez: sonuçları cue duyurusu (oylar açıldı / kanun
 * kondu / oyun bitti) ve oyun sonu katmanı söyler; iki kez duyurulmaz.
 */
function phaseAnnouncement(view: SceneView): Announcement | null {
  const key = `phase:${view.phaseId}`;

  switch (view.phase) {
    case 'role_reveal':
      return make(key, t('ann.rolesDealt.title'), t('ann.rolesDealt.sub'), 'phase');

    case 'nomination':
      return hasAction(view, 'nominate')
        ? make(key, t('ann.nomination.title'), t('ann.nomination.you'), 'you')
        : make(
            key,
            t('ann.nomination.title'),
            t('ann.nomination.other', { president: presidentName(view) }),
            'phase',
          );

    case 'voting': {
      const pair = `${presidentName(view)} / ${chancellorName(view)}`;
      if (view.privateView.submittedVote) {
        return make(key, t('ann.voting.title'), t('ann.voting.voted'), 'phase');
      }
      return make(
        key,
        t('ann.voting.title'),
        t('ann.voting.sub', { pair }),
        hasAction(view, 'vote') ? 'you' : 'phase',
      );
    }

    case 'president_discard':
      return hasAction(view, 'discard_policy')
        ? make(key, t('ann.legislative.title'), t('ann.legislative.discardYou'), 'you')
        : make(
            key,
            t('ann.legislative.title'),
            t('ann.legislative.discardOther', { president: presidentName(view) }),
            'phase',
          );

    case 'chancellor_choice':
      return hasAction(view, 'enact_policy')
        ? make(key, t('ann.legislative.title'), t('ann.legislative.enactYou'), 'you')
        : make(
            key,
            t('ann.legislative.title'),
            t('ann.legislative.enactOther', { chancellor: chancellorName(view) }),
            'phase',
          );

    case 'veto_response':
      return hasAction(view, 'respond_veto')
        ? make(key, t('ann.veto.title'), t('ann.veto.you'), 'you')
        : make(
            key,
            t('ann.veto.title'),
            t('ann.veto.other', { president: presidentName(view) }),
            'phase',
          );

    case 'executive_action': {
      const power = view.table.currentPower;
      if (!power) return make(key, t('ann.power.title'), t('ann.power.generic'), 'phase');
      const label = powerName(power.power);
      const mine = hasAction(view, 'use_power');
      const actor = nameOf(view.players, power.actorId);
      if (power.power === 'policy_peek') {
        return make(
          key,
          t('ann.power.title'),
          mine
            ? t('ann.power.peekYou', { power: label })
            : t('ann.power.peekOther', { power: label, name: actor }),
          mine ? 'you' : 'phase',
        );
      }
      return make(
        key,
        t('ann.power.title'),
        mine
          ? t('ann.power.pickYou', { power: label })
          : t('ann.power.pickOther', { power: label, name: actor }),
        mine ? 'you' : 'phase',
      );
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Cue duyuruları
// ---------------------------------------------------------------------------

/** "Evet 4 · Hayır 3" — yalnız kamu `votes` dizisinden. */
function tallyText(votes: readonly { vote: 'yes' | 'no' }[]): string {
  const yes = votes.filter((v) => v.vote === 'yes').length;
  return t('status.tally', { yes, no: votes.length - yes });
}

function boardText(view: SceneView): string {
  return t('ann.board', {
    liberal: view.table.liberalPolicies,
    fascist: view.table.fascistPolicies,
  });
}

function cueAnnouncement(
  view: SceneView,
  cue: SceneCue,
  cues: readonly SceneCue[],
): Announcement | null {
  const key = `cue:${cue.cueId}`;
  const layout = BOARD_LAYOUTS[view.boardVariant];

  switch (cue.kind) {
    case 'votes_revealed': {
      if (cue.outcome === 'elected') {
        return make(key, t('ann.electionPassed.title'), tallyText(cue.votes), 'result');
      }
      const tracker = view.table.electionTracker;
      return make(
        key,
        t('ann.electionFailed.title'),
        tallyText(cue.votes),
        'result',
        tracker > 0 ? t('ann.tracker', { tracker, max: ELECTION_TRACKER_MAX }) : undefined,
      );
    }

    case 'policy_enacted': {
      const fascist = cue.policy === 'fascist';
      const title = fascist ? t('ann.policyFascist.title') : t('ann.policyLiberal.title');
      if (fascist && view.table.fascistPolicies === layout.hitlerChancellorWinAt) {
        return make(
          key,
          title,
          boardText(view),
          'danger',
          t('ann.hitlerZone'),
        );
      }
      if (fascist && view.table.fascistPolicies === layout.vetoUnlockAt) {
        return make(key, title, boardText(view), 'danger', t('ann.vetoUnlocked'));
      }
      return make(key, title, boardText(view), 'result');
    }

    case 'player_eliminated':
      // D12 §4: silah kalkıp ateş edene kadar bekler (t = 1300).
      return make(
        key,
        t('ann.execution.title'),
        t('ann.execution.sub', { name: nameOf(view.players, cue.playerId) }),
        'danger',
        undefined,
        EXECUTION_FIRE_MS,
      );

    case 'office_moved': {
      // Yalnız özel seçim duyurulur; olağan başkanlık sırası duyurulmaz.
      const power = view.table.currentPower;
      const special =
        power?.power === 'call_special_election' ||
        view.table.publicHistory.some(
          (e) => e.kind === 'power_used' && e.power === 'call_special_election',
        );
      if (cue.office !== 'president' || !special) return null;
      const actorId =
        power?.actorId ??
        [...view.table.publicHistory]
          .reverse()
          .find(
            (e): e is Extract<PublicHistoryEntry, { kind: 'power_used' }> =>
              e.kind === 'power_used' && e.power === 'call_special_election',
          )?.actorId ??
        null;
      return make(
        key,
        t('ann.specialElection.title'),
        t('ann.specialElection.sub', {
          actor: nameOf(view.players, actorId),
          target: nameOf(view.players, cue.toPlayerId),
        }),
        'result',
      );
    }

    case 'cards_moved': {
      // Veto kabul edildi: şansölyenin elindeki kanunlar atıldı ve aynı grupta
      // yürürlüğe giren kanun YOK. Normal "kanun çıkar" yolunda hep bir
      // `policy_enacted` cue'su bulunur (sözleşme `veto_enacted` taşımaz).
      if (cue.from !== 'chancellor' || cue.to !== 'discard') return null;
      if (cues.some((c) => c.kind === 'policy_enacted')) return null;
      const tracker = view.table.electionTracker;
      return make(
        key,
        t('ann.veto.title'),
        t('ann.veto.accepted'),
        'result',
        tracker > 0 ? t('ann.tracker', { tracker, max: ELECTION_TRACKER_MAX }) : undefined,
      );
    }

    case 'game_ended':
      // D12 §4: Hitler vurulduysa oyun sonu duyurusu infaz koreografisini bekler.
      return make(
        key,
        winnerName(cue.winner).toLocaleUpperCase(currentLanguage() === 'tr' ? 'tr' : 'en'),
        endReasonName(cue.reason),
        'result',
        undefined,
        cues.some((c) => c.kind === 'player_eliminated') ? EXECUTION_TOTAL_MS : undefined,
      );

    default:
      // `cards_dealt` üst şeritte yeterli; ekran ortasını kaplamaz.
      return null;
  }
}

// ---------------------------------------------------------------------------
// Genel geçmişten türeyen duyuru (kaos)
// ---------------------------------------------------------------------------

function historyAnnouncements(view: SceneView): Announcement[] {
  const out: Announcement[] = [];
  for (const entry of view.table.publicHistory) {
    if (entry.kind !== 'chaos_policy') continue;
    out.push(
      make(
        `history:${entry.entryId}`,
        t('ann.chaos.title'),
        t('ann.chaos.sub'),
        'danger',
        entry.policy === 'fascist' ? t('ann.chaos.fascist') : t('ann.chaos.liberal'),
      ),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Genel giriş
// ---------------------------------------------------------------------------

/**
 * Bu görünümün ürettiği TÜM duyuru adayları (tekrar filtresi uygulanmadan).
 * Sıra: önce biten adımın sonucu (cue / kaos), sonra yeni aşama.
 *
 * `Announcer` ilk render'da bunu yalnız **tohumlamak** için kullanır: eldeki
 * anahtarlar görülmüş sayılır, ekrana hiçbir şey çıkmaz.
 */
export function announcementCandidates(
  view: SceneView,
  cues: readonly SceneCue[] = [],
): Announcement[] {
  const out: Announcement[] = [];
  for (const cue of cues) {
    const item = cueAnnouncement(view, cue, cues);
    if (item) out.push(item);
  }
  out.push(...historyAnnouncements(view));
  const phase = phaseAnnouncement(view);
  if (phase) out.push(phase);
  return out;
}

/**
 * Gösterilecek YENİ duyurular. `previous` daha önce gösterilmiş (ya da
 * tohumlanmış) anahtarlardır; verilmezse ilk yükleme / yeniden bağlanma kabul
 * edilir ve hiçbir duyuru üretilmez.
 */
export function announcementsFor(
  view: SceneView,
  cues: readonly SceneCue[] = [],
  previous?: readonly AnnouncementKey[],
): Announcement[] {
  if (previous === undefined) return [];
  const seen = new Set(previous);
  const out: Announcement[] = [];
  for (const item of announcementCandidates(view, cues)) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

/**
 * Kuyruğa ekleme: sırayla oynatılır, en fazla `ANNOUNCEMENT_QUEUE_MAX` bekler;
 * taşarsa en eski düşer (oyuncu en güncel olayı görür).
 */
export function enqueueAnnouncements(
  queue: readonly Announcement[],
  next: readonly Announcement[],
): Announcement[] {
  if (next.length === 0) return [...queue];
  const merged = [...queue, ...next];
  return merged.slice(Math.max(0, merged.length - ANNOUNCEMENT_QUEUE_MAX));
}
