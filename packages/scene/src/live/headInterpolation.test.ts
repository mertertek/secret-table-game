/**
 * D24 — uzak baş ara değeri (entity interpolation).
 *
 * Saf modül testleri: 60 fps'de ardışık kare farkları düzenli mi, örnek
 * kesilince duruyor mu, sarmal ve düzensiz aralık (jitter) doğru mu.
 * Karşılaştırma için eski davranış (son örneğe koşma) da aynı akışla ölçülür.
 */
import { describe, expect, it } from 'vitest';
import type { HeadViewpoint, SceneView } from '@secret-table/contracts';
import { getSceneFixture } from '../../../fixtures/src/index';
import { headTarget } from '../prototype/model';
import { PeerHeads } from './PeerHeads';
import { HEAD_INTERP, HeadBuffer, easeDelay, jitterDelay, lerpAngle, percentile, poseAt, renderDelay, sampleInterval, smoothingRate, wrapAngle } from './headInterpolation';

const FRAME = 1000 / 60;
type Emit = { t: number; yaw: number; pitch: number };

/** Örnek akışını 60 fps'de oynatır; her karenin yaw'ını döndürür. */
function play(emits: readonly Emit[], opts: { smooth?: boolean; latest?: boolean; until?: number } = {}) {
  const buffer = new HeadBuffer();
  const frames: { now: number; yaw: number; behind: boolean }[] = [];
  let next = 0;
  let smoothed = emits[0]!.yaw;
  let last = emits[0]!;
  const until = opts.until ?? emits[emits.length - 1]!.t + 2000;
  for (let now = emits[0]!.t; now <= until; now += FRAME) {
    while (next < emits.length && emits[next]!.t <= now) {
      const emit = emits[next]!;
      buffer.push(emit.t, emit.t, emit.yaw, emit.pitch);
      last = emit; next += 1;
    }
    const pose = buffer.poseAt(now);
    // `latest`: D24 ÖNCESİ davranış — hedef doğrudan son örnektir.
    const target = opts.latest ? last.yaw : pose?.yaw ?? 0;
    if (opts.smooth || opts.latest) {
      const rate = opts.latest ? 12 : smoothingRate(buffer.interval, buffer.delay());
      smoothed += (target - smoothed) * (1 - Math.exp(-rate * (FRAME / 1000)));
    } else smoothed = target;
    frames.push({ now, yaw: smoothed, behind: pose?.behind ?? false });
  }
  return frames;
}

/** Sabit aralıklı, sabit adımlı bir tarama (yaw 0 → 0,5). */
function sweep(interval: number, steps: number, step = .1, jitter: readonly number[] = []): Emit[] {
  const emits: Emit[] = [];
  let t = 0;
  for (let i = 0; i <= steps; i += 1) {
    emits.push({ t: Math.round(t), yaw: i * step, pitch: i * step * .2 });
    t += interval + (jitter.length ? jitter[i % jitter.length]! : 0);
  }
  return emits;
}

const maxStep = (frames: readonly { yaw: number }[], from = 0) => {
  let max = 0;
  for (let i = from + 1; i < frames.length; i += 1) max = Math.max(max, Math.abs(frames[i]!.yaw - frames[i - 1]!.yaw));
  return max;
};

