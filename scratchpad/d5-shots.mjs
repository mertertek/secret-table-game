/**
 * D5 — oy rozeti kareleri.
 *   node scratchpad/d5-shots.mjs [port]
 * Çıktı: docs/qa/claude/d5/*.png
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const PORT = process.argv[2] || '5199';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d5';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const errors = [];

async function session(viewport, cameraMode) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width > 500 ? 2 : 2 });
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

async function open(page, fixture) {
  await page.goto(`${BASE}/dev/game?fixture=${fixture}`);
  await page.waitForFunction(
    () => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(2500);
}

const badges = (page) => page.evaluate(() =>
  document.querySelector('[data-scene-vote-badges]')?.getAttribute('data-scene-vote-badges'));
const status = (page) => page.evaluate(() =>
  document.querySelector('.statusbar')?.getAttribute('aria-label'));

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${name}: rozet=${await badges(page)} şerit=${await status(page)}`);
}

// --- Koltuk kamerası ---------------------------------------------------------
{
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'seat');
  await open(page, 'voting-waiting');
  await shot(page, 'voting-seat');
  await open(page, 'election-result-close');
  await shot(page, 'result-seat');
  await ctx.close();
}

// --- Genel masa kamerası -----------------------------------------------------
{
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'overview');
  await open(page, 'voting-waiting');
  await shot(page, 'voting-overview');
  await open(page, 'election-result-close');
  await shot(page, 'result-overview');
  await ctx.close();
}

// --- Telefon -----------------------------------------------------------------
{
  const { ctx, page } = await session({ width: 390, height: 844 }, 'overview');
  await open(page, 'election-result-close');
  await shot(page, 'phone-result');
  // Menüdeki oyuncu paneli (oy sütunu)
  await page.getByRole('button', { name: /Menü/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/phone-players.png` });
  console.log('phone-players: menü paneli');
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `KONSOL HATALARI:\n${errors.join('\n')}` : 'konsol hatası yok');
