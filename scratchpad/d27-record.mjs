/**
 * D27 — README tanıtım GIF'i için ham kare çekimi.
 *
 * ffmpeg YOK: kareler CDP `Page.startScreencast` (jpeg) ile alınır, her karenin
 * gerçek zaman damgası manifest'e yazılır; birleştirme `d27-gif.py` işidir.
 *
 * Çalıştırma (mutlak yol YOK, hepsi ortamdan):
 *   PW_PATH=<playwright paket yolu> \
 *   CHROME_PATH=<chrome/headless-shell ikilisi> \
 *   OUT_DIR=<ham kare klasörü> \
 *   PORT=5208 node scratchpad/d27-record.mjs
 *
 * İsteğe bağlı: EXEC_TARGET (infaz hedefi rakamı, varsayılan 3), PROBE=1
 * (yalnız kurulumu yapar, tek kare kaydeder, çekim yapmaz), DIAG=1 (infaz
 * sırasında cue/faz örneklerini yazar).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const PW_PATH = process.env.PW_PATH;
const CHROME_PATH = process.env.CHROME_PATH;
const OUT = process.env.OUT_DIR;
if (!PW_PATH || !CHROME_PATH || !OUT) {
  throw new Error('PW_PATH, CHROME_PATH ve OUT_DIR ortam değişkenleri gerekli');
}
const { chromium } = require(PW_PATH);

const PORT = process.env.PORT || '5208';
const BASE = `http://localhost:${PORT}`;
const EXEC_TARGET = Number(process.env.EXEC_TARGET || 3);
const PROBE = process.env.PROBE === '1';
/** Tur 2 ısıtma atışı (tur 3'te gereksiz); ölçüm karşılaştırması için duruyor. */
const WARMUP = process.env.WARMUP === '1';
/** Duyuru şeritleri infaz segmentinde gizlensin mi (varsayılan evet). */
const HIDE_BANNERS = process.env.HIDE_BANNERS !== '0';
const W = 1280;
const H = 720;

mkdirSync(OUT, { recursive: true });
const log = (...args) => console.log(...args);

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_PATH,
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio'],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  locale: 'en-US',
  reducedMotion: 'no-preference',
  colorScheme: 'dark',
});
// Ses kapalı, duyurular açık, kamera koltuk, tam ekran ipucu görülmüş sayılır.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem(
      'secret-table:prefs',
      JSON.stringify({
        soundEnabled: false,
        cameraMode: 'seat',
        announcements: true,
        fullscreenHintSeen: true,
        sensitivity: 1,
        language: 'en',
      }),
    );
  } catch {
    /* yut */
  }
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// D27 tur 2: bellek kipinde yerel jestin oynaması artık DEPODA çözüldü
// (`viewpointChannel` Supabase'siz kipte hız sınırıyla `true` döner), bu yüzden
// tur 1'deki geçici `page.route` yaması KALDIRILDI. Çekim yamasızdır.

// --- Screencast kaydı ------------------------------------------------------
const cdp = await ctx.newCDPSession(page);
let segment = null;
cdp.on('Page.screencastFrame', (frame) => {
  cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  if (!segment) return;
  const ms = Math.round(frame.metadata.timestamp * 1000);
  const index = segment.frames.length;
  const name = `${String(index).padStart(4, '0')}.jpg`;
  writeFileSync(join(segment.dir, name), Buffer.from(frame.data, 'base64'));
  segment.frames.push({ file: name, t: ms });
});

async function startSegment(name) {
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  segment = { name, dir, frames: [] };
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    everyNthFrame: 1,
    maxWidth: W,
    maxHeight: H,
  });
}

async function stopSegment() {
  await cdp.send('Page.stopScreencast').catch(() => {});
  const done = segment;
  segment = null;
  await page.waitForTimeout(120);
  const spanMs = done.frames.length ? done.frames[done.frames.length - 1].t - done.frames[0].t : 0;
  writeFileSync(join(done.dir, 'frames.json'), JSON.stringify(done, null, 1));
  log(`segment ${done.name}: ${done.frames.length} kare, ${spanMs} ms, ~${(done.frames.length / Math.max(1, spanMs / 1000)).toFixed(1)} fps`);
  return done;
}

// --- Yardımcılar -----------------------------------------------------------
const click = async (name, timeout = 20000) => {
  const target = page.getByRole('button', { name }).first();
  await target.waitFor({ state: 'visible', timeout });
  await target.click();
};
const sceneReady = () =>
  page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.sceneFrames || 0) > 0, null, {
    timeout: 60000,
  });

