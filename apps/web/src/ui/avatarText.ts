/**
 * D3.4 — karakter seçicisinin metinleri ve renk örnekleri.
 *
 * Kaynak `docs/design/d3/characters.json` (tasarım sahipliğinde). Renkler burada
 * KOPYALANIR, çünkü lobi paketi `@secret-table/scene`i (three) ve 47 KB'lık
 * tasarım JSON'unu indirmemelidir — B6 kuralı: giriş/lobi hafif kalır.
 * `avatarText.test.ts` bu tabloyu JSON ile karşılaştırır; tasarım değişirse
 * test kırılır.
 *
 * D23: ad/özet metinleri i18n sözlüğünden gelir (Türkçe kaynak `tr.ts`),
 * renkler dil-bağımsızdır.
 */
import type { AvatarCharacterId, AvatarSkinId } from '@secret-table/contracts';

import { currentLanguage, t, type TextKey } from '../i18n';

export type AvatarCardText = {
  /** Görünen ad (kart + önizleme başlığı). */
  name: string;
  /** Tek satır ayırt edici özet. */
  tagline: string;
  /** Karakterin vurgu rengi; kartın rozetinde kullanılır. Rol ima etmez. */
  accent: string;
};

/** Dil-bağımsız vurgu renkleri (`characters.json` ile eşleşir). */
export const AVATAR_ACCENT: Readonly<Record<AvatarCharacterId, string>> = {
  'biyikli-amca': '#7a2a3a',
  gozluklu: '#c9973a',
  topuzlu: '#2e7a5a',
  fotr: '#25355a',
  sakalli: '#d97b2f',
  kivircik: '#7a4f9e',
  'bereli-teyze': '#e6a0b8',
  'kepli-cocuk': '#8ec5df',
};

/** Ten tonu `characters.json` `skins[].base` renkleri (dil-bağımsız). */
export const SKIN_SWATCH: Readonly<Record<AvatarSkinId, string>> = {
  acik: '#f1c9a3',
  orta: '#c98f62',
  koyu: '#7d4b30',
};

export function avatarText(character: AvatarCharacterId): AvatarCardText {
  return {
    name: t(`avatar.${character}.name` as TextKey),
    tagline: t(`avatar.${character}.tagline` as TextKey),
    accent: AVATAR_ACCENT[character],
  };
}

export type SkinText = { label: string; swatch: string };

export function skinText(skin: AvatarSkinId): SkinText {
  return { label: t(`skin.${skin}` as TextKey), swatch: SKIN_SWATCH[skin] };
}

/** Kart/rozet için görünen ad. */
export function avatarName(character: AvatarCharacterId): string {
  return avatarText(character).name;
}

/** Ekran okuyucu için "Fötr, koyu ten" biçimi. */
export function avatarLabel(character: AvatarCharacterId, skin: AvatarSkinId): string {
  const locale = currentLanguage() === 'tr' ? 'tr-TR' : 'en-US';
  return t('avatar.label', {
    name: avatarName(character),
    skin: skinText(skin).label.toLocaleLowerCase(locale),
  });
}
