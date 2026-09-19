/**
 * D12 §4/§5 — infaz koreografisinin SAF katmanı: zaman → aşama ve sayılar.
 * Hiçbir three/React bağımlılığı yok; testler doğrudan bunu ölçer.
 *
 * Zaman çizgisi (`docs/design/D12-execution.md` §4), t = cue başından beri ms:
 *   0–600    silah yükselir (ölçek 0→1 ilk 150 ms), kol hedefe döner
 *   600–1300 nişan (küçük yerleşme)
 *   1300     ateş: flaş 90 ms, geri tepme 120 ms geri / 200 ms dönüş, `shot` sesi
 *   1380–2000 hedef yana çöker
 *   2000–2600 silah iner (son 150 ms ölçek 1→0)
 */

import type { PublicHistoryEntry, SceneView } from '@secret-table/contracts';

/** §4 zaman çizgisi (ms). Toplam süre `durations.player_eliminated` ile aynıdır. */
export const EXECUTION = {
  raiseMs: 600,
  scaleInMs: 150,
  fireAt: 1300,
  flashMs: 90,
  recoilBackMs: 120,
  recoilReturnMs: 200,
  slumpFrom: 1380,
  slumpTo: 2000,
  lowerFrom: 2000,
  scaleOutMs: 150,
  totalMs: 2600,
  /** §5 yerel ilk şahıs nişan kırpması. */
  aimYawLimit: 75 * Math.PI / 180,
  /** §4 hedef çöküşü. */
  slump: { roll: .32, pitch: .10, drop: .04 },
  /** §4 geri tepme (tur 4: 8° → 12°). */
  recoil: { back: .02, lift: 12 * Math.PI / 180 },
} as const;

/**
 * Tur 4 — patlama: namlu flaşı büyüyüp söner, duman bulutu dağılır, kıvılcımlar
 * namlu yönünde savrulur, hedef çöküşten önce 80 ms sarsılır. Hepsi ateş
 * anından (`EXECUTION.fireAt`) itibaren ölçülür.
 */
export const BLAST = {
  flashMs: 120,
  flashScale: 1.6,
  smokeMs: 400,
  smokeCount: 4,
  /** Namlu ucundan ileri (−Z) dağılma aralığı, m. */
  smokeReach: [.25, .35] as const,
  smokeScale: [.4, 1.8] as const,
  smokeAlpha: .8,
  sparkMs: 90,
  sparkCount: 8,
  sparkReach: [.10, .22] as const,
  flinchMs: 80,
  flinchX: .015,
} as const;

export type BlastFrame = {
  /** Flaş opaklığı 0…1. */
  flash: number;
  /** Flaş düzleminin ölçeği (0,35 → 1,6). */
  flashScale: number;
  /** Duman opaklığı 0…`BLAST.smokeAlpha`. */
  smoke: number;
  /** Duman ilerlemesi 0…1 (dağılma ve büyüme bunu kullanır). */
  smokeP: number;
  /** Kıvılcım opaklığı 0…1. */
  spark: number;
  /** Kıvılcım ilerlemesi 0…1. */
  sparkP: number;
};

const NO_BLAST: BlastFrame = { flash: 0, flashScale: 1, smoke: 0, smokeP: 0, spark: 0, sparkP: 0 };

/**
 * Ateşten `since` ms sonraki patlama karesi. Azaltılmış harekette (§8) yalnız
 * TEK KARE flaş vardır: duman ve kıvılcım çizilmez.
 */
export function blastFrame(since: number, reduced = false): BlastFrame {
  if (since < 0) return NO_BLAST;
  if (reduced) {
    return since < EXECUTION.flashMs
      ? { ...NO_BLAST, flash: 1, flashScale: 1.1 }
      : NO_BLAST;
  }
  const flashP = clamp01(since / BLAST.flashMs);
  const smokeP = clamp01(since / BLAST.smokeMs);
  const sparkP = clamp01(since / BLAST.sparkMs);
  return {
    flash: since < BLAST.flashMs ? (1 - flashP) ** 1.4 : 0,
    flashScale: .35 + (BLAST.flashScale - .35) * easeOutCubic(flashP),
    // Duman doğrusala yakın söner (çok hızlı kaybolmasın), dağılma yumuşar.
    smoke: since < BLAST.smokeMs ? BLAST.smokeAlpha * (1 - smokeP) ** .9 : 0,
    smokeP: 1 - (1 - smokeP) ** 2,
    spark: since < BLAST.sparkMs ? 1 - sparkP : 0,
    sparkP: easeOutCubic(sparkP),
  };
}

