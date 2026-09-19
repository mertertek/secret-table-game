import { useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { VIEWPOINT_STALE_MS, type HeadViewpoint, type SceneView } from '@secret-table/contracts';
import type { HeadSample } from '../prototype/model';
import { ViewpointAdapter } from './ViewpointAdapter';
import { HEAD_INTERP, HeadBuffer, smoothingRate } from './headInterpolation';

/** Uzak baş örneklerinin kare başına tek seferlik deposu (PERF-C1 §4/2).
 *
 * `ViewpointAdapter.update` eskiden her React render'ında çağrılıyordu. Burada
 * kare damgasıyla korunur: aynı karede kim önce okursa hesap bir kez yapılır,
 * `useFrame` sırası önemsizdir. Yetki/tazelik kuralları adaptörde kalır.
 *
 * D24: `get` HAM (en yeni) örneği verir — tazelik damgası `receivedAt` odur.
 * `pose` aynı örneği ara değerle yumuşatılmış yaw/pitch ile döndürür; tampon
 * ve gecikme hesabı saf `headInterpolation` modülündedir.
 */
export class PeerHeads {
  private adapter = new ViewpointAdapter();
  private view: SceneView | null = null;
  private peers: readonly HeadViewpoint[] = [];
  private enabled = false;
  private staleAfter = VIEWPOINT_STALE_MS;
  private stamp = Number.NaN;
  private samples = new Map<string, HeadSample>();
  private buffers = new Map<string, HeadBuffer>();
  private poses = new Map<string, HeadSample>();
  private rates = new Map<string, number>();
  private busy = false;
  /** Render sırasında yalnız girdileri saklar; hesap yapmaz. */
  accept(view: SceneView, peers: readonly HeadViewpoint[], enabled: boolean, staleAfter = this.staleAfter) {
    this.view = view; this.peers = peers; this.enabled = enabled; this.staleAfter = staleAfter;
  }
  /** Gecikme tavanı: tazelik penceresinin yarısı (baş bayatlamadan önce yetişir). */
  private get maxDelay() { return Math.max(HEAD_INTERP.minDelay, Math.min(HEAD_INTERP.maxDelay, this.staleAfter / 2)); }
  /** Kare başına en fazla bir kez hesaplar (`stamp` = R3F saat damgası). */
  frame(stamp: number, now: number, wallNow: number) {
    if (!this.view || stamp === this.stamp) return;
    this.stamp = stamp;
    const list = this.adapter.update(this.view, this.peers, wallNow, now, this.enabled);
    this.samples.clear(); this.poses.clear(); this.rates.clear();
    this.busy = false;
    const max = this.maxDelay;
    for (const sample of list) {
      this.samples.set(sample.playerId, sample);
      let buffer = this.buffers.get(sample.playerId);
      if (!buffer) this.buffers.set(sample.playerId, buffer = new HeadBuffer());
      // Tur 2: `now` paketin YEREL geliş anıdır — sapma (jitter) ve kayıp
      // istatistiği geliş anlarından çıkar, örnek damgasından değil.
      buffer.push(sample.sequence, sample.receivedAt, sample.yaw, sample.pitch, now);
      const pose = buffer.poseAt(now, max);
      this.poses.set(sample.playerId, pose ? { ...sample, yaw: pose.yaw, pitch: pose.pitch } : sample);
      this.rates.set(sample.playerId, smoothingRate(buffer.interval, buffer.delay(max)));
      if (pose?.behind) this.busy = true;
    }
    for (const id of this.buffers.keys()) if (!this.samples.has(id)) this.buffers.delete(id);
  }
  /** Ham en yeni örnek (tazelik ve sıra damgası). */
  get(playerId: string): HeadSample | undefined { return this.samples.get(playerId); }
  /** Ara değerli poz: `receivedAt` ham örnekten gelir, tazelik kuralı değişmez. */
  pose(playerId: string): HeadSample | undefined { return this.poses.get(playerId) ?? this.samples.get(playerId); }
  /** Bu oyuncu için üstel yumuşatma katsayısı (aralığa bağlı). */
  rate(playerId: string): number { return this.rates.get(playerId) ?? 1000 / HEAD_INTERP.smoothTau; }
  /** Tamponda henüz oynatılmamış örnek var mı (`frameloop="demand"` uyandırması). */
  get pending(): boolean { return this.busy; }
  get size() { return this.samples.size; }
}

/** Canvas içi sürücü: kareyi ilerletir, yeni örnek geldiğinde kare ister ve
 * tazelik süresi dolduğunda nötre dönüş için bir kare daha uyandırır. */
export function PeerHeadsBridge({ heads, view, peers, enabled, staleAfter }: {
  heads: PeerHeads; view: SceneView; peers: readonly HeadViewpoint[]; enabled: boolean; staleAfter: number;
}) {
  heads.accept(view, peers, enabled, staleAfter);
  const invalidate = useThree((s) => s.invalidate);
  // D24: tamponda oynatılacak örnek varken kare akmaya devam eder; hareket
  // bitince (render zamanı son örneği geçince) istek durur, CPU boşta kalmaz.
  useFrame((state) => {
    heads.frame(state.clock.elapsedTime, performance.now(), Date.now());
    if (heads.pending) invalidate();
  });
  useLayoutEffect(() => {
    invalidate();
    if (!enabled || !peers.length) return;
    const due = Math.max(...peers.map((p) => p.t)) + staleAfter - Date.now();
    if (!Number.isFinite(due)) return;
    const timer = setTimeout(invalidate, Math.max(0, due) + 5);
    return () => clearTimeout(timer);
  }, [invalidate, peers, enabled, staleAfter]);
  return null;
}
