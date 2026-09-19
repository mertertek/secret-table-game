// @vitest-environment jsdom
/**
 * Otomatik kalite kademesi (PERF-C1 §4/4) ve tercih yükleme.
 *
 * jsdom'da `matchMedia` ve `navigator` alanları taklit edilir; her testte
 * eski hâline döndürülür.
 */
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autoQuality, defaultCameraMode, usePrefs } from './usePrefs';

/** jsdom bu kurulumda `localStorage` sağlamıyor; belirlenimci bellek deposu. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

type Fake = { pointerCoarse?: boolean; deviceMemory?: number; hardwareConcurrency?: number; throws?: boolean };
const restore: (() => void)[] = [];

function stub({ pointerCoarse = false, deviceMemory, hardwareConcurrency, throws = false }: Fake) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: (query: string) => {
      if (throws) throw new Error('matchMedia yok');
      return { matches: query.includes('pointer: coarse') ? pointerCoarse : false, media: query };
    },
  });
  restore.push(() =>
    previous ? Object.defineProperty(globalThis, 'matchMedia', previous) : delete (globalThis as Record<string, unknown>).matchMedia,
  );
  for (const [key, value] of Object.entries({ deviceMemory, hardwareConcurrency })) {
    const own = Object.getOwnPropertyDescriptor(navigator, key);
    Object.defineProperty(navigator, key, { configurable: true, value });
    restore.push(() => {
      if (own) Object.defineProperty(navigator, key, own);
      else delete (navigator as unknown as Record<string, unknown>)[key];
    });
  }
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => {
  cleanup();
  while (restore.length) restore.pop()!();
  vi.unstubAllGlobals();
});

describe('autoQuality', () => {
  it('güçlü masaüstünde standard kalır', () => {
    stub({ deviceMemory: 8, hardwareConcurrency: 10 });
    expect(autoQuality()).toBe('standard');
  });

  it('dokunmatik (pointer: coarse) cihazda low', () => {
    stub({ pointerCoarse: true, deviceMemory: 8, hardwareConcurrency: 10 });
    expect(autoQuality()).toBe('low');
  });

  it('bellek 4 GB veya altındaysa low', () => {
    stub({ deviceMemory: 4, hardwareConcurrency: 10 });
    expect(autoQuality()).toBe('low');
  });

  it('çekirdek sayısı 4 veya altındaysa low', () => {
    stub({ deviceMemory: 8, hardwareConcurrency: 4 });
    expect(autoQuality()).toBe('low');
  });

  it('bilgi yoksa (undefined) standard', () => {
    stub({});
    expect(autoQuality()).toBe('standard');
  });

  it('matchMedia hata verirse standard', () => {
    stub({ throws: true, deviceMemory: 8, hardwareConcurrency: 8 });
    expect(autoQuality()).toBe('standard');
  });
});

describe('usePrefs yükleme', () => {
  it('kayıt yokken zayıf cihazda low ile açılır ve saklanır', () => {
    stub({ pointerCoarse: true, deviceMemory: 4, hardwareConcurrency: 4 });
    const { result } = renderHook(() => usePrefs());
    expect(result.current[0].quality).toBe('low');
    expect(JSON.parse(localStorage.getItem('secret-table:prefs')!).quality).toBe('low');
  });

  it('kullanıcının kayıtlı seçimi otomatik kademenin önündedir', () => {
    stub({ pointerCoarse: true, deviceMemory: 2, hardwareConcurrency: 2 });
    localStorage.setItem(
      'secret-table:prefs',
      JSON.stringify({ quality: 'standard', reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode: 'seat' }),
    );
    const { result } = renderHook(() => usePrefs());
    expect(result.current[0].quality).toBe('standard');
  });

  it('D12 tur 4 — ses varsayılan açık, kayıtlı kapalı tercih korunur', () => {
    stub({});
    const { result } = renderHook(() => usePrefs());
    expect(result.current[0].soundEnabled).toBe(true);
    cleanup();
    localStorage.setItem('secret-table:prefs', JSON.stringify({ soundEnabled: false }));
    const stored = renderHook(() => usePrefs());
    expect(stored.result.current[0].soundEnabled).toBe(false);
  });

  it('kayıtta kalite alanı yoksa cihaz tahmini kullanılır', () => {
    stub({ pointerCoarse: true, deviceMemory: 2, hardwareConcurrency: 2 });
    localStorage.setItem('secret-table:prefs', JSON.stringify({ soundEnabled: true }));
    const { result } = renderHook(() => usePrefs());
    expect(result.current[0].quality).toBe('low');
    expect(result.current[0].soundEnabled).toBe(true);
  });
});

describe('varsayılan kamera', () => {
  it('geniş ekranda koltuk', () => {
    expect(defaultCameraMode()).toBe(globalThis.innerWidth < 768 ? 'overview' : 'seat');
  });
});
