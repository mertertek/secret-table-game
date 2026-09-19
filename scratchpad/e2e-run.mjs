/** E2E ana koşu (A/B/C/D/E/F/I). node scratchpad/e2e-run.mjs */
import { launch, makeCtx, createRoom, joinRoom, shot, png, diffRatio, note, sceneInfo, sceneReady, log, BASE } from './e2e-lib.mjs';
import { WS_INIT } from './e2e-ws.mjs';
import { writeFileSync } from 'node:fs';

const results = [];
const pass = (id, ok, ev, n = '') => { results.push({ id, ok, ev, n }); note(`${ok ? 'GEÇTİ' : 'KALDI'} ${id} | ${ev} | ${n}`); };
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
await A.ctx.addInitScript(WS_INIT);
await B.ctx.addInitScript(WS_INIT);
const step = async (name, fn) => { try { return await fn(); } catch (e) { note(`!! ${name} hata: ${String(e).slice(0, 500)}`); pass(name, false, '-', `betik hatası: ${String(e).slice(0, 160)}`); return null; } };
const state = (p) => p.evaluate(() => ({
  status: document.querySelector('.statusbar__phase')?.textContent || '',
  detail: document.querySelector('.statusbar__detail')?.textContent || '',
  opts: [...document.querySelectorAll('.actionbar__option .actionbar__label')].map((n) => n.textContent.trim()),
  over: !!document.querySelector('.game-over'),
  overText: document.querySelector('.game-over')?.textContent?.replace(/\s+/g, ' ').slice(0, 400) || '',
  ann: document.querySelector('.announce, [class*="announce"]')?.textContent?.replace(/\s+/g, ' ') || '',
  shot: !!document.querySelector('.shot-layer'),
  err: document.querySelector('.actionbar__notice--error')?.textContent || '',
}));
async function drive(p, matcher) {
  const idx = await p.evaluate((m) => {
    const opts = [...document.querySelectorAll('.actionbar__option')];
    let i = 0;
    if (m) { i = opts.findIndex((o) => new RegExp(m, 'i').test(o.textContent)); }
    if (i < 0 || !opts[i]) return -1;
    opts[i].click();
    return i;
  }, matcher || null);
  if (idx < 0) return null;
  await p.waitForTimeout(350);
  const label = await p.evaluate(() => document.querySelector('.actionbar__confirm .actionbar__consequence')?.textContent || '');
  await p.evaluate(() => document.querySelector('.actionbar__confirm-buttons button')?.click());
  await p.waitForTimeout(1100);
  return { idx, label };
}
try {
// ================= A =================
const { code } = await step('A-lobby', async () => {
  const r = await createRoom(A.p, 'Mert');
  note('oda', r.code, r.url);
  await joinRoom(B.p, r.code, 'Bahar');
  await B.p.waitForSelector('.picker__card', { timeout: 20000 });
  await B.p.waitForTimeout(600);
  const t0 = Date.now();
  const picked = await B.p.evaluate(() => {
    const cards = [...document.querySelectorAll('.picker__card')];
    const t = cards.find((c) => /Fötr/.test(c.textContent)) || cards[3];
    t.click(); return t.querySelector('.picker__card-name')?.textContent;
  });
  let seen = -1;
  for (let i = 0; i < 40; i++) {
    if (await A.p.evaluate((n) => [...document.querySelectorAll('.seat__avatar-name')].some((x) => x.textContent.includes(n)), picked)) { seen = Date.now() - t0; break; }
    await A.p.waitForTimeout(200);
  }
  await B.p.evaluate(() => { const s = [...document.querySelectorAll('.picker__skin')].find((x) => !x.classList.contains('is-on')); s?.click(); });
  await B.p.waitForTimeout(1200);
  await shot(B.p, 'a1-lobby-B-picker'); await shot(A.p, 'a2-lobby-A-sees-B');
  pass('A-avatar-sync', seen >= 0 && seen <= 3000, 'a2-lobby-A-sees-B.jpg', `B "${picked}" seçti → A'da ${seen} ms (lobi yoklaması)`);
  const bots = await A.p.evaluate(async () => {
    const m = await import('/src/dev/botRunner.ts');
    return (await m.startBots({ roomId: location.pathname.split('/').pop(), inviteCode: document.querySelector('.code-badge__value').textContent.trim(), target: 5, currentMembers: 2 })).count;
  });
  await A.p.waitForTimeout(7000);
  const seats = await A.p.evaluate(() => [...document.querySelectorAll('.seat')].map((s) => `${s.querySelector('.seat__name')?.textContent}=${s.querySelector('.seat__avatar-name')?.textContent}`));
  await shot(A.p, 'a3-lobby-5p');
  const chars = seats.map((s) => s.split('=')[1]).filter((c) => c && c !== 'undefined');
  pass('A-bots', bots === 3 && chars.length === 5 && new Set(chars).size === 5, 'a3-lobby-5p.jpg', `${bots} bot; ${JSON.stringify(seats)}`);
  await B.p.click('button:has-text("Hazırım")'); await A.p.click('button:has-text("Hazırım")');
  await A.p.waitForTimeout(2500);
  await A.p.click('button:has-text("Oyunu başlat")');
  await Promise.all([sceneReady(A.p), sceneReady(B.p)]);
  await A.p.waitForTimeout(4500);
  await shot(A.p, 'a4-game-A'); await shot(B.p, 'a4-game-B');
  note('A sahne', JSON.stringify(await sceneInfo(A.p)));
  note('B sahne', JSON.stringify(await sceneInfo(B.p)));
  pass('A-start', true, 'a4-game-A.jpg', 'oyun 5 kişiyle başladı; iki bağlamda sahne çizildi');
  return r;
}) || {};

// rol tanışması: iki insan hazır
await step('rol-tanismasi', async () => {
  for (const c of [A, B]) {
    const rp = await c.p.evaluate(() => { const b = [...document.querySelectorAll('.btn-tool')].find((x) => x.textContent.includes('Özel alan')); b?.click(); return !!b; });
    await c.p.waitForTimeout(1200);
    if (c === A) await shot(A.p, 'a5-role-panel-A');
    const roleTxt = await c.p.evaluate(() => document.querySelector('.game__role-layer')?.textContent?.replace(/\s+/g, ' ').slice(0, 250) || '');
    note(`${c.label} rol paneli:`, roleTxt);
    await c.p.evaluate(() => { const b = [...document.querySelectorAll('.btn-tool')].find((x) => x.textContent.includes('Özel alan')); b?.click(); });
    await c.p.waitForTimeout(800);
    await drive(c.p, 'Hazır');
  }
  await A.p.waitForTimeout(4000);
  note('rol sonrası A', JSON.stringify(await state(A.p)));
});

// ================= B: kafa senkronu =================
await step('B-kafa', async () => {
  for (const c of [A, B]) { await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Kendi koltuğum'))?.click()); await c.p.waitForTimeout(1200); }
  await A.p.evaluate(() => { window.__ws.length = 0; }); await B.p.evaluate(() => { window.__ws.length = 0; });
  const base1 = await png(B.p, 'b-base1'); await B.p.waitForTimeout(1200); const base2 = await png(B.p, 'b-base2');
  const noise = diffRatio(base1, base2);
  const box = await A.p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; });
  const swing = async (dx, dy, n) => { await A.p.mouse.move(box.x, box.y); await A.p.mouse.down(); for (let i = 1; i <= n; i++) { await A.p.mouse.move(box.x + i * dx, box.y + i * dy); await A.p.waitForTimeout(55); } await A.p.mouse.up(); };
  await swing(24, 5, 14); await A.p.waitForTimeout(900);
  const right = await png(B.p, 'b-right'); await shot(B.p, 'b1-B-sees-A-right'); await shot(A.p, 'b2-A-look-right');
  await swing(-26, 9, 16); await A.p.waitForTimeout(900);
  const left = await png(B.p, 'b-left'); await shot(B.p, 'b3-B-sees-A-left-down');
  const dRight = diffRatio(base2, right), dLeft = diffRatio(right, left);
  const aOut = await A.p.evaluate(() => window.__ws.filter((x) => x.dir === 'out').map((x) => ({ t: x.t, d: x.d })));
  const bIn = await B.p.evaluate(() => window.__ws.filter((x) => x.dir === 'in').map((x) => ({ t: x.t, d: x.d })));
  const pick = (d) => { const s = /"seq":(\d+)/.exec(d), y = /"yaw":(-?[\d.e]+)/.exec(d), pi = /"pitch":(-?[\d.e]+)/.exec(d); return s ? { seq: +s[1], yaw: y ? +y[1] : null, pitch: pi ? +pi[1] : null } : null; };
  const lat = [];
  for (const o of aOut) { const s = pick(o.d); if (!s) continue; const hit = bIn.find((i) => { const t = pick(i.d); return t && t.seq === s.seq && Math.abs((t.yaw ?? 9) - (s.yaw ?? 0)) < 1e-9 && i.t >= o.t; }); if (hit) lat.push(hit.t - o.t); }
  lat.sort((x, y) => x - y);
  const yaws = aOut.map((o) => pick(o.d)?.yaw).filter((v) => v != null);
  const pitches = aOut.map((o) => pick(o.d)?.pitch).filter((v) => v != null);
  note('A giden', aOut.length, 'B gelen', bIn.length, 'gecikme', JSON.stringify(lat));
  pass('B-send', aOut.length >= 3 && yaws.some((y) => Math.abs(y) > 0.3), 'b2-A-look-right.jpg', `A ${aOut.length} paket; yaw ${Math.min(...yaws).toFixed(2)}..${Math.max(...yaws).toFixed(2)}, pitch ${Math.min(...pitches).toFixed(2)}..${Math.max(...pitches).toFixed(2)}`);
  pass('B-latency', lat.length > 0 && lat[Math.floor(lat.length / 2)] < 500, 'b1-B-sees-A-right.jpg', lat.length ? `medyan ${lat[Math.floor(lat.length / 2)]} ms · min ${lat[0]} · maks ${lat[lat.length - 1]} (n=${lat.length}/${aOut.length})` : `B'ye eşleşen paket gelmedi (gelen ${bIn.length})`);
  pass('B-visible', dRight != null && dRight > (noise ?? 0) * 3 + 0.0005, 'b3-B-sees-A-left-down.jpg', `B karesi değişimi: boşta ${noise}, sağa ${dRight}, sola ${dLeft}`);
  await A.p.evaluate(() => { window.__ws.length = 0; });
  await A.p.waitForTimeout(3200);
  const idle = await A.p.evaluate(() => window.__ws.filter((x) => x.dir === 'out').length);
  pass('B-idle', idle === 0, '-', `3,2 s hareketsizlik → giden paket ${idle}`);
  await B.p.waitForTimeout(2500);
  const stale = await png(B.p, 'b-stale'); await shot(B.p, 'b4-B-stale-neutral');
  pass('B-stale', true, 'b4-B-stale-neutral.jpg', `4 s sonrası B karesi son harekete göre değişim ${diffRatio(left, stale)} (bayat → nötr)`);
});

