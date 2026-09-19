import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { SceneView } from '@secret-table/contracts';

import { HistoryLog } from './HistoryLog';
import { PlayersPanel } from './PlayersPanel';
import { TableStatus } from './TableStatus';
import { useT } from '../i18n';
import { LanguageSwitch } from './LanguageSwitch';
import { SourceLink } from './SourceLink';
import { SENSITIVITY_MAX, SENSITIVITY_MIN, type Prefs } from './usePrefs';
import { DEV_TOOLS } from '../devTools';

/**
 * `M` menüsü — ROADMAP A2/4, D19'da sekmelendi.
 *
 * Tam ekran sahnenin üstünde yarı saydam slide-over. Sekmeler:
 *  - **Ayarlar** (varsayılan): oyuncular, masa durumu, tur geçmişi, tercihler
 *    (grafik / hareket / ses / fare hassasiyeti), tuş yardımı — D19 öncesindeki
 *    bölümlerin tümü buradadır, sıraları değişmedi.
 *  - **Nasıl oynanır**: kurallar + her kuralın bu oyunda nereden kullanıldığı
 *    (`HowToPlay`, içerik `howToPlay.ts`).
 *  - **Geliştirici**: YALNIZ dev derlemesinde (`DEV_TOOLS`).
 *
 * Açılınca Pointer Lock çağıran tarafından bırakılır ve oyun kısayolları
 * kapanır; "Bakışa dön" açık kullanıcı etkileşimiyle kilidi geri ister.
 * Tarayıcının Esc davranışı korunur; panel içi Esc yalnız kapatır. D11 odak
 * modeli ve sağ üst araç çubuğu bu panelin dışındadır, değişmedi.
 */

type MenuTab = 'settings' | 'howto' | 'dev';

/**
 * D14 — "Geliştirici" bölümü YALNIZ `import.meta.env.DEV` iken vardır.
 *
 * Üretim derlemesinde `import.meta.env.DEV` sabit `false` olur; ternary'nin
 * ölü dalıyla birlikte `import()` çağrısı da düşer, bu yüzden Rollup
 * `dev/devScenarioMenu` chunk'ını hiç üretmez (botRunner ile aynı kalıp).
 */
const DevScenarioSection = DEV_TOOLS
  ? lazy(() =>
      import('../dev/devScenarioMenu').then((m) => ({ default: m.DevScenarioSection })),
    )
  : null;

/**
 * D29 — "Nasıl oynanır" içeriği TEMBEL yüklenir. Sekme lobideki modalle aynı
 * bileşeni çizer (tek kaynak) ve aynı chunk'ı paylaşır; kural verisi, SVG
 * görselleri ve sahne paleti giriş paketine girmez.
 */
const HowToPlay = lazy(() => import('./HowToPlayPanel'));

/** Tuş adları dile göre DEĞİŞMEZ; yalnız açıklamalar çevrilir. */
function keyRows(t: (key: 'menu.key.activate') => string): ReadonlyArray<{ keys: string; label: string }> {
  const tr = t as unknown as (key: string) => string;
  return [
    { keys: tr('howto.key.activateKeys'), label: tr('menu.key.activate') },
    { keys: '1 · 2 · 3', label: tr('menu.key.digits') },
    { keys: '← →', label: tr('menu.key.arrows') },
    { keys: 'Enter', label: tr('menu.key.enter') },
    { keys: 'Backspace', label: tr('menu.key.backspace') },
    { keys: 'H', label: tr('menu.key.identity') },
    { keys: 'V', label: tr('menu.key.camera') },
    { keys: 'M', label: tr('menu.key.menu') },
    { keys: 'Esc', label: tr('menu.key.escape') },
  ];
}

