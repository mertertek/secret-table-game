import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, symlink, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const stage = await mkdtemp(join(tmpdir(), 'secret-table-runtime-'));
try {
  await writeFile(join(stage, 'package.json'), '{"type":"module"}');
  for (const name of ['contracts', 'game-core', 'server']) {
    const dest = join(stage, 'node_modules/@secret-table', name);
    await mkdir(dest, { recursive: true });
    // Deliberately exclude src/. This reproduces the production package boundary.
    await cp(join(root, 'packages', name, 'package.json'), join(dest, 'package.json'));
    await cp(join(root, 'packages', name, 'dist'), join(dest, 'dist'), { recursive: true });
  }
  for (const [owner, dep] of [['contracts', 'zod'], ['server', '@supabase/supabase-js']]) {
    const require = createRequire(join(root, 'packages', owner, 'package.json'));
    const dest = join(stage, 'node_modules', dep);
    await mkdir(dirname(dest), { recursive: true });
    await symlink(dirname(require.resolve(`${dep}/package.json`)), dest, 'dir');
  }
  await build({
    absWorkingDir: root,
    entryPoints: ['apps/web/api/health.ts', 'apps/web/api/game.ts'],
    outdir: join(stage, 'api'),
    bundle: true, packages: 'external', platform: 'node', format: 'esm',
    target: 'node20', logLevel: 'silent',
  });
  await writeFile(join(stage, 'probe.mjs'), `
import assert from 'node:assert/strict';
import health from './api/health.js';
import game from './api/game.js';
import { CONTRACT_VERSION } from '@secret-table/contracts';
import { gameCommandSchema } from '@secret-table/contracts/schemas';
import { GameService } from '@secret-table/server';
import { createGame } from '@secret-table/game-core';
assert.equal(CONTRACT_VERSION, '0.2.0');
assert.equal(typeof gameCommandSchema.safeParse, 'function');
assert.equal(typeof GameService, 'function');
assert.equal(typeof createGame, 'function');
assert.ok(import.meta.resolve('@secret-table/contracts/schemas').endsWith('/dist/schemas.js'));
async function invoke(handler, method, body, token) {
  let status = 200, data, headers = {};
  const res = { setHeader(k,v) { headers[k] = v; }, status(v) { status=v; return this; }, json(v) { data=v; return this; } };
  await handler({ method, body, headers: token ? { authorization: 'Bearer '+token } : {} }, res);
  return { status, data, headers };
}
const h = await invoke(health, 'GET');
assert.equal(h.status, 200); assert.equal(h.data.ok, true);
assert.equal(h.headers['cache-control'], 'no-store');
assert.equal((await invoke(game, 'GET')).status, 405);
assert.equal((await invoke(game, 'POST', {action:'create_room'})).status, 401);
const closed = await invoke(game, 'POST', {action:'create_room'}, 'dev:test');
assert.equal(closed.status, 503); assert.equal(closed.data.error, 'SUPABASE_NOT_CONFIGURED');
// Local-only memory path exercises the real compiled room handler without secrets/network.
delete process.env.VERCEL; delete process.env.VERCEL_ENV; process.env.NODE_ENV='test';
const created = await invoke(game, 'POST', {action:'create_room', displayName:'Runtime QA'}, 'dev:runtime-host');
assert.equal(created.status, 200); assert.equal(created.data.mode, 'memory');
assert.ok(created.data.roomId); assert.ok(created.data.inviteCode);
const joined = await invoke(game, 'POST', {action:'join_room', displayName:'Guest', inviteCode:created.data.inviteCode}, 'dev:runtime-guest');
assert.equal(joined.status, 200); assert.equal(joined.data.roomId, created.data.roomId);
console.log('PASS: source-free Node imports, health, API guards, create/join room');
`);
  const result = spawnSync(process.execPath, [join(stage, 'probe.mjs')], {
    cwd: stage, encoding: 'utf8',
    env: { PATH: process.env.PATH, NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production' },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, 'isolated production runtime failed');
} finally {
  await rm(stage, { recursive: true, force: true });
}
