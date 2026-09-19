/**
 * D23/D28 — test ortamının dili.
 *
 * Uygulamanın varsayılanı İNGİLİZCEDİR (`DEFAULT_LANGUAGE`). Mevcut testler
 * kaynak dildeki (Türkçe) metni bekler, bu yüzden testler Türkçede koşar:
 * `usePrefs` kayıt yokken O ANKİ dili alır, burada onu Türkçeye sabitliyoruz.
 * Üretim davranışı değişmez. Dil seçimini sınayan testler kendi ayarını yapar.
 */
import { setLanguage } from '../src/i18n';

setLanguage('tr');
