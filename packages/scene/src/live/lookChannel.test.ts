/**
 * C3 — bakış kanalı ve uzak baş deposu.
 *
 * Bakış React state'i olmadığı için sürüklemede yeniden render olmaz; burada
 * kanalın sözleşmesi doğrulanır: değer hemen görünür, kare istenir, bildirim
 * rAF başına bir kez gider. `PeerHeads` de kare başına tek hesap yapar.
 */
import { describe, expect, it } from 'vitest';
import type { HeadViewpoint, SceneView } from '@secret-table/contracts';
import { getSceneFixture } from '../../../fixtures/src/index';
import { LookChannel } from './lookChannel';
import { PeerHeads } from './PeerHeads';

function manualRaf() {
  const queue: (() => void)[] = [];
  return {
    raf: (cb: () => void) => { queue.push(cb); return queue.length; },
    caf: (handle: number) => { queue[handle - 1] = () => {}; },
    run: () => { const pending = queue.splice(0); for (const cb of pending) cb(); },
    get size() { return queue.length; },
  };
}

describe('LookChannel', () => {
  it('değeri anında yazar ve her yazmada kare ister', () => {
    const timer = manualRaf();
    const channel = new LookChannel({ yaw: 0, pitch: 0 }, timer.raf, timer.caf);
    let frames = 0; channel.invalidate = () => { frames += 1; };
    channel.set({ yaw: .1, pitch: -.2 });
    expect(channel.current).toEqual({ yaw: .1, pitch: -.2 });
    channel.set({ yaw: .2, pitch: -.2 });
    expect(channel.current.yaw).toBeCloseTo(.2);
    expect(frames).toBe(2);
  });

  it('bildirimi rAF başına bir kez ve son değerle yapar', () => {
    const timer = manualRaf();
    const channel = new LookChannel({ yaw: 0, pitch: 0 }, timer.raf, timer.caf);
    const seen: number[] = [];
    const flush = (look: { yaw: number }) => seen.push(look.yaw);
    channel.set({ yaw: .1, pitch: 0 }, flush);
    channel.set({ yaw: .2, pitch: 0 }, flush);
    channel.set({ yaw: .3, pitch: 0 }, flush);
    expect(seen).toEqual([]);
    timer.run();
    expect(seen).toEqual([.3]);
    channel.set({ yaw: .4, pitch: 0 }, flush);
    timer.run();
    expect(seen).toEqual([.3, .4]);
  });

  it('bildirim istenmezse rAF kurulmaz; dispose bekleyeni iptal eder', () => {
    const timer = manualRaf();
    const channel = new LookChannel({ yaw: 0, pitch: 0 }, timer.raf, timer.caf);
    channel.set({ yaw: .1, pitch: 0 });
    expect(channel.pending).toBe(false);
    let flushed = 0;
    channel.set({ yaw: .2, pitch: 0 }, () => { flushed += 1; });
    expect(channel.pending).toBe(true);
    channel.dispose();
    timer.run();
    expect(flushed).toBe(0);
    expect(channel.pending).toBe(false);
  });

  it('Canvas yokken (invalidate null) yazma güvenlidir', () => {
    const timer = manualRaf();
    const channel = new LookChannel({ yaw: 0, pitch: 0 }, timer.raf, timer.caf);
    expect(() => channel.set({ yaw: .5, pitch: .1 })).not.toThrow();
    expect(channel.current.yaw).toBeCloseTo(.5);
  });
});

describe('PeerHeads', () => {
  const view = getSceneFixture('president-discard')!.view as SceneView;
  const peer = view.players.find((p) => p.playerId !== view.localPlayerId)!;
  const sample = (t: number): HeadViewpoint => ({ roomId: view.roomId, playerId: peer.playerId, seatIndex: peer.seatIndex, yaw: .3, pitch: .1, t });

  it('aynı kare damgasında yalnız bir kez hesaplar', () => {
    const heads = new PeerHeads();
    const now = Date.now();
    heads.accept(view, [sample(now)], true);
    heads.frame(1, 1000, now);
    const first = heads.get(peer.playerId);
    expect(first?.yaw).toBeCloseTo(.3);
    // Yeni örnek gelse bile aynı karede depo değişmez.
    heads.accept(view, [{ ...sample(now + 10), yaw: -.5 }], true);
    heads.frame(1, 1010, now + 10);
    expect(heads.get(peer.playerId)).toBe(first);
    heads.frame(2, 1020, now + 10);
    expect(heads.get(peer.playerId)?.yaw).toBeCloseTo(-.5);
  });

  it('askıya alınınca (enabled=false) örnek kalmaz', () => {
    const heads = new PeerHeads();
    const now = Date.now();
    heads.accept(view, [sample(now)], true);
    heads.frame(1, 1000, now);
    expect(heads.size).toBe(1);
    heads.accept(view, [sample(now)], false);
    heads.frame(2, 1016, now);
    expect(heads.size).toBe(0);
  });

  it('tazeliği geçmiş örnek alınmaz', () => {
    const heads = new PeerHeads();
    const now = Date.now();
    heads.accept(view, [sample(now - 5000)], true);
    heads.frame(1, 1000, now);
    expect(heads.size).toBe(0);
  });
});
