// @vitest-environment jsdom
/**
 * D23/D28 — dil tercihinin ayrıştırılması ve geri uyumluluk.
 *
 * Eski kayıtta `language` alanı YOKTUR; o durumda varsayılan dil kullanılır
 * (D28: İNGİLİZCE; tarayıcı diline bakılmaz) ve diğer alanlar bozulmaz.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { DEFAULT_LANGUAGE, currentLanguage, setLanguage } from '../i18n';
import { usePrefs } from './usePrefs';

const KEY = 'secret-table:prefs';

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

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memoryStorage(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  // Diğer testler kaynak dilde (Türkçe) koşar; kurulum dosyasıyla aynı durum.
  setLanguage('tr');
});

describe('usePrefs.language', () => {
  it('kayıtlı dil tercihi okunur ve i18n deposuna uygulanır', () => {
    localStorage.setItem(KEY, JSON.stringify({ quality: 'low', language: 'en' }));
    const { result } = renderHook(() => usePrefs());
    expect(result.current[0].language).toBe('en');
    expect(result.current[0].quality).toBe('low');
    expect(currentLanguage()).toBe('en');
  });

  it('geçersiz dil değeri o anki dile düşer, diğer alanlar korunur', () => {
    localStorage.setItem(KEY, JSON.stringify({ language: 'de', soundEnabled: false }));
    const { result } = renderHook(() => usePrefs());
    expect(result.current[0].language).toBe(currentLanguage());
    expect(result.current[0].soundEnabled).toBe(false);
  });

  it('alanı olmayan eski kayıt diğer alanları bozmaz', () => {
    localStorage.setItem(KEY, JSON.stringify({ soundEnabled: false, sensitivity: 2 }));
    const { result } = renderHook(() => usePrefs());
    expect(result.current[0].soundEnabled).toBe(false);
    expect(result.current[0].sensitivity).toBe(2);
  });

  it('D28 — kayıt yokken ve tarayıcı Türkçe bildirse bile varsayılan İngilizcedir', () => {
    Object.defineProperty(globalThis.navigator, 'languages', { configurable: true, get: () => ['tr-TR', 'tr'] });
    // Üretim açılışındaki durum: i18n deposu varsayılanda, kayıt yok.
    setLanguage(DEFAULT_LANGUAGE);
    const { result } = renderHook(() => usePrefs());
    expect(result.current[0].language).toBe('en');
    expect(currentLanguage()).toBe('en');
  });

  it('dil değiştirmek anında uygulanır ve saklanır', () => {
    const { result } = renderHook(() => usePrefs());
    act(() => result.current[1]({ language: 'en' }));
    expect(currentLanguage()).toBe('en');
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').language).toBe('en');
  });
});