/** Ease-in-out ile yumuşak sürükleme: kafa sıçramadan gezer. */
async function smoothDrag(from, to, ms, steps) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const t0 = Date.now();
  for (let i = 1; i <= steps; i += 1) {
    const u = i / steps;
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    await page.mouse.move(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
    const due = t0 + (ms * i) / steps;
    const wait = due - Date.now();
    if (wait > 1) await page.waitForTimeout(wait);
  }
  await page.mouse.up();
}

/** Menü → Geliştirici → senaryo. Menü hiç kayda girmez. */
async function runScenario(id, label) {
  await page.keyboard.press('m');
  await page.locator('#game-menu-tab-dev').click({ timeout: 15000 });
  await page.getByRole('button', { name: label }).first().click();
  await page.waitForFunction(
    () => (document.body.textContent || '').includes('Senaryo uygulandı.'),
    null,
    { timeout: 20000 },
  );
  log(`senaryo uygulandı: ${id}`);
  await page.locator('.game-menu__head').getByRole('button', { name: 'Close' }).click();
  await page.waitForFunction(() => document.querySelector('.game-menu') === null, null, { timeout: 10000 });
  await page.waitForTimeout(1200);
}

// --- 1) Oda kur: Mert + 6 bot = 7 oyuncu -----------------------------------
await page.goto(BASE);
await page.locator('input[autocomplete="nickname"]').fill('Mert');
await click('Create room');
await page.waitForFunction(
  () => [...document.querySelectorAll('input')].some((i) => (i.value || '').includes('/katil/')),
  null,
  { timeout: 30000 },
);
await page.selectOption('select', '7');
await click(/Add \d+ bots/);
await page.waitForFunction(() => (document.body.textContent || '').includes('7 / 10 players'), null, {
  timeout: 40000,
});
await click('I am ready');
await page.waitForTimeout(1200);
await click('Start the game');
await sceneReady();
log('oyun başladı');

// Rol ekranı: seçeneği seç + onayla.
for (let i = 0; i < 8; i += 1) {
  const option = page.locator('.actionbar__option').first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    const confirm = page.locator('.actionbar__confirm-buttons button').first();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    break;
  }
  await page.waitForTimeout(600);
}
await page.waitForTimeout(2500);
log('rol onaylandı, kamera:', await page.evaluate(() => document.querySelector('[data-scene-camera]')?.getAttribute('data-scene-camera')));

// Koltuk kamerası garanti.
if ((await page.evaluate(() => document.querySelector('[data-scene-camera]')?.getAttribute('data-scene-camera'))) !== 'seat') {
  await page.keyboard.press('v');
  await page.waitForTimeout(1500);
}

// Tahtada kanunlar olsun: infaz turu (yetki henüz yok).
await runScenario('execution_round', 'İnfaz turu (kanunlar hazır)');
await page.waitForTimeout(2500);

if (PROBE) {
  await page.screenshot({ path: join(OUT, 'probe-round.jpg'), type: 'jpeg', quality: 80 });
  await runScenario('execution_now', 'İnfaza atla (şimdi)');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, 'probe-exec.jpg'), type: 'jpeg', quality: 80 });
  log('seçenekler:', await page.evaluate(() => [...document.querySelectorAll('.actionbar__label')].map((e) => e.textContent)));
  await browser.close();
  process.exit(0);
}

const CX = 640;
const CY = 330;

// --- Sahne 1: bakış (kafa soldan sağa) -------------------------------------
// Kayıt dışı: önce sola bak.
await smoothDrag({ x: CX, y: CY }, { x: CX - 215, y: CY }, 700, 26);
await page.waitForTimeout(900);
await startSegment('01-look');
await page.waitForTimeout(250);
await smoothDrag({ x: CX - 80, y: CY }, { x: CX + 345, y: CY }, 2900, 150);
await page.waitForTimeout(250);
await stopSegment();

// Kayıt dışı: bakışı masanın ortasına geri getir (2–4 orada geçer).
await smoothDrag({ x: CX, y: CY }, { x: CX - 210, y: CY }, 600, 24);
await page.waitForTimeout(700);

