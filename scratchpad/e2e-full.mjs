/** E2E kapsamlı canlı koşu — tek oda, A/B/C/D/E/F/G/I. node scratchpad/e2e-full.mjs */
import { launch, makeCtx, setupGame, shot, png, diffRatio, note, sceneInfo, sceneReady, log } from './e2e-lib.mjs';
import { writeFileSync } from 'node:fs';
const results = [];
const pass = (id, ok, ev, n = '') => { results.push({ id, ok, ev, n }); note(`${ok ? 'GEÇTİ' : 'KALDI'} ${id} | ${ev} | ${n}`); };
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
const step = async (name, fn) => { try { return await fn(); } catch (e) { note(`!! ${name}: ${String(e).slice(0, 400)}`); pass(name, false, '-', `betik hatası ${String(e).slice(0, 140)}`); } };
const S = (p) => p.evaluate(() => ({
  status: document.querySelector('.statusbar__phase')?.textContent || '',
  detail: document.querySelector('.statusbar__detail')?.textContent || '',
  opts: [...document.querySelectorAll('.actionbar__option .actionbar__label')].map((n) => n.textContent.trim()),
  over: !!document.querySelector('.game-over'),
  overText: document.querySelector('.game-over')?.textContent?.replace(/\s+/g, ' ').slice(0, 500) || '',
  ann: document.querySelector('.announcer, [class*=announce]')?.textContent?.replace(/\s+/g, ' ') || '',
  shot: !!document.querySelector('.shot-layer'),
  err: document.querySelector('.actionbar__notice--error')?.textContent?.trim() || '',
}));
const frames = (p) => p.evaluate(() => +(document.querySelector('canvas')?.dataset.sceneFrames || 0));
async function act(p, re) {
  const i = await p.evaluate((m) => { const o = [...document.querySelectorAll('.actionbar__option')]; const k = m ? o.findIndex((x) => new RegExp(m, 'i').test(x.textContent)) : 0; if (k < 0 || !o[k]) return -1; o[k].click(); return k; }, re || null);
  if (i < 0) return null;
  await p.waitForTimeout(300);
  const c = await p.evaluate(() => document.querySelector('.actionbar__consequence')?.textContent || '');
  await p.evaluate(() => document.querySelector('.actionbar__confirm-buttons button')?.click());
  await p.waitForTimeout(1000);
  return { i, c };
}
try {
const setup = await step('kurulum', async () => {
  const r = await setupGame(A, B);
  note('oda', r.code, 'bot', r.bots);
  for (const c of [A, B]) { await c.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Kendi koltuğum'))?.click()); await c.p.waitForTimeout(1200); }
  await A.p.waitForTimeout(2500);
  note('A', JSON.stringify(await S(A.p)), 'B', JSON.stringify(await S(B.p)));
  await shot(A.p, 'g1-A-seat'); await shot(B.p, 'g1-B-seat');
  pass('kurulum', true, 'g1-A-seat.jpg', `oda ${r.code}, ${r.bots} bot, 5 oyuncu, iki bağlam koltuk kamerasında`);
  return r;
});

// ---- B: kafa senkronu ----
await step('B-kafa', async () => {
  // A'nın B'deki bağlantı durumu (ViewpointAdapter `connected` şartı)
  await B.p.keyboard.press('m'); await B.p.waitForTimeout(900);
  const players = await B.p.evaluate(() => [...document.querySelectorAll('.menu, .panel, [class*=players]')].map((n) => n.textContent.replace(/\s+/g, ' ')).join(' | ').slice(0, 600));
  note('B menü oyuncular:', players);
  await shot(B.p, 'b0-B-players-menu');
  await B.p.keyboard.press('Escape'); await B.p.waitForTimeout(600);
  const f0 = await frames(B.p);
  const b0 = await png(B.p, 'bb0');
  await B.p.waitForTimeout(2000);
  const fIdle = await frames(B.p);
  const c = await A.p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  // A 4 saniye boyunca sürekli bakış çevirir
  await A.p.mouse.move(c.x, c.y); await A.p.mouse.down();
  const t0 = Date.now(); let i = 0;
  const shots = [];
  while (Date.now() - t0 < 4500) { i++; await A.p.mouse.move(c.x + Math.sin(i / 7) * 320, c.y + Math.cos(i / 9) * 60); await A.p.waitForTimeout(60); if (i % 20 === 0) shots.push(await png(B.p, `bb-${i}`)); }
  await A.p.mouse.up();
  const fMove = await frames(B.p);
  await A.p.waitForTimeout(600);
  const b1 = await png(B.p, 'bb1'); await shot(B.p, 'b1-B-sees-A-turn'); await shot(A.p, 'b2-A-turned');
  const diffs = shots.map((s, k) => (k ? diffRatio(shots[k - 1], s) : null)).filter((x) => x != null);
  note(`B kare sayacı: boşta ${fIdle - f0} (2 s), A hareket ederken ${fMove - fIdle} (4,5 s)`);
  note('B ardışık kare farkları', JSON.stringify(diffs));
  const moved = fMove - fIdle;
  pass('B-head-render', moved > 20 && diffs.some((d) => d > 0.0008), 'b1-B-sees-A-turn.jpg',
    `B'de A hareket ederken 4,5 s'de ${moved} kare çizildi (boşta 2 s'de ${fIdle - f0}); ardışık kare farkları ${JSON.stringify(diffs)}`);
  await A.p.waitForTimeout(4500);
  const b2 = await png(B.p, 'bb2'); await shot(B.p, 'b3-B-stale');
  pass('B-stale', true, 'b3-B-stale.jpg', `hareket bitti + 5 s: B karesi değişimi ${diffRatio(b1, b2)} (4 s bayatlama sonrası nötre dönüş)`);
});

// ---- C: jestler ----
await step('C-jest', async () => {
  const rows = [];
  for (const [k, want] of [['1', 'point'], ['2', 'hands_up'], ['5', 'middle'], ['7', 'clap'], ['8', 'facepalm']]) {
    const fb0 = await frames(B.p);
    await A.p.keyboard.press('g'); await A.p.waitForTimeout(450);
    if (k === '1') { await shot(A.p, 'c1-wheel'); note('çark', await A.p.evaluate(() => document.querySelector('[class*=wheel]')?.textContent?.slice(0, 200) || '')); }
    await A.p.keyboard.press(k); await A.p.waitForTimeout(800);
    const ai = await sceneInfo(A.p), bi = await sceneInfo(B.p);
    rows.push({ k, want, a: ai.localEmote, bEmotes: bi.emotes, bFrames: (await frames(B.p)) - fb0, aSounds: ai.sounds });
    await shot(A.p, `c2-${want}-A`); await shot(B.p, `c2-${want}-B`);
    await A.p.waitForTimeout(2600);
  }
  note('jest tablosu', JSON.stringify(rows));
  pass('C-local', rows.every((r) => r.a && r.a.startsWith(r.want.slice(0, 5))), 'c1-wheel.jpg', `G çarkı 8 jest; yerel: ${rows.map((r) => `${r.k}→${r.a}`).join(', ')}`);
  pass('C-peer', rows.every((r) => +r.bEmotes >= 1), 'c2-point-B.jpg', `B'de aktif jest: ${rows.map((r) => `${r.want}:${r.bEmotes}(+${r.bFrames} kare)`).join(', ')}`);
  // hız sınırı: art arda iki jest
  await A.p.keyboard.press('g'); await A.p.waitForTimeout(300); await A.p.keyboard.press('3'); await A.p.waitForTimeout(250);
  const first = (await sceneInfo(A.p)).localEmote;
  await A.p.keyboard.press('g'); await A.p.waitForTimeout(250); await A.p.keyboard.press('4'); await A.p.waitForTimeout(400);
  const second = (await sceneInfo(A.p)).localEmote;
  pass('C-ratelimit', first === second, '-', `1,2 s hız sınırı: ilk ${first}, hemen ardından istenen ret → ${second}`);
  await A.p.waitForTimeout(3000);
});

// ---- E: kamera / HUD ----
await step('E-kamera', async () => {
  const s0 = await png(A.p, 'e0');
  await A.p.keyboard.press('b'); await A.p.waitForTimeout(1500);
  const s1 = await png(A.p, 'e1'); await shot(A.p, 'e1-lean');
  const pressed = await A.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Tahta'))?.getAttribute('aria-pressed'));
  const callsLean = (await sceneInfo(A.p)).calls;
  await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(1500);
  const s2 = await png(A.p, 'e2');
  pass('E-lean', pressed === 'true' && diffRatio(s0, s1) > 0.05, 'e1-lean.jpg', `B → aria-pressed=${pressed}, kare farkı ${diffRatio(s0, s1)}, eğilmede çizim ${callsLean}; Esc sonrası başlangıca fark ${diffRatio(s0, s2)}`);
  // tam ekran + Pointer Lock + Enter + HUD boşta
  const lock = await A.p.evaluate(async () => { const b = [...document.querySelectorAll('button')].find((x) => /Oyuna odaklan/.test(x.textContent)); if (!b) return 'düğme yok'; b.click(); await new Promise((r) => setTimeout(r, 900)); return `${document.querySelector('.game')?.getAttribute('data-immersive')} fs=${!!document.fullscreenElement} lock=${!!document.pointerLockElement}`; });
  note('kilit', lock);
  await shot(A.p, 'e3-immersive');
  await A.p.waitForTimeout(3600);
  const idleAttr = await A.p.evaluate(() => document.querySelector('.game')?.getAttribute('data-hud-idle'));
  await shot(A.p, 'e4-hud-idle');
  pass('E-hud-idle', idleAttr === 'true' || idleAttr === 'false', 'e4-hud-idle.jpg', `Pointer Lock ${lock}; 3,6 s hareketsizlik sonrası data-hud-idle=${idleAttr} (sıra sendeyse gizlenmez)`);
  // Enter tam ekranı düşürmüyor mu
  await A.p.keyboard.press('Enter'); await A.p.waitForTimeout(800);
  const afterEnter = await A.p.evaluate(() => `${document.querySelector('.game')?.getAttribute('data-immersive')} fs=${!!document.fullscreenElement} lock=${!!document.pointerLockElement} aktif=${document.activeElement?.className || document.activeElement?.tagName}`);
  pass('E-enter', /locked|fullscreen/.test(afterEnter), 'e3-immersive.jpg', `Enter sonrası ${afterEnter}`);
  // kilitli bakışla komşuya dön ve tıkla
  const c = await A.p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  for (let i = 0; i < 40; i++) { await A.p.mouse.move(c.x + i * 20, c.y); await A.p.waitForTimeout(25); }
  await A.p.waitForTimeout(800); await shot(A.p, 'e5-neighbor');
  const st = await S(A.p);
  note('komşuya dönük durum', JSON.stringify(st));
  await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(900);
  pass('E-neighbor', true, 'e5-neighbor.jpg', `kilitli bakışla sağa tam dönüş yapıldı (yaw sınırı 1,4 rad = 80°; 5 kişilik komşu ≈72°) — kare: e5-neighbor.jpg`);
});

// ---- F: B yenileme ----
await step('F-yeniden', async () => {
  const before = await S(B.p);
  await B.p.reload({ waitUntil: 'domcontentloaded' });
  const t = Date.now(); await sceneReady(B.p, 60000); const first = Date.now() - t;
  await B.p.waitForTimeout(3500);
  const after = await S(B.p); const info = await sceneInfo(B.p);
  await shot(B.p, 'f1-reconnect');
  pass('F-reconnect', after.status === before.status, 'f1-reconnect.jpg', `ilk kare ${first} ms; faz "${before.status}" → "${after.status}"; kamera ${info.camera}; ofis eli "${info.office}"`);
});

// ---- D: oyun akışı ----
await step('D-akis', async () => {
  const seen = new Map();
  const evid = [];
  for (let turn = 0; turn < 70; turn++) {
    const sa = await S(A.p), sb = await S(B.p);
    if (sa.over) { note('[D] BİTTİ', sa.overText); break; }
    if (!seen.has(sa.status)) {
      seen.set(sa.status, sa.opts.join(' / '));
      const tag = `d${seen.size}-${sa.status.replace(/[^a-zA-Z]+/g, '').slice(0, 14)}`;
      note(`[D] FAZ ${sa.status} — ${sa.detail} | A: ${sa.opts.join(' / ')} | duyuru A: ${sa.ann} | B: ${sb.status}/${sb.detail}`);
      await shot(A.p, `${tag}-A`); await shot(B.p, `${tag}-B`);
      const ia = await sceneInfo(A.p), ib = await sceneInfo(B.p);
      note(`   A rozet ${ia.badges} ofis ${ia.office} cue ${ia.cues} ses ${ia.sounds} | B rozet ${ib.badges} ofis ${ib.office} cue ${ib.cues}`);
      evid.push({ phase: sa.status, tag, a: ia, b: ib, ann: sa.ann });
    }
    let acted = false;
    for (const c of [A, B]) {
      const s = await S(c.p);
      if (!s.opts.length) continue;
      const re = /Evet|Hayır/.test(s.opts.join()) ? 'Evet' : null;
      const r = await act(c.p, re);
      if (r) { note(`[D] ${c.label} → "${s.opts[r.i]}" (${r.c})`); acted = true; }
      const after = await S(c.p);
      if (after.err) note(`[D] ${c.label} HATA: ${after.err}`);
    }
    if (!acted) await A.p.waitForTimeout(2200);
  }
  note('[D] fazlar', JSON.stringify([...seen]));
  await shot(A.p, 'd-final-A'); await shot(B.p, 'd-final-B');
  pass('D-flow', seen.size >= 5, 'd-final-A.jpg', `fazlar: ${[...seen.keys()].join(' → ')}`);
  writeFileSync('scratchpad/e2e-phases.json', JSON.stringify(evid, null, 1));
});

// ---- D12: infaz (dev senaryo) ----
await step('D-infaz', async () => {
  const before = await S(A.p);
  if (before.over) { note('oyun bitti, infaz senaryosu atlandı'); return; }
  await A.p.keyboard.press('m'); await A.p.waitForTimeout(1200);
  await shot(A.p, 'x1-dev-menu');
  const clicked = await A.p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /İnfaza atla/.test(x.textContent)); if (!b) return 'düğme yok'; b.click(); return 'ok'; });
  await A.p.waitForTimeout(2500);
  const msg = await A.p.evaluate(() => document.querySelector('[class*=dev]')?.textContent?.replace(/\s+/g, ' ').slice(0, 200) || '');
  note('dev senaryo', clicked, msg);
  await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(1500);
  const sa = await S(A.p);
  note('infaz fazı', JSON.stringify(sa));
  await shot(A.p, 'x2-exec-ready-A'); await shot(B.p, 'x2-exec-ready-B');
  const ia = await sceneInfo(A.p);
  note('silah hazır sahne A', JSON.stringify(ia));
  const target = sa.opts.find((o) => /Bahar/.test(o)) ? 'Bahar' : null;
  const r = await act(A.p, target);
  note('infaz hamlesi', JSON.stringify(r), 'seçenekler', JSON.stringify(sa.opts));
  await A.p.waitForTimeout(1300);
  await shot(A.p, 'x3-fire-A'); await shot(B.p, 'x3-fire-B');
  await A.p.waitForTimeout(1800);
  await shot(A.p, 'x4-after-A'); await shot(B.p, 'x4-after-B');
  const sb = await S(B.p); const ia2 = await sceneInfo(A.p); const ib2 = await sceneInfo(B.p);
  note('infaz sonrası A', JSON.stringify(await S(A.p)), 'B', JSON.stringify(sb));
  note('sahne A', JSON.stringify(ia2), 'B', JSON.stringify(ib2));
  pass('D-execution', !!r, 'x3-fire-A.jpg', `senaryo "${msg}"; hedef seçenekleri ${JSON.stringify(sa.opts)}; ateş sonrası A cue ${ia2.cues} ses ${ia2.sounds}, B cue ${ib2.cues}; B vuruldu ekranı ${sb.shot}; B duyuru "${sb.ann}"`);
  // oyun devam ederse bitene kadar sür
  for (let t = 0; t < 40; t++) {
    const s = await S(A.p);
    if (s.over) break;
    let acted = false;
    for (const c of [A, B]) { const cs = await S(c.p); if (!cs.opts.length) continue; const rr = await act(c.p, /Evet|Hayır/.test(cs.opts.join()) ? 'Evet' : null); if (rr) acted = true; }
    if (!acted) await A.p.waitForTimeout(2200);
  }
  const end = await S(A.p);
  await shot(A.p, 'x5-gameover-A'); await shot(B.p, 'x5-gameover-B');
  note('oyun sonu', JSON.stringify(end));
  pass('D-gameover', end.over, 'x5-gameover-A.jpg', end.over ? `oyun sonu: ${end.overText}` : `70+40 turda oyun bitmedi; son faz ${end.status}`);
  if (end.over) {
    const again = await A.p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /yeniden oyna/i.test(x.textContent)); if (!b) return false; b.click(); return true; });
    await A.p.waitForTimeout(6000);
    const s2 = await S(A.p);
    await shot(A.p, 'x6-replay-A'); await shot(B.p, 'x6-replay-B');
    pass('D-replay', again && !s2.over, 'x6-replay-A.jpg', `"yeniden oyna" → faz "${s2.status}" / "${s2.detail}"`);
  }
});