describe('headInterpolation — saf yardımcılar', () => {
  it('açıyı −π..π aralığına sarar', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI, 6);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI * .5, 6);
    expect(wrapAngle(Number.NaN)).toBe(0);
  });

  it('sarmalın kısa yanından ara değer üretir', () => {
    // 170° → −170° arası 20°'dir, 340° değil.
    const a = 170 * Math.PI / 180, b = -170 * Math.PI / 180;
    expect(Math.abs(lerpAngle(a, b, .5))).toBeCloseTo(Math.PI, 5);
    expect(lerpAngle(a, b, .25)).toBeCloseTo(175 * Math.PI / 180, 5);
    expect(lerpAngle(.2, .4, .5)).toBeCloseTo(.3, 6);
    expect(lerpAngle(-.3, .3, 0)).toBeCloseTo(-.3, 6);
    expect(lerpAngle(-.3, .3, 1)).toBeCloseTo(.3, 6);
  });

  it('aralığı medyanla ölçer, tek gecikmiş paket bozmaz', () => {
    const keys = [0, 540, 1080, 1900, 2440].map((t) => ({ t, yaw: 0, pitch: 0 }));
    expect(sampleInterval(keys)).toBe(540);
    expect(sampleInterval([{ t: 0, yaw: 0, pitch: 0 }])).toBe(HEAD_INTERP.defaultInterval);
  });

  it('gecikme aralığın ~1,2 katıdır ve tavanla sınırlıdır', () => {
    expect(renderDelay(540)).toBeCloseTo(540 * 1.2 + 40, 6);
    expect(renderDelay(1500)).toBe(HEAD_INTERP.maxDelay);
    expect(renderDelay(540, 300)).toBe(300);
    expect(renderDelay(20)).toBe(HEAD_INTERP.minDelay);
  });

  it('yumuşatma katsayısı kapsanmayan aralıkta yavaşlar', () => {
    expect(smoothingRate(540, renderDelay(540))).toBeCloseTo(1000 / HEAD_INTERP.smoothTau, 6);
    expect(smoothingRate(1500, HEAD_INTERP.maxDelay)).toBeLessThan(1000 / HEAD_INTERP.smoothTau);
  });

  it('poseAt: tamponun dışında bekler, içinde düz ara değer verir', () => {
    const keys = [{ t: 0, yaw: 0, pitch: 0 }, { t: 500, yaw: .4, pitch: .2 }];
    expect(poseAt([], 0)).toBeNull();
    expect(poseAt(keys, -100)).toEqual({ yaw: 0, pitch: 0, behind: true });
    expect(poseAt(keys, 250)!.yaw).toBeCloseTo(.2, 6);
    expect(poseAt(keys, 250)!.pitch).toBeCloseTo(.1, 6);
    expect(poseAt(keys, 900)).toEqual({ yaw: .4, pitch: .2, behind: false });
  });
});

describe('HeadBuffer', () => {
  it('eski ya da aynı `sequence` düşer, kapasite aşılmaz', () => {
    const buffer = new HeadBuffer();
    expect(buffer.push(10, 10, .1, 0)).toBe(true);
    expect(buffer.push(10, 20, .2, 0)).toBe(false);
    expect(buffer.push(5, 30, .3, 0)).toBe(false);
    for (let i = 0; i < HEAD_INTERP.capacity + 4; i += 1) buffer.push(100 + i, 100 + i * 540, .1 * i, 0);
    expect(buffer.size).toBe(HEAD_INTERP.capacity);
  });

  it('uzun sessizlikten sonra tampon sıfırlanır (yavaş kayma yok)', () => {
    const buffer = new HeadBuffer();
    buffer.push(1, 0, 0, 0);
    buffer.push(2, 540, .2, 0);
    buffer.push(3, 1080, .4, 0);
    buffer.push(4, 1080 + 6000, -.4, 0);
    expect(buffer.size).toBe(1);
    expect(buffer.poseAt(1080 + 6000 + 5000)).toEqual({ yaw: -.4, pitch: 0, behind: false });
  });
});