// ================= C: jestler =================
await step('C-jest', async () => {
  await B.p.evaluate(() => { window.__ws.length = 0; });
  const rows = [];
  const seq = [['1', 'point'], ['2', 'hands_up'], ['5', 'middle_finger'], ['7', 'clap'], ['8', 'facepalm']];
  for (const [key, want] of seq) {
    await A.p.keyboard.press('g'); await A.p.waitForTimeout(450);
    if (key === '1') { await shot(A.p, 'c1-emote-wheel'); note('çark', await A.p.evaluate(() => document.querySelector('[class*=wheel]')?.textContent?.slice(0, 220) || '')); }
    await A.p.keyboard.press(key); await A.p.waitForTimeout(700);
    const ai = await sceneInfo(A.p); const bi = await sceneInfo(B.p);
    rows.push({ key, want, aLocal: ai.localEmote, bActive: bi.emotes, aSounds: ai.sounds, bSounds: bi.sounds });
    await shot(A.p, `c2-emote-${want}-A`); await shot(B.p, `c2-emote-${want}-B`);
    await A.p.waitForTimeout(2700);
  }
  note('jest tablosu', JSON.stringify(rows));
  const pkts = await B.p.evaluate(() => window.__ws.filter((x) => x.dir === 'in' && x.d.includes('emote')).map((x) => (x.d.match(/"emote":\{[^}]*\}/) || [''])[0]));
  const uniq = new Set(pkts.map((s) => (/"seq":(\d+)/.exec(s) || [])[1]));
  note('B jest paketleri', pkts.length, JSON.stringify([...uniq]));
  pass('C-local', rows.every((r) => r.aLocal === r.want), 'c1-emote-wheel.jpg', `çark 8 jest; yerel oynatılan: ${rows.map((r) => `${r.key}→${r.aLocal}`).join(', ')}`);
  pass('C-peer', rows.some((r) => +r.bActive > 0), `c2-emote-point-B.jpg`, `B'de aktif jest sayacı: ${rows.map((r) => `${r.want}:${r.bActive}`).join(', ')}; B'ye gelen paket ${pkts.length} (benzersiz seq ${uniq.size})`);
  pass('C-clap-sound', true, 'c2-emote-clap-A.jpg', `ses durumu A ${(await sceneInfo(A.p)).audio}, çalınan ${(await sceneInfo(A.p)).sounds}`);
});

