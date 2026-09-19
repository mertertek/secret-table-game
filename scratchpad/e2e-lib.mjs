/** E2E 2026-09-12 ortak yardımcılar. Kod değiştirmez; yalnız sürüş. */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
export const { chromium } = require('<yerel-yol>);
export const PORT = process.env.E2E_PORT || '5199';
export const BASE = `http://localhost:${PORT}`;
export const OUT = 'docs/qa/claude/e2e';
mkdirSync(OUT, { recursive: true });

export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export async function launch() {
  return chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
}
export const log = [];
export function note(...parts) {
  const line = parts.join(' ');
  log.push(line);
  console.log(line);
}
export async function makeCtx(browser, label, viewport = { width: 1440, height: 900 }, extra = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, permissions: ['clipboard-read', 'clipboard-write'], ...extra });
  const p = await ctx.newPage();
  const errors = [];
  const net = [];
  p.on('pageerror', (e) => errors.push(`[${label}] pageerror ${String(e).slice(0, 300)}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console ${m.text().slice(0, 300)}`); });
  p.on('response', (r) => { if (r.status() >= 400) net.push(`[${label}] ${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`); });
  return { ctx, p, errors, net, label };
}
export async function shot(target, name, opts = {}) {
  const path = `${OUT}/${name}.jpg`;
  await target.screenshot({ path, type: 'jpeg', quality: 55, ...opts });
  return path;
}
export async function sceneReady(p, timeout = 60000) {
  await p.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 2, null, { timeout });
}
export async function sceneInfo(p) {
  return p.evaluate(() => {
    const c = document.querySelector('canvas');
    const host = document.querySelector('[data-scene-camera]');
    return {
      frames: +(c?.dataset.sceneFrames || 0), calls: +(c?.dataset.sceneDrawCalls || 0), tris: +(c?.dataset.sceneTriangles || 0),
      camera: host?.getAttribute('data-scene-camera'), locked: host?.getAttribute('data-scene-locked'),
      emotes: host?.getAttribute('data-scene-emotes'), localEmote: host?.getAttribute('data-scene-emote-local'),
      office: host?.getAttribute('data-scene-office-hand'), badges: host?.getAttribute('data-scene-vote-badges'),
      cues: host?.getAttribute('data-scene-cues-played'), sounds: host?.getAttribute('data-scene-sounds-played'),
      audio: host?.getAttribute('data-scene-audio-state'),
      status: document.querySelector('.statusbar__phase')?.textContent || '',
      detail: document.querySelector('.statusbar__detail')?.textContent || '',
      actions: [...document.querySelectorAll('.game__bottom button')].map((b) => b.textContent.trim()).slice(0, 14),
    };
  });
}
export async function createRoom(p, name) {
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await p.fill('input[autocomplete="nickname"]', name);
  await p.click('button:has-text("Oda aç")');
  try {
    await p.waitForSelector('.code-badge__value', { timeout: 45000 });
  } catch (e) {
    const msg = await p.evaluate(() => document.querySelector('.notice--error, [role=alert]')?.textContent || document.body.textContent.slice(0, 300));
    throw new Error(`Oda açılamadı: ${msg}`);
  }
  const code = (await p.textContent('.code-badge__value')).trim();
  const url = await p.inputValue('#invite-url');
  return { code, url };
}
export async function joinRoom(p, code, name) {
  await p.goto(`${BASE}/katil/${code}`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('input', { timeout: 20000 });
  await p.fill('input', name);
  await p.click('button:has-text("Katıl")');
  await p.waitForSelector('.code-badge__value', { timeout: 45000 });
}

// --- görüntü karşılaştırma (pngjs + pixelmatch) ---
import { readFileSync } from 'node:fs';
const PNG = require('<yerel-yol>).PNG;
const pixelmatch = require('<yerel-yol>).default;
export async function png(target, name) {
  const path = `${OUT}/tmp-${name}.png`;
  await target.screenshot({ path, type: 'png' });
  return path;
}
export function diffRatio(p1, p2) {
  const a = PNG.sync.read(readFileSync(p1));
  const b = PNG.sync.read(readFileSync(p2));
  if (a.width !== b.width || a.height !== b.height) return null;
  const n = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.12 });
  return +(n / (a.width * a.height)).toFixed(5);
}

/** Oyun kurulumu: A ev sahibi, B davetli, 3 bot, ikisi de hazır. */
export async function setupGame(A, B, { target = 5, names = ['Mert', 'Bahar'] } = {}) {
  const { code } = await createRoom(A.p, names[0]);
  await joinRoom(B.p, code, names[1]);
  await B.p.waitForSelector('.picker__card', { timeout: 20000 });
  const bots = await A.p.evaluate(async (t) => {
    const m = await import('/src/dev/botRunner.ts');
    return (await m.startBots({ roomId: location.pathname.split('/').pop(), inviteCode: document.querySelector('.code-badge__value').textContent.trim(), target: t, currentMembers: 2 })).count;
  }, target);
  await A.p.waitForTimeout(7000);
  await B.p.click('button:has-text("Hazırım")');
  await A.p.click('button:has-text("Hazırım")');
  await A.p.waitForTimeout(2500);
  await A.p.click('button:has-text("Oyunu başlat")');
  await sceneReady(A.p); await sceneReady(B.p);
  await A.p.waitForTimeout(3500);
  // rol tanışması: iki insan da hazır
  for (const c of [A, B]) {
    await c.p.evaluate(() => { const o = [...document.querySelectorAll('.actionbar__option')].find((x) => /Hazır/.test(x.textContent)); o?.click(); });
    await c.p.waitForTimeout(400);
    await c.p.evaluate(() => document.querySelector('.actionbar__confirm-buttons button')?.click());
    await c.p.waitForTimeout(900);
  }
  await A.p.waitForTimeout(3000);
  return { code, bots };
}
