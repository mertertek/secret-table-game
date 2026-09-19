/** CPU profili: 5 s sürükleme (seat) sırasında self-time dağılımı. node scratchpad/perf-profile.mjs [fixture] [quality] */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const BASE = 'http://localhost:5173'; const fixture = process.argv[2] || 'president-discard'; const quality = process.argv[3] || 'standard';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
await page.goto(`${BASE}/`); await page.evaluate((p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)), { quality, reducedMotion: false, soundEnabled: false, sensitivity: 1, cameraMode: 'seat' });
await page.goto(`${BASE}/dev/game?fixture=${fixture}`); await page.waitForFunction(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 20000 }); await page.waitForTimeout(3000);
const cdp = await ctx.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start');
const fps = await page.evaluate(async () => { const c = document.querySelector('canvas'); const start = +c.dataset.sceneFrames; const t0 = performance.now();
  const P = HTMLElement.prototype; const o = { s: P.setPointerCapture, h: P.hasPointerCapture, r: P.releasePointerCapture }; P.setPointerCapture = () => {}; P.hasPointerCapture = () => false; P.releasePointerCapture = () => {};
  const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: type === 'pointerdown' ? 0 : -1, buttons: 1, clientX: x, clientY: y, pointerType: 'mouse' }));
  ev('pointerdown', cx, cy); await new Promise((done) => { const step = () => { const t = performance.now() - t0; ev('pointermove', cx + Math.sin(t / 400) * 260, cy + Math.cos(t / 700) * 60); if (t < 5000) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); }); ev('pointerup', cx, cy);
  P.setPointerCapture = o.s; P.hasPointerCapture = o.h; P.releasePointerCapture = o.r; const dt = (performance.now() - t0) / 1000; return { sceneFps: +(((+c.dataset.sceneFrames) - start) / dt).toFixed(1) }; });
const { profile } = await cdp.send('Profiler.stop'); await browser.close();
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n])); const total = profile.timeDeltas.reduce((a, b) => a + b, 0);
profile.samples.forEach((id, i) => { const n = byId.get(id); const f = n.callFrame; const url = (f.url || '').replace(/^.*\/node_modules\/\.pnpm\//, 'pnpm/').replace(/^.*\/secret-table\//, ''); const short = url.replace(/\?.*$/, '').split('/').slice(-2).join('/'); const key = `${f.functionName || '(anon)'} @ ${short}:${f.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + profile.timeDeltas[i]); });
const byFile = new Map(); for (const [k, v] of self) { const file = k.split(' @ ')[1].split(':')[0]; byFile.set(file, (byFile.get(file) || 0) + v); }
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`);
console.log(`fixture=${fixture} quality=${quality} sceneFps=${fps.sceneFps} totalMs=${Math.round(total / 1000)}`);
console.log('--- top files (self) ---'); console.log(top(byFile, 14).join('\n')); console.log('--- top functions (self) ---'); console.log(top(self, 22).join('\n'));
