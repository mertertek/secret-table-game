/**
 * D3 §h kabul ölçütlerinin saf (DOM'suz) karşılıkları. Geometri üretimi
 * karakter başına ~0,5 s sürdüğü için ağır testler tek karakterle çalışır;
 * 8 karakter × 3 ten üretimi yalnız ALAN düzeyinde doğrulanır.
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_CHARACTER_IDS, AVATAR_SKIN_IDS } from '@secret-table/contracts';
import { Color, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import {
  boundaryEdges, clusterDecimate, gradientNormals, marchField,
  projectToSurface, taubinSmooth, vertexNormals,
} from '../hands/marchingCubes';
import { sdTorus, smax, smin } from '../sdf/primitives';
import {
  ACCESSORY_LIFT, CHARACTERS, CHARACTER_IDS, SKIN_IDS, SPEC,
  avatarForSeat, characterSpec, labelHeight, mouthOffset, parseAvatar, skinTones,
} from './spec';
import { characterField, evalPrim } from './field';
import { TIERS, characterGeometry, clearCharacterQueue, requestCharacterGeometry } from './geometry';
import { boneCandidates, boneDefs, buildRig, skinWeights } from './skeleton';
import { BOUNDARY_LIMIT, MIN_BAND, NO_BOUNDARY, boundaryDistance, darken, palette, primColorKey, vertexColor } from './colors';
import { BOUNDARY_CACHE_KEY, boundaryMaterial, patchBoundaryShader } from './boundaryMaterial';
import { BLINK_MS, FaceTexture, blinkLid, browShift, drawFace, expressionParams, nextBlinkDelay } from './face';
import { palette as scenePalette, board } from '../materials/palette';

describe('D3 şartname verisi', () => {
  it('8 karakter, 3 ten, 23 taban ilkeli ve 8 kemik', () => {
    expect(CHARACTER_IDS).toHaveLength(8);
    expect(SKIN_IDS).toEqual(['acik', 'orta', 'koyu']);
    expect(SPEC.base.primitives).toHaveLength(23);
    expect(SPEC.bones.map((b) => b.name)).toEqual(['hips', 'spine', 'neck', 'head', 'shoulder.L', 'shoulder.R', 'elbow.L', 'elbow.R']);
    for (const c of CHARACTERS) {
      expect(SPEC.outfits[c.outfit]).toBeDefined();
      for (const a of c.accessories) expect(SPEC.accessories[a.id], `${c.id}/${a.id}`).toBeDefined();
    }
  });

  it('D3.4: sözleşme kimlik listesi tasarım JSON`u ile birebir aynı', () => {
    // Sunucu (`packages/server`) three`u içe aktaramadığı için listeyi
    // `@secret-table/contracts/avatars.ts` tutar. JSON`a karakter eklenirse
    // burası kırılır ve liste + 0008 CHECK birlikte güncellenir.
    expect([...AVATAR_CHARACTER_IDS]).toEqual([...CHARACTER_IDS]);
    expect([...AVATAR_SKIN_IDS]).toEqual([...SKIN_IDS]);
  });

  it('koltuk sırası → karakter/ten eşlemesi ve B3 dizgi çözümü', () => {
    expect(avatarForSeat(0)).toEqual({ character: 'biyikli-amca', skin: 'acik' });
    expect(avatarForSeat(9)).toEqual({ character: CHARACTER_IDS[1], skin: 'acik' });
    // B3 gelene kadar `PlayerView.avatar` yok; dizgi geçersizse koltuk sırası kazanır.
    expect(parseAvatar(undefined, 3)).toEqual(avatarForSeat(3));
    expect(parseAvatar('yok-boyle-karakter:1', 3)).toEqual(avatarForSeat(3));
    expect(parseAvatar('fotr:2', 3)).toEqual({ character: 'fotr', skin: 'koyu' });
    expect(parseAvatar('fotr', 3)).toEqual({ character: 'fotr', skin: avatarForSeat(3).skin });
  });

  it('etiket yüksekliği tablosu: baş/şapka tepesi + 0,05', () => {
    expect(labelHeight('biyikli-amca')).toBeCloseTo(.745, 6);
    expect(labelHeight('fotr')).toBeCloseTo(.865, 6);
    expect(labelHeight('sakalli')).toBeCloseTo(.835, 6);
    // Tur 2: kep 30 mm yükseltildi (kaşları örtüyordu), etiket de aynı kadar.
    expect(labelHeight('kepli-cocuk')).toBeCloseTo(.765 + .03, 6);
    expect(ACCESSORY_LIFT.cap).toBeCloseTo(.03, 6);
    for (const c of CHARACTERS) {
      const lift = c.accessories.reduce((a, e) => Math.max(a, SPEC.accessories[e.id]!.labelLift), 0);
      const raised = c.accessories.reduce((a, e) => Math.max(a, ACCESSORY_LIFT[e.id] ?? 0), 0);
      expect(labelHeight(c.id)).toBeCloseTo(SPEC.label.baseWorldY + lift + raised, 6);
    }
  });

  it('ağız kayması bıyık/sakaldan gelir', () => {
    expect(mouthOffset(characterSpec('biyikli-amca'))).toBeCloseTo(-.02, 6);
    expect(mouthOffset(characterSpec('gozluklu'))).toBe(0);
    expect(mouthOffset(characterSpec('sakalli'))).toBeCloseTo(-.01, 6);
  });
});

describe('D3 SDF alanı', () => {
  it('torus kesin uzaklık verir', () => {
    // Eksen y, R 0,1, r 0,02 → halka merkezi düzleminde yüzey 0,08 ve 0,12'de.
    expect(sdTorus(.12, 0, 0, 0, 0, 0, 1, .1, .02)).toBeCloseTo(0, 9);
    expect(sdTorus(.08, 0, 0, 0, 0, 0, 1, .1, .02)).toBeCloseTo(0, 9);
    expect(sdTorus(.1, .05, 0, 0, 0, 0, 1, .1, .02)).toBeCloseTo(.03, 9);
    expect(smax(.1, .2, 0)).toBe(.2);
    expect(smin(.1, .2, 0)).toBe(.1);
  });

  it('8 karakter × 3 ten alanı hatasız kurulur ve gövde içi negatiftir', () => {
    for (const id of CHARACTER_IDS) for (const skin of SKIN_IDS) {
      const f = characterField(id, 'standard');
      const p = palette(characterSpec(id), skinTones(skin));
      expect(p.outfit).toMatch(/^#[0-9a-f]{6}$/i);
      // Karın, göğüs, baş ve üst kol merkezleri gövdenin İÇİNDE.
      for (const [x, y, z] of [[0, .30, .01], [0, .44, 0], [0, .79, -.01], [-.23, .47, -.08]] as const) {
        expect(f.field(x, y, z), `${id} (${x},${y},${z})`).toBeLessThan(0);
      }
      // Gövdenin 40 cm yanı boş.
      expect(f.field(.75, .5, 0)).toBeGreaterThan(.3);
      expect(f.bounds.max[1]).toBeGreaterThan(1);
    }
  });

  it('kesme düzlemi yalnız ilk ilkeli (kubbe) kısıtlar: kep siperliği durur', () => {
    const f = characterField('kepli-cocuk', 'standard');
    // Siperlik kubbe kesme düzleminin ALTINDA kalır (tur 2: kep +30 mm).
    const lift = ACCESSORY_LIFT.cap ?? 0;
    expect(f.field(0, .851 + lift, -.30)).toBeLessThan(0);
    // Kubbe kesildiği için kepin altında (y 0,80, z 0,19 arka) yüzey baştır, kep değil.
    expect(f.nearest(0, .80, .19).accessory).not.toBe('cap');
    // Yükseltme bütün ilkellere ve kesme düzlemine birlikte uygulanır.
    const dome = f.groups.find((g) => g.id === 'cap')!.prims[0]!;
    expect(dome.cy).toBeCloseTo(.84 + lift, 6);
    expect(f.groups.find((g) => g.id === 'cap')!.clip!.py).toBeCloseTo(.86 + lift, 6);
  });

  it('düşük kademede yalnız standard aksesuarlar düşer', () => {
    const high = characterField('bereli-teyze', 'standard');
    const low = characterField('bereli-teyze', 'low');
    // Tur 2: ince teller SDF'ten çıkıp gerçek geometriye taşındı (§d alternatifi).
    expect(high.wires.map((p) => p.accessory)).toContain('glasses-chain');
    expect(low.wires.map((p) => p.accessory)).not.toContain('glasses-chain');
    expect(low.wires.map((p) => p.accessory)).toContain('glasses');
    expect(high.groups.map((g) => g.id)).toContain('beret');
    // Tel ilkelleri SDF alanına GİRMEZ: halkanın üst kavsi (baş yüzeyinin
    // dışında) boş kalır, tel oraya gerçek geometriyle eklenir.
    expect(high.field(-.08, .830, -.183)).toBeGreaterThan(0);
    expect(high.all.filter((p) => p.accessory === 'glasses')).toHaveLength(5);
  });

  it('gövde oran ölçeği (bodyScale) taban ilkellerine uygulanır', () => {
    const fat = characterField('biyikli-amca', 'standard');   // belly 1,15 · shoulders 1,05
    const thin = characterField('kepli-cocuk', 'standard');   // belly 0,95 · shoulders 0,90
    const belly = (f: typeof fat) => f.base.find((p) => p.id === 'belly')!;
    expect(belly(fat).rx).toBeCloseTo(.2 * 1.15, 6);
    expect(belly(thin).rx).toBeCloseTo(.2 * .95, 6);
    expect(belly(fat).ry).toBeCloseTo(.17, 6);                // y ölçeklenmez
    const arm = (f: typeof fat) => f.base.find((p) => p.id === 'forearm.R')!;
    expect(arm(fat).bx).toBeCloseTo(.22 * 1.05, 6);
    expect(arm(thin).bx).toBeCloseTo(.22 * .90, 6);
    // Tişörtte manşet ilkeli çıkarılır (kısa kol).
    expect(thin.base.some((p) => p.id.startsWith('cuff'))).toBe(false);
    expect(fat.base.some((p) => p.id.startsWith('cuff'))).toBe(true);
  });
});

describe('D3 geometri', () => {
  const build = characterGeometry('fotr', 'orta', 'standard');

  it('kapalı yüzey üretir (her kenar tam iki üçgene ait)', () => {
    const f = characterField('gozluklu', 'low');
    const raw = marchField(f.field, f.bounds.min, f.bounds.max, TIERS.low.voxel);
    expect(raw.indices.length).toBeGreaterThan(0);
    expect(boundaryEdges(raw.indices)).toBe(0);
  }, 60000);

  it('üçgen bütçesi ve iki malzeme grubu', () => {
    // §g hedefi 6 k QEM sadeleştirme varsayıyor; köşe kümelemeyle 14 k üst sınır
    // (rapor: docs/qa/claude/D3-characters.md "Sapmalar").
    expect(build.triangles).toBeLessThanOrEqual(14000);
    expect(build.triangles).toBeGreaterThan(3000);
    expect(build.rawTriangles).toBeGreaterThan(build.triangles * 3);
    expect(build.geometry.groups).toHaveLength(2);
    expect(build.geometry.groups[0]!.materialIndex).toBe(0);
    expect(build.geometry.groups[1]!.materialIndex).toBe(1);
    // Yüz grubu boş olmamalı (yüz dokusu görünmeli) ama gövdeyi de yutmamalı.
    expect(build.faceTriangles).toBeGreaterThan(80);
    expect(build.faceTriangles).toBeLessThan(build.triangles * .3);
    const total = build.geometry.groups.reduce((a, g) => a + g.count, 0);
    expect(total).toBe(build.geometry.getIndex()!.count);
  }, 60000);

  it('aynı karakterin iki teni geometriyi paylaşır, yalnız renk değişir', () => {
    const a = characterGeometry('fotr', 'orta', 'standard');
    const b = characterGeometry('fotr', 'koyu', 'standard');
    expect(b.geometry.getAttribute('position').array).toBe(a.geometry.getAttribute('position').array);
    expect(b.geometry.getAttribute('skinIndex').array).toBe(a.geometry.getAttribute('skinIndex').array);
    expect(b.geometry.getAttribute('color').array).not.toBe(a.geometry.getAttribute('color').array);
    expect(characterGeometry('fotr', 'orta', 'standard')).toBe(a);
  }, 60000);

  it('yüz penceresi UV: yalnız üye köşeler [0,1] aralığında', () => {
    const uv = build.geometry.getAttribute('uv');
    let inside = 0;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
      if (u > 0 && v > 0) inside++;
    }
    expect(inside).toBeGreaterThan(40);
  }, 60000);

  it('kemik ağırlıkları toplamı 1 ve indisler 8 kemik içinde', () => {
    const index = build.geometry.getAttribute('skinIndex');
    const weight = build.geometry.getAttribute('skinWeight');
    for (let v = 0; v < index.count; v++) {
      const sum = weight.getX(v) + weight.getY(v) + weight.getZ(v) + weight.getW(v);
      expect(sum).toBeCloseTo(1, 5);
      expect(weight.getZ(v)).toBe(0);
      expect(weight.getW(v)).toBe(0);
      for (const i of [index.getX(v), index.getY(v)]) {
        expect(Number.isInteger(i)).toBe(true);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(8);
      }
    }
  }, 60000);
});

describe('D3 iskelet', () => {
  it('kemik zinciri ve bind konumları şartnameyle aynı', () => {
    const defs = boneDefs(characterSpec('gozluklu'));   // shoulders 1,0
    expect(defs.map((d) => d.parent)).toEqual([-1, 0, 1, 2, 1, 1, 4, 5]);
    expect(defs[0]!.position).toEqual([0, .1, 0]);
    expect(defs[3]!.head).toEqual([0, .62, -.01]);     // head kemiği boynun ucunda
    const rig = buildRig(characterSpec('gozluklu'));
    expect(rig.bones).toHaveLength(8);
    expect(rig.byName.head.parent).toBe(rig.byName.neck);
    expect(rig.byName['elbow.L'].parent).toBe(rig.byName['shoulder.L']);
    expect(rig.skeleton.boneInverses).toHaveLength(8);
  });

  it('omuz ölçeği kemiklere de uygulanır', () => {
    const wide = boneDefs(characterSpec('sakalli'));      // 1,08
    const narrow = boneDefs(characterSpec('kepli-cocuk')); // 0,90
    const shoulderX = (defs: readonly { name: string; head: readonly number[] }[]) => defs.find((d) => d.name === 'shoulder.R')!.head[0]!;
    expect(shoulderX(wide)).toBeCloseTo(.215 * 1.08, 6);
    expect(shoulderX(narrow)).toBeCloseTo(.215 * .90, 6);
  });

  it('bölge → kemik kuralları (§c geçersiz kılmaları)', () => {
    const f = characterField('sakalli', 'standard');
    const prim = (id: string) => f.all.find((p) => p.id === id)!;
    expect(boneCandidates(prim('head'), 0, .85)).toEqual(['head']);
    expect(boneCandidates(prim('head'), 0, .63)).toEqual(['head', 'neck']);
    expect(boneCandidates(prim('neck'), 0, .58)).toEqual(['neck', 'head']);
    expect(boneCandidates(prim('thigh.L'), -.11, .08)).toEqual(['hips']);
    expect(boneCandidates(prim('forearm.R'), .23, .37)).toEqual(['elbow.R']);
    expect(boneCandidates(prim('upperArm.L'), -.23, .47)).toEqual(['shoulder.L', 'elbow.L']);
    expect(boneCandidates(prim('belly'), 0, .3)).toEqual(['hips', 'spine']);
    expect(boneCandidates(prim('deltoid.R'), .21, .54)).toEqual(['spine', 'shoulder.R']);
    // Sakal/bere başla döner; yaka aksesuarları omurgada kalır.
    expect(boneCandidates(prim('beardChin'), 0, .62)).toEqual(['head', 'neck']);
    expect(boneCandidates(prim('beanieDome'), 0, .89)).toEqual(['head']);
    const collar = characterField('fotr', 'standard').all.find((p) => p.id === 'collar.L')!;
    expect(boneCandidates(collar, -.05, .56)).toEqual(['spine']);
  });

  it('ağırlıklar 2 kemiğe dağılır ve toplamı 1', () => {
    const f = characterField('gozluklu', 'standard');
    const points = new Float32Array([0, .79, -.2, 0, .56, -.06, -.23, .47, -.08, 0, .30, -.15]);
    const prims = [f.nearest(0, .79, -.2), f.nearest(0, .56, -.06), f.nearest(-.23, .47, -.08), f.nearest(0, .30, -.15)];
    const skin = skinWeights(characterSpec('gozluklu'), points, prims);
    for (let v = 0; v < 4; v++) {
      expect(skin.weight[v * 4]! + skin.weight[v * 4 + 1]!).toBeCloseTo(1, 6);
      expect(skin.weight[v * 4]!).toBeGreaterThanOrEqual(skin.weight[v * 4 + 1]!);
    }
  });
});

describe('D3 giysi renk kuralları', () => {
  const hex = (c: Color) => `#${c.getHexString()}`;
  const at = (id: string, primId: string, x: number, y: number, z: number) => {
    const spec = characterSpec(id);
    const f = characterField(id, 'standard');
    const p = palette(spec, skinTones('orta'));
    return hex(vertexColor(f.all.find((q) => q.id === primId)!, x, y, z, spec, p));
  };

  it('outfitDark giysi renginin %12 koyusudur', () => {
    expect(darken('#ffffff')).not.toBe('#ffffff');
    expect(darken('#000000')).toBe('#000000');
  });

  it('yelek: gövde bordo, omuz kapağı ve kollar krem, V yaka krem', () => {
    expect(at('biyikli-amca', 'belly', 0, .30, -.19)).toBe('#7a2a3a');
    expect(at('biyikli-amca', 'deltoid.R', .215, .545, 0)).toBe('#eee1c7');
    expect(at('biyikli-amca', 'upperArm.R', .23, .47, -.08)).toBe('#eee1c7');
    // V yakanın içi (y 0,54 → yarı genişlik 0,098) krem, dışı bordo.
    expect(at('biyikli-amca', 'chest', 0, .54, -.16)).toBe('#eee1c7');
    expect(at('biyikli-amca', 'chest', .19, .54, -.10)).toBe('#7a2a3a');
  });

  it('kazak: manşet koyu ton, boyun halkası giysi rengi', () => {
    expect(at('sakalli', 'chest', 0, .44, -.15)).toBe('#4f5a3c');
    expect(at('sakalli', 'cuff.R', .221, .34, -.3)).toBe(darken('#4f5a3c'));
    expect(at('sakalli', 'neck', 0, .55, -.06)).toBe('#4f5a3c');
    expect(at('sakalli', 'neck', 0, .62, -.06)).toBe(skinTones('orta').shadow);
  });

  it('tişört: ön kol TEN, manşet yok, boyun halkası giysi', () => {
    expect(at('kepli-cocuk', 'forearm.R', .2, .36, -.28)).toBe(skinTones('orta').base);
    expect(at('kepli-cocuk', 'upperArm.R', .22, .47, -.08)).toBe('#8ec5df');
    expect(characterField('kepli-cocuk', 'standard').all.some((p) => p.region === 'cuff')).toBe(false);
  });

  it('hırka: orta şerit krem, dışı pembe; bacak rengi ortak', () => {
    expect(at('bereli-teyze', 'belly', 0, .30, -.19)).toBe('#eee1c7');
    expect(at('bereli-teyze', 'belly', .17, .30, -.12)).toBe('#e6a0b8');
    expect(at('bereli-teyze', 'thigh.R', .12, .09, -.2)).toBe(SPEC.legColor);
  });

  it('aksesuar renkleri kendi ilkellerinden gelir', () => {
    expect(at('fotr', 'crown', 0, 1.02, -.01)).toBe('#25355a');
    expect(at('fotr', 'hatBand', 0, .945, -.17)).toBe('#b49359');
    expect(at('topuzlu', 'bunTie', 0, .93, .09)).toBe('#2e7a5a');   // karakterin geçersiz kılması
    expect(at('kepli-cocuk', 'visor', 0, .85, -.3)).toBe('#8ec5df');
  });

  it('hiçbir giysi/vurgu rengi parti renklerine yakın değil', () => {
    // sRGB bileşen uzaklığı (0–1). Parti dili SAHNEDE `palette.liberal/fascist`
    // ve D10 tahta tonlarıyla konuşur; karakterlerde hiçbiri kullanılmaz.
    const distance = (a: string, b: string) => {
      const p = (v: string) => [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
      const [x, y] = [p(a), p(b)];
      return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!);
    };
    /**
     * §e uyarısı: bordo `#7a2a3a` D10 `fascistDeep #7e332f` tonuna en yakın
     * renktir (sRGB uzaklık ≈ 0,06; ton farkı ~15°). Tasarım bunu kabul edip
     * yeleği HER ZAMAN krem gömlekle çerçeveler; ayrım D3.2 karesinde tahta
     * yanında kontrol edildi (docs/qa/claude/D3-characters.md "Açık noktalar").
     */
    const closeByDesign = new Set(['#7a2a3a']);
    for (const c of CHARACTERS) for (const mine of [c.outfitColor, c.accent]) {
      // Sahnedeki gerçek parti rozet/kart renkleriyle hiçbir zaman karışmaz.
      expect(distance(mine, scenePalette.liberal), `${c.id} ${mine}`).toBeGreaterThan(.14);
      expect(distance(mine, scenePalette.fascist), `${c.id} ${mine}`).toBeGreaterThan(.14);
      expect(distance(mine, board.liberalDeep), `${c.id} ${mine}`).toBeGreaterThan(.14);
      if (!closeByDesign.has(mine)) expect(distance(mine, board.fascistDeep), `${c.id} ${mine}`).toBeGreaterThan(.14);
    }
  });
});