describe('D24 — 60 fps oynatma', () => {
  const interval = 540;
  const step = .1;
  // Kabul eşiği: ideal kare adımı × 1,5.
  const ideal = step / (interval / FRAME);

  it('540 ms aralıkta kare farkları düzenli kalır (sıçrama yok)', () => {
    const frames = play(sweep(interval, 6, step));
    expect(maxStep(frames)).toBeLessThanOrEqual(ideal * 1.5);
    // Eski davranış aynı akışta örnek başına TEK sıçrama yapar.
    const before = play(sweep(interval, 6, step), { latest: true });
    expect(maxStep(before)).toBeGreaterThan(ideal * 5);
  });

  it('yumuşatma eklendiğinde de kare farkı eşiği aşmaz', () => {
    const frames = play(sweep(interval, 6, step), { smooth: true });
    expect(maxStep(frames)).toBeLessThanOrEqual(ideal * 1.5);
  });

  it('düzensiz aralıkta (jitter ±150 ms) kaba geri gidiş yok', () => {
    const frames = play(sweep(interval, 8, step, [150, -150, 60, -90, 0]), { smooth: true });
    // Tur 2: tahmin aşınca yakalama geri düzeltir. Geri adım İLERİ adımla aynı
    // sınırda kalır (doğal hızın ~3 katı) ve toplamı bir örnek adımını aşmaz.
    let back = 0;
    for (let i = 1; i < frames.length; i += 1) {
      const delta = frames[i]!.yaw - frames[i - 1]!.yaw;
      expect(delta).toBeGreaterThanOrEqual(-(step / ((interval - 150) / FRAME)) * 3.5);
      if (delta < 0) back -= delta;
    }
    // Bu akışta örnek hızı ±%38 oynar (aralık 390–690 ms), yani tahmin her
    // örnekte biraz aşar: toplam geri düzeltme iki örnek adımını aşmamalı.
    expect(back).toBeLessThan(step * 2);
    // Eşik en KISA aralığa (540 − 150 ms) göredir: hızlanan akış daha dik ilerler.
    // Tur 2 yakalama sınırı doğal hızın 2 katı + taban olduğu için çarpan 3,5.
    expect(maxStep(frames)).toBeLessThanOrEqual(step / ((interval - 150) / FRAME) * 3.5);
  });

  it('tur 2: örnek kesilince sönümlü tahminle ilerler, en çok yarım adım', () => {
    const emits = sweep(interval, 4, step);
    const frames = play(emits, { until: emits[emits.length - 1]!.t + 3000 });
    const last = frames[frames.length - 1]!;
    // Son örneği geçer ama bir örnek adımının yarısından fazla değil (sönüm).
    expect(last.yaw).toBeGreaterThan(4 * step);
    expect(last.yaw).toBeLessThanOrEqual(4 * step + step * .5);
    expect(last.behind).toBe(false);
    // Tahmin bitince kare istemi de biter (frameloop="demand" boşta durur).
    expect(frames.filter((f) => f.behind).length).toBeGreaterThan(0);
    // Son yarım saniyede hareket kalmaz: tahmin durmuştur.
    const settled = frames.slice(-30);
    expect(maxStep(settled)).toBeLessThan(1e-4);
    for (const frame of settled) expect(frame.behind).toBe(false);
  });
});

