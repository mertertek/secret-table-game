/**
 * Kalıcı katman soyutlaması. Sunucu mantığı yalnız bu arayüze bağlıdır;
 * `InMemoryGateway` testler ve Supabase erişimsiz yerel çalışma için, ileride
 * `SupabaseGateway` gerçek Postgres/RPC için uygular.
 *
 * `commitMove` docs/DEPLOYMENT.md bölüm 3'teki atomik hamle kaydıdır: tek
 * işlemde tekrar-komut kontrolü + sürüm kontrolü + durum yazımı + sürüm sinyali.
 */

import type { AvatarSelection } from '@secret-table/contracts';
import type { GameEvent, GameState } from '@secret-table/game-core';

export type RoomStatus = 'lobby' | 'in_game' | 'ended';

export type RoomRecord = {
  roomId: string;
  inviteCode: string;
  status: RoomStatus;
  hostUserId: string;
  reconnectSeconds: number;
  createdAt: string;
  /** Oyun başladıysa geçerli oyun kimliği. */
  gameId: string | null;
};

export type MemberRecord = {
  roomId: string;
  userId: string;
  /** Motora verilen sabit, opak oyuncu kimliği (auth kimliğinden ayrı). */
  playerId: string;
  seatIndex: number;
  displayName: string;
  status: 'active' | 'left';
  /** Lobide hazır olma durumu. */
  ready: boolean;
  /**
   * D3.4 — oyuncunun seçtiği karakter + ten. `null` = seçim yapılmadı (ya da
   * 0008 migration'ı henüz uygulanmadı): projeksiyon koltuk varsayılanını verir.
   */
  avatar: AvatarSelection | null;
};

export type GameStateRecord = {
  roomId: string;
  gameId: string;
  revision: number;
  /** Geriye uyumlu migration için durum şeması sürümü. */
  stateVersion: number;
  state: GameState;
  updatedAt: string;
  /**
   * D18/B4 — **son uygulanan komutun** motor olayları (`revision` bu satırdaki
   * sürümdür). Cue dağıtımı için saklanır: hamleyi yapmayan oyuncular
   * `getView(sinceRevision)` ile TAM bir sonraki sürümü istediğinde sunucu bu
   * olayları alıcıya göre süzüp cue'ya çevirir (`eventsToCues`).
   *
   * `null` = bilinmiyor (yeni oyun, `start_game`/`restartGame`, ya da bu alanı
   * bilmeyen eski satır) → cue döndürülmez, sahne durumdan türetir.
   */
  lastEvents: readonly GameEvent[] | null;
};

export type ProcessedCommandRecord = {
  roomId: string;
  gameId: string;
  /** `${gameId}:${userId}:${commandId}` — benzersizlik anahtarı. */
  commandKey: string;
  userId: string;
  /** İsteğin içerik özeti; aynı anahtarla farklı içerik reddedilir. */
  requestDigest: string;
  resultRevision: number;
  createdAt: string;
};

export type SessionRecord = {
  roomId: string;
  userId: string;
  /** Etkin oturum nesli; yeni sekme artırır, eski sekme kumanda yetkisini kaybeder. */
  sessionGeneration: number;
  lastSeenAt: string;
};

export type CreateRoomInput = {
  roomId: string;
  inviteCode: string;
  hostUserId: string;
  hostPlayerId: string;
  hostDisplayName: string;
  reconnectSeconds: number;
  now: string;
};

export type JoinRoomInput = {
  roomId: string;
  userId: string;
  playerId: string;
  displayName: string;
  maxPlayers: number;
  now: string;
};

export type JoinRoomResult =
  | { ok: true; member: MemberRecord }
  | { ok: false; reason: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'GAME_ALREADY_STARTED' };

export type StartGameInput = {
  roomId: string;
  gameId: string;
  state: GameState;
  now: string;
};

