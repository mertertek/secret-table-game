/**
 * D3 §f — yüz dokusu: §f'de 512 × 256 tuval (tur 3: standard 1024 × 768), planar Z penceresi
 * (x ∈ [−0,20, 0,20], y ∈ [0,62, 0,94]); çizim baş merkezine göre MİLİMETRE
 * koordinatlarında yapılır (`setTransform(1.28, 0, 0, −0.80, 256, 120)`), böylece
 * tuvaldeki dairesel bir özellik model üstünde de daireseldir.
 *
 * Doku tek katmanda yeniden çizilir; ifade ya da göz kırpma karesi değişince
 * `needsUpdate` + `invalidate()`.
 */
import { CanvasTexture, LinearMipmapLinearFilter, LinearFilter, SRGBColorSpace } from 'three';
import { SPEC, hasAccessory, mouthOffset } from './spec';
import type { CharacterSpec, ExpressionName, ExpressionSpec, EyeSpec, MouthSpec, Tier } from './spec';
import { TIERS } from './geometry';

const F = SPEC.faces;

export type FaceParams = {
  readonly skin: string;
  readonly expression: ExpressionName;
  /** 0 açık · 1 tamamen kapalı (kırpma karesi ya da `grumpy` kapağı). */
  readonly lid: number;
  readonly eyeScale: number;
  /** D12 §7 — verilirse göz akı/bebek yerine X çizilir (`ko`). */
  readonly eyes?: EyeSpec;
  readonly pupilDy: number;
  readonly pupilR: number;
  readonly brow: readonly (readonly number[])[];
  readonly browColor: string;
  readonly browWeight: number;
  /** Karakterin SOL kaşının mm cinsinden yükseltmesi (fötr). */
  readonly browAsymMm: number;
  readonly cheekColor: string;
  readonly cheekAlpha: number;
  readonly cheekR: number;
  readonly freckles: boolean;
  readonly mouth: MouthSpec;
  /** Bıyık/sakal ağzı aşağı iter (mm). */
  readonly mouthDy: number;
  /** Kaş şapka/saç kenarının altında kalmasın diye iner (mm, ≤ 0). */
  readonly browDy: number;
  readonly glasses: boolean;
};

/**
 * Kaşın tuvaldeki en üst noktası (mm, baş merkezine göre) — çizgi kalınlığı dahil.
 * `faceTopMm` yüz grubunun görünen üst kenarıdır; kaş bunun 8 mm altında kalmalı.
 */
export function browShift(character: CharacterSpec, expression: ExpressionName, faceTopMm?: number): number {
  if (faceTopMm === undefined) return 0;
  const e = F.expressions[expression];
  const half = F.features_mm.browWidth * character.face.brows.weight / 2;
  const top = Math.max(...e.brow.map((p) => p[1]!)) + half + character.face.brows.asym * 1000;
  // Yüz grubunun üst kenarındaki üçgenler kısmen gövde grubuna düştüğü için
  // 26 mm pay bırakılır (kaşın üstü tırtıklı görünmesin); en fazla 20 mm
  // indirilir, daha fazlası kaşı gözün üstüne bindirir.
  return Math.max(-20, Math.min(0, faceTopMm - 26 - top));
}

/** §f 4 ifade + karakterin yüz notları → saf çizim parametreleri. */
export function expressionParams(character: CharacterSpec, skin: string, expression: ExpressionName, lid = 0, faceTopMm?: number): FaceParams {
  const e: ExpressionSpec = F.expressions[expression];
  const grin = character.face.mouthStyle === 'grin';
  return {
    browDy: browShift(character, expression, faceTopMm),
    skin, expression,
    lid: Math.max(e.lid, lid),
    eyeScale: e.eyeScale,
    ...(e.eyes ? { eyes: e.eyes } : {}),
    pupilDy: e.pupilDy,
    pupilR: e.pupilR ?? F.features_mm.eye.pupil.r,
    brow: e.brow,
    browColor: character.face.brows.color,
    browWeight: character.face.brows.weight,
    browAsymMm: character.face.brows.asym * 1000,
    cheekColor: character.face.cheeks.color,
    cheekAlpha: Math.min(1, e.cheekAlpha * character.face.cheeks.alphaScale),
    cheekR: e.cheekR,
    freckles: character.face.freckles,
    mouth: grin ? { type: 'grin', p: F.grinMouth.p } : e.mouth,
    mouthDy: mouthOffset(character) * 1000,
    glasses: hasAccessory(character, 'glasses'),
  };
}

