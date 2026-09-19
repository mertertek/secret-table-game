import type { SceneView, VoteValue } from '@secret-table/contracts';
import type { CardArt } from '../materials/cardArt';
import type { RigPose } from './rig';
import type { GripName } from '../hands/poses';
import { EXECUTION } from '../animation/execution';
export type CameraMode = 'overview' | 'seat' | 'inspect';
export type Look = { yaw: number; pitch: number };
export type Vec3 = readonly [number, number, number];
export type Transform = { position: Vec3; rotation: Vec3 };
/** D1: tutuş artık `curl/pinch` skaleri değil, poz adı + iki poz arası karışımdır. */
export type HandPose = Transform & { grip: GripName; blend?: { to: GripName; t: number } };
/** D1 tur 4: `voted` = oy kartı masada yüzü aşağı duruyor (eller dinlenmede).
 * D12: `ready` = infaz yetkisi işlerken silah elde, alçak hazır poz;
 * `aim` = koreografi boyunca geçici poz, hareket bitince `rest`. */
export type PoseName = 'rest' | 'hold' | 'selected' | 'placed' | 'vote' | 'voted' | 'envelope' | 'ready' | 'aim';
export type Gesture = 'draw' | 'select' | 'cancel' | 'place' | 'ballot' | 'vote' | 'envelope' | 'shoot';
/** `ghostBacks`: el zaten boşaldıysa devir hareketi boyunca çizilecek KAPALI kart
 * sayısı (sıfır = hayalet yok). Yalnız kamu bilgisi olan adet; hiçbir yüz taşımaz. */
export type RigMotion = { kind: Gesture; startedAt: number; duration: number; from: PoseName; selected: number; fromSelected?: number; fromFrame?: RigPose; ghostBacks?: number;
  /** D12 §5 — infazda elin dünya uzayındaki nişan yaw'ı (±75° kırpılmış). */
  aimYaw?: number };
export type RigState = { pose: PoseName; selected: number; motion: RigMotion | null; revision: number };
export const INITIAL_RIG: RigState = { pose: 'rest', selected: 1, motion: null, revision: 0 };
export const gestureDuration: Record<Gesture, number> = { draw: 1450, select: 440, cancel: 420, place: 1350, ballot: 900, vote: 1150, envelope: 1650, shoot: EXECUTION.totalMs };
export const destination: Record<Gesture, PoseName> = { draw: 'hold', select: 'selected', cancel: 'hold', place: 'placed', ballot: 'voted', vote: 'vote', envelope: 'envelope', shoot: 'aim' };
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0));
/** Yaw: komşu koltuklar 5–10 kişide 61–75° açıda (`layout/seats.ts` elipsi); eski 58° sınırı
 * yanındaki oyuncuya tıklamayı engelliyordu. Paylaşılan bakış sınırı ile aynı (1,4 rad ≈ 80°). */
export const lookLimits = { yaw: 1.4, pitchMin: -48 * Math.PI / 180, pitchMax: 12 * Math.PI / 180 };
export const centeredLook: Look = { yaw: 0, pitch: -.26 };
export function constrainLook(look: Look): Look { return { yaw: clamp(look.yaw, -lookLimits.yaw, lookLimits.yaw), pitch: clamp(look.pitch, lookLimits.pitchMin, lookLimits.pitchMax) }; }
export function draggedLook(start: Look, dx: number, dy: number): Look { return constrainLook({ yaw: start.yaw - dx * .0034, pitch: start.pitch + dy * .0028 }); }
export const isDrag = (dx: number, dy: number) => dx * dx + dy * dy >= 36;
export function poseAfter(state: RigState, kind: Gesture, now: number, reduced: boolean, selected = state.selected, ghostBacks = 0): RigState {
  const next = destination[kind];
  const motion: RigMotion = { kind, from: state.pose, fromSelected: state.selected, selected, duration: gestureDuration[kind], startedAt: now };
  if (ghostBacks > 0) motion.ghostBacks = Math.min(3, Math.trunc(ghostBacks));
  return { pose: next, selected, revision: state.revision + 1, motion: reduced ? null : motion };
}
export function privateArt(view: SceneView, mode: CameraMode, kind: 'policy' | 'role', index = 0): CardArt {
  if (mode === 'overview') return { kind: 'back' };
  if (kind === 'role') return view.privateView.role ? { kind: 'role', role: view.privateView.role } : { kind: 'back' };
  const card = view.privateView.hand[index]; return card ? { kind: 'policy', policy: card.policy } : { kind: 'back' };
}
export function publicVote(view: SceneView): VoteValue | undefined {
  // This prototype only demonstrates an explicitly revealed public election, never submittedVote.
  return view.table.lastElection?.votes.find((v) => v.playerId === view.localPlayerId)?.vote;
}
export type HeadSample = { playerId: string; yaw: number; pitch: number; sequence: number; receivedAt: number };
export const HEAD_TTL = 1800;
export function acceptHead(previous: HeadSample | undefined, sample: HeadSample, playerIds: readonly string[], now: number): HeadSample | undefined {
  if (!playerIds.includes(sample.playerId) || ![sample.yaw, sample.pitch, sample.receivedAt, sample.sequence].every(Number.isFinite) ||
    !Number.isInteger(sample.sequence) || sample.sequence < 0 || sample.receivedAt > now + 100 || now - sample.receivedAt > HEAD_TTL ||
    (previous && sample.playerId === previous.playerId && sample.sequence <= previous.sequence)) return previous;
  return { ...sample, yaw: clamp(sample.yaw, -.65, .65), pitch: clamp(sample.pitch, -.25, .25) };
}
export function headTarget(sample: HeadSample | undefined, now: number, connected: boolean, staleAfter = HEAD_TTL): Look {
  return !sample || !connected || now - sample.receivedAt >= staleAfter ? { yaw: 0, pitch: 0 } : { yaw: sample.yaw, pitch: sample.pitch };
}
