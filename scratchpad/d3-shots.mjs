/**
 * D3 — karakter kareleri (önce/sonra).
 *   node scratchpad/d3-shots.mjs <prefix> [port]
 * prefix: "before" | "after"
 * Çıktı: docs/qa/claude/d3/<prefix>-*.png
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const PREFIX = process.argv[2] || 'after';
const PORT = process.argv[3] || '5199';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d3';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const errors = [];

async function session(viewport, cameraMode) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`);
  await page.evaluate(
    (p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)),
    { quality: 'standard', reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode },
  );
  return { ctx, page };
}

async function open(page, fixture, extra = '') {
  await page.goto(`${BASE}/dev/game?fixture=${fixture}${extra}`);
  await page.waitForFunction(
    () => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(3000);
}

const info = (page) => page.evaluate(() => {
  const d = document.querySelector('canvas')?.dataset ?? {};
  return {
    camera: d.sceneCamera, calls: d.fpCalls, tris: d.fpTriangles,
    charTris: d.d3Triangles, charMs: d.d3BuildMs, charCount: d.d3Characters,
  };
});

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${PREFIX}-${name}.png` });
  const d = await info(page);
  console.log(`${PREFIX}-${name}: ${JSON.stringify(d)}`);
}

{
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'seat');
  await open(page, 'nomination');
  await shot(page, 'seat');
  await ctx.close();
}
{
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'overview');
  await open(page, 'nomination');
  await shot(page, 'overview');
  await open(page, 'table-size-10');
  await shot(page, 'overview-10p');
  await ctx.close();
}
{
  const { ctx, page } = await session({ width: 390, height: 844 }, 'seat');
  await open(page, 'nomination');
  await shot(page, 'phone-seat');
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `KONSOL HATALARI:\n${errors.join('\n')}` : 'konsol hatası yok');
