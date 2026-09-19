/** D3 galeri kareleri: node scratchpad/d3-gallery.mjs [port] */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const PORT = process.argv[2] || '5199';
const OUT = 'docs/qa/claude/d3';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1600, height: 620 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
async function shot(query, name, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await page.goto(`http://localhost:${PORT}/dev/characters?${query}`);
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.d3Ready === '1', null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${process.env.D3_PREFIX ? process.env.D3_PREFIX + "-" : ""}${name}.png` });
  const d = await page.evaluate(() => ({ ...document.querySelector('canvas').dataset }));
  console.log(`${name}: çizim=${d.d3Calls} sahneÜçgen=${d.d3SceneTriangles} karakterÜçgen=${d.d3Triangles} üretimMs=${d.d3BuildMs}`);
}
await shot('mode=lineup&still=1', 'gallery');
await shot('mode=faces&character=kepli-cocuk&still=1', 'faces', { width: 1100, height: 620 });
await shot('mode=skins&character=topuzlu&still=1', 'skins', { width: 900, height: 620 });
await browser.close();
console.log(errors.length ? `KONSOL HATALARI:\n${errors.join('\n')}` : 'konsol hatası yok');
