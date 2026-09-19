/**
 * D10 — politika tahtası kareleri + okunurluk ölçümü.
 *   node scratchpad/d10-shots.mjs [port]
 * Çıktı: docs/qa/claude/d10/*.png
 *
 * Ölçüm: canlı R3F kamerasıyla dünya noktaları ekrana yansıtılır. Tahta tuvalinde
 * 1 tasarım px = 1 mm = .001 dünya birimi (tahta 1,94 × 0,45 m = 1940 × 450 px).
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const PORT = process.argv[2] || '5199';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d10';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const errors = [];

async function session(viewport, cameraMode) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`);
  await page.evaluate(
    (p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)),
    { quality: 'standard', reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode },
  );
  return { ctx, page };
}

async function open(page, fixture) {
  await page.goto(`${BASE}/dev/game?fixture=${fixture}`);
  await page.waitForFunction(
    () => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(2500);
}

/** Faşist tahta z = .16, liberal z = −.4; baskı yüzeyi y = .045. */
const measure = (page, board = 'fascist') => page.evaluate((b) => {
  const canvas = document.querySelector('canvas');
  const state = canvas?.__r3f?.root?.getState?.();
  if (!state) return { error: 'r3f kamera okunamadı' };
  const cam = state.camera; cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const rect = canvas.getBoundingClientRect();
  const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[r + 4] * v[1] + m[r + 8] * v[2] + m[r + 12] * v[3]);
  const screen = (p) => {
    const view = mul(cam.matrixWorldInverse.elements, [...p, 1]);
    const clip = mul(cam.projectionMatrix.elements, view);
    return [(clip[0] / clip[3]) * .5 * rect.width, -(clip[1] / clip[3]) * .5 * rect.height];
  };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const z0 = b === 'liberal' ? -.4 : .16, y = .045;
  // Tasarım px → dünya: x = px/1000 − .97, z = z0 + py/1000 − .225.
  const wx = (px) => px / 1000 - .97, wz = (py) => z0 + py / 1000 - .225;
  // 4. yuvanın (İNFAZ) bandı: ikon sol üst (x 1032, y 357), 64 mm kare.
  const iconX0 = wx(1032), iconY0 = wz(357);
  return {
    tahtaEni: Math.round(dist(screen([wx(0), y, wz(203)]), screen([wx(1940), y, wz(203)]))),
    bantIkonuYatay: +dist(screen([iconX0, y, iconY0]), screen([iconX0 + .064, y, iconY0])).toFixed(1),
    bantIkonuDikey: +dist(screen([iconX0, y, iconY0]), screen([iconX0, y, iconY0 + .064])).toFixed(1),
    bantEtiketi15px: +dist(screen([iconX0, y, wz(368)]), screen([iconX0, y, wz(383)])).toFixed(1),
    hitlerSeridi24px: +dist(screen([wx(1200), y, wz(25)]), screen([wx(1200), y, wz(49)])).toFixed(1),
    hitlerSeridiBandi42px: +dist(screen([wx(1200), y, wz(20)]), screen([wx(1200), y, wz(62)])).toFixed(1),
  };
}, board);

async function shot(page, name, board) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const m = await measure(page, board);
  const cam = await page.getAttribute('[data-scene-camera]', 'data-scene-camera');
  console.log(`${name}: kamera=${cam} ${JSON.stringify(m)}`);
}

const inspectBoard = async (page) => {
  await page.getByRole('button', { name: 'Tahtayı incele' }).click();
  await page.waitForTimeout(1400);
};

// --- "Tahtayı incele" kamerası: üç düzen -------------------------------------
for (const [name, fixture] of [
  ['inspect-board-medium', 'policy-result'],
  ['inspect-board-small', 'table-size-5'],
  ['inspect-board-large', 'table-size-10'],
]) {
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'overview');
  await open(page, fixture);
  await inspectBoard(page);
  await shot(page, name);
  await ctx.close();
}

// --- Koltuk + genel masa -----------------------------------------------------
{
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'seat');
  await open(page, 'policy-result');
  await shot(page, 'seat-board');
  await ctx.close();
}
{
  const { ctx, page } = await session({ width: 1440, height: 900 }, 'overview');
  await open(page, 'policy-result');
  await shot(page, 'overview-board');
  await ctx.close();
}

// --- Telefon inceleme --------------------------------------------------------
{
  const { ctx, page } = await session({ width: 390, height: 844 }, 'overview');
  await open(page, 'policy-result');
  await inspectBoard(page);
  await shot(page, 'phone-inspect');
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `KONSOL HATALARI:\n${errors.join('\n')}` : 'konsol hatası yok');
