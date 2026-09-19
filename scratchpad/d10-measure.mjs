/**
 * D10 — karelerdeki okunurluk ölçümü (piksel üzerinden).
 *   node scratchpad/d10-measure.mjs
 * PNG'ler Chromium'da çözülür. İki maske: (a) "kırmızı mürekkep" = sahne ışığı altında
 * da tutan bağıl kırmızılık (r−g, r−b), (b) "tahta kâğıdı" = krem/paper2 parlaklığı.
 * deviceScaleFactor 2 → bütün çıktılar css px.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

/** name → bant satırının css y aralığı (kareden okunmuş) ve tahta gövdesi y aralığı. */
const SHOTS = [
  { name: 'inspect-board-medium', band: [525, 580], board: [400, 600] },
  { name: 'inspect-board-small', band: [525, 580], board: [400, 600] },
  { name: 'inspect-board-large', band: [525, 580], board: [400, 600] },
  { name: 'seat-board', band: [483, 500], board: [430, 500] },
  { name: 'overview-board', band: [465, 478], board: [420, 480] },
  { name: 'phone-inspect', band: [440, 460], board: [377, 466] },
];

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage();
await page.goto('about:blank');

for (const shot of SHOTS) {
  const data = readFileSync(`docs/qa/claude/d10/${shot.name}.png`).toString('base64');
  const out = await page.evaluate(async ({ b64, band, board }) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data: px, width: W, height: H } = ctx.getImageData(0, 0, cv.width, cv.height);
    const comps = (test, y0, y1, minArea) => {
      const mask = new Uint8Array(W * H);
      for (let y = Math.max(0, y0 * 2); y < Math.min(H, y1 * 2); y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if (test(px[i], px[i + 1], px[i + 2])) mask[y * W + x] = 1;
        }
      }
      const seen = new Uint8Array(W * H), stack = new Int32Array(W * H), found = [];
      for (let p0 = 0; p0 < mask.length; p0++) {
        if (!mask[p0] || seen[p0]) continue;
        let top = 0; stack[top++] = p0; seen[p0] = 1;
        let x0 = W, x1 = 0, yy0 = H, yy1 = 0, area = 0;
        while (top) {
          const p = stack[--top], x = p % W, y = (p - x) / W; area++;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < yy0) yy0 = y; if (y > yy1) yy1 = y;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const np = ny * W + nx;
            if (mask[np] && !seen[np]) { seen[np] = 1; stack[top++] = np; }
          }
        }
        if (area >= minArea) found.push({ x: x0 / 2, cx: (x0 + x1) / 4, w: (x1 - x0 + 1) / 2, h: (yy1 - yy0 + 1) / 2, area: area / 4 });
      }
      return found.sort((a, b) => a.x - b.x);
    };
    // (a) Bant satırındaki kırmızı ikonlar: sahne ışığı altında da tutan bağıl kırmızılık.
    const ink = comps((r, g, b) => r - g > 22 && r - b > 22 && r > 70, band[0], band[1], 24);
    // (b) Tahta gövdesinin ekrandaki eni: keçeye karşı krem satır koşusu.
    let widest = { run: 0, y: 0, x: 0 };
    for (let y = Math.max(0, board[0] * 2); y < Math.min(H, board[1] * 2); y++) {
      let run = 0, start = 0;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
        const paper = r > 150 && g > 120 && b > 85 && r >= g && g >= b;
        const party = r - g > 22 && r - b > 22 && r > 70;
        if (paper || party) { if (!run) start = x; run++; if (run > widest.run) widest = { run, y: y / 2, x: start / 2 }; }
        else run = 0;
      }
    }
    return { size: [W / 2, H / 2], ink: ink.map((c) => ({ x: c.x, cx: +c.cx.toFixed(1), w: +c.w.toFixed(1), h: +c.h.toFixed(1) })), widest: { ...widest, run: widest.run / 2 } };
  }, { b64: data, band: shot.band, board: shot.board });
  console.log(`\n## ${shot.name} (${out.size[0]}×${out.size[1]} css)`);
  console.log(`   en geniş tahta satırı: ${out.widest.run} css px (y=${out.widest.y}, x=${out.widest.x}) → px/mm ≈ ${(out.widest.run / 1940).toFixed(3)}`);
  console.log(`   bant satırı kırmızı ikonlar (soldan): ${out.ink.map((c) => `${c.w}×${c.h}@${c.cx}`).join('  ')}`);
  const cxs = out.ink.map((c) => c.cx);
  const gaps = cxs.slice(1).map((v, i) => +(v - cxs[i]).toFixed(1)).filter((g) => g > 20);
  if (gaps.length) console.log(`   ikon merkez aralıkları: ${gaps.join(', ')} css px (tasarım 211,5 mm)`);
}
await browser.close();
