import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BONES, FINGER, FINGERS, THUMB } from './anatomy';
import { handBounds, handField, palmField, sdEllipsoid, sdRoundBox, sdRoundCone, smin, thumbAxis } from './sdf';
import { boundaryEdges, clusterDecimate, marchField } from './marchingCubes';
import { SKIN, TIERS, handGeometry, tintedHandGeometry } from './geometry';
import { skinTones } from '../characters/spec';
import { BIND_POSE, CARD_FRAMES, CONTACTS, LIMITS, POSES, clampBone, mixPose } from './poses';
import { boneDefs, boneSegments, buildSkeleton, forwardKinematics, skinWeights } from './skeleton';
import { resolveContact, sampleContacts, worstGap } from './contact';
import { handFromCard, mirrorFrame } from '../prototype/grip';
import type { GripName } from './poses';

describe('D1 SDF ilkelleri', () => {
  it('yuvarlatılmış kutu, elipsoid ve kapsül işaretli uzaklığı doğru verir', () => {
    // Kutu: merkez 0, yarı boyut 0.1, köşe yarıçapı 0.02 → yüzey ±0.1'de.
    expect(sdRoundBox(0, 0, 0, 0, 0, 0, .1, .1, .1, .02)).toBeCloseTo(-.1, 6);
    expect(sdRoundBox(.1, 0, 0, 0, 0, 0, .1, .1, .1, .02)).toBeCloseTo(0, 6);
    expect(sdRoundBox(.15, 0, 0, 0, 0, 0, .1, .1, .1, .02)).toBeCloseTo(.05, 6);
    // Küre ile aynı: elipsoidin eşit yarıçaplısı.
    expect(sdEllipsoid(.03, 0, 0, 0, 0, 0, .02, .02, .02)).toBeCloseTo(.01, 6);
    expect(sdEllipsoid(0, 0, 0, 0, 0, 0, .02, .02, .02)).toBeCloseTo(-.02, 6);
    // Kapsül: eksen (0,0,0)→(0,0,-.1), sabit yarıçap .01.
    expect(sdRoundCone(0, .01, -.05, 0, 0, 0, 0, 0, -.1, .01, .01)).toBeCloseTo(0, 6);
    expect(sdRoundCone(0, 0, .02, 0, 0, 0, 0, 0, -.1, .01, .01)).toBeCloseTo(.01, 6);
    // Yarıçap doğrusal değişir: uçta .005.
    expect(sdRoundCone(0, .005, -.1, 0, 0, 0, 0, 0, -.1, .01, .005)).toBeCloseTo(0, 3);
  });
  it('smooth-min uzakta sert min, yakında k/4 kadar yumuşatır', () => {
    expect(smin(.1, .5, .01)).toBeCloseTo(.1, 9);
    expect(smin(0, 0, .02)).toBeCloseTo(-.005, 9);
    expect(smin(3, 7, 0)).toBe(3);
  });
  it('şablon el alanı beklenen noktalarda iç/dış işareti verir', () => {
    expect(handField(0, 0, -.05)).toBeLessThan(0);          // avuç merkezi
    expect(palmField(0, 0, -.05)).toBeLessThan(0);
    for (const finger of FINGERS) {
      const f = FINGER[finger];
      const z = f.mcp[2] - f.lengths[0] / 2;
      expect(handField(f.mcp[0], f.mcp[1], z)).toBeLessThan(0);  // falanks içi
      expect(handField(f.mcp[0], f.mcp[1] + .03, z)).toBeGreaterThan(0); // 3 cm üstü boş
    }
    const axis = thumbAxis();
    const tip = THUMB.cmc.map((v, i) => v + axis[i]! * .11);
    expect(handField(tip[0]!, tip[1]!, tip[2]!)).toBeLessThan(.004);
    expect(handField(-.30, 0, 0)).toBeGreaterThan(.1);
  });
  it('D1 tur 5 — komşu parmaklar arasında perde YOK (bind pozunda boşluk açık)', () => {
    // Falanks ortasında iki komşu parmağın TAM ORTASI dışarıda olmalı.
    const pairs: [typeof FINGERS[number], typeof FINGERS[number]][] = [['index', 'middle'], ['middle', 'ring'], ['ring', 'pinky']];
    for (const [a, b] of pairs) {
      const fa = FINGER[a], fb = FINGER[b];
      const x = (fa.mcp[0] + fb.mcp[0]) / 2;
      for (const t of [.5, .8, 1.2]) {
        const z = (fa.mcp[2] + fb.mcp[2]) / 2 - fa.lengths[0] * t;
        expect(handField(x, 0, z)).toBeGreaterThan(0);
      }
      // Boğum çizgisinin hemen ötesinde de açık (eski avuç dilimi burayı dolduruyordu).
      expect(handField(x, 0, (fa.mcp[2] + fb.mcp[2]) / 2 - .010)).toBeGreaterThan(0);
    }
    // Parmakların KENDİSİ hâlâ dolu.
    for (const finger of FINGERS) {
      const f = FINGER[finger];
      expect(handField(f.mcp[0], f.mcp[1], f.mcp[2] - f.lengths[0] * .5)).toBeLessThan(0);
    }
  });
  it('D1 tur 6 — pozlarda da komşu parmak yüzeyleri ayrık (kaynama yok)', () => {
    // Kapsül eksenleri poza taşınır; komşu parmakların falanks yüzeyleri
    // arasındaki en küçük boşluk ölçülür. Bind'de her yerde açık; pozlarda
    // (bükülme yan yana getirebilir) en az bir örnek noktada açık kalmalı.
    const SEG = boneSegments();
    const pairs: [string, string][] = [['index', 'middle'], ['middle', 'ring'], ['ring', 'pinky']];
    const chainIndex = (finger: string) => [1, 2, 3].map((i) => BONES.indexOf(`${finger}.${['mcp', 'pip', 'dip'][i - 1]}` as never));
    const pointAt = (m: Matrix4[], bone: number, t: number) => {
      const s = SEG[bone]!;
      const length = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
      return { p: new Vector3(0, 0, -length * t).applyMatrix4(m[bone]!), r: s.ra + (s.rb - s.ra) * t };
    };
    for (const [name, pose] of [['bind', BIND_POSE], ['rest', POSES.rest], ['holdFan3', POSES.holdFan3],
      ['holdGun', POSES.holdGun], ['openPalm', POSES.openPalm]] as const) {
      const m = forwardKinematics(pose);
      for (const [a, b] of pairs) {
        const ba = chainIndex(a), bb = chainIndex(b);
        let bestGap = -Infinity;
        for (let i = 0; i < 3; i++) for (const t of [.25, .5, .75, 1]) {
          const pa = pointAt(m, ba[i]!, t), pb = pointAt(m, bb[i]!, t);
          bestGap = Math.max(bestGap, pa.p.distanceTo(pb.p) - pa.r - pb.r);
        }
        expect(bestGap, `${name} ${a}/${b}`).toBeGreaterThan(0);
      }
    }
  });
  it('D1 tur 5 — skin ağırlığı komşu parmağa sızmaz', () => {
    // İki parmak arasındaki iç duvara yakın noktalar: ikinci kemik ya aynı
    // zincirden ya da avuçtan (`wrist`, 0) olmalı.
    const samples: number[] = [];
    for (const finger of FINGERS) {
      const f = FINGER[finger];
      const side = f.mcp[0] < 0 ? 1 : -1;
      for (const t of [.3, .6, .9]) {
        samples.push(f.mcp[0] + side * f.radii[0] * .95, f.mcp[1], f.mcp[2] - f.lengths[0] * t);
      }
    }
    const { index, weight } = skinWeights(Float32Array.from(samples));
    for (let v = 0; v < samples.length / 3; v++) {
      const i0 = index[v * 4]!, i1 = index[v * 4 + 1]!;
      const chain = (i: number) => BONES[i]!.split('.')[0];
      if (weight[v * 4 + 1]! > 0) {
        expect([chain(i0), 'wrist']).toContain(chain(i1));
      }
      expect(weight[v * 4]! + weight[v * 4 + 1]!).toBeCloseTo(1, 6);
    }
  });
  it('parmaklar arasında eklem boşluğu bırakmaz (falanks birleşimleri dolu)', () => {
    // Eski modelde eklem kürelerinin arası boştu; kapsül birleşimi k=0.008 ile kaynar.
    for (const finger of FINGERS) {
      const f = FINGER[finger];
      for (const z of [f.mcp[2] - f.lengths[0], f.mcp[2] - f.lengths[0] - f.lengths[1]]) {
        expect(handField(f.mcp[0], f.mcp[1], z)).toBeLessThan(-.005);
      }
    }
  });
});

