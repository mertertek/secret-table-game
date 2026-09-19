/**
 * D11 — tam ekran deneyimi kareleri.
 *   node scratchpad/d11-shots.mjs before|after [port]
 * Çıktı: docs/qa/claude/d11/*.png
 *
 * NOT: headless Chrome'da gerçek Fullscreen ve Pointer Lock kurulamaz
 * (kullanıcı hareketi + gerçek pencere gerekir). Aynı düzeni almak için
 * `.game` kabına `data-immersive="locked"` / `data-hud-idle="true"` elle
 * yazılır; `:fullscreen` kuralı yalnız kabı 100dvw/dvh yapar, o da zaten
 * geçerlidir. Raporda belirtilmiştir.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '<yerel-yol>
);

const MODE = process.argv[2] === 'before' ? 'before' : 'after';
const PORT = process.argv[3] || '5199';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d11';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const errors = [];

async function session(viewport, cameraMode = 'seat') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`);
  await page.evaluate(
    (p) => localStorage.setItem('secret-table:prefs', JSON.stringify(p)),
    { quality: 'standard', reducedMotion: true, soundEnabled: false, sensitivity: 1, cameraMode, announcements: false, fullscreenHintSeen: true },
  );
  return { ctx, page };
}

async function open(page, fixture) {
  await page.goto(`${BASE}/dev/game?fixture=${fixture}`);
  await page.waitForSelector('.game');
  await page.waitForFunction(
    () => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0 ||
      !!document.querySelector('.scene-frame__fallback'),
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(2500);
}

/** Gerçek tam ekran yerine aynı düzen: kap immersive işaretlenir. */
const markImmersive = (page, idle) => page.evaluate((i) => {
  const el = document.querySelector('.game');
  el.setAttribute('data-immersive', 'locked');
  el.setAttribute('data-hud-idle', i ? 'true' : 'false');
}, idle);

const TOPRIGHT = { x: 640, y: 0, width: 800, height: 460 };

// --- 1. Sağ üst köşe: kamera düğmeleri + odak/menü + "Özel bilgin" paneli ---
{
  const { ctx, page } = await session({ width: 1440, height: 900 });
  await open(page, 'role-reveal-liberal');
  await page.keyboard.press('KeyH'); // kimlik katmanı açık
  await page.waitForTimeout(1200);
  await markImmersive(page, false);
  await page.screenshot({ path: `${OUT}/${MODE}-topright.png`, clip: TOPRIGHT });

  if (MODE === 'after') {
    // --- 2. Tahta incelemesi: alt açıklama şeridi ActionBar'ın üstünde ---
    await page.keyboard.press('KeyH'); // paneli kapat
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Tahta' }).click();
    await page.waitForTimeout(2200);
    await markImmersive(page, false);
    await page.screenshot({ path: `${OUT}/after-inspect-panel.png` });

    // --- 3. Kilitliyken hareketsizlik: kenar HUD'ları solar ---
    await page.getByRole('button', { name: 'Tahta' }).click();
    await page.waitForTimeout(1500);
    await markImmersive(page, true);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/after-hidden-hud.png` });
  }
  await ctx.close();
}

// --- 4. Telefon: araç çubuğu sarar, binmez ---
if (MODE === 'after') {
  const { ctx, page } = await session({ width: 390, height: 844 }, 'overview');
  await open(page, 'nomination');
  await page.screenshot({ path: `${OUT}/phone-top.png` });
  await ctx.close();
}

await browser.close();
console.log(`${MODE} kareleri hazır → ${OUT}`);
console.log(errors.length ? `KONSOL HATASI (${errors.length}):\n${errors.join('\n')}` : 'konsol hatası yok');
