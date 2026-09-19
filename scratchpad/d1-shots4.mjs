/**
 * D1 tur 4 — el/kart geçiş kareleri.
 *   node scratchpad/d1-shots4.mjs [port]
 * Çıktı: docs/qa/claude/d1/after4-*.png
 *
 * Fixture'lar arasında SAYFA YENİLEMEDEN (picker ile) geçilir; böylece sahne
 * kimliği korunur ve gerçek devir/oy geçişi oynar.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const PORT = process.argv[2] || '5199';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d1';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const stats = [];

async function prefs(cameraMode = 'seat', quality = 'standard') {
  await page.goto(`${BASE}/`);
  await page.evaluate(
    (p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)),
    { quality, reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode },
  );
}
async function open(fixture) {
  await page.goto(`${BASE}/dev/game?fixture=${fixture}`);
  await page.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 30000 });
}
/** Sayfa yenilemeden senaryo değiştirir (sahne kimliği korunur). */
const pick = (fixture) => page.selectOption('select.dev-game__picker', fixture);
const read = () => page.evaluate(() => {
  const d = document.querySelector('canvas')?.dataset ?? {};
  return { motion: d.fpMotion, progress: d.fpMotionProgress, faces: d.fpPrivateFaces, draws: +(d.sceneDrawCalls || 0), tris: +(d.sceneTriangles || 0) };
});
async function shot(name) {
  const file = `${OUT}/after4-${name}.png`;
  await page.screenshot({ path: file });
  const s = await read();
  stats.push({ name, ...s });
  console.log(`${file}  motion=${s.motion} p=${s.progress} faces=${s.faces}`);
}
const waitMotion = (kind, min = 0, max = 1) => page.waitForFunction(
  ([k, lo, hi]) => {
    const d = document.querySelector('canvas')?.dataset ?? {};
    return d.fpMotion === k && +(d.fpMotionProgress || 0) >= lo && +(d.fpMotionProgress || 0) <= hi;
  }, [kind, min, max], { timeout: 15000, polling: 16 },
);

await prefs('seat');

// --- 1) Kanun atma devri: 3 kart → boş el + cards_moved -----------------------
await open('president-discard');
await page.waitForTimeout(3200);
await shot('place-before');           // 3 kartlı yelpaze (referans)
await pick('president-discarded');
await waitMotion('place', .30, .62);
await shot('place-mid');              // hayalet sırtlar + tepsiye giden kart
await page.waitForTimeout(2200);
await shot('place-end');              // iki el masada, yelpaze yok

// --- 2) Oy: 2 kart → onay → masada kapalı kart -------------------------------
await open('voting');
await page.waitForTimeout(3200);
await shot('ballot-before');
const yes = page.getByRole('button', { name: /evet/i });
if (await yes.count()) { await yes.first().click(); await page.waitForTimeout(900); }
await pick('voting-submitted');
await waitMotion('ballot', .25, .65).catch(() => console.log('  ballot orta kare kaçtı'));
await shot('ballot-mid');
await page.waitForTimeout(1500);
await shot('ballot-end');             // kapalı oy kartı masada, eller dinlenmede

// --- 3) Oylar açıklanıyor: aynı karttan devam -------------------------------
await pick('election-result');
await waitMotion('vote', .25, .70).catch(() => console.log('  çevirme orta kare kaçtı'));
await shot('vote-reveal');
await page.waitForTimeout(1600);
await shot('vote-reveal-end');

// --- 4) Yürütme fazı: iki el masada, kart yok --------------------------------
await open('executive-action');
await page.waitForTimeout(2500);
await shot('executive-hands');

writeFileSync(`${OUT}/after4-stats.json`, JSON.stringify({ stats, errors }, null, 2));
console.log('errors:', errors.slice(0, 10));
await browser.close();