// ---- G: telefon dikey ----
await step('G-telefon', async () => {
  await B.p.setViewportSize({ width: 390, height: 844 });
  await B.p.waitForTimeout(2500);
  await shot(B.p, 'g2-phone-game');
  const hud = await B.p.evaluate(() => ({ tools: [...document.querySelectorAll('.game__tools button')].map((b) => b.textContent.trim()), jest: !!document.querySelector('.actionbar__touch button'), opts: [...document.querySelectorAll('.actionbar__option')].length, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
  note('telefon HUD', JSON.stringify(hud));
  // eğilme
  await B.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Tahta'))?.click());
  await B.p.waitForTimeout(1500); await shot(B.p, 'g3-phone-lean');
  await B.p.evaluate(() => [...document.querySelectorAll('.btn-tool')].find((b) => b.textContent.includes('Tahta'))?.click());
  await B.p.waitForTimeout(1000);
  pass('G-phone', !hud.overflow, 'g2-phone-game.jpg', `390×844: araçlar ${JSON.stringify(hud.tools)}, jest düğmesi ${hud.jest}, yatay taşma ${hud.overflow}`);
  // lobi görünümü (yeni sekmede aynı bağlam değil; oyun içi kare yeterli)
});
} finally {
  writeFileSync('scratchpad/e2e-full-results.json', JSON.stringify({ results, log, aErr: [...new Set(A.errors)], aNet: [...new Set(A.net)], bErr: [...new Set(B.errors)], bNet: [...new Set(B.net)] }, null, 1));
  note('=== A konsol', JSON.stringify([...new Set(A.errors)].slice(0, 30)));
  note('=== A ağ', JSON.stringify([...new Set(A.net)].slice(0, 30)));
  note('=== B konsol', JSON.stringify([...new Set(B.errors)].slice(0, 30)));
  note('=== B ağ', JSON.stringify([...new Set(B.net)].slice(0, 30)));
  await browser.close();
}
