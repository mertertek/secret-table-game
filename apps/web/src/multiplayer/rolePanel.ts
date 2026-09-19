/**
 * Özel bilgi ("rolün") panelinin açık/kapalı durumunun tek kaynağı uygulamadır
 * (docs/CONTRACT.md § 5). Sahne kontrolü ("Kimliği aç/kapat"), HTML kontrolü
 * ("Göster/Gizle") ve klavye kısayolu (H) hepsi aynı bu çözüme gider; biri
 * diğerinin gizleme işlemini tersine çevirmez (QA-R02).
 */

import type { SceneIntent } from '@secret-table/contracts';

type InspectOwnRole = Extract<SceneIntent, { type: 'inspect_own_role' }>;

/**
 * `inspect_own_role` niyetinden sonraki panel durumu.
 *
 * - `open` verildiyse yön kesindir. Kontrollü sahne her iki yönü de açıkça verir
 *   (`open: !roleOpen`), böylece "Kimliği kapat" HTML panelini yeniden açmaz.
 * - `open` verilmediyse (yönsüz, eski/bağımsız sahne veya prototip): niyet
 *   **her zaman "aç"** demektir; `!current` toggle tahminine dönüştürülmez
 *   (CODEX-012 / FINISH_PLAN §3 geriye uyum).
 *
 * `current` imza gereği alınır (çağıran yeri okunur kılar) ama yalnız açık yön
 * bilgisi belirleyicidir.
 */
export function nextRolePanelOpen(current: boolean, intent: InspectOwnRole): boolean {
  void current;
  return intent.open ?? true;
}
