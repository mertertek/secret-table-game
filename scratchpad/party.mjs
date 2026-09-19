/**
 * Gerçek arkadaş grubu oyun gecesi yardımcısı.
 *
 * Kullanıcı odayı KENDİ tarayıcısından açar, davet kodunu verir. Bu betik yalnız
 * eksik koltukları GERÇEK anon botlarla doldurur (varsayılan toplam 6), botları
 * hazır yapar ve oyun boyunca YALNIZ botların sırasını oynar. Kullanıcının koltuğu
 * için hiçbir karar verilmez — sadece "SIRA SENDE" yazılır.
 *
 * Kullanım:
 *   set -a && source .env && set +a
 *   node scratchpad/party.mjs <DAVET_KODU> [toplamOyuncu=6]
 *
 * Gizli değerler ortamdan okunur, yazdırılmaz. Betik oyunu BAŞLATMAZ; başlatma
 * host'a (kullanıcı) aittir. Ctrl-C ile güvenle durdurulur.
 */
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const API = (process.env.J01_API_BASE || 'http://localhost:5173') + '/api/game';
const PV = 1;

const INVITE = (process.argv[2] || '').trim();
const TARGET = Number(process.argv[3] || 6);
if (!INVITE) { console.error('kullanım: node scratchpad/party.mjs <DAVET_KODU> [toplamOyuncu=6]'); process.exit(2); }
if (!SUPA_URL || !ANON_KEY) { console.error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY yok — `set -a && source .env && set +a`'); process.exit(2); }

let seq = 0;
const cid = () => `p${Date.now().toString(36)}_${++seq}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

async function anonSignIn(label) {
  const r = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ data: {} }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`${label} signup ${r.status}`);
  return { label, token: j.access_token, pid: null };
}
async function call(action, body, token) {
  // Dev sunucu yeniden başlarsa (vite.config değişimi) tek hata betiği düşürmesin.
  for (let attempt = 1; ; attempt += 1) {
    try {
      const r = await fetch(API, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ...body }),
      });
      return { status: r.status, j: await r.json().catch(() => ({})) };
    } catch (err) {
      if (attempt >= 8) throw err;
      log(`  ağ hatası (${action}), ${attempt}. tekrar…`);
      await sleep(1500 * attempt);
    }
  }
}
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const SAVE = `scratchpad/.party-${INVITE}.json`; // gitignore: *.local değil → elle silinir
const saved = existsSync(SAVE) ? JSON.parse(readFileSync(SAVE, 'utf8')) : null;

const NAMES = ['Bot-Ada', 'Bot-Bora', 'Bot-Cem', 'Bot-Derya', 'Bot-Efe', 'Bot-Gul', 'Bot-Hakan', 'Bot-Ira'];
const BOTS = [];
let ROOM = null;

// --- önceki koşudan bot oturumları varsa devam et (oda in_game olabilir) ---
if (saved) {
  ROOM = saved.room; BOTS.push(...saved.bots);
  log(`kayıtlı ${BOTS.length} bot ile devam: oda ${ROOM.slice(0, 8)}…`);
}
// --- ilk bot davet koduyla katılır, oda kimliğini ve mevcut üye sayısını okur ---
if (!saved) {
  const b0 = await anonSignIn(NAMES[0]);
  const jr = await call('join_room', { inviteCode: INVITE, displayName: b0.label }, b0.token);
  if (jr.status !== 200 || !jr.j.roomId) { console.error('join_room başarısız:', jr.status, JSON.stringify(jr.j).slice(0, 200)); process.exit(1); }
  ROOM = jr.j.roomId;
  BOTS.push(b0);
  const lv = await call('lobby_view', { roomId: ROOM }, b0.token);
  b0.pid = lv.j.localPlayerId;
  log(`oda ${ROOM.slice(0, 8)}… — şu an ${lv.j.members?.length ?? '?'} üye, hedef ${TARGET}`);
}

// --- kalan koltukları doldur ---
for (let i = 1; !saved && i < NAMES.length; i++) {
  const lv = await call('lobby_view', { roomId: ROOM }, BOTS[0].token);
  const n = lv.j.members?.length ?? 0;
  if (n >= TARGET) break;
  const b = await anonSignIn(NAMES[i]);
  const jr = await call('join_room', { inviteCode: INVITE, displayName: b.label }, b.token);
  if (jr.status !== 200) { log(`  ${b.label} katılamadı (${jr.status}) — oda dolu olabilir`); break; }
  const lv2 = await call('lobby_view', { roomId: ROOM }, b.token);
  b.pid = lv2.j.localPlayerId;
  BOTS.push(b);
  log(`  ${b.label} katıldı (${lv2.j.members?.length ?? '?'} üye)`);
}
writeFileSync(SAVE, JSON.stringify({ room: ROOM, bots: BOTS }));
const BOTPIDS = new Set(BOTS.map((b) => b.pid));
const byPid = new Map(BOTS.map((b) => [b.pid, b]));

// --- botları hazır yap; host'un (kullanıcı) başlatmasını bekle ---
if (!saved) await Promise.all(BOTS.map((b) =>
  call('lobby', { roomId: ROOM, command: { protocolVersion: PV, commandId: cid(), type: 'set_ready', ready: true } }, b.token)));
log(`${BOTS.length} bot hazır. Sen "Hazır" olup "Başlat" dediğinde oyun başlar.`);

for (;;) {
  const lv = await call('lobby_view', { roomId: ROOM }, BOTS[0].token);
  if (lv.j.status === 'in_game') break;
  const notReady = (lv.j.members ?? []).filter((m) => !m.ready && !BOTPIDS.has(m.playerId)).length;
  if (notReady) log(`  senin "Hazır" olman bekleniyor (${notReady} kişi hazır değil)…`);
  await sleep(2500);
}
log('oyun başladı — botlar yalnız kendi sıralarını oynuyor.\n');

// --- oyun döngüsü: yalnız bot sıraları; kullanıcı koltuğu atlanır ---
async function viewOf(b) { return (await call('view', { roomId: ROOM }, b.token)).j.view; }
async function send(b, v, actionId, optionId) {
  return call('command', { roomId: ROOM, command: { protocolVersion: PV, gameId: v.gameId, phaseId: v.phaseId, commandId: cid(), actionId, optionId } }, b.token);
}
let lastKey = '', guard = 0, youWaitLogged = '';
while (guard++ < 800) {
  const wv = await viewOf(BOTS[0]);
  if (!wv) { await sleep(1500); continue; }
  const key = `${wv.phase}#${wv.revision}`;
  if (key !== lastKey) {
    log(`faz=${wv.phase} rev=${wv.revision} L${wv.table.liberalPolicies}/F${wv.table.fascistPolicies} tracker=${wv.table.electionTracker}`);
    lastKey = key; youWaitLogged = '';
  }
  if (wv.phase === 'game_over') { log(`\n>>> game_over  winner=${wv.result.winner} reason=${wv.result.reason}`); break; }

  if (wv.phase === 'role_reveal') {
    const pend = wv.players.filter((p) => !p.ready && BOTPIDS.has(p.playerId)).map((p) => byPid.get(p.playerId));
    if (pend.length) await Promise.all(pend.map((b) => send(b, wv, 'act_ack_role', 'ack')));
    else if (youWaitLogged !== key) { log('  (senin rol onayın bekleniyor — tarayıcıda "Hazır")'); youWaitLogged = key; }
    await sleep(1200); continue;
  }
  if (wv.phase === 'voting') {
    const voters = wv.players.filter((p) => p.alive && !p.hasVoted && BOTPIDS.has(p.playerId)).map((p) => byPid.get(p.playerId));
    if (voters.length) await Promise.all(voters.map((b) => send(b, wv, 'act_vote', Math.random() < 0.75 ? 'vote_yes' : 'vote_no')));
    else if (youWaitLogged !== key) { log('  >>> SIRA SENDE — tarayıcıda oy ver'); youWaitLogged = key; }
    await sleep(1400); continue;
  }
  const actorPid = (() => {
    if (wv.phase === 'nomination') return wv.players.find((p) => p.isPresidentialCandidate)?.playerId;
    if (wv.phase === 'president_discard') return wv.players.find((p) => p.office === 'president')?.playerId;
    if (wv.phase === 'chancellor_choice') return wv.players.find((p) => p.office === 'chancellor')?.playerId;
    if (wv.phase === 'veto_response') return wv.players.find((p) => p.office === 'president')?.playerId;
    if (wv.phase === 'executive_action') return wv.table.currentPower?.actorId;
    return null;
  })();
  if (!actorPid) { await sleep(1200); continue; }
  if (!BOTPIDS.has(actorPid)) {
    if (youWaitLogged !== key) { log(`  >>> SIRA SENDE (${wv.phase}) — tarayıcıda hamleni yap`); youWaitLogged = key; }
    await sleep(2500); continue;
  }
  const b = byPid.get(actorPid);
  const pv = await viewOf(b);
  // chancellor: veto varsa enact'i tercih et (kullanıcının oyununu sürprizle uzatma)
  const act = wv.phase === 'chancellor_choice'
    ? (pv.actions.find((a) => a.kind === 'enact_policy') ?? pv.actions[0])
    : pv.actions[0];
  if (!act) { await sleep(1000); continue; }
  const r = await send(b, pv, act.actionId, act.options[0]?.optionId);
  log(`  ${b.label} ${act.kind} → ${r.j.ok ? 'ok' : JSON.stringify(r.j).slice(0, 120)}`);
  if (r.j.ok) {
    const pv2 = await viewOf(b);
    const ack = pv2.actions.find((a) => a.kind === 'ack_private_result');
    if (ack) await send(b, pv2, ack.actionId, ack.options[0].optionId);
  }
  await sleep(1200);
}
log('party yardımcısı bitti.');
