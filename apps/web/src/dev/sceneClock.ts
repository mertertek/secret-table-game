/**
 * YALNIZ `/dev/*` sayfaları — cue zamanını dondurma (D12 görsel kanıt aracı).
 *
 * Sahne koreografileri `performance.now()` okur. `?t=1300` ile açılan bir dev
 * sayfasında saat sayfa açılır açılmaz DONDURULUR (her okuma aynı değeri verir),
 * sahne cue'yu kabul ettikten sonra istenen ana ilerletilir ve orada kalır.
 * Böylece kare tam olarak koreografinin o milisaniyesini gösterir.
 *
 * Üretim yollarına dokunmaz: `routes.tsx` bu sayfaları yalnız `import.meta.env.DEV`
 * altında bağlar ve bu modülü başka hiçbir yer içe aktarmaz.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let base: number | undefined;
let offset = 0;

/** Saati dondurur (yalnız ilk çağrıda); sonraki çağrılar yalnız anı değiştirir. */
export function freezeSceneClock(initial = 0): void {
  if (base !== undefined) {
    setSceneClock(initial);
    return;
  }
  const real = performance.now.bind(performance);
  base = real();
  offset = Math.max(0, initial);
  performance.now = () => base! + offset;
  Object.defineProperty(window, 'sceneClock', {
    configurable: true,
    value: { set: setSceneClock, get: () => offset },
  });
}

/** Dondurulmuş saati cue başlangıcından `ms` sonrasına taşır ve aboneleri uyarır. */
export function setSceneClock(ms: number): void {
  if (base === undefined) return;
  offset = Math.max(0, ms);
  for (const listener of [...listeners]) listener();
}

export function subscribeSceneClock(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `?t=` değeri; sayı değilse `null`. */
export function frozenTime(value: string | null): number | null {
  if (value === null) return null;
  const ms = Number(value);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}
