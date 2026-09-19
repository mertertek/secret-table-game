/**
 * C3 doğrulaması: 3 s sürükleme boyunca sahne React render sayısı ve kare sayısı.
 *   node scratchpad/perf-renders.mjs [fixture] [quality] [cameraMode]
 * `data-scene-renders` (SceneSession render sayacı) ve `data-scene-frames` okunur.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const BASE = process.env.PERF_BASE || 'http://localhost:5173';
const fixture = process.argv[2] || 'president-discard';
const quality = process.argv[3] || 'standard';
const cameraMode = process.argv[4] || 'seat';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`${BASE}/`);
await page.evaluate((p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)), { quality, reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode });
await page.goto(`${BASE}/dev/game?fixture=${fixture}`);
await page.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 20000 });
await page.waitForTimeout(3000);
const out = await page.evaluate(async () => {
  const c = document.querySelector('canvas'); const root = document.querySelector('[data-scene-camera]');
  const renders0 = +root.dataset.sceneRenders || 0; const frames0 = +c.dataset.sceneFrames || 0;
  const t0 = performance.now();
  const P = HTMLElement.prototype; const o = { s: P.setPointerCapture, h: P.hasPointerCapture, r: P.releasePointerCapture };
  P.setPointerCapture = () => {}; P.hasPointerCapture = () => false; P.releasePointerCapture = () => {};
  const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: type === 'pointerdown' ? 0 : -1, buttons: 1, clientX: x, clientY: y, pointerType: 'mouse' }));
  ev('pointerdown', cx, cy);
  let moves = 0;
  await new Promise((done) => { const step = () => { const t = performance.now() - t0; moves++;
    ev('pointermove', cx + Math.sin(t / 400) * 260, cy + Math.cos(t / 700) * 60);
    if (t < 3000) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
  ev('pointerup', cx, cy);
  P.setPointerCapture = o.s; P.hasPointerCapture = o.h; P.releasePointerCapture = o.r;
  const dt = (performance.now() - t0) / 1000;
  return { seconds: +dt.toFixed(2), moves, renders: (+root.dataset.sceneRenders || 0) - renders0, frames: (+c.dataset.sceneFrames || 0) - frames0, yaw: root.dataset.sceneLook };
});
console.log(JSON.stringify({ fixture, quality, cameraMode, ...out }));
await browser.close();
