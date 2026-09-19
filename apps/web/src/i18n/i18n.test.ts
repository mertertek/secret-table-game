/**
 * D23 — iki dilin anahtar kümesi ve `t()` davranışı.
 *
 * Türkçe KAYNAK dildir: `en.ts` aynı anahtarları uygulamak zorundadır (tip
 * düzeyinde `satisfies`, çalışma anında burada). Ayrıca hiçbir İngilizce değer
 * boş olamaz ve Türkçe'ye özgü harf taşıyamaz — çeviri unutulmuş satırı yakalar.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  currentLanguage,
  DEFAULT_LANGUAGE,
  en,
  format,
  isLanguage,
  setLanguage,
  t,
  tIn,
  tr,
} from './index';

const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;

afterEach(() => {
  setLanguage('tr');
});

describe('i18n sözlükleri', () => {
  it('tr ve en anahtar kümeleri birebir aynı', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });

  it('hiçbir metin boş değil', () => {
    for (const [key, value] of Object.entries(tr)) expect(value.trim(), key).not.toBe('');
    for (const [key, value] of Object.entries(en)) expect(value.trim(), key).not.toBe('');
  });

  it('İngilizce değerler Türkçe özel karakter taşımaz', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(TURKISH_LETTERS.test(value), `${key}: ${value}`).toBe(false);
    }
  });

  it('aynı anahtarın parametreleri iki dilde de aynıdır', () => {
    const params = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(tr) as (keyof typeof tr)[]) {
      expect(params(en[key]), key).toEqual(params(tr[key]));
    }
  });
});

describe('t() ve format()', () => {
  it('{param} yer tutucularını doldurur', () => {
    expect(format('{a} ve {b}', { a: 'bir', b: 2 })).toBe('bir ve 2');
  });

  it('verilmeyen parametreyi olduğu gibi bırakır', () => {
    expect(format('{a} ve {b}', { a: 'bir' })).toBe('bir ve {b}');
  });

  it('parametresiz çağrıda şablonu aynen döndürür', () => {
    expect(format('düz metin')).toBe('düz metin');
  });

  it('varsayılan dil Türkçe ve t() o dilden okur', () => {
    expect(currentLanguage()).toBe('tr');
    expect(t('phase.voting')).toBe('Oylama');
  });

  it('setLanguage anında dili değiştirir', () => {
    setLanguage('en');
    expect(currentLanguage()).toBe('en');
    expect(t('phase.voting')).toBe('Election');
  });

  it('tIn belirtilen dilden okur, geçerli dili değiştirmez', () => {
    expect(tIn('en', 'power.execution')).toBe('Execution');
    expect(currentLanguage()).toBe('tr');
  });

  it('parametreli anahtar iki dilde de dolar', () => {
    expect(t('status.tally', { yes: 4, no: 3 })).toBe('Evet 4 · Hayır 3');
    expect(tIn('en', 'status.tally', { yes: 4, no: 3 })).toBe('Ja 4 · Nein 3');
  });
});

describe('isLanguage / varsayılan dil', () => {
  it('yalnız tr ve en geçerlidir', () => {
    expect(isLanguage('tr')).toBe(true);
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('de')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });

  it('D28 — varsayılan dil İngilizcedir (tarayıcı diline bakılmaz)', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });
});