export type CommitMoveInput = {
  roomId: string;
  gameId: string;
  commandKey: string;
  userId: string;
  requestDigest: string;
  expectedRevision: number;
  nextState: GameState;
  nextRevision: number;
  now: string;
  /**
   * D18/B4 — bu komutun ürettiği motor olayları. Durum satırıyla AYNI yazımda
   * saklanır; böylece `revision` ile olaylar asla birbirinden ayrı düşmez.
   * Verilmezse `null` yazılır (cue dağıtımı yapılmaz).
   */
  lastEvents?: readonly GameEvent[] | null;
};

export type CommitMoveResult =
  | { ok: true }
  | { ok: false; reason: 'VERSION_CONFLICT' }
  | { ok: false; reason: 'DUPLICATE'; existing: ProcessedCommandRecord }
  | { ok: false; reason: 'DUPLICATE_DIGEST_MISMATCH' };

export interface GameGateway {
  getRoom(roomId: string): Promise<RoomRecord | null>;
  getRoomByInvite(inviteCode: string): Promise<RoomRecord | null>;
  createRoom(input: CreateRoomInput): Promise<RoomRecord>;
  joinRoom(input: JoinRoomInput): Promise<JoinRoomResult>;

  listMembers(roomId: string): Promise<MemberRecord[]>;
  getMembershipByUser(roomId: string, userId: string): Promise<MemberRecord | null>;
  setMemberReady(roomId: string, userId: string, ready: boolean): Promise<void>;
  /** D3.4 — lobide karakter seçimi. Aynı değerle tekrar çağrılabilir (idempotent). */
  setMemberAvatar(roomId: string, userId: string, avatar: AvatarSelection): Promise<void>;

  startGame(input: StartGameInput): Promise<void>;
  /**
   * Bitmiş bir oyundan (veya lobiden) yeni oyuna atomik geçiş (QA-R01).
   * Devam eden bir oyun asla sıfırlanmaz: oda `in_game` ise yalnız kayıtlı durum
   * `phase.kind === 'game_over'` iken geçiş yapılır, aksi halde hata fırlatır.
   */
  restartGame(input: StartGameInput): Promise<void>;
  getGameState(roomId: string): Promise<GameStateRecord | null>;

  getProcessedCommand(roomId: string, commandKey: string): Promise<ProcessedCommandRecord | null>;
  /** Atomik: tekrar kontrolü + sürüm kontrolü + durum yazımı + sürüm sinyali. */
  commitMove(input: CommitMoveInput): Promise<CommitMoveResult>;

  getSession(roomId: string, userId: string): Promise<SessionRecord | null>;
  /**
   * D21/J — odanın TÜM oturumları tek turda. Eskiden `projectionMeta` her
   * `view` isteğinde üye başına ayrı `getSession` çağırıyordu: 10 kişilik odada
   * istek başına 10 ardışık Supabase turu, 3 s'lik yedek yoklamayla oda başına
   * binlerce sorgu/dk. Bağlantı durumu kamu bilgisidir, oda kapsamında okunur.
   */
  listSessions(roomId: string): Promise<SessionRecord[]>;
  touchSession(roomId: string, userId: string, now: string): Promise<SessionRecord>;
  /** Yeni sekme kumandayı devralır: nesil numarasını artırır ve döndürür. */
  bumpSessionGeneration(roomId: string, userId: string, now: string): Promise<number>;

  setRoomStatus(roomId: string, status: RoomStatus, now: string): Promise<void>;

  /**
   * D21/A — oda sürüm sinyalini DOĞRUDAN yayınlar (oyun durumu satırına
   * dokunmadan). `cancel_game` yalnız `rooms.status`'u değiştirdiği için
   * `game_states` tetikleyicisi (0003_realtime.sql) tetiklenmiyordu ve host
   * "Lobiye dön" dediğinde diğer istemciler oyun-sonu ekranında kalıyordu.
   * Realtime'ı olmayan uyarlamalar (bellek kipi) bunu boş geçer.
   */
  notifyRevision(roomId: string, revision: number): Promise<void>;
}
