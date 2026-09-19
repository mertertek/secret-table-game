/** D3 tur 3 — 10 oyuncuda ilk kareye kadar geçen süre (ms). */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const LABEL = process.argv[2] || 'after3', PORT = process.argv[3] || '5199';
const BASE = `http://localhost:${PORT}`;
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
for (const mode of ['seat', 'overview']) {
  const times = [];
  for (let i = 0; i < 3; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.evaluate((p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)), { quality: 'standard', reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode: mode });
    await page.goto(`${BASE}/dev/game?fixture=table-size-10`);
    const t = await page.evaluate(async () => {
      const t0 = performance.now();
      await new Promise((done) => { const s = () => { if (+(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0) done(); else requestAnimationFrame(s); }; s(); });
      return Math.round(performance.now() - t0);
    });
    times.push(t);
    await ctx.close();
  }
  console.log(`${LABEL} 10 kişi/${mode} ilk kare: ${times.join(', ')} ms (medyan ${times.sort((a, b) => a - b)[1]})`);
}
await browser.close();