/** §f göz kırpma zaman çizelgesi: 0 ms açık, 60 yarım, 120 kapalı, 170 yarım, 220 açık. */
export const BLINK_FRAMES: readonly { readonly at: number; readonly lid: number }[] = [
  { at: 0, lid: 0 }, { at: 60, lid: .5 }, { at: F.blink.downMs, lid: 1 },
  { at: F.blink.downMs + 50, lid: .5 }, { at: F.blink.downMs + F.blink.upMs, lid: 0 },
];
export const BLINK_MS = F.blink.downMs + F.blink.upMs;

/** Kırpma başlangıcından `ms` sonra göz kapağı kapanma oranı. */
export function blinkLid(ms: number): number {
  if (ms < 0 || ms >= BLINK_MS) return 0;
  let lid = 0;
  for (const frame of BLINK_FRAMES) if (ms >= frame.at) lid = frame.lid;
  return lid;
}

/** 3–6 s düzgün rastgele bir sonraki kırpma anı (ms). */
export function nextBlinkDelay(random = Math.random): number {
  const [lo, hi] = [F.blink.intervalS[0]!, F.blink.intervalS[1]!];
  return (lo + random() * (hi - lo)) * 1000;
}

type Ctx = CanvasRenderingContext2D;

/** §f çil yarıçapı 6 mm yakın planda leke gibi okunuyordu (tur 2). */
const FRECKLE_R = 4;

const alpha = (hex: string, a: number): string => {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}

function mouthPath(ctx: Ctx, mouth: MouthSpec, dy: number): void {
  ctx.beginPath();
  if (mouth.type === 'o') { ctx.ellipse(mouth.c[0]!, mouth.c[1]! + dy, mouth.rx, mouth.ry, 0, 0, Math.PI * 2); return; }
  const [a, c, b] = [mouth.p[0]!, mouth.p[1]!, mouth.p[2]!];
  ctx.moveTo(a[0]!, a[1]! + dy);
  ctx.quadraticCurveTo(c[0]!, c[1]! + dy, b[0]!, b[1]! + dy);
}