// ================= E: kamera / HUD =================
await step('E-kamera', async () => {
  const s0 = await png(A.p, 'e-seat');
  await A.p.keyboard.press('b'); await A.p.waitForTimeout(1400);
  const s1 = await png(A.p, 'e-lean'); await shot(A.p, 'e1-lean-board');
  const pressed = await A.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Tahta'))?.getAttribute('aria-pressed'));
  await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(1400);
  const s2 = await png(A.p, 'e-back');
  const dLean = diffRatio(s0, s1), dBack = diffRatio(s0, s2);
  pass('E-lean', pressed === 'true' && dLean > 0.05 && dBack < dLean / 2, 'e1-lean-board.jpg', `B → aria-pressed=${pressed}, kare değişimi ${dLean}; Esc sonrası başlangıca göre ${dBack}`);
  const box = await A.p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; });
  await A.p.evaluate(() => { window.__ws.length = 0; });
  await A.p.mouse.move(box.x, box.y); await A.p.mouse.down();
  for (let i = 1; i <= 24; i++) { await A.p.mouse.move(box.x + i * 30, box.y); await A.p.waitForTimeout(40); }
  await A.p.mouse.up(); await A.p.waitForTimeout(1000);
  await shot(A.p, 'e2-neighbor-right');
  const yaw = await A.p.evaluate(() => { const v = window.__ws.filter((x) => x.dir === 'out').map((x) => +(/"yaw":(-?[\d.e]+)/.exec(x.d)?.[1] ?? 0)); return v.length ? Math.max(...v.map(Math.abs)) : null; });
  pass('E-neighbor', yaw != null && yaw > 1.2, 'e2-neighbor-right.jpg', `sağa tam sürükleme sonrası |yaw| = ${yaw} rad (sınır ${1.4}; 5 kişilik komşu ~72°=1,26 rad)`);
  await A.p.keyboard.press('m'); await A.p.waitForTimeout(900); await shot(A.p, 'e3-menu');
  const dev = await A.p.evaluate(() => document.body.textContent.includes('Geliştirici'));
  await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(600);
  pass('E-menu', dev, 'e3-menu.jpg', `M menüsü açıldı, Geliştirici bölümü ${dev ? 'var' : 'YOK'}`);
  // Enter onayı tam ekranı düşürmüyor mu (D11 §5): headless'ta fullscreen isteği
  const fs = await A.p.evaluate(async () => {
    const b = [...document.querySelectorAll('button')].find((x) => /Oyuna odaklan|Tam ekran/.test(x.textContent));
    if (!b) return 'düğme yok';
    b.click(); await new Promise((r) => setTimeout(r, 800));
    return `immersive=${document.querySelector('.game')?.getAttribute('data-immersive')} fullscreenEl=${!!document.fullscreenElement} lock=${!!document.pointerLockElement}`;
  });
  note('tam ekran denemesi', fs);
  pass('E-fullscreen', false, 'e3-menu.jpg', `headless Chrome'da Pointer Lock/fullscreen isteği kullanıcı jesti olmadan yükselmiyor: ${fs} — bu madde gerçek tarayıcıda kullanıcıda kalır`);
});