describe('D3.4 — ilk şahıs eli ten tonu', () => {
  const average = (geometry: { getAttribute: (n: string) => { array: ArrayLike<number> } }) => {
    const a = geometry.getAttribute('color').array;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < a.length; i += 3) { r += a[i]!; g += a[i + 1]!; b += a[i + 2]!; }
    const n = a.length / 3;
    return [r / n, g / n, b / n] as const;
  };
  it('iki farklı ten farklı köşe rengi ortalaması verir; konum/skin öznitelikleri paylaşılır', () => {
    const light = tintedHandGeometry('low', skinTones('acik').base);
    const dark = tintedHandGeometry('low', skinTones('koyu').base);
    const [lr, lg, lb] = average(light), [dr, dg, db] = average(dark);
    expect(Math.abs(lr - dr) + Math.abs(lg - dg) + Math.abs(lb - db)).toBeGreaterThan(.02);
    // Açık ten koyudan parlaktır.
    expect(lr + lg + lb).toBeGreaterThan(dr + dg + db);
    // Aynı ten iki kez istenince aynı nesne (kademe × ten başına tek üretim).
    expect(tintedHandGeometry('low', skinTones('acik').base)).toBe(light);
    // Pahalı öznitelikler paylaşılır, yalnız renk kopyalanır.
    const base = handGeometry('low').geometry;
    for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) {
      expect(light.getAttribute(name)).toBe(base.getAttribute(name));
    }
    expect(light.getAttribute('color')).not.toBe(base.getAttribute('color'));
    expect(light.getIndex()).toBe(base.getIndex());
    // Üretim paleti istenirse üretim geometrisi doğrudan döner.
    expect(tintedHandGeometry('low', SKIN.base)).toBe(base);
  });
});

