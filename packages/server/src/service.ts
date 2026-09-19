/**
 * Sunucu iş mantığı: odalar, atomik hamle işleme, oyuncuya göre görünüm,
 * misafir oturum nesli ve yeniden bağlanma. Ağ/HTTP bilmez; Vercel API
 * girişleri bu sınıfı çağırır. Kalıcılık `GameGateway` arkasındadır.
 */

import type {
  CommandErrorCode,
  CommandResponse,
  DevScenarioName,
  GameCommand,
  LobbyCommand,
  LobbySnapshot,
  PlayerViewResponse,
  SceneCue,
  SceneView,
} from '@secret-table/contracts';
import {
  PROTOCOL_VERSION,
  isAvatarCharacterId,
  isAvatarSkinId,
} from '@secret-table/contracts';
import type { GameEvent } from '@secret-table/game-core';
import { applyCommand, createGame, devScenario, requiredPlayerIds } from '@secret-table/game-core';

import { mapEngineError, messageKeyForError } from './errors';
import { resolveEngineCommand } from './engine-map';
import type {
  GameGateway,
  GameStateRecord,
  MemberRecord,
  RoomRecord,
  SessionRecord,
} from './gateway';
import { eventsToCues, projectView, resolveAvatars } from './projection';
import type { ProjectionMeta } from './projection';

export type ServiceOptions = {
  now?: () => Date;
  newId?: () => string;
  newInviteCode?: () => string;
  newSeed?: () => number;
  reconnectSeconds?: number;
  maxCommitRetries?: number;
  minPlayers?: number;
  maxPlayers?: number;
};

export type ActorRef = { roomId: string; userId: string };

const DEFAULT_RECONNECT_SECONDS = 600;

/**
 * D21/J — `view`/`lobby_view` her istekte `touch_session` YAZMAZ. Bağlantı
 * penceresi `reconnectSeconds` (varsayılan 600 s) olduğu için 30 s'lik bir
 * tazelik eşiği "bağlı" göstergesini etkilemez; istemcinin 20 s'lik heartbeat'i
 * ayrı yoldan zaten yazar.
 */
const TOUCH_SESSION_MIN_MS = 30_000;

/**
 * D14 — geliştirici senaryo atlaması yalnız bu ortam değişkeni `'1'` iken açılır.
 * Vercel'de (Production/Preview) ASLA ayarlanmaz; yerelde Vite API eklentisi
 * dev sürecinin `process.env`'ine koyar. Kapalıyken `dev_scenario` komutu
 * bilinmeyen komutla aynı `NOT_ALLOWED` yanıtını alır (varlığı sızmaz).
 */
