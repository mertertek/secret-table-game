/**
 * Misafir kimliği: isimle katılım ekranının arkasında Supabase anonim oturumu.
 * Aynı tarayıcıdaki oturum korunur; yenileme yeni oyuncu oluşturmaz.
 * Supabase yapılandırılmadıysa yerel geliştirme sahte kimliği kullanılır.
 */

import { getSupabaseClient } from './supabaseClient';

export type GuestSession = {
  userId: string;
  /** API'ye `Authorization: Bearer <token>` olarak gider. */
  accessToken: string;
  mode: 'supabase' | 'dev';
};

const DEV_USER_KEY = 'secret-table:dev-user-id';

function devUserId(): string {
  try {
    const existing = localStorage.getItem(DEV_USER_KEY);
    if (existing) return existing;
    const id = `dev-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEV_USER_KEY, id);
    return id;
  } catch {
    return `dev-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Üretim derlemesinde tarayıcı Supabase yapılandırması (VITE_SUPABASE_URL +
 * VITE_SUPABASE_PUBLISHABLE_KEY) yoksa sessizce `dev:` kimliğine DÜŞÜLMEZ: sunucu
 * bu token'ı 401 ile reddeder ve kullanıcı anlamsız bir hata görür (2026-09-10
 * canlı 401'in kökü). Bunun yerine açık `CLIENT_NOT_CONFIGURED` hatası verilir.
 */
export const CLIENT_NOT_CONFIGURED = 'CLIENT_NOT_CONFIGURED';

/**
 * Supabase anonim giriş kotası dolduğunda (429) verilen kod. Ön izleme dağıtımı
 * herkese açık paylaşıldığında saatlik sınır tükenebilir; kullanıcı ham Supabase
 * metni yerine ne olduğunu ve kendi kopyasını çalıştırabileceğini görür.
 */
export const GUEST_LIMIT_REACHED = 'GUEST_LIMIT_REACHED';

/** Supabase hatası "oran sınırı" mı (429 ya da mesaj). */
export function isRateLimitError(error: { status?: number; message?: string } | null): boolean {
  if (!error) return false;
  if (error.status === 429) return true;
  return /rate limit|too many requests|over_request_rate/i.test(error.message ?? '');
}

export async function ensureGuestSession(
  options: { production?: boolean } = {},
): Promise<GuestSession> {
  const client = getSupabaseClient();
  if (!client) {
    const production = options.production ?? import.meta.env.PROD;
    if (production) throw new Error(CLIENT_NOT_CONFIGURED);
    const id = devUserId();
    return { userId: id, accessToken: `dev:${id}`, mode: 'dev' };
  }

  const current = await client.auth.getSession();
  let session = current.data.session;
  if (!session) {
    const created = await client.auth.signInAnonymously();
    if (created.error || !created.data.session) {
      if (isRateLimitError(created.error)) throw new Error(GUEST_LIMIT_REACHED);
      throw new Error(`Misafir oturumu açılamadı: ${created.error?.message ?? 'bilinmeyen hata'}`);
    }
    session = created.data.session;
  }
  return { userId: session.user.id, accessToken: session.access_token, mode: 'supabase' };
}

/**
 * Sunucu 401 döndürdüğünde bu tarayıcıdaki bozuk anonim oturumu bırakır.
 * Bir sonraki ensureGuestSession çağrısı yeni bir anonim oturum açar.
 */
export async function resetGuestSession(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut({ scope: 'local' });
}

/**
 * Her istek öncesi güncel access token. Supabase kipinde SDK gerekiyorsa yeniler;
 * dev kipinde sabit `dev:<id>` döner. Yenilenemezse `session.accessToken`'a düşer.
 */
export async function currentAccessToken(session: GuestSession): Promise<string> {
  if (session.mode === 'dev') return session.accessToken;
  const client = getSupabaseClient();
  if (!client) return session.accessToken;
  try {
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? session.accessToken;
  } catch {
    return session.accessToken;
  }
}
