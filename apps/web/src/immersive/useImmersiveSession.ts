/**
 * Fullscreen + Pointer Lock yaşam döngüsü — FINISH_PLAN §2.
 *
 * - Başlatma YALNIZ kullanıcı hareketiyle (`enter` / `resume` bir tıklama
 *   işleyicisinden çağrılır).
 * - Fullscreen ve Pointer Lock durumları AYRI izlenir. Tam ekran olup serbest
 *   imleç kullanılabilir.
 * - Tek düğmeden birlikte istek tarayıcıda kabul edilmezse `needsResume` true
 *   olur; uygulama açık bir "Bakışı etkinleştir" kontrolü gösterir. Sessizce
 *   aktif görünmez, kendiliğinden yeniden kilitleme yoktur.
 * - Esc, pointerlockchange/error, fullscreenchange/error, sekme gizlenmesi,
 *   pencere odağı kaybı ve unmount güvenli çıkışla ele alınır. Tarayıcının Esc
 *   davranışı bastırılmaz.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function fullscreenElement(): Element | null {
  const d = document as FsDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function requestFullscreen(el: FsElement): Promise<void> {
  try {
    const fn = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (!fn) return Promise.reject(new Error('fullscreen desteklenmiyor'));
    return Promise.resolve(fn.call(el)).then(() => undefined);
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error('fullscreen hatası'));
  }
}

function exitFullscreen(): Promise<void> {
  const d = document as FsDocument;
  try {
    const fn = d.exitFullscreen ?? d.webkitExitFullscreen;
    if (!fn || !fullscreenElement()) return Promise.resolve();
    return Promise.resolve(fn.call(d)).then(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

function requestPointerLock(el: HTMLElement): Promise<void> {
  try {
    const ret = (el.requestPointerLock as unknown as () => Promise<void> | undefined)();
    return Promise.resolve(ret).then(() => undefined);
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error('pointer lock hatası'));
  }
}

/** Yalnız Fullscreen API var mı (Pointer Lock aranmaz). */
const FULLSCREEN_SUPPORTED =
  typeof document !== 'undefined' &&
  (Boolean(document.documentElement.requestFullscreen) ||
    Boolean((document.documentElement as FsElement).webkitRequestFullscreen));

const SUPPORTED =
  typeof document !== 'undefined' && 'pointerLockElement' in document && FULLSCREEN_SUPPORTED;

export type ImmersiveSession = {
  /** Pointer Lock + Fullscreen API'leri bu tarayıcıda var mı. */
  supported: boolean;
  /**
   * Yalnız Fullscreen API var mı. Dokunmatik cihazlarda Pointer Lock anlamsız
   * olduğu için "Tam ekran" düğmesi bu bayrağa bakar (ROADMAP §C, C2-b/5).
   * iOS Safari'de element tam ekranı yok → false → düğme gizlenir.
   */
  fullscreenSupported: boolean;
  fullscreen: boolean;
  locked: boolean;
  /** Fullscreen içindeyiz ama kilit yok; kullanıcıdan açık "Bakışı etkinleştir" isteniyor. */
  needsResume: boolean;
  /** Kilidin en son etkinleştiği an (`performance.now()`); ilk-tık koruması için. */
  lockedAt: number | null;
  /** Kullanıcı hareketinden çağır: tam ekran + kilit iste. */
  enter: () => void;
  /**
   * Kullanıcı hareketinden çağır: YALNIZ tam ekran iste, Pointer Lock isteme.
   * Dokunmatik cihazlarda kullanılır; `needsResume` akışını tetiklemez.
   */
  enterFullscreenOnly: () => void;
  /** Kullanıcı hareketinden çağır: yalnız kilidi yeniden iste. */
  resume: () => void;
  /** Yalnız Pointer Lock'u bırak (tam ekran kalır); menü açılınca kullanılır. */
  releaseLock: () => void;
  /** Güvenli çıkış: kilit + tam ekranı bırak. */
  exit: () => void;
};

const COARSE_QUERY = '(pointer: coarse)';

