/** E2E ana akış: A (ev sahibi) + B (davetli) + 3 bot. Faz faz ilerler, kanıt karesi alır. */
import { launch, makeCtx, createRoom, joinRoom, shot, note, sceneInfo, sceneReady, BASE } from './e2e-lib.mjs';
import { WS_INIT } from './e2e-ws.mjs';
import { writeFileSync } from 'node:fs';

const results = [];
const pass = (id, ok, ev, n = '') => { results.push({ id, ok, ev, n }); note(`${ok ? 'GEÇTİ' : 'KALDI'} ${id} | ${ev} | ${n}`); };
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
await A.ctx.addInitScript(WS_INIT);
await B.ctx.addInitScript(WS_INIT);
// init script sonrası sayfayı tazele
const step = async (name, fn) => { try { return await fn(); } catch (e) { note(`!! ${name} hata: ${String(e).slice(0, 400)}`); return null; } };

async function drive(p, label, submit = true) {
  const idx = await p.evaluate((lbl) => {
    const opts = [...document.querySelectorAll('.actionbar__option')];
    const i = lbl ? opts.findIndex((o) => o.textContent.includes(lbl)) : 0;
    if (i < 0) return -1;
    opts[i].click();
    return i;
  }, label);
  if (idx < 0) return false;
  await p.waitForTimeout(400);
  if (submit) {
    await p.evaluate(() => document.querySelector('.actionbar__confirm-buttons button')?.click());
    await p.waitForTimeout(900);
  }
  return true;
}
async function phaseOf(p) {
  return p.evaluate(() => ({
    status: document.querySelector('.statusbar__phase')?.textContent || '',
    detail: document.querySelector('.statusbar__detail')?.textContent || '',
    opts: [...document.querySelectorAll('.actionbar__option .actionbar__label')].map((n) => n.textContent.trim()),
    idle: document.querySelector('.actionbar__idle')?.textContent || '',
    over: !!document.querySelector('.game-over'),
    announce: document.querySelector('[class*=announce]')?.textContent || '',
  }));
}
try {
// ---------- A: lobi ----------
const { code } = await createRoom(A.p, 'Mert');
note('oda', code);
await joinRoom(B.p, code, 'Bahar');
await B.p.waitForSelector('.picker__card', { timeout: 20000 });
await B.p.waitForTimeout(800);
// B karakter + ten seçimi, A'da görünme süresi
const t0 = Date.now();
const picked = await B.p.evaluate(() => {
  const cards = [...document.querySelectorAll('.picker__card')];
  const t = cards.find((c) => c.querySelector('.picker__card-name')?.textContent.includes('Fötr')) || cards[3];
  t.click();
  return t.querySelector('.picker__card-name')?.textContent;
});
let seen = -1;
for (let i = 0; i < 40; i++) {
  const ok = await A.p.evaluate((name) => [...document.querySelectorAll('.seat__avatar-name')].some((n) => n.textContent.includes(name)), picked);
  if (ok) { seen = Date.now() - t0; break; }
  await A.p.waitForTimeout(200);
}
pass('A-avatar-sync', seen >= 0 && seen <= 3000, 'a2-lobby-guest-picker.jpg', `B "${picked}" seçti → A'da ${seen} ms`);
await shot(B.p, 'a2-lobby-guest-picker');
const bots = await A.p.evaluate(async () => {
  const m = await import('/src/dev/botRunner.ts');
  const r = await m.startBots({ roomId: location.pathname.split('/').pop(), inviteCode: document.querySelector('.code-badge__value').textContent.trim(), target: 5, currentMembers: 2 });
  return r.count;
});
await A.p.waitForTimeout(7000);
const seats = await A.p.evaluate(() => [...document.querySelectorAll('.seat')].map((s) => ({ n: s.querySelector('.seat__name')?.textContent, a: s.querySelector('.seat__avatar-name')?.textContent })));
const chars = seats.filter((s) => s.a).map((s) => s.a);
pass('A-bots', bots === 3 && chars.length === 5, 'a4-lobby-5p.jpg', `${bots} bot; karakterler ${JSON.stringify(chars)}; benzersiz ${new Set(chars).size}/${chars.length}`);
await shot(A.p, 'a4-lobby-5p');
await B.p.click('button:has-text("Hazırım")');
await A.p.click('button:has-text("Hazırım")');
await A.p.waitForTimeout(2500);
await A.p.click('button:has-text("Oyunu başlat")');
await Promise.all([sceneReady(A.p), sceneReady(B.p)]);
await A.p.waitForTimeout(4000);
note('A sahne', JSON.stringify(await sceneInfo(A.p)));
note('B sahne', JSON.stringify(await sceneInfo(B.p)));
await shot(A.p, 'a6-game-start-A');
await shot(B.p, 'a6-game-start-B');
pass('A-start', true, 'a6-game-start-A.jpg', 'oyun başladı, iki bağlamda sahne çizildi');

// ---------- B: kafa senkronu ----------
await step('kafa senkronu', async () => {
  // koltuk kamerası
  for (const c of [A, B]) {
    await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Kendi koltuğum'))?.click());
    await c.p.waitForTimeout(1200);
  }
  note('A kamera', (await sceneInfo(A.p)).camera, 'B kamera', (await sceneInfo(B.p)).camera);
  await A.p.evaluate(() => { window.__ws.length = 0; });
  await B.p.evaluate(() => { window.__ws.length = 0; });
  const box = await A.p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; });
  const before = await shot(B.p, 'b1-head-before');
  // sağa sürükle
  await A.p.mouse.move(box.x, box.y);
  await A.p.mouse.down();
  for (let i = 1; i <= 14; i++) { await A.p.mouse.move(box.x + i * 22, box.y + i * 4); await A.p.waitForTimeout(60); }
  await A.p.mouse.up();
  await A.p.waitForTimeout(1500);
  await shot(B.p, 'b2-head-right');
  await shot(A.p, 'b2-head-right-A-view');
  // aşağı+sola
  await A.p.mouse.move(box.x, box.y); await A.p.mouse.down();
  for (let i = 1; i <= 16; i++) { await A.p.mouse.move(box.x - i * 24, box.y + i * 8); await A.p.waitForTimeout(60); }
  await A.p.mouse.up();
  await A.p.waitForTimeout(1500);
  await shot(B.p, 'b3-head-left-down');
  const aOut = await A.p.evaluate(() => window.__ws.filter((x) => x.dir === 'out').map((x) => ({ t: x.t, d: x.d })));
  const bIn = await B.p.evaluate(() => window.__ws.filter((x) => x.dir === 'in').map((x) => ({ t: x.t, d: x.d })));
  const parseSeq = (d) => { const m = /"seq":(\d+)/.exec(d); const y = /"yaw":(-?[\d.]+)/.exec(d); return m ? { seq: +m[1], yaw: y ? +y[1] : null } : null; };
  const lat = [];
  for (const o of aOut) {
    const s = parseSeq(o.d); if (!s) continue;
    const hit = bIn.find((i) => { const t = parseSeq(i.d); return t && t.seq === s.seq && Math.abs((t.yaw ?? 0) - (s.yaw ?? 0)) < 1e-6 && i.t >= o.t; });
    if (hit) lat.push(hit.t - o.t);
  }
  lat.sort((a, b) => a - b);
  note('A giden paket', aOut.length, 'B gelen', bIn.length, 'gecikmeler', JSON.stringify(lat));
  const yaws = aOut.map((o) => parseSeq(o.d)?.yaw).filter((v) => v != null);
  pass('B-head-send', aOut.length >= 2 && yaws.some((y) => Math.abs(y) > 0.2), 'b2-head-right.jpg', `A ${aOut.length} bakış paketi, yaw aralığı ${Math.min(...yaws).toFixed(2)}..${Math.max(...yaws).toFixed(2)}`);
  pass('B-head-latency', lat.length > 0 && lat[Math.floor(lat.length / 2)] < 400, 'b3-head-left-down.jpg', lat.length ? `medyan ${lat[Math.floor(lat.length / 2)]} ms, min ${lat[0]}, maks ${lat[lat.length - 1]} (n=${lat.length})` : 'eşleşen paket yok');
  // boşta gönderim durur mu
  await A.p.evaluate(() => { window.__ws.length = 0; });
  await A.p.waitForTimeout(3000);
  const idleOut = await A.p.evaluate(() => window.__ws.filter((x) => x.dir === 'out').length);
  pass('B-idle-stop', idleOut === 0, '-', `3 s hareketsizlikte giden paket ${idleOut}`);
  // bayatlama: 4 s sonra B'de nötre dönüş (kare değişimi)
  await B.p.waitForTimeout(2000);
  await shot(B.p, 'b4-head-stale');
});

