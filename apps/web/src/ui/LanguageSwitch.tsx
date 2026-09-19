/**
 * D23 — TR / EN anahtarı.
 *
 * Dil ODAYA değil OYUNCUYA aittir: seçim yalnız yerel tercihtir (`usePrefs`),
 * sunucuya gitmez ve diğer oyuncuları etkilemez. Değişiklik anında uygulanır;
 * sayfa yenilenmez.
 */
import { LANGUAGES, useT, type Language } from '../i18n';

export function LanguageSwitch({
  value,
  onChange,
  className = '',
}: {
  value: Language;
  onChange: (next: Language) => void;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={`lang-switch ${className}`.trim()} role="radiogroup" aria-label={t('lang.label')}>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={value === code}
          aria-label={code === 'tr' ? t('lang.trFull') : t('lang.enFull')}
          className={`lang-switch__btn${value === code ? ' is-on' : ''}`}
          onClick={() => onChange(code)}
        >
          {code === 'tr' ? t('lang.tr') : t('lang.en')}
        </button>
      ))}
    </div>
  );
}
