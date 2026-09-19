import { Link } from 'react-router-dom';

import { useT } from '../i18n';
import { CenteredScreen } from '../ui/Screen';

export function NotFoundPage() {
  const t = useT();
  return (
    <CenteredScreen>
      <header className="hero hero--compact">
        <p className="hero__eyebrow">Secret Table</p>
        <h1 className="hero__title hero__title--sm">{t('notfound.title')}</h1>
        <p className="hero__lead">{t('notfound.lead')}</p>
      </header>
      <p className="btn-row">
        <Link className="btn btn--primary" to="/">
          {t('notfound.home')}
        </Link>
      </p>
    </CenteredScreen>
  );
}
