/**
 * D3 tur 3 — netlik kareleri.
 *   node scratchpad/d3-shots3.mjs <prefix> [port]
 * prefix: "before3" | "after3"
 * Çıktı: docs/qa/claude/d3/<prefix>-*.png
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const PREFIX = process.argv[2] || 'after3';
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
    null, { timeout: 30000 },
  );
  // Standard kademe kuyruktan gelene kadar bekle (d3BuildMs karakter başına yazılır).
  await page.waitForTimeout(9000);
}

const info = (page) => page.evaluate(() => {
  const d = document.querySelector('canvas')?.dataset ?? {};
  return {
    camera: d.sceneCamera, calls: d.fpCalls, tris: d.fpTriangles,
    charTris: d.d3Triangles, charMs: d.d3BuildMs,
    yaw: document.querySelector('[data-viewpoint-yaw]')?.dataset.viewpointYaw,
  };
});

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${PREFIX}-${name}.png` });
  console.log(`${PREFIX}-${name}: ${JSON.stringify(await info(page))}`);
}

/** Koltuk kamerasında tuvali sürükleyerek bakışı `dx` piksel kaydırır. */
async function drag(page, dx, dy = 0) {
  const box = await page.locator('canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(cx + dx * i / 12, cy + dy * i / 12);
  await page.mouse.up();
  await page.waitForTimeout(1200);
}

{
  // 1) Yan komşuya yakın plan: koltuk kamerası, bakış sağa ~50° (0,873 rad).
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'seat');
  await open(page, 'nomination');
  await shot(page, 'seat');
  await drag(page, +Math.round(.873 / .0024));
  await shot(page, 'neighbor-close');
  await drag(page, -Math.round(2 * .873 / .0024));
  await shot(page, 'neighbor-close-left');
  await ctx.close();
}
{
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'overview');
  await open(page, 'table-size-10');
  await shot(page, 'overview-10p');
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const [name, url] of [
    ['gallery', '/dev/characters?mode=lineup'],
    ['faces', '/dev/characters?mode=faces&character=kepli-cocuk'],
  ]) {
    await page.goto(`${BASE}${url}`);
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(12000);
    await page.screenshot({ path: `${OUT}/${PREFIX}-${name}.png` });
    console.log(`${PREFIX}-${name}: ok`);
  }
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `KONSOL HATALARI:\n${errors.join('\n')}` : 'konsol hatası yok');
