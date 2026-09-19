/**
 * D12 tur 3 kareleri: silah hedef seçimi sırasında elde + seçenek rakamları.
 *   node scratchpad/d12-shots-t3.mjs [port]
 * Çıktı: docs/qa/claude/d12/*-t3.jpg
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
  await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 70, ...(clip ? { clip } : {}) });
  const data = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const digits = [...document.querySelectorAll('.actionbar__digit')].map((el) => el.textContent).join('');
    return {
      gun: c?.dataset.d12GunTriangles ?? '-',
      motion: c?.dataset.fpMotion ?? '-',
      calls: c?.dataset.sceneDrawCalls ?? '-',
      digits,
    };
  });
  console.log(name, JSON.stringify(data));
};

// 1 — yerel oyuncu hedef seçiyor: silah hazır pozda, alt çubukta 5 rakam.
{
  const { ctx, p } = await page('seat');
  await open(p, 'execution-choose');
  await shot(p, 'local-ready-t3');
  await ctx.close();
}

// 2 — karşıdaki oyuncunun elinde silah (kamu kolu, hedefe dönmemiş).
{
  const { ctx, p } = await page('seat');
  await open(p, 'execution-choose-seat');
  await shot(p, 'seat-ready-t3');
  await shot(p, 'seat-ready-close-t3', { x: 430, y: 150, width: 620, height: 430 });
  await ctx.close();
}

// 3 — aynı silah ateş ederken (koreografi hazır pozdan başlar).
for (const [name, t] of [['local-aim-t3', 900], ['local-fire-t3', 1320]]) {
  const { ctx, p } = await page('seat');
  await open(p, 'execution-shot-local', t);
  await shot(p, name);
  await ctx.close();
}

// 4 — genel masa: boşta hazır poz (kamu kolu) çizim sayısı ölçümü için.
{
  const { ctx, p } = await page('overview');
  await open(p, 'execution-choose-seat');
  await shot(p, 'overview-ready-t3');
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `KONSOL HATASI (${errors.length}):\n${errors.join('\n')}` : 'konsol hatası yok');
