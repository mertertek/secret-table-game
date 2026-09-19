/**
 * Bellekte GameGateway uygulaması. Testler ve Supabase erişimi olmayan yerel
 * geliştirme içindir. Kalıcılık yok; süreç yeniden başlayınca sıfırlanır.
 *
 * JavaScript tek iş parçacıklı olduğundan her metot, içinde `await` olmadığı
 * sürece atomiktir; `commitMove` bu sayede gerçek RPC'nin CAS davranışını taklit eder.
 */

import type { AvatarSelection } from '@secret-table/contracts';

import type {
  CommitMoveInput,
  CommitMoveResult,
  CreateRoomInput,
  GameGateway,
  GameStateRecord,
  JoinRoomInput,
  JoinRoomResult,
  MemberRecord,
  ProcessedCommandRecord,
  RoomRecord,
  RoomStatus,
  SessionRecord,
  StartGameInput,
} from './gateway';

export type RevisionListener = (signal: { roomId: string; revision: number }) => void;

export class InMemoryGateway implements GameGateway {
  private rooms = new Map<string, RoomRecord>();
  private membersByRoom = new Map<string, MemberRecord[]>();
  private gameStates = new Map<string, GameStateRecord>();
  private processed = new Map<string, ProcessedCommandRecord>();
  private sessions = new Map<string, SessionRecord>();
  private listeners = new Set<RevisionListener>();

