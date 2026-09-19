/**
 * D1 el yeniden yapımı — önce/sonra kareleri.
 *   node scratchpad/d1-shots.mjs before|after [port]
 * Çıktı: docs/qa/claude/d1/<prefix>-*.png  (+ konsola çizim/üçgen sayıları)
 *
 * Dev sunucu KULLANICININ 5173'ü DEĞİL; varsayılan 5199.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const PREFIX = process.argv[2] || 'before';
const PORT = process.argv[3] || '5199';
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

async function prefs(cameraMode, quality = 'standard') {
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

const read = () => page.evaluate(() => {
  const d = document.querySelector('canvas')?.dataset ?? {};
  return {
    draws: +(d.sceneDrawCalls || 0), tris: +(d.sceneTriangles || 0),
    geoms: +(d.sceneGeometries || 0), motion: d.fpMotion, faces: d.fpPrivateFaces,
    handMs: d.fpHandBuildMs ?? null, handTris: d.fpHandTriangles ?? null,
  };
});

async function shot(name) {
  const file = `${OUT}/${PREFIX}-${name}.png`;
  await page.screenshot({ path: file });
  const s = await read();
  stats.push({ name, ...s });
  console.log(`${file}  draws=${s.draws} tris=${s.tris} handMs=${s.handMs} handTris=${s.handTris}`);
}

const click = async (label) => {
  const b = page.getByRole('button', { name: label });
  if (await b.count()) { await b.first().click(); await page.waitForTimeout(1200); return true; }
  return false;
};

// --- 1) Koltuk: 3 kartlı yelpaze (hold) ------------------------------------
await prefs('seat');
await open('president-discard');
await page.waitForTimeout(3000);
await shot('seat-hold3');
await click('Özel alanı incele');
await page.waitForTimeout(900);
await shot('inspect-hold3');
await click('Masaya dön');

// --- 2) Seçili kart (pinchCard) -------------------------------------------
{
  // Alt eylem çubuğundan 2. kanunu seç (ortadaki kart kalkar).
  const option = page.locator('button').filter({ hasText: /kanun$/ }).nth(1);
  const picked = await option.count() > 0;
  if (picked) await option.click();
  await page.waitForTimeout(1400);
  await shot('seat-selected');
  await click('Özel alanı incele');
  await page.waitForTimeout(900);
  await shot('inspect-selected');
  console.log(`  seçim yapıldı: ${picked}`);
}

// --- 3) 2 kartlı yelpaze ---------------------------------------------------
await open('chancellor-choice');
await page.waitForTimeout(3000);
await shot('seat-hold2');
await click('Özel alanı incele');
await page.waitForTimeout(900);
await shot('inspect-hold2');

// --- 4) Oy (vote) ----------------------------------------------------------
await open('election-result');
await page.waitForTimeout(650);
await shot('seat-vote');
await page.waitForTimeout(2500);
await shot('seat-vote-end');

// --- 5) Zarf (envelope) ----------------------------------------------------
await open('role-reveal-liberal');
await page.waitForTimeout(2000);
if (!(await click('Kimliği aç'))) await click('Kimliğim');
await page.waitForTimeout(900);
await shot('seat-envelope');
await click('Özel alanı incele');
await page.waitForTimeout(900);
await shot('inspect-envelope');

// --- 6) Genel masa: PublicArms --------------------------------------------
await prefs('overview');
await open('policy-result');
await page.waitForTimeout(3500);
await shot('overview-arms');
await prefs('overview', 'low');
await open('policy-result');
await page.waitForTimeout(3500);
await shot('overview-arms-low');

writeFileSync(`${OUT}/${PREFIX}-stats.json`, JSON.stringify({ stats, errors }, null, 2));
console.log('errors:', errors.slice(0, 10));
await browser.close();