describe('D24 — PeerHeads tamponu', () => {
  const view = getSceneFixture('president-discard')!.view as SceneView;
  const peer = view.players.find((p) => p.playerId !== view.localPlayerId)!;
  const at = (t: number, yaw: number): HeadViewpoint => ({ roomId: view.roomId, playerId: peer.playerId, seatIndex: peer.seatIndex, yaw, pitch: 0, t });

  it('ara değer son örneğin GERİSİNDEN okunur, ham örnek değişmez', () => {
    const heads = new PeerHeads();
    const wall = Date.now();
    let stamp = 0;
    const tick = (ms: number, yaw: number) => {
      heads.accept(view, [at(wall + ms, yaw)], true);
      heads.frame(++stamp, 1000 + ms, wall + ms);
    };
    tick(0, 0);
    tick(540, .4);
    // 540 ms sonra render zamanı hâlâ ilk örnektedir (gecikme ≈ 688 ms).
    expect(heads.get(peer.playerId)?.yaw).toBeCloseTo(.4, 6);
    expect(heads.pose(peer.playerId)?.yaw).toBeCloseTo(0, 6);
    expect(heads.pending).toBe(true);
    // Gecikme dolunca poz iki örnek arasında ilerler.
    heads.accept(view, [at(wall + 540, .4)], true);
    heads.frame(++stamp, 1000 + 950, wall + 950);
    const mid = heads.pose(peer.playerId)!.yaw;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(.4);
    // Örnek gelmezse tahmin bir aralık sürer, sonra donar ve kare istemi biter.
    heads.accept(view, [at(wall + 540, .4)], true);
    heads.frame(++stamp, 1000 + 1600, wall + 1600);
    const predicted = heads.pose(peer.playerId)!.yaw;
    expect(predicted).toBeGreaterThan(.4);
    expect(predicted).toBeLessThanOrEqual(.4 + .2);
    expect(heads.pending).toBe(true);
    heads.accept(view, [at(wall + 540, .4)], true);
    heads.frame(++stamp, 1000 + 3000, wall + 3000);
    const frozen = heads.pose(peer.playerId)!.yaw;
    expect(heads.pending).toBe(false);
    heads.accept(view, [at(wall + 540, .4)], true);
    heads.frame(++stamp, 1000 + 3800, wall + 3800);
    expect(heads.pose(peer.playerId)!.yaw).toBeCloseTo(frozen, 6);
    expect(heads.pending).toBe(false);
  });

  it('tazelik dolunca nötre döner (headTarget davranışı korunur)', () => {
    const heads = new PeerHeads();
    const wall = Date.now();
    heads.accept(view, [at(wall, .4)], true);
    heads.frame(1, 1000, wall);
    const pose = heads.pose(peer.playerId)!;
    expect(headTarget(pose, 1000, true, 1800)).toEqual({ yaw: .4, pitch: 0 });
    expect(headTarget(pose, 1000 + 1800, true, 1800)).toEqual({ yaw: 0, pitch: 0 });
    expect(headTarget(pose, 1000, false, 1800)).toEqual({ yaw: 0, pitch: 0 });
  });
});

/** Yinelenebilir sözde rastgele (test akışları için). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Gerçek Realtime akışı: gönderen düzenli (nominal `interval`), paket
 * `jitter` ms'e kadar geç gelir ve `loss` olasılıkla hiç gelmez.
 * Alıcıda örneğin damgası GELİŞ anıdır (`acceptHeadWire` `t = now` yazar).
 */
function noisy(interval: number, steps: number, step: number, opts: { jitter: number; loss: number; seed?: number }): Emit[] {
  const rand = rng(opts.seed ?? 7);
  const emits: Emit[] = [];
  let at = -1;
  // Sabit hızlı üçgen tarama (±0,5 rad): her örnekte açı farkı tam `step`.
  const half = Math.round(1 / step);
  const tri = (i: number) => {
    const pos = ((i % (half * 2)) + half * 2) % (half * 2);
    return (pos <= half ? pos : half * 2 - pos) * step - .5;
  };
  for (let i = 0; i <= steps; i += 1) {
    const arrival = Math.round(i * interval + rand() * opts.jitter);
    const drop = i > 0 && i < steps && rand() < opts.loss;
    if (drop || arrival <= at) continue;
    at = arrival;
    emits.push({ t: arrival, yaw: tri(i), pitch: tri(i) * .2 });
  }
  return emits;
}

/** Kare farkı dağılımı: sıçrama (> 20 mrad) ve donuk (< 0,1 mrad) kare sayısı. */
function frameStats(frames: readonly { yaw: number }[], from: number) {
  const deltas: number[] = [];
  for (let i = from + 1; i < frames.length; i += 1) deltas.push(Math.abs(frames[i]!.yaw - frames[i - 1]!.yaw));
  const sorted = [...deltas].sort((a, b) => a - b);
  return {
    frames: deltas.length,
    max: sorted[sorted.length - 1] ?? 0,
    p50: sorted[Math.floor(sorted.length * .5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * .95)] ?? 0,
    jumps: deltas.filter((d) => d > .02).length,
    frozen: deltas.filter((d) => d < 1e-4).length,
  };
}

