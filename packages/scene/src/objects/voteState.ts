/**
 * Baş üstü oy rozetinin SAF karar katmanı (ROADMAP D5).
 *
 * R3F'e bağımlı değildir; `VoteBadge.tsx` yalnız burada üretilen durumu çizer.
 * Yalnızca KAMU alanları okunur: `PlayerView.hasVoted` ve
 * `PublicTableView.lastElection.votes`. `privateView.submittedVote` buraya
 * girmez — yerel oyuncunun tercihi başkasının rozetine sızamaz.
 */

import type { PlayerView, SceneView, VoteValue } from '@secret-table/contracts';
import { sceneText, type SceneLanguage } from '../i18n/sceneText';

/**
 * Oylar açıldıktan sonra rozetin ekranda kaldığı en kısa süre (ms).
 *
 * Gerekçe: motorda ayrı bir `election_result` aşaması YOKTUR
 * (`packages/game-core/src/engine.ts` `resolveVote`); oylar açılır açılmaz
 * aşama `legislative_president`e (veya reddedilirse yeni adaylığa) geçer.
 * Bu yüzden görünürlük aşamaya değil, `votes_revealed` cue'sunun geldiği ana
 * bağlanır. Sentetik `election_result` fixture'ında aşama da kabul edilir.
 */
export const VOTE_REVEAL_MS = 5000;

/** Rozetin giriş animasyonu (ms); `reducedMotion` iken uygulanmaz. */
export const VOTE_BADGE_ENTER_MS = 240;

export type VoteBadgeState =
  | { kind: 'waiting' }
  | { kind: 'voted' }
  | { kind: 'vote'; vote: VoteValue };

export type VoteBadgeInput = {
  view: SceneView;
  player: PlayerView;
  /** Yerel oyuncu koltuk kamerasında kendi avatarını görmez; HUD zaten söyler. */
  local: boolean;
  /** `performance.now()` ekseni. */
  now: number;
  /**
   * `votes_revealed` cue'sunun ilk görüldüğü an (aynı `electionId` için).
   * Yoksa `null` — yeniden bağlanan/sonradan katılan istemcide rozet açılmaz.
   */
  revealedAt: number | null;
};

/**
 * Tek koltuk için rozet durumu. `null` → rozet çizilmez.
 *
 * Sıra önemlidir: yeni bir oylama başladıysa (faz `voting`) önceki seçimin
 * 5 sn'lik penceresi rozet kaçırmasına yol açmasın diye oylama durumu kazanır.
 */
export function voteBadgeState({ view, player, local, now, revealedAt }: VoteBadgeInput): VoteBadgeState | null {
  if (local) return null;

  if (view.phase === 'voting') {
    if (!player.alive) return null;
    return player.hasVoted ? { kind: 'voted' } : { kind: 'waiting' };
  }

  const revealed =
    view.phase === 'election_result' || (revealedAt !== null && now - revealedAt < VOTE_REVEAL_MS);
  if (!revealed) return null;

  const vote = view.table.lastElection?.votes.find((v) => v.playerId === player.playerId);
  return vote ? { kind: 'vote', vote: vote.vote } : null;
}

/** Rozet üzerindeki etiket (varsayılan dil `tr`). */
export function voteBadgeLabel(state: VoteBadgeState, language: SceneLanguage = 'tr'): string {
  if (state.kind === 'waiting') return sceneText(language, 'plate.waiting');
  if (state.kind === 'voted') return sceneText(language, 'plate.voted');
  return sceneText(language, state.vote === 'yes' ? 'card.yes' : 'card.no');
}

/** Aynı durum için kararlı kimlik — giriş animasyonu yalnız durum değişince oynar. */
export function voteBadgeKey(state: VoteBadgeState): string {
  return state.kind === 'vote' ? `vote:${state.vote}` : state.kind;
}
