/**
 * D23 — jest etiketleri iki dilde.
 *
 * Sözleşmedeki `EMOTE_LABELS` (Türkçe) SİLİNMEZ; sunucu/sözleşme tarafı
 * değişmeden kalır. Web tarafı aynı `EmoteKind` kodunu oyuncunun diline
 * çevirir; sembol (`EMOTE_SYMBOL`) dil-bağımsızdır.
 */
import type { EmoteKind } from '@secret-table/contracts';

import { t, type TextKey } from '../i18n';

export function emoteLabel(kind: EmoteKind): string {
  return t(`emote.${kind}` as TextKey);
}
