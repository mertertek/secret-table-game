/**
 * Geliştirici araçları kapısı (bot modu, `/dev/*` sayfaları, "Geliştirici" menüsü).
 *
 * Yerel geliştirmede (`import.meta.env.DEV`) her zaman açık. Vercel'de test için
 * geçici olarak `VITE_ST_DEV_TOOLS=1` (tarayıcı) + `SECRET_TABLE_DEV_TOOLS=1` (API)
 * ayarlanabilir; ikisi de statik derleme sabiti olduğu için değişken YOKKEN bu
 * ifade `false`a katlanır ve bağlı dallar/chunk'lar üretim paketine girmez.
 * Kullanıcı kararı 2026-09-12: geçici, sonra kaldırılacak.
 */
export const DEV_TOOLS: boolean = import.meta.env.DEV || import.meta.env.VITE_ST_DEV_TOOLS === '1';
