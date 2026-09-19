/** Teşhis: bakış/jest Realtime kanalı gerçekten kuruluyor mu? */
import { launch, makeCtx, setupGame, note, sceneInfo, shot } from './e2e-lib.mjs';
const ALL_WS = `
(() => { const O = window.WebSocket; window.__all = [];
  class S extends O { constructor(...a) { super(...a); window.__all.push({dir:'open', t:Date.now(), d:String(a[0]).slice(0,120)});
    this.addEventListener('message', (e)=>{ if (typeof e.data==='string') window.__all.push({dir:'in',t:Date.now(),d:e.data.slice(0,700)}); });
    const s=O.prototype.send; this.send=function(d){ if(typeof d==='string') window.__all.push({dir:'out',t:Date.now(),d:d.slice(0,700)}); return s.call(this,d); }; } }
  window.WebSocket = S; })();
`;
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
await A.ctx.addInitScript(ALL_WS); await B.ctx.addInitScript(ALL_WS);
try {
  const { code } = await setupGame(A, B);
  note('oda', code);
  note('A durum', JSON.stringify(await sceneInfo(A.p)));
  // koltuk kamerası + bakış hareketi
  for (const c of [A, B]) { await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Kendi koltuğum'))?.click()); await c.p.waitForTimeout(1000); }
  const box = await A.p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await A.p.mouse.move(box.x, box.y); await A.p.mouse.down();
  for (let i = 1; i <= 12; i++) { await A.p.mouse.move(box.x + i * 25, box.y + i * 3); await A.p.waitForTimeout(70); }
  await A.p.mouse.up(); await A.p.waitForTimeout(1500);
  const dump = async (c) => {
    const all = await c.p.evaluate(() => window.__all);
    const topics = new Set();
    for (const m of all) { const t = /"topic":"([^"]+)"/.exec(m.d); if (t) topics.add(t[1]); }
    note(`--- ${c.label} WS: ${all.length} çerçeve, topics: ${JSON.stringify([...topics])}`);
    for (const m of all.filter((x) => /viewpoint|phx_reply|phx_error|error|access_token|head/.test(x.d)).slice(0, 40)) note(`  [${c.label}/${m.dir}] ${m.d.slice(0, 300)}`);
  };
  await dump(A); await dump(B);
  // uygulamanın bildirdiği kanal sorunu
  for (const c of [A, B]) note(`${c.label} banner`, await c.p.evaluate(() => document.body.textContent.match(/Bakış[^.]*\.?/)?.[0] || 'yok'));
  await shot(A.p, 'diag-A'); await shot(B.p, 'diag-B');
} finally { await browser.close(); }