describe('D1 marching cubes', () => {
  const bounds = handBounds(.010);
  it('kapalı yüzey üretir: her kenar tam iki üçgene ait', () => {
    const mesh = marchField(handField, bounds.min, bounds.max, TIERS.standard.voxel);
    expect(boundaryEdges(mesh.indices)).toBe(0);
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.positions.length / 3).toBeGreaterThan(1000);
  });
  it('kalite kademeleri üçgen bütçesine uyar (standard ≤ 5k)', () => {
    const standard = handGeometry('standard');
    expect(standard.triangles).toBeLessThanOrEqual(5000);
    expect(standard.triangles).toBeGreaterThan(2500);
    const low = handGeometry('low');
    expect(low.triangles).toBeLessThan(standard.triangles);
    expect(low.triangles).toBeLessThanOrEqual(2500);
    const distant = handGeometry('distant');
    expect(distant.triangles).toBeLessThanOrEqual(1000);
  });
  it('köşe kümeleme üçgen sayısını düşürür ve normalleri birimde tutar', () => {
    const mesh = marchField(handField, bounds.min, bounds.max, TIERS.low.voxel);
    const small = clusterDecimate(mesh, TIERS.low.cluster);
    expect(small.indices.length).toBeLessThan(mesh.indices.length / 2);
    for (let v = 0; v < small.positions.length / 3; v += 37) {
      expect(Math.hypot(small.normals[v * 3]!, small.normals[v * 3 + 1]!, small.normals[v * 3 + 2]!)).toBeCloseTo(1, 5);
    }
  });
});

