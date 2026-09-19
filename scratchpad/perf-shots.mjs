/**
 * C3 görsel kabul: 7 kişilik masa, standard kalite, koltuk ve genel kamera.
 *   node scratchpad/perf-shots.mjs <etiket>   (ör. before / after)
 * Çıktı: docs/qa/claude/perf/<etiket>-<kamera>.png
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const BASE = process.env.PERF_BASE || 'http://localhost:5173';
const label = process.argv[2] || 'shot';
const fixture = process.argv[3] || 'president-discard';
mkdirSync('docs/qa/claude/perf', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
for (const cameraMode of ['seat', 'overview']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.evaluate((p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)), { quality: 'standard', reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode });
  await page.goto(`${BASE}/dev/game?fixture=${fixture}`);
  await page.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 20000 });
  await page.waitForTimeout(4000);
  const file = `docs/qa/claude/perf/${label}-${cameraMode}.png`;
  await page.screenshot({ path: file });
  console.log(file);
  await ctx.close();
}
await browser.close();
