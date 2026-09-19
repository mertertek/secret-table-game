import { launch, makeCtx, setupGame, note, shot } from './e2e-lib.mjs';
const SPY = `
(() => {
  window.__out = []; window.__in = []; window.__fetch = [];
  const origSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (d) { try { if (typeof d === 'string') window.__out.push({ t: Date.now(), d: d.slice(0, 400) }); } catch {} return origSend.call(this, d); };
  const origAdd = WebSocket.prototype.addEventListener;
  const OrigWS = window.WebSocket;
  class S extends OrigWS { constructor(...a) { super(...a); this.addEventListener('message', (e) => { if (typeof e.data === 'string') window.__in.push({ t: Date.now(), d: e.data.slice(0, 400) }); }); } }
  window.WebSocket = S;
  const of = window.fetch;
  window.fetch = function (...a) { try { const u = typeof a[0] === 'string' ? a[0] : a[0]?.url; if (u && /broadcast|realtime/.test(u)) window.__fetch.push({ t: Date.now(), u: String(u).slice(0, 200), body: String(a[1]?.body || '').slice(0, 300) }); } catch {} return of.apply(this, a); };
})();
`;
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
await A.ctx.addInitScript(SPY); await B.ctx.addInitScript(SPY);
try {
  await setupGame(A, B);
  for (const c of [A, B]) { await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Kendi koltuğum'))?.click()); await c.p.waitForTimeout(1500); }
  await A.p.waitForTimeout(3000);
  for (const c of [A, B]) await c.p.evaluate(() => { window.__out.length = 0; window.__in.length = 0; window.__fetch.length = 0; });
  const c = await A.p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await A.p.mouse.move(c.x, c.y); await A.p.mouse.down();
  for (let i = 1; i <= 16; i++) { await A.p.mouse.move(c.x + i * 26, c.y + i * 2, { steps: 2 }); await A.p.waitForTimeout(90); }
  await A.p.mouse.up(); await A.p.waitForTimeout(2000);
  for (const x of [A, B]) {
    const out = await x.p.evaluate(() => window.__out), inn = await x.p.evaluate(() => window.__in), f = await x.p.evaluate(() => window.__fetch);
    note(`--- ${x.label}: out ${out.length}, in ${inn.length}, fetch ${f.length}`);
    for (const o of out.slice(0, 10)) note(`  ${x.label} OUT ${o.d}`);
    for (const o of inn.slice(0, 10)) note(`  ${x.label} IN  ${o.d}`);
    for (const o of f.slice(0, 6)) note(`  ${x.label} FETCH ${o.u} :: ${o.body}`);
  }
  // jest de dene
  for (const x of [A, B]) await x.p.evaluate(() => { window.__out.length = 0; window.__in.length = 0; window.__fetch.length = 0; });
  await A.p.keyboard.press('g'); await A.p.waitForTimeout(400); await A.p.keyboard.press('1'); await A.p.waitForTimeout(2000);
  for (const x of [A, B]) {
    const out = await x.p.evaluate(() => window.__out), inn = await x.p.evaluate(() => window.__in), f = await x.p.evaluate(() => window.__fetch);
    note(`--- JEST ${x.label}: out ${out.length}, in ${inn.length}, fetch ${f.length}`);
    for (const o of out.slice(0, 8)) note(`  ${x.label} OUT ${o.d}`);
    for (const o of inn.slice(0, 8)) note(`  ${x.label} IN  ${o.d}`);
    for (const o of f.slice(0, 6)) note(`  ${x.label} FETCH ${o.u} :: ${o.body}`);
  }
} finally { await browser.close(); }
