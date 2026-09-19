/**
 * Gerçek Postgres/RPC uygulaması (Supabase service anahtarı ile).
 *
 * DURUM: Şema ve sorgular `supabase/migrations` ile birebir yazıldı ama bu
 * teslimde **canlı Supabase'e karşı çalıştırılıp doğrulanmadı** (yerel `supabase
 * start` çalıştırılmadı, uzak proje yok). Sözleşme ve orkestrasyon `InMemoryGateway`
 * ile test edilir; C03 kabul ölçütündeki 7-istemci entegrasyonu C06 öncesi
 * gerçek Supabase'te koşulmalıdır.
 *
 * Yüksek yetkili anahtar kullanıcı yetkisini otomatik uygulamaz: kimlik ve
 * üyelik doğrulaması API katmanında ayrıca yapılır (bkz. apps/web/api).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AvatarSelection } from '@secret-table/contracts';
import { isAvatarCharacterId, isAvatarSkinId } from '@secret-table/contracts';
import type { GameEvent, GameState } from '@secret-table/game-core';

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

export type SupabaseGatewayConfig = {
  url: string;
  /** Yalnız sunucu secret anahtarı; tarayıcıya veya loga girmez. */
  secretKey: string;
};

type RoomRow = {
  id: string;
  invite_code: string;
  status: RoomStatus;
  host_user_id: string;
  reconnect_seconds: number;
  created_at: string;
  game_id: string | null;
};

type MemberRow = {
  room_id: string;
  user_id: string;
  player_id: string;
  seat_index: number;
  display_name: string;
  status: 'active' | 'left';
  ready: boolean;
  /** 0008_avatar.sql. Migration uygulanmadıysa alan yanıtta HİÇ bulunmaz. */
  avatar_character?: string | null;
  avatar_skin?: string | null;
};

type GameStateRow = {
  room_id: string;
  game_id: string;
  revision: number;
  state_version: number;
  /** Durum zarfı; D18/B4 ile birlikte `__lastEvents` yan alanını da taşır. */
  state: GameState & { __lastEvents?: readonly GameEvent[] | null };
  updated_at: string;
};

/**
 * D18/B4 — son komutun olayları `game_states.state` JSONB **zarfının içinde**,
 * ayrılmış bir yan alanda taşınır.
 *
 * Neden migration yok: `commit_move(… p_next_state jsonb …)` durumu tek yazımda
 * yazar; olayları aynı jsonb'ye koymak hem `0002_functions.sql` imzasına hem de
 * `restart_finished_game`/`start_game`'e DOKUNMADAN atomikliği korur (sürüm ile
 * olaylar asla ayrı düşmez). Alan motora hiç ulaşmaz: yazarken eklenir,
 * okurken `splitEnvelope` ile ayrılır — `GameState` saf kalır. Alanı bilmeyen
 * eski satırlar `null` döner (cue dağıtımı yapılmaz, sahne durumdan türetir).
 */
const LAST_EVENTS_KEY = '__lastEvents';

function withLastEvents(
  state: GameState,
  lastEvents: readonly GameEvent[] | null | undefined,
): unknown {
  return { ...state, [LAST_EVENTS_KEY]: lastEvents ?? null };
}

function splitEnvelope(envelope: GameStateRow['state']): {
  state: GameState;
  lastEvents: readonly GameEvent[] | null;
} {
  const { [LAST_EVENTS_KEY]: lastEvents, ...state } = envelope;
  return {
    state: state as GameState,
    lastEvents: Array.isArray(lastEvents) ? lastEvents : null,
  };
}

type ProcessedCommandRow = {
  room_id: string;
  game_id: string;
  command_key: string;
  user_id: string;
  request_digest: string;
  result_revision: number;
  created_at: string;
};

type SessionRow = {
  room_id: string;
  user_id: string;
  session_generation: number;
  last_seen_at: string;
};

const toRoom = (row: RoomRow): RoomRecord => ({
  roomId: row.id,
  inviteCode: row.invite_code,
  status: row.status,
  hostUserId: row.host_user_id,
  reconnectSeconds: row.reconnect_seconds,
  createdAt: row.created_at,
  gameId: row.game_id,
});

const toMember = (row: MemberRow): MemberRecord => ({
  roomId: row.room_id,
  userId: row.user_id,
  playerId: row.player_id,
  seatIndex: row.seat_index,
  displayName: row.display_name,
  status: row.status,
  ready: row.ready,
  // Yarım kayıt (yalnız biri dolu) seçim sayılmaz: koltuk varsayılanına düşer.
  avatar:
    isAvatarCharacterId(row.avatar_character) && isAvatarSkinId(row.avatar_skin)
      ? { character: row.avatar_character, skin: row.avatar_skin }
      : null,
});

