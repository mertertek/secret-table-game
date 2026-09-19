/** 3. koşu: 7 kişilik oda (A+B+5 bot) — inceleme / özel seçim / veto / kaos ve tahta kanıtı. */
import { launch, makeCtx, createRoom, joinRoom, shot, note, sceneInfo, sceneReady, log } from './e2e-lib.mjs';
import { writeFileSync } from 'node:fs';
const results = [];
const pass = (id, ok, ev, n = '') => { results.push({ id, ok, ev, n }); note(`${ok ? 'GEÇTİ' : 'KALDI'} ${id} | ${ev} | ${n}`); };
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
const S = (p) => p.evaluate(() => ({
  status: document.querySelector('.statusbar__phase')?.textContent || '', detail: document.querySelector('.statusbar__detail')?.textContent || '',
  opts: [...document.querySelectorAll('.actionbar__option .actionbar__label')].map((n) => n.textContent.trim()),
  over: !!document.querySelector('.game-over'), overText: document.querySelector('.game-over')?.textContent?.replace(/\s+/g, ' ').slice(0, 400) || '',
  ann: document.querySelector('[class*=announce]')?.textContent?.replace(/\s+/g, ' ') || '',
  err: document.querySelector('.actionbar__notice--error')?.textContent?.trim() || '',
  role: document.querySelector('.game__role-layer')?.textContent?.replace(/\s+/g, ' ').slice(0, 200) || '',
}));
async function act(p, re) {
  const i = await p.evaluate((m) => { const o = [...document.querySelectorAll('.actionbar__option')]; const k = m ? o.findIndex((x) => new RegExp(m, 'i').test(x.textContent)) : 0; if (k < 0 || !o[k]) return -1; o[k].click(); return k; }, re || null);
  if (i < 0) return null;
  await p.waitForTimeout(280);
  const c = await p.evaluate(() => document.querySelector('.actionbar__consequence')?.textContent || '');
  await p.evaluate(() => document.querySelector('.actionbar__confirm-buttons button')?.click());
  await p.waitForTimeout(950);
  return { i, c };
}
try {
const r = await createRoom(A.p, 'Mert');
note('oda', r.code);
await joinRoom(B.p, r.code, 'Bahar');
await B.p.waitForSelector('.picker__card', { timeout: 20000 });
const bots = await A.p.evaluate(async () => { const m = await import('/src/dev/botRunner.ts'); return (await m.startBots({ roomId: location.pathname.split('/').pop(), inviteCode: document.querySelector('.code-badge__value').textContent.trim(), target: 7, currentMembers: 2 })).count; });
await A.p.waitForTimeout(9000);
const cnt = await A.p.evaluate(() => document.querySelector('.lobby__count')?.textContent);
note('bot', bots, 'sayaç', cnt);
await shot(A.p, 'z1-lobby-7p');
await B.p.click('button:has-text("Hazırım")'); await A.p.click('button:has-text("Hazırım")');
await A.p.waitForTimeout(2500);
await A.p.click('button:has-text("Oyunu başlat")');
await sceneReady(A.p); await sceneReady(B.p);
await A.p.waitForTimeout(4500);
pass('7p-start', bots === 5, 'z1-lobby-7p.jpg', `7 kişilik oda: ${bots} bot, sayaç "${cnt}" (7-8 düzeni: inceleme + özel seçim yuvaları)`);
for (const c of [A, B]) { await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Kendi koltuğum'))?.click()); await c.p.waitForTimeout(1000); }
// rol panelleri
for (const c of [A, B]) {
  await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((x) => x.textContent.includes('Özel alan'))?.click());
  await c.p.waitForTimeout(1200);
  note(`${c.label} rol`, (await S(c.p)).role);
  if (c === A) await shot(A.p, 'z2-role-A'); else await shot(B.p, 'z2-role-B');
  await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((x) => x.textContent.includes('Özel alan'))?.click());
  await c.p.waitForTimeout(700);
  await act(c.p, 'Hazır');
}
await A.p.waitForTimeout(3500);
// --- sürücü: faşist kanun tercihli, Evet oyu ---
const seen = new Map(); const powers = []; let failedElections = 0; let lastCounter = '';
for (let turn = 0; turn < 140; turn++) {
  const sa = await S(A.p);
  if (sa.over) { note('[3] BİTTİ', sa.overText); break; }
  const key = sa.status;
  if (!seen.has(key) || /yetki|veto|kaos/i.test(sa.status)) {
    if (!seen.has(key)) seen.set(key, sa.opts.join(' / '));
    const tag = `z3-${seen.size}-${sa.status.replace(/[^a-zA-Z]+/g, '').slice(0, 12)}-t${turn}`;
    note(`[3] FAZ ${sa.status} — ${sa.detail} | ops ${JSON.stringify(sa.opts)} | duyuru ${sa.ann}`);
    await shot(A.p, `${tag}-A`); await shot(B.p, `${tag}-B`);
    if (/yetki/i.test(sa.status)) powers.push({ turn, status: sa.status, detail: sa.detail, ops: sa.opts, ann: sa.ann, tag });
  }
  if (/kaos|Kaos/.test(sa.ann) || /kaos/i.test(sa.detail)) { note('[3] KAOS', sa.ann, sa.detail); await shot(A.p, `z4-kaos-t${turn}-A`); }
  let acted = false;
  for (const c of [A, B]) {
    const s = await S(c.p);
    if (!s.opts.length) continue;
    const j = s.opts.join();
    const re = /Faşist kanun/.test(j) ? 'Faşist kanun' : /Evet|Hayır/.test(j) ? 'Evet' : null;
    const rr = await act(c.p, re);
    if (rr) { acted = true; note(`[3] ${c.label} → "${s.opts[rr.i]}"`); }
    const af = await S(c.p);
    if (af.err) note(`[3] ${c.label} HATA ${af.err}`);
  }
  if (!acted) await A.p.waitForTimeout(2000);
}
// tahta kanıtı (eğilme)
await A.p.keyboard.press('b'); await A.p.waitForTimeout(1800);
await shot(A.p, 'z5-board-lean-A');
await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(1000);
await A.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Genel masa'))?.click());
await A.p.waitForTimeout(2000); await shot(A.p, 'z6-overview-board-A');
const end = await S(A.p);
note('[3] fazlar', JSON.stringify([...seen.keys()]));
note('[3] yetkiler', JSON.stringify(powers, null, 1));
note('[3] son', JSON.stringify(end));
pass('7p-powers', powers.length > 0, powers[0] ? `${powers[0].tag}-A.jpg` : '-', `görülen yetkiler: ${powers.map((x) => `${x.detail}`).join(' | ') || 'yok'}`);
pass('7p-flow', seen.size >= 4, 'z5-board-lean-A.jpg', `fazlar: ${[...seen.keys()].join(' → ')}${end.over ? ` · SON: ${end.overText.slice(0, 200)}` : ' · oyun sürüyor'}`);
} finally {
  writeFileSync('scratchpad/e2e-full3-results.json', JSON.stringify({ results, log, aErr: [...new Set(A.errors)], aNet: [...new Set(A.net)], bErr: [...new Set(B.errors)], bNet: [...new Set(B.net)] }, null, 1));
  note('=== A konsol', JSON.stringify([...new Set(A.errors)].slice(0, 20)));
  note('=== A ağ', JSON.stringify([...new Set(A.net)].slice(0, 20)));
  note('=== B konsol', JSON.stringify([...new Set(B.errors)].slice(0, 20)));
  note('=== B ağ', JSON.stringify([...new Set(B.net)].slice(0, 20)));
  await browser.close();
}
