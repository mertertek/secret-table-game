import type { HeadViewpoint, SceneView } from '@secret-table/contracts';
import { VIEWPOINT_STALE_MS } from '@secret-table/contracts';
import type { HeadSample } from '../prototype/model';
/** Converts a fresh app-validated sample to this client's monotonic render clock.
 * Repeated props never refresh receipt time. This is not network authentication. */
export class ViewpointAdapter {
  private cache = new Map<string, { t: number; sample: HeadSample }>();
  private watermark = new Map<string, number>();
  private scope = '';
  update(view: SceneView, peers: readonly HeadViewpoint[], wallNow: number, now: number, enabled: boolean): readonly HeadSample[] {
    const scope = `${view.roomId}/${view.localPlayerId}`;
    if (scope !== this.scope) { this.cache.clear(); this.watermark.clear(); this.scope = scope; }
    if (!enabled) this.cache.clear();
    const result: HeadSample[] = [];
    for (const peer of peers) {
      if (peer.roomId !== view.roomId || peer.playerId === view.localPlayerId || !view.players.some((p) => p.playerId === peer.playerId && p.seatIndex === peer.seatIndex && p.connected) ||
        ![peer.yaw, peer.pitch, peer.t].every(Number.isFinite) || !Number.isInteger(peer.t) || wallNow - peer.t > VIEWPOINT_STALE_MS || peer.t > wallNow + 1000) continue;
      const old = this.cache.get(peer.playerId);
      const seen = this.watermark.get(peer.playerId) ?? -1;
      this.watermark.set(peer.playerId, Math.max(seen, peer.t));
      if (!enabled || (!old && peer.t <= seen)) continue;
      if (old && peer.t < old.t) { result.push(old.sample); continue; }
      const sample = old?.t === peer.t ? old.sample : { playerId: peer.playerId, yaw: Math.max(-.65, Math.min(.65, peer.yaw)), pitch: Math.max(-.25, Math.min(.25, peer.pitch)), sequence: peer.t, receivedAt: now - Math.max(0, wallNow - peer.t) };
      this.cache.set(peer.playerId, { t: peer.t, sample }); result.push(sample);
    }
    const present = new Set(result.map((s) => s.playerId));
    for (const id of this.cache.keys()) if (!present.has(id)) this.cache.delete(id);
    return result;
  }
}
