import type { ConnectionStatus } from '@secret-table/contracts';

import { useLanguage } from '../i18n';
import { connectionText } from './text';

/**
 * Gerçek istemci bağlantı durumunu gösterir (bağlı iken görünmez).
 * `useRoomState` HTTP + Realtime + ağ olaylarından türetir; sahneye de
 * `view.connection` olarak işlenir.
 */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  useLanguage();
  const t = connectionText(status);
  if (!t) return null;
  return (
    <p
      className={`notice ${status === 'disconnected' ? 'notice--error' : 'notice--warn'} conn-banner`}
      role="status"
      aria-live="polite"
    >
      <strong>{t.label}</strong> <span className="muted">{t.hint}</span>
    </p>
  );
}
