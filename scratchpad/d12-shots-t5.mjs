/**
 * D12 tur 5 kareleri: HD silah (2,8 k üçgen, PBR malzeme + envMap).
 *   node scratchpad/d12-shots-t5.mjs [port]
 * Çıktı: docs/qa/claude/d12/*-t5.jpg
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
    return { gun: c?.dataset.d12GunTriangles ?? '-', ms: c?.dataset.d12GunMs ?? '-', calls: c?.dataset.sceneDrawCalls ?? '-', tris: c?.dataset.sceneTriangles ?? '-' };
  });
  console.log(name, JSON.stringify(data));
};

// 1 — yerel hazır poz (HD silah).
{
  const { ctx, p } = await page('seat');
  await open(p, 'execution-choose');
  await shot(p, 'local-ready-t5');
  await ctx.close();
}

// 2 — yerel ateş.
{
  const { ctx, p } = await page('seat');
  await open(p, 'execution-shot-local', 1320);
  await shot(p, 'local-fire-t5');
  await ctx.close();
}

// 3/4 — koltuktan ateş + silahın yan profili yakın plan.
{
  const { ctx, p } = await page('seat');
  await open(p, 'execution-shot-seat', 1320);
  await shot(p, 'seat-fire-t5');
  await shot(p, 'gun-profile-close-t5', { x: 645, y: 255, width: 620, height: 430 });
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `KONSOL HATASI (${errors.length}):\n${errors.join('\n')}` : 'konsol hatası yok');
