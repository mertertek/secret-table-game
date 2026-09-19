/**
 * D23 canlı doğrulama + kareler.  node scratchpad/d23-shots.mjs [port]
 *
 * İki bağlam + 3 bot aynı odada: biri TÜRKÇE, biri İNGİLİZCE. Aynı hamle
 * (rolü onayla, adaylık, oy) iki tarafta da kendi dilinde okunmalı; tahta
 * dokusu dile göre yeniden üretilmeli. Çizim sayısı/kare hızı değişmemeli.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);

const PORT = process.argv[2] || '5202';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d23';
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});

async function newPage(locale) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${locale}: ${e}`));
  return { ctx, p };
}

const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 60 });
const click = async (p, text) => {
  const t = p.getByRole('button', { name: text }).first();
  await t.waitFor({ state: 'visible', timeout: 20000 });
  await t.click();
};

const host = await newPage('tr-TR');
const guest = await newPage('en-US');

// 1) Giriş ekranı: dil anahtarı ve varsayılan dil
await host.p.goto(BASE);
await guest.p.goto(BASE);
await host.p.waitForTimeout(600);
await guest.p.waitForTimeout(600);
console.log('giriş TR metni:', await host.p.evaluate(() => document.querySelector('.hero__lead')?.textContent));
console.log('giriş EN metni:', await guest.p.evaluate(() => document.querySelector('.hero__lead')?.textContent));
await shot(guest.p, 'entry-en');

// 2) Oda: host TR açar, guest EN katılır
await host.p.getByPlaceholder('Örn. Mert').fill('Mert');
await click(host.p, 'Oda aç');
await host.p.waitForFunction(
  () => [...document.querySelectorAll('input')].some((i) => (i.value || '').includes('/katil/')),
  null, { timeout: 25000 },
);
const code = await host.p.evaluate(() => {
  const i = [...document.querySelectorAll('input')].find((x) => (x.value || '').includes('/katil/'));
  return (i?.value || '').split('/katil/')[1] || '';
});
console.log('oda kodu:', code);

await guest.p.goto(`${BASE}/katil/${code}`);
await guest.p.waitForTimeout(1200);
console.log('katıl sayfası (EN):', (await guest.p.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n/g, ' | '));
console.log('kök lang:', await guest.p.evaluate(() => document.documentElement.lang));
await guest.p.locator('input[autocomplete="nickname"]').fill('Alex');
await click(guest.p, /^(Join|Katıl)$/);
await guest.p.waitForFunction(() => document.body.textContent.includes('I am ready'), null, { timeout: 25000 });

await host.p.selectOption('select', '5');
await click(host.p, /bot ekle/);
await host.p.waitForFunction(() => document.body.textContent.includes('Botlar çalışıyor'), null, { timeout: 30000 });
await host.p.waitForFunction(() => document.body.textContent.includes('5 / 10 oyuncu'), null, { timeout: 30000 });
await shot(host.p, 'lobby-tr');

await click(guest.p, 'I am ready');
await click(host.p, 'Hazırım');
await host.p.waitForTimeout(1500);
await click(host.p, 'Oyunu başlat');

const inGame = (p) => p.waitForFunction(() => document.querySelector('canvas') !== null, null, { timeout: 30000 });
await inGame(host.p);
await inGame(guest.p);
const ready = (p) => p.waitForFunction(
  () => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, { timeout: 45000 });
await ready(host.p);
await ready(guest.p);
await host.p.waitForTimeout(2500);
await guest.p.waitForTimeout(2500);

const stats = (p) => p.evaluate(() => {
  const c = document.querySelector('canvas');
  return {
    status: document.querySelector('.statusbar')?.textContent,
    actions: [...document.querySelectorAll('.actionbar__label')].map((e) => e.textContent),
    tools: [...document.querySelectorAll('.btn-tool')].map((e) => e.textContent),
    draws: c?.dataset.sceneDrawCalls,
    frames: c?.dataset.sceneFrames,
  };
});
console.log('TR masa :', JSON.stringify(await stats(host.p)));
console.log('EN masa :', JSON.stringify(await stats(guest.p)));
await shot(host.p, 'game-tr');
await shot(guest.p, 'game-en');

// 3) Tahtaya bak: tahta dokusunun dili
const boardShot = async (side, name) => {
  await click(side.p, /^(Tahta|Boards)$/);
  await side.p.waitForTimeout(2200);
  await shot(side.p, name);
};
await boardShot(host, 'board-tr');
await boardShot(guest, 'board-en');
console.log('TR tahta çizim:', (await stats(host.p)).draws, '· EN tahta çizim:', (await stats(guest.p)).draws);

// 4) EN bağlamında oyun içi menüden TR'ye geç: anında değişmeli, yenileme yok
const before = await stats(guest.p);
await guest.p.keyboard.press('m');
await guest.p.waitForTimeout(500);
await guest.p.getByRole('radio', { name: 'Turkish' }).first().click();
await guest.p.waitForTimeout(1800);
const afterText = await guest.p.evaluate(() => ({
  menu: document.querySelector('#game-menu-title')?.textContent,
  tabs: [...document.querySelectorAll('.game-menu__tab')].map((e) => e.textContent),
}));
console.log('EN → TR menü:', JSON.stringify(afterText), '| çizim önce', before.draws);
await shot(guest.p, 'switch-en-to-tr');

console.log('sayfa hataları:', errors.length ? errors : 'yok');
await browser.close();
