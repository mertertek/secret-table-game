import type { AvatarSelection, PlayerView, SceneView } from '@secret-table/contracts';
import type { Position } from '../objects/Surface';
import { avatarForSeat, labelHeight } from '../characters/spec';
/** `label`: baş üstü isim etiketinin çapası (D6). Masa üstü plaka kalktı. */
export type Seat = { player: PlayerView; angle: number; chair: Position; label: Position; cards: Position };

/**
 * D3.4 — koltuğun görünen karakteri. Yetkili kaynak `PlayerView.avatar`;
 * `avatarForSeat` yalnız yedek (sözleşme öncesi görünüm / fixture) yoludur.
 */
export function seatAvatar(player: Pick<PlayerView, 'seatIndex'> & Partial<Pick<PlayerView, 'avatar'>>): AvatarSelection {
  return player.avatar ?? avatarForSeat(player.seatIndex);
}

/** Rotate the view, never the server's seats. Eliminated/offline players keep their slot. */
export function layoutSeats(view: Pick<SceneView, 'players' | 'localPlayerId' | 'playerCountAtStart'>): Seat[] {
  const count = Math.max(view.playerCountAtStart ?? view.players.length, 1);
  const local = view.players.find((player) => player.playerId === view.localPlayerId)?.seatIndex ?? 0;
  return view.players.map((player) => {
    const angle = (player.seatIndex - local) / count * Math.PI * 2;
    const x = Math.sin(angle), z = Math.cos(angle);
    const cardX = x * 1.62;
    // Rear diagonal envelopes clear the board without crowding the nameplates.
    const cardZ = z < 0 && Math.abs(cardX) < 1.08 ? Math.min(z * .85, -.785) : z * .85;
    // D3 §e: etiket alt kenarı baş (ya da şapka) tepesinin 0,05 m üstünde.
    // Taban 0,745; fötr/bere/kıvırcık karakterlerinde `labelLift` kadar yükselir.
    // D3.4: karakter sunucudan gelir (`PlayerView.avatar`, her zaman dolu);
    // alan yoksa (eski/elle kurulmuş görünüm) koltuk varsayılanına düşülür.
    const avatar = seatAvatar(player);
    return { player, angle, chair: [x * 2.64, -.74, z * 2.0],
      label: [x * 2.64, labelHeight(avatar.character), z * 2.0], cards: [cardX, .022, cardZ] };
  });
}
