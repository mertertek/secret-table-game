/**
 * Çalışma anı giriş doğrulama şemaları.
 *
 * Paket tercihi (docs/PLAN.md bölüm 4): **zod**. Ağdan gelen mesajlar Vercel
 * Functions sınırında bu şemalarla doğrulanır; tipler `@secret-table/contracts`
 * ana girişinden gelir ve bu şemalar onlara uyar (`satisfies` testi ile kontrol edilir).
 *
 * Kapsam: istemci -> sunucu mesaj gövdeleri. Sunucu -> istemci görünümü (SceneView)
 * sunucu tarafından üretildiği için ayrıca şemalanmaz; C03 gerekirse ekler.
 */

import { z } from 'zod';

import { AVATAR_CHARACTER_IDS, AVATAR_SKIN_IDS, PROTOCOL_VERSION } from './index';
import { DEV_SCENARIO_NAMES } from './commands';
import type {
  CreateRoomRequest,
  GameCommand,
  JoinRoomRequest,
  LobbyCommand,
  PlayerViewRequest,
} from './commands';

const protocolVersionSchema = z.literal(PROTOCOL_VERSION);
const idSchema = z.string().min(1).max(200);
const displayNameSchema = z.string().trim().min(1).max(40);

/**
 * D18/B2 → **D21/I**: `ACTIONS_REQUIRING_OPTION` listesi ve şema `refine`'ı
 * KALDIRILDI. Kural artık tek yerde, sunucuda yaşıyor: `server/engine-map.ts`
 * seçenek sayısını PROJEKSİYONDAN okur ve seçenekli bir eylemde `optionId`
 * yoksa `INVALID_OPTION` döndürür (tek seçenekli inceleme/infazda da açık
 * seçim istenir; `act_ack_*` ve `policy_peek` gibi seçeneksiz eylemler
 * etkilenmez). Sabit bir eylem kimliği listesi projeksiyonla kolayca
 * uyumsuzlaşıyordu; şema yalnız biçimi doğrular.
 */
export const gameCommandSchema = z.object({
  protocolVersion: protocolVersionSchema,
  gameId: idSchema,
  phaseId: idSchema,
  commandId: idSchema,
  actionId: idSchema,
  optionId: idSchema.optional(),
});

/** D18/D21 — `view` isteği. `sinceRevision`/`sinceGameId` additive; eski istemci göndermez. */
export const playerViewRequestSchema = z.object({
  roomId: idSchema,
  resync: z.boolean().optional(),
  sinceRevision: z.number().int().min(0).optional(),
  /** D21/C — elimizdeki görünümün oyun kimliği (additive). */
  sinceGameId: idSchema.optional(),
});

export const lobbyCommandSchema = z.discriminatedUnion('type', [
  z.object({
    protocolVersion: protocolVersionSchema,
    commandId: idSchema,
    type: z.literal('set_ready'),
    ready: z.boolean(),
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    commandId: idSchema,
    type: z.literal('start_game'),
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    commandId: idSchema,
    type: z.literal('cancel_game'),
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    commandId: idSchema,
    type: z.literal('play_again'),
  }),
  // D3.4 — karakter seçimi. Bilinmeyen kimlik ŞEMADA reddedilir (sunucu ayrıca
  // aşamayı doğrular: oyun başladıysa `NOT_ALLOWED`).
  z.object({
    protocolVersion: protocolVersionSchema,
    commandId: idSchema,
    type: z.literal('set_avatar'),
    character: z.enum(AVATAR_CHARACTER_IDS),
    skin: z.enum(AVATAR_SKIN_IDS),
  }),
  // D14 — yalnız geliştirme. Şema kabul eder, SUNUCU `SECRET_TABLE_DEV_TOOLS=1`
  // değilse `NOT_ALLOWED` ile reddeder (üretimde ayırt edilemez).
  z.object({
    protocolVersion: protocolVersionSchema,
    commandId: idSchema,
    type: z.literal('dev_scenario'),
    scenario: z.enum(DEV_SCENARIO_NAMES),
  }),
]);

export const createRoomRequestSchema = z.object({
  protocolVersion: protocolVersionSchema,
  displayName: displayNameSchema,
});

export const joinRoomRequestSchema = z.object({
  protocolVersion: protocolVersionSchema,
  inviteCode: z.string().trim().min(1).max(64),
  displayName: displayNameSchema,
});

// Şema çıktıları sözleşme tiplerine uymalı (kayması derlemede yakalanır).
type _AssertGameCommand = z.infer<typeof gameCommandSchema> extends GameCommand ? true : never;
type _AssertLobbyCommand = z.infer<typeof lobbyCommandSchema> extends LobbyCommand ? true : never;
type _AssertCreateRoom = z.infer<typeof createRoomRequestSchema> extends CreateRoomRequest ? true : never;
type _AssertJoinRoom = z.infer<typeof joinRoomRequestSchema> extends JoinRoomRequest ? true : never;
type _AssertPlayerView = z.infer<typeof playerViewRequestSchema> extends PlayerViewRequest
  ? true
  : never;
const _assertions: [
  _AssertGameCommand,
  _AssertLobbyCommand,
  _AssertCreateRoom,
  _AssertJoinRoom,
  _AssertPlayerView,
] = [true, true, true, true, true];
void _assertions;

/** Geçersizse `ZodError` fırlatır. */
export function parseGameCommand(input: unknown): GameCommand {
  return gameCommandSchema.parse(input);
}

/** Fırlatmaz; `{ success, data | error }` döndürür. */
export function safeParseGameCommand(input: unknown) {
  return gameCommandSchema.safeParse(input);
}
