import { describe, expect, it } from 'vitest';
import { acceptHeadWire, headIsStale, parseEmoteWire, parseHeadWire, viewpointInterval, viewpointTopic, type ViewpointScope } from './viewpointProtocol';
const scope: ViewpointScope = { roomId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',gameId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',localPlayerId:'cccccccc-cccc-cccc-cccc-cccccccccccc',players:[{playerId:'cccccccc-cccc-cccc-cccc-cccccccccccc',seatIndex:0},{playerId:'dddddddd-dddd-dddd-dddd-dddddddddddd',seatIndex:1}] };
const peer=scope.players[1]!.playerId;
const wire={epoch:100,seq:1,yaw:0.5,pitch:0.2};
describe('authorized viewpoint protocol',()=>{
  it('topic binds game and actor; malformed scope fails closed',()=>{
    expect(viewpointTopic(scope,peer)).toBe(`room:${scope.roomId}:viewpoint:${scope.gameId}:${peer}`);
    expect(()=>viewpointTopic(scope,'actor:another')).toThrow();
  });
  it('derives identity and seat from authorized subscription; never sender clock',()=>{
    const result=acceptHeadWire(wire,peer,scope,undefined,99999)!;
    expect(result.head).toEqual({roomId:scope.roomId,playerId:peer,seatIndex:1,yaw:0.5,pitch:0.2,t:99999});
  });
  it('rejects payload actor injection and unexpected fields',()=>{
    expect(parseHeadWire({...wire,playerId:scope.localPlayerId})).toBeNull();
    expect(parseHeadWire({...wire,role:'secret'})).toBeNull();
  });
  it('rejects nonfinite, unsafe, fractional, negative or unbounded wire values',()=>{
    for(const invalid of [{yaw:NaN},{pitch:Infinity},{yaw:1.41},{pitch:-0.61},{seq:0},{seq:1.5},{epoch:Infinity},{seq:Number.MAX_SAFE_INTEGER+1}]) expect(parseHeadWire({...wire,...invalid})).toBeNull();
  });
  it('rejects duplicate/out-of-order packets and retired sender epochs',()=>{
    const prev={epoch:100,seq:5,receivedAt:1000};
    for(const invalid of [{seq:5},{seq:4},{epoch:99,seq:999}]) expect(acceptHeadWire({...wire,...invalid},peer,scope,prev,2000)).toBeNull();
    expect(acceptHeadWire({...wire,epoch:101},peer,scope,prev,2000)).not.toBeNull();
  });
  it('rejects self and actor absent from authoritative roster',()=>{
    expect(acceptHeadWire(wire,scope.localPlayerId,scope,undefined,1000)).toBeNull();
    expect(acceptHeadWire(wire,'unknown',scope,undefined,1000)).toBeNull();
  });
  it('D16: jest alanı şemaya uyar; bilinmeyen kind DÜŞER, paket kabul edilir',()=>{
    const emote={kind:'point',seq:1,at:1700000000000};
    expect(parseHeadWire({...wire,emote})!.emote).toEqual(emote);
    // Bilinmeyen jest / bozuk şekil: alan atılır, bakış geçer.
    for(const bad of [{...emote,kind:'dab'},{...emote,seq:0},{...emote,seq:1.5},{...emote,at:0},{kind:'point',seq:1},{...emote,extra:1},'point',null,[]]) {
      const head=parseHeadWire({...wire,emote:bad});
      expect(head).not.toBeNull();
      expect(head!.emote).toBeUndefined();
    }
    expect(parseEmoteWire(emote)).toEqual(emote);
    expect(parseEmoteWire({...emote,kind:'shrug'})).toBeNull();
  });
  it('D16: aynı seq bir kez oynatılır; tekrar paketleri bakışı yine taşır',()=>{
    const emote={kind:'wave',seq:4,at:1700000000000};
    const first=acceptHeadWire({...wire,emote},peer,scope,undefined,5000)!;
    expect(first.head.emote).toEqual(emote);
    expect(first.cursor.emoteSeq).toBe(4);
    // 250/600 ms tekrarları: yeni bakış seq'i, AYNI jest seq'i → jest düşer.
    const repeat=acceptHeadWire({...wire,seq:2,emote},peer,scope,first.cursor,5250)!;
    expect(repeat.head.emote).toBeUndefined();
    expect(repeat.head.yaw).toBe(wire.yaw);
    expect(repeat.cursor.emoteSeq).toBe(4);
    // Sonraki jest (seq artar) oynanır.
    const next=acceptHeadWire({...wire,seq:3,emote:{...emote,kind:'clap',seq:5}},peer,scope,repeat.cursor,6000)!;
    expect(next.head.emote).toMatchObject({kind:'clap',seq:5});
    // Jest alanı olmayan paket jest taşımaz.
    expect(acceptHeadWire({...wire,seq:4},peer,scope,next.cursor,6100)!.head.emote).toBeUndefined();
  });
  it('expires based on local reception and budgets fanout at 7/10 players',()=>{
    expect(headIsStale({epoch:999999999,seq:1,receivedAt:1000},5001)).toBe(true);
    for(const n of [7,10]) expect(n*n*1000/viewpointInterval(n)).toBeLessThanOrEqual(67);
  });
});
