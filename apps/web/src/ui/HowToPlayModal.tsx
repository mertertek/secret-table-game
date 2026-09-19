/**
 * D29 — "Nasıl oynanır" kılavuzunu açan düğme + modal.
 *
 * Kullanıcı 2026-09-18: kılavuz oda kurulduktan SONRA lobide bir düğmeyle,
 * kart ve tahta resimleriyle açılsın. Aynı düğme giriş ekranında da var (D26
 * solo oyun lobiyi atladığı için tek erişim noktası orası).
 *
 * İçerik TEK KAYNAK: hem bu modal hem oyun içi menü sekmesi (`GameMenu`
 * "Nasıl oynanır") aynı `HowToPlay` bileşenini çizer.
 *
 * Paket: içerik (kural verisi + SVG'ler + sahne paleti/ikonları) TEMBEL
 * yüklenir; giriş paketi büyümez. Düğmenin üstüne gelince önceden indirilir,
 * böylece tıklamada bekleme görünmez.
 *
 * Erişilebilirlik (`EmoteWheel` ve `GameMenu` kalıpları):
 *  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
 *  - açılınca odak BAŞLIĞA gider, kapanınca düğmeye döner
 *  - `Escape` ve zemine tıklama kapatır
 *  - `Tab` odağı panelin içinde döndürür (odak tuzağı)
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import { useT } from '../i18n';

/** Tembel içerik: `howToPlay` verisi + `howToPlayArt` SVG'leri ayrı chunk. */
const HowToPlay = lazy(() => import('./HowToPlayPanel'));

/** Düğmenin üstüne gelince / dokununca chunk'ı önceden indir. */
function preloadHowToPlay(): void {
  void import('./HowToPlayPanel').catch(() => undefined);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function HowToPlayModal({
  open,
  onClose,
  playerCount,
}: {
  open: boolean;
  onClose: () => void;
  playerCount?: number;
}) {
  const t = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    titleRef.current?.focus();
    // Arkadaki lobi kaymasın (telefonda modal içinde kaydırırken karışıyor).
    const body = globalThis.document?.body;
    if (!body) return undefined;
    const previous = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previous;
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const nodes = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      const active = globalThis.document?.activeElement;
      if (event.shiftKey ? active === first || active === titleRef.current : active === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  /**
   * PORTAL ZORUNLU: lobi/giriş kartı (`.shell__card`) `card-rise` animasyonunu
   * `fill: both` ile tutar, yani `transform` hesaplanmış değeri kalır ve kart
   * `position: fixed` için KAPSAYAN BLOK olur. Modal kartın içinde kalırsa
   * "tam ekran" yerine kartın kutusuna göre yerleşir (ölçüldü: 1280×720
   * ekranda panel `top: -194px`, başlık görünmüyordu). `document.body`ye
   * taşıyınca `inset: 0` yeniden GÖRÜNTÜ ALANI demektir.
   */
  const dialog = (
    <div className="howto-modal" role="dialog" aria-modal="true" aria-labelledby="howto-modal-title" onKeyDown={onKeyDown}>
      <div className="howto-modal__scrim" onClick={onClose} data-testid="howto-modal-scrim" aria-hidden="true" />
      <div className="howto-modal__sheet" ref={sheetRef}>
        <div className="howto-modal__head">
          <h2 id="howto-modal-title" className="howto-modal__title" ref={titleRef} tabIndex={-1}>
            {t('howto.modalTitle')}
          </h2>
          <button type="button" className="btn btn--secondary btn--sm" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <div className="howto-modal__body">
          <Suspense fallback={<p className="muted howto-modal__loading">{t('howto.loading')}</p>}>
            <HowToPlay playerCount={playerCount} />
          </Suspense>
        </div>
      </div>
    </div>
  );

  const host = globalThis.document?.body;
  return host ? createPortal(dialog, host) : dialog;
}

/**
 * Kılavuzu açan düğme. Odak yönetimi burada: kapanınca odak düğmeye döner.
 * `className` verilmezse lobi/giriş ekranının ikincil düğme biçimi kullanılır.
 */
export function HowToPlayButton({
  className = 'btn btn--secondary',
  playerCount,
}: {
  className?: string;
  playerCount?: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={preloadHowToPlay}
        onFocus={preloadHowToPlay}
        onClick={() => setOpen(true)}
      >
        {t('howto.openButton')}
      </button>
      <HowToPlayModal open={open} onClose={close} playerCount={playerCount} />
    </>
  );
}