  /** Realtime sürüm sinyali abonesi (DB tetikleyicisinin yerel karşılığı). */
  onRevision(listener: RevisionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitRevision(roomId: string, revision: number): void {
    for (const listener of this.listeners) listener({ roomId, revision });
  }

  private sessionKey(roomId: string, userId: string): string {
    return `${roomId}:${userId}`;
  }

  async getRoom(roomId: string): Promise<RoomRecord | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async getRoomByInvite(inviteCode: string): Promise<RoomRecord | null> {
    for (const room of this.rooms.values()) {
      if (room.inviteCode === inviteCode) return room;
    }
    return null;
  }

  async createRoom(input: CreateRoomInput): Promise<RoomRecord> {
    const room: RoomRecord = {
      roomId: input.roomId,
      inviteCode: input.inviteCode,
      status: 'lobby',
      hostUserId: input.hostUserId,
      reconnectSeconds: input.reconnectSeconds,
      createdAt: input.now,
      gameId: null,
    };
    this.rooms.set(room.roomId, room);
    this.membersByRoom.set(room.roomId, [
      {
        roomId: room.roomId,
        userId: input.hostUserId,
        playerId: input.hostPlayerId,
        seatIndex: 0,
        displayName: input.hostDisplayName,
        status: 'active',
        ready: false,
        avatar: null,
      },
    ]);
    return room;
  }

  async joinRoom(input: JoinRoomInput): Promise<JoinRoomResult> {
    const room = this.rooms.get(input.roomId);
    if (!room) return { ok: false, reason: 'ROOM_NOT_FOUND' };
    if (room.status !== 'lobby') return { ok: false, reason: 'GAME_ALREADY_STARTED' };

    const members = this.membersByRoom.get(input.roomId) ?? [];
    const existing = members.find((m) => m.userId === input.userId);
    if (existing) {
      existing.status = 'active';
      existing.displayName = input.displayName;
      return { ok: true, member: existing };
    }
    if (members.length >= input.maxPlayers) return { ok: false, reason: 'ROOM_FULL' };

    const member: MemberRecord = {
      roomId: input.roomId,
      userId: input.userId,
      playerId: input.playerId,
      seatIndex: members.length,
      displayName: input.displayName,
      status: 'active',
      ready: false,
      avatar: null,
    };
    members.push(member);
    this.membersByRoom.set(input.roomId, members);
    return { ok: true, member };
  }

  async listMembers(roomId: string): Promise<MemberRecord[]> {
    return [...(this.membersByRoom.get(roomId) ?? [])].sort((a, b) => a.seatIndex - b.seatIndex);
  }

  async getMembershipByUser(roomId: string, userId: string): Promise<MemberRecord | null> {
    return (this.membersByRoom.get(roomId) ?? []).find((m) => m.userId === userId) ?? null;
  }

  async setMemberReady(roomId: string, userId: string, ready: boolean): Promise<void> {
    const member = (this.membersByRoom.get(roomId) ?? []).find((m) => m.userId === userId);
    if (member) member.ready = ready;
  }

  async setMemberAvatar(roomId: string, userId: string, avatar: AvatarSelection): Promise<void> {
    const member = (this.membersByRoom.get(roomId) ?? []).find((m) => m.userId === userId);
    if (member) member.avatar = { ...avatar };
  }

  async startGame(input: StartGameInput): Promise<void> {
    const room = this.rooms.get(input.roomId);
    if (!room) throw new Error('startGame: oda yok');
    room.status = 'in_game';
    room.gameId = input.gameId;
    this.gameStates.set(input.roomId, {
      roomId: input.roomId,
      gameId: input.gameId,
      revision: input.state.revision,
      stateVersion: 1,
      state: structuredClone(input.state),
      updatedAt: input.now,
      // Yeni oyun: önceki oyunun olayları taşınmaz (D18/B4).
      lastEvents: null,
    });
    this.emitRevision(input.roomId, input.state.revision);
  }

  async restartGame(input: StartGameInput): Promise<void> {
    const room = this.rooms.get(input.roomId);
    if (!room) throw new Error('restartGame: oda yok');
    if (room.status !== 'lobby') {
      // Devam eden oyun korunur: yalnız kayıtlı durum game_over ise yeniden başlat.
      const current = this.gameStates.get(input.roomId);
      if (!current || current.state.phase.kind !== 'game_over') {
        throw new Error('restartGame: oyun sürüyor, sıfırlanamaz');
      }
    }
    room.status = 'in_game';
    room.gameId = input.gameId;
    this.gameStates.set(input.roomId, {
      roomId: input.roomId,
      gameId: input.gameId,
      revision: input.state.revision,
      stateVersion: 1,
      state: structuredClone(input.state),
      updatedAt: input.now,
      lastEvents: null,
    });
    // Eski oyunun idempotency kayıtları yeni oyunda gereksiz; birikmeyi önle.
    for (const [key, record] of this.processed) {
      if (record.roomId === input.roomId && record.gameId !== input.gameId) {
        this.processed.delete(key);
      }
    }
    this.emitRevision(input.roomId, input.state.revision);
  }

  async getGameState(roomId: string): Promise<GameStateRecord | null> {
    const record = this.gameStates.get(roomId);
    return record
      ? {
          ...record,
          state: structuredClone(record.state),
          lastEvents: record.lastEvents ? structuredClone(record.lastEvents) : null,
        }
      : null;
  }

  async getProcessedCommand(
    roomId: string,
    commandKey: string,
  ): Promise<ProcessedCommandRecord | null> {
    return this.processed.get(`${roomId}:${commandKey}`) ?? null;
  }

  async commitMove(input: CommitMoveInput): Promise<CommitMoveResult> {
    const dupKey = `${input.roomId}:${input.commandKey}`;
    const dup = this.processed.get(dupKey);
    if (dup) {
      if (dup.requestDigest !== input.requestDigest) {
        return { ok: false, reason: 'DUPLICATE_DIGEST_MISMATCH' };
      }
      return { ok: false, reason: 'DUPLICATE', existing: dup };
    }

    const current = this.gameStates.get(input.roomId);
    if (!current || current.revision !== input.expectedRevision) {
      return { ok: false, reason: 'VERSION_CONFLICT' };
    }

    current.state = structuredClone(input.nextState);
    current.revision = input.nextRevision;
    current.updatedAt = input.now;
    // D18/B4 — olaylar durumla AYNI yazımda; sürüm ile olay asla ayrışmaz.
    current.lastEvents = input.lastEvents ? structuredClone(input.lastEvents) : null;

    this.processed.set(dupKey, {
      roomId: input.roomId,
      gameId: input.gameId,
      commandKey: input.commandKey,
      userId: input.userId,
      requestDigest: input.requestDigest,
      resultRevision: input.nextRevision,
      createdAt: input.now,
    });

    this.emitRevision(input.roomId, input.nextRevision);
    return { ok: true };
  }

  async getSession(roomId: string, userId: string): Promise<SessionRecord | null> {
    return this.sessions.get(this.sessionKey(roomId, userId)) ?? null;
  }

  /** D21/J — oda kapsamında tek turda (üye başına sorgu yok). */
  async listSessions(roomId: string): Promise<SessionRecord[]> {
    const out: SessionRecord[] = [];
    for (const session of this.sessions.values()) {
      if (session.roomId === roomId) out.push(session);
    }
    return out;
  }

  async touchSession(roomId: string, userId: string, now: string): Promise<SessionRecord> {
    const key = this.sessionKey(roomId, userId);
    const existing = this.sessions.get(key);
    const record: SessionRecord = existing
      ? { ...existing, lastSeenAt: now }
      : { roomId, userId, sessionGeneration: 1, lastSeenAt: now };
    this.sessions.set(key, record);
    return record;
  }

  async bumpSessionGeneration(roomId: string, userId: string, now: string): Promise<number> {
    const key = this.sessionKey(roomId, userId);
    const existing = this.sessions.get(key);
    const generation = (existing?.sessionGeneration ?? 0) + 1;
    this.sessions.set(key, { roomId, userId, sessionGeneration: generation, lastSeenAt: now });
    return generation;
  }

  async setRoomStatus(roomId: string, status: RoomStatus, _now: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) room.status = status;
  }

  /** D21/A — durum satırına dokunmadan sürüm sinyali (yerel dinleyicilere). */
  async notifyRevision(roomId: string, revision: number): Promise<void> {
    this.emitRevision(roomId, revision);
  }
}
