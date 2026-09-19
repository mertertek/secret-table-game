/** D16 jest kareleri. node scratchpad/d16-shots.mjs [port] */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const PORT = process.argv[2] || '5199';
const ONLY = process.argv[3] || '';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d16';
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });

const KINDS = ['point', 'hands_up', 'thumbs_up', 'thumbs_down', 'middle', 'wave', 'clap', 'facepalm'];
const MID = { point: 1500, hands_up: 1400, thumbs_up: 900, thumbs_down: 900, middle: 1200, wave: 700, clap: 937, facepalm: 1300 };

async function newPage(viewport = { width: 1440, height: 900 }, scale = 1.25, extra = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, ...extra });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, p };
}
async function openScene(p, url) {
  await p.goto(url);
  await p.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 45000 });
  await p.waitForTimeout(3500);
}
const info = (p) => p.evaluate(() => {
  const c = document.querySelector('canvas');
  const host = document.querySelector('[data-scene-emotes]');
  return {
    calls: c?.dataset.sceneDrawCalls, tris: c?.dataset.sceneTriangles,
    emote: c?.dataset.fpEmote ?? '', peers: host?.getAttribute('data-scene-emotes'),
    local: host?.getAttribute('data-scene-emote-local'),
  };
});
/** `/dev/scene` kenar çubuğu kadraja girmesin: yalnız sahne alanı. */
const shot = async (p, name, full = false) => {
  const stage = full ? null : await p.$('.dev-scene__stage');
  const target = stage ?? p;
  await target.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 58 });
  console.log(name.padEnd(30), JSON.stringify(await info(p)));
};

if (!ONLY || ONLY === 'local') {
  for (const kind of KINDS) {
    const { ctx, p } = await newPage();
    await openScene(p, `${BASE}/dev/scene?fixture=emote-local&camera=seat&emote=${kind}&t=${MID[kind]}`);
    await shot(p, `local-${kind}`);
    await ctx.close();
  }
}
if (!ONLY || ONLY === 'seat') {
  for (const kind of KINDS) {
    const { ctx, p } = await newPage();
    const id = kind === 'point' ? 'emote-point-seat' : kind === 'hands_up' ? 'emote-hands-up-seat' : `emote-peer-${kind}`;
    await openScene(p, `${BASE}/dev/scene?fixture=${id}&camera=seat&t=${MID[kind]}`);
    await shot(p, `seat-${kind}`);
    await ctx.close();
  }
}
if (!ONLY || ONLY === 'extra') {
  // Boşta çizim sayısı (jest yok) — ölçüm
  {
    const { ctx, p } = await newPage();
    await openScene(p, `${BASE}/dev/scene?fixture=emote-local&camera=seat`);
    await shot(p, 'idle-baseline');
    await ctx.close();
  }
  // AYNI sahne, jest bitmiş (t > süre): kamu jestinin çizim maliyeti farkı
  {
    const { ctx, p } = await newPage();
    await openScene(p, `${BASE}/dev/scene?fixture=emote-point-seat&camera=seat&t=3600`);
    await shot(p, 'idle-after-emote');
    await ctx.close();
  }
  // Kart tutarken point
  {
    const { ctx, p } = await newPage();
    await openScene(p, `${BASE}/dev/scene?fixture=emote-local-hand&camera=seat&emote=point&t=1500`);
    await shot(p, 'local-point-cards');
    await ctx.close();
  }
  // Kart tutarken iki elli (kartlar masaya yaslanır)
  {
    const { ctx, p } = await newPage();
    await openScene(p, `${BASE}/dev/scene?fixture=emote-local-hand&camera=seat&emote=hands_up&t=1400`);
    await shot(p, 'local-hands-up-cards');
    await ctx.close();
  }
  // Üç oyuncu birden (etiket sembolleri)
  {
    const { ctx, p } = await newPage({ width: 1920, height: 1080 }, 1);
    await openScene(p, `${BASE}/dev/scene?fixture=emote-crowd&camera=seat&t=1200`);
    await shot(p, 'seat-crowd');
    await ctx.close();
  }
  // Çark açık (masaüstü, gerçek oyun ekranı)
  {
    const { ctx, p } = await newPage({ width: 1920, height: 1080 }, 1);
    await p.goto(`${BASE}/`);
    await p.evaluate(() => localStorage.setItem('secret-table:prefs', JSON.stringify({
      quality: 'standard', reducedMotion: false, soundEnabled: false, sensitivity: 1,
      cameraMode: 'seat', announcements: true, fullscreenHintSeen: true })));
    await openScene(p, `${BASE}/dev/game?fixture=emote-local`);
    await p.keyboard.down('KeyG');
    await p.waitForTimeout(120);
    await p.keyboard.up('KeyG');
    await p.waitForTimeout(400);
    await shot(p, 'wheel-desktop', true);
    await p.keyboard.press('ArrowRight');
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(300);
    await shot(p, 'wheel-desktop-focus', true);
    await ctx.close();
  }
  // Telefon dikey çark
  {
    const { ctx, p } = await newPage({ width: 390, height: 844 }, 2, { hasTouch: true, isMobile: true });
    await p.goto(`${BASE}/`);
    await p.evaluate(() => localStorage.setItem('secret-table:prefs', JSON.stringify({
      quality: 'low', reducedMotion: false, soundEnabled: false, sensitivity: 1,
      cameraMode: 'seat', announcements: true, fullscreenHintSeen: true })));
    await openScene(p, `${BASE}/dev/game?fixture=emote-local`);
    await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Jest')?.click());
    await p.waitForTimeout(500);
    await shot(p, 'wheel-phone', true);
    await ctx.close();
  }
}
console.log('errors', errors.length, errors.slice(0, 5));
await browser.close();
