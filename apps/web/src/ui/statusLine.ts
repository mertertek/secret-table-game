/**
 * Üst bilgi şeridi metni — ROADMAP A2/2.
 *
 * Saf fonksiyon: yetkili `SceneView` (+ o an elde olan cue kuyruğu) → tek satır
 * Türkçe durum metni. "Hangi aşamadayız, kimin sırası, ne yapması gerekiyor"
 * sorularını tek yerde yanıtlar. Metin sözlüğü `./text.ts`; burada İngilizce
 * sızmaz, ham anahtar gösterilmez.
 *
 * DOM/React yok; `GameScreen` bunu tüketir, birim testi `statusLine.test.ts`.
 */

import type {
  AllowedAction,
  PlayerView,
  SceneCue,
  SceneView,
} from '@secret-table/contracts';

import { currentLanguage, t } from '../i18n';
import { phaseName, powerName, winnerName, powerActionText } from './text';

export type StatusTone = 'idle' | 'you' | 'warn' | 'result';

export type StatusLine = {
  /** Sol segment: aşama adı ya da kısa olay vurgusu ("Kartlar dağıtıldı"). */
  headline: string;
  /** Sağ segment: kimin sırası ve ne yapması gerektiği. Boş olabilir. */
  detail: string;
  tone: StatusTone;
};

