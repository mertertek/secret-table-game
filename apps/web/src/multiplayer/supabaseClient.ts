/**
 * Tarayıcı Supabase istemcisi (publishable anahtar; RLS/kimlik kontrolleriyle).
 *
 * İskelet: gerçek misafir oturumu, özel Realtime kanalı aboneliği, sürüm sinyali
 * ve yeniden bağlanma C03'te eklenir. Ortam değişkeni yoksa `null` döner;
 * uygulama bu durumda çevrimdışı/geliştirme kiplerinde çalışabilir.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** Boş, örnek veya yer tutucu değerleri "yapılandırılmamış" say. */
function realValue(raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (v.includes('__FILL_ME__') || v.includes('YOUR-') || v.includes('YOUR_PROJECT')) return null;
  return v;
}

function config(): { url: string; key: string } | null {
  const url = realValue(import.meta.env.VITE_SUPABASE_URL);
  const key = realValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return url && key ? { url, key } : null;
}

/**
 * Ham tarayıcı yapılandırması (URL + publishable anahtar). Paylaşılan istemciden
 * AYRI istemci kuran çağıranlar içindir (örn. yalnız DEV bot koşucusu); yer
 * tutucu/boş değerler yine `null` sayılır.
 */
export function getSupabaseConfig(): { url: string; key: string } | null {
  return config();
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cached) return cached;
  const c = config();
  if (!c) return null;

  cached = createClient(c.url, c.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return config() !== null;
}
