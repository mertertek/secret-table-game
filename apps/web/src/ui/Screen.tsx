import type { ReactNode } from 'react';

import { useT } from '../i18n';
import { TableBackdrop } from './TableBackdrop';

/**
 * ROADMAP B6 — giriş / katıl / lobi / yükleme / hata ekranlarının ortak kabuğu.
 *
 * Tam ekran keçe zemin + ceviz çerçeve + dekoratif masa motifi (`TableBackdrop`),
 * ortada krem "kart" panel. Sahne paketi (three) bu yolda YÜKLENMEZ.
 *
 * API değişmedi: `CenteredScreen` yalnız `children` ile de çağrılabilir;
 * `wide` lobi gibi geniş içerikler için isteğe bağlıdır.
 */
export function CenteredScreen({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className={`shell${wide ? ' shell--wide' : ''}`}>
      <TableBackdrop />
      <div className="shell__frame" aria-hidden="true" />
      <div className="shell__card">{children}</div>
    </main>
  );
}

export function LoadingScreen({ label }: { label?: string }) {
  const t = useT();
  return (
    <CenteredScreen>
      <div className="loading">
        <span className="loading__ring" aria-hidden="true" />
        <p className="shell__status" role="status" aria-live="polite">
          {label ?? t('screen.loading')}
        </p>
      </div>
    </CenteredScreen>
  );
}

export function ErrorScreen({
  message,
  onRetry,
  onHome,
}: {
  message: string;
  onRetry?: () => void;
  onHome?: () => void;
}) {
  const t = useT();
  return (
    <CenteredScreen>
      <h1 className="shell__title">{t('screen.errorTitle')}</h1>
      <p className="shell__status notice notice--error" role="alert">
        {message}
      </p>
      <div className="btn-row">
        {onRetry ? (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            {t('common.retry')}
          </button>
        ) : null}
        {onHome ? (
          <button type="button" className="btn btn--secondary" onClick={onHome}>
            {t('common.home')}
          </button>
        ) : null}
      </div>
    </CenteredScreen>
  );
}
