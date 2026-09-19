/** C3 işlevsel kontrol: sürükleme kamerayı çeviriyor mu, kip geçişi çalışıyor mu. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const BASE = process.env.PERF_BASE || 'http://localhost:5173';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(`${BASE}/`);
await page.evaluate((p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)), { quality: 'standard', reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode: 'seat' });
await page.goto(`${BASE}/dev/game?fixture=president-discard`);
await page.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 20000 });
await page.waitForTimeout(3000);
const before = await page.screenshot();
const drag = await page.evaluate(async () => {
  const c = document.querySelector('canvas');
  const P = HTMLElement.prototype; const o = { s: P.setPointerCapture, h: P.hasPointerCapture, r: P.releasePointerCapture };
  P.setPointerCapture = () => {}; P.hasPointerCapture = () => false; P.releasePointerCapture = () => {};
  const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: type === 'pointerdown' ? 0 : -1, buttons: 1, clientX: x, clientY: y, pointerType: 'mouse' }));
  ev('pointerdown', cx, cy);
  for (let i = 1; i <= 20; i++) { ev('pointermove', cx + i * 15, cy); await new Promise((d) => requestAnimationFrame(d)); }
  const renders = +document.querySelector('[data-scene-camera]').dataset.sceneRenders;
  ev('pointerup', cx + 300, cy);
  P.setPointerCapture = o.s; P.hasPointerCapture = o.h; P.releasePointerCapture = o.r;
  await new Promise((d) => setTimeout(d, 400));
  return { renders, camera: { ...document.querySelector('canvas').dataset } };
});
const after = await page.screenshot();
console.log('sürükleme sırasında görüntü değişti:', !before.equals(after));
console.log('sürükleme sonundaki render sayacı:', drag.renders);
// Kip geçişi: sahne düğmesiyle genel masaya, sonra koltuğa dön.
const camera = async () => (await page.evaluate(() => ({ mode: document.querySelector('[data-scene-camera]').dataset.sceneCamera, y: document.querySelector('canvas').dataset.fpCameraY, fov: document.querySelector('canvas').dataset.fpFov })));
console.log('koltuk:', JSON.stringify(await camera()));
await page.getByRole('button', { name: 'Genel masa' }).click(); await page.waitForTimeout(1200);
console.log('genel:', JSON.stringify(await camera()));
await page.getByRole('button', { name: 'Kendi koltuğum' }).click(); await page.waitForTimeout(1200);
console.log('koltuk (dönüş):', JSON.stringify(await camera()));
await page.getByRole('button', { name: 'Özel alanı incele' }).click(); await page.waitForTimeout(1200);
console.log('özel inceleme:', JSON.stringify(await camera()));
await browser.close();
