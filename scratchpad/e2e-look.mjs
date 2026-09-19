/** Bakış girdisi teşhisi: sürükleme A'nın kendi kamerasını oynatıyor mu, paket gidiyor mu? */
import { launch, makeCtx, setupGame, note, sceneInfo, png, diffRatio, shot } from './e2e-lib.mjs';
const SPY = `
(() => { const O = window.WebSocket; window.__all = [];
  class S extends O { constructor(...a) { super(...a);
    this.addEventListener('message', (e)=>{ if (typeof e.data==='string') window.__all.push({dir:'in',t:Date.now(),d:e.data.slice(0,400)}); });
    const s=O.prototype.send; this.send=function(d){ if(typeof d==='string') window.__all.push({dir:'out',t:Date.now(),d:d.slice(0,400)}); return s.call(this,d); }; } }
  window.WebSocket = S; })();
`;
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
await A.ctx.addInitScript(SPY); await B.ctx.addInitScript(SPY);
try {
  await setupGame(A, B);
  for (const c of [A, B]) { await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Kendi koltuğum'))?.click()); await c.p.waitForTimeout(1200); }
  note('A', JSON.stringify(await sceneInfo(A.p)));
  const canvas = await A.p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  note('canvas', JSON.stringify(canvas));
  const hit = await A.p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return el?.tagName + '.' + el?.className; });
  note('merkezdeki eleman', hit);
  const a0 = await png(A.p, 'look0');
  await A.p.evaluate(() => { window.__all.length = 0; });
  const cx = canvas.x + canvas.w / 2, cy = canvas.y + canvas.h / 2;
  await A.p.mouse.move(cx, cy); await A.p.mouse.down();
  for (let i = 1; i <= 12; i++) { await A.p.mouse.move(cx + i * 25, cy + i * 3); await A.p.waitForTimeout(70); }
  await A.p.mouse.up(); await A.p.waitForTimeout(1200);
  const a1 = await png(A.p, 'look1');
  note('A kendi kare değişimi (sürükleme):', diffRatio(a0, a1));
  const outs = await A.p.evaluate(() => window.__all.filter((x) => x.dir === 'out'));
  note('A giden çerçeve', outs.length);
  for (const o of outs.slice(0, 12)) note('  out:', o.d.slice(0, 260));
  const bIn = await B.p.evaluate(() => window.__all.filter((x) => x.dir === 'in' && x.d.includes('broadcast')));
  note('B gelen broadcast', bIn.length);
  for (const o of bIn.slice(0, 8)) note('  B in:', o.d.slice(0, 260));
  await shot(A.p, 'look-A'); await shot(B.p, 'look-B');
  // Pointer Lock yolu: odaklan sonrası fare deltası
  await A.p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Oyuna odaklan/.test(x.textContent))?.click());
  await A.p.waitForTimeout(1200);
  note('A immersive', await A.p.evaluate(() => document.querySelector('.game')?.getAttribute('data-immersive') + ' lock=' + !!document.pointerLockElement));
  await A.p.evaluate(() => { window.__all.length = 0; });
  const l0 = await png(A.p, 'lock0');
  for (let i = 0; i < 20; i++) { await A.p.mouse.move(cx + i * 15, cy); await A.p.waitForTimeout(50); }
  await A.p.waitForTimeout(1200);
  const l1 = await png(A.p, 'lock1');
  note('kilitli bakış kare değişimi:', diffRatio(l0, l1));
  const outs2 = await A.p.evaluate(() => window.__all.filter((x) => x.dir === 'out' && x.d.includes('head')).length);
  const bIn2 = await B.p.evaluate(() => window.__all.filter((x) => x.dir === 'in' && x.d.includes('head')).length);
  note('kilitli: A head giden', outs2, 'B head gelen', bIn2);
  await shot(A.p, 'look-locked-A'); await shot(B.p, 'look-locked-B');
} finally { await browser.close(); }
