import type { SceneView } from '@secret-table/contracts';

import { OPTION_DIGITS } from '../immersive/controlScheme';
import type { ControlHudModel, ControlStage, FocusTarget } from '../immersive/controlScheme';
import { useT } from '../i18n';
import { errorText } from './text';

/**
 * Alt eylem/tuş çubuğu — ROADMAP A2/3.
 *
 * Eski sağ HTML yan panelinin (ActionPanel) yerine geçer: o an GERÇEKTEN
 * yapılabilen seçenekler düğme olur, her düğmede tuş rozeti bulunur ve sabit
 * kısayol rozetleri sürekli görünür. Metin ve davranış tek kaynaktan
 * (`controlScheme` / `useTableControls`) gelir; tıklama klavye ile aynı
 * `select_option` → onay → `submitSelected` yolunu kullanır.
 *
 * Numaralar YUVA sırasıdır (CODEX-017/1): sahne bir yuvayı çizmiyorsa o numara
 * boş kalır, kalan seçenekler sola kaymaz.
 */
export function ActionBar({
  view,
  hud,
  targets,
  focusIndex,
  stage,
  busy,
  blocked,
  transient,
  onActivate,
  onSubmit,
  onCancel,
}: {
  view: SceneView;
  hud: ControlHudModel;
  targets: readonly (FocusTarget | null)[];
  focusIndex: number;
  stage: ControlStage;
  /** Ağ komutu gönderiliyor. */
  busy: boolean;
  /** Bağlantı kesik: yanlış başarı hissi vermemek için düğmeler kapalı. */
  blocked: boolean;
  transient: string | null;
  onActivate: (index: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const filled = targets
    .map((target, index) => ({ target, index }))
    .filter((entry): entry is { target: FocusTarget; index: number } => entry.target != null);
  const focus = targets[focusIndex] ?? null;
  const disabled = busy || blocked;
  const gameOver = view.phase === 'game_over';

  return (
    <div className="actionbar" role="group" aria-label={t('actionbar.group')}>
      {blocked && filled.length > 0 ? (
        <p className="actionbar__notice actionbar__notice--error" role="status">
          {t('actionbar.blocked')}
        </p>
      ) : null}

      {transient ? (
        <p className="actionbar__notice actionbar__notice--error" role="alert">
          {errorText(transient)}
        </p>
      ) : null}

      {filled.length === 0 ? (
        <p className="actionbar__idle muted">
          {gameOver ? t('actionbar.gameOver') : t('actionbar.idle')}
        </p>
      ) : (
        <div className="actionbar__options">
          {filled.map(({ target, index }) => {
            // D12 tur 3: 1–9 arası her yuvanın kendi rakamı var.
            const digit = index < OPTION_DIGITS ? index + 1 : null;
            const isFocused = index === focusIndex;
            return (
              <button
                key={target.id}
                type="button"
                className={`actionbar__option${isFocused ? ' is-focused' : ''}${
                  isFocused && stage !== 'idle' ? ' is-selected' : ''
                }`}
                aria-pressed={isFocused && stage !== 'idle'}
                disabled={disabled}
                onClick={() => onActivate(index)}
              >
                {digit ? <kbd className="actionbar__digit">{digit}</kbd> : null}
                <span className="actionbar__label">{target.label}</span>
              </button>
            );
          })}
          {filled.length > OPTION_DIGITS ? (
            <span className="actionbar__more muted">
              <kbd>←</kbd> <kbd>→</kbd> {t('actionbar.browse')}
            </span>
          ) : null}
        </div>
      )}

      {focus && stage !== 'idle' ? (
        <div className="actionbar__confirm">
          <strong className="actionbar__consequence">{hud.consequence}</strong>
          <div className="actionbar__confirm-buttons">
            <button type="button" disabled={disabled} onClick={onSubmit}>
              {busy ? t('actionbar.sending') : (hud.submitLabel ?? t('actionbar.confirm'))}
              <kbd>Enter</kbd>
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
              {t('actionbar.cancel')} <kbd>Backspace</kbd>
            </button>
          </div>
        </div>
      ) : null}

      <div className="actionbar__keys" aria-label={t('actionbar.shortcuts')}>
        {hud.shortcuts.map((hint) => (
          <span key={`${hint.keys}:${hint.label}`} className="actionbar__hint">
            <kbd>{hint.keys}</kbd> {hint.label}
          </span>
        ))}
      </div>
    </div>
  );
}