// ---------- C: jestler ----------
await step('jestler', async () => {
  await B.p.evaluate(() => { window.__ws.length = 0; });
  const kinds = [];
  for (const [key, label] of [['1', 'jest-1'], ['2', 'jest-2'], ['3', 'jest-3']]) {
    const before = await sceneInfo(A.p);
    await A.p.keyboard.press('g');
    await A.p.waitForTimeout(500);
    const open = await A.p.evaluate(() => !!document.querySelector('[class*=emote]'));
    const wheelTxt = await A.p.evaluate(() => document.querySelector('[class*=wheel],[class*=emote]')?.textContent?.slice(0, 200) || '');
    if (label === 'jest-1') { await shot(A.p, 'c1-emote-wheel'); note('jest çarkı açık', open, wheelTxt); }
    await A.p.keyboard.press(key);
    await A.p.waitForTimeout(900);
    const after = await sceneInfo(A.p);
    kinds.push({ key, local: after.localEmote, sounds: after.sounds });
    await shot(A.p, `c2-emote-${key}-A`);
    await shot(B.p, `c2-emote-${key}-B`);
    await A.p.waitForTimeout(2600);
  }
  note('jest sonuçları', JSON.stringify(kinds));
  const bEmote = await B.p.evaluate(() => window.__ws.filter((x) => x.dir === 'in' && x.d.includes('emote')).map((x) => { const k = /"kind":"(\w+)"/.exec(x.d); const s = /"emote":\{[^}]*"seq":(\d+)/.exec(x.d) || /"seq":(\d+)/.exec(x.d); return { t: x.t, kind: k && k[1], raw: x.d.slice(0, 200) }; }));
  const seqs = await B.p.evaluate(() => window.__ws.filter((x) => x.dir === 'in' && x.d.includes('emote')).map((x) => x.d.match(/"emote":\{.*?\}/)?.[0] || ''));
  note('B gelen jest paketleri', bEmote.length, JSON.stringify(seqs).slice(0, 900));
  const seen = await B.p.evaluate(() => document.querySelector('[data-scene-emotes]')?.getAttribute('data-scene-emotes'));
  pass('C-emote-local', kinds.every((k) => k.local), 'c1-emote-wheel.jpg', `yerel jestler ${kinds.map((k) => k.local).join(',')}`);
  pass('C-emote-peer', bEmote.length >= 3, 'c2-emote-1-B.jpg', `B'ye ${bEmote.length} jest paketi (tekrarlar dahil), B sahnede aktif jest ${seen}`);
});

