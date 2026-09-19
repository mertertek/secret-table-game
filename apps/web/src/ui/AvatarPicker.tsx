/**
 * D3.4 / B3 — lobide karakter seçimi.
 *
 * Düzen: seçili karakter BÜYÜK (tek 3D Canvas, ≤9 çizim) + altında 8 küçük 2B
 * kart (yatay kaydırma, telefon öncelikli) + 3 ten örneği. Seçim ANINDA
 * `set_avatar` komutu olarak gider; sunucu yanıtı lobi görünümünü tazeler.
 *
 * Gizlilik/kural: avatar rol ima etmez, herkese açıktır. İstemci kural
 * çalıştırmaz — geçerlilik (lobide miyiz, kimlik tanınıyor mu) sunucudadır;
 * buradaki tek yerel akıl, aynı karakteri seçen başka oyuncu varsa FARKLI ten
 * ÖNERMEKtir (`suggestSkin`, sözleşme yardımcısı — zorlayıcı değil).
 */
import { Suspense, lazy, useMemo } from 'react';
import {
  AVATAR_CHARACTER_IDS,
  AVATAR_SKIN_IDS,
  suggestSkin,
  type AvatarCharacterId,
  type AvatarSelection,
  type AvatarSkinId,
} from '@secret-table/contracts';

import { useT, currentLanguage } from '../i18n';
import { avatarText, skinText, avatarLabel } from './avatarText';

/** three yalnız bu dal indirildiğinde yüklenir (lobi ilk boyamada beklemez). */
const AvatarPreview = lazy(() => import('./AvatarPreview'));

export type AvatarPickerProps = {
  /** Yerel oyuncunun mevcut (seçilmiş ya da varsayılan) karakteri. */
  value: AvatarSelection;
  /** Odadaki DİĞER oyuncuların görünen karakterleri (ten önerisi için). */
  taken: readonly AvatarSelection[];
  onChange: (next: AvatarSelection) => void;
  /** Komut uçarken kontroller kapanır (çift gönderim yok). */
  busy?: boolean;
  /** Görsel önizleme kapalıyken (test / düşük güç) yalnız kartlar çizilir. */
  preview?: boolean;
};

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toLocaleUpperCase(currentLanguage() === 'tr' ? 'tr-TR' : 'en-US'))
    .join('');
}

export function AvatarPicker({ value, taken, onChange, busy = false, preview = true }: AvatarPickerProps) {
  const t = useT();
  const text = avatarText(value.character);
  // Aynı karakteri başkası seçtiyse ten önerisi değişir; seçili karaktere
  // dokunmaz (kullanıcının açık ten tercihi korunur).
  const skinFor = useMemo(
    () => (character: AvatarCharacterId): AvatarSkinId =>
      character === value.character ? value.skin : suggestSkin(character, taken, value.skin),
    [taken, value.character, value.skin],
  );

  return (
    <section className="picker" aria-labelledby="picker-title">
      <h2 className="picker__title" id="picker-title">
        {t('picker.title')}
      </h2>

      <div className="picker__stage">
        <div className="picker__canvas" aria-hidden="true">
          {preview ? (
            <Suspense fallback={<span className="picker__chip">{initials(text.name)}</span>}>
              <AvatarPreview character={value.character} skin={value.skin} />
            </Suspense>
          ) : (
            <span className="picker__chip">{initials(text.name)}</span>
          )}
        </div>
        <p className="picker__name">{text.name}</p>
        <p className="picker__tag">{text.tagline}</p>
      </div>

      <div className="picker__row" role="radiogroup" aria-label={t('picker.character')}>
        {AVATAR_CHARACTER_IDS.map((id) => {
          const info = avatarText(id);
          const selected = id === value.character;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`picker__card${selected ? ' is-on' : ''}`}
              disabled={busy}
              onClick={() => onChange({ character: id, skin: skinFor(id) })}
              title={info.tagline}
            >
              <span className="picker__badge" style={{ background: info.accent }} aria-hidden="true">
                {initials(info.name)}
              </span>
              <span className="picker__card-name">{info.name}</span>
            </button>
          );
        })}
      </div>

      <div className="picker__skins" role="radiogroup" aria-label={t('picker.skin')}>
        {AVATAR_SKIN_IDS.map((id) => {
          const selected = id === value.skin;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`picker__skin${selected ? ' is-on' : ''}`}
              disabled={busy}
              onClick={() => onChange({ character: value.character, skin: id })}
            >
              <span className="picker__swatch" style={{ background: skinText(id).swatch }} aria-hidden="true" />
              <span className="sr-only">{skinText(id).label}</span>
            </button>
          );
        })}
      </div>

      <p className="sr-only" role="status">
        {t('picker.selected', { label: avatarLabel(value.character, value.skin) })}
      </p>
    </section>
  );
}
