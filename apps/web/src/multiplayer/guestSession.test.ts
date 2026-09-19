// @vitest-environment jsdom
/**
 * A0 (docs/ROADMAP.md): üretim derlemesinde tarayıcı Supabase yapılandırması
 * yoksa `dev:` kimliğine düşülmez; açık `CLIENT_NOT_CONFIGURED` hatası verilir.
 * Yerel geliştirmede dev kimliği korunur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ client: null as null | Record<string, unknown> }));
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => mock.client,
  isSupabaseConfigured: () => mock.client !== null,
}));

import { CLIENT_NOT_CONFIGURED, GUEST_LIMIT_REACHED, ensureGuestSession, isRateLimitError,
  resetGuestSession } from './guestSession';
import { errorText } from '../ui/text';

/** jsdom localStorage yerine belirlenimci bellek deposu (dev kimliği kalıcılığı için). */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => {
  mock.client = null;
  vi.unstubAllGlobals();
});

describe('ensureGuestSession without browser Supabase config', () => {
  it('throws CLIENT_NOT_CONFIGURED in production instead of a dev token', async () => {
    await expect(ensureGuestSession({ production: true })).rejects.toThrow(CLIENT_NOT_CONFIGURED);
  });

  it('maps the error to a Turkish message naming the VITE variables', () => {
    const text = errorText(CLIENT_NOT_CONFIGURED);
    expect(text).toContain('VITE_SUPABASE_URL');
    expect(text).not.toBe(CLIENT_NOT_CONFIGURED);
  });

  it('keeps the stable dev identity in local development', async () => {
    const a = await ensureGuestSession({ production: false });
    const b = await ensureGuestSession({ production: false });
    expect(a.mode).toBe('dev');
    expect(a.accessToken).toBe(`dev:${a.userId}`);
    expect(b.userId).toBe(a.userId);
  });

  it('resetGuestSession is a no-op without a client', async () => {
    await expect(resetGuestSession()).resolves.toBeUndefined();
  });
});

describe('ensureGuestSession with a Supabase client', () => {
  it('reuses the existing session and never signs in twice', async () => {
    const signInAnonymously = vi.fn();
    mock.client = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'u1' }, access_token: 't1' } } }),
        signInAnonymously,
      },
    };
    const s = await ensureGuestSession({ production: true });
    expect(s).toEqual({ userId: 'u1', accessToken: 't1', mode: 'supabase' });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('opens a new anonymous session when none exists', async () => {
    mock.client = {
      auth: {
        getSession: async () => ({ data: { session: null } }),
        signInAnonymously: async () => ({
          error: null,
          data: { session: { user: { id: 'u2' }, access_token: 't2' } },
        }),
      },
    };
    const s = await ensureGuestSession({ production: true });
    expect(s.userId).toBe('u2');
    expect(s.mode).toBe('supabase');
  });
});

describe('D26 — misafir kotası (429)', () => {
  it('oran sınırı hatalarını tanır, diğerlerini tanımaz', () => {
    expect(isRateLimitError({ status: 429, message: 'nope' })).toBe(true);
    expect(isRateLimitError({ message: 'email rate limit exceeded' })).toBe(true);
    expect(isRateLimitError({ message: 'Too Many Requests' })).toBe(true);
    expect(isRateLimitError({ message: 'over_request_rate_limit' })).toBe(true);
    expect(isRateLimitError({ status: 400, message: 'bad grant' })).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });

  it('anonim giriş 429 verince GUEST_LIMIT_REACHED fırlatır', async () => {
    mock.client = {
      auth: {
        getSession: async () => ({ data: { session: null } }),
        signInAnonymously: async () => ({
          data: { session: null },
          error: { status: 429, message: 'over_request_rate_limit' },
        }),
      },
    };
    await expect(ensureGuestSession({ production: true })).rejects.toThrow(GUEST_LIMIT_REACHED);
  });

  it('başka bir giriş hatasında ham mesajı korur', async () => {
    mock.client = {
      auth: {
        getSession: async () => ({ data: { session: null } }),
        signInAnonymously: async () => ({
          data: { session: null },
          error: { status: 400, message: 'bad grant' },
        }),
      },
    };
    await expect(ensureGuestSession({ production: true })).rejects.toThrow(/bad grant/);
  });
});

describe('D26 — kota mesajı iki dilde', () => {
  it('ham kod yerine yönlendiren metin döner', () => {
    const text = errorText(GUEST_LIMIT_REACHED);
    expect(text).not.toBe(GUEST_LIMIT_REACHED);
    expect(text).toContain('docs/SETUP.md');
  });
});