describe('D1 iskelet ve skin ağırlıkları', () => {
  it('16 kemik poses.json sırasında ve bind zinciri doğru yerde', () => {
    const defs = boneDefs();
    expect(defs.map((d) => d.name)).toEqual([...BONES]);
    expect(defs).toHaveLength(16);
    const world = forwardKinematics(BIND_POSE);
    // index.dip bind pozunda MCP'den prox+mid kadar −Z'de olmalı.
    const f = FINGER.index;
    const dip = new Vector3().setFromMatrixPosition(world[6]!);
    expect(dip.x).toBeCloseTo(f.mcp[0], 9);
    expect(dip.z).toBeCloseTo(f.mcp[2] - f.lengths[0] - f.lengths[1], 9);
    // Baş parmak taban çerçevesi §c'deki yönü verir.
    const axis = thumbAxis();
    expect(axis[0]).toBeCloseTo(-.659, 3); expect(axis[1]).toBeCloseTo(-.300, 3); expect(axis[2]).toBeCloseTo(-.689, 3);
  });
  it('her köşe en çok 2 kemik, ağırlık toplamı 1', () => {
    const { geometry } = handGeometry('low');
    const position = geometry.getAttribute('position');
    const skin = skinWeights(position.array as Float32Array);
    const count = position.count;
    for (let v = 0; v < count; v++) {
      const w = [0, 1, 2, 3].map((i) => skin.weight[v * 4 + i]!);
      expect(w[0]! + w[1]! + w[2]! + w[3]!).toBeCloseTo(1, 5);
      expect(w[2]).toBe(0); expect(w[3]).toBe(0);
      for (const i of [0, 1]) expect(skin.index[v * 4 + i]!).toBeLessThan(BONES.length);
      expect(w[0]).toBeGreaterThanOrEqual(w[1]!);
    }
  });
  it('iskelet ayrık bind pozunda kurulur (boneInverses şablon uzayında)', () => {
    const rig = buildSkeleton();
    expect(rig.bones).toHaveLength(16);
    const inverse = rig.skeleton.boneInverses[4]!;
    const back = new Vector3().setFromMatrixPosition(new Matrix4().copy(inverse).invert());
    expect(back.x).toBeCloseTo(FINGER.index.mcp[0], 9);
    expect(back.z).toBeCloseTo(FINGER.index.mcp[2], 9);
  });
});

describe('D1 poz sınırları', () => {
  it('bütün pozlar §c sınırları içinde', () => {
    for (const name of Object.keys(POSES) as GripName[]) {
      const pose = POSES[name];
      for (const finger of FINGERS) {
        expect(pose[`${finger}.mcp`]![0]!).toBeGreaterThanOrEqual(LIMITS.mcpFlex[0]);
        expect(pose[`${finger}.mcp`]![0]!).toBeLessThanOrEqual(LIMITS.mcpFlex[1]);
        expect(Math.abs(pose[`${finger}.mcp`]![1]!)).toBeLessThanOrEqual(LIMITS.mcpAbd[1]);
        expect(pose[`${finger}.pip`]![0]!).toBeLessThanOrEqual(LIMITS.pipFlex[1]);
        expect(pose[`${finger}.dip`]![0]!).toBeLessThanOrEqual(LIMITS.dipFlex[1]);
      }
      expect(pose['thumb.mcp']![0]!).toBeLessThanOrEqual(LIMITS.thumbMcp[1]);
      expect(pose['thumb.ip']![0]!).toBeLessThanOrEqual(LIMITS.thumbIp[1]);
    }
  });
  it('sınır dışı girdi kırpılır ve karışım uçlarda pozun kendisini verir', () => {
    expect(clampBone('index.mcp', [9, -9])).toEqual([LIMITS.mcpFlex[1], LIMITS.mcpAbd[0]]);
    expect(clampBone('index.pip', [Number.NaN])).toEqual([0]);
    expect(mixPose(POSES.rest, POSES.holdFan3, 0)).toEqual(POSES.rest);
    expect(mixPose(POSES.rest, POSES.holdFan3, 1)['index.pip']![0]).toBeCloseTo(POSES.holdFan3['index.pip']![0]!, 12);
    const half = mixPose(POSES.rest, POSES.holdFan3, .5);
    expect(half['middle.pip']![0]).toBeCloseTo((POSES.rest['middle.pip']![0]! + POSES.holdFan3['middle.pip']![0]!) / 2, 12);
  });
});

