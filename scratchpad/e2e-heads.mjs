/** Kafa yaw'ının çizime uygulandığının görsel kanıtı (ağsız, /dev/scene peers fixture). */
import { launch, makeCtx, BASE, shot, png, diffRatio, note, sceneReady } from './e2e-lib.mjs';
const browser = await launch();
const { p } = await makeCtx(browser, 'H');
for (const [fx, tag] of [['emote-crowd', 'crowd'], ['emote-point', 'point'], ['emote-clap', 'clap']]) {
  await p.goto(`${BASE}/dev/scene?fixture=${fx}`);
  try { await sceneReady(p, 60000); } catch { note('kare yok', fx); continue; }
  await p.waitForTimeout(6000);
  await shot(p, `b20-peers-${tag}`);
  note(fx, JSON.stringify(await p.evaluate(() => { const c = document.querySelector('canvas'); const h = document.querySelector('[data-scene-emotes]'); return { calls: c?.dataset.sceneDrawCalls, emotes: h?.getAttribute('data-scene-emotes') }; })));
}
await browser.close();