function devToolsEnabled(): boolean {
  return process.env.SECRET_TABLE_DEV_TOOLS === '1';
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}`;
}

function randomInvite(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export class GameService {
  private readonly gateway: GameGateway;
  private readonly now: () => Date;
  private readonly newId: () => string;
  private readonly newInviteCode: () => string;
  private readonly newSeed: () => number;
  private readonly reconnectSeconds: number;
  private readonly maxCommitRetries: number;
  private readonly minPlayers: number;
  private readonly maxPlayers: number;

  constructor(gateway: GameGateway, options: ServiceOptions = {}) {
    this.gateway = gateway;
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? randomId;
    this.newInviteCode = options.newInviteCode ?? randomInvite;
    this.newSeed = options.newSeed ?? (() => Math.floor(Math.random() * 0xffffffff));
    this.reconnectSeconds = options.reconnectSeconds ?? DEFAULT_RECONNECT_SECONDS;
    // Tur bazlı oyunda bir oylama aşamasında tüm masa neredeyse aynı anda oy
    // gönderebilir; her biri kendi CAS turunda yeniden doğrulanır. Bütçe masayı
    // karşılayacak kadar geniş (docs/DEPLOYMENT.md bölüm 3).
    this.maxCommitRetries = options.maxCommitRetries ?? 12;
    this.minPlayers = options.minPlayers ?? 5;
    this.maxPlayers = options.maxPlayers ?? 10;
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  // --- Oda yaşam döngüsü --------------------------------------------------

  async createRoom(input: { userId: string; displayName: string }): Promise<{
    roomId: string;
    inviteCode: string;
  }> {
    const room = await this.gateway.createRoom({
      roomId: this.newId(),
      inviteCode: this.newInviteCode(),
      hostUserId: input.userId,
      hostPlayerId: this.newId(),
      hostDisplayName: sanitizeName(input.displayName),
      reconnectSeconds: this.reconnectSeconds,
      now: this.nowIso(),
    });
    await this.gateway.touchSession(room.roomId, input.userId, this.nowIso());
    return { roomId: room.roomId, inviteCode: room.inviteCode };
  }

  async joinRoom(input: {
    inviteCode: string;
    userId: string;
    displayName: string;
  }): Promise<{ ok: true; roomId: string } | { ok: false; error: CommandErrorCode }> {
    const room = await this.gateway.getRoomByInvite(input.inviteCode.trim().toUpperCase());
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    const result = await this.gateway.joinRoom({
      roomId: room.roomId,
      userId: input.userId,
      playerId: this.newId(),
      displayName: sanitizeName(input.displayName),
      maxPlayers: this.maxPlayers,
      now: this.nowIso(),
    });
    if (!result.ok) return { ok: false, error: result.reason };

    await this.gateway.touchSession(room.roomId, input.userId, this.nowIso());
    return { ok: true, roomId: room.roomId };
  }

  async submitLobbyCommand(
    actor: ActorRef,
    command: LobbyCommand,
  ): Promise<{ ok: true } | { ok: false; error: CommandErrorCode }> {
    const room = await this.gateway.getRoom(actor.roomId);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const member = await this.gateway.getMembershipByUser(actor.roomId, actor.userId);
    if (!member) return { ok: false, error: 'SESSION_INVALID' };

    switch (command.type) {
      case 'set_ready':
        await this.gateway.setMemberReady(actor.roomId, actor.userId, command.ready);
        return { ok: true };
      case 'start_game':
        return this.startGame(actor.roomId, actor.userId);
      case 'play_again':
        return this.restartGame(actor.roomId, actor.userId);
      case 'set_avatar':
        return this.setAvatar(actor, room, command.character, command.skin);
      case 'cancel_game': {
        if (!this.isHost(room, member)) return { ok: false, error: 'NOT_ALLOWED' };
        await this.gateway.setRoomStatus(actor.roomId, 'lobby', this.nowIso());
        /**
         * D21/A — ENGELLEYİCİ düzeltmesi. `cancel_game` yalnız `rooms.status`'u
         * değiştiriyordu: `game_states` satırı dokunulmadığı için 0003'teki
         * sürüm tetikleyicisi hiç çalışmıyor, `getView` de geçerli bir oyun
         * görünümü döndürmeye devam ediyordu → host "Lobiye dön" dediğinde
         * diğer oyuncular oyun-sonu ekranında SONSUZA KADAR kalıyordu.
         *
         * İki taraflı düzeltme: (1) burada sürüm sinyali DOĞRUDAN yayınlanır
         * (durum satırına dokunmadan, mevcut `notify_room_revision` ile —
         * migration gerekmez), (2) `getView` yanıtına additive `roomStatus`
         * eklendi; sinyal kaçsa bile yedek yoklama lobiyi görür.
         *
         * Sinyalin sürüm değeri kayıtlı oyunun SON sürümüdür (uydurma sürüm
         * yazılmaz). Oyun-sonu ekranındaki istemciler gelen HER sinyalde
         * yeniden alır (bkz. `useRoomState` `onRevision`), bu yüzden eşit
         * sürüm de onları uyandırır.
         */
        const current = await this.gateway.getGameState(actor.roomId);
        if (current) await this.gateway.notifyRevision(actor.roomId, current.revision);
        return { ok: true };
      }
      case 'dev_scenario':
        // Kapalıysa bilinmeyen komutla AYNI yanıt: üretimde varlığı ayırt edilemez.
        if (!devToolsEnabled()) return { ok: false, error: 'NOT_ALLOWED' };
        // D21/K — env kapısı açık olsa bile YALNIZ host: `policy_peek_now` gibi
        // senaryolar gizli bilgiyi (deste tepesi) senaryoyu çalıştıranın eline
        // verir; oda sahibi olmayan bir oyuncu masayı kendi lehine kuramaz.
        if (!this.isHost(room, member)) return { ok: false, error: 'NOT_ALLOWED' };
        return this.runDevScenario(actor, member, command.commandId, command.scenario);
      default: {
        const _exhaustive: never = command;
        void _exhaustive;
        return { ok: false, error: 'NOT_ALLOWED' };
      }
    }
  }

  /**
   * D3.4 / B3 — lobide karakter seçimi.
   *
   * - Yalnız lobide: oda `in_game`/`ended` ise `NOT_ALLOWED` (oyun başladıktan
   *   sonra masadaki görünüm değişmez).
   * - Kimlikler sözleşme listesinden doğrulanır (şema zaten reddeder; bu ikinci
   *   savunma) — geçersizse `INVALID_OPTION`.
   * - Idempotent: aynı seçim ikinci kez yazılınca sonuç aynıdır. Oyun durumu
   *   değişmediği için `commitMove`/`revision` yolu KULLANILMAZ; lobi görünümü
   *   `set_ready` ile aynı yoldan (komut sonrası `refresh` + lobi yoklaması)
   *   yayılır.
   */
  private async setAvatar(
    actor: ActorRef,
    room: RoomRecord,
    character: string,
    skin: string,
  ): Promise<{ ok: true } | { ok: false; error: CommandErrorCode }> {
    if (room.status !== 'lobby') return { ok: false, error: 'NOT_ALLOWED' };
    if (!isAvatarCharacterId(character) || !isAvatarSkinId(skin)) {
      return { ok: false, error: 'INVALID_OPTION' };
    }
    await this.gateway.setMemberAvatar(actor.roomId, actor.userId, { character, skin });
    return { ok: true };
  }

  /**
   * D14 — durumu senaryoya ileri sarar. Normal hamleyle aynı işlemsel/idempotent
   * yolu kullanır: CAS'li `commitMove`, `revision` artışı ve sürüm sinyali. Aynı
   * `commandId` ikinci kez uygulanmaz. Çağrı noktası env kapısını geçmiş olmalı.
   */
  private async runDevScenario(
    actor: ActorRef,
    member: MemberRecord,
    commandId: string,
    scenario: DevScenarioName,
  ): Promise<{ ok: true } | { ok: false; error: CommandErrorCode }> {
    const requestDigest = `dev_scenario|${scenario}`;

    for (let attempt = 0; attempt <= this.maxCommitRetries; attempt += 1) {
      const current = await this.gateway.getGameState(actor.roomId);
      // Lobide (henüz oyun yok) senaryo atlanamaz.
      if (!current) return { ok: false, error: 'STALE_ACTION' };

      const commandKey = `${current.gameId}:${actor.userId}:dev_${commandId}`;
      const existing = await this.gateway.getProcessedCommand(actor.roomId, commandKey);
      if (existing) {
        return existing.requestDigest === requestDigest
          ? { ok: true }
          : { ok: false, error: 'NOT_ALLOWED' };
      }

      const applied = devScenario(current.state, { scenario, actorId: member.playerId });
      if (!applied.ok) return { ok: false, error: mapEngineError(applied.code).error };

      const commit = await this.gateway.commitMove({
        roomId: actor.roomId,
        gameId: current.gameId,
        commandKey,
        userId: actor.userId,
        requestDigest,
        expectedRevision: current.revision,
        nextState: applied.state,
        nextRevision: applied.state.revision,
        now: this.nowIso(),
        lastEvents: applied.events,
      });

      if (commit.ok) return { ok: true };
      if (commit.reason === 'DUPLICATE') return { ok: true };
      if (commit.reason === 'DUPLICATE_DIGEST_MISMATCH') return { ok: false, error: 'NOT_ALLOWED' };
      // VERSION_CONFLICT -> yeniden dene
    }
    return { ok: false, error: 'RETRYABLE_CONFLICT' };
  }

  private isHost(room: RoomRecord, member: MemberRecord): boolean {
    return room.hostUserId === member.userId || member.seatIndex === 0;
  }

  /**
   * `start_game` ve `play_again` ortak ön koşulu: çağıran host, aktif üye sayısı
   * aralıkta ve tüm aktif üyeler hazır. UI düğmeyi de kapatır; bu ikinci savunma
   * (docs/PLAN.md § 3, docs/QA.md § 4).
   */
  private async loadStartContext(
    roomId: string,
    userId: string,
  ): Promise<
    | { ok: true; room: RoomRecord; members: MemberRecord[] }
    | { ok: false; error: CommandErrorCode }
  > {
    const room = await this.gateway.getRoom(roomId);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const member = await this.gateway.getMembershipByUser(roomId, userId);
    if (!member || !this.isHost(room, member)) return { ok: false, error: 'NOT_ALLOWED' };

    const members = (await this.gateway.listMembers(roomId)).filter((m) => m.status === 'active');
    if (members.length < this.minPlayers || members.length > this.maxPlayers) {
      return { ok: false, error: 'NOT_ALLOWED' };
    }
    if (members.some((m) => !m.ready)) {
      return { ok: false, error: 'NOT_ALLOWED' };
    }
    return { ok: true, room, members };
  }

  private freshGameState(members: MemberRecord[]) {
    return createGame({
      players: members.map((m) => ({ playerId: m.playerId, seatIndex: m.seatIndex })),
      seed: this.newSeed(),
    });
  }

  private async startGame(
    roomId: string,
    userId: string,
  ): Promise<{ ok: true } | { ok: false; error: CommandErrorCode }> {
    const ctx = await this.loadStartContext(roomId, userId);
    if (!ctx.ok) return ctx;

    await this.gateway.startGame({
      roomId,
      gameId: this.newId(),
      state: this.freshGameState(ctx.members),
      now: this.nowIso(),
    });
    return { ok: true };
  }

  /**
   * Sonuç ekranındaki "Yeniden oyna" (QA-R01). Bitmiş oyundan (veya lobiden) yeni
   * oyuna atomik, yetkili geçiş. **Devam eden (bitmemiş) oyun asla sıfırlanamaz.**
   */
  private async restartGame(
    roomId: string,
    userId: string,
  ): Promise<{ ok: true } | { ok: false; error: CommandErrorCode }> {
    const ctx = await this.loadStartContext(roomId, userId);
    if (!ctx.ok) return ctx;

    let baseRevision = 0;
    if (ctx.room.status !== 'lobby') {
      const current = await this.gateway.getGameState(roomId);
      if (!current || current.state.phase.kind !== 'game_over') {
        // Oyun hâlâ sürüyor: yanlışlıkla sıfırlamayı reddet.
        return { ok: false, error: 'NOT_ALLOWED' };
      }
      baseRevision = current.revision;
    }

    const state = this.freshGameState(ctx.members);
    // `revision` oda ömrü boyunca monoton artar (docs/CONTRACT.md § 2): yeni oyun
    // biten oyunun sürümünden devam eder ki sürüm sinyaliyle tüm istemciler yenilesin.
    state.revision = baseRevision + 1;

    await this.gateway.restartGame({
      roomId,
      gameId: this.newId(),
      state,
      now: this.nowIso(),
    });
    return { ok: true };
  }

  // --- Görünüm ----------------------------------------------------------

  /**
   * Yetkili görünüm.
   *
   * D18/B4 — **cue dağıtımı**: istemci elindeki son sürümü `sinceRevision` ile
   * bildirirse ve kayıtlı durum TAM bir sonraki sürümdeyse
   * (`revision === sinceRevision + 1`), son komutun olayları ALICIYA GÖRE
   * süzülüp cue'ya çevrilir. Böylece hamleyi yapmayan oyuncular da infaz
   * koreografisini, kart hareketini ve oy açılışını görür.
   *
   * Atlanan sürüm geçmişi yeniden oynatılmaz: `sinceRevision` verilmemişse,
   * arada birden fazla sürüm geçmişse ya da `resync` isteniyorsa cue listesi
   * boştur (sahne görünümden türetir). `cueId` deterministiktir
   * (`gameId:revision:index`), bu yüzden hamleyi yapan oyuncu cue'ları hem
   * komut yanıtından hem görünümden alsa bile sahne bir kez oynatır.
   */
  async getView(
    actor: ActorRef,
    options: { resync?: boolean; sinceRevision?: number; sinceGameId?: string } = {},
  ): Promise<
    | { ok: true; response: PlayerViewResponse }
    | { ok: false; error: CommandErrorCode }
  > {
    const context = await this.loadContext(actor);
    if (!context.ok) return context;
    const { member, members, stateRecord, room } = context;

    /**
     * D21/J — oturumlar TEK turda okunur ve `touchSession` yalnız gerçekten
     * bayatlamışsa yazılır. Eskiden her `view` isteği üye başına bir
     * `getSession` + her seferinde bir `touch_session` yazımı yapıyordu; 3 s
     * yedek yoklamayla 10 kişilik oda dakikada binlerce sorgu üretiyordu.
     */
    const sessions = await this.gateway.listSessions(actor.roomId);
    const own = sessions.find((s) => s.userId === actor.userId);
    const nowMs = this.now().getTime();
    const lastSeen = own ? Date.parse(own.lastSeenAt) : 0;
    if (!own || !(nowMs - lastSeen < TOUCH_SESSION_MIN_MS)) {
      const touched = await this.gateway.touchSession(actor.roomId, actor.userId, this.nowIso());
      const index = sessions.findIndex((s) => s.userId === actor.userId);
      if (index >= 0) sessions[index] = touched;
      else sessions.push(touched);
    }

    const meta = await this.projectionMeta(actor.roomId, room.gameId ?? stateRecord.gameId, {
      members,
      sessions,
      stateRecord,
    });
    const displayNames = context.displayNames;
    const resync = options.resync ?? false;

    return {
      ok: true,
      response: {
        view: projectView(stateRecord.state, member.playerId, meta, displayNames),
        cues: resync
          ? []
          : this.cuesSince(
              stateRecord,
              member.playerId,
              options.sinceRevision,
              options.sinceGameId,
            ),
        resync,
        // D21/A — additive: istemci oyun-sonu ekranından lobiye dönmeyi buradan
        // anlar (oyun durumu satırı silinmediği için görünüm hâlâ geçerlidir).
        roomStatus: room.status,
      },
    };
  }

  /**
   * D18/B4 + **D21/C** — istemcinin elindeki sürümden İLERİDE her durumda son
   * komutun cue'ları döner.
   *
   * Eski koşul `revision === sinceRevision + 1` idi ve tam bir sürüm gerideki
   * istemci dışında kimseye cue gitmiyordu: iki hamle arası yoklama yarışında
   * ya da hızlı iki hamlede kart/infaz koreografisi hiç oynamıyordu. Sahne
   * yalnız GÜNCEL sürümün cue'larını oynattığı ve yalnız son komutun olayları
   * saklandığı için ileri sürümde cue vermek geçmişi yeniden oynatmaz.
   *
   * `resync`'te yine boş döner (çağıran atlar). `sinceGameId` verilirse oyun
   * kimliği eşleşmelidir: "Yeniden oyna" sonrası sürüm sayacı devam ettiği için
   * eski oyunun sürümü yeni oyunun cue'larını açmasın.
   */
  private cuesSince(
    stateRecord: { gameId: string; revision: number; lastEvents: readonly GameEvent[] | null },
    playerId: string,
    sinceRevision: number | undefined,
    sinceGameId?: string,
  ): readonly SceneCue[] {
    if (sinceRevision === undefined) return [];
    if (sinceGameId !== undefined && sinceGameId !== stateRecord.gameId) return [];
    if (!stateRecord.lastEvents || stateRecord.lastEvents.length === 0) return [];
    if (!(sinceRevision < stateRecord.revision)) return [];
    return eventsToCues(
      stateRecord.lastEvents,
      playerId,
      stateRecord.gameId,
      stateRecord.revision,
    );
  }

  // --- Lobi görünümü --------------------------------------------------

  /**
   * Lobi anlık görünümü. Oyun durumu gerekmez; `getView` oyun başlamadan
   * `STALE_ACTION` verdiği için lobi ekranı bunu kullanır. Gizli veri yok.
   */
  async getLobby(
    actor: ActorRef,
  ): Promise<{ ok: true; snapshot: LobbySnapshot } | { ok: false; error: CommandErrorCode }> {
    const room = await this.gateway.getRoom(actor.roomId);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    const allMembers = await this.gateway.listMembers(actor.roomId);
    const self = allMembers.find((m) => m.userId === actor.userId);
    if (!self) return { ok: false, error: 'SESSION_INVALID' };

    // D21/J — oturumlar tek turda; `touch_session` yalnız bayatladıysa yazılır.
    const sessions = await this.gateway.listSessions(actor.roomId);
    const own = sessions.find((s) => s.userId === actor.userId);
    const lastSeen = own ? Date.parse(own.lastSeenAt) : 0;
    if (!own || !(this.now().getTime() - lastSeen < TOUCH_SESSION_MIN_MS)) {
      const touched = await this.gateway.touchSession(actor.roomId, actor.userId, this.nowIso());
      const index = sessions.findIndex((s) => s.userId === actor.userId);
      if (index >= 0) sessions[index] = touched;
      else sessions.push(touched);
    }

    const members = allMembers.filter((m) => m.status === 'active');
    const connected = this.connectedMap(members.map((m) => m.userId), sessions);
    const avatars = resolveAvatars(members);

    const isHost = (m: MemberRecord): boolean =>
      room.hostUserId === m.userId || m.seatIndex === 0;

    const lobbyMembers = members.map((m) => ({
      playerId: m.playerId,
      seatIndex: m.seatIndex,
      displayName: m.displayName,
      connected: connected[m.userId] ?? false,
      ready: m.ready,
      isHost: isHost(m),
      isLocal: m.userId === actor.userId,
      // D3.4: seçim yoksa koltuk varsayılanı (alan her zaman dolu).
      avatar: avatars[m.playerId]!,
    }));

    const countOk = members.length >= this.minPlayers && members.length <= this.maxPlayers;
    const allReady = members.every((m) => m.ready);

    return {
      ok: true,
      snapshot: {
        roomId: actor.roomId,
        inviteCode: room.inviteCode,
        status: room.status,
        localPlayerId: self.playerId,
        isHost: isHost(self),
        members: lobbyMembers,
        minPlayers: this.minPlayers,
        maxPlayers: this.maxPlayers,
        canStart: isHost(self) && countOk && allReady,
      },
    };
  }

  /** D21/J — oturumlar tek turda; üye başına `getSession` döngüsü kaldırıldı. */
  private connectedMap(
    userIds: readonly string[],
    sessions: readonly SessionRecord[],
  ): Record<string, boolean> {
    const nowMs = this.now().getTime();
    const windowMs = this.reconnectSeconds * 1000;
    const lastSeenByUserId = lastSeenMap(sessions);
    const out: Record<string, boolean> = {};
    for (const userId of userIds) {
      const lastSeen = lastSeenByUserId.get(userId);
      out[userId] = lastSeen !== undefined && nowMs - lastSeen < windowMs;
    }
    return out;
  }

  // --- Hamle ----------------------------------------------------------

  async submitCommand(actor: ActorRef, command: GameCommand): Promise<CommandResponse> {
    if (command.protocolVersion !== PROTOCOL_VERSION) {
      return fail(command.commandId, 'VERSION_MISMATCH', false);
    }

    const context = await this.loadContext(actor);
    if (!context.ok) return fail(command.commandId, context.error, false);
    const { member, room, stateRecord } = context;

    if (command.gameId !== stateRecord.gameId) {
      return fail(command.commandId, 'STALE_ACTION', false);
    }

    const commandKey = `${stateRecord.gameId}:${actor.userId}:${command.commandId}`;
    const requestDigest = `${command.actionId}|${command.optionId ?? ''}|${command.phaseId}`;

    const existing = await this.gateway.getProcessedCommand(actor.roomId, commandKey);
    if (existing) {
      if (existing.requestDigest !== requestDigest) {
        return fail(command.commandId, 'NOT_ALLOWED', false);
      }
      return this.successFromCurrent(actor, member, room, command.commandId);
    }

    for (let attempt = 0; attempt <= this.maxCommitRetries; attempt += 1) {
      const current = await this.gateway.getGameState(actor.roomId);
      if (!current) return fail(command.commandId, 'ROOM_NOT_FOUND', false);

      const resolved = resolveEngineCommand(
        current.state,
        member.playerId,
        current.gameId,
        command.phaseId,
        command.actionId,
        command.optionId,
      );
      if (!resolved.ok) {
        return fail(command.commandId, resolved.error, false);
      }

      const applied = applyCommand(current.state, resolved.command);
      if (!applied.ok) {
        const mapped = mapEngineError(applied.code);
        return {
          ok: false,
          commandId: command.commandId,
          error: mapped.error,
          retryable: mapped.retryable,
          messageKey: mapped.messageKey,
        };
      }

      const commit = await this.gateway.commitMove({
        roomId: actor.roomId,
        gameId: current.gameId,
        commandKey,
        userId: actor.userId,
        requestDigest,
        expectedRevision: current.revision,
        nextState: applied.state,
        nextRevision: applied.state.revision,
        now: this.nowIso(),
        // D18/B4 — cue dağıtımı: diğer oyuncular `getView(sinceRevision)` ile
        // bu olayları alıcıya süzülmüş cue olarak alır.
        lastEvents: applied.events,
      });

      if (commit.ok) {
        const meta = await this.projectionMeta(actor.roomId, current.gameId);
        const view = projectView(applied.state, member.playerId, meta, context.displayNames);
        return {
          ok: true,
          commandId: command.commandId,
          revision: applied.state.revision,
          view,
          cues: eventsToCues(
            applied.events,
            member.playerId,
            current.gameId,
            applied.state.revision,
          ),
        };
      }
      if (commit.reason === 'DUPLICATE') {
        return this.successFromCurrent(actor, member, room, command.commandId);
      }
      if (commit.reason === 'DUPLICATE_DIGEST_MISMATCH') {
        return fail(command.commandId, 'NOT_ALLOWED', false);
      }
      // VERSION_CONFLICT -> yeniden dene
    }

    return fail(command.commandId, 'RETRYABLE_CONFLICT', true);
  }

  private async successFromCurrent(
    actor: ActorRef,
    member: MemberRecord,
    room: RoomRecord,
    commandId: string,
  ): Promise<CommandResponse> {
    const current = await this.gateway.getGameState(actor.roomId);
    if (!current) return fail(commandId, 'ROOM_NOT_FOUND', false);
    const meta = await this.projectionMeta(actor.roomId, current.gameId);
    const displayNames = await this.displayNamesFor(actor.roomId);
    void room;
    return {
      ok: true,
      commandId,
      revision: current.revision,
      view: projectView(current.state, member.playerId, meta, displayNames),
      cues: [],
    };
  }

  // --- Oturum / yeniden bağlanma --------------------------------------

  async heartbeat(actor: ActorRef): Promise<{ ok: true; sessionGeneration: number }> {
    const session = await this.gateway.touchSession(actor.roomId, actor.userId, this.nowIso());
    return { ok: true, sessionGeneration: session.sessionGeneration };
  }

  /** Yeni sekme kumandayı devralır; eski sekme sonraki hamlede geçersizleşir. */
  async claimControl(actor: ActorRef): Promise<{ sessionGeneration: number }> {
    const generation = await this.gateway.bumpSessionGeneration(
      actor.roomId,
      actor.userId,
      this.nowIso(),
    );
    return { sessionGeneration: generation };
  }

  // --- Yardımcılar ----------------------------------------------------

  /**
   * D21/J — üye listesi TEK kez okunur ve hem `member`, hem `displayNames`,
   * hem projeksiyon meta'sı ondan türer (eskiden `getMembershipByUser` +
   * `listMembers` ayrı turlardı).
   */
  private async loadContext(actor: ActorRef): Promise<
    | {
        ok: true;
        room: RoomRecord;
        member: MemberRecord;
        members: MemberRecord[];
        stateRecord: NonNullable<Awaited<ReturnType<GameGateway['getGameState']>>>;
        displayNames: Record<string, string>;
      }
    | { ok: false; error: CommandErrorCode }
  > {
    const room = await this.gateway.getRoom(actor.roomId);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    const members = await this.gateway.listMembers(actor.roomId);
    const member = members.find((m) => m.userId === actor.userId);
    if (!member) return { ok: false, error: 'SESSION_INVALID' };

    const stateRecord = await this.gateway.getGameState(actor.roomId);
    if (!stateRecord) return { ok: false, error: 'STALE_ACTION' };

    return {
      ok: true,
      room,
      member,
      members,
      stateRecord,
      displayNames: displayNamesOf(members),
    };
  }

  private async displayNamesFor(roomId: string): Promise<Record<string, string>> {
    return displayNamesOf(await this.gateway.listMembers(roomId));
  }

  /**
   * Projeksiyon meta'sı. D21/J — çağıran zaten okuduysa üyeler, oturumlar ve
   * durum satırı `preload` ile geçilir; hiç sorgu yapılmaz. Aksi hâlde her biri
   * TEK turda alınır (üye başına `getSession` döngüsü kaldırıldı).
   */
  private async projectionMeta(
    roomId: string,
    gameId: string,
    preload: {
      members?: readonly MemberRecord[];
      sessions?: readonly SessionRecord[];
      stateRecord?: GameStateRecord | null;
    } = {},
  ): Promise<ProjectionMeta> {
    const members = preload.members ?? (await this.gateway.listMembers(roomId));
    const sessions = preload.sessions ?? (await this.gateway.listSessions(roomId));
    const stateRecord =
      preload.stateRecord !== undefined
        ? preload.stateRecord
        : await this.gateway.getGameState(roomId);

    const connectedByPlayerId: Record<string, boolean> = {};
    const lastSeenByUserId = lastSeenMap(sessions);
    const nowMs = this.now().getTime();
    const windowMs = this.reconnectSeconds * 1000;
    for (const member of members) {
      const lastSeen = lastSeenByUserId.get(member.userId);
      connectedByPlayerId[member.playerId] =
        lastSeen !== undefined && nowMs - lastSeen < windowMs;
    }

    let paused: ProjectionMeta['paused'] = null;
    if (stateRecord) {
      const required = requiredPlayerIds(stateRecord.state);
      const offline = required.filter((pid) => connectedByPlayerId[pid] === false);
      if (offline.length > 0) {
        paused = { reason: 'player_offline', waitingForPlayerIds: offline };
      }
    }

    return {
      roomId,
      gameId,
      connectedByPlayerId,
      localConnection: 'connected',
      paused,
      avatarByPlayerId: resolveAvatars(members),
    };
  }
}

function displayNamesOf(members: readonly MemberRecord[]): Record<string, string> {
  return Object.fromEntries(members.map((m) => [m.playerId, m.displayName]));
}

/** userId → `last_seen_at` (ms). Ayrıştırılamayan damga yok sayılır. */
function lastSeenMap(sessions: readonly SessionRecord[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const session of sessions) {
    const at = Date.parse(session.lastSeenAt);
    if (!Number.isNaN(at)) out.set(session.userId, at);
  }
  return out;
}

function sanitizeName(raw: string): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return (trimmed.length > 0 ? trimmed : 'Oyuncu').slice(0, 40);
}

function fail(
  commandId: string,
  error: CommandErrorCode,
  retryable: boolean,
): Extract<CommandResponse, { ok: false }> {
  return { ok: false, commandId, error, retryable, messageKey: messageKeyForError[error] };
}

export type { SceneView };