const toGameState = (row: GameStateRow): GameStateRecord => {
  const { state, lastEvents } = splitEnvelope(row.state);
  return {
    roomId: row.room_id,
    gameId: row.game_id,
    revision: row.revision,
    stateVersion: row.state_version,
    state,
    updatedAt: row.updated_at,
    lastEvents,
  };
};

const toProcessed = (row: ProcessedCommandRow): ProcessedCommandRecord => ({
  roomId: row.room_id,
  gameId: row.game_id,
  commandKey: row.command_key,
  userId: row.user_id,
  requestDigest: row.request_digest,
  resultRevision: row.result_revision,
  createdAt: row.created_at,
});

const toSession = (row: SessionRow): SessionRecord => ({
  roomId: row.room_id,
  userId: row.user_id,
  sessionGeneration: row.session_generation,
  lastSeenAt: row.last_seen_at,
});

export class SupabaseGateway implements GameGateway {
  private readonly client: SupabaseClient;

  constructor(config: SupabaseGatewayConfig) {
    this.client = createClient(config.url, config.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async getRoom(roomId: string): Promise<RoomRecord | null> {
    const { data } = await this.client.from('rooms').select('*').eq('id', roomId).maybeSingle();
    return data ? toRoom(data as RoomRow) : null;
  }

  async getRoomByInvite(inviteCode: string): Promise<RoomRecord | null> {
    const { data } = await this.client
      .from('rooms')
      .select('*')
      .eq('invite_code', inviteCode)
      .maybeSingle();
    return data ? toRoom(data as RoomRow) : null;
  }

  async createRoom(input: CreateRoomInput): Promise<RoomRecord> {
    const { data, error } = await this.client
      .rpc('create_room', {
        p_room_id: input.roomId,
        p_invite_code: input.inviteCode,
        p_host_user_id: input.hostUserId,
        p_host_player_id: input.hostPlayerId,
        p_host_display_name: input.hostDisplayName,
        p_reconnect_seconds: input.reconnectSeconds,
      })
      .single();
    if (error) throw new Error(`create_room: ${error.message}`);
    return toRoom(data as RoomRow);
  }

  async joinRoom(input: JoinRoomInput): Promise<JoinRoomResult> {
    const { data, error } = await this.client
      .rpc('join_room', {
        p_room_id: input.roomId,
        p_user_id: input.userId,
        p_player_id: input.playerId,
        p_display_name: input.displayName,
        p_max_players: input.maxPlayers,
      })
      .single();
    if (error) throw new Error(`join_room: ${error.message}`);
    const row = data as { status: string; member: MemberRow | null };
    if (row.status === 'ok' && row.member) return { ok: true, member: toMember(row.member) };
    if (row.status === 'room_full') return { ok: false, reason: 'ROOM_FULL' };
    if (row.status === 'already_started') return { ok: false, reason: 'GAME_ALREADY_STARTED' };
    return { ok: false, reason: 'ROOM_NOT_FOUND' };
  }

  async listMembers(roomId: string): Promise<MemberRecord[]> {
    const { data } = await this.client
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .order('seat_index', { ascending: true });
    return (data as MemberRow[] | null)?.map(toMember) ?? [];
  }

  async getMembershipByUser(roomId: string, userId: string): Promise<MemberRecord | null> {
    const { data } = await this.client
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    return data ? toMember(data as MemberRow) : null;
  }

  async setMemberReady(roomId: string, userId: string, ready: boolean): Promise<void> {
    await this.client
      .from('room_members')
      .update({ ready })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  }

  async setMemberAvatar(roomId: string, userId: string, avatar: AvatarSelection): Promise<void> {
    // 0008_avatar.sql gerekir. Sütun yoksa Supabase hata döndürür ve komut
    // sessizce "başarılı" görünmez: hatayı yukarı taşıyoruz.
    const { error } = await this.client
      .from('room_members')
      .update({ avatar_character: avatar.character, avatar_skin: avatar.skin })
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (error) throw new Error(`set_avatar: ${error.message} (0008_avatar.sql uygulandı mı?)`);
  }

  async startGame(input: StartGameInput): Promise<void> {
    const { error } = await this.client.rpc('start_game', {
      p_room_id: input.roomId,
      p_game_id: input.gameId,
      p_state: withLastEvents(input.state, null),
      p_revision: input.state.revision,
    });
    if (error) throw new Error(`start_game: ${error.message}`);
  }

  async restartGame(input: StartGameInput): Promise<void> {
    // 0006_rematch.sql: atomik, yetkili geçiş. Devam eden oyun sıfırlanamaz.
    const { error } = await this.client.rpc('restart_finished_game', {
      p_room_id: input.roomId,
      p_game_id: input.gameId,
      p_state: withLastEvents(input.state, null),
      p_revision: input.state.revision,
    });
    if (error) throw new Error(`restart_finished_game: ${error.message}`);
  }

  async getGameState(roomId: string): Promise<GameStateRecord | null> {
    const { data } = await this.client
      .from('game_states')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();
    return data ? toGameState(data as GameStateRow) : null;
  }

  async getProcessedCommand(
    roomId: string,
    commandKey: string,
  ): Promise<ProcessedCommandRecord | null> {
    const { data } = await this.client
      .from('processed_commands')
      .select('*')
      .eq('room_id', roomId)
      .eq('command_key', commandKey)
      .maybeSingle();
    return data ? toProcessed(data as ProcessedCommandRow) : null;
  }

  async commitMove(input: CommitMoveInput): Promise<CommitMoveResult> {
    const { data, error } = await this.client
      .rpc('commit_move', {
        p_room_id: input.roomId,
        p_game_id: input.gameId,
        p_command_key: input.commandKey,
        p_user_id: input.userId,
        p_request_digest: input.requestDigest,
        p_expected_revision: input.expectedRevision,
        p_next_state: withLastEvents(input.nextState, input.lastEvents),
        p_next_revision: input.nextRevision,
      })
      .single();
    if (error) throw new Error(`commit_move: ${error.message}`);

    const row = data as { status: string };
    switch (row.status) {
      case 'ok':
        return { ok: true };
      case 'version_conflict':
        return { ok: false, reason: 'VERSION_CONFLICT' };
      case 'duplicate_digest_mismatch':
        return { ok: false, reason: 'DUPLICATE_DIGEST_MISMATCH' };
      case 'duplicate':
      default: {
        const existing = await this.getProcessedCommand(input.roomId, input.commandKey);
        if (!existing) return { ok: false, reason: 'VERSION_CONFLICT' };
        return { ok: false, reason: 'DUPLICATE', existing };
      }
    }
  }

  async getSession(roomId: string, userId: string): Promise<SessionRecord | null> {
    const { data } = await this.client
      .from('player_sessions')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    return data ? toSession(data as SessionRow) : null;
  }

  /**
   * D21/J — odanın tüm oturumları TEK sorguda. `projectionMeta` eskiden üye
   * başına `getSession` çağırıyordu (10 kişilik odada `view` isteği başına 10
   * ardışık tur).
   */
  async listSessions(roomId: string): Promise<SessionRecord[]> {
    const { data } = await this.client
      .from('player_sessions')
      .select('*')
      .eq('room_id', roomId);
    return (data as SessionRow[] | null)?.map(toSession) ?? [];
  }

  async touchSession(roomId: string, userId: string, now: string): Promise<SessionRecord> {
    const { data, error } = await this.client
      .rpc('touch_session', { p_room_id: roomId, p_user_id: userId, p_now: now })
      .single();
    if (error) throw new Error(`touch_session: ${error.message}`);
    return toSession(data as SessionRow);
  }

  async bumpSessionGeneration(roomId: string, userId: string, now: string): Promise<number> {
    const { data, error } = await this.client
      .rpc('bump_session_generation', { p_room_id: roomId, p_user_id: userId, p_now: now })
      .single();
    if (error) throw new Error(`bump_session_generation: ${error.message}`);
    return (data as { session_generation: number }).session_generation;
  }

  async setRoomStatus(roomId: string, status: RoomStatus, now: string): Promise<void> {
    await this.client.from('rooms').update({ status, status_changed_at: now }).eq('id', roomId);
  }

  /**
   * D21/A — `public.notify_room_revision` (0002_functions.sql) doğrudan çağrılır.
   * EXECUTE yetkisi 0004_explicit_grants.sql'de service_role'e VERİLMİŞTİR;
   * **yeni migration gerekmez**. `game_states` satırına dokunulmaz: yalnız
   * `room:<roomId>` kanalına "bir şey değişti" sinyali gider (gizli alan yok).
   * Hata yutulur: sinyal bir iyileştirmedir, yedek HTTP yoklaması zaten toparlar.
   */
  async notifyRevision(roomId: string, revision: number): Promise<void> {
    const { error } = await this.client.rpc('notify_room_revision', {
      p_room_id: roomId,
      p_revision: revision,
    });
    if (error) {
      // Gizli veri içermez; alan hata ayıklaması için bilgilendirici satır.
      console.info(`[notify_room_revision] atlandı: ${error.message}`);
    }
  }
}
