import { describe, expect, it } from 'vitest';
import type { PlayerView, SceneView } from '@secret-table/contracts';
import { layoutSeats } from './seats';
import { avatarForSeat, labelHeight } from '../characters/spec';
import { availableSceneActions, boardInspectionForMode, boardInspectionForToggle, inspectionNavVisible, pickOption, publicSeatCard, resolveInspectionMode, roleToggleIntent, selectedSceneOption } from './presentation';
const players = (count: number): PlayerView[] => Array.from({ length: count }, (_, seatIndex) => ({
  playerId: `p${seatIndex}`, seatIndex, displayName: `Oyuncu ${seatIndex}`, connected: true, ready: false,
  alive: true, isHost: seatIndex === 0, office: 'none', isPresidentialCandidate: false, isChancellorCandidate: false, hasVoted: false,
  avatar: avatarForSeat(seatIndex),
}));
const view = (overrides: Partial<SceneView> = {}): SceneView => ({
  protocolVersion: 1, roomId: 'synthetic', gameId: 'synthetic-game', revision: 1, phaseId: 'phase-1', phase: 'voting',
  connection: 'connected', paused: null, playerCountAtStart: 7, boardVariant: 'medium', localPlayerId: 'p2', players: players(7),
  table: { liberalPolicies: 0, fascistPolicies: 0, electionTracker: 0, drawCount: 17, discardCount: 0, enactedPolicies: [], lastElection: null, currentPower: null, publicHistory: [] },
  privateView: { role: 'fascist', knownPlayers: [], hand: [], submittedVote: 'yes', inspection: null }, actions: [], result: null, ...overrides,
});

describe('seat layout', () => {
  for (const count of [5, 6, 7, 8, 9, 10] as const) it(`${count} seats retain spacing and put the local player at the bottom`, () => {
    const list = players(count);
    const seats = layoutSeats({ players: list, localPlayerId: 'p2', playerCountAtStart: count });
    // D6 + D3 §e: masa üstü plaka kalktı; etiket çapası baş/şapka tepesinin
    // 0,05 m üstünde (taban 0,745; şapkalı karakterlerde `labelLift` kadar yukarı).
    expect(seats.find((seat) => seat.player.playerId === 'p2')?.label).toEqual([0, labelHeight(avatarForSeat(2).character), 2]);
    for (const seat of seats) {
      expect(seat.label[0]).toBeCloseTo(seat.chair[0], 10);
      expect(seat.label[2]).toBeCloseTo(seat.chair[2], 10);
      expect(seat.label[1]).toBe(labelHeight(avatarForSeat(seat.player.seatIndex).character));
      expect(seat.label[1]).toBeGreaterThanOrEqual(.745);
      for (const boardZ of [-.4, .16]) {
        expect(Math.abs(seat.cards[0]) > 1.068 || Math.abs(seat.cards[2] - boardZ) > .355).toBe(true);
      }
    }
    // Etiket çapaları 10 kişide bile ≥ 1,2 m ayrık: baş üstü etiketler kesişmez.
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) {
      const a = seats[i]!.label, b = seats[j]!.label;
      expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeGreaterThan(1.2);
    }
    expect(list.map((p) => p.seatIndex)).toEqual(Array.from({ length: count }, (_, i) => i));
  });
  it('anchors follow server seatIndex after array reordering and elimination', () => {
    const original = view();
    const before = layoutSeats(original);
    const after = layoutSeats({ ...original, players: [...original.players].reverse().map((p) => ({ ...p, alive: false, connected: false })) });
    for (const seat of before) expect(after.find((item) => item.player.playerId === seat.player.playerId)?.chair).toEqual(seat.chair);
  });
});

