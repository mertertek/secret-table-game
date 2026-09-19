/**
 * Vercel Node Function imza tipleri (yerel, bağımsız).
 *
 * Vercel'in `@vercel/node` paketiyle yapısal olarak uyumludur: `VercelRequest`
 * `IncomingMessage`'ı, `VercelResponse` `ServerResponse`'u genişletir ve
 * `.status()/.json()/.send()` yardımcılarını ekler. Aynı handler dosyası hem
 * yerel dev köprüsünde (vite/apiPlugin.ts) hem de gerçek Vercel'de çalışır.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

export type ApiRequest = IncomingMessage & {
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
  body?: unknown;
};

export type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  send: (body: unknown) => ApiResponse;
};

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => unknown | Promise<unknown>;