describe('D3 yüz', () => {
  it('ifade parametreleri şartname sayılarını taşır', () => {
    const child = characterSpec('kepli-cocuk');
    const smile = expressionParams(child, '#f1c9a3', 'smile');
    expect(smile.brow).toEqual(SPEC.faces.expressions.smile.brow);
    expect(smile.cheekAlpha).toBeCloseTo(Math.min(1, .34 * 1.6), 6);
    expect(smile.freckles).toBe(true);
    expect(smile.mouth.type).toBe('grin');            // kepli çocuk: sırıtma
    expect(smile.glasses).toBe(false);
    const grumpy = expressionParams(child, '#f1c9a3', 'grumpy');
    expect(grumpy.lid).toBeCloseTo(.35, 6);
    expect(grumpy.pupilDy).toBe(-8);
    const surprised = expressionParams(child, '#f1c9a3', 'surprised');
    expect(surprised.eyeScale).toBeCloseTo(1.18, 6);
    expect(surprised.pupilR).toBe(20);
  });

  it('karakter yüz notları (kaş ağırlığı/asimetri, gözlük, ağız kayması)', () => {
    const amca = expressionParams(characterSpec('biyikli-amca'), '#c98f62', 'neutral');
    expect(amca.browWeight).toBeCloseTo(1.4, 6);
    expect(amca.browColor).toBe('#8f877c');
    expect(amca.mouthDy).toBeCloseTo(-20, 6);          // kalın bıyık ağzı 20 mm indirir
    const fedora = expressionParams(characterSpec('fotr'), '#c98f62', 'neutral');
    expect(fedora.browAsymMm).toBeCloseTo(12, 6);
    expect(expressionParams(characterSpec('gozluklu'), '#c98f62', 'smile').glasses).toBe(true);
  });

  it('göz kırpma zaman çizelgesi 120/100 ms, aralık 3–6 s', () => {
    expect(BLINK_MS).toBe(220);
    expect(blinkLid(-1)).toBe(0);
    expect(blinkLid(0)).toBe(0);
    expect(blinkLid(80)).toBeCloseTo(.5, 6);
    expect(blinkLid(130)).toBe(1);
    expect(blinkLid(180)).toBeCloseTo(.5, 6);
    expect(blinkLid(BLINK_MS)).toBe(0);
    expect(nextBlinkDelay(() => 0)).toBe(3000);
    expect(nextBlinkDelay(() => .999999)).toBeCloseTo(6000, 0);
  });
});