describe('authorized presentation', () => {
  const action = { actionId: 'opaque-action', kind: 'vote' as const, phaseId: 'phase-1', requiresConfirmation: true, options: [{ optionId: 'opaque-option', vote: 'yes' as const, labelKey: 'yes' }] };
  it('returns opaque selection intent without changing the view', () => {
    const actions = [action];
    expect(pickOption(actions, (option) => option.vote === 'yes')).toEqual({ type: 'select_option', actionId: action.actionId, optionId: 'opaque-option' });
    expect(selectedSceneOption(actions, { actionId: 'stale', optionId: 'opaque-option' })).toBeUndefined();
    expect(pickOption(actions, (option) => option.vote === 'no')).toBeNull();
  });
  it('blocks stale, disconnected and paused actions', () => {
    expect(availableSceneActions(view({ actions: [action], phaseId: 'next' }))).toEqual([]);
    expect(availableSceneActions(view({ actions: [action], connection: 'reconnecting' }))).toEqual([]);
    expect(availableSceneActions(view({ actions: [action], paused: { reason: 'player_offline', waitingForPlayerIds: ['p3'] } }))).toEqual([]);
  });
  it('does not use private role, submitted vote or historical vote for public seats', () => {
    const current = view();
    current.players = current.players.map((p) => ({ ...p, hasVoted: true }));
    current.table.lastElection = { electionId: 'old', presidentId: 'p0', chancellorId: 'p1', outcome: 'elected', votes: [{ playerId: 'p2', vote: 'yes' }] };
    expect(publicSeatCard(current, 'p2')).toEqual({ kind: 'ballot' });
    expect(publicSeatCard({ ...current, phase: 'election_result' }, 'p2')).toEqual({ kind: 'ballot', vote: 'yes' });
    expect(publicSeatCard({ ...current, phase: 'nomination' }, 'p2')).toEqual({ kind: 'envelope' });
  });
  it('reveals only explicitly supplied public roles at game over', () => {
    const current = view({ result: { winner: 'liberal', reason: 'hitler_executed', revealedRoles: [{ playerId: 'p3', role: 'hitler' }] } });
    expect(publicSeatCard(current, 'p3')).toEqual({ kind: 'envelope' });
    expect(publicSeatCard({ ...current, phase: 'game_over' }, 'p3')).toEqual({ kind: 'role', role: 'hitler' });
    expect(publicSeatCard({ ...current, phase: 'game_over' }, 'p2')).toEqual({ kind: 'envelope' });
  });
});

it('role conceal never produces the opening inspect request', () => {
  expect(roleToggleIntent(false)).toEqual({ type: 'inspect_own_role' });
  expect(roleToggleIntent(true)).toBeNull();
});

it('controlled role requests are explicit and idempotent across HTML and scene controls', () => {
  expect(roleToggleIntent(false, true)).toEqual({ type: 'inspect_own_role', open: true });
  expect(roleToggleIntent(true, true)).toEqual({ type: 'inspect_own_role', open: false });
});

/** D11 — tek sağ üst araç çubuğu: sahne şeridi ve tahta incelemesi kaynağı. */
describe('inspection nav / board inspection (D11)', () => {
  it('şerit varsayılan olarak çizilir (dev ve prototip sayfaları bozulmaz)', () => {
    expect(inspectionNavVisible(undefined)).toBe(true);
    expect(inspectionNavVisible(true)).toBe(true);
  });

  it('yalnız açık `false` şeridi kaldırır (üretim HUD tek araç çubuğu)', () => {
    expect(inspectionNavVisible(false)).toBe(false);
  });

  it('denetim verilmezse sahnenin kendi kipi geçerlidir', () => {
    expect(resolveInspectionMode({ fallback: 'liberal' })).toBe('liberal');
    expect(resolveInspectionMode({ fallback: 'overview' })).toBe('overview');
  });

  it('uygulama denetimindeyken tahta kipi tek kaynaktır', () => {
    expect(resolveInspectionMode({ boardInspection: 'fascist', fallback: 'overview' })).toBe('fascist');
    expect(resolveInspectionMode({ boardInspection: 'off', fallback: 'liberal' })).toBe('overview');
  });

  it('özel alan her zaman önceliklidir', () => {
    expect(resolveInspectionMode({ inspectOpen: true, boardInspection: 'fascist', fallback: 'overview' })).toBe('private');
  });

  it('sahne içi kip değişimi uygulamaya tahta durumu olarak döner', () => {
    expect(boardInspectionForMode('liberal')).toBe('liberal');
    expect(boardInspectionForMode('fascist')).toBe('fascist');
    expect(boardInspectionForMode('lean')).toBe('lean');
    expect(boardInspectionForMode('overview')).toBe('off');
    expect(boardInspectionForMode('private')).toBe('off');
  });

  it('D15: `lean` koltuk kipidir; genel bakışta tepeden inceleme sürer', () => {
    expect(resolveInspectionMode({ boardInspection: 'lean', fallback: 'overview' })).toBe('lean');
    // Özel alan yine önceliklidir.
    expect(resolveInspectionMode({ inspectOpen: true, boardInspection: 'lean', fallback: 'overview' })).toBe('private');
    expect(boardInspectionForToggle('off', true)).toBe('lean');
    expect(boardInspectionForToggle('off', false)).toBe('fascist');
    expect(boardInspectionForToggle('lean', true)).toBe('off');
    expect(boardInspectionForToggle('fascist', false)).toBe('off');
  });
});
