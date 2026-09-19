/**
 * ROADMAP B6 görsel kabul: giriş, katıl ve gerçek lobi ekran görüntüleri.
 *   node scratchpad/b6-shots.mjs
 * Çıktı: docs/qa/claude/b6/*.png
 *
 * Lobi görüntüsü GERÇEK: yerel dev sunucu + canlı Supabase ile oda açar,
 * DEV bot düğmesiyle 5 bot ekler, çekim sonrası botları durdurur.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const BASE = process.env.B6_BASE || 'http://localhost:5173';
const OUT = 'docs/qa/claude/b6';
mkdirSync(OUT, { recursive: true });

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

async function shot(ctxOptions, name, run) {
  const ctx = await browser.newContext(ctxOptions);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`  [console:error] ${m.text()}`);
  });
  await run(page);
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  console.log(file);
  await ctx.close();
}

// --- 1) Giriş -------------------------------------------------------------
for (const [label, opts] of [
  ['desktop-1440x900', DESKTOP],
  ['phone-390x844', PHONE],
]) {
  await shot(opts, `entry-${label}`, async (page) => {
    await page.goto(`${BASE}/`);
    await page.getByLabel('Görünen adın').fill('Mert');
    await page.waitForTimeout(600);
  });

  // --- 2) Katıl ----------------------------------------------------------
  await shot(opts, `join-${label}`, async (page) => {
    await page.goto(`${BASE}/katil/ABC234`);
    await page.waitForTimeout(600);
  });
}

// --- 3) Gerçek lobi (canlı Supabase + 5 bot) ------------------------------
{
  const ctx = await browser.newContext(DESKTOP);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (t.startsWith('[bots]')) console.log(`  ${t}`);
  });
  await page.goto(`${BASE}/`);
  await page.getByLabel('Görünen adın').fill('Mert-QA');
  await page.getByRole('button', { name: 'Oda aç' }).click();
  await page.waitForURL(/\/oda\//, { timeout: 20000 });
  await page.getByRole('button', { name: '5 bot ekle (dev)' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.table__seats .seat:not(.seat--empty)').length >= 6,
    null,
    { timeout: 40000 },
  );
  await page.getByRole('button', { name: 'Hazırım' }).click();
  await page.waitForTimeout(2500);
  console.log('  oda:', page.url());
  await page.screenshot({ path: `${OUT}/lobby-desktop-1440x900.png` });
  console.log(`${OUT}/lobby-desktop-1440x900.png`);

  // Aynı oturum, telefon ölçüsü.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/lobby-phone-390x844.png` });
  console.log(`${OUT}/lobby-phone-390x844.png`);

  // Botları durdur.
  await page.getByRole('button', { name: /Botlar çalışıyor/ }).click();
  await page.waitForTimeout(1500);
  await ctx.close();
}

await browser.close();
