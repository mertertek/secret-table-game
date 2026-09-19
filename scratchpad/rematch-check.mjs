/**
 * A1 doğrulaması: tamamen bot bir oda, oyun sonuna kadar oynar, sonra host
 * "play_again" gönderir; yeni gameId / role_reveal / revision = eski+1 kontrol edilir.
 * Yerel API köprüsü (vite) + uzak Supabase. Gizli değer yazdırmaz.
 *   node --env-file=.env scratchpad/rematch-check.mjs [oyuncu=6]
 */
const SUPA_URL = process.env.VITE_SUPABASE_URL, ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const API = (process.env.J01_API_BASE || 'http://localhost:5173') + '/api/game';
const N = Number(process.argv[2] || 6), PV = 1;
let seq = 0; const cid = () => `r${Date.now().toString(36)}_${++seq}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
async function anon(label) {
  const r = await fetch(`${SUPA_URL}/auth/v1/signup`, { method: 'POST', headers: { apikey: ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ data: {} }) });
  const j = await r.json(); if (!j.access_token) fail(`${label} signup ${r.status}`); return { label, token: j.access_token, pid: null };
}
async function call(action, body, token) {
  const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...body }) });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}
const bots = []; for (let i = 0; i < N; i++) bots.push(await anon(`RB-${i + 1}`));
const host = bots[0];
const cr = await call('create_room', { displayName: host.label }, host.token);
if (cr.status !== 200) fail(`create_room ${cr.status} ${JSON.stringify(cr.j)}`);
const ROOM = cr.j.roomId; log(`oda ${ROOM.slice(0, 8)} mode=${cr.j.mode}`);
for (const b of bots.slice(1)) { const jr = await call('join_room', { inviteCode: cr.j.inviteCode, displayName: b.label }, b.token); if (jr.status !== 200) fail(`join ${b.label} ${jr.status}`); }
for (const b of bots) { const lv = await call('lobby_view', { roomId: ROOM }, b.token); b.pid = lv.j.localPlayerId; }
const byPid = new Map(bots.map((b) => [b.pid, b]));
const lobby = (b, type) => call('lobby', { roomId: ROOM, command: { protocolVersion: PV, commandId: cid(), type, ...(type === 'set_ready' ? { ready: true } : {}) } }, b.token);
await Promise.all(bots.map((b) => lobby(b, 'set_ready')));
const st = await lobby(host, 'start_game'); if (!st.j.ok) fail(`start_game ${JSON.stringify(st.j)}`);
const viewOf = async (b) => (await call('view', { roomId: ROOM }, b.token)).j.view;
const send = (b, v, actionId, optionId) => call('command', { roomId: ROOM, command: { protocolVersion: PV, gameId: v.gameId, phaseId: v.phaseId, commandId: cid(), actionId, optionId } }, b.token);
async function playToEnd() {
  let last = '', guard = 0;
  while (guard++ < 900) {
    const wv = await viewOf(host); if (!wv) { await sleep(800); continue; }
    const key = `${wv.phase}#${wv.revision}`; if (key !== last) { log(`faz=${wv.phase} rev=${wv.revision} L${wv.table.liberalPolicies}/F${wv.table.fascistPolicies}`); last = key; }
    if (wv.phase === 'game_over') return wv;
    if (wv.phase === 'role_reveal') { await Promise.all(wv.players.filter((p) => !p.ready).map((p) => send(byPid.get(p.playerId), wv, 'act_ack_role', 'ack'))); await sleep(500); continue; }
    if (wv.phase === 'voting') { await Promise.all(wv.players.filter((p) => p.alive && !p.hasVoted).map((p) => send(byPid.get(p.playerId), wv, 'act_vote', Math.random() < 0.75 ? 'vote_yes' : 'vote_no'))); await sleep(500); continue; }
    const actorPid = wv.phase === 'nomination' ? wv.players.find((p) => p.isPresidentialCandidate)?.playerId
      : wv.phase === 'president_discard' || wv.phase === 'veto_response' ? wv.players.find((p) => p.office === 'president')?.playerId
      : wv.phase === 'chancellor_choice' ? wv.players.find((p) => p.office === 'chancellor')?.playerId
      : wv.phase === 'executive_action' ? wv.table.currentPower?.actorId : null;
    if (!actorPid) { await sleep(800); continue; }
    const b = byPid.get(actorPid); const pv = await viewOf(b);
    const act = wv.phase === 'chancellor_choice' ? (pv.actions.find((a) => a.kind === 'enact_policy') ?? pv.actions[0]) : pv.actions[0];
    if (!act) { await sleep(600); continue; }
    const r = await send(b, pv, act.actionId, act.options[0]?.optionId);
    if (!r.j.ok) log(`  ${b.label} ${act.kind} → ${JSON.stringify(r.j).slice(0, 120)}`);
    else { const pv2 = await viewOf(b); const ack = pv2.actions.find((a) => a.kind === 'ack_private_result'); if (ack) await send(b, pv2, ack.actionId, ack.options[0].optionId); }
    await sleep(300);
  }
  fail('oyun bitmedi (guard)');
}
const end = await playToEnd();
log(`>>> game_over winner=${end.result.winner} reason=${end.result.reason} rev=${end.revision} gameId=${end.gameId.slice(0, 8)}`);
// --- rematch ---
const nonHost = bots[1];
const bad = await lobby(nonHost, 'play_again'); log(`host olmayan play_again → ok=${bad.j.ok} error=${bad.j.error ?? '-'}`);
if (bad.j.ok) fail('host olmayan yeniden başlatabildi');
const pa = await lobby(host, 'play_again'); log(`host play_again → status=${pa.status} ok=${pa.j.ok} error=${pa.j.error ?? '-'}`);
if (!pa.j.ok) fail(`play_again başarısız: ${JSON.stringify(pa.j)}`);
await sleep(800);
const views = await Promise.all(bots.map(viewOf));
const v0 = views[0];
if (v0.gameId === end.gameId) fail('gameId değişmedi');
if (v0.phase !== 'role_reveal') fail(`yeni faz role_reveal değil: ${v0.phase}`);
if (v0.revision !== end.revision + 1) fail(`revision ${v0.revision}, beklenen ${end.revision + 1}`);
if (!views.every((v) => v.gameId === v0.gameId && v.phase === 'role_reveal')) fail('istemciler farklı oyun görüyor');
if (!views.every((v) => v.privateView.role && v.privateView.hand.length === 0 && v.result === null)) fail('yeni oyunda rol yok / eski sonuç kaldı');
const lv = await call('lobby_view', { roomId: ROOM }, host.token); if (lv.j.status !== 'in_game') fail(`oda durumu ${lv.j.status}`);
// devam eden oyunu play_again ile sıfırlama denemesi reddedilmeli
const again = await lobby(host, 'play_again'); log(`devam eden oyunda play_again → ok=${again.j.ok} error=${again.j.error ?? '-'}`);
if (again.j.ok) fail('devam eden oyun sıfırlandı!');
const v1 = await viewOf(host); if (v1.gameId !== v0.gameId) fail('gameId ikinci denemede değişti');
log(`>>> REMATCH OK: yeni gameId=${v0.gameId.slice(0, 8)} rev=${v0.revision} faz=${v0.phase}; oda ${ROOM}`);
