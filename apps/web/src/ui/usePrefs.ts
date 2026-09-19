import { useCallback, useEffect, useState } from 'react';
import type { SceneQuality } from '@secret-table/contracts';

import { currentLanguage, isLanguage, setLanguage, type Language } from '../i18n';

/**
 * Görsel/ses/kontrol tercihleri; yeniden girişte korunur (docs/QA.md § 6).
 * `prefers-reduced-motion` sistem tercihi başlangıç değeri olur.
 */
export type Prefs = {
  quality: SceneQuality;
  reducedMotion: boolean;
  soundEnabled: boolean;
  /** Pointer Lock bakış hassasiyeti çarpanı (CODEX-017/4). */
  sensitivity: number;
  /**
   * Varsayılan kamera (ROADMAP A2/8). Masaüstünde kendi koltuğu; dar ekranda
   * (genişlik < 768) genel masa. `V` ile değişir ve burada saklanır.
   */
  cameraMode: 'overview' | 'seat';
  /**
   * Ekran ortası faz/olay duyuruları (ROADMAP D9). Varsayılan açık; kapalıyken
   * katman hiç çizilmez, üst bilgi şeridi tek başına yeter.
   */
  announcements: boolean;
  /**
   * Tam ekrana ilk girişte gösterilen tuş ipucu görüldü mü (ROADMAP D11).
   * Bir kez gösterilir; sonraki girişlerde sessiz kalır.
   */
  fullscreenHintSeen: boolean;
  /**
   * D23/D28 — arayüz dili. Dil ODAYA değil OYUNCUYA aittir; sunucuya gitmez.
   * Kayıt yoksa varsayılan İngilizcedir (`DEFAULT_LANGUAGE`); tarayıcı diline bakılmaz.
   */
  language: Language;
};

const KEY = 'secret-table:prefs';

/** Fare hassasiyeti sınırları — UI kaydırıcısı ve saklanan değer aynı aralıkta. */
export const SENSITIVITY_MIN = 0.2;
export const SENSITIVITY_MAX = 3;

/** Bu genişliğin altında varsayılan kamera genel masadır (küçük ekran). */
export const SEAT_CAMERA_MIN_WIDTH = 768;

export function clampSensitivity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, n));
}

function systemReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Kayıtlı tercih yokken ilk açılış kalitesi (PERF-C1 §4/4).
 *
 * Dokunmatik ya da zayıf cihazda `low` başlanır: `standard` retina + gölge
 * telefon GPU'sunda pahalıdır. Kullanıcının menüden seçtiği değer saklanır ve
 * her zaman bu tahminin önüne geçer.
 */
export function autoQuality(): SceneQuality {
  try {
    const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
    const nav = globalThis.navigator as (Navigator & { deviceMemory?: number }) | undefined;
    const memory = typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null;
    const cores = typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null;
    const weak = (memory !== null && memory <= 4) || (cores !== null && cores > 0 && cores <= 4);
    return coarse || weak ? 'low' : 'standard';
  } catch {
    return 'standard';
  }
}

/** Masaüstünde 'seat', küçük ekranda 'overview' (ROADMAP A2/8). */
export function defaultCameraMode(): 'overview' | 'seat' {
  try {
    const width = globalThis.innerWidth ?? 0;
    return width > 0 && width < SEAT_CAMERA_MIN_WIDTH ? 'overview' : 'seat';
  } catch {
    return 'seat';
  }
}

/**
 * Kayıtlı tercihleri okur. `main.tsx` bunu açılışta bir kez çağırıp dili i18n
 * deposuna yazar: `usePrefs` çağırmayan ekranlar (katıl, 404, hata) da doğru
 * dilde açılır.
 */
export function loadPrefs(): Prefs {
  const fallback: Prefs = {
    quality: autoQuality(),
    reducedMotion: systemReducedMotion(),
    // D12 tur 4: ses varsayılan AÇIK (infaz/kart sesleri duyulsun). Kayıtlı
    // tercih her zaman üstündür; daha önce kapatmış kullanıcı kapalı kalır.
    soundEnabled: true,
    sensitivity: 1,
    cameraMode: defaultCameraMode(),
    announcements: true,
    fullscreenHintSeen: false,
    // D28: kayıt yoksa O ANKİ dil (açılışta İngilizce; testler `setLanguage` ile sabitler).
    language: currentLanguage(),
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      // Kayıtlı seçim her zaman üstündür; alan yoksa cihaz tahmini kullanılır.
      quality:
        parsed.quality === 'low' || parsed.quality === 'standard'
          ? parsed.quality
          : fallback.quality,
      reducedMotion: Boolean(parsed.reducedMotion ?? fallback.reducedMotion),
      soundEnabled: parsed.soundEnabled == null ? fallback.soundEnabled : Boolean(parsed.soundEnabled),
      sensitivity: parsed.sensitivity == null ? 1 : clampSensitivity(parsed.sensitivity),
      cameraMode:
        parsed.cameraMode === 'seat' || parsed.cameraMode === 'overview'
          ? parsed.cameraMode
          : fallback.cameraMode,
      // Alan yoksa (eski kayıt) varsayılan açık.
      announcements: parsed.announcements == null ? true : Boolean(parsed.announcements),
      fullscreenHintSeen: Boolean(parsed.fullscreenHintSeen),
      // Eski kayıtta alan yok → tarayıcı dili.
      language: isLanguage(parsed.language) ? parsed.language : fallback.language,
    };
  } catch {
    return fallback;
  }
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const initial = loadPrefs();
    // i18n deposu tercihle aynı dilde başlasın (ilk boyamada doğru metin).
    setLanguage(initial.language);
    return initial;
  });

  // Dil tercihi değişince sözlük anında döner; sayfa yenilenmez.
  useEffect(() => {
    setLanguage(prefs.language);
  }, [prefs.language]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* özel pencere / kapalı depolama */
    }
  }, [prefs]);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => ({
      ...prev,
      ...patch,
      ...(patch.sensitivity == null ? null : { sensitivity: clampSensitivity(patch.sensitivity) }),
    }));
  }, []);

  return [prefs, update];
}
