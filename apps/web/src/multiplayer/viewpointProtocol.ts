/** Private per-actor topics establish identity; wire data never chooses an actor. */
import { EMOTE_MAX_DURATION_MS, VIEWPOINT_PITCH_LIMIT, VIEWPOINT_YAW_LIMIT, VIEWPOINT_STALE_MS, isEmoteKind,
  type EmoteSignal, type HeadViewpoint } from '@secret-table/contracts';

export type ViewpointScope = {
  roomId: string;
  gameId: string;
  localPlayerId: string;
  players: readonly { playerId: string; seatIndex: number }[];
};
export type HeadWire = { epoch: number; seq: number; yaw: number; pitch: number; emote?: EmoteSignal };
/** D16: `emoteSeq` aynı jesti iki kez oynatmayı engeller (tekrar paketleri aynı `seq`i taşır). */
export type HeadCursor = { epoch: number; seq: number; receivedAt: number; emoteSeq?: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function viewpointTopic(scope: Pick<ViewpointScope, 'roomId' | 'gameId'>, playerId: string): string {
  if (![scope.roomId, scope.gameId, playerId].every((id) => UUID.test(id))) throw new Error('Invalid viewpoint scope');
  return `room:${scope.roomId}:viewpoint:${scope.gameId}:${playerId}`;
}
/** ~67 billed messages/sec ceiling under continuous all-player movement, before other traffic. */
export function viewpointInterval(playerCount: number): number {
  return Math.max(500, Math.min(10, Math.max(1, playerCount)) ** 2 * 15);
}
/**
 * D16 — jest alanı: bilinmeyen `kind`, bozuk şekil ya da geçersiz `seq` alanı
 * DÜŞÜRÜR; bakış paketi yine kabul edilir (tasarım §4).
 */
export function parseEmoteWire(raw: unknown): EmoteSignal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'at,kind,seq') return null;
  if (!isEmoteKind(v.kind)) return null;
  if (!Number.isSafeInteger(v.seq) || (v.seq as number) < 1) return null;
  if (!Number.isSafeInteger(v.at) || (v.at as number) < 1) return null;
  return { kind: v.kind, seq: v.seq as number, at: v.at as number };
}
/** Strict schema: no private data, supplied playerId or arbitrary fields travel through. */
export function parseHeadWire(raw: unknown): HeadWire | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const keys = Object.keys(v).sort().join(',');
  if (keys !== 'epoch,pitch,seq,yaw' && keys !== 'emote,epoch,pitch,seq,yaw') return null;
  if (!Number.isSafeInteger(v.epoch) || (v.epoch as number) < 1 ||
      !Number.isSafeInteger(v.seq) || (v.seq as number) < 1 ||
      typeof v.yaw !== 'number' || !Number.isFinite(v.yaw) || Math.abs(v.yaw) > VIEWPOINT_YAW_LIMIT ||
      typeof v.pitch !== 'number' || !Number.isFinite(v.pitch) || Math.abs(v.pitch) > VIEWPOINT_PITCH_LIMIT) return null;
  const head: HeadWire = { epoch: v.epoch as number, seq: v.seq as number, yaw: v.yaw, pitch: v.pitch };
  // Bilinmeyen jest paketi düşürmez: alan atılır, bakış geçer.
  const emote = 'emote' in v ? parseEmoteWire(v.emote) : null;
  if (emote) head.emote = emote;
  return head;
}
/** Sender epoch is ordered only; TTL uses the receiver clock, not an untrusted sender timestamp. */
export function acceptHeadWire(raw: unknown, sourcePlayerId: string, scope: ViewpointScope,
  previous: HeadCursor | undefined, now: number): { head: HeadViewpoint; cursor: HeadCursor } | null {
  const wire = parseHeadWire(raw);
  const actor = scope.players.find((p) => p.playerId === sourcePlayerId);
  if (!wire || !actor || sourcePlayerId === scope.localPlayerId) return null;
  if (previous && (wire.epoch < previous.epoch || (wire.epoch === previous.epoch && wire.seq <= previous.seq))) return null;
  // D16: aynı `seq` yalnız BİR kez oynanır; 250/600 ms tekrarları yalnız kaybı telafi eder.
  const fresh = wire.emote && wire.emote.seq > (previous?.emoteSeq ?? 0) ? wire.emote : undefined;
  const emoteSeq = Math.max(previous?.emoteSeq ?? 0, wire.emote?.seq ?? 0);
  const head: HeadViewpoint = { roomId: scope.roomId, playerId: sourcePlayerId, seatIndex: actor.seatIndex,
    yaw: wire.yaw, pitch: wire.pitch, t: now };
  if (fresh) head.emote = fresh;
  // Scope generations retire old channels; ordered updates replace the actor's current pose.
  return { head, cursor: { epoch: wire.epoch, seq: wire.seq, receivedAt: now, emoteSeq } };
}
export function headIsStale(cursor: HeadCursor, now: number): boolean {
  return now - cursor.receivedAt > VIEWPOINT_STALE_MS;
}
/** D16 — yerelde latch'lenen jest hâlâ oynuyor mu (alıcı saatiyle). */
export function emoteAlive(receivedAt: number, now: number): boolean {
  return now - receivedAt < EMOTE_MAX_DURATION_MS + 500;
}