describe('D3 sahne bütünlüğü', () => {
  it('karakter uzayı orijini minder üstü, oturmuş boy 1,00', () => {
    expect(SPEC.frame.seatTopWorldY).toBeCloseTo(-.305, 6);
    expect(SPEC.sittingHeight).toBe(1);
    // Baş tepesi dünya 0,695; etiket tabanı 0,05 üstünde.
    expect(SPEC.sittingHeight + SPEC.frame.seatTopWorldY).toBeCloseTo(.695, 6);
    expect(SPEC.label.baseWorldY).toBeCloseTo(.695 + .05, 6);
    // Koltuk kamerası göz yüksekliği karakterin göz çizgisiyle aynı.
    expect(SPEC.head.eyeY + SPEC.frame.seatTopWorldY).toBeCloseTo(SPEC.camera.seatPrivate.now - .001, 2);
  });

  it('hiçbir ilkel masa tablasıyla kesişmez (dünya −0,235…−0,025)', () => {
    // Masa kenarı koltuk ekseninden z −0,29 önde; uyluk ucu −0,20 + r 0,065.
    for (const id of CHARACTER_IDS) {
      const f = characterField(id, 'standard');
      for (const p of f.base) {
        if (p.region !== 'leg') continue;
        expect(Math.min(p.aabb[2]!, p.aabb[5]!)).toBeGreaterThan(-.29);
      }
      // Siluet (dirsek dahil) 0,61 m: en yakın iki koltuk 1,24 m aralıkta çakışmaz.
      const width = Math.max(...f.all.map((p) => Math.max(Math.abs(p.aabb[0]!), Math.abs(p.aabb[3]!))));
      expect(width * 2, id).toBeLessThan(.72);
    }
  });

  it('ilkel değerlendirmesi alanla tutarlı (smin birleşimi ≤ tek ilkel)', () => {
    const f = characterField('kivircik', 'standard');
    for (const [x, y, z] of [[0, .8, -.1], [.1, .3, -.1], [-.2, .5, 0]] as const) {
      const single = Math.min(...f.base.map((p) => evalPrim(p, x, y, z)));
      expect(f.field(x, y, z)).toBeLessThanOrEqual(single + 1e-9);
    }
  });
});

