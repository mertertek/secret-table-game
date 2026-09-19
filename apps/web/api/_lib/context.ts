/**
 * API isteği bağlamı: hangi kalıcılık, kimlik doğrulaması ve GameService.
 *
 * - `SUPABASE_URL` + `SUPABASE_SECRET_KEY` tanımlıysa: `SupabaseGateway` +
 *   Supabase Auth token doğrulaması (misafir anonim oturum). Üretim yolu budur.
 * - Aksi halde YALNIZ yerel geliştirmede: süreç ömrü boyunca yaşayan
 *   `InMemoryGateway` + `Authorization: Bearer dev:<userId>` sahte kimliği.
 *
 * Yerel geliştirme düşüşü (dev kimliği + bellek) Vercel preview/production'da
 * ASLA devreye girmez — `SECRET_TABLE_ALLOW_DEV_AUTH=1` verilse bile. Kapıyı
 * `VERCEL_ENV` (`production` | `preview`) belirler. Gerçek bir dağıtımda Supabase
 * yapılandırması eksikse istek `503 SUPABASE_NOT_CONFIGURED` alır; sessizce
 * kimliksiz/kalıcılıksız çalışmaz. Bayrak yalnız yerel çalışmada ve `vercel dev`
 * (`VERCEL_ENV=development`) gibi bilinçli parite senaryolarında geçerlidir.
 */

import { GameService, InMemoryGateway, SupabaseGateway } from '@secret-table/server';

import type { ApiRequest } from './types.js';

export type ApiMode = 'supabase' | 'memory';

export type RequestContext = {
  mode: ApiMode;
  service: GameService;
  userId: string;
};

let memoryService: GameService | null = null;

function getMemoryService(): GameService {
  if (!memoryService) {
    memoryService = new GameService(new InMemoryGateway(), {
      reconnectSeconds: Number(process.env.ROOM_RECONNECT_SECONDS ?? 600),
    });
  }
  return memoryService;
}

/**
 * Supabase yapılandırılmamışken `dev:` kimliği + `InMemoryGateway` düşüşüne izin
 * verilir mi?
 *
 * Karar sırası:
 *  1. Vercel `preview`/`production`: HER ZAMAN `false` — `SECRET_TABLE_ALLOW_DEV_AUTH`
 *     bayrağı bu ortamlarda yok sayılır.
 *  2. Açık `SECRET_TABLE_ALLOW_DEV_AUTH=1`: `true` (yerel + `vercel dev` parite).
 *  3. Bayrak yoksa, Vercel'in diğer bağlamlarında (`development` vb.): `false`.
 *  4. Yerel: yalnız production build değilse `true`.
 */
export function devAuthAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return false;
  if (env.SECRET_TABLE_ALLOW_DEV_AUTH === '1') return true;
  if (env.VERCEL) return false;
  return env.NODE_ENV !== 'production';
}

/** Boş / örnek / yer tutucu değeri "tanımsız" say. */
function realEnv(raw: string | undefined): string | undefined {
  const v = (raw ?? '').trim();
  if (!v || v.includes('__FILL_ME__') || v.includes('YOUR-') || v.includes('YOUR_PROJECT')) {
    return undefined;
  }
  return v;
}

function bearerToken(req: ApiRequest): string | null {
  const header = req.headers.authorization ?? req.headers.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !value.toLowerCase().startsWith('bearer ')) return null;
  return value.slice(7).trim();
}

export async function resolveContext(
  req: ApiRequest,
): Promise<{ ok: true; context: RequestContext } | { ok: false; status: number; error: string }> {
  const supabaseUrl = realEnv(process.env.SUPABASE_URL);
  const supabaseSecret = realEnv(process.env.SUPABASE_SECRET_KEY);
  const token = bearerToken(req);

  if (!token) {
    return { ok: false, status: 401, error: 'MISSING_TOKEN' };
  }

  if (supabaseUrl && supabaseSecret) {
    // Verify the session with Supabase Auth, never with caller-supplied userId.
    // Direct HTTP avoids the SDK's inherited AuthClient type resolution in Vercel.
    let user: unknown;
    try {
      const response = await fetch(new URL('/auth/v1/user', supabaseUrl), {
        headers: { apikey: supabaseSecret, Authorization: `Bearer ${token}` },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 401 || response.status === 403) {
        return { ok: false, status: 401, error: 'SESSION_INVALID' };
      }
      if (!response.ok) {
        return { ok: false, status: 503, error: 'SERVICE_UNAVAILABLE' };
      }
      user = await response.json();
    } catch {
      return { ok: false, status: 503, error: 'SERVICE_UNAVAILABLE' };
    }
    if (!user || typeof user !== 'object' || !('id' in user) ||
        typeof user.id !== 'string' || !user.id.trim()) {
      return { ok: false, status: 503, error: 'SERVICE_UNAVAILABLE' };
    }
    const service = new GameService(new SupabaseGateway({ url: supabaseUrl, secretKey: supabaseSecret }), {
      reconnectSeconds: Number(process.env.ROOM_RECONNECT_SECONDS ?? 600),
    });
    return { ok: true, context: { mode: 'supabase', service, userId: user.id } };
  }

  // Supabase yapılandırılmamış. Yalnız yerel geliştirmede dev kimliği kabul edilir.
  if (!devAuthAllowed()) {
    return { ok: false, status: 503, error: 'SUPABASE_NOT_CONFIGURED' };
  }

  if (token.startsWith('dev:')) {
    const userId = token.slice(4).trim();
    if (!userId) return { ok: false, status: 401, error: 'SESSION_INVALID' };
    return { ok: true, context: { mode: 'memory', service: getMemoryService(), userId } };
  }

  return { ok: false, status: 503, error: 'SUPABASE_NOT_CONFIGURED' };
}
