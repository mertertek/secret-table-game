/**
 * ROADMAP §C/1 — gerçek Chrome (headless, Metal ANGLE) ile sahne ölçümü.
 *   node scratchpad/perf-measure.mjs [fixture1,fixture2,...] [dpr=1]
 * Çıktı: docs/qa/claude/perf/<tarih>-dpr<n>.json ; gizli değer yok, ağ/oda yok (/dev/game fixture).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const BASE = process.env.PERF_BASE || 'http://localhost:5173';
const fixtures = (process.argv[2] || 'president-discard').split(',');
const dpr = Number(process.argv[3] || 1);
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
const page = await ctx.newPage();
const THROTTLE = Number(process.env.CPU_THROTTLE || 1);
if (THROTTLE > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE }); }
const results = { at: new Date().toISOString(), viewport: '1440x900', dpr, cpuThrottle: THROTTLE, runs: [] };
const stats = () => page.evaluate(() => { const c = document.querySelector('canvas'); const d = c?.dataset ?? {};
  return { size: c ? [c.width, c.height] : null, frames: +d.sceneFrames || 0, calls: +d.sceneDrawCalls || 0, tris: +d.sceneTriangles || 0, tex: +d.sceneTextures || 0, geo: +d.sceneGeometries || 0 }; });
const waitFrames = async (min = 1, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await stats(); if (s.frames >= min && s.size && s.size[0] > 300) return s; await page.waitForTimeout(100); } return stats(); };
/** Sürekli çizim altında FPS: sürükleyerek bakış (seat) veya V ile kamera uçuşu (overview). */
const fpsTest = (mode) => page.evaluate(async (mode) => {
  const c = document.querySelector('canvas'); const start = +c.dataset.sceneFrames || 0; const t0 = performance.now();
  let raf = 0, longTasks = 0, maxTask = 0; const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) { longTasks++; maxTask = Math.max(maxTask, e.duration); } });
  try { po.observe({ type: 'longtask' }); } catch {}
  const P = HTMLElement.prototype; const orig = { s: P.setPointerCapture, h: P.hasPointerCapture, r: P.releasePointerCapture };
  P.setPointerCapture = () => {}; P.hasPointerCapture = () => false; P.releasePointerCapture = () => {};
  const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: type === 'pointerdown' ? 0 : -1, buttons: 1, clientX: x, clientY: y, pointerType: 'mouse' }));
  const key = (code, k) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: k, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code, key: k, bubbles: true })); };
  if (mode === 'drag') ev('pointerdown', cx, cy);
  let lastV = t0; const DUR = 5000;
  await new Promise((done) => { const step = () => { const t = performance.now() - t0; raf++;
    if (mode === 'drag') ev('pointermove', cx + Math.sin(t / 400) * 260, cy + Math.cos(t / 700) * 60);
    else if (performance.now() - lastV > 700) { key('KeyV', 'v'); lastV = performance.now(); }
    if (t < DUR) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
  if (mode === 'drag') ev('pointerup', cx, cy);
  P.setPointerCapture = orig.s; P.hasPointerCapture = orig.h; P.releasePointerCapture = orig.r;
  po.disconnect(); const dt = (performance.now() - t0) / 1000; const frames = (+c.dataset.sceneFrames || 0) - start;
  return { mode, seconds: +dt.toFixed(2), sceneFrames: frames, sceneFps: +(frames / dt).toFixed(1), rafFps: +(raf / dt).toFixed(1), longTasks, maxTaskMs: Math.round(maxTask) };
}, mode);
await page.goto(`${BASE}/`);
results.gpu = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const x = gl?.getExtension('WEBGL_debug_renderer_info'); return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
for (const fixture of fixtures) for (const quality of ['standard', 'low']) for (const cameraMode of ['overview', 'seat']) {
  await page.goto(`${BASE}/`); await page.evaluate((p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)), { quality, reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode });
  const nav0 = Date.now(); await page.goto(`${BASE}/dev/game?fixture=${fixture}`); const first = await waitFrames(1); const firstFrameMs = Date.now() - nav0;
  const SETTLE=Number(process.env.SETTLE_MS||1500), IDLE=Number(process.env.IDLE_MS||1500); await page.waitForTimeout(SETTLE); const settled = await stats(); await page.waitForTimeout(IDLE); const idle = await stats();
  const fps = await fpsTest(cameraMode === 'seat' ? 'drag' : 'flight');
  await page.waitForTimeout(800); const after = await stats();
  const run = { fixture, quality, cameraMode, firstFrameMs, canvas: after.size, calls: after.calls, tris: after.tris, tex: after.tex, geo: after.geo, idleWindowMs: IDLE, idleFrames: idle.frames - settled.frames, fps };
  results.runs.push(run); console.log(JSON.stringify(run));
}
await browser.close();
mkdirSync('docs/qa/claude/perf', { recursive: true });
const out = `docs/qa/claude/perf/${results.at.slice(0, 16).replace(/[:T]/g, '-')}-dpr${dpr}${THROTTLE > 1 ? `-cpu${THROTTLE}x` : ''}.json`; writeFileSync(out, JSON.stringify(results, null, 2)); console.log('gpu:', results.gpu, '→', out);