describe('D24 tur 2 — sapma, kayıp ve sınırlı ileri tahmin', () => {
  const interval = 540;
  const step = .1;
  const ideal = step / (interval / FRAME);

  it('yüzdelik ve gecikme yumuşatması', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], .9)).toBe(9);
    expect(percentile([], .9)).toBe(0);
    // Artış anında uygulanır, azalış ~2 s zaman sabitiyle.
    expect(easeDelay(600, 900, 16)).toBe(900);
    expect(easeDelay(Number.NaN, 700, 16)).toBe(700);
    const eased = easeDelay(900, 600, 16);
    expect(eased).toBeLessThan(900);
    expect(eased).toBeGreaterThan(895);
    expect(easeDelay(900, 600, 2000)).toBeCloseTo(900 - 300 * (1 - Math.exp(-1)), 3);
  });

  it('gecikme geliş aralığının p90 + payıdır; kayıp > %10 payı büyütür', () => {
    const regular = Array.from({ length: 8 }, () => 540);
    expect(jitterDelay(regular, 0, 1500)).toBeCloseTo(540 + HEAD_INTERP.jitterMargin, 6);
    // Sapma büyüyünce gecikme büyür (p90 ≈ 840).
    const jittery = [540, 380, 700, 840, 460, 620, 900, 500];
    expect(jitterDelay(jittery, 0, 1500)).toBeGreaterThan(jitterDelay(regular, 0, 1500));
    // Kayıp oranı eşiği aşınca pay 60 → 150 ms.
    expect(jitterDelay(regular, .2, 1500) - jitterDelay(regular, 0, 1500)).toBeCloseTo(90, 6);
    // Alt sınır medyan × 1,1, üst sınır tavan.
    expect(jitterDelay([200, 200, 200, 200, 200, 200], 0, 1500)).toBeGreaterThanOrEqual(220);
    expect(jitterDelay([1400, 1400, 1400, 1400, 1400, 1400], 0, 1500)).toBe(1500);
    expect(jitterDelay(regular, 0, 400)).toBe(400);
    // Ölçüm yetersizken tur 1 formülüne düşer.
    expect(jitterDelay([540, 540], 0, 1500, 540)).toBeCloseTo(renderDelay(540), 6);
  });

  it('kayıp geliş aralığı istatistiğini şişirmez (boşluk slota bölünür)', () => {
    const buffer = new HeadBuffer();
    // 540 ms düzenli akış, 4. paket kayıp (1080 ms boşluk).
    const times = [0, 540, 1080, 2160, 2700, 3240, 3780, 4320];
    for (const t of times) buffer.push(t, t, 0, 0, t);
    expect(buffer.interval).toBeCloseTo(540, 0);
    expect(buffer.lossRatio).toBeCloseTo(1 / 8, 3);
    // İki kat şişseydi aralık ~620 ms'in üstüne çıkardı.
    expect(buffer.interval).toBeLessThan(600);
  });

  it('gecikme değişimi imleç hızını ±%20 dışına çıkarmaz', () => {
    const buffer = new HeadBuffer();
    let now = 0;
    let prev = Number.NaN;
    const rates: number[] = [];
    // Önce düzenli 540 ms, sonra ani ±300 ms sapma: gecikme büyür/küçülür.
    const arrivals = [0, 540, 1080, 1620, 2160, 2700, 3240, 3780, 4100, 4920, 5200, 6100, 6400, 6940, 7480, 8020];
    let next = 0;
    for (; now <= 12000; now += FRAME) {
      while (next < arrivals.length && arrivals[next]! <= now) {
        buffer.push(arrivals[next]!, arrivals[next]!, (next % 7) * .05, 0, arrivals[next]!);
        next += 1;
      }
      buffer.poseAt(now);
      if (Number.isFinite(prev)) rates.push((buffer.cursorTime - prev) / FRAME);
      prev = buffer.cursorTime;
    }
    for (const rate of rates) {
      expect(rate).toBeGreaterThanOrEqual(1 - HEAD_INTERP.cursorSlack - 1e-9);
      expect(rate).toBeLessThanOrEqual(1 + HEAD_INTERP.cursorSlack + 1e-9);
    }
  });

  it('tahmin en çok bir aralık ilerler ve sönümlüdür', () => {
    const keys = [{ t: 0, yaw: 0, pitch: 0 }, { t: 540, yaw: .1, pitch: .02 }];
    const at = (dt: number) => poseAt(keys, 540 + dt, 540)!;
    // Sönüm: ilk 100 ms'de hız ~tam, 540 ms'de neredeyse durur.
    const early = at(100).yaw - at(0).yaw;
    const late = at(540).yaw - at(440).yaw;
    expect(early).toBeGreaterThan(late * 3);
    // Bir aralıktan sonra ilerleme YOK ve kare istemi biter.
    expect(at(540).yaw).toBeCloseTo(at(5000).yaw, 9);
    expect(at(400).behind).toBe(true);
    expect(at(600).behind).toBe(false);
    // Toplam ilerleme yarım adımı aşmaz, sınırlar içinde kalır.
    expect(at(5000).yaw).toBeLessThanOrEqual(.1 + .05);
    const steep = [{ t: 0, yaw: 0, pitch: 0 }, { t: 540, yaw: .64, pitch: .24 }];
    expect(poseAt(steep, 540 + 5000, 540)!.yaw).toBeLessThanOrEqual(HEAD_INTERP.yawLimit);
    expect(poseAt(steep, 540 + 5000, 540)!.pitch).toBeLessThanOrEqual(HEAD_INTERP.pitchLimit);
    // `predict = 0` (reducedMotion yolu) son örnekte durur.
    expect(poseAt(keys, 5000, 0)).toEqual({ yaw: .1, pitch: .02, behind: false });
  });

  it('±300 ms sapma + %10 kayıplı akışta sıçrama yok, donuk kare < %5', () => {
    const emits = noisy(interval, 60, step, { jitter: 300, loss: .1, seed: 11 });
    const frames = play(emits, { smooth: true, until: 60 * interval });
    // İlk iki aralık tampon ısınmasıdır.
    const stats = frameStats(frames, Math.round(interval * 2 / FRAME));
    expect(stats.jumps).toBe(0);
    expect(stats.frozen / stats.frames).toBeLessThan(.05);
    // Yakalama sınırı doğal hızın 2 katı + 0,25 rad/s taban: en kötü kare ~3× ideal.
    expect(stats.max).toBeLessThanOrEqual(ideal * 3.5);
    // Eski davranış aynı akışta sıçrar.
    const before = play(emits, { latest: true, until: 60 * interval });
    expect(frameStats(before, Math.round(interval * 2 / FRAME)).jumps).toBeGreaterThan(10);
  });

  it('düzenli akışta tur 1 ölçümünden geri gitmez', () => {
    const emits = noisy(interval, 40, step, { jitter: 0, loss: 0 });
    const stats = frameStats(play(emits, { smooth: true, until: 40 * interval }), Math.round(interval * 2 / FRAME));
    expect(stats.jumps).toBe(0);
    // Tur 1: p50 0,0071 / p95 0,0083 / maks 0,0119 / 4-356 donuk kare.
    expect(stats.p50).toBeGreaterThan(ideal * .8);
    expect(stats.p95).toBeLessThanOrEqual(ideal * 1.2);
    expect(stats.max).toBeLessThanOrEqual(ideal * 1.5);
    expect(stats.frozen / stats.frames).toBeLessThan(.02);
  });
});
