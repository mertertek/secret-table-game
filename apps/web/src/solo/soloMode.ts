/**
 * D26 — solo kip ANAHTARI (ana pakette duran KÜÇÜK köprü).
 *
 * Burada yalnız bayrak, sahte kimlik ve yerel sinyal borusu vardır; oyun
 * servisi, taşıma katmanı ve botlar `solo/*` içindeki AYRI, tembel yüklenen
 * modüllerdedir. Bu ayrım kasıtlıdır: `useRoomState` bu modülü statik olarak
 * içe aktarır, bu yüzden buraya ağır bir bağımlılık girerse ana paket büyür.
 *
 * Solo kipte:
 *  - Supabase YOK: kimlik sabit bir yerel kimliktir, token `solo:<id>`.
 *  - Realtime YOK: sürüm sinyali doğrudan yerel `InMemoryGateway`den gelir.
 *  - Bakış kanalı YOK: jest yalnız yerelde oynar (kanalın Supabase'siz dalıyla
 *    aynı hız sınırı).
 *  - Kalıcılık YOK: hiçbir şey `localStorage`'a yazılmaz, sekme kapanınca biter.
 */

import { EMOTE_COOLDOWN_MS } from '@secret-table/contracts';

import type { GuestSession } from '../multiplayer/guestSession';
import type { RoomWatcher } from '../multiplayer/roomChannel';
import type { ViewpointChannel } from '../multiplayer/viewpointChannel';

/** İnsan oyuncunun solo kimliği (tek sekme, tek oyun). */
export const SOLO_USER_ID = 'solo-you';

/** Solo token biçimi; yalnız `soloTransport` tarafından çözülür, ağa çıkmaz. */
export function soloToken(userId: string): string {
  return `solo:${userId}`;
}

let active = false;

export function isSoloActive(): boolean {
  return active;
}

export function setSoloActive(value: boolean): void {
  active = value;
}

/**
 * Solo kipteki sahte oturum. `mode: 'dev'` seçilir ki `currentAccessToken`
 * Supabase SDK'sına HİÇ dokunmadan token'ı aynen döndürsün.
 */
export function soloSession(): GuestSession | null {
  if (!active) return null;
  return { userId: SOLO_USER_ID, accessToken: soloToken(SOLO_USER_ID), mode: 'dev' };
}

// ---------------------------------------------------------------------------
// Sürüm sinyali (Realtime yerine yerel olay)
// ---------------------------------------------------------------------------

type RevisionListener = (signal: { roomId: string; revision: number }) => void;

const revisionListeners = new Set<RevisionListener>();

/** Yerel servis bir sürüm yazdığında çağrılır (`InMemoryGateway.onRevision`). */
export function emitSoloRevision(roomId: string, revision: number): void {
  for (const listener of [...revisionListeners]) listener({ roomId, revision });
}

/**
 * `watchRoomRevision` ile AYNI yüzey, ağsız. Yedek yoklama yoktur: yerel
 * sinyal kaybolmaz.
 */
export function watchSoloRevision(options: {
  roomId: string;
  onRevision: (signal: { roomId: string; revision: number }) => void;
}): RoomWatcher {
  const listener: RevisionListener = (signal) => {
    if (signal.roomId !== options.roomId) return;
    options.onRevision(signal);
  };
  revisionListeners.add(listener);
  return {
    stop: () => {
      revisionListeners.delete(listener);
    },
    reauth: async () => {},
    poke: () => {},
  };
}

// ---------------------------------------------------------------------------
// Bakış kanalı yerine yerel jest kapısı
// ---------------------------------------------------------------------------

/**
 * Solo kipte hiçbir paket yayınlanmaz; `sendEmote` yalnız "jesti yerelde
 * oynatabilirsin" der. Hız sınırı canlı kanaldakiyle aynıdır ki iki kipte
 * davranış ayrışmasın (D27'de bellek kipi için de böyle yapıldı).
 */
export function soloViewpointChannel(): ViewpointChannel {
  let lastLocalEmoteAt = -Infinity;
  return {
    sync: () => {},
    send: () => false,
    sendEmote: () => {
      const now = Date.now();
      if (now - lastLocalEmoteAt < EMOTE_COOLDOWN_MS) return false;
      lastLocalEmoteAt = now;
      return true;
    },
    reauth: async () => {},
    stop: () => {},
  };
}

/** Test kancası: modül durumu oturumlar arasında sızmasın. */
export function resetSoloMode(): void {
  active = false;
  revisionListeners.clear();
}
