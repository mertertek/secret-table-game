/** D1 tur 6 — 13 kavrama × 3 açı kareleri. node scratchpad/d1-grid.mjs [port] [tag] */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const PORT = process.argv[2] || '5199';
const TAG = process.argv[3] || 'after';
const BASE = `http://localhost:${PORT}`;
const OUT = `/tmp/d1grid-${TAG}`;
mkdirSync(OUT, { recursive: true });
const GRIPS = ['rest', 'holdFan3', 'holdFan2', 'holdFan1', 'pinchCard', 'openPlace', 'holdBallot', 'holdEnvelope', 'restTable', 'holdGun', 'point', 'openPalm', 'thumbUp', 'middleFinger'];
const VIEWS = ['palm', 'back', 'tips'];
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 520, height: 520 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
let info = null;
for (const grip of GRIPS) {
  for (const view of VIEWS) {
    await p.goto(`${BASE}/dev/hands?grip=${grip}&view=${view}&zoom=1.15`);
    await p.waitForFunction(() => document.querySelector('canvas')?.dataset.d1Ready === '1', null, { timeout: 30000 });
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/${grip}-${view}.png`, type: 'png' });
  }
  info = await p.evaluate(() => { const c = document.querySelector('canvas'); return { tris: c?.dataset.d1Triangles, build: c?.dataset.d1BuildMs }; });
  console.log(grip, JSON.stringify(info));
}
console.log('errors', errors.length, errors.slice(0, 3));
await browser.close();
