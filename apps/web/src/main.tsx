import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './app/routes';
import { setLanguage } from './i18n';
import { loadPrefs } from './ui/usePrefs';
import './ui/styles.css';

/**
 * D23/D28 — ilk boyamadan ÖNCE dil sabitlenir. `usePrefs` çağırmayan ekranlar
 * (katıl, 404, hata sınırı) da kayıtlı dille (yoksa İngilizce) açılsın.
 */
setLanguage(loadPrefs().language);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root öğesi bulunamadı');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
