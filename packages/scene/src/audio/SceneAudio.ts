/** Original procedural foley. No downloads, microphone, role-specific timbre or audio queue. */
export type SoundKind = 'paper' | 'turn' | 'wood' | 'end' | 'select' | 'shot' | 'clap';
export type AudioStats = { state: string; played: number; voices: number };
export class SceneAudio {
  private context: AudioContext | undefined;
  private voices = new Set<AudioBufferSourceNode>();
  private enabled = false;
  private disposed = false;
  private played = 0;
  constructor(private report: (stats: AudioStats) => void = () => {}) {}
  private notify() { this.report({ state: this.context?.state ?? 'locked', played: this.played, voices: this.voices.size }); }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.stop(); this.notify(); }
  /** Called only in a trusted pointer/keyboard/click event, including while muted. */
  unlock() {
    if (this.disposed || typeof AudioContext === 'undefined') return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().then(() => this.notify()).catch(() => this.notify());
      this.notify();
    } catch { this.notify(); }
  }
  play(kind: SoundKind) {
    const ctx = this.context;
    // Never defer a missed sound until audio is unlocked.
    if (!this.enabled || !ctx || ctx.state !== 'running' || this.disposed || this.voices.size >= 4) return;
    const samples = makeSound(kind, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    const node = ctx.createBufferSource(); node.buffer = buffer; node.connect(ctx.destination);
    this.voices.add(node); this.played++; node.onended = () => { node.disconnect(); this.voices.delete(node); this.notify(); };
    node.start(); this.notify();
  }
  stop() { for (const voice of this.voices) { voice.onended = null; voice.stop(); voice.disconnect(); } this.voices.clear(); this.notify(); }
  dispose() { this.disposed = true; this.stop(); if (this.context) void this.context.close().catch(() => {}); }
}

/** Deterministic, short and softly enveloped; every value remains below clipping. */
export function makeSound(kind: SoundKind, sampleRate: number): Float32Array<ArrayBuffer> {
  // D12 §4 `shot`: 12 ms gürültü patlaması + 90 Hz vuruş; toplam ≤ .12 s ve
  // tepe genliği `end`in altında (oyuncak ton, gerçek silah değil).
  if (kind === 'shot') return makeShot(sampleRate);
  // D16 §2 `clap`: yumuşak ÇİFT vuruş (el çırpma), tepe ≤ .35.
  if (kind === 'clap') return makeClap(sampleRate);
  const duration = kind === 'end' ? .65 : kind === 'paper' ? .19 : kind === 'turn' ? .16 : kind === 'wood' ? .14 : .055;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = 731; let previous = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate; const p = t / duration;
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const noise = (seed >>> 0) / 2147483648 - 1;
    const smooth = previous * .72 + noise * .28; previous = smooth;
    const envelope = Math.min(1, t / .008) * (1 - p) ** 2;
    const tone = kind === 'end' ? (Math.sin(2 * Math.PI * 392 * t) + Math.sin(2 * Math.PI * 523.25 * t)) * .025 :
      kind === 'wood' ? Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 35) * .09 + smooth * .035 :
      kind === 'select' ? Math.sin(2 * Math.PI * 740 * t) * .035 :
      smooth * (kind === 'paper' ? .17 : .12) * (.65 + .35 * Math.sin(t * 95));
    samples[i] = tone * envelope;
  }
  return samples;
}

/**
 * D16 — alkış: iki avucun çarpması. Her vuruş 6 ms'lik gürültü transienti +
 * hızla kapanan alçak geçiren gövde (avuç boşluğu ~700 Hz) ve 95 ms arayla
 * ikinci, biraz daha sönük vuruş. Silah sesinin aksine tok değil "şak"tır;
 * son normalizasyon tepeyi 0,32'de tutar (tasarım: ≤ .35).
 */
export function makeClap(sampleRate: number): Float32Array<ArrayBuffer> {
  const duration = .26, gap = .095;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = 613, lowpass = 0, band = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const noise = (seed >>> 0) / 2147483648 - 1;
    lowpass += (noise - lowpass) * .45;
    band = noise - lowpass;
    let value = 0;
    for (const [at, gain] of [[0, 1], [gap, .7]] as const) {
      const dt = t - at;
      if (dt < 0) continue;
      // 6 ms transient + 45 ms kuyruk; avuç boşluğu rezonansı 700 Hz.
      const crack = Math.exp(-dt / .006) * band * .9;
      const body = Math.exp(-dt / .045) * (band * .35 + Math.sin(2 * Math.PI * 700 * dt) * .10);
      value += (crack + body) * gain;
    }
    samples[i] = value * Math.min(1, t / .0005) * (1 - t / duration) ** 1.5;
  }
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const gain = peak > 0 ? .32 / peak : 1;
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! * gain;
  return samples;
}

/**
 * D12 §4 (tur 4) — infaz atışı: eski 0,12 s'lik "çıt" sesi zayıf kalıyordu.
 * Yeni zarf: 8 ms sert transient (beyaz gürültü) + 110 → 70 Hz düşen "thump"
 * (120 ms) + alçak geçiren süzgeci kapanan gürültü kuyruğu (250 ms) + iki
 * gecikmeli kopya (45 ms −8 dB, 90 ms −14 dB) ile kısa yankı.
 *
 * Tepe seviyesi `end`den yüksek ama KIRPMA YOK: son normalizasyon 0,6'da tutar.
 */
export function makeShot(sampleRate: number): Float32Array<ArrayBuffer> {
  const duration = .40, tail = .25, thump = .12, transient = .008;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = 977; let lowpass = 0;
  const direct = new Float32Array(samples.length);
  for (let i = 0; i < direct.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const noise = (seed >>> 0) / 2147483648 - 1;
    // Kuyruk: tek kutuplu süzgeç açıktan (0,9) kapalıya (0,06) kayar.
    const open = Math.max(.06, .9 * (1 - t / tail));
    lowpass += (noise - lowpass) * open;
    const crack = t < transient * 3 ? noise * Math.exp(-t / (transient / 2)) * .95 : 0;
    const body = t < tail ? lowpass * .55 * (1 - t / tail) ** 2 : 0;
    // Düşen vuruş: 110 → 70 Hz.
    const hz = 110 - 40 * Math.min(1, t / thump);
    const low = Math.sin(2 * Math.PI * hz * t) * .8 * Math.exp(-t / (thump / 2.2));
    direct[i] = (crack + body + low) * Math.min(1, t / .0006);
  }
  // Kısa yankı: iki gecikmeli, süzülmüş kopya.
  const echoes: readonly (readonly [number, number])[] = [[.045, .4], [.09, .2]];
  for (let i = 0; i < samples.length; i++) {
    let value = direct[i]!;
    for (const [delay, gain] of echoes) {
      const j = i - Math.round(delay * sampleRate);
      if (j >= 0) value += direct[j]! * gain;
    }
    samples[i] = value;
  }
  // Kırpma yerine ölçek: tepe 0,6.
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const gain = peak > 0 ? .6 / peak : 1;
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! * gain;
  return samples;
}

