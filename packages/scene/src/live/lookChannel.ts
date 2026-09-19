import type { Look } from '../prototype/model';

/** Bakış (yaw/pitch) React state'i DEĞİLDİR (PERF-C1 §4).
 *
 * Sürükleme/Pointer Lock her karede bakışı değiştirir; bunu `useState` ile
 * tutmak kare başına bütün sahne ağacını yeniden render ediyordu. Bakış burada
 * ref gibi saklanır: kamera `useFrame` içinde `current` okur, her yazma
 * `invalidate()` ile tek bir kare ister. Ağ/uygulama bildirimi (`onLook`)
 * rAF başına en fazla bir kez yapılır; eşik ve `clampViewpoint` çağıran tarafta.
 */
export class LookChannel {
  current: Look;
  /** Canvas içindeki köprü atar (R3F `invalidate`); Canvas yokken null. */
  invalidate: (() => void) | null = null;
  private handle: number | null = null;
  private readonly raf: (cb: () => void) => number;
  private readonly caf: (handle: number) => void;
  constructor(
    initial: Look,
    raf: (cb: () => void) => number = (cb) => requestAnimationFrame(cb),
    caf: (handle: number) => void = (handle) => cancelAnimationFrame(handle),
  ) {
    this.current = initial; this.raf = raf; this.caf = caf;
  }
  /** Bakışı hemen günceller (kare ister) ve `flush`'ı rAF başına bir kez çağırır. */
  set(next: Look, flush?: (look: Look) => void) {
    this.current = next;
    this.invalidate?.();
    if (!flush || this.handle !== null) return;
    this.handle = this.raf(() => { this.handle = null; flush(this.current); });
  }
  /** Bekleyen rAF varsa iptal eder (unmount). */
  dispose() { if (this.handle !== null) this.caf(this.handle); this.handle = null; }
  get pending() { return this.handle !== null; }
}
