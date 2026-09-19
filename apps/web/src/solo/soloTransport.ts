/**
 * D26 — `POST /api/game`'in YEREL karşılığı.
 *
 * Aynı `action` + `payload` sözleşmesi, aynı `ApiResult<T>` şekli, aynı durum
 * kodları; tek fark ağ yok. `apps/web/api/game.ts` bire bir örnek alınmıştır
 * (ve DEĞİŞMEMİŞTİR): iki yol ayrışırsa solo kip gerçek oyundan farklı davranır.
 *
 * Kimlik: `Authorization: Bearer solo:<userId>` yerine doğrudan token dizgesi.
 * Supabase doğrulaması yoktur çünkü hiçbir şey paylaşılmaz — bütün durum bu
 * sekmenin belleğindedir.
 *
 * Şema doğrulaması (zod) burada YOKTUR: komutları üreten de tüketen de aynı
 * sekmedeki kendi kodumuzdur, dışarıdan gövde gelmez. Kural doğrulaması yine
 * motorun kendisindedir.
 */

import type { GameCommand, LobbyCommand } from '@secret-table/contracts';

import type { ApiResult } from '../multiplayer/apiClient';
import { getSoloService } from './soloService';

/** Solo token → userId. Biçim tutmazsa gerçek API ile aynı 401. */
export function soloUserId(accessToken: string): string | null {
  if (!accessToken.startsWith('solo:')) return null;
  const id = accessToken.slice(5).trim();
  return id.length > 0 ? id : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function ok<T>(data: unknown): ApiResult<T> {
  return { ok: true, data: data as T };
}

function err<T>(status: number, error: string): ApiResult<T> {
  return { ok: false, status, error };
}

/** Oda bulunamadıysa 404, aksi hâlde 409 (api/game.ts ile aynı eşleme). */
function notFoundOrConflict<T>(error: string): ApiResult<T> {
  return err<T>(error === 'ROOM_NOT_FOUND' ? 404 : 409, error);
}

/**
 * `apiClient.callGame` ile aynı imza. `setSoloTransport(soloCall)` denince
 * bütün `apiClient` yüzeyi (createRoom / joinRoom / fetchView / sendCommand …)
 * değişmeden bu yola düşer.
 */
export async function soloCall<T>(
  action: string,
  payload: Record<string, unknown>,
  accessToken: string,
): Promise<ApiResult<T>> {
  if (!accessToken) return err<T>(401, 'MISSING_TOKEN');
  const userId = soloUserId(accessToken);
  if (!userId) return err<T>(401, 'SESSION_INVALID');

  const service = await getSoloService();
  const roomId = str(payload.roomId);

  try {
    switch (action) {
      case 'create_room': {
        const displayName = str(payload.displayName) ?? 'Oyuncu';
        const result = await service.createRoom({ userId, displayName });
        return ok<T>({ ...result, mode: 'memory' });
      }

      case 'join_room': {
        const inviteCode = str(payload.inviteCode);
        const displayName = str(payload.displayName) ?? 'Oyuncu';
        if (!inviteCode) return err<T>(400, 'MISSING_INVITE_CODE');
        const result = await service.joinRoom({ inviteCode, userId, displayName });
        if (!result.ok) return notFoundOrConflict<T>(result.error);
        return ok<T>({ roomId: result.roomId });
      }

      case 'lobby_view': {
        if (!roomId) return err<T>(400, 'MISSING_ROOM_ID');
        const result = await service.getLobby({ roomId, userId });
        if (!result.ok) return notFoundOrConflict<T>(result.error);
        return ok<T>({ ...result.snapshot, mode: 'memory' });
      }

      case 'view': {
        if (!roomId) return err<T>(400, 'MISSING_ROOM_ID');
        const result = await service.getView(
          { roomId, userId },
          {
            resync: payload.resync === true,
            sinceRevision: num(payload.sinceRevision),
            sinceGameId: str(payload.sinceGameId) ?? undefined,
          },
        );
        if (!result.ok) return notFoundOrConflict<T>(result.error);
        return ok<T>(result.response);
      }

      case 'command': {
        if (!roomId) return err<T>(400, 'MISSING_ROOM_ID');
        const command = payload.command as GameCommand | undefined;
        if (!command) return err<T>(400, 'INVALID_COMMAND');
        return ok<T>(await service.submitCommand({ roomId, userId }, command));
      }

      case 'lobby': {
        if (!roomId) return err<T>(400, 'MISSING_ROOM_ID');
        const command = payload.command as LobbyCommand | undefined;
        if (!command) return err<T>(400, 'INVALID_COMMAND');
        const result = await service.submitLobbyCommand({ roomId, userId }, command);
        // api/game.ts: başarısız lobi komutu 409 ama GÖVDE yine `result`tır.
        return result.ok ? ok<T>(result) : { ok: false, status: 409, error: result.error };
      }

      case 'heartbeat': {
        if (!roomId) return err<T>(400, 'MISSING_ROOM_ID');
        return ok<T>(await service.heartbeat({ roomId, userId }));
      }

      case 'claim_control': {
        if (!roomId) return err<T>(400, 'MISSING_ROOM_ID');
        return ok<T>(await service.claimControl({ roomId, userId }));
      }

      default:
        return err<T>(400, 'UNKNOWN_ACTION');
    }
  } catch {
    return err<T>(500, 'SERVICE_UNAVAILABLE');
  }
}
