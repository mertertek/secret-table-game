import { CONTRACT_VERSION, PROTOCOL_VERSION } from '@secret-table/contracts';

import type { ApiHandler } from './_lib/types.js';

/**
 * GET /api/health — sağlık kontrolü. Gizli değer içermez.
 * Vercel'de Node çalışma ortamında; yerelde vite/apiPlugin.ts köprüsünde çalışır.
 */
const handler: ApiHandler = (req, res) => {
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({
    ok: true,
    service: 'secret-table-api',
    protocolVersion: PROTOCOL_VERSION,
    contractVersion: CONTRACT_VERSION,
    method: req.method ?? 'GET',
    time: new Date().toISOString(),
  });
};

export default handler;
