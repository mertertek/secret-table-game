/**
 * D12 tur 4 kareleri: büyütülmüş silah + patlama (flaş / duman / kıvılcım).
 *   node scratchpad/d12-shots-t4.mjs [port]
 * Çıktı: docs/qa/claude/d12/*-t4.jpg
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const PORT = process.argv[2] || '5199';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d12';
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});

async function page(camera = 'seat') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`${BASE}/`);
  await p.evaluate((prefs) => localStorage.setItem('secret-table:prefs', JSON.stringify(prefs)), {
    quality: 'standard', reducedMotion: false, soundEnabled: false, sensitivity: 1,
    cameraMode: camera, announcements: true, fullscreenHintSeen: true,
  });
  return { ctx, p };
}

async function open(p, fixture, t) {
  await p.goto(`${BASE}/dev/game?fixture=${fixture}${t === undefined ? '' : `&t=${t}`}`);
  await p.waitForFunction(
    () => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 40000 },
  );
  await p.waitForTimeout(4200);
}

const shot = async (p, name, clip) => {
  await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 72, ...(clip ? { clip } : {}) });
  const data = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    return { gun: c?.dataset.d12GunTriangles ?? '-', calls: c?.dataset.sceneDrawCalls ?? '-', tris: c?.dataset.sceneTriangles ?? '-' };
  });
  console.log(name, JSON.stringify(data));
};

// 1 — yerel hazır poz (büyütülmüş silah, HUD kapanmıyor).
{
  const { ctx, p } = await page('seat');
  await open(p, 'execution-choose');
  await shot(p, 'local-ready-t4');
  await ctx.close();
}

// 2/3 — yerel ateş: flaş anı ve duman.
for (const [name, t] of [['local-fire-t4', 1320], ['local-smoke-t4', 1470]]) {
  const { ctx, p } = await page('seat');
  await open(p, 'execution-shot-local', t);
  await shot(p, name);
  await ctx.close();
}

// 4/5 — koltuktan (kamu kolu) ateş ve duman + silah yan profili.
for (const [name, t] of [['seat-fire-t4', 1320], ['seat-smoke-t4', 1500]]) {
  const { ctx, p } = await page('seat');
  await open(p, 'execution-shot-seat', t);
  await shot(p, name);
  if (t === 1320) await shot(p, 'gun-profile-close-t4', { x: 430, y: 170, width: 620, height: 430 });
  await ctx.close();
}

// 6 — genel masa: ateş anı (kamu kolu, patlama).
{
  const { ctx, p } = await page('overview');
  await open(p, 'execution-shot', 1330);
  await shot(p, 'fire-t1330-t4');
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `KONSOL HATASI (${errors.length}):\n${errors.join('\n')}` : 'konsol hatası yok');
