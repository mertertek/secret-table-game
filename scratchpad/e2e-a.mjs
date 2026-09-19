/** A maddesi: iki gerçek tarayıcı bağlamı + botlar, lobi senkronu. */
import { launch, makeCtx, createRoom, joinRoom, shot, note, BASE } from './e2e-lib.mjs';
const browser = await launch();
const A = await makeCtx(browser, 'A');
const B = await makeCtx(browser, 'B');
try {
  const t0 = Date.now();
  const { code, url } = await createRoom(A.p, 'Mert');
  note('A oda açtı', code, url, `${Date.now() - t0} ms`);
  await shot(A.p, 'a1-lobby-host');
  await joinRoom(B.p, code, 'Bahar');
  note('B katıldı');
  await A.p.waitForFunction(() => document.body.textContent.includes('Bahar'), null, { timeout: 10000 }).catch(() => note('!! B adı A lobisinde görünmedi'));
  // B karakter seçer, A'da görünme süresi
  const cards = await B.p.$$('.picker__card');
  note('B karakter kartı sayısı', cards.length);
  const beforeA = await A.p.evaluate(() => document.querySelector('.lobby__body')?.textContent || '');
  const pickName = await B.p.evaluate(() => {
    const cards = [...document.querySelectorAll('.picker__card')];
    const target = cards.find((c) => !c.classList.contains('is-on')) || cards[1];
    target.click();
    return target.querySelector('.picker__card-name')?.textContent;
  });
  const tPick = Date.now();
  note('B seçti:', pickName);
  await B.p.waitForTimeout(1500);
  const bErr = await B.p.evaluate(() => document.querySelector('.notice--error')?.textContent || '');
  if (bErr) note('!! B lobi hatası:', bErr);
  await shot(B.p, 'a2-lobby-guest-picker');
  // ten tonu seç
  await B.p.evaluate(() => { const s = [...document.querySelectorAll('.picker__skin')].find((x) => !x.classList.contains('is-on')); s?.click(); });
  await B.p.waitForTimeout(1200);
  // A tarafında B'nin avatarı: lobi masasında avatar bilgisi var mı
  const aTable = await A.p.evaluate(() => {
    const nodes = [...document.querySelectorAll('.lobby__body *')].filter((n) => n.children.length === 0 && n.textContent.trim());
    return nodes.map((n) => `${n.className}|${n.textContent.trim()}`).slice(0, 60);
  });
  note('A lobi masası metinleri:', JSON.stringify(aTable).slice(0, 1200));
  note('A yansıma gecikmesi (yaklaşık, poll):', Date.now() - tPick, 'ms');
  await shot(A.p, 'a3-lobby-host-after-guest-pick');
  // botlar: target 5 (A+B+3)
  const botOut = await A.p.evaluate(async () => {
    const m = await import('/src/dev/botRunner.ts');
    const code = document.querySelector('.code-badge__value').textContent.trim();
    const roomId = location.pathname.split('/').pop();
    const r = await m.startBots({ roomId, inviteCode: code, target: 5, currentMembers: 2 });
    return { count: r.count };
  }).catch((e) => ({ error: String(e).slice(0, 300) }));
  note('bot başlatma:', JSON.stringify(botOut));
  await A.p.waitForTimeout(6000);
  const members = await A.p.evaluate(() => document.querySelector('.lobby__count')?.textContent);
  note('A üye sayacı:', members);
  await shot(A.p, 'a4-lobby-5p');
  const lobbyState = await A.p.evaluate(async () => {
    const roomId = location.pathname.split('/').pop();
    const api = await import('/src/multiplayer/apiClient.ts');
    return null;
  }).catch(() => null);
  // avatar farklılığı: lobi masasındaki avatar isimleri
  const avatars = await A.p.evaluate(() => [...document.querySelectorAll('[class*=seat], [class*=member]')].map((n) => n.getAttribute('data-avatar') || n.title || n.textContent.trim().slice(0, 40)).slice(0, 20));
  note('A koltuk metinleri:', JSON.stringify(avatars).slice(0, 900));
  // hazır ol + başlat
  await B.p.click('button:has-text("Hazırım")').catch(() => {});
  await A.p.click('button:has-text("Hazırım")').catch(() => {});
  await A.p.waitForTimeout(3000);
  const canStart = await A.p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Oyunu başlat')); return b ? !b.disabled : null; });
  note('Oyunu başlat etkin mi:', canStart, await A.p.evaluate(() => document.querySelector('.lobby__hint')?.textContent || ''));
  await shot(A.p, 'a5-lobby-ready');
  console.log('CODE=' + code);
  console.log('ROOM=' + (await A.p.evaluate(() => location.pathname)));
} finally {
  note('--- A hataları ---', JSON.stringify([...A.errors, ...A.net]).slice(0, 2000));
  note('--- B hataları ---', JSON.stringify([...B.errors, ...B.net]).slice(0, 2000));
  await browser.close();
}
