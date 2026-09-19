/** E2E 2. koşu: telefon (B), kafa senkronu görsel kanıtı, infaz koreografisi, oyun sonu + yeniden oyna. */
import { launch, makeCtx, setupGame, shot, png, diffRatio, note, sceneInfo, sceneReady, log } from './e2e-lib.mjs';
import { writeFileSync } from 'node:fs';
const results = [];
const pass = (id, ok, ev, n = '') => { results.push({ id, ok, ev, n }); note(`${ok ? 'GEÇTİ' : 'KALDI'} ${id} | ${ev} | ${n}`); };
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B', { width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const step = async (n, fn) => { try { return await fn(); } catch (e) { note(`!! ${n}: ${String(e).slice(0, 400)}`); pass(n, false, '-', `betik hatası ${String(e).slice(0, 140)}`); } };
const S = (p) => p.evaluate(() => ({
  status: document.querySelector('.statusbar__phase')?.textContent || '', detail: document.querySelector('.statusbar__detail')?.textContent || '',
  opts: [...document.querySelectorAll('.actionbar__option .actionbar__label')].map((n) => n.textContent.trim()),
  over: !!document.querySelector('.game-over'), overText: document.querySelector('.game-over')?.textContent?.replace(/\s+/g, ' ').slice(0, 600) || '',
  ann: document.querySelector('[class*=announce]')?.textContent?.replace(/\s+/g, ' ') || '', shot: !!document.querySelector('.shot-layer'),
  shotCard: document.querySelector('.shot-layer__card')?.textContent?.replace(/\s+/g, ' ') || '',
  err: document.querySelector('.actionbar__notice--error')?.textContent?.trim() || '',
}));
const frames = (p) => p.evaluate(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0));
async function act(p, re) {
  const i = await p.evaluate((m) => { const o = [...document.querySelectorAll('.actionbar__option')]; const k = m ? o.findIndex((x) => new RegExp(m, 'i').test(x.textContent)) : 0; if (k < 0 || !o[k]) return -1; o[k].click(); return k; }, re || null);
  if (i < 0) return null;
  await p.waitForTimeout(250);
  const c = await p.evaluate(() => document.querySelector('.actionbar__consequence')?.textContent || '');
  await p.evaluate(() => document.querySelector('.actionbar__confirm-buttons button')?.click());
  return { i, c };
}
const drag = async (p, dx, dy, n = 14) => {
  const c = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(c.x, c.y); await p.mouse.down();
  for (let i = 1; i <= n; i++) { await p.mouse.move(c.x + i * dx, c.y + i * dy); await p.waitForTimeout(50); }
  await p.mouse.up(); await p.waitForTimeout(700);
};
try {
// --- G: telefon lobisi ---
await step('G-lobi', async () => {
  const { createRoom, joinRoom } = await import('./e2e-lib.mjs');
  const r = await createRoom(A.p, 'Mert');
  note('oda', r.code);
  await joinRoom(B.p, r.code, 'Bahar');
  await B.p.waitForSelector('.picker__card', { timeout: 20000 });
  await B.p.waitForTimeout(1500);
  await shot(B.p, 'g10-phone-lobby');
  const ov = await B.p.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, cards: document.querySelectorAll('.picker__card').length, skins: document.querySelectorAll('.picker__skin').length }));
  await B.p.evaluate(() => { const c = [...document.querySelectorAll('.picker__card')].find((x) => /Topuzlu/.test(x.textContent)) || document.querySelectorAll('.picker__card')[2]; c?.click(); });
  await B.p.waitForTimeout(1500);
  await shot(B.p, 'g11-phone-lobby-picked');
  pass('G-lobby', ov.scrollW <= ov.clientW && ov.cards === 8, 'g10-phone-lobby.jpg', `390×844 lobi: ${ov.cards} karakter, ${ov.skins} ten, yatay taşma ${ov.scrollW > ov.clientW} (${ov.scrollW}/${ov.clientW})`);
  // botlar + başlat
  const bots = await A.p.evaluate(async () => { const m = await import('/src/dev/botRunner.ts'); return (await m.startBots({ roomId: location.pathname.split('/').pop(), inviteCode: document.querySelector('.code-badge__value').textContent.trim(), target: 5, currentMembers: 2 })).count; });
  await A.p.waitForTimeout(7000);
  await B.p.click('button:has-text("Hazırım")'); await A.p.click('button:has-text("Hazırım")');
  await A.p.waitForTimeout(2500);
  await A.p.click('button:has-text("Oyunu başlat")');
  await sceneReady(A.p); await sceneReady(B.p);
  await A.p.waitForTimeout(4000);
  for (const c of [A, B]) { await c.p.evaluate(() => { const o = [...document.querySelectorAll('.actionbar__option')].find((x) => /Hazır/.test(x.textContent)); o?.click(); }); await c.p.waitForTimeout(400); await c.p.evaluate(() => document.querySelector('.actionbar__confirm-buttons button')?.click()); await c.p.waitForTimeout(900); }
  await A.p.waitForTimeout(3000);
  note('bot', bots, 'A', JSON.stringify(await S(A.p)), 'B', JSON.stringify(await S(B.p)));
});
// --- G: telefon oyun ekranı ---
await step('G-oyun', async () => {
  await B.p.waitForTimeout(1500);
  await shot(B.p, 'g12-phone-game');
  const hud = await B.p.evaluate(() => ({
    tools: [...document.querySelectorAll('.game__tools button')].map((b) => b.textContent.trim()),
    jest: !!document.querySelector('.actionbar__touch button'), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    canvas: (() => { const c = document.querySelector('canvas'); return c ? [c.clientWidth, c.clientHeight] : null; })(),
  }));
  note('telefon HUD', JSON.stringify(hud));
  if (hud.jest) { await B.p.evaluate(() => document.querySelector('.actionbar__touch button').click()); await B.p.waitForTimeout(700); await shot(B.p, 'g13-phone-emote-wheel');
    await B.p.evaluate(() => { const s = [...document.querySelectorAll('[class*=wheel] button, [class*=emote] button')][0]; s?.click(); }); await B.p.waitForTimeout(900); await shot(B.p, 'g14-phone-emote'); note('telefon jest', (await sceneInfo(B.p)).localEmote); }
  await B.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Tahta'))?.click());
  await B.p.waitForTimeout(1600); await shot(B.p, 'g15-phone-lean');
  await B.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Tahta'))?.click());
  await B.p.waitForTimeout(1200);
  pass('G-game', !hud.overflow && hud.tools.length > 0, 'g12-phone-game.jpg', `telefon oyun: araçlar ${JSON.stringify(hud.tools)}, jest düğmesi ${hud.jest}, tuval ${JSON.stringify(hud.canvas)}, taşma ${hud.overflow}`);
});
// --- B: kafa senkronu görsel ---
await step('B-gorsel', async () => {
  // B komşusunu (A) bulmak için sola/sağa döner
  for (const [dx, tag] of [[-30, 'left'], [30, 'right']]) {
    await drag(B.p, dx, 0, 16);
    await shot(B.p, `b10-B-turn-${tag}`);
    note(`B ${tag} dönük`, JSON.stringify((await sceneInfo(B.p)).camera));
  }
  // sola dön (A seat1, B seat2 → A solda olmalı)
  await drag(B.p, -34, 0, 16);
  const p0 = await png(B.p, 'bh0');
  const f0 = await frames(B.p);
  await B.p.waitForTimeout(2000);
  const fIdle = await frames(B.p) - f0;
  // A bakışını çevirir
  await drag(A.p, 26, 4, 16);
  await B.p.waitForTimeout(600);
  const p1 = await png(B.p, 'bh1'); await shot(B.p, 'b11-B-sees-A-yaw-right');
  await drag(A.p, -30, 10, 18);
  await B.p.waitForTimeout(600);
  const p2 = await png(B.p, 'bh2'); await shot(B.p, 'b12-B-sees-A-yaw-left'); await shot(A.p, 'b13-A-own-view');
  const fMove = await frames(B.p);
  note('B kare: boşta 2s', fIdle, '· A hareket sırasında', fMove - f0 - fIdle);
  note('B kare farkları', diffRatio(p0, p1), diffRatio(p1, p2));
  pass('B-visual', diffRatio(p0, p1) > 0.0005 || diffRatio(p1, p2) > 0.0005, 'b11-B-sees-A-yaw-right.jpg', `B A'ya dönükken kare farkı sağ ${diffRatio(p0, p1)} · sol ${diffRatio(p1, p2)}; B'de boşta 2 s'de ${fIdle} kare, A dönerken ${fMove - f0 - fIdle} kare`);
});
// --- D12: infaz koreografisi (merkezî kamera) ---
await step('D-infaz', async () => {
  // A bakışı sıfırla: koltuk kamerası yeniden seç
  await A.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Genel masa'))?.click());
  await A.p.waitForTimeout(800);
  await A.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Kendi koltuğum'))?.click());
  await A.p.waitForTimeout(1600);
  await A.p.keyboard.press('m'); await A.p.waitForTimeout(1000);
  await shot(A.p, 'x10-dev-menu');
  const ok = await A.p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /İnfaza atla/.test(x.textContent)); if (!b) return false; b.click(); return true; });
  await A.p.waitForTimeout(2500);
  const msg = await A.p.evaluate(() => [...document.querySelectorAll('[class*=menu] p, [class*=dev] p')].map((n) => n.textContent.trim()).filter(Boolean).slice(-3).join(' | '));
  await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(1800);
  const sa = await S(A.p);
  note('infaz senaryosu', ok, msg, JSON.stringify(sa));
  await shot(A.p, 'x11-gun-ready-A');
  const ia = await sceneInfo(A.p);
  note('silah hazır', JSON.stringify(ia));
  // hedef: bir bot (B canlı kalsın ki oyun sürsün) → ilk seçenek
  const target = sa.opts[0];
  const shots = [];
  const r = await act(A.p, target);
  // 0-4 s arası yakın kareler
  for (const ms of [250, 500, 300, 300, 400, 500, 800, 1000]) {
    await A.p.waitForTimeout(ms);
    shots.push({ t: shots.reduce((s, x) => s + x.ms, 0) + ms, ms });
    await shot(A.p, `x12-exec-A-${shots.length}`);
    await shot(B.p, `x12-exec-B-${shots.length}`);
  }
  const after = await sceneInfo(A.p);
  note('infaz sonrası', JSON.stringify(await S(A.p)), JSON.stringify(after));
  pass('D-execution', !!r, 'x12-exec-A-3.jpg', `hedef "${target}" (${r?.c}); seçenek rakamları 1–${sa.opts.length}; cue ${ia.cues}→${after.cues}, ses ${ia.sounds}→${after.sounds}`);
  await shot(A.p, 'x13-exec-done-A'); await shot(B.p, 'x13-exec-done-B');
});
// --- oyun sonu: Hitler vurulana kadar / faşist zafer ---
await step('D-son', async () => {
  for (let round = 0; round < 4; round++) {
    const s = await S(A.p);
    if (s.over) break;
    await A.p.keyboard.press('m'); await A.p.waitForTimeout(900);
    const ok = await A.p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /İnfaza atla/.test(x.textContent)); if (!b) return false; b.click(); return true; });
    await A.p.waitForTimeout(2200);
    await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(1500);
    const sa = await S(A.p);
    note(`[son ${round}] faz ${sa.status} · ${sa.detail} · ops ${JSON.stringify(sa.opts)} (senaryo ${ok})`);
    if (!sa.opts.length) { await A.p.waitForTimeout(2500); continue; }
    const r = await act(A.p, null);
    note(`[son ${round}] infaz → ${r?.c}`);
    await A.p.waitForTimeout(4500);
    const s2 = await S(A.p);
    note(`[son ${round}] sonuç: ${s2.status} · bitti=${s2.over} · ${s2.overText.slice(0, 200)}`);
    if (s2.over) break;
    // ara turları sürdür
    for (let t = 0; t < 6; t++) { let acted = false; for (const c of [A, B]) { const cs = await S(c.p); if (!cs.opts.length) continue; const rr = await act(c.p, /Evet|Hayır/.test(cs.opts.join()) ? 'Evet' : null); if (rr) acted = true; await c.p.waitForTimeout(800); } if (!acted) await A.p.waitForTimeout(1800); }
  }
  const end = await S(A.p);
  await shot(A.p, 'x20-gameover-A'); await shot(B.p, 'x20-gameover-B');
  note('oyun sonu', JSON.stringify(end));
  pass('D-gameover', end.over, 'x20-gameover-A.jpg', end.over ? end.overText.slice(0, 300) : `oyun bitmedi; faz ${end.status}`);
  if (end.over) {
    const again = await A.p.evaluate(() => { const b = [...document.querySelectorAll('.game-over button')].find((x) => /yeniden oyna/i.test(x.textContent)); if (!b) return false; b.click(); return true; });
    await A.p.waitForTimeout(7000);
    const s2 = await S(A.p); const s3 = await S(B.p);
    await shot(A.p, 'x21-replay-A'); await shot(B.p, 'x21-replay-B');
    pass('D-replay', again && !s2.over, 'x21-replay-A.jpg', `"yeniden oyna" → A "${s2.status}/${s2.detail}", B "${s3.status}"`);
  }
});
} finally {
  writeFileSync('scratchpad/e2e-full2-results.json', JSON.stringify({ results, log, aErr: [...new Set(A.errors)], aNet: [...new Set(A.net)], bErr: [...new Set(B.errors)], bNet: [...new Set(B.net)] }, null, 1));
  note('=== A konsol', JSON.stringify([...new Set(A.errors)].slice(0, 30)));
  note('=== A ağ', JSON.stringify([...new Set(A.net)].slice(0, 30)));
  note('=== B konsol', JSON.stringify([...new Set(B.errors)].slice(0, 30)));
  note('=== B ağ', JSON.stringify([...new Set(B.net)].slice(0, 30)));
  await browser.close();
}