function matchCoarse(): boolean {
  try {
    return globalThis.matchMedia?.(COARSE_QUERY).matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Birincil işaretleyici dokunmatik mi (ROADMAP §C, C2-b/5).
 *
 * Fare/trackpad → false; telefon/tablet → true. Tabletin klavyeye takılması
 * gibi değişimler dinlenir. Ortam desteklemiyorsa güvenli varsayılan false
 * (masaüstü akışı korunur).
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(matchCoarse);

  useEffect(() => {
    let mql: MediaQueryList;
    try {
      const mm = globalThis.matchMedia;
      if (!mm) return;
      mql = mm.call(globalThis, COARSE_QUERY);
    } catch {
      return;
    }
    const onChange = () => setCoarse(mql.matches);
    setCoarse(mql.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  return coarse;
}

export function useImmersiveSession(containerRef: React.RefObject<HTMLElement | null>): ImmersiveSession {
  const [fullscreen, setFullscreen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [needsResume, setNeedsResume] = useState(false);
  const [lockedAt, setLockedAt] = useState<number | null>(null);

  /** `exit()` sırasında change/blur işleyicileri needsResume kurmasın. */
  const intentionalExitRef = useRef(false);
  /** Kullanıcı bu oturumda "odaklan"a bastı mı (blur sonrası resume önerisi için). */
  const engagedRef = useRef(false);

  const syncFullscreen = useCallback(() => {
    const el = containerRef.current;
    const fs = Boolean(el) && fullscreenElement() === el;
    setFullscreen(fs);
    // Tam ekrandan tamamen çıkıldıysa "devam" önerisi anlamsız.
    if (!fs) setNeedsResume(false);
  }, [containerRef]);

  const syncLock = useCallback(() => {
    const el = containerRef.current;
    const isLocked = Boolean(el) && document.pointerLockElement === el;
    setLocked(isLocked);
    if (isLocked) {
      setLockedAt(performance.now());
      setNeedsResume(false);
    } else if (engagedRef.current && !intentionalExitRef.current && fullscreenElement()) {
      // Kilit fullscreen içinde düştü (Esc, blur, hidden). Kendiliğinden yeniden
      // kilitleme yok; kullanıcıya açık kontrol.
      setNeedsResume(true);
    }
  }, [containerRef]);

  const exit = useCallback(() => {
    intentionalExitRef.current = true;
    engagedRef.current = false;
    setNeedsResume(false);
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch {
      /* yut */
    }
    void exitFullscreen().finally(() => {
      // Bir sonraki olay turunda bayrağı bırak.
      setTimeout(() => {
        intentionalExitRef.current = false;
      }, 0);
    });
  }, []);

  const lockNow = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    void requestPointerLock(el).catch(() => {
      if (fullscreenElement()) setNeedsResume(true);
    });
  }, [containerRef]);

  const enter = useCallback(() => {
    const el = containerRef.current;
    if (!el || !SUPPORTED) return;
    engagedRef.current = true;
    intentionalExitRef.current = false;
    setNeedsResume(false);
    // Önce tam ekran, sonra kilit. Kilit reddedilirse tam ekran kalır +
    // needsResume ile açık devam kontrolü sunulur.
    void requestFullscreen(el as FsElement)
      .catch(() => undefined)
      .then(() => {
        lockNow();
      });
  }, [containerRef, lockNow]);

  const enterFullscreenOnly = useCallback(() => {
    const el = containerRef.current;
    if (!el || !FULLSCREEN_SUPPORTED) return;
    // `engagedRef` KURULMAZ: kilit hiç istenmediği için "Bakışı etkinleştir"
    // önerisi de çıkmamalı (dokunmatik cihazda anlamsız).
    intentionalExitRef.current = false;
    setNeedsResume(false);
    void requestFullscreen(el as FsElement).catch(() => undefined);
  }, [containerRef]);

  const resume = useCallback(() => {
    engagedRef.current = true;
    intentionalExitRef.current = false;
    lockNow();
  }, [lockNow]);

  const releaseLock = useCallback(() => {
    // Menü/özel inceleme: kilidi bırak ama tam ekranı ve "engaged" durumunu koru;
    // needsResume tetiklenmesin (kullanıcı bilerek bıraktı).
    intentionalExitRef.current = true;
    setNeedsResume(false);
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch {
      /* yut */
    }
    setTimeout(() => {
      intentionalExitRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onFsChange = () => syncFullscreen();
    const onFsError = () => {
      syncFullscreen();
    };
    const onLockChange = () => syncLock();
    const onLockError = () => {
      if (fullscreenElement()) setNeedsResume(true);
      setLocked(false);
    };
    const onVisibility = () => {
      if (document.hidden && document.pointerLockElement) {
        try {
          document.exitPointerLock();
        } catch {
          /* yut */
        }
      }
    };
    const onBlur = () => {
      // Tarayıcı odak kaybında kilidi düşürür; fullscreen'i zorla bırakma.
      if (engagedRef.current && fullscreenElement() && !document.pointerLockElement) {
        setNeedsResume(true);
      }
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('fullscreenerror', onFsError);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('fullscreenerror', onFsError);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [syncFullscreen, syncLock]);

  // Unmount / rota değişimi: güvenli çıkış.
  useEffect(() => {
    return () => {
      try {
        if (document.pointerLockElement) document.exitPointerLock();
      } catch {
        /* yut */
      }
      void exitFullscreen();
    };
  }, []);

  return {
    supported: SUPPORTED,
    fullscreenSupported: FULLSCREEN_SUPPORTED,
    fullscreen,
    locked,
    needsResume,
    lockedAt,
    enter,
    enterFullscreenOnly,
    resume,
    releaseLock,
    exit,
  };
}
