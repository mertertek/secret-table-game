import { launch, makeCtx, setupGame, note, png, diffRatio, shot, sceneInfo } from './e2e-lib.mjs';
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
try {
  await setupGame(A, B);
  for (const c of [A, B]) { await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Kendi koltuğum'))?.click()); await c.p.waitForTimeout(1500); }
  await A.p.waitForTimeout(4000);
  await A.p.evaluate(() => {
    window.__ev = [];
    for (const n of ['pointerdown', 'pointermove', 'pointerup', 'mousemove', 'mousedown', 'pointercancel', 'lostpointercapture']) {
      window.addEventListener(n, (e) => window.__ev.push(`${n}|${e.target?.tagName}|${e.clientX}`), true);
    }
  });
  const c = await A.p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const p0 = await png(A.p, 'y0');
  await A.p.mouse.move(c.x, c.y);
  await A.p.mouse.down();
  for (let i = 1; i <= 10; i++) { await A.p.mouse.move(c.x + i * 30, c.y, { steps: 2 }); await A.p.waitForTimeout(80); }
  await A.p.mouse.up();
  await A.p.waitForTimeout(1200);
  const ev = await A.p.evaluate(() => window.__ev);
  note('olay sayısı', ev.length);
  note(JSON.stringify(ev.slice(0, 40)));
  const p1 = await png(A.p, 'y1');
  note('fark', diffRatio(p0, p1));
  await shot(A.p, 'look3');
} finally { await browser.close(); }
