/**
 * D26 — "Try it solo" akışının tek girişi (TEMBEL yüklenen modül).
 *
 * Sıra: yerel servisi kur → solo taşımayı `apiClient`e tak → insanı oda sahibi
 * yap → 5 botu davet koduyla oturt → herkesi hazır yap → oyunu başlat →
 * bot döngüsünü çalıştır. Sonra `/oda/<roomId>` açılır ve NORMAL oyun ekranı
 * (sahne, kurallar, koreografi, "Nasıl oynanır") aynen çalışır.
 *
 * Hiçbir şey saklanmaz: yenileme/sekme kapanışı oyunu bitirir.
 */

import { PROTOCOL_VERSION, avatarForSeat, type AvatarSelection } from '@secret-table/contracts';

import { setSoloTransport } from '../multiplayer/apiClient';
import { pickBotAvatar } from './botBrain';
import { SOLO_BOT_NAMES, startSoloBots, type SoloBot, type SoloBotRunner } from './soloBots';
import { SOLO_USER_ID, setSoloActive, soloToken } from './soloMode';
import { getSoloService, resetSoloService } from './soloService';
import { soloCall } from './soloTransport';

/** Toplam masa: insan + 5 bot. */
export const SOLO_TABLE_SIZE = SOLO_BOT_NAMES.length + 1;

let runner: SoloBotRunner | null = null;

function base() {
  return { protocolVersion: PROTOCOL_VERSION, commandId: `solo_${Math.random().toString(36).slice(2)}` } as const;
}

async function lobbyCommand(
  roomId: string,
  token: string,
  command: Record<string, unknown>,
): Promise<void> {
  await soloCall('lobby', { roomId, command: { ...base(), ...command } }, token);
}

export type StartSoloResult = { roomId: string; bots: readonly SoloBot[] };

export type StartSoloOptions = {
  /** Masada görünecek insan adı; boşsa çağıran varsayılanı verir. */
  displayName: string;
  random?: () => number;
  /** Test kancası: bot döngüsünü başlatma. */
  startBots?: boolean;
};

/**
 * Solo masayı kurar ve oyunu başlatır. Dönen `roomId` ile `/oda/:roomId`e
 * yönlendirilir; `useRoomState` solo kipi görüp Realtime/heartbeat açmaz.
 */
export async function startSolo(options: StartSoloOptions): Promise<StartSoloResult> {
  const random = options.random ?? Math.random;
  // Aynı sekmede ikinci kez: eski masa ve botlar bırakılır.
  stopSolo();
  resetSoloService();
  await getSoloService();
  setSoloActive(true);
  setSoloTransport(soloCall);

  const humanToken = soloToken(SOLO_USER_ID);
  const created = await soloCall<{ roomId: string; inviteCode: string }>(
    'create_room',
    { displayName: options.displayName },
    humanToken,
  );
  if (!created.ok) throw new Error(created.error);
  const { roomId, inviteCode } = created.data;

  const bots: SoloBot[] = [];
  // İnsan 0. koltukta oturur ve karakter seçmez: varsayılanı havuzdan düşür.
  const pickedAvatars: string[] = [avatarForSeat(0).character];
  for (let i = 0; i < SOLO_BOT_NAMES.length; i += 1) {
    const label = SOLO_BOT_NAMES[i]!;
    const token = soloToken(`bot-${i + 1}`);
    const joined = await soloCall<{ roomId: string }>(
      'join_room',
      { inviteCode, displayName: label },
      token,
    );
    if (!joined.ok) throw new Error(joined.error);
    const lobby = await soloCall<{ localPlayerId?: string }>('lobby_view', { roomId }, token);
    const bot: SoloBot = {
      label,
      token,
      playerId: lobby.ok ? (lobby.data.localPlayerId ?? null) : null,
    };
    bots.push(bot);

    // Masada 6 ayrı karakter görünsün (insanın koltuk varsayılanı dahil).
    const avatar: AvatarSelection = pickBotAvatar(pickedAvatars, random);
    pickedAvatars.push(avatar.character);
    await lobbyCommand(roomId, token, {
      type: 'set_avatar',
      character: avatar.character,
      skin: avatar.skin,
    });
    await lobbyCommand(roomId, token, { type: 'set_ready', ready: true });
  }

  await lobbyCommand(roomId, humanToken, { type: 'set_ready', ready: true });
  const started = await soloCall<{ ok: boolean }>(
    'lobby',
    { roomId, command: { ...base(), type: 'start_game' } },
    humanToken,
  );
  if (!started.ok) throw new Error(started.error);

  if (options.startBots !== false) {
    runner = startSoloBots({ roomId, bots, call: soloCall, random });
  }
  return { roomId, bots };
}

/** İnsanın solo token'ı (test ve çağıran kolaylığı). */
export const SOLO_HUMAN_TOKEN = soloToken(SOLO_USER_ID);

/** Botları durdurur ve solo kipi kapatır ("Play with friends" / temizlik). */
export function stopSolo(): void {
  runner?.stop();
  runner = null;
  setSoloActive(false);
  setSoloTransport(null);
}