// --- Sahne 2: jest çarkı → Hands up ----------------------------------------
await page.waitForTimeout(400);
await startSegment('02-emote');
await page.waitForTimeout(200);
await page.keyboard.press('g');
await page.waitForTimeout(700);
await page.keyboard.press('ArrowRight'); // dilim 1: Point
await page.waitForTimeout(320);
await page.keyboard.press('ArrowRight'); // dilim 2: Hands up
await page.waitForTimeout(600);
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
log('jest:', await page.evaluate(() => document.querySelector('[data-scene-emote-local]')?.getAttribute('data-scene-emote-local')));
await page.waitForTimeout(1900);
await stopSegment();
await page.waitForTimeout(1800);

// --- Sahne 3: tahtaya eğilme -----------------------------------------------
await startSegment('03-board');
await page.waitForTimeout(200);
await page.keyboard.press('b');
await page.waitForTimeout(2400);
await stopSegment();
await page.keyboard.press('b'); // koltuğa dön (kayıt dışı)
await page.waitForTimeout(1600);

// --- Sahne 4: infaz --------------------------------------------------------
/**
 * ISITMA ATIŞI — yalnız `WARMUP=1` iken (tur 2 geçici çözümü, ölçüm karşılaştırması
 * için duruyor). Tur 3'te `GunProp` patlama malzemelerini silah ele geldiğinde
 * opaklık 0 ile ön ısıttığı için VARSAYILAN KAPALI: tek atış daha temiz akış
 * verir, ikinci senaryonun açtığı ek duyuru şeritleri de oluşmaz.
 */
if (WARMUP) {
  await runScenario('execution_now', 'İnfaza atla (şimdi)');
  await page.waitForTimeout(1500);
  const warmupTarget = await page.evaluate(() => document.querySelectorAll('.actionbar__option').length);
  await page.keyboard.press(String(warmupTarget));
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(240);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4200);
  log('ısıtma infazı bitti, hedef sırası:', warmupTarget);
}

await runScenario('execution_now', 'İnfaza atla (şimdi)');
// NOT: senaryonun açtığı "PRESIDENTIAL POWER · Execution" duyurusu ateş anına
// kadar tam sönmüyor; beklemeyi 5 200 ms'e çıkarmak da işe YARAMADI (duyuru
// görünüm tazelenince yeniden beliriyor). 2 600 ms'de en azından solmuş oluyor.
await page.waitForTimeout(2600);

// Duyuru şeridi (`.announcer`) hedef seçiminin ve ateş anının üstüne binmesin.
// Vurulma duyurusu ("EXECUTION — … was shot") ateşten SONRA geri açılır.
if (HIDE_BANNERS) {
  await page.addStyleTag({ content: '#d27-ann-marker{display:none}.announcer{visibility:hidden!important}' });
  await page.waitForTimeout(150);
}
const unhideBanners = () =>
  page.evaluate(() => {
    for (const style of document.querySelectorAll('style')) {
      if (style.textContent?.includes('d27-ann-marker')) style.textContent = '';
    }
  });

await startSegment('04-execution');
await page.waitForTimeout(250);
const diag = page.evaluate(() => new Promise((resolve) => {
  const rows = [];
  const t0 = performance.now();
  const tick = () => {
    const el = document.querySelector('[data-scene-camera]');
    rows.push([Math.round(performance.now() - t0), el?.getAttribute('data-scene-cues-active'), el?.getAttribute('data-scene-cues-played'), (document.querySelector('.statusbar')?.textContent || '').slice(0, 28)]);
    if (performance.now() - t0 < 4200) setTimeout(tick, 60); else resolve(rows);
  };
  tick();
}));
await page.keyboard.press(String(EXEC_TARGET));
await page.waitForTimeout(620);
// İlk Enter onay adımını AÇAR (`armedByKey`), ikinci Enter gönderir.
await page.keyboard.press('Enter');
await page.waitForTimeout(240);
await page.keyboard.press('Enter');
// Ateş, komuttan ~1 570 ms sonra (görünüm tazelenmesi + `EXECUTION.fireAt` 1 300).
// Şeritler alev karesinden hemen SONRA geri açılır.
if (HIDE_BANNERS) {
  await page.waitForTimeout(1700);
  await unhideBanners();
  await page.waitForTimeout(2200);
} else {
  await page.waitForTimeout(3900);
}
await stopSegment();
if (process.env.DIAG === '1') console.log('DIAG', JSON.stringify(await diag));
log('infaz sonrası faz:', await page.evaluate(() => document.querySelector('.statusbar')?.textContent?.trim().slice(0, 70)));

await page.screenshot({ path: join(OUT, 'after-execution.jpg'), type: 'jpeg', quality: 80 });
log('sayfa hataları:', errors.length ? errors.slice(0, 4) : 'yok');
await browser.close();
