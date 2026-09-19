/**
 * Lobi anlık görünümü (HTTP `lobby_view` yanıtı).
 *
 * Sürüm 0.2.0'a **eklenen** tiptir; mevcut bir alan değişmez, kırıcı değildir.
 * Lobi tamamen HTML uygulama katmanındadır (docs/CONTRACT.md § 4): 3D sahneye
 * `phase === 'lobby'` görünümü gönderilmez. Oyun başlayınca istemci `view`
 * eylemine geçer ve `SceneView` alır.
 *
 * Gizlilik: lobide gizli rol/kart yoktur. Yalnız koltuk sırası, görünen ad,
 * bağlantı ve hazır durumu paylaşılır. `userId` (auth kimliği) buraya girmez;
 * yalnız opak `playerId`.
 */

import type { PlayerId, RoomId } from './ids';
import type { AvatarSelection } from './avatars';

export type LobbyStatus = 'lobby' | 'in_game' | 'ended';

export type LobbyMember = {
  /** Koltuğa bağlı opak sunucu oyuncu kimliği (auth kimliğinden ayrı). */
  playerId: PlayerId;
  seatIndex: number;
  /** İsim veri olarak çizilir; HTML/URL olarak yorumlanmaz. */
  displayName: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  /** İsteği yapan oyuncunun kendi koltuğu. */
  isLocal: boolean;
  /**
   * D3.4 — seçilen karakter + ten. Seçim yoksa koltuk varsayılanı; her zaman
   * dolu (`PlayerView.avatar` ile aynı anlam).
   */
  avatar: AvatarSelection;
};

export type LobbySnapshot = {
  roomId: RoomId;
  /** Paylaşılabilir davet kodu; kimlik doğrulama sırrı değildir. */
  inviteCode: string;
  status: LobbyStatus;
  localPlayerId: PlayerId;
  isHost: boolean;
  /** Sabit koltuk sırasıyla. */
  members: readonly LobbyMember[];
  minPlayers: number;
  maxPlayers: number;
  /**
   * Oyunu başlatma koşulu sağlandı mı: oyuncu sayısı aralıkta ve tüm aktif
   * üyeler hazır. Sunucu ayrıca doğrular; bu alan güvenlik garantisi değildir.
   */
  canStart: boolean;
};
