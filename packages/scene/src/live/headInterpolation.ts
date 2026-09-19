/**
 * D24 — uzak baş örnekleri için tampon + ara değer (entity interpolation).
 *
 * Gönderim aralığı kota nedeniyle 500–1500 ms'tir (`viewpointInterval`), yani
 * saniyede yalnız ~2 örnek gelir. Alıcı son örneğe koşarsa hareket adım adım
 * görünür. Burada örnekler kısa bir tamponda tutulur ve render zamanı
 * `şimdi − gecikme` olarak GERİDEN okunur: iki örnek arasındaki her kare
 * ara değerle üretilir.
 *
 * Tur 2 (gerçek Supabase Realtime bulgusu): paketler düzensiz gelir ve
 * tekrarlanmaz (kayıp mümkün). Sabit "medyan × 1,2" gecikme geç paketi
 * yakalayamayınca imleç son örneğe yetişip DURUYOR, sonra hızla koşuyordu.
 * Bu turda gecikme GELİŞ aralığının p90'ına göre uyarlanır, kayıp seq
 * boşluğundan sezilir (istatistik şişmez) ve imleç son örneğe ulaşınca
 * sönümlü, en çok bir aralıklık ileri tahminle akmayı sürdürür.
 *
 * Saf modül: three/React/DOM yok, saat dışarıdan verilir. Tüm zamanlar
 * `receivedAt` ile aynı monotonik render saatindedir (`performance.now`).
 */

export type HeadKey = { readonly t: number; readonly yaw: number; readonly pitch: number };
/** `behind`: render zamanı en yeni örneğin GERİSİNDE ya da tahmin sürüyor — tüketilecek veri var. */
export type HeadPose = { yaw: number; pitch: number; behind: boolean };

export const HEAD_INTERP = {
  /** Oyuncu başına saklanan en fazla örnek (≥3 gerekir; 8 ≈ 4 s @540 ms). */
  capacity: 8,
  /** Aralık medyanı en fazla bu kadar son farktan hesaplanır. */
  window: 5,
  /** Ölçüm yokken varsayılan aralık (≈ `viewpointInterval(6)`). */
  defaultInterval: 540,
  minInterval: 120,
  maxInterval: 2000,
  /** İstatistik yokken geri düşülen gecikme: aralık × `factor` + `margin`. */
  factor: 1.2,
  margin: 40,
  minDelay: 140,
  /** Gecikme tavanı (tur 2: 1200 → 1500 ms); `staleAfter/2` ile de sınırlıdır. */
  maxDelay: 1500,
  /** Bu kat sayıdan uzun boşluktan sonra gelen örnek "yeniden başlama"dır: tampon sıfırlanır. */
  resumeGap: 3,
  /** Gecikme aralığı tam kapatıyorsa yumuşatma zaman sabiti (ms). */
  smoothTau: 60,
  /** Kapatmıyorsa kalan basamağı yayan daha yavaş sabit (ms). */
  coarseTauMin: 80,
  coarseTauMax: 220,

  // — tur 2 —
  /** Geliş aralığı istatistiği penceresi ve p90 için gereken en az örnek. */
  statWindow: 12,
  statMin: 6,
  /** Sapmaya göre gecikme = geliş aralığı p90 + pay. */
  jitterPercentile: .9,
  jitterMargin: 60,
  /** Kayıp oranı bu eşiği aşarsa pay büyür (tekrar yok, boşluk uzun sürebilir). */
  lossThreshold: .1,
  lossyMargin: 150,
  /** Gecikmenin alt sınırı: medyan aralık × bu. */
  floorFactor: 1.1,
  /** Gecikme artarken anında, azalırken bu zaman sabitiyle (ms) uygulanır. */
  delayFallTau: 2000,
  /** Gecikme değişimi render imlecinin hızını en çok bu oranda oynatır (±%20). */
  cursorSlack: .2,
  /** İleri tahmin: sönüm sabiti τ = aralık × bu; ilerleme en çok 1 aralık. */
  predictTau: .5,
  /** Bu kadar slottan uzun boşluk "boşta"dır: sapma istatistiğine girmez. */
  idleSlots: 4,
  /**
   * Düzenleme (de-jitter): örnek damgası gönderim ızgarasına (`önceki + slot ×
   * aralık`) oturtulur, gerçek gelişe bu oranda çekilir. Gönderim aralığı
   * SABİT olduğu için geliş sapması damgayı bozmamalı; yoksa iki paket 100 ms
   * arayla gelince ara değer o adımı 100 ms'de tarar (görünür sıçrama).
   */
  gridPull: .15,
  /**
   * Yakalama sınırı: yeni örnek imlecin GERİSİNDEN başlayan bir parça getirdiğinde
   * (geç/kayıp paket) hedef sıçrar. Poz bu farkı, o anki doğal hızın `catchFactor`
   * katı + `catchFloor` (rad/s) ile kapatır: kare farkı doğal adımın birkaç katını
   * aşmaz, yani görünür sıçrama olmaz.
   */
  catchFactor: 1.5,
  catchFloor: .18,
  /** Tahmin imleci son örneği geçtiğinde gecikme bu kadar aralık büyür (tampon açlığı). */
  underrunGrow: .5,
  /** Tahmin kırpması: `ViewpointAdapter`'ın örneklere uyguladığı sınırlar. */
  yawLimit: .65,
  pitchLimit: .25,
} as const;

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Açıyı −π..π aralığına sarar (yaw sınırı ±1,4 rad olsa da güvenlik için). */
export function wrapAngle(a: number): number {
  if (!Number.isFinite(a)) return 0;
  const x = (a + Math.PI) % TAU;
  return (x < 0 ? x + TAU : x) - Math.PI;
}

