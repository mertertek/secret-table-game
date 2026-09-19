/**
 * D12 infaz kareleri (tur 2).
 *   node scratchpad/d12-shots.mjs [port]
 * Çıktı: docs/qa/claude/d12/*-t2.jpg
 *
 * Cue zamanı `?t=` ile DONDURULUR (apps/web/src/dev/sceneClock.ts): sayfa
 * açılırken saat durur, sahne cue'yu kabul edince istenen milisaniyeye atlar.
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

async function page(camera = 'overview', viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
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

async function open(p, route, fixture, t) {
  const url = `${BASE}/${route}?fixture=${fixture}${t === undefined ? '' : `&t=${t}`}`;
  await p.goto(url);
  await p.waitForFunction(
    () => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0,
    null,
    { timeout: 40000 },
  );
  // Karakter/el/silah geometrileri üretilsin (dondurulmuş saatte de gerçek zaman akar).
  await p.waitForTimeout(4000);
}

const shot = async (p, name, clip) => {
  await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 72, ...(clip ? { clip } : {}) });
  const data = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    return {
      gun: c?.dataset.d12GunTriangles ?? '-',
      motion: c?.dataset.fpMotion ?? '-',
      clock: window.sceneClock?.get?.() ?? '-',
    };
  });
  console.log(name, JSON.stringify(data));
};

// 1/2 — genel masa: nişan (t=900) ve ateş + flaş (t=1320).
for (const [name, t] of [['aim-t900-t2', 900], ['fire-t1320-t2', 1320]]) {
  const { ctx, p } = await page('overview');
  await open(p, 'dev/scene', 'execution-shot', t);
  await shot(p, name);
  await ctx.close();
}

// 3 — koreografi bittikten sonra: cue yok, hedef kalıcı çökük + `ko`.
{
  const { ctx, p } = await page('overview');
  await open(p, 'dev/scene', 'execution-shot');
  await p.waitForTimeout(3200);
  await shot(p, 'slumped-after-t2');
  await ctx.close();
}

// 4/5 — KOLTUK görüşü: atıcı ve hedef karşıda yan yana.
for (const [name, t] of [['seat-aim-t900-t2', 900], ['seat-fire-t1320-t2', 1320]]) {
  const { ctx, p } = await page('seat');
  await open(p, 'dev/game', 'execution-shot-seat', t);
  await shot(p, name);
  await ctx.close();
}

// 6 — koltuk görüşünde ÇÖKÜŞ yakın planı (cue bitti, kalıcı poz).
{
  const { ctx, p } = await page('seat');
  await open(p, 'dev/game', 'execution-shot-seat');
  await p.waitForTimeout(3200);
  await shot(p, 'seat-slump-close-t2', { x: 430, y: 130, width: 620, height: 430 });
  await ctx.close();
}

// 7 — vurulan oyuncunun ekranı: vinyet + "VURULDUN".
{
  const { ctx, p } = await page('seat');
  await open(p, 'dev/game', 'execution-shot-victim', 1500);
  // Başlık 3,6 sn'de söner; geometri kurulduktan sonra katman animasyonunu
  // baştan oynatıp "VURULDUN" anını yakala (durum aynı, yalnız CSS yeniden başlar).
  await p.evaluate(() => {
    for (const el of document.querySelectorAll('.shot-layer__card, .shot-layer__vignette')) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    }
  });
  await p.waitForTimeout(900);
  await shot(p, 'victim-screen-t2');
  await ctx.close();
}

// 8/9 — yerel atıcı: ilk şahıs sağ el silahla nişanda ve ateş anında.
for (const [name, t] of [['local-aim-t2', 1000], ['local-fire-t2', 1320]]) {
  const { ctx, p } = await page('seat');
  await open(p, 'dev/game', 'execution-shot-local', t);
  await shot(p, name);
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `KONSOL HATASI (${errors.length}):\n${errors.join('\n')}` : 'konsol hatası yok');
