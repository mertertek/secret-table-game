import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);
const b = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 460, height: 460 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
for (const skin of ['acik', 'orta', 'koyu']) {
  await p.goto(`http://localhost:5199/dev/hands?grip=openPalm&view=back&zoom=0.85&skin=${skin}`);
  await p.waitForFunction(() => document.querySelector('canvas')?.dataset.d1Ready === '1', null, { timeout: 30000 });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `/tmp/skin-${skin}.png`, type: 'png' });
  console.log(skin, 'ok');
}
await b.close();