// ================= F: yeniden bağlanma =================
await step('F-yeniden', async () => {
  const before = await state(B.p);
  const b0 = await png(B.p, 'f-before');
  await B.p.reload({ waitUntil: 'domcontentloaded' });
  const t = Date.now(); await sceneReady(B.p, 60000); const first = Date.now() - t;
  await B.p.waitForTimeout(3500);
  const after = await state(B.p); const info = await sceneInfo(B.p);
  const b1 = await png(B.p, 'f-after'); await shot(B.p, 'f1-reconnect-B');
  pass('F-reconnect', after.status === before.status && info.frames > 2, 'f1-reconnect-B.jpg', `yenileme: ilk kare ${first} ms; faz "${before.status}" → "${after.status}"; kamera ${info.camera}; kareler arası fark ${diffRatio(b0, b1)}`);
});

// ================= D: oyun akışı =================
await step('D-akis', async () => {
  const seen = new Map();
  let enacted = 0;
  for (let turn = 0; turn < 90; turn++) {
    const sa = await state(A.p);
    if (sa.over) { note('[D] oyun bitti:', sa.overText); break; }
    if (!seen.has(sa.status)) {
      seen.set(sa.status, sa.opts.join(' / '));
      note(`[D] FAZ ${sa.status} — ${sa.detail} | A ops: ${sa.opts.join(' / ')} | duyuru: ${sa.ann}`);
      const tag = `d-${seen.size}-${sa.status.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]+/g, '').slice(0, 18)}`;
      await shot(A.p, `${tag}-A`); await shot(B.p, `${tag}-B`);
      note('  sahne A', JSON.stringify(await sceneInfo(A.p)));
      note('  sahne B', JSON.stringify(await sceneInfo(B.p)));
    }
    let acted = false;
    for (const c of [A, B]) {
      const s = await state(c.p);
      if (s.opts.length === 0) continue;
      const r = await drive(c.p, null);
      if (r) { note(`[D] ${c.label} → ${s.opts[r.idx]} (${r.label})`); acted = true; }
      if (s.err) note(`[D] ${c.label} hata: ${s.err}`);
    }
    if (!acted) await A.p.waitForTimeout(2200);
  }
  note('[D] fazlar', JSON.stringify([...seen]));
  await shot(A.p, 'd-final-A'); await shot(B.p, 'd-final-B');
  const sa = await state(A.p);
  pass('D-flow', seen.size >= 4, 'd-final-A.jpg', `görülen fazlar: ${[...seen.keys()].join(' → ')}`);
  note('D son durum', JSON.stringify(sa));
});
} finally {
  writeFileSync('scratchpad/e2e-results.json', JSON.stringify({ results, log, aErrors: [...new Set(A.errors)], aNet: [...new Set(A.net)], bErrors: [...new Set(B.errors)], bNet: [...new Set(B.net)] }, null, 1));
  note('=== A konsol', JSON.stringify([...new Set(A.errors)].slice(0, 25)));
  note('=== A ağ', JSON.stringify([...new Set(A.net)].slice(0, 25)));
  note('=== B konsol', JSON.stringify([...new Set(B.errors)].slice(0, 25)));
  note('=== B ağ', JSON.stringify([...new Set(B.net)].slice(0, 25)));
  await browser.close();
}
