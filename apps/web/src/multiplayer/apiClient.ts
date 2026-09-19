/**
 * `/api/game` istemcisi. Kimlik `Authorization: Bearer <token>` ile gider;
 * yanıtlar oyuncuya özeldir ve önbelleğe alınmaz.
 */

import type {
  CommandResponse,
  GameCommand,
  LobbyCommand,
  LobbySnapshot,
  PlayerViewResponse,
} from '@secret-table/contracts';

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; status: number; error: string };
export type ApiResult<T> = ApiOk<T> | ApiErr;

/**
 * D26 — solo kip taşıması. `callGame` ile AYNI imza; kurulduğunda bütün
 * `apiClient` yüzeyi (aşağıdaki dışa açık işlevler) değişmeden yerel servise
 * düşer ve `fetch` HİÇ çağrılmaz. Kurulmadığında (varsayılan) tek satır bile
 * fark etmez: normal `/api/game` yolu işler.
 */
export type GameTransport = <T>(
  action: string,
  payload: Record<string, unknown>,
  accessToken: string,
) => Promise<ApiResult<T>>;

let soloTransport: GameTransport | null = null;

/** Solo kipi açar (`fn`) ya da kapatır (`null`). Tek anahtar, test edilebilir. */
export function setSoloTransport(fn: GameTransport | null): void {
  soloTransport = fn;
}

export function soloTransportActive(): boolean {
  return soloTransport !== null;
}

async function callGame<T>(
  action: string,
  payload: Record<string, unknown>,
  accessToken: string,
): Promise<ApiResult<T>> {
  if (soloTransport) return soloTransport<T>(action, payload, accessToken);

  let response: Response;
  try {
    response = await fetch('/api/game', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    return { ok: false, status: 0, error: 'NETWORK_ERROR' };
  }

  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error =
      json && typeof json === 'object' && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'REQUEST_FAILED';
    return { ok: false, status: response.status, error };
  }
  return { ok: true, data: json as T };
}

export function createRoom(
  accessToken: string,
  displayName: string,
): Promise<ApiResult<{ roomId: string; inviteCode: string }>> {
  return callGame('create_room', { displayName }, accessToken);
}

export function joinRoom(
  accessToken: string,
  inviteCode: string,
  displayName: string,
): Promise<ApiResult<{ roomId: string }>> {
  return callGame('join_room', { inviteCode, displayName }, accessToken);
}

/**
 * Yetkili görünüm.
 *
 * D18 — `sinceRevision` istemcinin ELİNDE olan son sürümdür. D21/C: sunucu bu
 * sürümün İLERİSİNDEki her durumda son komutun cue'larını döndürür (eskiden
 * yalnız tam bir sonraki sürümde). Verilmezse cue gelmez (eski davranış).
 *
 * D21/C — `sinceGameId` elimizdeki görünümün oyun kimliğidir: "Yeniden oyna"
 * sonrası sürüm sayacı devam ettiği için eski sürüm yeni oyunun cue'larını
 * açmasın.
 */
export function fetchView(
  accessToken: string,
  roomId: string,
  resync = false,
  sinceRevision?: number,
  sinceGameId?: string,
): Promise<ApiResult<PlayerViewResponse>> {
  return callGame(
    'view',
    sinceRevision === undefined
      ? { roomId, resync }
      : sinceGameId === undefined
        ? { roomId, resync, sinceRevision }
        : { roomId, resync, sinceRevision, sinceGameId },
    accessToken,
  );
}

export type LobbyView = LobbySnapshot & { mode?: 'supabase' | 'memory' };

export function fetchLobby(
  accessToken: string,
  roomId: string,
): Promise<ApiResult<LobbyView>> {
  return callGame('lobby_view', { roomId }, accessToken);
}

export function sendCommand(
  accessToken: string,
  roomId: string,
  command: GameCommand,
): Promise<ApiResult<CommandResponse>> {
  return callGame('command', { roomId, command }, accessToken);
}

export function sendLobbyCommand(
  accessToken: string,
  roomId: string,
  command: LobbyCommand,
): Promise<ApiResult<{ ok: boolean; error?: string }>> {
  return callGame('lobby', { roomId, command }, accessToken);
}

export function sendHeartbeat(
  accessToken: string,
  roomId: string,
): Promise<ApiResult<{ ok: true; sessionGeneration: number }>> {
  return callGame('heartbeat', { roomId }, accessToken);
}

export function claimControl(
  accessToken: string,
  roomId: string,
): Promise<ApiResult<{ sessionGeneration: number }>> {
  return callGame('claim_control', { roomId }, accessToken);
}
