/** Kontrollü bakış testi: aynı sayfada boşta-fark vs sürükleme-fark. */
import { launch, makeCtx, setupGame, note, sceneInfo, png, diffRatio, shot } from './e2e-lib.mjs';
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
try {
  await setupGame(A, B);
  for (const c of [A, B]) { await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Kendi koltuğum'))?.click()); await c.p.waitForTimeout(1500); }
  note('görünürlük A', await A.p.evaluate(() => document.visibilityState), 'B', await B.p.evaluate(() => document.visibilityState));
  note('A durum', JSON.stringify(await sceneInfo(A.p)));
  await A.p.waitForTimeout(4000);
  const i0 = await png(A.p, 'x0'); await A.p.waitForTimeout(2500); const i1 = await png(A.p, 'x1');
  note('boşta fark', diffRatio(i0, i1));
  const c = await A.p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  // React pointer olayları: playwright mouse gerçek pointerdown/move üretir
  const events = await A.p.evaluate(() => { window.__ev = []; const host = document.querySelector('[data-scene-camera]'); ['pointerdown','pointermove','pointerup'].forEach((n) => host.addEventListener(n, (e) => window.__ev.push(`${n}:${e.target.tagName}:${e.isPrimary}:${e.button}:${e.pointerId}`), true)); return true; });
  await A.p.mouse.move(c.x, c.y); await A.p.mouse.down();
  for (let i = 1; i <= 12; i++) { await A.p.mouse.move(c.x + i * 25, c.y); await A.p.waitForTimeout(60); }
  await A.p.mouse.up(); await A.p.waitForTimeout(1500);
  const i2 = await png(A.p, 'x2');
  note('sürükleme farkı', diffRatio(i1, i2));
  note('olaylar', JSON.stringify((await A.p.evaluate(() => window.__ev)).slice(0, 6)), '…toplam', (await A.p.evaluate(() => window.__ev.length)));
  await shot(A.p, 'look2-after-drag');
  // klavye ile bakış var mı? (ok tuşları inspect)
  // tekrar boşta fark
  await A.p.waitForTimeout(2500); const i3 = await png(A.p, 'x3');
  note('sürükleme sonrası boşta fark', diffRatio(i2, i3));
} finally { await browser.close(); }
