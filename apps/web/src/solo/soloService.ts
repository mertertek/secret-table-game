/**
 * D26 — tarayıcıda koşan oyun servisi.
 *
 * `packages/server` SAFTIR: `service.ts`, `projection.ts`, `engine-map.ts` ve
 * `memory-gateway.ts` içinde `node:` ya da Supabase içe aktarımı yoktur ve
 * `game-core` yalnız `contracts`a bağlıdır. Bu yüzden `GameService` +
 * `InMemoryGateway` ikilisi tarayıcıda aynı kuralları uygular: solo kipte de
 * hamleleri MOTOR doğrular, istemci yalnız istek gönderir.
 *
 * Modül TEMBEL yüklenir (`import()`): "Try it solo" düğmesine basılmadan ana
 * pakete girmez. Kalıcılık yoktur — sekme kapanınca oyun biter.
 *
 * Sunucu yolu (`apps/web/api/game.ts`) bu dosyadan HABERSİZDİR ve değişmez.
 */

import type { GameService } from '@secret-table/server';

import { emitSoloRevision } from './soloMode';

/**
 * Solo masada "oyuncu çevrimdışı" duraklaması anlamsızdır: botlar gerçek
 * oturum tazelemesi yapmaz, insan da tek başınadır. Pencere bir güne alınır.
 */
const SOLO_RECONNECT_SECONDS = 24 * 60 * 60;

let pending: Promise<GameService> | null = null;

/** Sekme ömrü boyunca TEK servis örneği (tek masa, tek bellek deposu). */
export async function getSoloService(): Promise<GameService> {
  if (!pending) {
    pending = (async () => {
      const { GameService: Service, InMemoryGateway } = await import('@secret-table/server');
      const gateway = new InMemoryGateway();
      // Realtime tetikleyicisinin yerel karşılığı: sürüm değişince `useRoomState`
      // yetkili görünümü yeniden alır.
      gateway.onRevision(({ roomId, revision }) => emitSoloRevision(roomId, revision));
      return new Service(gateway, { reconnectSeconds: SOLO_RECONNECT_SECONDS });
    })();
  }
  return pending;
}

/** Test kancası / "Play with friends": bir sonraki solo oyun sıfırdan başlar. */
export function resetSoloService(): void {
  pending = null;
}