/** §f katman sırası; her çağrıda tuvalin tamamı yeniden çizilir. */
export function drawFace(ctx: Ctx, width: number, height: number, p: FaceParams): void {
  const m = F.features_mm;
  // §f çizimi mm cinsindendir; tuval ölçeği İKİ EKSENDE AYRI hesaplanır çünkü
  // tur 3'te tuval oranı (1024×768) UV penceresinin oranına (400×320 mm)
  // yaklaştırıldı: eskiden 512×256'da y çözünürlüğü x'in 0,63'üydü (göz/kaş
  // kenarı dikeyde bulanıktı). Model üstündeki şekil değişmez — ölçekler
  // pencere/tuval oranını birebir izler.
  const sx = width / F.canvas.w, sy = height / F.canvas.h;
  ctx.setTransform(1.28 * sx, 0, 0, -.80 * sy, 256 * sx, 120 * sy);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // 1 — ten zemini (dikiş görünmesin diye gövde ten hex'iyle aynı).
  ctx.fillStyle = p.skin; ctx.fillRect(-200, -170, 400, 320);

  // 2 — yanak
  for (const s of [-1, 1]) {
    ctx.globalAlpha = p.cheekAlpha;
    ellipse(ctx, s * m.cheek.c[0]!, m.cheek.c[1]!, p.cheekR * m.cheek.rxScale, p.cheekR, p.cheekColor);
    ctx.globalAlpha = 1;
  }

  // 3 — çil (§f 10 nokta r 6; yakın planda leke gibi okunduğu için 6 nokta r 4)
  if (p.freckles) for (let i = 0; i < m.freckles.length; i++) {
    if (i % 5 === 3) continue;                       // burun üstü çiftini ve 2 yanağı ele
    const f = m.freckles[i]!;
    ellipse(ctx, f[0]!, f[1]!, FRECKLE_R, FRECKLE_R, alpha(m.freckle.color, m.freckle.alpha * .85));
  }

  const eyeX = m.eye.c[0]!, eyeY = m.eye.c[1]!;
  const rx = m.eye.rx * p.eyeScale, ry = m.eye.ry * p.eyeScale;
  // 4x — D12 §7 `ko`: göz yerine X (göz çapının %70'i, iki kalın çizgi).
  // Göz akı, bebek, parlaklık ve kapak çizilmez; kırpma da kapalıdır.
  if (p.eyes?.type === 'x') for (const s of [-1, 1]) {
    const hx = rx * p.eyes.span, hy = ry * p.eyes.span;
    ctx.strokeStyle = m.eye.ink; ctx.lineWidth = p.eyes.weight;
    ctx.beginPath();
    ctx.moveTo(s * eyeX - hx, eyeY - hy); ctx.lineTo(s * eyeX + hx, eyeY + hy);
    ctx.moveTo(s * eyeX - hx, eyeY + hy); ctx.lineTo(s * eyeX + hx, eyeY - hy);
    ctx.stroke();
  }
  else for (const s of [-1, 1]) {
    // 4 — göz akı
    ellipse(ctx, s * eyeX, eyeY, rx, ry, m.eye.white);
    // 5 — bebek + parlaklık
    const py = eyeY + m.eye.pupil.dy + p.pupilDy;
    ellipse(ctx, s * eyeX, py, p.pupilR, p.pupilR, m.eye.ink);
    ellipse(ctx, s * eyeX + m.eye.highlight.d[0]!, py + m.eye.highlight.d[1]!, m.eye.highlight.r, m.eye.highlight.r, '#ffffff');
    ellipse(ctx, s * eyeX + m.eye.highlight2.d[0]!, py + m.eye.highlight2.d[1]!, m.eye.highlight2.r, m.eye.highlight2.r, '#ffffff');
    // 6 — göz kapağı (kırpma / somurtkan)
    if (p.lid > 0) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(s * eyeX, eyeY, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = p.skin;
      ctx.fillRect(s * eyeX - rx, eyeY + ry - 2 * ry * p.lid, 2 * rx, 2 * ry * p.lid);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(s * eyeX - rx, eyeY + ry - 2 * ry * p.lid);
      ctx.lineTo(s * eyeX + rx, eyeY + ry - 2 * ry * p.lid);
      ctx.strokeStyle = p.browColor; ctx.lineWidth = 8; ctx.stroke();
    }
  }

  // 7 — kaş (karakterin sol kaşı `asym` kadar yukarı: fötr)
  for (const s of [-1, 1]) {
    const lift = (s < 0 ? p.browAsymMm : 0) + p.browDy;
    const [a, c, b] = [p.brow[0]!, p.brow[1]!, p.brow[2]!];
    ctx.beginPath();
    ctx.moveTo(s * a[0]!, a[1]! + lift);
    ctx.quadraticCurveTo(s * c[0]!, c[1]! + lift, s * b[0]!, b[1]! + lift);
    ctx.strokeStyle = p.browColor; ctx.lineWidth = m.browWidth * p.browWeight; ctx.stroke();
  }

  // 8 — ağız (+ diş / dil / alt dudak)
  const mouth = p.mouth;
  if (mouth.type === 'grin') {
    mouthPath(ctx, mouth, p.mouthDy);
    ctx.closePath(); ctx.fillStyle = m.eye.ink; ctx.fill();
    ctx.save(); ctx.clip();
    const [tx, ty, tw, th] = [m.teeth.rect[0]!, m.teeth.rect[1]!, m.teeth.rect[2]!, m.teeth.rect[3]!];
    ctx.fillStyle = m.teeth.color; ctx.fillRect(tx, ty + p.mouthDy - th, tw, th);
    const [gx, gy, gw, gh] = [m.teeth.gap[0]!, m.teeth.gap[1]!, m.teeth.gap[2]!, m.teeth.gap[3]!];
    ctx.fillStyle = m.eye.ink; ctx.fillRect(gx, gy + p.mouthDy - gh, gw, gh);
    ctx.restore();
  } else if (mouth.type === 'o') {
    mouthPath(ctx, mouth, p.mouthDy);
    ctx.fillStyle = m.eye.ink; ctx.fill();
    if (mouth.tongue) ellipse(ctx, mouth.tongue.c[0]!, mouth.tongue.c[1]! + p.mouthDy, mouth.tongue.r, mouth.tongue.r, mouth.tongue.color);
  } else {
    if (mouth.lowerLip) {
      ctx.globalAlpha = mouth.lowerLip.alpha;
      ellipse(ctx, mouth.lowerLip.c[0]!, mouth.lowerLip.c[1]! + p.mouthDy, mouth.lowerLip.rx, mouth.lowerLip.ry, m.eye.ink);
      ctx.globalAlpha = 1;
    }
    mouthPath(ctx, mouth, p.mouthDy);
    ctx.strokeStyle = m.eye.ink; ctx.lineWidth = m.mouthWidth; ctx.stroke();
  }

  // 9 — gözlük camı parlaması (3D halka mesh'te; doku yalnız parlamayı çizer)
  if (p.glasses) for (const s of [-1, 1]) {
    ellipse(ctx, s * eyeX, eyeY, m.lensHighlight.r, m.lensHighlight.r, alpha(m.lensHighlight.color, m.lensHighlight.alpha));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Oyuncu başına bir tuval + `CanvasTexture` (§g: 10 kişide ~5 MB). */
export class FaceTexture {
  readonly texture: CanvasTexture;
  private readonly ctx: Ctx;
  private readonly width: number;
  private readonly height: number;
  private key = '';

  /** `anisotropy` renderer'ın en büyük değeri olmalı (`gl.capabilities.getMaxAnisotropy()`). */
  constructor(tier: Tier, anisotropy = 16) {
    // §f 512×256; tur 2'de standard 1024×512, tur 3'te 1024×768 — pencere
    // 400 × 320 mm olduğu için 2:1 tuval dikeyde 0,63 kat çözünürlük veriyordu.
    // 1024×768 → x 2,56 px/mm, y 2,40 px/mm (neredeyse eş yoğunluk); koltuk
    // kamerasından yan komşu (1,2 m, dpr 1,5) yüz penceresini ~620 × 495 px
    // kaplar, yani doku her iki eksende de ≥ 1,5 kat örneklenmiş olur.
    const [w, h] = TIERS[tier].face;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    this.width = w; this.height = h;
    this.ctx = canvas.getContext('2d')!;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.anisotropy = Math.max(1, anisotropy);
  }

  /** Doku anahtarı `karakter:ten:ifade:kırpmaKaresi`; aynı anahtarda çizim yapılmaz. */
  draw(character: CharacterSpec, skin: string, expression: ExpressionName, lid: number, faceTopMm?: number): boolean {
    const key = `${character.id}:${skin}:${expression}:${lid}:${faceTopMm?.toFixed(0) ?? '-'}`;
    if (key === this.key) return false;
    this.key = key;
    drawFace(this.ctx, this.width, this.height, expressionParams(character, skin, expression, lid, faceTopMm));
    this.texture.needsUpdate = true;
    return true;
  }

  dispose(): void { this.texture.dispose(); }
}
