/** H maddesi: 5 ve 10 kişilik koltuk/genel kamerada FPS + çizim, CPU 4×; 5 dk heap. */
import { launch, makeCtx, BASE, note, sceneReady, shot } from './e2e-lib.mjs';
const browser = await launch();
const { ctx, p } = await makeCtx(browser, 'P');
const cdp = await ctx.newCDPSession(p);
const read = () => p.evaluate(() => { const c = document.querySelector('canvas'); return { frames: +(c?.dataset.sceneFrames || 0), calls: +(c?.dataset.sceneDrawCalls || 0), tris: +(c?.dataset.sceneTriangles || 0) }; });
async function measure(fixture, camera, throttle, seconds = 6) {
  await p.goto(`${BASE}/dev/scene?fixture=${fixture}${camera ? `&camera=${camera}` : ''}`);
  await sceneReady(p, 60000);
  await p.waitForTimeout(6000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const box = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const a = await read(); const t0 = Date.now();
  // sürekli kare talebi: fareyi basılı sürükle (koltukta bakış, genelde hover)
  await p.mouse.move(box.x, box.y); await p.mouse.down();
  const end = Date.now() + seconds * 1000;
  let i = 0;
  while (Date.now() < end) { i = (i + 1) % 40; await p.mouse.move(box.x + Math.sin(i / 6) * 120, box.y + Math.cos(i / 6) * 40); await p.waitForTimeout(16); }
  await p.mouse.up();
  const b = await read(); const dt = (Date.now() - t0) / 1000;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const fps = ((b.frames - a.frames) / dt).toFixed(1);
  note(`${fixture} ${camera || 'overview'} cpu${throttle}× → fps ${fps} · çizim ${b.calls} · üçgen ${b.tris}`);
  return { fixture, camera, throttle, fps: +fps, calls: b.calls, tris: b.tris };
}
const rows = [];
for (const [fx, cam] of [['table-size-5', 'seat'], ['table-size-5', ''], ['table-size-10', 'seat'], ['table-size-10', '']]) {
  rows.push(await measure(fx, cam, 4));
  rows.push(await measure(fx, cam, 1));
}
await shot(p, 'h1-perf-table10');
// 5 dk heap (aynı sahnede sürekli hareket)
await p.goto(`${BASE}/dev/scene?fixture=table-size-10&camera=seat`);
await sceneReady(p, 60000); await p.waitForTimeout(5000);
const heap = async () => p.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
const h0 = await heap();
const box = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
const stop = Date.now() + 300000;
let k = 0;
await p.mouse.move(box.x, box.y); await p.mouse.down();
while (Date.now() < stop) { k++; await p.mouse.move(box.x + Math.sin(k / 8) * 150, box.y + Math.cos(k / 8) * 50); await p.waitForTimeout(30); }
await p.mouse.up();
const h1 = await heap(); const fin = await read();
note(`5 dk sürekli bakış: heap ${h0} → ${h1} MB · kare ${fin.frames} · çizim ${fin.calls}`);
note('SONUÇ', JSON.stringify(rows));
await browser.close();
