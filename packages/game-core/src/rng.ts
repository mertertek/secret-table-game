/**
 * Belirlenimci sözde-rastgele üreteç (mulberry32) + Fisher-Yates karıştırma.
 *
 * Motor saf olmalı: aynı tohum + aynı komut dizisi -> aynı sonuç. Sunucu her
 * oyunda bir tohum üretip saklar; testler sabit tohum verir.
 */

export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Yeni bir dizi döndürür; girişi değiştirmez. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
