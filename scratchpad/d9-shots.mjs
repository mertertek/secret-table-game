/**
 * D9 duyuru kareleri. Dev sunucu ayrı terminalde 5199'da çalışır (5173'e
 * dokunulmaz). Kullanım: node scratchpad/d9-shots.mjs 5199
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const port = process.argv[2] ?? '5199';
const base = `http://localhost:${port}`;
const out = 'docs/qa/claude/d9';
mkdirSync(out, { recursive: true });

const errors = [];

async function shot(browser, { name, from, to, width, height, dpr }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${name}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));

  await page.goto(`${base}/dev/game?fixture=${from}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.dev-game__picker');
  await page.waitForTimeout(2500); // sahne yüklensin, ilk tohumlama otursun
  await page.selectOption('.dev-game__picker', to);
  await page.waitForSelector('.announcer__card', { timeout: 3000 });
  await page.waitForTimeout(350); // giriş animasyonu bitsin
  const text = await page.$eval('.announcer__card', (el) => el.textContent);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`${name}: ${text}`);
  await ctx.close();
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
await shot(browser, { name: 'voting-desktop', from: 'nomination', to: 'voting', width: 1440, height: 900, dpr: 2 });
await shot(browser, { name: 'voting-phone', from: 'nomination', to: 'voting', width: 390, height: 844, dpr: 2 });
await shot(browser, { name: 'policy-fascist3', from: 'president-discard', to: 'policy-fascist-third', width: 1440, height: 900, dpr: 2 });
await shot(browser, { name: 'execution', from: 'executive-action', to: 'execution-result', width: 1440, height: 900, dpr: 2 });
await browser.close();

console.log(errors.length ? `KONSOL HATALARI:\n${errors.join('\n')}` : 'konsol hatası yok');
