/**
 * D16 — jest katmanı (saf). `docs/design/D16-emotes.md` §2/§5.
 */
import { describe, expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import { EMOTE_DURATION_MS, EMOTE_KINDS, EMOTE_LABEL, EMOTE_SYMBOL } from '@secret-table/contracts';
import {
  EMOTE_CARDS_ASIDE_MS,
  EMOTE_POINT_PITCH,
  EMOTE_POINT_PIVOT,
  EMOTE_TWO_HANDED,
  EMOTE_TWO_HAND_YAW,
  EmoteRegistry,
  emoteAllowed,
  emoteArmFrame,
  emoteFrame,
  emoteWeight,
} from './EmoteOverlay';
import { GRIPS, LIMITS, POSES, clampPose } from '../hands/poses';
import { BONES } from '../hands/anatomy';

describe('D16 §2 — jest tablosu', () => {
  it('sekiz jest, süreler ve semboller eksiksiz', () => {
    expect(EMOTE_KINDS).toHaveLength(8);
    for (const kind of EMOTE_KINDS) {
      expect(EMOTE_DURATION_MS[kind]).toBeGreaterThanOrEqual(2000);
      expect(EMOTE_DURATION_MS[kind]).toBeLessThanOrEqual(3000);
      expect(EMOTE_SYMBOL[kind]).toBeTruthy();
      expect(EMOTE_LABEL[kind]).toBeTruthy();
    }
    expect([...EMOTE_TWO_HANDED]).toEqual(['hands_up', 'clap']);
  });

  it('dört yeni kavrama sınırların içinde (poses.json)', () => {
    for (const grip of ['point', 'openPalm', 'thumbUp', 'middleFinger'] as const) {
      expect(GRIPS).toContain(grip);
      const pose = POSES[grip];
      // `clampPose` kırpmadıysa JSON değerleri zaten sınırın içindedir.
      expect(clampPose(pose)).toEqual(pose);
      for (const bone of BONES) {
        const values = pose[bone]!;
        if (bone === 'wrist') { expect(values).toEqual([0, 0, 0]); continue; }
        if (bone.endsWith('.pip')) expect(values[0]!).toBeLessThanOrEqual(LIMITS.pipFlex[1]);
        if (bone.endsWith('.dip')) expect(values[0]!).toBeLessThanOrEqual(LIMITS.dipFlex[1]);
        if (bone.endsWith('.mcp') && !bone.startsWith('thumb')) {
          expect(values[0]!).toBeLessThanOrEqual(LIMITS.mcpFlex[1]);
          expect(Math.abs(values[1] ?? 0)).toBeLessThanOrEqual(LIMITS.mcpAbd[1]);
        }
      }
    }
    // İşaret parmağı `point`te AÇIK, yumrukta değil; `middleFinger`de tersi.
    expect(POSES.point['index.pip']![0]!).toBeLessThan(.2);
    expect(POSES.point['middle.pip']![0]!).toBeGreaterThan(1);
    expect(POSES.middleFinger['middle.pip']![0]!).toBeLessThan(.2);
    expect(POSES.middleFinger['index.pip']![0]!).toBeGreaterThan(1);
    // `thumbUp` yumruk + uzatılmış baş parmak.
    expect(POSES.thumbUp['thumb.ip']![0]!).toBe(0);
    expect(POSES.thumbUp['ring.pip']![0]!).toBeGreaterThan(1);
  });
});

describe('D16 §5 — ilk şahıs jest karesi', () => {
  it('süre dolunca katman düşer (boşta ek çizim yok)', () => {
    expect(emoteFrame('wave', 0, false)).not.toBeNull();
    expect(emoteFrame('wave', EMOTE_DURATION_MS.wave - 1, false)).not.toBeNull();
    expect(emoteFrame('wave', EMOTE_DURATION_MS.wave, false)).toBeNull();
    expect(emoteFrame('wave', -5, false)).toBeNull();
    expect(emoteWeight('wave', EMOTE_DURATION_MS.wave + 10, false)).toBe(0);
    // Azaltılmış harekette poz ANINDA tam ağırlıkta.
    expect(emoteWeight('point', 1, true)).toBe(1);
    expect(emoteWeight('point', 1, false)).toBeLessThan(.2);
  });

  it("`point` yerel bakış yaw'ını izler, pitch ±20° kırpılır", () => {
    const straight = emoteFrame('point', 1500, false, { yaw: 0, pitch: 0 })!;
    const turned = emoteFrame('point', 1500, false, { yaw: .8, pitch: 0 })!;
    // İlk şahısta el, okunabilirlik için bakışın sabit bir açı sağında durur;
    // fark bakış yaw'ı kadar döner (parmak bakışı izler).
    expect(turned.right.rotation[1]! - straight.right.rotation[1]!).toBeCloseTo(.8, 5);
    // Kol omuzdan döner: yaw > 0 SOLA bakıştır (kamera −X'e döner), el de sola kayar.
    expect(turned.right.position[0]).toBeLessThan(straight.right.position[0]!);
    // El her iki durumda da gözün önünde (z < göz 2,035) ve kol boyu içinde kalır.
    expect(turned.right.position[2]).toBeLessThan(1.9);
    expect(Math.abs(turned.right.position[2]! - straight.right.position[2]!)).toBeLessThan(.15);
    expect(turned.right.grip).toBe('point');
    // Pitch ±20° ile kırpılır: 1,2 rad istek sınırdaki kareyle AYNI.
    const steep = emoteFrame('point', 1500, false, { yaw: 0, pitch: 1.2 })!;
    const limit = emoteFrame('point', 1500, false, { yaw: 0, pitch: EMOTE_POINT_PITCH })!;
    expect(steep.right.rotation[0]).toBeCloseTo(limit.right.rotation[0]!, 6);
    expect(steep.right.rotation[0]! - straight.right.rotation[0]!).toBeCloseTo(EMOTE_POINT_PITCH * .6, 6);
  });

  it("iki elli jest kartları 250 ms'de masaya yaslar; tek elli jest kartlara dokunmaz", () => {
    expect(emoteFrame('hands_up', 0, false)!.cardsAside).toBeCloseTo(0, 3);
    expect(emoteFrame('hands_up', EMOTE_CARDS_ASIDE_MS, false)!.cardsAside).toBe(1);
    expect(emoteFrame('hands_up', 1000, false)!.left).not.toBeNull();
    expect(emoteFrame('clap', 1000, false)!.left).not.toBeNull();
    expect(emoteFrame('hands_up', 1000, false)!.cardsVisible).toBe(false);
    const single = emoteFrame('thumbs_up', 1000, false)!;
    expect(single.left).toBeNull();
    expect(single.cardsAside).toBe(0);
    expect(single.cardsVisible).toBe(true);
    // Azaltılmış hareket: yaslama anında tamam.
    expect(emoteFrame('clap', 0, true)!.cardsAside).toBe(1);
  });

  it('silah hazır pozunda / infazda jest reddedilir', () => {
    expect(emoteAllowed('rest', null)).toBe(true);
    expect(emoteAllowed('hold', null)).toBe(true);
    expect(emoteAllowed('ready', null)).toBe(false);
    expect(emoteAllowed('aim', null)).toBe(false);
    expect(emoteAllowed('rest', { kind: 'shoot' })).toBe(false);
    expect(emoteAllowed('rest', { kind: 'draw' })).toBe(true);
  });

  it('tur 2 salınımları yalnız hareket açıkken oynar', () => {
    const waveA = emoteFrame('wave', 300, false)!.right.rotation[1]!;
    const waveB = emoteFrame('wave', 560, false)!.right.rotation[1]!;
    expect(waveA).not.toBeCloseTo(waveB, 3);
    expect(Math.abs(waveA)).toBeLessThanOrEqual(25 * Math.PI / 180 + 1e-6);
    expect(emoteFrame('wave', 300, true)!.right.rotation[1]).toBe(0);
    // Alkış: eller birbirine yaklaşır (en az 2 cm kalır).
    const gaps = [0, 150, 310, 470, 620].map((t) => emoteFrame('clap', t, false)!.right.position[0]!);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(.01);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(.05);
    expect(emoteFrame('clap', 300, true)!.right.position[0]).toBe(emoteFrame('clap', 600, true)!.right.position[0]);
    // Yüz avuçlama: baş öne eğilir (yalnız bu jestte).
    expect(emoteFrame('facepalm', 800, false)!.headPitch).toBeLessThan(0);
    expect(emoteFrame('thumbs_up', 800, false)!.headPitch).toBe(0);
  });
});

describe('D16 §5 — kamu kolu', () => {
  it('her jest için kavrama ve el sayısı doğrudur, süre sonunda kare yok', () => {
    for (const kind of EMOTE_KINDS) {
      const frame = emoteArmFrame(kind, 500, false)!;
      expect(frame.grip).toMatch(/point|openPalm|thumbUp|middleFinger/);
      expect(Boolean(frame.left)).toBe(EMOTE_TWO_HANDED.has(kind));
      expect(emoteArmFrame(kind, EMOTE_DURATION_MS[kind], false)).toBeNull();
      // Bilek masanın üstünde ve kol uzunluğu içinde kalır.
      expect(frame.right.wrist[1]).toBeGreaterThan(0);
      const reach = Math.hypot(frame.right.wrist[0] - .215, frame.right.wrist[1] - .24, frame.right.wrist[2]);
      expect(reach).toBeLessThanOrEqual(.40);
    }
  });
  it("`point` kamu kolu paylaşılan yaw'a nişan alır, pitch ±20° kırpılır", () => {
    const a = emoteArmFrame('point', 800, false, { yaw: -.7, pitch: .9 })!;
    const b = emoteArmFrame('point', 800, false, { yaw: .7, pitch: 0 })!;
    const straight = emoteArmFrame('point', 800, false)!;
    // yaw > 0 → kamera −X'e döner; bilek de o yana gider.
    expect(b.right.wrist[0]).toBeLessThan(straight.right.wrist[0]);
    expect(a.right.wrist[0]).toBeGreaterThan(straight.right.wrist[0]);
    // pitch kırpması: 0,9 rad istek ±20° ile sınırlı kalır.
    const high = Math.atan2(a.right.wrist[1] - .24, Math.hypot(a.right.wrist[0] - .215, a.right.wrist[2]));
    expect(high).toBeLessThanOrEqual(EMOTE_POINT_PITCH + .35);
    // Omuz/dirsek kemikleri de dönmüştür (kopuk el yok).
    expect(Math.abs(a.right.shoulder[0]) + Math.abs(a.right.shoulder[1])).toBeGreaterThan(.1);
    expect(a.right.elbow[0]).toBeGreaterThanOrEqual(0);
  });
});

describe('D16 tur 3 — bütün jestler bakış yönünü izler', () => {
  // Bakış ekseni: yaw > 0 kamerayı −X'e çevirir (ileri −Z).
  const forward = (yaw: number) => [-Math.sin(yaw), 0, -Math.cos(yaw)] as const;
  const sideways = (yaw: number) => [Math.cos(yaw), 0, -Math.sin(yaw)] as const;
  const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const rel = (p: readonly number[], pivot: readonly number[]) => [p[0]! - pivot[0]!, p[1]! - pivot[1]!, p[2]! - pivot[2]!];
  const len = (v: readonly number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);
  /** Elin dünya dönüşünün baktığı yön (avuç normali yerine parmak ekseni). */
  const facing = (rotation: readonly number[]) =>
    new Vector3(0, 0, -1).applyQuaternion(new Quaternion().setFromEuler(
      new Euler(rotation[0]!, rotation[1]!, rotation[2]!, 'XYZ')));

  /** Tur 1/2 çıktısı (yaw = 0, salınımsız): değişmemesi gereken çıpa. */
  const REST: Record<string, { position: readonly number[]; rotation: readonly number[] }> = {
    point: { position: [.22, .44, 1.46], rotation: [.26, .52, -.30] },
    hands_up: { position: [.27, .50, 1.42], rotation: [Math.PI / 2 - .22, .14, 0] },
    thumbs_up: { position: [.26, .34, 1.44], rotation: [.10, .22, -Math.PI / 2] },
    thumbs_down: { position: [.26, .34, 1.44], rotation: [-.10, .22, Math.PI / 2] },
    middle: { position: [.20, .31, 1.46], rotation: [Math.PI / 2, 0, Math.PI] },
    wave: { position: [.27, .47, 1.44], rotation: [Math.PI / 2 - .15, 0, 0] },
    clap: { position: [.13, .40, 1.48], rotation: [.20, 0, -Math.PI / 2] },
    facepalm: { position: [.06, .44, 1.52], rotation: [-1.85, -.10, .18] },
  };

  it('yaw = 0 tur 1/2 karesini bire bir korur (ilk şahıs ve kamu)', () => {
    for (const kind of EMOTE_KINDS) {
      const frame = emoteFrame(kind, 800, true, { yaw: 0, pitch: 0 })!;
      const anchor = REST[kind]!;
      for (let i = 0; i < 3; i += 1) {
        expect(frame.right.position[i]).toBeCloseTo(anchor.position[i]!, 9);
        expect(frame.right.rotation[i]).toBeCloseTo(anchor.rotation[i]!, 9);
      }
      // Bakış verilmemesi ile yaw = 0 aynı kare; `pitch` yalnız `point`i etkiler.
      expect(emoteFrame(kind, 800, false, { yaw: 0, pitch: 0 })).toEqual(emoteFrame(kind, 800, false));
      if (kind !== 'point') {
        expect(emoteFrame(kind, 800, false, { yaw: 0, pitch: .9 })).toEqual(emoteFrame(kind, 800, false));
        expect(emoteArmFrame(kind, 800, false, { yaw: 0, pitch: .9 })).toEqual(emoteArmFrame(kind, 800, false));
      }
      expect(emoteArmFrame(kind, 800, false, { yaw: 0, pitch: 0 })).toEqual(emoteArmFrame(kind, 800, false));
    }
  });

  it('`point` tur 2 formülünden sapmaz (regresyon)', () => {
    for (const yaw of [-1.2, -.4, 0, .8, 1.2]) {
      for (const pitch of [-1.1, 0, .15, 1.1]) {
        const clamped = Math.max(-EMOTE_POINT_PITCH, Math.min(EMOTE_POINT_PITCH, pitch));
        const frame = emoteFrame('point', 1500, false, { yaw, pitch })!;
        const cos = Math.cos(yaw), sin = Math.sin(yaw);
        expect(frame.right.position[0]).toBeCloseTo(.22 * cos + -.50 * sin, 9);
        expect(frame.right.position[1]).toBeCloseTo(.36 + .08, 9);
        expect(frame.right.position[2]).toBeCloseTo(1.96 - .22 * sin + -.50 * cos, 9);
        expect(frame.right.rotation[0]).toBeCloseTo(.26 + clamped * .6, 9);
        expect(frame.right.rotation[1]).toBeCloseTo(yaw + .52, 9);
        expect(frame.right.rotation[2]).toBeCloseTo(-.30, 9);
        // Kamu kolu: hedef omuzdan .40 uzakta, paylaşılan yaw/pitch ile.
        const arm = emoteArmFrame('point', 800, false, { yaw, pitch })!;
        const reach = Math.hypot(arm.right.wrist[0] - .215, arm.right.wrist[1] - (.545 - .305), arm.right.wrist[2]);
        expect(reach).toBeGreaterThan(.2);
      }
    }
  });

  it('ilk şahıs: her jest göz ekseni etrafında KATI döner (kadrajda kalır)', () => {
    for (const yaw of [-1.2, 1.2]) {
      for (const kind of EMOTE_KINDS) {
        const base = emoteFrame(kind, 800, true)!;
        const turned = emoteFrame(kind, 800, true, { yaw, pitch: 0 })!;
        const hands = [[base.right, turned.right], ...(base.left ? [[base.left, turned.left!]] : [])] as const;
        for (const [from, to] of hands) {
          const a = rel(from.position, EMOTE_POINT_PIVOT), b = rel(to.position, EMOTE_POINT_PIVOT);
          // Kol boyu korunur (esneme yok), el bakışın ÖNÜNDE kalır.
          expect(len(b)).toBeCloseTo(len(a), 9);
          expect(dot(b, forward(yaw))).toBeGreaterThan(0);
          // Bakış çerçevesindeki bileşenler aynı: el kadrajda yerinde durur.
          expect(dot(b, forward(yaw))).toBeCloseTo(dot(a, forward(0)), 9);
          expect(dot(b, sideways(yaw))).toBeCloseTo(dot(a, sideways(0)), 9);
          expect(to.position[1]).toBeCloseTo(from.position[1]!, 9);
          // Dönüş de yaw kadar döndü: elin baktığı yön bakışla birlikte gitti.
          // (`point` hariç: onun kendi okunabilirlik kaydırması var, tur 2.)
          if (kind !== 'point') {
            const want = facing(from.rotation).applyAxisAngle(new Vector3(0, 1, 0), yaw);
            expect(facing(to.rotation).angleTo(want)).toBeLessThan(1e-6);
          }
          expect(to.grip).toBe(from.grip);
        }
      }
    }
  });

  it('ilk şahıs: iki elli jestlerde sağ/sol simetri bozulmaz', () => {
    for (const kind of ['hands_up', 'clap'] as const) {
      const base = emoteFrame(kind, 900, true)!;
      const turned = emoteFrame(kind, 900, true, { yaw: 1.2, pitch: 0 })!;
      const gap = (frame: typeof base) => len(rel(frame.right.position, frame.left!.position));
      expect(gap(turned)).toBeCloseTo(gap(base), 9);
      // Çift, bakış ekseninin iki yanında eşit uzaklıkta kalır.
      const side = (p: readonly number[]) => dot(rel(p, EMOTE_POINT_PIVOT), sideways(1.2));
      expect(side(turned.right.position)).toBeCloseTo(-side(turned.left!.position), 9);
    }
  });

  it('kamu: her jestin kolu paylaşılan yaw ile döner, iki elli jest ±60° kırpılır', () => {
    const SHOULDER: readonly number[] = [.215, .545 - .305, 0];
    for (const kind of EMOTE_KINDS) {
      const base = emoteArmFrame(kind, 900, true)!;
      const left = emoteArmFrame(kind, 900, true, { yaw: 1.2, pitch: 0 })!;
      const right = emoteArmFrame(kind, 900, true, { yaw: -1.2, pitch: 0 })!;
      // Kol uzunluğu korunur: bilek omuzdan ≤ 40 cm (esneme yok).
      expect(len(rel(left.right.wrist, SHOULDER))).toBeLessThanOrEqual(.40);
      expect(len(rel(right.right.wrist, SHOULDER))).toBeLessThanOrEqual(.40);
      expect(left.right.wrist[1]).toBeGreaterThan(0);
      if (left.left) {
        // İki elli jest: ÇİFT gövde ekseninde döner (omuzlar sabit olduğu için
        // yaw ±60°'ye kırpılır). Orta nokta bakış yönüne kayar, eller çapraz
        // geçmez (sağ el hep sağda kalır).
        const mid = (frame: typeof base) => (frame.right.wrist[0]! + frame.left!.wrist[0]!) / 2;
        expect(mid(left)).toBeLessThan(mid(base) - .02);
        expect(mid(right)).toBeGreaterThan(mid(base) + .02);
        expect(left.right.wrist[0]).toBeGreaterThan(left.left.wrist[0]!);
        expect(right.right.wrist[0]).toBeGreaterThan(right.left!.wrist[0]!);
      } else {
        // Tek elli jest: bilek bakış yönüne gider (point ile aynı kural:
        // yaw > 0 → −X) ve bakışın ÖNÜNDE kalır.
        expect(left.right.wrist[0]).toBeLessThan(base.right.wrist[0]! - .02);
        expect(right.right.wrist[0]).toBeGreaterThan(base.right.wrist[0]! + .02);
        expect(dot(rel(left.right.wrist, SHOULDER), forward(1.2))).toBeGreaterThan(0);
        expect(dot(rel(right.right.wrist, SHOULDER), forward(-1.2))).toBeGreaterThan(0);
      }
    }
    // İki elli jestte 1,4 rad istek ±60° sınırındaki kareyle AYNI; tek elli değil.
    expect(emoteArmFrame('hands_up', 900, true, { yaw: 1.4, pitch: 0 }))
      .toEqual(emoteArmFrame('hands_up', 900, true, { yaw: EMOTE_TWO_HAND_YAW, pitch: 0 }));
    expect(emoteArmFrame('clap', 900, true, { yaw: -1.4, pitch: 0 }))
      .toEqual(emoteArmFrame('clap', 900, true, { yaw: -EMOTE_TWO_HAND_YAW, pitch: 0 }));
    expect(emoteArmFrame('wave', 900, true, { yaw: 1.4, pitch: 0 }))
      .not.toEqual(emoteArmFrame('wave', 900, true, { yaw: EMOTE_TWO_HAND_YAW, pitch: 0 }));
  });
});

describe("D16 §4 — alıcı latch'i", () => {
  it('aynı seq bir kez oynar, süre dolunca kayıt düşer', () => {
    const registry = new EmoteRegistry();
    expect(registry.accept('p2', { kind: 'point', seq: 1, at: 10 }, 1000)).toBe(true);
    // 250/600 ms tekrarları aynı seq: yeniden başlatmaz.
    expect(registry.accept('p2', { kind: 'point', seq: 1, at: 10 }, 1250)).toBe(false);
    expect(registry.active('p2', 1500)!.startedAt).toBe(1000);
    expect(registry.size).toBe(1);
    // Süre dolunca düşer.
    expect(registry.active('p2', 1000 + EMOTE_DURATION_MS.point)).toBeNull();
    expect(registry.size).toBe(0);
    // Eski seq geri gelemez; yeni seq oynar.
    expect(registry.accept('p2', { kind: 'wave', seq: 1, at: 20 }, 6000)).toBe(false);
    expect(registry.accept('p2', { kind: 'wave', seq: 2, at: 20 }, 6000)).toBe(true);
    expect(registry.active('p2', 6100)!.kind).toBe('wave');
    expect(registry.nextEnd(6100)).toBe(6000 + EMOTE_DURATION_MS.wave);
    expect(registry.accept('p2', null, 6100)).toBe(false);
    registry.clear();
    expect(registry.active('p2', 6100)).toBeNull();
    expect(registry.nextEnd(6100)).toBeNull();
  });
  it('gönderenler birbirinin sırasını etkilemez', () => {
    const registry = new EmoteRegistry();
    registry.accept('p2', { kind: 'clap', seq: 9, at: 1 }, 100);
    expect(registry.accept('p3', { kind: 'clap', seq: 1, at: 1 }, 100)).toBe(true);
    expect(registry.active('p3', 200)!.kind).toBe('clap');
  });
});