/** Tur 4 — hedefin ateş anındaki kısa sarsılması (çöküşten önce, ±1,5 cm). */
export function flinchOffset(now: number, startedAt: number | undefined, reduced = false): number {
  if (startedAt === undefined || reduced) return 0;
  const since = now - startedAt - EXECUTION.fireAt;
  if (since < 0 || since >= BLAST.flinchMs) return 0;
  const p = since / BLAST.flinchMs;
  return Math.sin(p * Math.PI * 3) * BLAST.flinchX * (1 - p);
}

export type ExecutionPhase = 'raise' | 'aim' | 'fire' | 'slump' | 'lower';

const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
export const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const easeInOut = (t: number) => { const p = clamp01(t); return p * p * (3 - 2 * p); };

/**
 * Cue başlangıcından `now`a göre koreografi aşaması.
 *
 * Azaltılmış hareketde (§8) kalkış/inme animasyonu yoktur: silah baştan nişanda
 * durur, 1300'de ateş eder, hedef anında çöker. Toplam süre değişmez.
 */
export function executionPhase(now: number, startedAt: number, reduced = false): ExecutionPhase {
  const t = now - startedAt;
  if (t < EXECUTION.fireAt) return reduced || t >= EXECUTION.raiseMs ? 'aim' : 'raise';
  if (t < EXECUTION.slumpFrom) return 'fire';
  if (t < EXECUTION.lowerFrom) return 'slump';
  return 'lower';
}

export type ExecutionFrame = {
  phase: ExecutionPhase;
  /** Silah ölçeği 0→1→0. */
  scale: number;
  /** Kolun kalkma oranı (0 masada, 1 nişanda). */
  raise: number;
  /** Nişan yaw'ının uygulanma oranı. */
  aim: number;
  /** Geri tepme oranı (0…1); geriye + yukarı. */
  recoil: number;
  /** Namlu flaşı görünürlüğü (0…1). */
  flash: number;
  /** Hedefin çöküş oranı (0…1). */
  slump: number;
};

/** §4 tek karelik sayı seti. Saf; `now` dışarıdan gelir. */
export function executionFrame(now: number, startedAt: number, reduced = false): ExecutionFrame {
  const t = now - startedAt;
  const phase = executionPhase(now, startedAt, reduced);
  const flashOn = t >= EXECUTION.fireAt && t < EXECUTION.fireAt + EXECUTION.flashMs;
  if (reduced) {
    return {
      phase, scale: t < EXECUTION.lowerFrom ? 1 : 0, raise: t < EXECUTION.lowerFrom ? 1 : 0,
      aim: 1, recoil: 0, flash: flashOn ? 1 : 0, slump: t >= EXECUTION.fireAt ? 1 : 0,
    };
  }
  const raise = easeOutCubic(t / EXECUTION.raiseMs);
  const down = clamp01((t - EXECUTION.lowerFrom) / (EXECUTION.totalMs - EXECUTION.lowerFrom));
  const scaleIn = clamp01(t / EXECUTION.scaleInMs);
  const scaleOut = clamp01((t - (EXECUTION.totalMs - EXECUTION.scaleOutMs)) / EXECUTION.scaleOutMs);
  const since = t - EXECUTION.fireAt;
  const recoil = since < 0 ? 0
    : since < EXECUTION.recoilBackMs ? easeOutCubic(since / EXECUTION.recoilBackMs)
    : 1 - easeInOut((since - EXECUTION.recoilBackMs) / EXECUTION.recoilReturnMs);
  return {
    phase,
    scale: Math.max(0, Math.min(scaleIn, 1 - scaleOut)),
    raise: raise * (1 - easeInOut(down)),
    aim: raise,
    recoil: Math.max(0, recoil),
    flash: flashOn ? 1 : 0,
    slump: easeOutCubic((t - EXECUTION.slumpFrom) / (EXECUTION.slumpTo - EXECUTION.slumpFrom)),
  };
}

/**
 * §4 hedefin çöküş oranı. `startedAt` yoksa (cue bitti, yeniden bağlanıldı,
 * hareket azaltma dışı sıradan render) poz KALICI olarak tam çöküktür.
 */
