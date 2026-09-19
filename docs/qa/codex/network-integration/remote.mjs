// Run from project root with the bundled Node runtime. No secrets are emitted.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../../apps/web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries((await readFile('.env','utf8')).split('\n').flatMap(line => {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (!m) return [];
  return [[m[1], m[2].trim().replace(/^['"]|['"]$/g, '')]];
}));
const REF = process.env.SUPABASE_PROJECT_REF ?? '<PROJECT_REF>';
if (env.SUPABASE_PROJECT_REF !== REF || !env.SUPABASE_URL.includes(REF)) throw Error('Wrong target');
const out = [];
const log = (name, value) => { out.push({name,value}); console.log(name, JSON.stringify(value)); };
async function sql(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})
  });
  if (!response.ok) throw Error(`Management query HTTP ${response.status}`);
  return response.json();
}
if (process.argv[2] === 'migrate') {
  const before = await sql('select version,name from supabase_migrations.schema_migrations order by version');
  log('history_before',before);
  if (!before.some(x=>x.version === '0007')) {
    const migration = await readFile('supabase/migrations/0007_viewpoint_channels.sql','utf8');
    await sql(`begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('0007','viewpoint_channels',array[$migration$${migration}$migration$]); commit;`);
  }
  log('history_after',await sql('select version,name from supabase_migrations.schema_migrations order by version'));
  log('policies',await sql("select policyname,cmd from pg_policies where schemaname='realtime' and tablename='messages' order by policyname"));
  await writeFile('docs/qa/codex/network-integration/migration.json',JSON.stringify(out,null,2));
  process.exit(0);
}
const clients=[];
let roomId, gameId;
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const assert = (value,name) => { if(!value) throw Error(name); log(name,true); };
async function call(action,body,client) {
  const token = (await client.auth.getSession()).data.session.access_token;
  const res = await fetch('http://127.0.0.1:5173/api/game',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...body})});
  if(!res.ok) throw Error(`API ${action} HTTP ${res.status}`);
  return res.json();
}
const topic = pid=>`room:${roomId}:viewpoint:${gameId}:${pid}`;
async function join(client,name,events=[]) {
  const ch=client.channel(name,{config:{private:true,broadcast:{ack:true,self:false}}});
  ch.on('broadcast',{event:'head'},e=>events.push(e.payload));
  const status=await new Promise(resolve=>{
    const timer=setTimeout(()=>resolve('TEST_TIMEOUT'),12000);
    ch.subscribe(s=>{if(s==='SUBSCRIBED'||s==='CHANNEL_ERROR'||s==='TIMED_OUT'){clearTimeout(timer);resolve(s);}});
  });
  return {ch,status};
}
async function send(ch,payload) {try{return await ch.send({type:'broadcast',event:'head',payload});}catch{return 'threw';}}
try {
  for(let i=0;i<3;i++) {
    const client=createClient(env.SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    clients.push(client);
    const {data,error}=await client.auth.signInAnonymously();
    if(error||!data.session) throw Error(`Anonymous signup failed ${error?.status ?? 'no session'}`);
    await client.realtime.setAuth(data.session.access_token);
    await sleep(1200);
  }
  const room=await call('create_room',{displayName:'Network QA A'},clients[0]);
  roomId=room.roomId; gameId=crypto.randomUUID();
  await call('join_room',{inviteCode:room.inviteCode,displayName:'Network QA B'},clients[1]);
  const [a,b]=await Promise.all(clients.slice(0,2).map(c=>call('lobby_view',{roomId},c)));
  const aid=a.localPlayerId,bid=b.localPlayerId;
  // Dedicated two-person transport fixture; no real gameplay or existing room is changed.
  await sql(`update public.rooms set status='in_game',game_id='${gameId}' where id='${roomId}';`);
  log('fixture',{roomId,gameId,kind:'two-actor transport fixture, no game core state'});
  const count=()=>sql(`select (select count(*)::int from public.processed_commands where room_id='${roomId}') ledger,(select count(*)::int from public.game_states where room_id='${roomId}') states`);
  const before=await count();
  const fromA=[],fromB=[];
  const aa=await join(clients[0],topic(aid));
  const ba=await join(clients[1],topic(aid),fromA);
  const bb=await join(clients[1],topic(bid));
  const ab=await join(clients[0],topic(bid),fromB);
  assert([aa,ba,bb,ab].every(x=>x.status==='SUBSCRIBED'),'members_joined_both_actor_topics');
  const wire={epoch:Date.now(),seq:1,yaw:0.4,pitch:-0.2};
  assert(await send(aa.ch,wire)==='ok','actor_A_send_ack');
  assert(await send(bb.ch,{...wire,yaw:-0.3})==='ok','actor_B_send_ack');
  await sleep(1000);
  assert(fromA.length===1&&fromB.length===1,'bidirectional_real_websocket_delivery');
  const outsider=await join(clients[2],topic(aid));
  assert(outsider.status==='CHANNEL_ERROR','nonmember_join_denied');
  await clients[2].removeChannel(outsider.ch);
  const prior=fromA.length;
  const spoofResult=await send(ba.ch,{...wire,seq:2,yaw:1});
  await sleep(750);
  assert(spoofResult!=='ok'&&fromA.length===prior,'member_cannot_write_other_actor_topic');
  log('spoof_ack',spoofResult);
  const revEvents=[];
  const revision=await join(clients[0],`room:${roomId}`,revEvents);
  assert(revision.status==='SUBSCRIBED','revision_read_still_allowed');
  const revResult=await send(revision.ch,wire);
  await sleep(500);
  assert(revResult!=='ok','revision_channel_client_send_denied');
  const refresh=await clients[0].auth.refreshSession();
  assert(!refresh.error&&!!refresh.data.session,'real_token_refresh');
  await clients[0].realtime.setAuth(refresh.data.session.access_token);
  assert(await send(aa.ch,{...wire,seq:3})==='ok','send_after_token_refresh');
  await sleep(500);
  assert(fromA.length===prior+1,'delivery_after_token_refresh');
  await clients[0].removeChannel(aa.ch);
  const rejoined=await join(clients[0],topic(aid));
  assert(rejoined.status==='SUBSCRIBED','socket_channel_rejoin');
  assert(await send(rejoined.ch,{...wire,epoch:wire.epoch+1,seq:1})==='ok','send_after_rejoin');
  await sleep(500);
  assert(fromA.length===prior+2,'delivery_after_rejoin');
  const n=5,start=Date.now(),startCount=fromA.length;
  for(let i=0;i<n;i++){await send(rejoined.ch,{...wire,epoch:wire.epoch+1,seq:i+2});await sleep(750);}
  await sleep(500);
  log('measured_2_client_traffic',{sent:n,received:fromA.length-startCount,elapsedMs:Date.now()-start,wireJsonBytes:Buffer.byteLength(JSON.stringify(wire))});
  assert(JSON.stringify(await count())===JSON.stringify(before),'head_traffic_no_game_state_or_ledger_writes');
  // Database policy probes run as real authenticated roles, never using body actor as auth identity.
  log('remote_checks_complete',true);
} catch(error) {
  log('failure',String(error.message).replace(/sb[p_][^\s]+/g,'[redacted]'));
  process.exitCode=1;
} finally {
  await Promise.all(clients.map(c=>c.removeAllChannels()));
  await writeFile('docs/qa/codex/network-integration/remote-results.json',JSON.stringify(out,null,2));
}
