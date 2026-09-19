import { launch, makeCtx, BASE, shot, note, sceneReady } from './e2e-lib.mjs';
const browser = await launch();
const { p } = await makeCtx(browser, 'H');
for (const [url, tag] of [['emote-crowd&t=800', 'crowd-t800'], ['emote-point&t=800', 'point-t800'], ['emote-middle&t=800', 'middle-t800']]) {
  await p.goto(`${BASE}/dev/scene?fixture=${url}`);
  try { await sceneReady(p, 60000); } catch { note('kare yok', url); continue; }
  await p.waitForTimeout(4000);
  const el = await p.$('.dev-scene__stage');
  await (el ?? p).screenshot({ path: `docs/qa/claude/e2e/b21-${tag}.jpg`, type: 'jpeg', quality: 60 });
  note(url, JSON.stringify(await p.evaluate(() => ({ e: document.querySelector('[data-scene-emotes]')?.getAttribute('data-scene-emotes'), c: document.querySelector('canvas')?.dataset.sceneDrawCalls }))));
}
await browser.close();