export function slumpAmount(now: number, startedAt: number | undefined, reduced = false): number {
  if (startedAt === undefined) return 1;
  return executionFrame(now, startedAt, reduced).slump;
}

/** §4 nişan sırasındaki küçük yerleşme (±2°, 1 sn periyot). */
export function aimSettle(now: number, startedAt: number, reduced = false): number {
  if (reduced) return 0;
  const t = now - startedAt;
  if (t < EXECUTION.raiseMs || t >= EXECUTION.fireAt) return 0;
  return Math.sin((t - EXECUTION.raiseMs) / 1000 * Math.PI * 2) * (2 * Math.PI / 180);
}

export type SeatFrame = { chair: readonly [number, number, number]; angle: number };

/**
 * §5 nişan yönü: atıcının KENDİ koltuk çerçevesinde hedefe bakan yaw.
 *
 * Koltuk grubu `rotation.y = seat.angle` ile döndürülür ve karakterin önü yerel
 * −Z'dir (masa merkezine bakar). Koltuklar elips üzerinde olduğu için (x 2,64 /
 * z 2,00) açı farkı YETMEZ; gerçek konumlardan hesaplanır.
 */
export function aimYaw(shooter: SeatFrame, target: SeatFrame): number {
  const dx = target.chair[0] - shooter.chair[0], dz = target.chair[2] - shooter.chair[2];
  if (dx === 0 && dz === 0) return 0;
  const cos = Math.cos(shooter.angle), sin = Math.sin(shooter.angle);
  // Dünya vektörünü koltuğun yerel çerçevesine al (−angle kadar döndür).
  const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
  // Yerel −Z'yi (lx, lz) yönüne çeviren yaw.
  return Math.atan2(-lx, -lz);
}

/**
 * §4 hedefin devrildiği taraf: atıcıdan UZAĞA. Karakterin +X'i kendi SAĞIdır;
 * `rotation.z > 0` gövdeyi −X'e (karakterin soluna) yatırır. Atıcı bilinmiyorsa −1.
 */
export function slumpSideAway(target: SeatFrame, shooter?: SeatFrame): -1 | 1 {
  if (!shooter) return -1;
  return Math.sin(aimYaw(target, shooter)) < 0 ? 1 : -1;
}

/**
 * §4 — kalıcı çöküş yönü için atıcı: KAMU geçmişinden (`power_used` / `execution`).
 * Cue geçtikten ve görev el değiştirdikten sonra da aynı tarafı verir.
 */
export function executionActorId(history: readonly PublicHistoryEntry[], targetId: string): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry?.kind === 'power_used' && entry.power === 'execution' && entry.targetId === targetId) return entry.actorId ?? undefined;
  }
  return undefined;
}

/**
 * D27 — cue oynarken ATICI kimdir? Canlı oyunda `player_eliminated` cue'su geldiği
 * sürümde görev çoktan bir sonraki başkan adayına geçmiştir; `office === 'president'`
 * artık YENİ başkandır. Bu yüzden önce kamu geçmişine (`power_used`/`execution`)
 * bakılır; geçmiş yoksa (eski fixture, kısmi görünüm) güncel/son seçilmiş başkana
 * düşülür. Yalnız kamu bilgisi kullanır.
 */
export function executionShooterId(view: SceneView, targetId: string, fallback: string | undefined): string | undefined {
  return executionActorId(view.table.publicHistory, targetId) ?? fallback;
}

/**
 * D12 tur 3 — silah HEDEF SEÇİLİRKEN de elde durur: infaz yetkisi işlerken
 * (`executive_action` + `currentPower.power === 'execution'`) yetkili oyuncu
 * silahı hazır pozda tutar. Cue gelince koreografi bu pozdan başlar.
 *
 * Yalnız KAMU alanları okunur; yeniden bağlanan istemci de aynı sonucu verir.
 */
export function executionReadyActorId(view: Pick<SceneView, 'phase' | 'table'>): string | undefined {
  const power = view.table.currentPower;
  if (view.phase !== 'executive_action' || power?.power !== 'execution') return undefined;
  return power.actorId ?? undefined;
}

/** §5 yerel ilk şahıs el: aynı yaw, ±75° kırpılmış. */
export function localAimYaw(shooter: SeatFrame, target: SeatFrame): number {
  const yaw = aimYaw(shooter, target);
  return Math.max(-EXECUTION.aimYawLimit, Math.min(EXECUTION.aimYawLimit, yaw));
}
