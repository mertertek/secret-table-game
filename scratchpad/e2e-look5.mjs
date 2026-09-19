import { launch, makeCtx, setupGame, note } from './e2e-lib.mjs';
const SPY = `
(() => { window.__in = []; const O = window.WebSocket;
  class S extends O { constructor(...a) { super(...a); this.addEventListener('message', (e) => { if (typeof e.data === 'string') window.__in.push({ t: Date.now(), d: e.data.slice(0, 300) }); }); } }
  window.WebSocket = S; })();
`;
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
await A.ctx.addInitScript(SPY); await B.ctx.addInitScript(SPY);
try {
  await setupGame(A, B);
  await A.p.waitForTimeout(2500);
  for (const x of [A, B]) await x.p.evaluate(() => { window.__in.length = 0; });
  // A bir oyun hamlesi yapar (oda sürüm sinyali) — B bunu realtime'dan görmeli
  await A.p.evaluate(() => { const o = [...document.querySelectorAll('.actionbar__option')][0]; o?.click(); });
  await A.p.waitForTimeout(300);
  await A.p.evaluate(() => document.querySelector('.actionbar__confirm-buttons button')?.click());
  await A.p.waitForTimeout(3000);
  for (const x of [A, B]) {
    const inn = await x.p.evaluate(() => window.__in);
    note(`--- ${x.label} in ${inn.length}`);
    for (const o of inn.slice(0, 8)) note(`  ${x.label} IN ${o.d}`);
  }
} finally { await browser.close(); }
