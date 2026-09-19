import { useRouteError } from 'react-router-dom';

import { t } from '../i18n';
import { ErrorScreen } from '../ui/Screen';

/** Rota/render hatalarının son sığınağı. Sonsuz beyaz ekran yerine anlaşılır görünüm. */
export function RootErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : t('error.unexpected');
  return (
    <ErrorScreen
      message={message}
      onHome={() => {
        globalThis.location.assign('/');
      }}
    />
  );
}