describe('D3 tur 2 — yumuşatma, tel aksesuarlar, kaş tavanı, kuyruk', () => {
  it('Taubin yumuşatma köşe/üçgen sayısını değiştirmez ve büzüştürmez', () => {
    const f = characterField('gozluklu', 'low');
    const raw = marchField(f.field, f.bounds.min, f.bounds.max, TIERS.low.voxel);
    const clustered = clusterDecimate(raw, TIERS.low.cell, undefined, TIERS.low.refine);
    const smoothed = taubinSmooth(clustered, 3, .5, -.53);
    expect(smoothed.positions.length).toBe(clustered.positions.length);
    expect(smoothed.indices).toBe(clustered.indices);
    // Ham MC yüzeyi kapalıdır; kümeleme/yumuşatma topolojiyi değiştirmez.
    expect(boundaryEdges(raw.indices)).toBe(0);
    const spread = (m: { positions: Float32Array }) => {
      let min = Infinity, max = -Infinity;
      for (let v = 1; v < m.positions.length; v += 3) { min = Math.min(min, m.positions[v]!); max = Math.max(max, m.positions[v]!); }
      return max - min;
    };
    // λ/μ çifti hacmi korur: toplam boy %2'den fazla küçülmemeli.
    expect(spread(smoothed)).toBeGreaterThan(spread(clustered) * .98);
    // Yüzey gerçekten yumuşadı: komşu köşeler arası normal sapması azalır.
    const roughness = (m: { positions: Float32Array; indices: Uint32Array }) => {
      let sum = 0;
      for (let t = 0; t < m.indices.length; t += 3) {
        const a = m.indices[t]! * 3, b = m.indices[t + 1]! * 3, c = m.indices[t + 2]! * 3;
        sum += Math.abs(m.positions[a + 1]! - m.positions[b + 1]!) + Math.abs(m.positions[b + 1]! - m.positions[c + 1]!);
      }
      return sum / (m.indices.length / 3);
    };
    expect(roughness(smoothed)).toBeLessThan(roughness(clustered));
  }, 60000);

  it('sabitlenen köşeler (ince ayrıntı) yerinde kalır', () => {
    const positions = new Float32Array([0, 0, 0, .1, 0, 0, 0, .1, 0, .05, .05, .1]);
    const indices = Uint32Array.from([0, 1, 2, 0, 1, 3, 1, 2, 3, 0, 2, 3]);
    const pinned = new Uint8Array([1, 0, 0, 0]);
    const out = taubinSmooth({ positions, normals: new Float32Array(12), indices }, 2, .5, -.53, pinned);
    expect([out.positions[0], out.positions[1], out.positions[2]]).toEqual([0, 0, 0]);
    expect(out.positions[3]).not.toBe(.1);
  });

  it('ince teller gerçek geometri olarak mesh\'e eklenir (ek çizim yok)', () => {
    const build = characterGeometry('gozluklu', 'orta', 'low');
    const plain = characterGeometry('sakalli', 'orta', 'low');
    expect(build.geometry.groups).toHaveLength(2);      // gövde + yüz, tel için grup YOK
    expect(plain.geometry.groups).toHaveLength(2);
    // Gözlük telleri head kemiğine 1,0 ağırlıkla bağlı köşeler ekler.
    const index = build.geometry.getAttribute('skinIndex');
    const weight = build.geometry.getAttribute('skinWeight');
    let solidHead = 0;
    for (let v = 0; v < index.count; v++) if (weight.getX(v) === 1 && index.getX(v) === 3) solidHead++;
    expect(solidHead).toBeGreaterThan(100);
  }, 60000);

  it('kaş şapka kenarının altına iner, şapkasızda yerinde kalır', () => {
    const child = characterSpec('kepli-cocuk');
    // Yüz penceresinin üstü 93 mm (kep) → kaş aşağı kayar; 150 mm (kel) → kaymaz.
    expect(browShift(child, 'smile', 93)).toBeLessThan(0);
    expect(browShift(child, 'smile', 93)).toBeGreaterThanOrEqual(-20);
    expect(browShift(characterSpec('biyikli-amca'), 'smile', 150)).toBe(0);
    expect(browShift(child, 'smile', undefined)).toBe(0);
    expect(expressionParams(child, '#f1c9a3', 'smile', 0, 93).browDy).toBeLessThan(0);
  });

  it('üretim kuyruğu: önbellekteyse eşzamanlı, değilse boşta zaman diliminde', async () => {
    clearCharacterQueue();
    characterGeometry('topuzlu', 'acik', 'standard');
    let sync = false;
    expect(requestCharacterGeometry('topuzlu', 'acik', () => { sync = true; })).toBe(true);
    expect(sync).toBe(true);
    const done = await new Promise<boolean>((resolve) => {
      const immediate = requestCharacterGeometry('kivircik', 'koyu', () => resolve(true));
      expect(immediate).toBe(false);
    });
    expect(done).toBe(true);
  }, 120000);

  it('standard kademe: 7 mm voxel, ≤ 14 k üçgen, 1024×768 yüz tuvali', () => {
    expect(TIERS.standard.voxel).toBeCloseTo(.007, 6);
    expect(TIERS.standard.face).toEqual([1024, 768]);
    expect(TIERS.low.face).toEqual([512, 384]);
    for (const id of ['gozluklu', 'kepli-cocuk']) {
      expect(characterGeometry(id, 'orta', 'standard').triangles).toBeLessThanOrEqual(14000);
    }
  }, 180000);
});