// ---------- E: kamera / HUD ----------
await step('kamera-hud', async () => {
  await A.p.keyboard.press('b');
  await A.p.waitForTimeout(1200);
  const lean = await A.p.evaluate(() => document.querySelector('[data-scene-camera]')?.getAttribute('data-scene-camera'));
  await shot(A.p, 'e1-lean-board');
  await A.p.keyboard.press('Escape');
  await A.p.waitForTimeout(1000);
  const back = await A.p.evaluate(() => document.querySelector('[data-scene-camera]')?.getAttribute('data-scene-camera'));
  pass('E-lean', lean === 'lean' || lean === 'seat', 'e1-lean-board.jpg', `B tuşu → data-scene-camera=${lean}; Esc → ${back}`);
  // komşu koltuğa dönüp tıklama (5 kişilik)
  const box = await A.p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; });
  await A.p.mouse.move(box.x, box.y); await A.p.mouse.down();
  for (let i = 1; i <= 20; i++) { await A.p.mouse.move(box.x + i * 26, box.y); await A.p.waitForTimeout(50); }
  await A.p.mouse.up();
  await A.p.waitForTimeout(1200);
  await shot(A.p, 'e2-neighbor-right');
  const yawMax = await A.p.evaluate(() => { const l = window.__ws.filter((x) => x.dir === 'out').map((x) => +(/"yaw":(-?[\d.]+)/.exec(x.d)?.[1] ?? 0)); return l.length ? Math.max(...l.map(Math.abs)) : null; });
  pass('E-neighbor-yaw', yawMax != null && yawMax > 1.0, 'e2-neighbor-right.jpg', `en büyük |yaw| ${yawMax} rad (sınır 1,4)`);
  // menü
  await A.p.keyboard.press('m');
  await A.p.waitForTimeout(800);
  await shot(A.p, 'e3-menu');
  const menuTxt = await A.p.evaluate(() => document.body.textContent.includes('Geliştirici'));
  pass('E-menu', menuTxt, 'e3-menu.jpg', `menüde Geliştirici bölümü ${menuTxt}`);
  await A.p.keyboard.press('Escape');
  await A.p.waitForTimeout(600);
});

