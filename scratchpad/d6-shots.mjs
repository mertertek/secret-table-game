/**
 * D6 — baş üstü isim etiketi kareleri.
 *   node scratchpad/d6-shots.mjs [port]
 * Çıktı: docs/qa/claude/d6/*.png
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const PORT = process.argv[2] || '5199';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d6';
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

async function open(page, fixture) {
  await page.goto(`${BASE}/dev/game?fixture=${fixture}`);
  await page.waitForFunction(
    () => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(2500);
}

const info = (page) => page.evaluate(() => ({
  badges: document.querySelector('[data-scene-vote-badges]')?.getAttribute('data-scene-vote-badges'),
  camera: document.querySelector('[data-scene-camera]')?.getAttribute('data-scene-camera'),
  domNames: document.querySelectorAll('[data-scene-name]').length,
}));

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const d = await info(page);
  console.log(`${name}: kamera=${d.camera} çip=${d.badges} DOM-ad-düğmesi=${d.domNames}`);
}

// --- Koltuk kamerası ---------------------------------------------------------
{
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'seat');
  await open(page, 'election-result-close');
  await shot(page, 'seat-result');
  await open(page, 'nomination');
  // Bir hedefi seç: diğer koltuklar HEDEF SEÇ, seçilen SEÇİLDİ olur.
  // Karşı koltuktaki Kaan seçilsin: kare hem SEÇİLDİ hem HEDEF SEÇ taşısın.
  const options = page.locator('.actionbar__option');
  const pick = (await options.count()) > 1 ? options.nth(1) : options.first();
  if (await options.count()) { await pick.click(); await page.waitForTimeout(900); }
  await shot(page, 'seat-nomination-target');
  await ctx.close();
}

// --- Genel masa kamerası -----------------------------------------------------
{
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'overview');
  await open(page, 'election-result-close');
  await shot(page, 'overview-result');
  await open(page, 'table-size-10');
  await shot(page, 'overview-10p');
  await ctx.close();
}

// --- Telefon (390 × 844, dikey) ----------------------------------------------
{
  const { ctx, page } = await session({ width: 390, height: 844 }, 'overview');
  await open(page, 'election-result-close');
  await shot(page, 'phone-overview');
  await ctx.close();
}
{
  const { ctx, page } = await session({ width: 390, height: 844 }, 'seat');
  await open(page, 'election-result-close');
  await shot(page, 'phone-seat');
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `KONSOL HATALARI:\n${errors.join('\n')}` : 'konsol hatası yok');
