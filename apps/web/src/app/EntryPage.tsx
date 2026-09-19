import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CONTRACT_VERSION, PROTOCOL_VERSION } from '@secret-table/contracts';

import { createRoom } from '../multiplayer/apiClient';
import { currentAccessToken, ensureGuestSession, resetGuestSession } from '../multiplayer/guestSession';
import { isSupabaseConfigured } from '../multiplayer/supabaseClient';
import { SourceLink } from '../ui/SourceLink';
import { HowToPlayButton } from '../ui/HowToPlayModal';
import { CenteredScreen } from '../ui/Screen';
import { currentLanguage, t as translate, useT } from '../i18n';
import { LanguageSwitch } from '../ui/LanguageSwitch';
import { usePrefs } from '../ui/usePrefs';
import { errorText } from '../ui/text';
import { loadName, saveName } from './nameStore';

/** Davet kodu sunucuda 6 karakter, karışan harfler (I/L/O/0/1) yok. */
export const INVITE_CODE_LENGTH = 6;

/** Yapıştırma / küçük harf / boşluk → tek biçim: büyük harf + rakam, 6 karakter. */
export function normalizeInviteCode(raw: string): string {
  return raw
    .toLocaleUpperCase(currentLanguage() === 'tr' ? 'tr-TR' : 'en-US')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, INVITE_CODE_LENGTH);
}

/** Giriş: isim + oda aç / davet koduyla katıl (docs/PLAN.md § 3.1, ROADMAP B6). */
export function EntryPage() {
  const t = useT();
  const [prefs, setPrefs] = usePrefs();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(() => normalizeInviteCode(params.get('code') ?? ''));
  const [busy, setBusy] = useState<null | 'create' | 'join' | 'solo'>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length > 0;
  const codeOk = code.length === INVITE_CODE_LENGTH;

  async function openRoom(event: FormEvent) {
    event.preventDefault();
    if (!nameOk || busy) return;
    setBusy('create');
    setError(null);
    saveName(name);
    try {
      const session = await ensureGuestSession();
      const token = await currentAccessToken(session);
      let res = await createRoom(token, name.trim());
      if (!res.ok && res.status === 401 && session.mode === 'supabase') {
        await resetGuestSession();
        const fresh = await ensureGuestSession();
        res = await createRoom(await currentAccessToken(fresh), name.trim());
      }
      if (!res.ok) {
        setError(errorText(res.error));
        return;
      }
      navigate(`/oda/${res.data.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? errorText(err.message) : translate('error.createRoom'));
    } finally {
      setBusy(null);
    }
  }

  /**
   * D26 — "Tek başına dene": isim istemeden 5 botla dolu bir masa açar. Solo
   * kodu TEMBEL yüklenir; düğmeye basılmadan ana pakete girmez. Supabase,
   * `/api/game` ve Realtime kullanılmaz (docs/ARCHITECTURE.md "Solo mode").
   */
  async function startSoloGame() {
    if (busy) return;
    setBusy('solo');
    setError(null);
    try {
      const { startSolo } = await import('../solo/startSolo');
      const result = await startSolo({ displayName: name.trim() || t('solo.you') });
      navigate(`/oda/${result.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? errorText(err.message) : translate('solo.error'));
      setBusy(null);
    }
  }

  function goJoin(event: FormEvent) {
    event.preventDefault();
    if (!codeOk || busy) return;
    saveName(name);
    navigate(`/katil/${encodeURIComponent(code)}`);
  }

  return (
    <CenteredScreen>
      <LanguageSwitch
        className="lang-switch--corner"
        value={prefs.language}
        onChange={(language) => setPrefs({ language })}
      />
      <header className="hero">
        <p className="hero__eyebrow">{t('entry.eyebrow')}</p>
        <h1 className="hero__title">Secret Table</h1>
        <p className="hero__lead">{t('entry.lead')}</p>
      </header>

      <form onSubmit={openRoom} className="form">
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

        <button type="submit" className="btn btn--primary btn--block" disabled={!nameOk || busy !== null}>
          {busy === 'create' ? t('entry.creating') : t('entry.create')}
        </button>
      </form>

      {/* D26 — tek başına gelen ziyaretçi için: isim gerekmez, masa hemen kurulur. */}
      <div className="form solo-cta">
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => void startSoloGame()}
          disabled={busy !== null}
        >
          {busy === 'solo' ? t('solo.starting') : t('solo.try')}
        </button>
        <span className="field__hint">{t('solo.hint')}</span>
      </div>

      <div className="divider" role="presentation">
        <span>{t('entry.or')}</span>
      </div>

      <form onSubmit={goJoin} className="form">
        <div className="field">
          <label className="field__label" htmlFor="entry-code">
            {t('entry.code')}
          </label>
          <input
            id="entry-code"
            value={code}
            onChange={(e) => setCode(normalizeInviteCode(e.target.value))}
            placeholder="ABC234"
            className="input--code"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={INVITE_CODE_LENGTH}
            aria-describedby="entry-code-hint"
          />
          <span className="field__hint" id="entry-code-hint">
            {t('entry.codeHint')}
          </span>
        </div>
        <button type="submit" className="btn btn--secondary btn--block" disabled={!codeOk || busy !== null}>
          {t('entry.joinWithCode')}
        </button>
      </form>

      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="howto" aria-labelledby="howto-title">
        <h2 className="howto__title" id="howto-title">
          {t('entry.howTitle')}
        </h2>
        <ol className="howto__steps">
          {[t('entry.step1'), t('entry.step2'), t('entry.step3')].map((step, i) => (
            <li key={step} className="howto__step">
              <span className="howto__num" aria-hidden="true">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {/* D29 — üç adım "bu sayfada ne yapacağım"ı söyler; oyunun KURALLARI
            (kart/tahta görselleriyle) modalde. Solo oyun lobiyi atladığı için
            (D26) kılavuza giriş ekranından da ulaşılabilmesi gerekiyor. */}
        <HowToPlayButton className="btn btn--secondary btn--block howto__open" />
      </section>

      <p className="shell__source">
        <SourceLink className="source-link" />
      </p>

      <p className="muted shell__foot">
        {t('entry.foot', {
          contract: CONTRACT_VERSION,
          protocol: PROTOCOL_VERSION,
          client: isSupabaseConfigured() ? t('entry.footClientLive') : t('entry.footClientLocal'),
        })}{' '}
        · <a href="/api/health">/api/health</a>
      </p>
    </CenteredScreen>
  );
}
