import { chromium } from '<yerel-yol>
import { mkdirSync, writeFileSync } from 'node:fs';

const label = process.argv[2] ?? 'after';
const shotDir = process.argv[3] ?? null;
const url = 'http://localhost:5203/dev/scene?fixture=president-discard&sweep=540&camera=seat';

const browser = await chromium.launch({ executablePath: '<yerel-yol> Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas', { timeout: 20000 });
await page.waitForTimeout(3000);

const key = await page.evaluate(() => {
  const el = document.querySelector('canvas');
  return Object.keys(el.dataset).filter((k) => k.startsWith('fpHeadYaw'));
});

const series = await page.evaluate(() => new Promise((resolve) => {
  const el = document.querySelector('canvas');
  const rows = [];
  const t0 = performance.now();
  const step = () => {
    const now = performance.now();
    rows.push({ t: +(now - t0).toFixed(1), ...Object.fromEntries(Object.entries(el.dataset).filter(([k]) => k.startsWith('fpHeadYaw')).map(([k, v]) => [k, Number(v)])) });
    if (now - t0 < 6000) requestAnimationFrame(step);
    else resolve(rows);
  };
  requestAnimationFrame(step);
}));

if (shotDir) {
  mkdirSync(shotDir, { recursive: true });
  for (let i = 0; i < 3; i += 1) {
    await page.screenshot({ path: `${shotDir}/${label}-${i + 1}.jpeg`, type: 'jpeg', quality: 78, clip: { x: 380, y: 40, width: 660, height: 380 } });
    await page.waitForTimeout(120);
  }
}
await browser.close();
writeFileSync(`series-${label}.json`, JSON.stringify(series));

const channel = key[0];
const yaws = series.map((r) => r[channel]).filter((v) => Number.isFinite(v));
const deltas = [];
for (let i = 1; i < yaws.length; i += 1) {
  const dt = Math.max(1, series[i].t - series[i - 1].t);
  // Kare süresine göre normalize: atlanan kare sahte "sıçrama" üretmesin.
  deltas.push(Math.abs(yaws[i] - yaws[i - 1]) * (16.67 / dt));
}
const moving = deltas.filter((d) => d > 1e-4);
const sorted = [...deltas].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const big = deltas.filter((d) => d > 0.02).length;
console.log(JSON.stringify({
  label, channel, channels: key, frames: yaws.length, errors,
  span: [Math.min(...yaws), Math.max(...yaws)],
  maxStep: Math.max(...deltas), p50: pct(.5), p95: pct(.95),
  movingFrames: moving.length, idleFrames: deltas.length - moving.length,
  stepsOver20mrad: big,
}, null, 1));
