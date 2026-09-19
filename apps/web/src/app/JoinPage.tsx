import { type FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { joinRoom } from '../multiplayer/apiClient';
import { currentAccessToken, ensureGuestSession, resetGuestSession } from '../multiplayer/guestSession';
import { CenteredScreen } from '../ui/Screen';
import { t as translate, useT } from '../i18n';
import { LanguageSwitch } from '../ui/LanguageSwitch';
import { usePrefs } from '../ui/usePrefs';
import { errorText } from '../ui/text';
import { normalizeInviteCode } from './EntryPage';
import { loadName, saveName } from './nameStore';

/** `/katil/:code` — davet bağlantısından isimle katılım (ROADMAP B6 kabuğu). */
export function JoinPage() {
  const t = useT();
  const [prefs, setPrefs] = usePrefs();
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState(loadName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayCode = normalizeInviteCode(code);
  const nameOk = name.trim().length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!nameOk || busy) return;
    setBusy(true);
    setError(null);
    saveName(name);
    try {
      const session = await ensureGuestSession();
      const token = await currentAccessToken(session);
      let res = await joinRoom(token, code, name.trim());
      if (!res.ok && res.status === 401 && session.mode === 'supabase') {
        await resetGuestSession();
        const fresh = await ensureGuestSession();
        res = await joinRoom(await currentAccessToken(fresh), code, name.trim());
      }
      if (!res.ok) {
        setError(errorText(res.error));
        return;
      }
      navigate(`/oda/${res.data.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? errorText(err.message) : translate('error.joinRoom'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredScreen>
      <LanguageSwitch
        className="lang-switch--corner"
        value={prefs.language}
        onChange={(language) => setPrefs({ language })}
      />
      <header className="hero hero--compact">
        <p className="hero__eyebrow">Secret Table</p>
        <h1 className="hero__title hero__title--sm">{t('join.title')}</h1>
        <p className="code-badge">
          <span className="code-badge__label">{t('join.invite')}</span>
          <span className="code-badge__value">{displayCode || '—'}</span>
        </p>
      </header>

      <form onSubmit={submit} className="form">
        <label className="field">
          <span className="field__label">{t('entry.name')}</span>
          <input
            value={name}
            maxLength={40}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
            placeholder={t('entry.namePlaceholder')}
          />
        </label>
        <button type="submit" className="btn btn--primary btn--block" disabled={!nameOk || busy}>
          {busy ? t('join.joining') : t('join.submit')}
        </button>
      </form>

      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="shell__foot">
        <button type="button" className="btn-link" onClick={() => navigate('/')}>
          {t('join.backHome')}
        </button>
      </p>
    </CenteredScreen>
  );
}