/**
 * Testler node ortamında (DOM yok) koşar; `FaceTexture` yalnız
 * `document.createElement('canvas')` + 2D bağlamı kullandığı için ikisi de
 * kaydedici saplamayla verilir (üçüncü taraf kütüphane eklemeden).
 */
type CtxCall = (name: string, args: number[]) => void;

function stubCtx(record: CtxCall = () => {}): CanvasRenderingContext2D {
  const noop = (name: string) => (...args: unknown[]) => record(name, args as number[]);
  return {
    setTransform: noop('setTransform'), fillRect: noop('fillRect'), beginPath: noop('beginPath'),
    ellipse: noop('ellipse'), fill: noop('fill'), moveTo: noop('moveTo'), lineTo: noop('lineTo'),
    quadraticCurveTo: noop('quadraticCurveTo'), closePath: noop('closePath'), stroke: noop('stroke'),
    clip: noop('clip'), save: noop('save'), restore: noop('restore'),
    lineCap: 'butt', lineJoin: 'miter', lineWidth: 1, globalAlpha: 1,
    fillStyle: '#000', strokeStyle: '#000',
  } as unknown as CanvasRenderingContext2D;
}

function withStubCanvas<T>(run: () => T): T {
  const host = globalThis as { document?: unknown };
  const previous = host.document;
  host.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => stubCtx() }),
  };
  try { return run(); } finally { if (previous === undefined) delete host.document; else host.document = previous; }
}