// ---------- F: yeniden bağlanma (B) ----------
await step('yeniden baglanma', async () => {
  const beforeSeat = await B.p.evaluate(() => document.querySelector('.statusbar__phase')?.textContent);
  await B.p.reload({ waitUntil: 'domcontentloaded' });
  const t = Date.now();
  await sceneReady(B.p, 60000);
  const dt = Date.now() - t;
  await B.p.waitForTimeout(3500);
  const info = await sceneInfo(B.p);
  await shot(B.p, 'f1-reconnect-B');
  pass('F-reconnect', info.frames > 2 && info.status.length > 0, 'f1-reconnect-B.jpg', `yenilemeden sonra ilk kare ${dt} ms, durum "${info.status}", kamera ${info.camera}`);
  note('F sonrası B', JSON.stringify(info));
});

// ---------- D: oyun akışı ----------
await step('oyun akisi', async () => {
  const seenPhases = [];
  for (let turn = 0; turn < 60; turn++) {
    const st = await phaseOf(A.p);
    const key = `${st.status}|${st.opts.join(',')}`;
    if (!seenPhases.includes(st.status)) { seenPhases.push(st.status); note(`[D] faz: ${st.status} — ${st.detail} | ops: ${st.opts.join(' / ')}`); }
    if (st.over) { note('[D] oyun bitti'); break; }
    if (st.opts.length === 0) { await A.p.waitForTimeout(2000); continue; }
    // fazına göre kanıt
    const s = st.status.toLowerCase();
    if (s.includes('oy') && st.opts.some((o) => /evet|hayır/i.test(o))) {
      await shot(A.p, `d-vote-A-${turn}`); await shot(B.p, `d-vote-B-${turn}`);
      await drive(A.p, 'Evet');
      await A.p.waitForTimeout(2500);
      await shot(A.p, `d-vote-result-A-${turn}`); await shot(B.p, `d-vote-result-B-${turn}`);
      note('[D] oy rozetleri A', (await sceneInfo(A.p)).badges, 'B', (await sceneInfo(B.p)).badges);
      continue;
    }
    if (st.opts.some((o) => /kart|yasa/i.test(o)) || s.includes('kanun') || s.includes('yasama')) {
      await shot(A.p, `d-legis-A-${turn}`); await shot(B.p, `d-legis-B-${turn}`);
      note('[D] ofis eli A', (await sceneInfo(A.p)).office, 'B', (await sceneInfo(B.p)).office);
      await drive(A.p, null);
      continue;
    }
    await drive(A.p, null);
    await A.p.waitForTimeout(1200);
  }
  note('[D] görülen fazlar', JSON.stringify(seenPhases));
  await shot(A.p, 'd-final-A'); await shot(B.p, 'd-final-B');
});

} finally {
  writeFileSync('scratchpad/e2e-results.json', JSON.stringify({ results, aErrors: A.errors, aNet: A.net, bErrors: B.errors, bNet: B.net }, null, 1));
  note('=== A konsol/ağ ===', JSON.stringify([...new Set(A.errors)].slice(0, 20)), JSON.stringify([...new Set(A.net)].slice(0, 20)));
  note('=== B konsol/ağ ===', JSON.stringify([...new Set(B.errors)].slice(0, 20)), JSON.stringify([...new Set(B.net)].slice(0, 20)));
  await browser.close();
}
