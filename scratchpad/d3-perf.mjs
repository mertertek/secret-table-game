/**
 * D3 perf: CPU 4× yavaşlatmada koltuk ve genel masa FPS'i.
 *   node scratchpad/d3-perf.mjs [etiket] [port]
 * Kare sayacı `data-scene-frames`; 5 s sürükleme (koltuk) / 5 s bekleme (genel).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);

const LABEL = process.argv[2] || 'after';
const PORT = process.argv[3] || '5199';
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});

async function run(fixture, cameraMode, throttle) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.evaluate((p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)),
    { quality: 'standard', reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode });
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${BASE}/dev/game?fixture=${fixture}`);
  await page.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const out = await page.evaluate(async () => {
    const c = document.querySelector('canvas');
    const start = +c.dataset.sceneFrames, t0 = performance.now();
    const P = HTMLElement.prototype;
    const o = { s: P.setPointerCapture, h: P.hasPointerCapture, r: P.releasePointerCapture };
    P.setPointerCapture = () => {}; P.hasPointerCapture = () => false; P.releasePointerCapture = () => {};
    const r = c.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: type === 'pointerdown' ? 0 : -1, buttons: 1, clientX: x, clientY: y, pointerType: 'mouse' }));
    ev('pointerdown', cx, cy);
    await new Promise((done) => {
      const step = () => {
        const t = performance.now() - t0;
        ev('pointermove', cx + Math.sin(t / 400) * 260, cy + Math.cos(t / 700) * 60);
        if (t < 5000) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
    ev('pointerup', cx, cy);
    P.setPointerCapture = o.s; P.hasPointerCapture = o.h; P.releasePointerCapture = o.r;
    const dt = (performance.now() - t0) / 1000;
    return {
      fps: +(((+c.dataset.sceneFrames) - start) / dt).toFixed(1),
      calls: c.dataset.sceneDrawCalls, tris: c.dataset.sceneTriangles,
      textures: c.dataset.sceneTextures, geometries: c.dataset.sceneGeometries,
    };
  });
  await ctx.close();
  return out;
}

for (const [fixture, mode, throttle] of [['nomination', 'seat', 4], ['nomination', 'seat', 1], ['table-size-10', 'overview', 4], ['table-size-10', 'overview', 1]]) {
  const r = await run(fixture, mode, throttle);
  console.log(`${LABEL} ${fixture}/${mode} cpu${throttle}× → fps=${r.fps} çizim=${r.calls} üçgen=${r.tris} doku=${r.textures} geometri=${r.geometries}`);
}
await browser.close();
