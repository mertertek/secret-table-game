import type { SceneCue, SceneView } from '@secret-table/contracts';

export const durations: Record<SceneCue['kind'], number> = {
  cards_dealt: 520, cards_moved: 460, votes_revealed: 480, policy_enacted: 620,
  // D12 §4: infaz koreografisi (kalk–nişan–ateş–çök–in).
  office_moved: 420, player_eliminated: 2600, game_ended: 850,
};
/** D12 §8: azaltılmış hareketde bile infazın TOPLAM süresi değişmez. */
const REDUCED_MS = 100;
const reducedDuration = (kind: SceneCue['kind']) => kind === 'player_eliminated' ? durations.player_eliminated : REDUCED_MS;
export type MotionTime = { startedAt: number; duration: number; /** D12: başlangıçtaki ölü zaman (ms). */ delay?: number };
export type ActiveCue = MotionTime & { cue: SceneCue };
export const sceneIdentity = (view: SceneView) => JSON.stringify([view.roomId, view.gameId, view.localPlayerId]);

/** Resolves a public card-movement endpoint to a seated player.
 * Current office first; the authoritative view clears `office` as soon as the
 * round advances (nomination), so the last ELECTED government is the fallback.
 * Never invents a seat: the player must still exist in the current view. */
export function cueOfficePlayerId(
  view: SceneView,
  endpoint: 'deck' | 'discard' | 'president' | 'chancellor',
): string | undefined {
  if (endpoint === 'deck' || endpoint === 'discard') return undefined;
  const current = view.players.find((p) => p.office === endpoint);
  if (current) return current.playerId;
  const election = view.table.lastElection;
  if (!election || election.outcome !== 'elected') return undefined;
  const playerId = endpoint === 'president' ? election.presidentId : election.chancellorId;
  return view.players.some((p) => p.playerId === playerId) ? playerId : undefined;
}

/** Extra defence against stale payloads. All faces still come from the CURRENT view.
 * Deal event card IDs may differ from current actionable hand IDs (server projection).
 */
export function cueMatchesView(cue: SceneCue, view: SceneView): boolean {
  if (!view.gameId || cue.gameId !== view.gameId || cue.revision !== view.revision) return false;
  switch (cue.kind) {
    case 'cards_dealt': return cue.toPlayerId === view.localPlayerId && cue.cards.length > 0 &&
      cue.cards.length === view.privateView.hand.length &&
      cue.cards.every((card, i) => card.policy === view.privateView.hand[i]?.policy);
    case 'cards_moved': return Number.isInteger(cue.count) && cue.count > 0 && cue.count <= 17 &&
      (cue.from === 'deck' || !!cueOfficePlayerId(view, cue.from)) &&
      (cue.to === 'discard' || !!cueOfficePlayerId(view, cue.to));
    case 'votes_revealed': {
      const election = view.table.lastElection;
      return !!election && election.electionId === cue.electionId && election.outcome === cue.outcome &&
        election.votes.length === cue.votes.length && cue.votes.every((v) =>
          election.votes.some((current) => current.playerId === v.playerId && current.vote === v.vote));
    }
    case 'policy_enacted': return view.table.enactedPolicies.some((tile) =>
      tile.board === cue.board && tile.slotIndex === cue.slotIndex && tile.policy === cue.policy);
    case 'office_moved': return view.players.some((p) => p.playerId === cue.toPlayerId && p.office === cue.office);
    case 'player_eliminated': return view.players.some((p) => p.playerId === cue.playerId && !p.alive);
    case 'game_ended': return view.phase === 'game_over' && view.result?.winner === cue.winner && view.result.reason === cue.reason;
  }
}

/** Latest revision wins; no historical queue. Memory is capped at 4096 IDs per game; beyond that decorations are skipped.
 * A revision above/below the current view is NEVER scheduled for future playback.
 * Delivery drain is independent of accepted motion. Explicit epoch resets cancel
 * and consume that delivery without clearing deduplication. No completion intent.
 */
export class CueLedger {
  private identity = '';
  private revision = -1;
  private seen = new Set<string>();
  private sealed = false;
  private active: ActiveCue[] = [];
  private epoch: number | undefined;
  update(view: SceneView, cues: readonly SceneCue[], now: number, enabled: boolean, reducedMotion: boolean, epoch = 0) {
    const identity = sceneIdentity(view);
    if (identity !== this.identity) {
      this.identity = identity; this.revision = -1; this.seen.clear(); this.sealed = false; this.active = []; this.epoch = undefined;
    }
    if (view.revision > this.revision) {
      this.revision = view.revision; this.active = [];
    }
    const reset = this.epoch !== undefined && this.epoch !== epoch;
    this.epoch = epoch;
    const allowed = !reset && enabled && view.connection === 'connected' && !view.paused && view.revision === this.revision;
    this.active = allowed ? this.active.filter((a) =>
      now < a.startedAt + a.duration && cueMatchesView(a.cue, view)) : [];
    const added: ActiveCue[] = [];
    // D12 §4: Hitler vurulduysa `game_ended` cue'su aynı pakette gelir. Sonuç
    // halesi/duyurusu infaz koreografisi bitene kadar BEKLER: aynı cue kabul
    // edilir, yalnız başına infaz süresi kadar ölü zaman eklenir.
    const executionInBatch = cues.some((c) => c.kind === 'player_eliminated' && c.gameId === view.gameId &&
      c.revision === this.revision && cueMatchesView(c, view)) ||
      this.active.some((a) => a.cue.kind === 'player_eliminated');
    for (const cue of cues) {
      if (cue.gameId !== view.gameId || cue.revision !== this.revision || this.seen.has(cue.cueId) || this.sealed) continue;
      this.seen.add(cue.cueId);
      if (this.seen.size >= 4096) this.sealed = true;
      if (!allowed || !cueMatchesView(cue, view) || this.active.length >= 16) continue;
      const delay = cue.kind === 'game_ended' && executionInBatch ? durations.player_eliminated : 0;
      const base = reducedMotion ? reducedDuration(cue.kind) : durations[cue.kind];
      const active: ActiveCue = delay > 0 ? { cue, startedAt: now, duration: delay + base, delay } : { cue, startedAt: now, duration: base };
      this.active.push(active); added.push(active);
    }
    return { active: [...this.active], added };
  }
}
export function progress(active: MotionTime | undefined, now: number, delay = 0) {
  return active ? Math.max(0, Math.min(1, (now - active.startedAt - delay) / Math.max(1, active.duration - delay))) : 1;
}
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