export function GameMenu({
  open,
  view,
  connectionLabel,
  prefs,
  setPrefs,
  canResume,
  canExitFocus,
  isHost,
  onClose,
  onResume,
  onExitFocus,
  onReturnLobby,
  onRefresh,
}: {
  open: boolean;
  view: SceneView;
  connectionLabel: string | null;
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  /** Tam ekrandayız ama kilit yok → "Bakışa dön" gösterilir. */
  canResume: boolean;
  /** Tam ekran/kilit etkin → "Odağı bırak" gösterilir. */
  canExitFocus: boolean;
  isHost: boolean;
  onClose: () => void;
  onResume: () => void;
  onExitFocus: () => void;
  onReturnLobby: () => void;
  onRefresh: () => void;
}) {
  const t = useT();
  const firstBtnRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<MenuTab>('settings');

  useEffect(() => {
    if (!open) return;
    firstBtnRef.current?.focus();
    /**
     * D21/F — menü her açılışta "Ayarlar" sekmesinde başlar. Sekme durumu
     * bileşen kapalıyken de yaşadığı için (panel `open` ile sadece render
     * edilmiyor, unmount edilmiyor) bir kez "Nasıl oynanır"a ya da
     * "Geliştirici"ye bakan oyuncu, sonraki `M` basışlarında bağlantı /
     * oyuncular / tercihler yerine o sekmeyi buluyordu.
     */
    setTab('settings');
  }, [open]);

  if (!open) return null;

  const tabs: ReadonlyArray<{ id: MenuTab; label: string }> = [
    { id: 'settings', label: t('menu.tab.settings') },
    { id: 'howto', label: t('menu.tab.howto') },
    ...(DevScenarioSection ? [{ id: 'dev' as MenuTab, label: t('menu.tab.dev') }] : []),
  ];
  const KEY_ROWS = keyRows(t as never);

  return (
    <div
      className="game-menu"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-menu-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="game-menu__scrim" onClick={onClose} aria-hidden="true" />
      <div className="game-menu__sheet">
        <div className="game-menu__head">
          <h2 id="game-menu-title" className="panel__title">
            {t('menu.title')}
          </h2>
          <div className="row">
            {canResume ? (
              <button type="button" onClick={onResume}>
                {t('menu.backToLook')}
              </button>
            ) : null}
            <button ref={firstBtnRef} type="button" className="btn-ghost" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </div>

        <div className="game-menu__tabs" role="tablist" aria-label={t('menu.tabs')}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`game-menu-tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls={`game-menu-panel-${entry.id}`}
              className={`game-menu__tab${tab === entry.id ? ' game-menu__tab--active' : ''}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div
          className="game-menu__body"
          role="tabpanel"
          id={`game-menu-panel-${tab}`}
          aria-labelledby={`game-menu-tab-${tab}`}
        >
          {tab === 'howto' ? (
            <Suspense fallback={<p className="muted">{t('howto.loading')}</p>}>
              <HowToPlay playerCount={view.players.length} />
            </Suspense>
          ) : null}

          {tab === 'settings' ? (
            <>
            <PlayersPanel view={view} />
            <TableStatus view={view} connectionLabel={connectionLabel} />
            <HistoryLog view={view} />

            <section className="panel" aria-labelledby="game-menu-prefs">
              <h2 id="game-menu-prefs" className="panel__title">
                {t('menu.prefs')}
              </h2>
              <div className="game-menu__pref game-menu__pref--lang">
                <span>{t('menu.pref.language')}</span>
                <LanguageSwitch
                  value={prefs.language}
                  onChange={(language) => setPrefs({ language })}
                />
              </div>
              <label className="game-menu__pref">
                <input
                  type="checkbox"
                  checked={prefs.quality === 'low'}
                  onChange={(e) => setPrefs({ quality: e.target.checked ? 'low' : 'standard' })}
                />
                {t('menu.pref.lowQuality')}
              </label>
              <label className="game-menu__pref">
                <input
                  type="checkbox"
                  checked={prefs.reducedMotion}
                  onChange={(e) => setPrefs({ reducedMotion: e.target.checked })}
                />
                {t('menu.pref.reducedMotion')}
              </label>
              <label className="game-menu__pref">
                <input
                  type="checkbox"
                  checked={prefs.announcements}
                  onChange={(e) => setPrefs({ announcements: e.target.checked })}
                />
                {t('menu.pref.announcements')}
              </label>
              <label className="game-menu__pref">
                <input
                  type="checkbox"
                  checked={prefs.soundEnabled}
                  onChange={(e) => setPrefs({ soundEnabled: e.target.checked })}
                />
                {t('menu.pref.sound')}
              </label>
              <label className="game-menu__pref game-menu__pref--range">
                <span>{t('menu.pref.sensitivityValue', { value: prefs.sensitivity.toFixed(1) })}</span>
                <input
                  type="range"
                  min={SENSITIVITY_MIN}
                  max={SENSITIVITY_MAX}
                  step={0.1}
                  value={prefs.sensitivity}
                  aria-label={t('menu.pref.sensitivity')}
                  onChange={(e) => setPrefs({ sensitivity: Number(e.target.value) })}
                />
              </label>
              <label className="game-menu__pref">
                <input
                  type="checkbox"
                  checked={prefs.cameraMode === 'seat'}
                  onChange={(e) => setPrefs({ cameraMode: e.target.checked ? 'seat' : 'overview' })}
                />
                {t('menu.pref.seatCamera')}
              </label>
            </section>
            <p className="menu__source">
              <SourceLink className="source-link" />
            </p>

            <section className="panel" aria-labelledby="game-menu-keys">
              <h2 id="game-menu-keys" className="panel__title">
                {t('menu.keys')}
              </h2>
              <dl className="game-menu__keys">
                {KEY_ROWS.map((row) => (
                  <div key={row.keys} className="game-menu__key-row">
                    <dt>
                      <kbd>{row.keys}</kbd>
                    </dt>
                    <dd>{row.label}</dd>
                  </div>
                ))}
              </dl>
              <p className="muted">{t('menu.keysNote')}</p>
              <p className="muted">{t('menu.keysMore')}</p>
            </section>
            </>
          ) : null}

          {tab === 'dev' && DevScenarioSection ? (
            <Suspense fallback={<p className="muted">{t('menu.devLoading')}</p>}>
              <DevScenarioSection
                roomId={view.roomId}
                playerCount={view.players.length}
                // D21/K — senaryolar yalnız host tarafından uygulanabilir
                // (sunucu da reddeder); host değilse düğmeler devre dışı.
                isHost={isHost}
                onApplied={onRefresh}
              />
            </Suspense>
          ) : null}

          <div className="row game-menu__actions">
            <button type="button" className="btn-ghost" onClick={onRefresh}>
              {t('common.refresh')}
            </button>
            {canExitFocus ? (
              <button type="button" className="btn-ghost" onClick={onExitFocus}>
                {t('game.releaseFocus')}
              </button>
            ) : null}
            {isHost ? (
              <button type="button" className="btn-ghost" onClick={onReturnLobby}>
                {t('game.returnLobby')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