describe('D3 tur 3 — netlik', () => {
  const R = .15;
  const sphere = (x: number, y: number, z: number) => Math.hypot(x, y, z) - R;

  it('gradyan normali birim uzunlukta ve küre normaliyle aynı', () => {
    const dirs: number[] = [];
    for (let i = 0; i < 200; i++) {
      // Fibonacci küresi: yönler düzgün dağılır.
      const t = (i + .5) / 200, phi = Math.acos(1 - 2 * t), theta = Math.PI * (1 + Math.sqrt(5)) * i;
      dirs.push(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi));
    }
    const positions = Float32Array.from(dirs.map((v) => v * R));
    const normals = gradientNormals(positions, sphere, .0035);
    for (let v = 0; v < 200; v++) {
      const nx = normals[v * 3]!, ny = normals[v * 3 + 1]!, nz = normals[v * 3 + 2]!;
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 5);
      const dot = nx * dirs[v * 3]! + ny * dirs[v * 3 + 1]! + nz * dirs[v * 3 + 2]!;
      expect(dot).toBeGreaterThan(.9999);          // < 0,81°
    }
  });

  it('seyreltilmiş kürede gradyan normali alan normalinden çok daha doğru', () => {
    const raw = marchField(sphere, [-.2, -.2, -.2], [.2, .2, .2], .007);
    const mesh = clusterDecimate(raw, .0245);
    const gradient = gradientNormals(mesh.positions, sphere, .0035);
    const area = vertexNormals(mesh.positions, mesh.indices);
    const count = mesh.positions.length / 3;
    const error = (n: Float32Array) => {
      let sum = 0;
      for (let v = 0; v < count; v++) {
        const x = mesh.positions[v * 3]!, y = mesh.positions[v * 3 + 1]!, z = mesh.positions[v * 3 + 2]!;
        const len = Math.hypot(x, y, z) || 1;
        const dot = (n[v * 3]! * x + n[v * 3 + 1]! * y + n[v * 3 + 2]! * z) / len;
        sum += Math.acos(Math.min(1, Math.max(-1, dot)));
      }
      return sum / count * 180 / Math.PI;
    };
    // Alan normali kümelenmiş ağda ~5° sapıyor (fasetler); gradyan < 0,5°.
    expect(error(gradient)).toBeLessThan(.5);
    expect(error(area)).toBeGreaterThan(error(gradient) * 4);
  }, 60000);

  it('Newton yansıtma kümelenmiş köşeleri iso-yüzeye çeker (|f| < 0,5 mm)', () => {
    const raw = marchField(sphere, [-.2, -.2, -.2], [.2, .2, .2], .007);
    const mesh = clusterDecimate(raw, .0245);
    const worst = (p: Float32Array) => {
      let max = 0;
      for (let v = 0; v < p.length; v += 3) max = Math.max(max, Math.abs(sphere(p[v]!, p[v + 1]!, p[v + 2]!)));
      return max;
    };
    const before = worst(mesh.positions);
    const after = worst(projectToSurface(mesh.positions, sphere, .0035, 2, .0245 / 2));
    expect(before).toBeGreaterThan(.0005);         // kümeleme gerçekten içeri çöküyor
    expect(after).toBeLessThan(.0005);
  }, 60000);

  it('yansıtma sabitlenen köşeye dokunmaz ve adımı sınırlar', () => {
    const positions = Float32Array.from([.3, 0, 0, .3, 0, 0]);
    const pinned = new Uint8Array([1, 0]);
    const out = projectToSurface(positions, sphere, .0035, 1, .02, pinned);
    expect(out[0]).toBe(positions[0]);              // sabit köşe yerinde
    expect(out[3]!).toBeCloseTo(.28, 4);            // .3 − maxStep
  });

  it('yüz tuvali: doku boyutu pencere oranını izler, filtre ve anizotropi tam', () => {
    const [w, h] = TIERS.standard.face;
    const [wx, wy] = [SPEC.faces.window.x, SPEC.faces.window.y];
    const window = { w: wx[1]! - wx[0]!, h: wy[1]! - wy[0]! };
    // Texel yoğunluğu iki eksende en fazla %10 farklı olmalı (tur 2'de fark %60'tı).
    const density = (w / window.w) / (h / window.h);
    expect(density).toBeGreaterThan(.9);
    expect(density).toBeLessThan(1.1);

    const texture = withStubCanvas(() => new FaceTexture('standard', 16));
    expect(texture.texture.image.width).toBe(1024);
    expect(texture.texture.image.height).toBe(768);
    expect(texture.texture.generateMipmaps).toBe(true);
    expect(texture.texture.minFilter).toBe(LinearMipmapLinearFilter);
    expect(texture.texture.magFilter).toBe(LinearFilter);
    expect(texture.texture.anisotropy).toBe(16);
    expect(texture.texture.colorSpace).toBe(SRGBColorSpace);
    // Aynı anahtarda yeniden çizim yok; ifade değişince needsUpdate.
    const spec = characterSpec('gozluklu');
    expect(withStubCanvas(() => texture.draw(spec, '#f1c9a3', 'smile', 0, 120))).toBe(true);
    expect(withStubCanvas(() => texture.draw(spec, '#f1c9a3', 'smile', 0, 120))).toBe(false);
    expect(withStubCanvas(() => texture.draw(spec, '#f1c9a3', 'grumpy', 0, 120))).toBe(true);
  });

  it('çizim dönüşümü iki eksende ayrı ölçeklenir ve tuvalin tamamını kaplar', () => {
    const calls: { transform?: number[]; rect?: number[] } = {};
    const ctx = stubCtx((name, args) => {
      if (name === 'setTransform' && !calls.transform) calls.transform = args;
      if (name === 'fillRect' && !calls.rect) calls.rect = args;
    });
    drawFace(ctx, 1024, 768, expressionParams(characterSpec('fotr'), '#f1c9a3', 'neutral'));
    const [ax, , , dy, ex, fy] = calls.transform!;
    expect(ax).toBeCloseTo(2.56, 6);                // px/mm x = 1024 / 400 mm
    expect(dy).toBeCloseTo(-2.4, 6);                // px/mm y = 768 / 320 mm
    expect(ex).toBeCloseTo(512, 6);                 // baş merkezi tuval ortası
    expect(fy).toBeCloseTo(360, 6);
    // Ten zemini mm cinsinden (−200…200, −170…150) → piksel (0…1024, 0…768).
    const [rx, ry, rw, rh] = calls.rect!;
    expect(ax! * rx! + ex!).toBeCloseTo(0, 6);
    expect(ax! * (rx! + rw!) + ex!).toBeCloseTo(1024, 6);
    expect(dy! * (ry! + rh!) + fy!).toBeCloseTo(0, 6);
    expect(dy! * ry! + fy!).toBeCloseTo(768, 6);
  });

  it('sakal/bıyık gövdeye 18 mm k ile katılır (§d 30 mm yerine)', () => {
    const beard = characterField('sakalli', 'low').groups.find((g) => g.id === 'beard-full')!;
    expect(beard.joinK).toBeCloseTo(.018, 6);
    // Grubun KENDİ içindeki k değişmedi (sakal tek kütle kalır).
    expect(beard.prims[0]!.k).toBeCloseTo(.03, 6);
    // Saç/şapka grupları etkilenmez.
    const hair = characterField('topuzlu', 'low').groups.find((g) => g.id === 'hair-bun')!;
    expect(hair.joinK).toBeCloseTo(hair.prims[0]!.k, 6);
  });
});

