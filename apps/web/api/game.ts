/**
 * POST /api/game — oyun HTTP API'sinin tek girişi.
 *
 * Gövde: `{ action, ...alanlar }`. Kimlik `Authorization: Bearer <token>`
 * başlığından doğrulanır; istek içindeki `userId/playerId` yetki kaynağı değildir.
 * Yanıtlar `Cache-Control: private, no-store` (oyuncuya özel, önbelleğe alınmaz).
 *
 * REST yol biçimi (`/api/rooms/:id/...`) C04/C05'te rewrite ile eklenebilir;
 * C03'te tek eylem-tabanlı uç hem yerel köprüde hem Vercel'de sorunsuz çalışır.
 */

import {
  gameCommandSchema,
  lobbyCommandSchema,
  playerViewRequestSchema,
} from '@secret-table/contracts/schemas';

import type { ApiHandler, ApiRequest, ApiResponse } from './_lib/types.js';
import { resolveContext } from './_lib/context.js';

type Body = Record<string, unknown>;

function readBody(req: ApiRequest): Body {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as Body;
  }
  return {};
}

function send(res: ApiResponse, status: number, payload: unknown): void {
  res.setHeader('cache-control', 'private, no-store');
  res.status(status).json(payload);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const handler: ApiHandler = async (req, res) => {
  if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
    send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const body = readBody(req);
  const action = str(body.action);
  if (!action) {
    send(res, 400, { error: 'MISSING_ACTION' });
    return;
  }

  const resolved = await resolveContext(req);
  if (resolved.ok === false) {
    send(res, resolved.status, { error: resolved.error });
    return;
  }
  const { service, userId, mode } = resolved.context;

  try {
    switch (action) {
      case 'create_room': {
        const displayName = str(body.displayName) ?? 'Oyuncu';
        const result = await service.createRoom({ userId, displayName });
        send(res, 200, { ...result, mode });
        return;
      }

      case 'join_room': {
        const inviteCode = str(body.inviteCode);
        const displayName = str(body.displayName) ?? 'Oyuncu';
        if (!inviteCode) {
          send(res, 400, { error: 'MISSING_INVITE_CODE' });
          return;
        }
        const result = await service.joinRoom({ inviteCode, userId, displayName });
        if (!result.ok) {
          send(res, result.error === 'ROOM_NOT_FOUND' ? 404 : 409, { error: result.error });
          return;
        }
        send(res, 200, { roomId: result.roomId });
        return;
      }

      case 'lobby_view': {
        const roomId = str(body.roomId);
        if (!roomId) {
          send(res, 400, { error: 'MISSING_ROOM_ID' });
          return;
        }
        const result = await service.getLobby({ roomId, userId });
        if (!result.ok) {
          send(res, result.error === 'ROOM_NOT_FOUND' ? 404 : 409, { error: result.error });
          return;
        }
        send(res, 200, { ...result.snapshot, mode });
        return;
      }

      case 'view': {
        const roomId = str(body.roomId);
        if (!roomId) {
          send(res, 400, { error: 'MISSING_ROOM_ID' });
          return;
        }
        // D18/D21 — additive `sinceRevision` + `sinceGameId`. Şema reddederse
        // istek bozuktur.
        const parsedView = playerViewRequestSchema.safeParse({ ...body, roomId });
        if (!parsedView.success) {
          send(res, 400, { error: 'INVALID_REQUEST' });
          return;
        }
        const result = await service.getView(
          { roomId, userId },
          {
            resync: parsedView.data.resync === true,
            sinceRevision: parsedView.data.sinceRevision,
            sinceGameId: parsedView.data.sinceGameId,
          },
        );
        if (!result.ok) {
          send(res, result.error === 'ROOM_NOT_FOUND' ? 404 : 409, { error: result.error });
          return;
        }
        send(res, 200, result.response);
        return;
      }

      case 'command': {
        const roomId = str(body.roomId);
        if (!roomId) {
          send(res, 400, { error: 'MISSING_ROOM_ID' });
          return;
        }
        const parsed = gameCommandSchema.safeParse(body.command);
        if (!parsed.success) {
          send(res, 400, { error: 'INVALID_COMMAND' });
          return;
        }
        const response = await service.submitCommand({ roomId, userId }, parsed.data);
        send(res, 200, response);
        return;
      }

      case 'lobby': {
        const roomId = str(body.roomId);
        if (!roomId) {
          send(res, 400, { error: 'MISSING_ROOM_ID' });
          return;
        }
        const parsed = lobbyCommandSchema.safeParse(body.command);
        if (!parsed.success) {
          send(res, 400, { error: 'INVALID_COMMAND' });
          return;
        }
        const result = await service.submitLobbyCommand({ roomId, userId }, parsed.data);
        send(res, result.ok ? 200 : 409, result);
        return;
      }

      case 'heartbeat': {
        const roomId = str(body.roomId);
        if (!roomId) {
          send(res, 400, { error: 'MISSING_ROOM_ID' });
          return;
        }
        const result = await service.heartbeat({ roomId, userId });
        send(res, 200, result);
        return;
      }

      case 'claim_control': {
        const roomId = str(body.roomId);
        if (!roomId) {
          send(res, 400, { error: 'MISSING_ROOM_ID' });
          return;
        }
        const result = await service.claimControl({ roomId, userId });
        send(res, 200, result);
        return;
      }

      default:
        send(res, 400, { error: 'UNKNOWN_ACTION' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Gizli durum dökümü yok; yalnız kısa kod.
    send(res, 500, { error: 'SERVICE_UNAVAILABLE', detail: mode === 'memory' ? message : undefined });
  }
};

export default handler;
