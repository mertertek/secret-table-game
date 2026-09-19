import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiRequest } from './types.js';
import { devAuthAllowed, resolveContext } from './context.js';

/**
 * Güvenlik kapısı: Supabase yapılandırılmamışken `dev:` kimliği +
 * `InMemoryGateway` düşüşü YALNIZ yerel/parite senaryolarında açık olmalı.
 * Vercel preview/production'da bayrak verilse bile ASLA açılmaz.
 */
describe('devAuthAllowed', () => {
  it('yerel geliştirmede (Vercel yok, NODE_ENV production değil) açık', () => {
    expect(devAuthAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(devAuthAllowed({})).toBe(true);
    expect(devAuthAllowed({ NODE_ENV: 'test' })).toBe(true);
  });

  it('Vercel preview/production: bayrak OLSA BİLE kapalı', () => {
    expect(devAuthAllowed({ VERCEL: '1', VERCEL_ENV: 'production' })).toBe(false);
    expect(devAuthAllowed({ VERCEL: '1', VERCEL_ENV: 'preview' })).toBe(false);
    expect(
      devAuthAllowed({ VERCEL: '1', VERCEL_ENV: 'production', SECRET_TABLE_ALLOW_DEV_AUTH: '1' }),
    ).toBe(false);
    expect(
      devAuthAllowed({ VERCEL: '1', VERCEL_ENV: 'preview', SECRET_TABLE_ALLOW_DEV_AUTH: '1' }),
    ).toBe(false);
    // NODE_ENV genelde production olur; yine de kapı VERCEL_ENV.
    expect(
      devAuthAllowed({
        VERCEL: '1',
        VERCEL_ENV: 'production',
        NODE_ENV: 'production',
        SECRET_TABLE_ALLOW_DEV_AUTH: '1',
      }),
    ).toBe(false);
  });

  it('Vercel (VERCEL var, VERCEL_ENV preview/production değil) bayraksız kapalı', () => {
    expect(devAuthAllowed({ VERCEL: '1' })).toBe(false);
    expect(devAuthAllowed({ VERCEL: '1', VERCEL_ENV: 'development' })).toBe(false);
    expect(devAuthAllowed({ VERCEL: '1', NODE_ENV: 'development' })).toBe(false);
  });

  it('`vercel dev` paritesi: VERCEL_ENV=development + bayrak → açık', () => {
    expect(
      devAuthAllowed({ VERCEL: '1', VERCEL_ENV: 'development', SECRET_TABLE_ALLOW_DEV_AUTH: '1' }),
    ).toBe(true);
  });

  it('NODE_ENV production (Vercel dışı) iken kapalı', () => {
    expect(devAuthAllowed({ NODE_ENV: 'production' })).toBe(false);
  });

  it('yerel opt-in (SECRET_TABLE_ALLOW_DEV_AUTH=1, Vercel dışı) açık', () => {
    expect(devAuthAllowed({ SECRET_TABLE_ALLOW_DEV_AUTH: '1' })).toBe(true);
    expect(devAuthAllowed({ NODE_ENV: 'production', SECRET_TABLE_ALLOW_DEV_AUTH: '1' })).toBe(true);
  });
});


describe('Supabase session verification', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://auth-test.example');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'test-server-key');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const request = (): ApiRequest => Object.assign(new IncomingMessage(new Socket()), {
    headers: { authorization: 'Bearer test-session' }, body: { userId: 'forged' }, query: {}, cookies: {},
  });

  it('uses only the Auth server identity and sends the session token separately', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'verified-user' })));
    const result = await resolveContext(request());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.userId).toBe('verified-user');
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://auth-test.example/auth/v1/user'), expect.objectContaining({
      headers: { apikey: 'test-server-key', Authorization: 'Bearer test-session' },
      cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal),
    }));
  });
  it.each([401, 403])('rejects invalid sessions (%s)', async (status) => {
    fetchMock.mockResolvedValue(new Response('{}', { status }));
    expect(await resolveContext(request())).toEqual({ ok: false, status: 401, error: 'SESSION_INVALID' });
  });
  it.each([429, 500])('fails closed when Auth is unavailable (%s)', async (status) => {
    fetchMock.mockResolvedValue(new Response('{}', { status }));
    expect(await resolveContext(request())).toEqual({ ok: false, status: 503, error: 'SERVICE_UNAVAILABLE' });
  });
  it.each([{}, { id: '' }, { id: 123 }])('rejects malformed Auth identity %j', async (body) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body)));
    expect(await resolveContext(request())).toEqual({ ok: false, status: 503, error: 'SERVICE_UNAVAILABLE' });
  });
  it('handles network failures without leaking error text', async () => {
    fetchMock.mockRejectedValue(new Error('private transport detail'));
    expect(await resolveContext(request())).toEqual({ ok: false, status: 503, error: 'SERVICE_UNAVAILABLE' });
  });
  it('does not call Auth without a session token', async () => {
    const req = request();
    req.headers = {};
    expect(await resolveContext(req)).toEqual({ ok: false, status: 401, error: 'MISSING_TOKEN' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
