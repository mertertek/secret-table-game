import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({channel:vi.fn(),removeChannel:vi.fn(),setAuth:vi.fn(),getSession:vi.fn()}));
vi.mock('./supabaseClient',()=>({getSupabaseClient:()=>({channel:mock.channel,removeChannel:mock.removeChannel,realtime:{setAuth:mock.setAuth},auth:{getSession:mock.getSession}})}));
import { openViewpointChannel } from './viewpointChannel';
import type { ViewpointScope } from './viewpointProtocol';
const scope: ViewpointScope={roomId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',gameId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',localPlayerId:'cccccccc-cccc-cccc-cccc-cccccccccccc',players:[{playerId:'cccccccc-cccc-cccc-cccc-cccccccccccc',seatIndex:0},{playerId:'dddddddd-dddd-dddd-dddd-dddddddddddd',seatIndex:1}]};
let entries: any[]=[];
const ownHead={roomId:scope.roomId,playerId:scope.localPlayerId,seatIndex:0,yaw:0.2,pitch:0,t:1000};
const opened:ReturnType<typeof openViewpointChannel>[]=[];
function open(options:Partial<Parameters<typeof openViewpointChannel>[0]>={}){const ch=openViewpointChannel({roomId:scope.roomId,onPeer:vi.fn(),getToken:async()=> 'test-token',...options});opened.push(ch);return ch;}
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);vi.clearAllMocks();entries=[];
  mock.setAuth.mockResolvedValue(undefined);mock.removeChannel.mockResolvedValue('ok');
  mock.channel.mockImplementation((topic,config)=>{
    const e:any={topic,config,handler:null,status:null,on:vi.fn((_type,_filter,cb)=>{e.handler=cb;return e;}),subscribe:vi.fn(cb=>{e.status=cb;cb('SUBSCRIBED');return e;}),send:vi.fn().mockResolvedValue('ok')};entries.push(e);return e;
  });
});
afterEach(async()=>{opened.splice(0).forEach(c=>c.stop());await vi.advanceTimersByTimeAsync(2000);vi.useRealTimers();vi.unstubAllGlobals();});
describe('viewpoint channel lifecycle',()=>{
  it('uses one private acknowledged topic per actor and sends only local actor data',async()=>{
    const ch=open();ch.sync(scope);await vi.advanceTimersByTimeAsync(400);
    expect(entries).toHaveLength(2);expect(entries[0].config.config).toMatchObject({private:true,broadcast:{ack:true}});
    expect(ch.send({...ownHead,playerId:scope.players[1]!.playerId})).toBe(false);
    expect(ch.send(ownHead)).toBe(true);
    expect(Object.keys(entries[0].send.mock.calls[0][0].payload).sort()).toEqual(['epoch','pitch','seq','yaw']);
    expect(ch.send(ownHead)).toBe(false);
  });
  it('binds receiver identity to its topic and rejects spoofed/duplicate wire payload',async()=>{
    const onPeer=vi.fn();const ch=open({onPeer});ch.sync(scope);await vi.advanceTimersByTimeAsync(400);
    const payload={epoch:123,seq:1,yaw:.2,pitch:0};
    entries[1].handler({payload:{...payload,playerId:scope.localPlayerId}});
    expect(onPeer).not.toHaveBeenCalled();
    entries[1].handler({payload});entries[1].handler({payload});
    expect(onPeer).toHaveBeenCalledTimes(1);expect(onPeer.mock.calls[0]![0].playerId).toBe(scope.players[1]!.playerId);
  });
  it('game change retires channels and old callbacks cannot enter the new game',async()=>{
    const onPeer=vi.fn();const ch=open({onPeer});ch.sync(scope);await vi.advanceTimersByTimeAsync(400);
    const old=entries[1];ch.sync({...scope,gameId:'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'});
    old.handler({payload:{epoch:1,seq:1,yaw:0,pitch:0}});
    await vi.advanceTimersByTimeAsync(400);
    expect(onPeer).not.toHaveBeenCalled();expect(mock.removeChannel).toHaveBeenCalledTimes(2);expect(entries).toHaveLength(4);
  });
  it('reauth serializes real tokens; missing token never clears socket identity',async()=>{
    let token:string|null='one';const ch=open({getToken:async()=>token});ch.sync(scope);await vi.advanceTimersByTimeAsync(400);
    token='two';await ch.reauth();token=null;await ch.reauth();
    expect(mock.setAuth.mock.calls.map(c=>c[0])).toEqual(['one','two']);
  });
  it('reports failed send as presentation issue, closes cleanly and never sends before join',async()=>{
    const onIssue=vi.fn();const ch=open({onIssue});expect(ch.send(ownHead)).toBe(false);ch.sync(scope);await vi.advanceTimersByTimeAsync(400);
    entries[0].send.mockResolvedValue('error');ch.send(ownHead);await vi.advanceTimersByTimeAsync(1);
    expect(onIssue).toHaveBeenCalledWith('unavailable');ch.stop();expect(ch.send(ownHead)).toBe(false);
  });
  it('same roster does not rejoin on each game revision',async()=>{
    const ch=open();ch.sync(scope);await vi.advanceTimersByTimeAsync(400);ch.sync({...scope});await vi.advanceTimersByTimeAsync(400);
    expect(entries).toHaveLength(2);
  });
  it('hidden document retires sockets and resumes with a fresh epoch without replay',async()=>{
    const doc=new EventTarget() as EventTarget & {visibilityState:string};doc.visibilityState='visible';
    vi.stubGlobal('document',doc);
    const ch=open();ch.sync(scope);await vi.advanceTimersByTimeAsync(400);
    ch.send(ownHead);const previousEpoch=entries[0].send.mock.calls[0][0].payload.epoch;
    doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(200);expect(ch.send(ownHead)).toBe(false);
    expect(mock.removeChannel).toHaveBeenCalledTimes(2);
    doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(400);expect(entries[2].send).not.toHaveBeenCalled();
    expect(ch.send(ownHead)).toBe(true);
    expect(entries[2].send.mock.calls[0][0].payload.epoch).toBeGreaterThan(previousEpoch);
  });
  it('D16: jest hemen + 250/600 ms tekrar (aynı seq) gider ve 1,2 s hız sınırı uygular',async()=>{
    const ch=open();ch.sync(scope);await vi.advanceTimersByTimeAsync(400);
    ch.send(ownHead); // son bilinen bakış jest paketine biner
    const before=entries[0].send.mock.calls.length;
    expect(ch.sendEmote('wave')).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    const sent=entries[0].send.mock.calls.slice(before).map((c:any)=>c[0].payload);
    expect(sent).toHaveLength(3);
    expect(sent.every((p:any)=>p.emote.kind==='wave'&&p.emote.seq===1)).toBe(true);
    expect(sent.every((p:any)=>p.yaw===ownHead.yaw)).toBe(true);
    // Bakış sırası her pakette artar (alıcı sıralaması bozulmaz).
    expect(sent.map((p:any)=>p.seq)).toEqual([...sent].map((p:any)=>p.seq).sort((a:number,b:number)=>a-b));
    expect(Object.keys(sent[0]).sort()).toEqual(['emote','epoch','pitch','seq','yaw']);
    // Hız sınırı: 1,2 s dolmadan ikinci jest yok.
    expect(ch.sendEmote('clap')).toBe(false);
    await vi.advanceTimersByTimeAsync(1300);
    expect(ch.sendEmote('clap')).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    const last=entries[0].send.mock.calls.at(-1)![0].payload;
    expect(last.emote).toMatchObject({kind:'clap',seq:2});
  });
  it('D16: kanal yokken / durdurulunca jest gitmez',async()=>{
    const ch=open();
    expect(ch.sendEmote('point')).toBe(false);
    ch.sync(scope);await vi.advanceTimersByTimeAsync(400);
    ch.stop();
    expect(ch.sendEmote('point')).toBe(false);
  });
  it('late authentication can recover an initially unavailable presentation transport',async()=>{
    let token:string|null=null;const ch=open({getToken:async()=>token});ch.sync(scope);
    await vi.advanceTimersByTimeAsync(400);expect(entries).toHaveLength(0);
    token='ready';await ch.reauth();await vi.advanceTimersByTimeAsync(400);
    expect(entries).toHaveLength(2);expect(ch.send(ownHead)).toBe(true);
  });

});
