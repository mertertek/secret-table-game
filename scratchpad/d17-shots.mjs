/** D17 ofis eli kareleri. node scratchpad/d17-shots.mjs [port] */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const PORT = process.argv[2] || '5199';
const ONLY = process.argv[3] || '';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d17';
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
async function page(viewport = { width: 1440, height: 900 }, scale = 1.25, extra = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, ...extra });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, p };
}
async function open(p, url) {
  await p.goto(url);
  await p.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 45000 });
  await p.waitForTimeout(3500);
}
const shot = async (p, name, full = false) => {
  const stage = full ? null : await p.$('.dev-scene__stage');
  await (stage ?? p).screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 60 });
  const info = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const host = document.querySelector('[data-scene-office-hand]');
    return { calls: c?.dataset.sceneDrawCalls, tris: c?.dataset.sceneTriangles, office: host?.getAttribute('data-scene-office-hand') };
  });
  console.log(name.padEnd(28), JSON.stringify(info));
};
const cases = [
  ['president-3', 'legislative-president-seat', 'seat', ''],
  ['president-3-mid', 'legislative-president-seat', 'seat', '&t=250'],
  ['chancellor-2', 'legislative-chancellor-seat', 'seat', ''],
  ['chancellor-2-mid', 'legislative-chancellor-seat', 'seat', '&t=250'],
  ['veto-2-no-cue', 'legislative-veto-seat', 'seat', ''],
  ['idle-baseline', 'legislative-seat-idle', 'seat', ''],
];
if (!ONLY || ONLY === 'seat') {
  for (const [name, fixture, camera, extra] of cases) {
    const { ctx, p } = await page();
    await open(p, `${BASE}/dev/scene?fixture=${fixture}&camera=${camera}${extra}`);
    await shot(p, name);
    await ctx.close();
  }
}
if (!ONLY || ONLY === 'extra') {
  // genel bakış (kamera koltukta değil)
  for (const [name, fixture] of [['overview-president', 'legislative-president-seat'], ['overview-chancellor', 'legislative-chancellor-seat']]) {
    const { ctx, p } = await page({ width: 1600, height: 1000 }, 1.2);
    await open(p, `${BASE}/dev/scene?fixture=${fixture}`);
    await shot(p, name);
    await ctx.close();
  }
  // telefon dikey (gerçek oyun ekranı)
  {
    const { ctx, p } = await page({ width: 390, height: 844 }, 2, { hasTouch: true, isMobile: true });
    await p.goto(`${BASE}/`);
    await p.evaluate(() => localStorage.setItem('secret-table:prefs', JSON.stringify({
      quality: 'low', reducedMotion: false, soundEnabled: false, sensitivity: 1,
      cameraMode: 'seat', announcements: true, fullscreenHintSeen: true })));
    await open(p, `${BASE}/dev/game?fixture=legislative-president-seat`);
    await shot(p, 'phone-president', true);
    await ctx.close();
  }
}
console.log('errors', errors.length, errors.slice(0, 3));
await browser.close();
