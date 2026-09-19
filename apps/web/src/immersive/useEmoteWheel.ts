/**
 * D16 — jest çarkının durumu ve girdileri.
 *
 * `G`: kısa basış çarkı açık bırakır (tekrar `G`/`Esc` kapatır), 250 ms'den uzun
 * basılı tutma bırakılınca vurgulu dilimi seçer. Fare: Pointer Lock'ta göreli
 * delta birikir (kilit BIRAKILMAZ), kilitsizken imleç konumu ekran merkezine
 * göre okunur. Ok tuşları/WASD dilim gezer, Enter/sol tık seçer, `1–8` doğrudan.
 *
 * Çark açıkken seçenek çubuğu ve diğer sahne kısayolları devre dışıdır; kapanınca
 * döner (`useTableControls` bu durumu okur).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EmoteKind } from '@secret-table/contracts';

import {
  EMOTE_HOLD_MS,
  clampPointer,
  emoteForSlot,
  holdSelects,
  sliceAt,
  stepSlice,
  wheelSize,
} from './emoteWheel';

export type EmoteWheel = {
  open: boolean;
  /** Vurgulu dilim (yoksa `null`). */
  index: number | null;
  /** Çark merkezine göre işaretçi (px) — yalnız görsel. */
  pointer: { x: number; y: number };
  /** Çark çapı (px). */
  size: number;
  /** `G` basıldı (aç + basılı tutma sayacını başlat). */
  press: () => void;
  /** `G` bırakıldı (uzun basışsa seç). */
  release: () => void;
  close: () => void;
  /** Ok tuşu / WASD. */
  step: (dir: -1 | 1) => void;
  /** Enter / sol tık: vurgulu dilimi seç. */
  commit: () => void;
  /** `1–8` ya da çipe dokunma. */
  pick: (slot: number) => void;
  /** Fare/dokunma ile dilim vurgusu (çark üstünde). */
  hover: (slot: number | null) => void;
  /** Telefon "Jest" düğmesi. */
  toggle: () => void;
};

export function useEmoteWheel(options: {
  /** Jest gönderimi; `false` dönerse hız sınırı yuttu (çark yine kapanır). */
  onEmote: (kind: EmoteKind) => void;
  /** Pointer Lock etkin mi (fare deltası okunur). */
  locked: boolean;
  /** Oyun ekranı jest kabul ediyor mu (menü kapalı, oyun sürüyor). */
  enabled: boolean;
  /**
   * D18 madde 5 — aşama kimliği. Değişince çark KAPANIR: telefonda `Esc` yok,
   * açık kalan çark sıra sana geçtiğinde ekranı kapatıyordu (E2E bulgu 5).
   */
  phaseKey?: string;
}): EmoteWheel {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(() =>
    wheelSize(typeof window === 'undefined' ? 1280 : window.innerWidth, typeof window === 'undefined' ? 720 : window.innerHeight),
  );
  const pressedAt = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const indexRef = useRef<number | null>(null);
  indexRef.current = index;

  const close = useCallback(() => {
    pressedAt.current = null;
    setOpen(false);
    setIndex(null);
    setPointer({ x: 0, y: 0 });
  }, []);

  const send = useCallback((slot: number | null) => {
    const kind = slot === null ? null : emoteForSlot(slot);
    if (kind) optionsRef.current.onEmote(kind);
    close();
  }, [close]);

  const press = useCallback(() => {
    if (!optionsRef.current.enabled) return;
    if (open) {
      // Açıkken ikinci `G`: kapat (basılı tutma da aynı basışta bitiyorsa seçmez).
      close();
      return;
    }
    pressedAt.current = performance.now();
    setOpen(true);
    setIndex(null);
    setPointer({ x: 0, y: 0 });
  }, [open, close]);

  const release = useCallback(() => {
    const at = pressedAt.current;
    pressedAt.current = null;
    if (at === null) return;
    // Basılı tutma: bırakınca vurgulu dilim seçilir; kısa basış açık bırakır.
    if (holdSelects(at, performance.now(), EMOTE_HOLD_MS) && indexRef.current !== null) send(indexRef.current);
  }, [send]);

  const step = useCallback((dir: -1 | 1) => setIndex((i) => stepSlice(i, dir)), []);
  const commit = useCallback(() => { send(indexRef.current); }, [send]);
  const pick = useCallback((slot: number) => { send(slot); }, [send]);
  const hover = useCallback((slot: number | null) => setIndex(slot), []);
  const toggle = useCallback(() => { if (open) close(); else if (optionsRef.current.enabled) { pressedAt.current = null; setOpen(true); setIndex(null); } }, [open, close]);

  // Oyun ekranı jest kabul etmiyorsa (menü, bağlantı) çark kapanır.
  useEffect(() => { if (!options.enabled && open) close(); }, [options.enabled, open, close]);

  // D18 madde 5 — faz değişince çark kapanır (telefonda kaçış yolu yok).
  const phaseKey = options.phaseKey;
  const lastPhase = useRef(phaseKey);
  useEffect(() => {
    if (lastPhase.current === phaseKey) return;
    lastPhase.current = phaseKey;
    if (open) close();
  }, [phaseKey, open, close]);

  /**
   * D21/G — `Escape` çarkı KENDİ İÇİNDE de kapatır.
   *
   * `useTableControls` çark açıkken tüm kısayolları çarka yönlendirir ve
   * `exit-lean` (Esc) dalında `wheel.close()` çağırır; ama o yol yalnız oyun
   * kısayolları ETKİNKEN çalışır (`enabled`, tuş dinleyicisinin kurulu olduğu
   * ekran). Çark başka bir bağlamda açıldıysa (dev sayfası, odak bir düğmede)
   * Esc'in kaçış yolu kalmıyordu. Buradaki dinleyici son güvencedir.
   *
   * D15 `exit-lean` ile çakışmaz: **çark açıksa önce çark kapanır** ve eğilme
   * dalı aynı olayda çalışmaz — `useTableControls` aynı tuş olayında hâlâ
   * "çark açık" durumunu okur (React durumu bu tick'te güncellenmez) ve
   * eğilmeye inmeden döner. `Escape`'in tarayıcı varsayılanı (tam ekran /
   * kilit çıkışı) ASLA engellenmez.
   */
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' && event.code !== 'Escape') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      close();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, close]);

  // Ölçek: ekran genişliğine göre (telefon dikeyde min 260 px).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setSize(wheelSize(window.innerWidth, window.innerHeight));
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  // Fare: kilitliyken göreli delta birikir, kilitsizken imleç ekran merkezine göre.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    let x = 0, y = 0;
    const onMove = (event: MouseEvent) => {
      if (optionsRef.current.locked) {
        const next = clampPointer(x + event.movementX, y + event.movementY);
        x = next.x; y = next.y;
      } else {
        x = event.clientX - window.innerWidth / 2;
        y = event.clientY - window.innerHeight / 2;
      }
      setPointer({ x, y });
      const slot = sliceAt(x, y);
      if (slot !== null) setIndex(slot);
    };
    // Kilitliyken imleç yok: yalnız delta. Kilit BIRAKILMAZ (tasarım kararı).
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [open]);

  return useMemo(
    () => ({ open, index, pointer, size, press, release, close, step, commit, pick, hover, toggle }),
    [open, index, pointer, size, press, release, close, step, commit, pick, hover, toggle],
  );
}