describe('D1 kart–el teması (§e)', () => {
  it.each(['holdFan3', 'holdFan2', 'holdFan1'] as const)('%s: parmaklar karta değer, hiçbir örnek kartı kesmez', (grip) => {
    const frame = CARD_FRAMES[grip]!;
    const resolved = resolveContact(POSES[grip], frame);
    expect(resolved.penetrations).toBe(0);
    const samples = sampleContacts(resolved.pose, frame);
    expect(worstGap(samples)).toBeGreaterThanOrEqual(0);
    // Dört parmak da kart sınırı içinde ve yüzeye 12 mm'den yakın (temas bandı).
    for (const finger of FINGERS) {
      const inside = samples.filter((s) => s.chain === finger && s.inside);
      expect(inside.length).toBeGreaterThan(0);
      expect(worstGap(samples, finger)).toBeLessThan(.012);
    }
    // Şartname §e tablosu aynı pozu 0–2 mm boşlukla ölçmüştü.
    for (const value of Object.values(CONTACTS[grip]!)) expect(value.skinGap_mm).toBeLessThanOrEqual(2);
  });
  it('tutuş çözümü kesişen bir pozu açarak düzeltir', () => {
    const frame = CARD_FRAMES.holdFan3!;
    const tight: Record<string, readonly number[]> = { ...POSES.holdFan3 };
    for (const finger of FINGERS) { tight[`${finger}.mcp`] = [1.2, 0]; tight[`${finger}.pip`] = [1.2]; tight[`${finger}.dip`] = [.84]; }
    const before = worstGap(sampleContacts(tight as never, frame));
    expect(before).toBeLessThan(0);
    const after = resolveContact(tight as never, frame);
    expect(after.relieved).toBeGreaterThan(0);
    expect(worstGap(sampleContacts(after.pose, frame))).toBeGreaterThan(before);
  });
  it('falanks başına 8 örnek, 15 falanks', () => {
    expect(sampleContacts(POSES.rest, CARD_FRAMES.holdFan3!)).toHaveLength(15 * 8);
    expect(boneSegments().filter(Boolean)).toHaveLength(15);
  });
});

describe('D1 handFromCard ters dönüşümü', () => {
  const cards = [
    { position: [0, .29, 1.22] as const, rotation: [1.18, 0, 0] as const },
    { position: [.7, .039, .94] as const, rotation: [0, -.12, 0] as const },
    { position: [-.2, .35, 1.05] as const, rotation: [.4, .9, -.3] as const },
  ];
  it.each(['holdFan3', 'pinchCard', 'holdBallot', 'holdEnvelope'] as const)('%s: el çerçevesi kartı tam olarak geri verir', (grip) => {
    for (const side of [-1, 1] as const) {
      for (const card of cards) {
        const hand = handFromCard(card, side, grip);
        const frame = mirrorFrame(CARD_FRAMES[grip]!, side);
        // Kart = el dönüşümü ∘ çerçeve.
        const handMatrix = new Matrix4().compose(
          new Vector3(...hand.position),
          new Quaternion().setFromEuler(new Euler(hand.rotation[0], hand.rotation[1], hand.rotation[2], 'XYZ')),
          new Vector3(1, 1, 1));
        const frameMatrix = new Matrix4().compose(
          new Vector3(frame.C[0], frame.C[1], frame.C[2]),
          new Quaternion().setFromEuler(new Euler(frame.euler[0], frame.euler[1], frame.euler[2], 'XYZ')),
          new Vector3(1, 1, 1));
        const back = handMatrix.multiply(frameMatrix);
        const position = new Vector3().setFromMatrixPosition(back);
        const rotation = new Quaternion().setFromRotationMatrix(back);
        const expected = new Quaternion().setFromEuler(new Euler(card.rotation[0], card.rotation[1], card.rotation[2], 'XYZ'));
        card.position.forEach((v, i) => expect(position.getComponent(i)).toBeCloseTo(v, 10));
        expect(Math.min(rotation.angleTo(expected), Math.abs(Math.PI * 2 - rotation.angleTo(expected)))).toBeLessThan(1e-6);
      }
    }
  });
  it('şartname §e dünya örneği: sol el heldFan → (−0.047, 0.093, 1.315)', () => {
    const hand = handFromCard({ position: [0, .29, 1.22], rotation: [1.18, 0, 0] }, -1, 'holdFan3');
    // Şartname mm hassasiyetiyle yuvarlanmış; 1 mm tolerans.
    [-.047, .093, 1.315].forEach((v, i) => expect(Math.abs(hand.position[i]! - v)).toBeLessThan(.001));
    expect(hand.rotation[0]).toBeCloseTo(.68, 3);
    expect(Math.abs(hand.rotation[2])).toBeCloseTo(Math.PI, 2);
  });
});