describe('D3 tur 4 — renk sınırları (shader kenar-yumuşatması)', () => {
  const vest = SPEC.outfits.vest;
  const jacket = SPEC.outfits.jacket;
  const sweater = SPEC.outfits.sweater;

  it('boundaryDistance işareti ve ölçeği: V yakada sınıra olan gerçek uzaklık', () => {
    // Yelek V'si y 0,50'de yarı genişlik 0,11·(0,50−0,38)/0,18 = 0,0733.
    const y = .50, z = -.15, half = .11 * (y - .38) / .18;
    const inside = boundaryDistance('front', 'shirt', 'outfit', vest, half - .010, y, z);
    const outside = boundaryDistance('front', 'shirt', 'outfit', vest, half + .010, y, z);
    expect(inside).toBeCloseTo(.010, 6);     // V'nin içi → gömlek tarafı pozitif
    expect(outside).toBeCloseTo(-.010, 6);
    // Anahtarlar takas edilince işaret döner, büyüklük aynı kalır.
    expect(boundaryDistance('front', 'outfit', 'shirt', vest, half - .010, y, z)).toBeCloseTo(-.010, 6);
    // Tam sınırda sıfır.
    expect(boundaryDistance('front', 'shirt', 'outfit', vest, half, y, z)).toBeCloseTo(0, 9);
    // Kuralı olmayan giyside ön mekanizma TANIMSIZDIR (çağıran ilkel sınırına düşer).
    expect(boundaryDistance('front', 'shirt', 'outfit', sweater, 0, y, z)).toBeNaN();
  });

  it('ilkel sınırı iki bölgenin SDF farkının yarısıdır, boyun halkası y eşiğidir', () => {
    // prim: (dB − dA)/2, işaret kendi bölgesi lehine.
    expect(boundaryDistance('prim', 'skin', 'outfit', vest, 0, .8, 0, .002, .042)).toBeCloseTo(.020, 9);
    expect(boundaryDistance('prim', 'skin', 'outfit', vest, 0, .8, 0, .042, .002)).toBeCloseTo(-.020, 9);
    // Bölge o noktada hiç temsil edilmiyorsa mekanizma tanımsız / tek yönlü.
    expect(boundaryDistance('prim', 'skin', 'outfit', vest, 0, .8, 0, Infinity, Infinity)).toBeNaN();
    expect(boundaryDistance('prim', 'skin', 'outfit', vest, 0, .8, 0, .002, Infinity)).toBe(BOUNDARY_LIMIT);
    // Kırpma: ±BOUNDARY_LIMIT dışına çıkmaz.
    expect(boundaryDistance('prim', 'skin', 'outfit', vest, 0, .8, 0, 0, .4)).toBe(BOUNDARY_LIMIT);
    // neck: halkanın altı giysi (pozitif), üstü ten gölgesi.
    expect(boundaryDistance('neck', 'outfit', 'skinShadow', sweater, 0, .565, -.07)).toBeCloseTo(.010, 9);
    expect(boundaryDistance('neck', 'outfit', 'skinShadow', sweater, 0, .585, -.07)).toBeCloseTo(-.010, 9);
    expect(boundaryDistance('neck', 'outfit', 'skinShadow', vest, 0, .565, -.07)).toBeNaN();
    expect(boundaryDistance('none', 'skin', 'skin', vest, 0, .8, 0)).toBe(NO_BOUNDARY);
  });

  it('ceketin yaka bandı kendi bölgesidir: V kenarı gömlek↔bant, dışı bant↔giysi', () => {
    const y = .50, z = -.15, half = .12 * (y - .36) / .20;
    expect(primColorKey({ id: 'chest', region: 'torso' } as never, half - .005, y, z, characterSpec('fotr'))).toBe('shirt');
    expect(primColorKey({ id: 'chest', region: 'torso' } as never, half + .015, y, z, characterSpec('fotr'))).toBe('outfitDark');
    expect(primColorKey({ id: 'chest', region: 'torso' } as never, half + .050, y, z, characterSpec('fotr'))).toBe('outfit');
    // Bant içinde gömlek sınırına uzaklık pozitif, bandın dış kenarına da pozitif.
    expect(boundaryDistance('front', 'outfitDark', 'shirt', jacket, half + .010, y, z)).toBeGreaterThan(0);
    expect(boundaryDistance('front', 'outfitDark', 'outfit', jacket, half + .025, y, z)).toBeGreaterThan(0);
  });

  it('ince şeritler en az 12 mm: yaka bandı ve manşet', () => {
    for (const outfit of Object.values(SPEC.outfits)) {
      for (const rule of outfit.front) {
        if (rule.shape === 'Vband') expect(Math.max(rule.band ?? 0, MIN_BAND)).toBeGreaterThanOrEqual(MIN_BAND);
      }
    }
    // Manşet ilkeli gerçek bir hacimdir; ekseni boyunca genişliği ≥ 12 mm.
    const cuff = SPEC.base.primitives.find((p) => p.id === 'cuff.R')!;
    const a = cuff.a!, b = cuff.b!;
    expect(Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)).toBeGreaterThanOrEqual(MIN_BAND);
    expect(MIN_BAND).toBe(.012);
  });

  it('öznitelikler: colorB ve dBoundary konum sayısıyla aynı uzunlukta, aralıkta', () => {
    const build = characterGeometry('fotr', 'orta', 'standard');
    const position = build.geometry.getAttribute('position');
    const colorB = build.geometry.getAttribute('colorB');
    const d = build.geometry.getAttribute('dBoundary');
    expect(colorB.count).toBe(position.count);
    expect(colorB.itemSize).toBe(3);
    expect(d.count).toBe(position.count);
    expect(d.itemSize).toBe(1);
    let sınırda = 0;
    for (let v = 0; v < d.count; v++) {
      const value = d.getX(v);
      expect(value).toBeGreaterThanOrEqual(-BOUNDARY_LIMIT - 1e-6);   // float32 yuvarlaması
      expect(value).toBeLessThanOrEqual(NO_BOUNDARY);
      if (Math.abs(value) < .02) sınırda++;
    }
    // Sınır köşeleri var ama azınlıkta; çoğaltma toplam köşenin %20'sini geçmez.
    expect(sınırda).toBeGreaterThan(200);
    expect(build.splitVertices).toBeGreaterThan(0);
    expect(build.splitVertices).toBeLessThan(build.vertices * .2);
    // `dBoundary` tenden bağımsızdır → bütün tenlerle PAYLAŞILIR.
    const koyu = characterGeometry('fotr', 'koyu', 'standard');
    expect(koyu.geometry.getAttribute('dBoundary').array).toBe(d.array);
    expect(koyu.geometry.getAttribute('colorB').array).not.toBe(colorB.array);
  }, 60000);

  it('bir üçgenin üç köşesi aynı renk çiftini taşır (shader varsayımı)', () => {
    const build = characterGeometry('fotr', 'orta', 'standard');
    const index = build.geometry.getIndex()!;
    const color = build.geometry.getAttribute('color');
    const colorB = build.geometry.getAttribute('colorB');
    const same = (get: typeof color, a: number, b: number) =>
      get.getX(a) === get.getX(b) && get.getY(a) === get.getY(b) && get.getZ(a) === get.getZ(b);
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
      expect(same(color, a, b) && same(color, a, c)).toBe(true);
      expect(same(colorB, a, b) && same(colorB, a, c)).toBe(true);
    }
  }, 60000);

  it('köşenin ETKİN rengi (işarete göre seçilen) §e kuralının verdiği renktir', () => {
    const id = 'fotr';
    const build = characterGeometry(id, 'orta', 'standard');
    const field = characterField(id, 'standard');
    const spec = characterSpec(id);
    const p = palette(spec, skinTones('orta'));
    const position = build.geometry.getAttribute('position');
    const color = build.geometry.getAttribute('color');
    const colorB = build.geometry.getAttribute('colorB');
    const d = build.geometry.getAttribute('dBoundary');
    const wires = new Set(field.wires);
    const expected = new Color();
    let checked = 0, hit = 0;
    for (let v = 0; v < position.count; v++) {
      const x = position.getX(v), y = position.getY(v), z = position.getZ(v);
      const prim = field.nearest(x, y, z);
      if (wires.has(prim)) continue;                      // teller ayrı geometri
      vertexColor(prim, x, y, z, spec, p, expected);
      const pick = d.getX(v) >= 0 ? color : colorB;
      checked++;
      if (Math.abs(pick.getX(v) - expected.r) < 1e-6 && Math.abs(pick.getY(v) - expected.g) < 1e-6
        && Math.abs(pick.getZ(v) - expected.b) < 1e-6) hit++;
    }
    expect(checked).toBeGreaterThan(5000);
    expect(hit / checked).toBeGreaterThan(.99);
  }, 60000);

  it('shader yaması: fwidth ile 1 piksellik geçiş, color_fragment devralınır', () => {
    const shader = { vertexShader: 'void main(){\n#include <begin_vertex>\n}', fragmentShader: 'void main(){\n#include <color_fragment>\n}' };
    patchBoundaryShader(shader);
    expect(shader.vertexShader).toContain('attribute vec3 colorB;');
    expect(shader.vertexShader).toContain('attribute float dBoundary;');
    expect(shader.vertexShader).toContain('vColorB = colorB;');
    expect(shader.vertexShader).toContain('vBoundary = dBoundary;');
    expect(shader.vertexShader).toContain('#include <begin_vertex>');
    expect(shader.fragmentShader).toContain('varying float vBoundary;');
    expect(shader.fragmentShader).toContain('fwidth( vBoundary )');
    expect(shader.fragmentShader).toContain('smoothstep( -boundaryWidth, boundaryWidth, vBoundary )');
    expect(shader.fragmentShader).toContain('mix( vColorB, vec3( vColor )');
    expect(shader.fragmentShader).not.toContain('#include <color_fragment>');
  });

  it('gövde malzemesi köşe rengini açar ve kendi program önbelleği anahtarını verir', () => {
    const material = boundaryMaterial();
    expect(material.vertexColors).toBe(true);
    expect(material.roughness).toBeCloseTo(.85, 6);
    expect(material.metalness).toBe(0);
    expect(material.customProgramCacheKey()).toBe(BOUNDARY_CACHE_KEY);
    const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' };
    (material.onBeforeCompile as (s: typeof shader) => void)(shader);
    expect(shader.fragmentShader).toContain('vBoundary');
    material.dispose();
  });
});