/** Şeridin tek satırlık düz metni (test ve erişilebilirlik etiketi için). */
export function statusLineText(line: StatusLine): string {
  return line.detail ? `${line.headline} — ${line.detail}` : line.headline;
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

/** En fazla `limit` ad; fazlası `+N`. Yerel oyuncu "(sen)" ile işaretlenir. */
function nameList(
  players: readonly PlayerView[],
  localPlayerId: string,
  limit = 4,
): string {
  const shown = players
    .slice(0, limit)
    .map((p) => (p.playerId === localPlayerId ? t('common.youParen', { name: p.displayName }) : p.displayName));
  const rest = players.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} +${rest}` : shown.join(', ');
}

/**
 * Oylamada kimin beklendiği (D5). Yalnız kamu alanı `hasVoted`; kimsenin
 * tercihi görünmez.
 */
function votingDetail(view: SceneView, prefix: string): string {
  const waiting = view.players.filter((p) => p.alive && !p.hasVoted);
  const tail =
    waiting.length === 0
      ? t('status.votesOpening')
      : t('status.waitingFor', { names: nameList(waiting, view.localPlayerId) });
  return prefix ? `${prefix} · ${tail}` : tail;
}

/**
 * Açıklanmış seçimin sayacı ve isim listesi (D5). Kaynak yalnız kamu alanı
 * `table.lastElection.votes`; `privateView.submittedVote` kullanılmaz.
 */
function electionTally(view: SceneView): { short: string; full: string } | null {
  const last = view.table.lastElection;
  if (!last || last.votes.length === 0) return null;
  const pick = (value: 'yes' | 'no') =>
    last.votes
      .filter((v) => v.vote === value)
      .map((v) => view.players.find((p) => p.playerId === v.playerId))
      .filter((p): p is PlayerView => Boolean(p));
  const yes = pick('yes');
  const no = pick('no');
  const short = t('status.tally', { yes: yes.length, no: no.length });
  const parts = [short];
  if (yes.length) parts.push(t('status.tallyYes', { names: nameList(yes, view.localPlayerId) }));
  if (no.length) parts.push(t('status.tallyNo', { names: nameList(no, view.localPlayerId) }));
  return { short, full: parts.join(' · ') };
}

/** "Hükümet kuruldu: Mert / Deniz" ya da "Hükümet reddedildi". */
function electionHeadline(view: SceneView): string | null {
  const last = view.table.lastElection;
  if (!last) return null;
  return last.outcome === 'elected'
    ? t('status.governmentFormed', {
        president: nameOf(view.players, last.presidentId),
        chancellor: nameOf(view.players, last.chancellorId),
      })
    : t('status.governmentRejected');
}

/**
 * Oylar bu görünümde yeni açıldı mı? Motorda ayrı `election_result` aşaması
 * yoktur (game-core `resolveVote` doğrudan kanun aşamasına geçer), bu yüzden
 * asıl işaret `votes_revealed` cue'sudur; sentetik aşama da kabul edilir.
 */
function votesJustRevealed(view: SceneView, cues: readonly SceneCue[]): boolean {
  if (view.phase === 'election_result') return true;
  const electionId = view.table.lastElection?.electionId;
  return (
    !!electionId &&
    cues.some((cue) => cue.kind === 'votes_revealed' && cue.electionId === electionId)
  );
}

/** Yetki/görev adını o dilin küçük harf kuralıyla yazar (Türkçe'de i/İ ayrı). */
function lowerCase(value: string): string {
  return value.toLocaleLowerCase(currentLanguage() === 'tr' ? 'tr' : 'en');
}

/** "Başkan Mert" / "Şansölye Elif" gibi görev + ad. */
function withOffice(label: string, player: PlayerView | null): string {
  return player ? `${label} ${player.displayName}` : label;
}

/** Yerel oyuncunun yapması gereken işin Türkçe karşılığı. */
function ownTask(action: AllowedAction, view: SceneView): string {
  switch (action.kind) {
    case 'ack_role':
      return t('status.own.ack_role');
    case 'nominate':
      return t('status.own.nominate');
    case 'vote':
      return votingDetail(
        view,
        view.privateView.submittedVote ? t('status.votedAlready') : t('status.notVotedYet'),
      );
    case 'discard_policy': {
      const count = view.privateView.hand.length || action.options.length || 3;
      return t('status.own.discard', { count });
    }
    case 'enact_policy':
      return t('status.own.enact');
    case 'request_veto':
      return t('status.own.requestVeto');
    case 'respond_veto':
      return t('status.own.respondVeto');
    case 'use_power': {
      const power = view.table.currentPower?.power;
      if (!power) return t('status.own.usePower');
      if (power === 'policy_peek') return t('status.own.peek');
      return t('status.own.powerTarget', { power: lowerCase(powerActionText(power).title) });
    }
    case 'ack_private_result':
      return t('status.own.ackPrivate');
    default:
      return t('status.own.generic');
  }
}

/**
 * Yerel oyuncunun eylemi yokken kimin ne yaptığı. Yalnız herkese açık alanlar
 * (`office`, adaylık, `hasVoted`, `currentPower`) kullanılır; gizli bilgi sızmaz.
 */
function othersTask(view: SceneView): string {
  const players = view.players;
  const president = seatWith(players, (p) => p.office === 'president');
  const chancellor = seatWith(players, (p) => p.office === 'chancellor');
  const candidate = seatWith(players, (p) => p.isPresidentialCandidate);

  switch (view.phase) {
    case 'lobby':
      return t('status.others.lobby');
    case 'role_reveal': {
      const waiting = players.filter((p) => !p.ready).length;
      return waiting > 0
        ? t('status.others.roleReveal', { count: waiting })
        : t('status.others.rolesSeen');
    }
    case 'nomination': {
      const actor = president ?? candidate;
      return actor
        ? t('status.others.nominating', { name: actor.displayName })
        : t('status.others.nominationGeneric');
    }
    case 'voting':
      return votingDetail(view, view.privateView.submittedVote ? t('status.votedAlready') : '');
    case 'election_result':
      return electionTally(view)?.full ?? electionHeadline(view) ?? t('status.others.electionResult');
    case 'president_discard':
      return t('status.others.presidentDiscard', {
        president: withOffice(t('office.president'), president),
      });
    case 'chancellor_choice':
      return t('status.others.chancellorChoice', {
        chancellor: withOffice(t('office.chancellor'), chancellor),
      });
    case 'veto_response':
      return t('status.others.vetoResponse', {
        president: withOffice(t('office.president'), president),
      });
    case 'policy_result':
      return t('status.others.policyResult');
    case 'executive_action': {
      const power = view.table.currentPower;
      const actor = power ? nameOf(players, power.actorId) : president?.displayName;
      const label = power ? powerName(power.power) : '';
      if (actor && label) {
        return t('status.others.powerInUse', { name: actor, power: lowerCase(label) });
      }
      return t('status.others.powerGeneric');
    }
    case 'game_over':
      return '';
    default:
      return t('status.others.generic');
  }
}

/** Cue kuyruğundaki kısa süreli olay vurgusu (yalnız yerel oyuncuya ait dağıtım). */
function cueHeadline(view: SceneView, cues: readonly SceneCue[]): string | null {
  for (const cue of cues) {
    if (cue.kind === 'cards_dealt' && cue.toPlayerId === view.localPlayerId) {
      return t('status.cardsDealt');
    }
  }
  return null;
}

export function statusLine(view: SceneView, cues: readonly SceneCue[] = []): StatusLine {
  if (view.phase === 'game_over') {
    return {
      headline: t('phase.game_over'),
      detail: view.result ? winnerName(view.result.winner) : '',
      tone: 'result',
    };
  }

  // Oylar açıldığında başlık sonucu söyler; sayaç + isimler ayrıntıya girer (D5).
  const revealed = votesJustRevealed(view, cues);
  const tally = revealed ? electionTally(view) : null;
  const headline =
    (revealed ? electionHeadline(view) : null) ?? cueHeadline(view, cues) ?? phaseName(view.phase) ?? '';

  if (view.paused) {
    const waiting = view.paused.waitingForPlayerIds
      .map((id) => nameOf(view.players, id))
      .join(', ');
    return {
      headline,
      detail: waiting ? t('status.pausedWaiting', { names: waiting }) : t('status.paused'),
      tone: 'warn',
    };
  }

  const action = view.actions[0];
  if (action) {
    const own = ownTask(action, view);
    return { headline, detail: tally ? `${own} · ${tally.short}` : own, tone: 'you' };
  }

  if (tally) {
    return { headline, detail: tally.full, tone: 'result' };
  }

  return { headline, detail: othersTask(view), tone: 'idle' };
}
