/**
 * D21 canlı doğrulama + kareler.  node scratchpad/d21-shots.mjs [port] [only]
 *
 * only: "scene" (yalnız sahne kareleri) | "lobby" (yalnız lobiye dönüş turu)
 *
 * 1) E — şansölyeye kart geçişi: iki `cards_moved` cue'lu fixture, koltuk kamerası.
 * 2) A — oyun sonu/oyun içi "Lobiye dön": iki bağlam + 3 bot, ikinci bağlamın
 *    lobiye düşme süresi ölçülür (bellek kipinde Realtime YOK → yedek yoklama).
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('<yerel-yol>);

const PORT = process.argv[2] || '5205';
const ONLY = process.argv[3] || '';
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/qa/claude/d21';
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});

async function newPage(viewport = { width: 1440, height: 900 }, scale = 1.25) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, p };
}

const shot = async (p, name, selector = '.dev-scene__stage') => {
  const el = selector ? await p.$(selector) : null;
  await (el ?? p).screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 62 });
};

// --- 1) Sahne kareleri (E) ---------------------------------------------------
if (ONLY !== 'lobby') {
  const { ctx, p } = await newPage();
  const open = async (url) => {
    await p.goto(url);
    await p.waitForFunction(
      () => +(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0,
      null,
      { timeout: 45000 },
    );
    await p.waitForTimeout(3200);
  };
  const info = () =>
    p.evaluate(() => {
      const c = document.querySelector('canvas');
      const host = document.querySelector('[data-scene-office-hand]');
      return {
        office: host?.getAttribute('data-scene-office-hand'),
        active: host?.getAttribute('data-scene-cues-active'),
        played: host?.getAttribute('data-scene-cues-played'),
        calls: c?.dataset.sceneDrawCalls,
        tris: c?.dataset.sceneTriangles,
      };
    });

  const cases = [
    ['two-cues-t250', 'legislative-chancellor-seat-two-cues', '&t=250'],
    ['two-cues-t400', 'legislative-chancellor-seat-two-cues', '&t=400'],
    ['two-cues-t700', 'legislative-chancellor-seat-two-cues', '&t=700'],
    ['two-cues-settled', 'legislative-chancellor-seat-two-cues', ''],
    ['one-cue-t400', 'legislative-chancellor-seat', '&t=400'],
  ];
  for (const [name, fixture, extra] of cases) {
    await open(`${BASE}/dev/scene?fixture=${fixture}&camera=seat${extra}`);
    await shot(p, `chancellor-${name}`);
    console.log(`chancellor-${name}`.padEnd(28), JSON.stringify(await info()));
  }
  await ctx.close();
}

// --- 2) Lobiye dönüş turu (A) ------------------------------------------------
if (ONLY !== 'scene') {
  const host = await newPage({ width: 1280, height: 800 }, 1);
  const guest = await newPage({ width: 1280, height: 800 }, 1);

  const click = async (p, text, options = {}) => {
    const target = p.getByRole('button', { name: text, ...options }).first();
    await target.waitFor({ state: 'visible', timeout: 20000 });
    await target.click();
  };

  // Host: oda aç
  await host.p.goto(BASE);
  await host.p.getByPlaceholder('Örn. Mert').fill('Host');
  await click(host.p, 'Oda aç');
  await host.p.waitForFunction(
    () =>
      [...document.querySelectorAll('input')].some((i) => (i.value || '').includes('/katil/')),
    null,
    { timeout: 25000 },
  );
  const code = await host.p.evaluate(() => {
    const input = [...document.querySelectorAll('input')].find((i) =>
      (i.value || '').includes('/katil/'),
    );
    return (input?.value || '').split('/katil/')[1] || '';
  });
  console.log('oda kodu:', code);

  // Konuk: katıl
  await guest.p.goto(`${BASE}/katil/${code}`);
  await guest.p.getByPlaceholder('Örn. Mert').fill('Konuk');
  await click(guest.p, 'Katıl');
  await guest.p.waitForFunction(
    () => document.body.textContent.includes('Hazırım'),
    null,
    { timeout: 25000 },
  );

  // Botlar: masa 5 → 3 bot
  await host.p.selectOption('select', '5');
  await click(host.p, /bot ekle/);
  await host.p.waitForFunction(
    () => document.body.textContent.includes('Botlar çalışıyor'),
    null,
    { timeout: 30000 },
  );
  await host.p.waitForFunction(() => document.body.textContent.includes('5 / 10 oyuncu'), null, {
    timeout: 30000,
  });

  await click(guest.p, 'Hazırım');
  await click(host.p, 'Hazırım');
  await host.p.waitForTimeout(1500);
  await click(host.p, 'Oyunu başlat');

  const inGame = async (p) =>
    p.waitForFunction(() => document.querySelector('canvas') !== null, null, { timeout: 30000 });
  await inGame(host.p);
  await inGame(guest.p);
  console.log('oyun başladı (iki bağlam da masada)');

  // Rolleri onayla (iki bağlam): eylem çipi + Onayla
  const ack = async (p) => {
    for (let i = 0; i < 3; i += 1) {
      const chip = p.getByRole('button', { name: /Hazırım/ }).first();
      if (await chip.isVisible().catch(() => false)) {
        await chip.click();
        const confirm = p.getByRole('button', { name: 'Onayla' }).first();
        if (await confirm.isVisible().catch(() => false)) await confirm.click();
        return true;
      }
      await p.waitForTimeout(700);
    }
    return false;
  };
  console.log('host ack:', await ack(host.p), 'konuk ack:', await ack(guest.p));
  await host.p.waitForTimeout(2500);
  await shot(guest.p, 'lobby-return-01-guest-in-game', null);

  // İsteğe bağlı: botlarla birkaç tur oyna (optionId sıkılaştırması + cue yolu).
  if (process.env.D21_PLAY === '1') {
    const act = async (p) => {
      const option = p.locator('.actionbar__option').first();
      if (!(await option.isVisible().catch(() => false))) return false;
      await option.click().catch(() => {});
      const confirm = p.getByRole('button', { name: 'Onayla' }).first();
      if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => {});
      return true;
    };
    const board = (p) =>
      p.evaluate(() => {
        const t = document.body.textContent || '';
        return {
          phase: document.querySelector('.status-line, .game__status')?.textContent?.slice(0, 60),
          over: t.includes('Oyun bitti') || t.includes('kazandı'),
        };
      });
    const until = Date.now() + Number(process.env.D21_PLAY_MS || 120000);
    let moves = 0;
    while (Date.now() < until) {
      if (await act(host.p)) moves += 1;
      if (await act(guest.p)) moves += 1;
      const state = await board(guest.p);
      if (state.over) {
        console.log('OYUN BİTTİ (canlı):', state.phase);
        break;
      }
      await host.p.waitForTimeout(1200);
    }
    console.log('canlı tur: insan hamlesi', moves, 'son durum', JSON.stringify(await board(guest.p)));
    await shot(guest.p, 'play-01-guest', null);
    await shot(host.p, 'play-02-host', null);
  }

  // Host: menü → Lobiye dön
  await click(host.p, /Menü/);
  const started = Date.now();
  await click(host.p, 'Lobiye dön');
  console.log('host "Lobiye dön" bastı');

  let elapsed = null;
  try {
    await guest.p.waitForFunction(
      // NOT: lobide de canvas var (karakter önizlemesi); lobi göstergesi
      // "Davet bağlantısı" alanıdır.
      () => (document.body.textContent || '').includes('Davet bağlantısı'),
      null,
      { timeout: 30000 },
    );
    elapsed = Date.now() - started;
  } catch {
    elapsed = null;
  }
  console.log('KONUK LOBİYE DÖNÜŞ SÜRESİ (ms):', elapsed ?? 'ZAMAN AŞIMI (30 s)');
  await shot(guest.p, 'lobby-return-02-guest-lobby', null);
  await shot(host.p, 'lobby-return-03-host-lobby', null);

  await host.ctx.close();
  await guest.ctx.close();
}

await browser.close();
if (errors.length) console.log('SAYFA HATALARI:', errors.slice(0, 5));
else console.log('sayfa hatası yok');
