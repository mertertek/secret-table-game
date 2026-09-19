/**
 * D12 ölçüm: infaz koreografisi sırasında çizim çağrısı / üçgen / FPS.
 *   node scratchpad/d12-perf.mjs [port]
 *
 * Yöntem: `/dev/scene`de önce KURBAN görünümü yüklenir (geometriler ısınır),
 * sonra aynı sahnenin atıcı görünümüne geçilir — yerel oyuncu değiştiği için
 * cue defteri sıfırlanır ve koreografi ISINMIŞ geometriyle yeniden oynar.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);

const PORT = process.argv[2] || '5199';
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const read = () => page.evaluate(() => {
  const c = document.querySelector('canvas');
  return {
    frames: +(c?.dataset.sceneFrames ?? 0),
    calls: +(c?.dataset.sceneDrawCalls ?? 0),
    triangles: +(c?.dataset.sceneTriangles ?? 0),
    geometries: +(c?.dataset.sceneGeometries ?? 0),
    gun: c?.dataset.d12GunTriangles ?? '-',
  };
});

await page.goto(`${BASE}/dev/scene?fixture=execution-shot-victim`);
await page.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 40000 });
await page.waitForTimeout(8000);
const idle = await read();

await page.selectOption('.dev-scene__sidebar select', 'execution-shot');
await page.waitForTimeout(300);
const start = await read();
const t0 = Date.now();
await page.waitForTimeout(1300);
const mid = await read();          // ateş anı: silah + flaş sahnede
await page.waitForTimeout(1300);
const during = await read();
const fps = ((during.frames - start.frames) / ((Date.now() - t0) / 1000)).toFixed(1);
await page.waitForTimeout(2500);
const after = await read();

console.log(`9 koltuk · boşta (cue yok): çizim ${idle.calls} · üçgen ${idle.triangles} · geometri ${idle.geometries}`);
console.log(`ateş anı (t≈1300): çizim ${mid.calls} · üçgen ${mid.triangles} · silah üçgeni ${mid.gun}`);
console.log(`infaz penceresi (2,6 sn): fps ${fps} · çizim ${during.calls} · üçgen ${during.triangles}`);
console.log(`koreografi sonrası: çizim ${after.calls} · üçgen ${after.triangles} · geometri ${after.geometries}`);
await browser.close();
