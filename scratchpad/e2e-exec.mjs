/** D12 koreografi kareleri (fixture, ağsız): hazır poz → ateş → çöküş → kurban ekranı. */
import { launch, makeCtx, BASE, note, sceneReady } from './e2e-lib.mjs';
const browser = await launch();
const { p } = await makeCtx(browser, 'X');
const cases = [
  ['execution-choose-seat', '', 'x30-choose-seat'],
  ['execution-shot-local', '&t=200', 'x31-local-ready'],
  ['execution-shot-local', '&t=1300', 'x32-local-fire'],
  ['execution-shot-local', '&t=2300', 'x33-local-after'],
  ['execution-shot-seat', '&t=1400', 'x34-seat-fire'],
  ['execution-shot-victim', '&t=1500', 'x35-victim'],
  ['execution-shot', '&t=1400', 'x36-overview-fire'],
];
for (const [fx, extra, tag] of cases) {
  await p.goto(`${BASE}/dev/scene?fixture=${fx}${extra}`);
  try { await sceneReady(p, 60000); } catch { note('kare yok', fx); continue; }
  await p.waitForTimeout(4500);
  const el = await p.$('.dev-scene__stage');
  await (el ?? p).screenshot({ path: `docs/qa/claude/e2e/${tag}.jpg`, type: 'jpeg', quality: 60 });
  note(tag, fx, extra, JSON.stringify(await p.evaluate(() => ({ c: document.querySelector('canvas')?.dataset.sceneDrawCalls, cues: document.querySelector('[data-scene-cues-active]')?.getAttribute('data-scene-cues-active'), shot: !!document.querySelector('.shot-layer') }))));
}
await browser.close();
