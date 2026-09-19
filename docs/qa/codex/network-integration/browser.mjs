// Two isolated Chromium contexts; real Vite application transport + remote Supabase.
import { readFile,writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('<yerel-yol>);
const env=Object.fromEntries((await readFile('.env','utf8')).split('\n').flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[]}));
const results=[]; const log=(name,value)=>{results.push({name,value});console.log(name,JSON.stringify(value));};
const check=(value,name)=>{if(!value)throw Error(name);log(name,true);};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let fixture;
try {
  const pages=[];
  for(let i=0;i<2;i++) {
    const context=await browser.newContext();const page=await context.newPage();pages.push(page);
    page.on('requestfailed',request=>{const u=new URL(request.url());if(u.hostname.endsWith('.supabase.co'))log('browser_network_failure',{host:u.hostname,error:request.failure()?.errorText});});
    await page.goto('http://127.0.0.1:5173/');
    await page.evaluate(async()=>{
      const {getSupabaseClient}=await import('/src/multiplayer/supabaseClient.ts');
      window.qaClient=getSupabaseClient();
      const {error}=await window.qaClient.auth.signInAnonymously();
      if(error)throw Error(`signup HTTP ${error.status}`);
      window.qaCall=async(action,body)=>{
        const token=(await window.qaClient.auth.getSession()).data.session.access_token;
        const response=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...body})});
        if(!response.ok)throw Error(`API ${action} HTTP ${response.status}`);return response.json();
      };
    });
    await new Promise(r=>setTimeout(r,1000));
  }
  const room=await pages[0].evaluate(()=>window.qaCall('create_room',{displayName:'Browser Network A'}));
  await pages[1].evaluate(code=>window.qaCall('join_room',{inviteCode:code,displayName:'Browser Network B'}),room.inviteCode);
  const snapshots=await Promise.all(pages.map(p=>p.evaluate(roomId=>window.qaCall('lobby_view',{roomId}),room.roomId)));
  const gameId=crypto.randomUUID();fixture={roomId:room.roomId,gameId,kind:'isolated browser transport fixture'};
  const res=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:`update public.rooms set status='in_game',game_id='${gameId}' where id='${room.roomId}';`})});
  check(res.ok,'browser_fixture_prepared');
  for(let i=0;i<2;i++) await pages[i].evaluate(async({roomId,gameId,localPlayerId,players})=>{
    window.qaScope={roomId,gameId,localPlayerId,players};window.qaReceived=[];window.qaIssues=[];
    const {openViewpointChannel}=await import('/src/multiplayer/viewpointChannel.ts');
    window.qaChannel=openViewpointChannel({roomId,onPeer:v=>window.qaReceived.push(v),onIssue:v=>window.qaIssues.push(v),getToken:async()=>(await window.qaClient.auth.getSession()).data.session?.access_token??null});
    window.qaChannel.sync(window.qaScope);
    window.qaSend=yaw=>window.qaChannel.send({roomId,playerId:localPlayerId,seatIndex:players.find(p=>p.playerId===localPlayerId).seatIndex,yaw,pitch:0,t:Date.now()});
  },{roomId:room.roomId,gameId,localPlayerId:snapshots[i].localPlayerId,players:snapshots[i].members});
  await pages[0].waitForFunction(()=>window.qaSend(.3),{},{timeout:15000,polling:500});
  await pages[1].waitForFunction(()=>window.qaReceived.length>0,{},{timeout:10000});
  check(await pages[1].evaluate(()=>window.qaReceived[0].playerId===window.qaScope.players.find(p=>p.playerId!==window.qaScope.localPlayerId).playerId),'actual_browser_A_to_B_authorized_actor');
  await pages[1].waitForFunction(()=>window.qaSend(-.3),{},{timeout:10000,polling:500});
  await pages[0].waitForFunction(()=>window.qaReceived.length>0,{},{timeout:10000});
  check(true,'actual_browser_B_to_A_delivery');
  check(await pages[0].evaluate(async()=>{
    const refresh=await window.qaClient.auth.refreshSession();if(refresh.error)return false;await window.qaChannel.reauth();return true;
  }),'browser_token_refresh_reauth');
  await new Promise(r=>setTimeout(r,600));
  await pages[0].evaluate(()=>window.qaSend(.5));
  await pages[1].waitForFunction(()=>window.qaReceived.some(p=>p.yaw===.5),{},{timeout:10000});
  check(true,'browser_delivery_after_refresh');
  // Real network failure through Chromium network emulation (no synthetic offline event).
  await pages[0].context().setOffline(true);
  await new Promise(r=>setTimeout(r,750));
  check(!await pages[0].evaluate(()=>window.qaSend(.6)),'browser_offline_send_suppressed');
  await pages[0].context().setOffline(false);
  await pages[0].waitForFunction(()=>window.qaSend(.7),{},{timeout:15000,polling:500});
  await pages[1].waitForFunction(()=>window.qaReceived.some(p=>p.yaw===.7),{},{timeout:10000});
  check(true,'browser_network_return_delivery');
  log('browser_errors',await Promise.all(pages.map(p=>p.evaluate(()=>window.qaIssues.filter(Boolean).length))));
  check(await pages[0].evaluate(()=>{window.qaChannel.stop();return !window.qaSend(1); }),'browser_stop_suppresses_send');
  log('fixture',fixture);
} catch(error) {log('failure',String(error.message).slice(0,250));process.exitCode=1;}
finally {await browser.close();await writeFile('docs/qa/codex/network-integration/browser-results.json',JSON.stringify(results,null,2));}
