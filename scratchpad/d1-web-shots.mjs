/** D1 tur 5 — perdesiz el kareleri. node scratchpad/d1-web-shots.mjs [port] [suffix] */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const PORT = process.argv[2] || '5199';
const TAG = process.argv[3] || '';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d1';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
async function page(viewport = { width: 1440, height: 900 }, scale = 1.25) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, p };
}
async function open(p, url) {
  await p.goto(url);
  await p.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 45000 });
  await p.waitForTimeout(3500);
}
const shot = async (p, name) => {
  const stage = await p.$('.dev-scene__stage');
  await (stage ?? p).screenshot({ path: `${OUT}/${name}${TAG}.jpg`, type: 'jpeg', quality: 62 });
  const info = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    return { tris: c?.dataset.fpHandTriangles, build: c?.dataset.fpHandBuildMs, calls: c?.dataset.sceneDrawCalls, scene: c?.dataset.sceneTriangles };
  });
  console.log(name.padEnd(26), JSON.stringify(info));
};
// 1) açık avuç (ilk şahıs, jest: teslim) — parmak araları
{
  const { ctx, p } = await page();
  await open(p, `${BASE}/dev/scene?fixture=emote-local&camera=seat&emote=hands_up&t=1400`);
  await shot(p, 'webless-open-palm');
  await ctx.close();
}
// 2) yelpaze tutuşu (kart tutarken el)
{
  const { ctx, p } = await page();
  await open(p, `${BASE}/dev/scene?fixture=emote-local-hand&camera=seat`);
  await shot(p, 'webless-fan');
  await ctx.close();
}
// 3) kamu/masadaki dinlenme eli (distant kademe, D3 karakter elleri)
{
  const { ctx, p } = await page({ width: 1440, height: 900 }, 1.5);
  await open(p, `${BASE}/dev/scene?fixture=emote-local&camera=seat`);
  await shot(p, 'webless-public-rest');
  await ctx.close();
}
// 4) koltuk görüşü: karşıdaki oyuncunun açık avucu (kamu eli, aynı geometri)
{
  const { ctx, p } = await page({ width: 1600, height: 1000 }, 1.4);
  await open(p, `${BASE}/dev/scene?fixture=emote-hands-up-seat&camera=seat&t=1400`);
  await shot(p, 'webless-seat-view');
  await ctx.close();
}
console.log('errors', errors.length, errors.slice(0, 3));
await browser.close();
