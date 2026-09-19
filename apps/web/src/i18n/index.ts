/**
 * D23 — iki dilli metin katmanı (kütüphane yok).
 *
 * Dil OYUNCUYA aittir, odaya değil: sunucu ve sözleşme dil bilmez, yalnız kod
 * gönderir (`phase`, `power`, `errorCode`, cue `kind`). Görünen bütün metin
 * burada üretilir; aynı masada bir oyuncu Türkçe, öteki İngilizce görebilir.
 *
 * `tr.ts` KAYNAK dildir ve hiçbir metni silinmez; `en.ts` aynı anahtar kümesini
 * uygulamak ZORUNDADIR (`satisfies Record<TextKey, string>` derlemede yakalar).
 */

import { useCallback, useSyncExternalStore } from 'react';

import { en } from './en';
import { tr } from './tr';

export const LANGUAGES = ['tr', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export type TextKey = keyof typeof tr;

const TABLES: Readonly<Record<Language, Readonly<Record<TextKey, string>>>> = { tr, en };

export function isLanguage(value: unknown): value is Language {
  return value === 'tr' || value === 'en';
}

/**
 * D28 — VARSAYILAN DİL İNGİLİZCE. Depo ve ön izleme herkese açık olduğu için
 * uygulama her ziyaretçide İngilizce açılır; tarayıcı diline BAKILMAZ. Türkçe
 * isteyen giriş ekranındaki TR/EN anahtarından ya da oyun içi menüden seçer,
 * seçim `usePrefs` ile tarayıcıda kalıcıdır. Dil oyuncuya aittir, odaya değil.
 */
export const DEFAULT_LANGUAGE: Language = 'en';

let current: Language = DEFAULT_LANGUAGE;
const listeners = new Set<() => void>();

/**
 * Belge dili. `text-transform: uppercase` DİLE bağlıdır: `lang="tr"` iken
 * tarayıcı "invite" → "İNVİTE" yapar. Bu yüzden kök `lang` seçilen dille
 * birlikte güncellenir (erişilebilirlik ve ekran okuyucu için de doğrusu).
 */
function applyDocumentLanguage(language: Language): void {
  try {
    globalThis.document?.documentElement?.setAttribute('lang', language);
  } catch {
    /* DOM yok (test / SSR) */
  }
}

export function currentLanguage(): Language {
  return current;
}

/** Dili değiştirir ve abone bileşenleri anında yeniden çizer (yenileme yok). */
export function setLanguage(next: Language): void {
  applyDocumentLanguage(next);
  if (next === current) return;
  current = next;
  for (const listener of [...listeners]) listener();
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `{param}` yer tutucularını doldurur. Bilinmeyen parametre olduğu gibi kalır. */
export function format(template: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Anahtar → o anki dildeki metin. Anahtar yoksa Türkçe kaynağa düşer. */
export function t(
  key: TextKey,
  params?: Readonly<Record<string, string | number>>,
  language: Language = current,
): string {
  const table = TABLES[language] ?? tr;
  return format(table[key] ?? tr[key] ?? key, params);
}

/** Verilen dildeki metin (dil propu alan bileşenler / test için). */
export function tIn(
  language: Language,
  key: TextKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  return t(key, params, language);
}

export { tr, en };

// ---------------------------------------------------------------------------
// React bağlayıcı
// ---------------------------------------------------------------------------

/**
 * Dil değişimini dinleyen çeviri kancası. Dönen `t` o anki dile bağlıdır;
 * `setLanguage` çağrılınca kancayı kullanan her bileşen yeniden çizilir.
 */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, currentLanguage, currentLanguage);
}

export function useT(): (key: TextKey, params?: Readonly<Record<string, string | number>>) => string {
  const language = useLanguage();
  return useCallback(
    (key: TextKey, params?: Readonly<Record<string, string | number>>) => t(key, params, language),
    [language],
  );
}