/** İki açı arasında KISA yoldan düz ara değer. */
export function lerpAngle(a: number, b: number, t: number): number {
  return wrapAngle(a + wrapAngle(b - a) * t);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Sıralanmış dağılımdan yüzdelik (en yakın örnek; küçük pencerelerde yeter). */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = clamp(Math.ceil(p * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[i]!;
}

/** Son `window` farkın medyanı: tek bir gecikmiş paket gecikmeyi bozmaz. */
export function sampleInterval(keys: readonly HeadKey[], fallback = HEAD_INTERP.defaultInterval): number {
  const gaps: number[] = [];
  for (let i = Math.max(1, keys.length - HEAD_INTERP.window); i < keys.length; i += 1) {
    const gap = keys[i]!.t - keys[i - 1]!.t;
    if (gap > 0) gaps.push(gap);
  }
  // Tek fark henüz ölçüm sayılmaz (ilk iki örnek arka arkaya gelebilir).
  if (gaps.length < 2) return clamp(fallback, HEAD_INTERP.minInterval, HEAD_INTERP.maxInterval);
  return clamp(median(gaps), HEAD_INTERP.minInterval, HEAD_INTERP.maxInterval);
}

/** Geri düşüş gecikmesi (yeterli geliş ölçümü yokken): bir aralık + %20 pay. */
export function renderDelay(interval: number, maxDelay: number = HEAD_INTERP.maxDelay): number {
  const want = interval * HEAD_INTERP.factor + HEAD_INTERP.margin;
  return clamp(want, HEAD_INTERP.minDelay, Math.max(HEAD_INTERP.minDelay, maxDelay));
}

/**
 * Tur 2 — SAPMAYA göre gecikme.
 * `spacings`: kayba göre normalize edilmiş geliş aralıkları (ms).
 * Yeterli örnek varsa p90 + pay (kayıp > %10 ise pay 60 → 150 ms); yoksa
 * tur 1 formülüne düşer. Alt sınır medyan × 1,1, üst sınır `maxDelay`.
 */
export function jitterDelay(
  spacings: readonly number[],
  lossRatio: number,
  maxDelay: number = HEAD_INTERP.maxDelay,
  fallbackInterval: number = HEAD_INTERP.defaultInterval,
): number {
  const cap = clamp(maxDelay, HEAD_INTERP.minDelay, HEAD_INTERP.maxDelay);
  const interval = spacings.length >= 2
    ? clamp(median(spacings), HEAD_INTERP.minInterval, HEAD_INTERP.maxInterval)
    : fallbackInterval;
  const margin = lossRatio > HEAD_INTERP.lossThreshold ? HEAD_INTERP.lossyMargin : HEAD_INTERP.jitterMargin;
  const want = spacings.length >= HEAD_INTERP.statMin
    ? percentile(spacings, HEAD_INTERP.jitterPercentile) + margin
    : renderDelay(interval, cap);
  const floor = Math.min(cap, Math.max(HEAD_INTERP.minDelay, interval * HEAD_INTERP.floorFactor));
  return clamp(want, floor, cap);
}

/** Gecikme artarken ANINDA, azalırken `delayFallTau` sabitiyle uygulanır. */
export function easeDelay(current: number, target: number, dt: number): number {
  if (!Number.isFinite(current)) return target;
  if (target >= current) return target;
  const k = dt > 0 ? 1 - Math.exp(-dt / HEAD_INTERP.delayFallTau) : 0;
  return current + (target - current) * k;
}

/**
 * Ara değerin üstüne binen üstel yumuşatmanın saniyelik katsayısı.
 * Gecikme aralığı kapatıyorsa ara değer zaten sürekli olduğundan yumuşatma
 * hızlıdır (ek gecikme yok); kapatmıyorsa (aralık > tavan) kalan küçük basamak
 * daha uzun bir sabitle yayılır.
 */
export function smoothingRate(interval: number, delay: number): number {
  const covered = delay >= interval * 1.05;
  const tau = covered ? HEAD_INTERP.smoothTau : clamp(interval / 4, HEAD_INTERP.coarseTauMin, HEAD_INTERP.coarseTauMax);
  return 1000 / tau;
}

/**
 * Tampondaki örneklerden `renderTime` anındaki pozu üretir.
 * - `renderTime` en eski örnekten önceyse en eski örnekte BEKLER,
 * - iki örnek arasındaysa düz ara değer (yaw sarmalı korunur),
 * - en yeni örneği geçtiyse: `predict` 0 ise orada DURUR, değilse son iki
 *   örneğin açısal hızıyla üstel sönümle (τ = `predict` × 0,5) en çok bir
 *   aralık kadar ilerler; ilerleme bir örnek adımını da aşamaz.
 */
export function poseAt(keys: readonly HeadKey[], renderTime: number, predict = 0): HeadPose | null {
  if (!keys.length) return null;
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (renderTime >= last.t) {
    const prev = keys[keys.length - 2];
    const span = prev ? last.t - prev.t : 0;
    if (!(predict > 0) || !prev || span <= 0) return { yaw: last.yaw, pitch: last.pitch, behind: false };
    const ahead = Math.min(renderTime - last.t, predict);
    const tau = Math.max(1, predict * HEAD_INTERP.predictTau);
    // Sönümlü etkin süre: τ·(1−e^(−Δ/τ)) ≤ 0,44 aralık; bir örnek adımını aşmaz.
    const eff = Math.min(tau * (1 - Math.exp(-ahead / tau)), span);
    const yaw = clamp(wrapAngle(last.yaw + (wrapAngle(last.yaw - prev.yaw) / span) * eff), -HEAD_INTERP.yawLimit, HEAD_INTERP.yawLimit);
    const pitch = clamp(last.pitch + ((last.pitch - prev.pitch) / span) * eff, -HEAD_INTERP.pitchLimit, HEAD_INTERP.pitchLimit);
    return { yaw, pitch, behind: renderTime - last.t < predict };
  }
  // Tek örnek varken beklenecek bir şey yok: kare istemi açılmaz.
  if (renderTime <= first.t) return { yaw: first.yaw, pitch: first.pitch, behind: keys.length > 1 };
  let i = 0;
  for (let j = 1; j < keys.length; j += 1) if (keys[j]!.t <= renderTime) i = j;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const span = b.t - a.t;
  const t = span > 0 ? clamp((renderTime - a.t) / span, 0, 1) : 1;
  return { yaw: lerpAngle(a.yaw, b.yaw, t), pitch: a.pitch + (b.pitch - a.pitch) * t, behind: true };
}

/**
 * İmlecin bulunduğu parçanın DOĞAL açısal hızı (rad/ms). Yakalama sınırı bunu
 * kullanır: kare farkı sıçramadan değil, gerçek hareketten türesin.
 */
function keySpeed(keys: readonly HeadKey[], renderTime: number): { yaw: number; pitch: number } {
  if (keys.length < 2) return { yaw: 0, pitch: 0 };
  let i = keys.length - 2;
  for (let j = 1; j < keys.length; j += 1) if (keys[j]!.t <= renderTime) i = Math.min(j, keys.length - 2);
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const span = b.t - a.t;
  if (!(span > 0)) return { yaw: 0, pitch: 0 };
  return { yaw: Math.abs(wrapAngle(b.yaw - a.yaw)) / span, pitch: Math.abs(b.pitch - a.pitch) / span };
}

/** Oyuncu başına örnek tamponu. Sıra `sequence` ile korunur; kopya düşer. */
export class HeadBuffer {
  private keys: HeadKey[] = [];
  private seq = Number.NEGATIVE_INFINITY;
  /** Okunan son render zamanı: ölçülen aralık değişince imleç GERİ gitmez. */
  private cursor = Number.NEGATIVE_INFINITY;
  private lastNow = Number.NEGATIVE_INFINITY;
  /** Kayba göre normalize edilmiş geliş aralıkları ve aynı sırada kayıp sayıları. */
  private spacings: number[] = [];
  private losses: number[] = [];
  /** Örneğin geldiği an ile damgası arasındaki fark (taşıma gecikmesi + saat farkı). */
  private lateness: number[] = [];
  private prevArrival = Number.NEGATIVE_INFINITY;
  /** Yumuşatılmış gecikme (artışta anında, düşüşte yavaş). */
  private held = Number.NaN;
  /** Tampon açlığı (tahmine düşme) görülünce istenen ek gecikme. */
  private demand = 0;
  /** Yayınlanan poz (yakalama hız sınırı buradan işler). */
  private emitted: { yaw: number; pitch: number } | null = null;

  /**
   * Yeni örneği ekler; aynı ya da eski `sequence` yok sayılır (false döner).
   * `t` örneğin damgası (render saatine çevrilmiş), `arrivedAt` paketin YEREL
   * geliş anıdır — sapma ve kayıp istatistiği geliş anlarından çıkar.
   */
  push(sequence: number, t: number, yaw: number, pitch: number, arrivedAt: number = t): boolean {
    if (!Number.isFinite(sequence) || !(sequence > this.seq) || ![t, yaw, pitch].every(Number.isFinite)) return false;
    this.seq = sequence;
    const arrival = Number.isFinite(arrivedAt) ? arrivedAt : t;
    const gap = Number.isFinite(this.prevArrival) ? arrival - this.prevArrival : 0;
    // Kayıp sezimi: bu protokolde `sequence` paketin GELİŞ damgasıdır
    // (`acceptHeadWire` `t = now` yazar), yani seq boşluğu geliş boşluğudur.
    // Ölçülen medyanın 1,6 katından uzun bir boşluk atlanmış paket demektir:
    // aralık slot sayısına BÖLÜNÜR, istatistik kayıp yüzünden şişmez. Bölme
    // yalnız UZUN boşluklara uygulanır; yoksa tek bir kısa aralık ölçümü
    // aşağı çeker ve her boşluk daha çok slota bölünerek tahmin çöker.
    const base = this.spacings.length >= 2 ? median(this.spacings) : 0;
    const slots = base > 0 && gap > base * 1.6 ? clamp(Math.round(gap / base), 2, HEAD_INTERP.idleSlots + 1) : 1;
    // Boşta kalma (uzun sessizlik) kayıp değildir; çok kısa boşluk da (yeniden
    // bağlanma yığını) ölçüm sayılmaz.
    if (gap >= HEAD_INTERP.minInterval && slots <= HEAD_INTERP.idleSlots) {
      this.spacings.push(gap / slots);
      this.losses.push(slots - 1);
      if (this.spacings.length > HEAD_INTERP.statWindow) {
        this.spacings.splice(0, this.spacings.length - HEAD_INTERP.statWindow);
        this.losses.splice(0, this.losses.length - HEAD_INTERP.statWindow);
      }
    }
    this.prevArrival = arrival;
    this.lateness.push(Math.max(0, arrival - t));
    if (this.lateness.length > HEAD_INTERP.statWindow) this.lateness.splice(0, this.lateness.length - HEAD_INTERP.statWindow);

    const prev = this.keys[this.keys.length - 1];
    // Uzun sessizlikten sonra gelen örnek eski poza BAĞLANMAZ: 4 s'lik bir
    // boşluğu ara değerle taramak yavaş kayma + sonunda sıçrama demektir.
    if (prev && t - prev.t > Math.max(sampleInterval(this.keys) * HEAD_INTERP.resumeGap, HEAD_INTERP.maxDelay)) {
      this.keys.length = 0; this.cursor = Number.NEGATIVE_INFINITY;
    }
    const head = this.keys[this.keys.length - 1];
    // Damgayı gönderim ızgarasına oturt: geliş sapması ara değeri hızlandırıp
    // yavaşlatmasın. Kayıp slot da ızgarada yerini korur, yani iki katlık adım
    // iki aralığa yayılır (kayıpta hızlanma yok).
    let key = t;
    if (head && slots <= HEAD_INTERP.idleSlots) {
      const grid = head.t + slots * this.interval;
      key = grid + (t - grid) * HEAD_INTERP.gridPull;
    }
    this.keys.push({ t: head && key <= head.t ? head.t + 1 : key, yaw, pitch });
    if (this.keys.length > HEAD_INTERP.capacity) this.keys.splice(0, this.keys.length - HEAD_INTERP.capacity);
    return true;
  }

  get size(): number { return this.keys.length; }
  get samples(): readonly HeadKey[] { return this.keys; }
  /** Aralık: ölçülen geliş aralıklarının medyanı, yoksa damga farklarının medyanı. */
  get interval(): number {
    if (this.spacings.length >= 2) return clamp(median(this.spacings), HEAD_INTERP.minInterval, HEAD_INTERP.maxInterval);
    return sampleInterval(this.keys);
  }
  /** Pencere içindeki kayıp oranı (kayıp / beklenen paket). */
  get lossRatio(): number {
    if (!this.losses.length) return 0;
    let lost = 0;
    for (const n of this.losses) lost += n;
    return lost / (lost + this.losses.length);
  }
  /**
   * Taşıma gecikmesi tahmini: pencere içindeki EN KÜÇÜK gecikme (saat farkı +
   * en iyi yol). Render imleci bu kadar daha geriden okunur; yoksa gönderen
   * saati geride olduğunda imleç örneklerin önüne düşer ve baş her pakette
   * sıçrardı.
   */
  get transport(): number {
    if (!this.lateness.length) return 0;
    let min = Number.POSITIVE_INFINITY;
    for (const v of this.lateness) min = Math.min(min, v);
    return Number.isFinite(min) ? Math.max(0, min) : 0;
  }
  /** Sapmaya göre hedef gecikme (yumuşatma öncesi) + tampon açlığı payı. */
  targetDelay(maxDelay: number = HEAD_INTERP.maxDelay): number {
    const want = jitterDelay(this.spacings, this.lossRatio, maxDelay, this.interval);
    return Math.max(want, Math.min(clamp(maxDelay, HEAD_INTERP.minDelay, HEAD_INTERP.maxDelay), this.demand));
  }
  /** Uygulanan (yumuşatılmış) gecikme. */
  delay(maxDelay: number = HEAD_INTERP.maxDelay): number {
    return Number.isFinite(this.held) ? this.held : this.targetDelay(maxDelay);
  }
  /** Son okunan render imleci (test/ölçüm için). */
  get cursorTime(): number { return this.cursor; }

  /**
   * `now` render saatidir; poz `now − taşıma − gecikme` anından okunur.
   * İmleç geri gitmez ve gecikme değişimi hızını gerçek zamanın ±%20'sinden
   * fazla oynatmaz: sapma ölçümü değişince kare atlamaz ya da donmaz.
   * `predict` kapalıysa son örnekte durur (`reducedMotion` yolu).
   */
  poseAt(now: number, maxDelay: number = HEAD_INTERP.maxDelay, predict = true): HeadPose | null {
    const elapsed = clamp(Number.isFinite(this.lastNow) ? now - this.lastNow : 0, 0, 1000);
    this.lastNow = now;
    this.held = easeDelay(this.held, this.targetDelay(maxDelay), elapsed);
    const want = now - this.transport - this.held;
    if (!Number.isFinite(this.cursor)) this.cursor = want;
    else this.cursor = clamp(want, this.cursor + elapsed * (1 - HEAD_INTERP.cursorSlack), this.cursor + elapsed * (1 + HEAD_INTERP.cursorSlack));
    const interval = this.interval;
    const raw = poseAt(this.keys, this.cursor, predict ? interval : 0);
    if (!raw) { this.emitted = null; return null; }
    // Tampon açlığı: imleç son örneği geçtiyse gecikme bir sonraki karede büyür.
    const last = this.keys[this.keys.length - 1]!;
    this.demand = this.cursor > last.t ? Math.min(HEAD_INTERP.maxDelay, this.held + interval * HEAD_INTERP.underrunGrow) : 0;
    if (!this.emitted) { this.emitted = { yaw: raw.yaw, pitch: raw.pitch }; return raw; }
    // Yakalama hız sınırı: hedef sıçrasa bile poz doğal hızın birkaç katından
    // hızlı gitmez (kare farkı görünür sıçrama olmaz).
    const floor = HEAD_INTERP.catchFloor * (elapsed / 1000);
    const speed = keySpeed(this.keys, this.cursor);
    const stepYaw = speed.yaw * elapsed * HEAD_INTERP.catchFactor + floor;
    const stepPitch = speed.pitch * elapsed * HEAD_INTERP.catchFactor + floor;
    const errYaw = wrapAngle(raw.yaw - this.emitted.yaw);
    const errPitch = raw.pitch - this.emitted.pitch;
    this.emitted = {
      yaw: wrapAngle(this.emitted.yaw + clamp(errYaw, -stepYaw, stepYaw)),
      pitch: this.emitted.pitch + clamp(errPitch, -stepPitch, stepPitch),
    };
    // Yakalama sürerken de kare istenir (frameloop="demand" erken durmasın).
    const settling = Math.abs(wrapAngle(raw.yaw - this.emitted.yaw)) > 1e-4 || Math.abs(raw.pitch - this.emitted.pitch) > 1e-4;
    return { yaw: this.emitted.yaw, pitch: this.emitted.pitch, behind: raw.behind || settling };
  }
  rate(maxDelay: number = HEAD_INTERP.maxDelay): number { return smoothingRate(this.interval, this.delay(maxDelay)); }
}
