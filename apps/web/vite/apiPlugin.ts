/**
 * Yerel geliştirmede `apps/web/api/*.ts` Vercel Function girişlerini Vite dev
 * sunucusuna bağlar. Böylece `pnpm dev` ile `/api/*` uçları hesap/CLI olmadan
 * çalışır. Üretimde bu uçları Vercel'in kendi Node çalışma ortamı sunar;
 * dağıtım pariteli yerel çalışma için `vercel dev` de kullanılabilir (README).
 */

import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

type VercelLikeHandler = (req: unknown, res: unknown) => unknown | Promise<unknown>;

export type VercelApiDevOptions = {
  /** `api/` dizininin mutlak yolu. */
  apiDir: string;
  /**
   * Kök `.env` dizini. Verilirse `SUPABASE_URL` gibi ÖNEKSİZ sunucu değişkenleri
   * yalnız bu dev sürecinin `process.env`'ine yüklenir (tarayıcı paketine girmez);
   * böylece `pnpm dev` için `.env`'i elle `source` etmek gerekmez.
   */
  envDir?: string;
};

export function vercelApiDev({ apiDir, envDir }: VercelApiDevOptions): Plugin {
  return {
    name: 'secret-table:vercel-api-dev',
    apply: 'serve',
    configureServer(server) {
      // D14 — geliştirici senaryo atlaması (`dev_scenario`) YALNIZ yerel dev
      // sürecinde açılır. `.env` dosyasına yazılmaz; yalnız bu sürecin belleğine
      // konur. Vercel'de bu değişken ASLA ayarlanmaz (docs/DEPLOYMENT.md).
      process.env.SECRET_TABLE_DEV_TOOLS = '1';
      // Tarayıcı kapısı da yerelde açık (devTools.ts `import.meta.env.DEV` zaten true).
      if (envDir) {
        // Yalnız Function tarafı için: mevcut ortam değişkenleri üstün, .env boşlukları doldurur.
        const env = loadEnv(server.config.mode, envDir, '');
        for (const [key, value] of Object.entries(env)) {
          if (process.env[key] === undefined) process.env[key] = value;
        }
      }
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? '';
        if (!rawUrl.startsWith('/api/') && rawUrl !== '/api') {
          next();
          return;
        }

        void handleApiRequest({ apiDir, server, req, res }).catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          server.ssrFixStacktrace(err);
          server.config.logger.error(`[vercel-api-dev] ${err.stack ?? err.message}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=utf-8');
          }
          if (!res.writableEnded) {
            res.end(JSON.stringify({ error: 'DEV_HANDLER_ERROR', message: err.message }));
          }
        });
      });
    },
  };
}

type HandleArgs = {
  apiDir: string;
  server: ViteDevServer;
  req: IncomingMessage;
  res: ServerResponse;
};

async function handleApiRequest({ apiDir, server, req, res }: HandleArgs): Promise<void> {
  const [pathname = '/api', rawQuery = ''] = (req.url ?? '/api').split('?');
  const routePath = pathname.slice('/api/'.length).replace(/\/+$/u, '');
  const file = resolveApiFile(apiDir, routePath);

  if (!file) {
    res.statusCode = 404;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'NOT_FOUND', message: `/api/${routePath} için uç yok` }));
    return;
  }

  const module = await server.ssrLoadModule(file);
  const handler = module.default as VercelLikeHandler | undefined;
  if (typeof handler !== 'function') {
    throw new Error(`${file}: default export bir fonksiyon değil`);
  }

  const rawBody = await readRequestBody(req);
  const vercelReq = Object.assign(req, {
    query: parseQuery(rawQuery),
    cookies: parseCookies(req.headers.cookie ?? ''),
    body: parseBody(req.headers['content-type'] ?? '', rawBody),
  });
  const vercelRes = decorateResponse(res);

  await handler(vercelReq, vercelRes);
  if (!res.writableEnded) {
    res.end();
  }
}

function resolveApiFile(apiDir: string, routePath: string): string | null {
  const safe = routePath.replace(/\.\.(?:\/|\\|$)/gu, '');
  const candidates = safe
    ? [path.join(apiDir, `${safe}.ts`), path.join(apiDir, safe, 'index.ts')]
    : [path.join(apiDir, 'index.ts')];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function parseQuery(rawQuery: string): Record<string, string | string[]> {
  const params = new URLSearchParams(rawQuery);
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length > 1 ? values : (values[0] ?? '');
  }
  return query;
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (key) cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseBody(contentType: string, raw: Buffer): unknown {
  if (raw.length === 0) return undefined;
  const text = raw.toString('utf8');
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  return text;
}

function decorateResponse(res: ServerResponse): ServerResponse {
  const withHelpers = res as ServerResponse & {
    status: (code: number) => ServerResponse;
    json: (body: unknown) => ServerResponse;
    send: (body: unknown) => ServerResponse;
  };
  withHelpers.status = (code) => {
    res.statusCode = code;
    return withHelpers;
  };
  withHelpers.json = (body) => {
    if (!res.getHeader('content-type')) {
      res.setHeader('content-type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(body));
    return withHelpers;
  };
  withHelpers.send = (body) => {
    if (body !== null && typeof body === 'object') return withHelpers.json(body);
    res.end(body === undefined ? '' : String(body));
    return withHelpers;
  };
  return withHelpers;
}
