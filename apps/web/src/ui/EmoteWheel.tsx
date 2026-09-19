/**
 * D16 — dairesel jest menüsü (çark).
 *
 * Ekranın ortasında 8 dilim: ikon + etiket, ortada seçili jestin adı. Yarı
 * saydam koyu zemin (D9 duyuru diliyle aynı), sahne arkada görünür kalır.
 * Seçim: fare (Pointer Lock'ta delta, kilitsizken imleç), ok/WASD, `1–8`,
 * sol tık / Enter; `G` basılı tutup bırakınca vurgulu dilim seçilir.
 *
 * Tuş yönetimi `useTableControls` + `useEmoteWheel` içindedir; burada yalnız
 * çizim ve dokunma/tıklama yüzeyi var.
 */
import { useRef } from 'react';
import { EMOTE_KINDS, EMOTE_SYMBOL } from '@secret-table/contracts';

import { useLanguage, useT } from '../i18n';
import { emoteLabel } from './emoteText';
import { EMOTE_SLOTS, slicePath, sliceVector } from '../immersive/emoteWheel';
import type { EmoteWheel as EmoteWheelState } from '../immersive/useEmoteWheel';

export function EmoteWheel({ wheel }: { wheel: EmoteWheelState }) {
  /**
   * D21/G — `pointerdown` + `click` BİRLİKTE dinlenir ama iş bir kez yapılır.
   *
   * Eskiden yalnız `onPointerDown` vardı; Pointer Events'i vermeyen / sentetik
   * tıklama üreten yollarda (eski WebView, yardımcı teknoloji, klavye ile
   * "Geri" düğmesini etkinleştirme, jsdom testleri) çark kapanmıyordu. `click`
   * yedek yoldur: `pointerdown` zaten kapattıysa aynı jestin `click`'i yutulur.
   */
  const t = useT();
  useLanguage();
  const handledAt = useRef(0);
  const closeOnce = (event: { preventDefault: () => void; stopPropagation: () => void }): void => {
    event.preventDefault();
    event.stopPropagation();
    const now = Date.now();
    // Aynı jestin ikinci olayı (pointerdown → click) ~300 ms içinde gelir.
    if (now - handledAt.current < 300) return;
    handledAt.current = now;
    wheel.close();
  };

  if (!wheel.open) return null;
  const outer = wheel.size / 2;
  const inner = outer * .38;
  const labelR = (outer + inner) / 2;
  const focused = wheel.index === null ? null : EMOTE_KINDS[wheel.index] ?? null;
  return (
    <div
      className="emote-wheel"
      role="dialog"
      aria-label={t('emote.menu')}
      // D18 madde 5 — zemine DOKUNMA da menüyü kapatır. Eskiden yalnız
      // `mousedown` dinleniyordu; telefonda dilim seçilmezse çark ekranın
      // ortasında kalıyordu (E2E bulgu 5). `pointerdown` fare + dokunma +
      // kalemi birlikte karşılar; dilimler kendi işleyicisini kullanır.
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeOnce(event);
      }}
      // D21/G — `pointerdown` desteklenmeyen / sentetik tıklama üreten yollar
      // için yedek. `closeOnce` çift tetiklemeyi yutar.
      onClick={(event) => {
        if (event.target === event.currentTarget) closeOnce(event);
      }}
    >
      <div className="emote-wheel__dial" style={{ width: wheel.size, height: wheel.size }}>
        <svg viewBox={`${-outer} ${-outer} ${wheel.size} ${wheel.size}`} width={wheel.size} height={wheel.size} aria-hidden="true">
          {EMOTE_KINDS.map((kind, slot) => (
            <path
              key={kind}
              d={slicePath(slot, outer - 2, inner, EMOTE_SLOTS)}
              className={`emote-wheel__slice${slot === wheel.index ? ' is-active' : ''}`}
              onMouseEnter={() => wheel.hover(slot)}
              onMouseDown={(event) => { event.preventDefault(); wheel.pick(slot); }}
              onTouchStart={(event) => { event.preventDefault(); wheel.pick(slot); }}
            />
          ))}
          {wheel.index !== null ? (
            <circle
              className="emote-wheel__cursor"
              cx={sliceVector(wheel.index).x * labelR}
              cy={sliceVector(wheel.index).y * labelR}
              r={4}
            />
          ) : null}
        </svg>
        {EMOTE_KINDS.map((kind, slot) => {
          const v = sliceVector(slot);
          return (
            <button
              key={kind}
              type="button"
              className={`emote-wheel__chip${slot === wheel.index ? ' is-active' : ''}`}
              style={{ left: `calc(50% + ${(v.x * labelR).toFixed(1)}px)`, top: `calc(50% + ${(v.y * labelR).toFixed(1)}px)` }}
              aria-pressed={slot === wheel.index}
              onMouseEnter={() => wheel.hover(slot)}
              onMouseDown={(event) => { event.preventDefault(); wheel.pick(slot); }}
              onClick={(event) => event.preventDefault()}
            >
              <kbd>{slot + 1}</kbd>
              <span className="emote-wheel__icon" aria-hidden="true">{EMOTE_SYMBOL[kind]}</span>
              <span className="emote-wheel__label">{emoteLabel(kind)}</span>
            </button>
          );
        })}
        <div className="emote-wheel__hub" style={{ width: inner * 2, height: inner * 2 }}>
          <strong>{focused ? emoteLabel(focused) : t('emote.pick')}</strong>
          <small>{focused ? t('emote.confirm') : t('emote.hint')}</small>
        </div>
      </div>
      {/* D18 madde 5 — telefonda `Esc` yok: çarkın kendi çıkış yolu.
          Göbeğin dışında, dilimlerin altında; yanlışlıkla jest seçtirmez. */}
      <button
        type="button"
        className="emote-wheel__back"
        onPointerDown={closeOnce}
        // D21/G — yedek yol (klavye ile etkinleştirme, sentetik tıklama).
        onClick={closeOnce}
      >
        {t('emote.back')}
      </button>
    </div>
  );
}
