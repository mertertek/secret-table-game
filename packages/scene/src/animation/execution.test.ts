import { describe, expect, it } from 'vitest';
import { getSceneFixture } from '../../../fixtures/src/index';
import type { SceneCue, SceneView } from '@secret-table/contracts';
import {
  BLAST, EXECUTION, aimSettle, aimYaw, blastFrame, executionActorId, executionFrame, executionShooterId, executionPhase,
  executionReadyActorId, flinchOffset, localAimYaw, slumpAmount, slumpSideAway,
} from './execution';
import { CueLedger, durations } from './cues';
import { LIMITS, POSES, PROP_FRAMES, CARD_FRAMES, clampPose } from '../hands/poses';
import { GUN_LENGTH, gunGeometry } from '../props/gun';
import { layoutSeats } from '../layout/seats';
import { makePlayers, makeView } from '../../../fixtures/src/builders';
import { propFromHand, handFromCard } from '../prototype/grip';
import { aimedHand, sampleRig, settledRig } from '../prototype/rig';
import { makeShot, makeSound } from '../audio/SceneAudio';
import { SPEC } from '../characters/spec';
import { expressionParams } from '../characters/face';
import { characterSpec } from '../characters/spec';

describe('D12 §4 koreografi zaman çizgisi', () => {
  it('cue süresi tasarımdaki 2600 ms', () => {
    expect(durations.player_eliminated).toBe(2600);
    expect(EXECUTION.totalMs).toBe(2600);
  });

  it('§4 çöküş ve geri tepme sayıları tasarımdaki değerler', () => {
    // Hedef: rotation.z ±.32 · rotation.x .10 · position.y −.04 (CharacterAvatar).
    expect(EXECUTION.slump).toEqual({ roll: .32, pitch: .10, drop: .04 });
    expect(EXECUTION.recoil.back).toBeCloseTo(.02, 6);
    // Tur 4: geri tepme 8° → 12°.
    expect(EXECUTION.recoil.lift).toBeCloseTo(12 * Math.PI / 180, 6);
    expect(EXECUTION.flashMs).toBe(90);
  });

  it.each([
    [0, 'raise'], [599, 'raise'], [600, 'aim'], [1299, 'aim'],
    [1300, 'fire'], [1379, 'fire'], [1380, 'slump'], [1999, 'slump'],
    [2000, 'lower'], [2600, 'lower'], [9000, 'lower'],
  ] as const)('t=%i → %s', (t, phase) => {
    expect(executionPhase(1000 + t, 1000)).toBe(phase);
  });

  it('azaltılmış hareketde kalkış yok, süre aynı', () => {
    expect(executionPhase(1000, 1000, true)).toBe('aim');
    expect(executionPhase(1000 + 1299, 1000, true)).toBe('aim');
    expect(executionPhase(1000 + 1300, 1000, true)).toBe('fire');
    expect(executionPhase(1000 + 2599, 1000, true)).toBe('lower');
    const frame = executionFrame(1000 + 400, 1000, true);
    expect(frame.scale).toBe(1);
    expect(frame.recoil).toBe(0);
    expect(frame.slump).toBe(0);
    // Flaş tek kare, hedef ateşle birlikte anında çöker.
    expect(executionFrame(1000 + 1300, 1000, true).flash).toBe(1);
    expect(executionFrame(1000 + 1300, 1000, true).slump).toBe(1);
  });

  it('ölçek, flaş, geri tepme ve çöküş sınırlar içinde kalır', () => {
    expect(executionFrame(1000, 1000).scale).toBe(0);
    expect(executionFrame(1150, 1000).scale).toBe(1);
    expect(executionFrame(3600, 1000).scale).toBe(0);
    expect(executionFrame(1000 + 1299, 1000).flash).toBe(0);
    expect(executionFrame(1000 + 1300, 1000).flash).toBe(1);
    expect(executionFrame(1000 + 1390, 1000).flash).toBe(0);
    expect(executionFrame(1000 + 1420, 1000).recoil).toBeCloseTo(1, 2);
    expect(executionFrame(1000 + 1700, 1000).recoil).toBe(0);
    expect(slumpAmount(1000 + 1379, 1000)).toBe(0);
    expect(slumpAmount(1000 + 2000, 1000)).toBe(1);
    // Cue yoksa poz KALICI olarak çöküktür (yeniden bağlanma).
    expect(slumpAmount(0, undefined)).toBe(1);
    for (let t = 0; t <= 2600; t += 37) {
      const f = executionFrame(1000 + t, 1000);
      for (const v of [f.scale, f.raise, f.aim, f.recoil, f.flash, f.slump]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(Math.abs(aimSettle(1000 + 900, 1000))).toBeLessThanOrEqual(2 * Math.PI / 180 + 1e-9);
    expect(aimSettle(1000 + 900, 1000, true)).toBe(0);
    expect(aimSettle(1000 + 1400, 1000)).toBe(0);
  });
});

describe('D12 §5 nişan yönü', () => {
  const view = makeView({ players: makePlayers({ count: 9 }), localPlayerId: 'p1' });
  const seats = layoutSeats(view);
  const seat = (id: string) => seats.find((s) => s.player.playerId === id)!;

  it('karşı koltuk yaklaşık ileri, komşu koltuk yana bakar', () => {
    // Yerel oyuncu p1 (açı 0, +Z); p5/p6 masanın karşısı, p2 sağ komşu.
    const across = aimYaw(seat('p1'), seat('p6'));
    expect(Math.abs(across)).toBeLessThan(.35);
    const neighbour = aimYaw(seat('p1'), seat('p2'));
    expect(Math.abs(neighbour)).toBeGreaterThan(1);
    // Sağ komşu (+X tarafı) için yaw NEGATİF: yerel −Z ekseni sağa döner.
    expect(neighbour).toBeLessThan(0);
  });

  it('yaw atıcının kendi çerçevesindedir: simetrik koltuklar simetrik açı verir', () => {
    expect(aimYaw(seat('p1'), seat('p2'))).toBeCloseTo(-aimYaw(seat('p1'), seat('p9')), 6);
    expect(aimYaw(seat('p3'), seat('p3'))).toBe(0);
  });

  it('yerel el ±75° ile kırpılır', () => {
    const wide = localAimYaw(seat('p1'), seat('p2'));
    expect(Math.abs(wide)).toBeLessThanOrEqual(EXECUTION.aimYawLimit + 1e-9);
    expect(Math.abs(localAimYaw(seat('p1'), seat('p6')))).toBeLessThan(EXECUTION.aimYawLimit);
  });

  it('çöküş yönü atıcıdan uzağa; atıcı bilinmiyorsa −1', () => {
    // Atıcı hedefin SAĞINDA (+X) ise gövde −X'e devrilir (rotation.z > 0).
    expect(slumpSideAway(seat('p1'), seat('p2'))).toBe(1);
    expect(slumpSideAway(seat('p1'), seat('p9'))).toBe(-1);
    expect(slumpSideAway(seat('p1'))).toBe(-1);
  });

  it('kalıcı çöküş yönü kamu geçmişinden okunur', () => {
    const history = [
      { entryId: 'h1', kind: 'power_used', power: 'execution', actorId: 'p1', targetId: 'p6' },
      { entryId: 'h2', kind: 'player_executed', targetId: 'p6' },
    ] as const;
    expect(executionActorId(history, 'p6')).toBe('p1');
    expect(executionActorId(history, 'p2')).toBeUndefined();
    expect(executionActorId([], 'p6')).toBeUndefined();
  });
});

describe('D12 §2/§3 silah ve tutuş', () => {
  it('`holdGun` pozu D1 sınırları içinde', () => {
    const pose = POSES.holdGun;
    expect(clampPose(pose)).toEqual(pose);
    expect(pose['thumb.cmc']![0]!).toBeGreaterThanOrEqual(LIMITS.thumbCmc[0]![0]);
    expect(pose['thumb.mcp']![0]!).toBeLessThanOrEqual(LIMITS.thumbMcp[1]);
    for (const finger of ['index', 'middle', 'ring', 'pinky'] as const) {
      expect(pose[`${finger}.mcp`]![0]!).toBeLessThanOrEqual(LIMITS.mcpFlex[1]);
      expect(Math.abs(pose[`${finger}.mcp`]![1]!)).toBeLessThanOrEqual(LIMITS.mcpAbd[1]);
      expect(pose[`${finger}.pip`]![0]!).toBeLessThanOrEqual(LIMITS.pipFlex[1]);
      expect(pose[`${finger}.dip`]![0]!).toBeLessThanOrEqual(LIMITS.dipFlex[1]);
    }
    // Tetik parmağı kabzayı SARMAZ (diğer parmaklardan belirgin açık).
    expect(pose['index.mcp']![0]!).toBeLessThan(pose['middle.mcp']![0]!);
  });

  it('silah çerçevesi kart çerçevelerinden ayrıdır (kart çizimi `holdGun`da yok)', () => {
    expect(PROP_FRAMES.holdGun).toBeDefined();
    expect(CARD_FRAMES.holdGun).toBeUndefined();
  });

  it('tur 5 — HD silah bütçe içinde, paylaşımlı ve sınır/malzeme verisi taşır', () => {
    const build = gunGeometry('hd');
    expect(build.triangles).toBeGreaterThan(1500);
    expect(build.triangles).toBeLessThanOrEqual(3000);
    expect(gunGeometry('hd')).toBe(build);       // tembel + tek üretim
    // Köşe renkleri + D3 kenar-yumuşatma çifti + köşe başına metal/pürüz.
    for (const name of ['color', 'colorB', 'dBoundary', 'gunMaterial', 'normal']) {
      expect(build.geometry.getAttribute(name), name).toBeDefined();
    }
    // NON-INDEXED: üçgenin üç köşesi aynı renk çiftini taşır (fwidth koşulu).
    expect(build.geometry.getIndex()).toBeNull();
    expect(build.geometry.getAttribute('color').count).toBe(build.triangles * 3);
    // İlk kare kabası ayrı önbellektedir ve çok daha ucuzdur.
    const low = gunGeometry('low');
    expect(low.triangles).toBeLessThan(build.triangles);
    expect(low).not.toBe(build);
  });

  it('tur 4 — silah el uzunluğunun ≈1,9 katı', () => {
    // El şablonu bilekten parmak ucuna 0,19 (handBounds).
    expect(GUN_LENGTH / .19).toBeGreaterThan(1.8);
    expect(GUN_LENGTH / .19).toBeLessThan(2.0);
  });

  it('nesne çerçevesi el dönüşümünün tersidir', () => {
    const hand = aimedHand(.4, .5);
    const gun = propFromHand(hand, 1, PROP_FRAMES.holdGun!);
    const back = handFromCard(gun, 1, 'holdGun', PROP_FRAMES.holdGun!);
    for (let i = 0; i < 3; i++) {
      expect(back.position[i]!).toBeCloseTo(hand.position[i]!, 9);
      expect(back.rotation[i]!).toBeCloseTo(hand.rotation[i]!, 9);
    }
  });
});

describe('D12 tur 3 — silah hedef seçilirken de elde', () => {
  const power = (extra: Record<string, unknown>) => makeView({
    phase: 'executive_action', phaseId: 'ea', localPlayerId: 'p1',
    players: makePlayers({ count: 7 }),
    table: { currentPower: { power: 'execution', actorId: 'p3', targetId: null, ...extra } as never },
  });

  it('yalnız infaz yetkisi işlerken ve yalnız yetkili oyuncu için', () => {
    expect(executionReadyActorId(power({}))).toBe('p3');
    // Hedef seçildikten sonra da (cue gelene kadar) silah elde kalır.
    expect(executionReadyActorId(power({ targetId: 'p5' }))).toBe('p3');
    // Başka yetki ya da başka faz → silah yok.
    expect(executionReadyActorId(power({ power: 'investigate_loyalty' }))).toBeUndefined();
    expect(executionReadyActorId({ ...power({}), phase: 'nomination' })).toBeUndefined();
    expect(executionReadyActorId(makeView({ players: makePlayers({ count: 7 }) }))).toBeUndefined();
  });

  it('hazır poz silahı gösterir; koreografi hazır pozdan başlarsa ölçek 1 kalır', () => {
    expect(settledRig('ready', 0, 0).gunScale).toBe(1);
    expect(settledRig('ready', 0, 0).right.grip).toBe('holdGun');
    expect(settledRig('rest', 0, 0).gunScale).toBe(0);
    const fromReady = {
      pose: 'aim' as const, selected: 0, revision: 1,
      motion: { kind: 'shoot' as const, from: 'ready' as const, selected: 0, startedAt: 1000, duration: EXECUTION.totalMs, aimYaw: .3 },
    };
    // Hazır pozdan başlayan koreografide silah ilk karede zaten tam ölçekte.
    expect(sampleRig(fromReady, 1000, false).gunScale).toBe(1);
    expect(sampleRig(fromReady, 1000 + 2600 - 40, false).gunScale).toBeLessThan(.4);
    // Dinlenmeden başlayan (hazır poz yok) koreografide silah 150 ms'de belirir.
    const fromRest = { ...fromReady, motion: { ...fromReady.motion, from: 'rest' as const } };
    expect(sampleRig(fromRest, 1000, false).gunScale).toBe(0);
  });
});

describe('D12 §4 ilk şahıs infaz hareketi', () => {
  const state = {
    pose: 'aim' as const, selected: 0, revision: 1,
    motion: { kind: 'shoot' as const, from: 'rest' as const, selected: 0, startedAt: 1000, duration: EXECUTION.totalMs, aimYaw: .5 },
  };
  it('silah yalnız koreografi boyunca görünür, tutuş `holdGun`', () => {
    expect(sampleRig(state, 1000, false).gunScale).toBe(0);
    const aiming = sampleRig(state, 1000 + 900, false);
    expect(aiming.gunScale).toBe(1);
    expect(aiming.right.grip === 'holdGun' || aiming.right.blend?.to === 'holdGun').toBe(true);
    expect(aiming.fanVisible).toBe(false);
    // Tur 4: patlama zamanı ateşten itibaren ölçülür (flaş/duman/kıvılcım).
    expect(sampleRig(state, 1000 + 1310, false).gunSince).toBe(10);
    expect(sampleRig(state, 1000 + 1290, false).gunSince).toBe(-10);
    // Hareket bittikten sonra eller dinlenmede ve silah yok.
    const done = sampleRig(state, 1000 + EXECUTION.totalMs + 1, false);
    expect(done.gunScale).toBe(0);
    expect(done.done).toBe(true);
  });
});

describe('D12 §4 cue paketi', () => {
  const players = makePlayers({ count: 7, overrides: { 0: { office: 'president' }, 5: { alive: false } } });
  const view: SceneView = makeView({
    phase: 'game_over', phaseId: 'go', revision: 12, localPlayerId: 'p2', players,
    result: { winner: 'liberal', reason: 'hitler_executed', revealedRoles: [] },
  });
  const shot: SceneCue = { cueId: 'c1', gameId: view.gameId!, revision: 12, kind: 'player_eliminated', playerId: 'p6' };
  const ended: SceneCue = { cueId: 'c2', gameId: view.gameId!, revision: 12, kind: 'game_ended', winner: 'liberal', reason: 'hitler_executed' };

  it('oyun sonu halesi infaz bitene kadar bekler', () => {
    const ledger = new CueLedger();
    const { active } = ledger.update(view, [shot, ended], 0, true, false);
    const end = active.find((a) => a.cue.kind === 'game_ended')!;
    expect(end.delay).toBe(durations.player_eliminated);
    expect(end.duration).toBe(durations.player_eliminated + durations.game_ended);
    expect(active.find((a) => a.cue.kind === 'player_eliminated')!.delay).toBeUndefined();
  });

  it('azaltılmış hareket infazın süresini kısaltmaz', () => {
    const ledger = new CueLedger();
    const { active } = ledger.update(view, [shot], 0, true, true);
    expect(active[0]!.duration).toBe(2600);
  });
});

describe('D12 tur 4 — patlama', () => {
  it('flaş büyüyerek söner, duman ve kıvılcım kendi süreleriyle biter', () => {
    expect(blastFrame(-1).flash).toBe(0);
    const start = blastFrame(0);
    expect(start.flash).toBeCloseTo(1, 6);
    expect(start.flashScale).toBeCloseTo(.35, 6);
    const mid = blastFrame(BLAST.flashMs / 2);
    expect(mid.flashScale).toBeGreaterThan(start.flashScale);
    expect(mid.flash).toBeLessThan(start.flash);
    expect(blastFrame(BLAST.flashMs).flash).toBe(0);
    expect(blastFrame(BLAST.flashMs).flashScale).toBeCloseTo(BLAST.flashScale, 6);
    // Duman 400 ms, kıvılcım 90 ms.
    expect(blastFrame(10).smoke).toBeGreaterThan(0);
    expect(blastFrame(BLAST.smokeMs).smoke).toBe(0);
    expect(blastFrame(10).spark).toBeGreaterThan(0);
    expect(blastFrame(BLAST.sparkMs).spark).toBe(0);
    for (const since of [0, 30, 90, 200, 399, 1000]) {
      const b = blastFrame(since);
      for (const v of [b.flash, b.smoke, b.spark, b.smokeP, b.sparkP]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('azaltılmış harekette yalnız tek kare flaş; duman ve kıvılcım yok', () => {
    const r = blastFrame(20, true);
    expect(r.flash).toBe(1);
    expect(r.smoke).toBe(0);
    expect(r.spark).toBe(0);
    expect(blastFrame(EXECUTION.flashMs, true).flash).toBe(0);
  });

  it('hedef ateş anında 80 ms sarsılır, sonra sarsılmaz', () => {
    expect(flinchOffset(1000 + 1299, 1000)).toBe(0);
    const peak = Math.max(...[10, 20, 30, 40].map((d) => Math.abs(flinchOffset(1000 + EXECUTION.fireAt + d, 1000))));
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(BLAST.flinchX);
    expect(flinchOffset(1000 + EXECUTION.fireAt + BLAST.flinchMs, 1000)).toBe(0);
    expect(flinchOffset(1000 + EXECUTION.fireAt + 20, 1000, true)).toBe(0);
    expect(flinchOffset(1000, undefined)).toBe(0);
  });
});

describe('D12 §4/§7 ses ve ifade', () => {
  it('tur 4 — `shot` sesi 0,40 s, tepe 0,6 ve kırpma yok', () => {
    const rate = 48000;
    const shot = makeShot(rate);
    expect(shot.length).toBe(Math.ceil(rate * .40));
    const peak = (x: Float32Array) => Math.max(...Array.from(x, Math.abs));
    // Tepe `end`in (0,05 civarı) çok üstünde ama 0,6'yı aşmaz.
    expect(peak(shot)).toBeCloseTo(.6, 3);
    expect(peak(makeSound('end', rate))).toBeLessThan(.6);
    expect(Math.abs(shot[shot.length - 1]!)).toBeLessThan(.02);
    // Transient ilk 10 ms'de: enerjinin tepesi başta.
    const early = peak(shot.slice(0, Math.round(rate * .01)));
    expect(early).toBeGreaterThan(.2);
    // Yankı kopyaları: 45 ms ve 90 ms sonrasında hâlâ ses var.
    expect(peak(shot.slice(Math.round(rate * .044), Math.round(rate * .05)))).toBeGreaterThan(.01);
  });

  it('`ko` ifadesi X gözler, düşük yanak ve sarkık dil taşır', () => {
    const ko = SPEC.faces.expressions.ko;
    expect(ko.eyes?.type).toBe('x');
    expect(ko.cheekAlpha).toBeCloseTo(.05, 6);
    expect(ko.mouth.type).toBe('o');
    const params = expressionParams(characterSpec('fotr'), '#f1c9a3', 'ko');
    expect(params.eyes?.type).toBe('x');
    expect(params.lid).toBe(0);
  });

  it('D27 — canlı oyunda atıcı kamu geçmişinden bulunur; görev sıradaki başkana geçmiş olsa bile', () => {
    const base = getSceneFixture('execution-shot-local')!.view;
    // Canlı sunucu: cue geldiği sürümde `office: president` SIRADAKİ oyuncudadır.
    const live = { ...base, players: base.players.map((p) => ({ ...p, office: p.playerId === 'p2' ? 'president' as const : null })) } as SceneView;
    expect(live.players.find((p) => p.office === 'president')?.playerId).toBe('p2');
    expect(executionShooterId(live, 'p5', 'p2')).toBe('p1');
    // Geçmiş yoksa (eski fixture / kısmi görünüm) verilen yedeğe düşer.
    const bare = { ...live, table: { ...live.table, publicHistory: [] } } as SceneView;
    expect(executionShooterId(bare, 'p5', 'p2')).toBe('p2');
    expect(executionShooterId(bare, 'p5', undefined)).toBeUndefined();
  });
});

