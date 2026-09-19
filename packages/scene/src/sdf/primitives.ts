/**
 * Paylaşılan işaretli uzaklık ilkelleri. D1 eller (`hands/sdf.ts`) ve D3
 * karakterler (`characters/field.ts`) aynı boru hattını kullanır: ilkel SDF →
 * polinom smooth-min → marching cubes (`hands/marchingCubes.ts`).
 *
 * Hız notu: bu fonksiyonlar ızgarada milyonlarca kez çağrılır; hiçbiri nesne
 * ayırmaz, bütün koordinatlar skaler geçer.
 */

/** Polinom smooth-min (iq). k ≤ 0 ise sert birleşim. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(0, Math.min(1, .5 + .5 * (b - a) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

/** Yumuşak kesişim / çıkarma: `smax(a, b, k) = −smin(−a, −b, k)`. */
export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

/** Küre. */
export function sdSphere(px: number, py: number, pz: number, cx: number, cy: number, cz: number, r: number): number {
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2) - r;
}

/** Yuvarlatılmış kutu; `h` yarı boyut (yarıçap dahil). */
export function sdRoundBox(px: number, py: number, pz: number, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, r: number): number {
  const qx = Math.abs(px - cx) - (hx - r), qy = Math.abs(py - cy) - (hy - r), qz = Math.abs(pz - cz) - (hz - r);
  const mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0, mz = qz > 0 ? qz : 0;
  return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** Elipsoid (yaklaşık işaretli uzaklık, iq — gerçek uzaklığın altında kalır). */
export function sdEllipsoid(px: number, py: number, pz: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): number {
  const kx = (px - cx) / rx, ky = (py - cy) / ry, kz = (pz - cz) / rz;
  const k0 = Math.sqrt(kx * kx + ky * ky + kz * kz);
  if (k0 === 0) return -Math.min(rx, ry, rz);
  const ax = kx / rx, ay = ky / ry, az = kz / rz;
  const k1 = Math.sqrt(ax * ax + ay * ay + az * az);
  return k0 * (k0 - 1) / k1;
}

/** Yarıçapı doğrusal değişen kapsül (round cone, iq — kesin çözüm). */
export function sdRoundCone(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r1: number, r2: number): number {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const l2 = dx * dx + dy * dy + dz * dz;
  if (l2 === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2 + (pz - az) ** 2) - Math.max(r1, r2);
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const qx = px - ax, qy = py - ay, qz = pz - az;
  const y = qx * dx + qy * dy + qz * dz, z = y - l2;
  const cx = qx * l2 - dx * y, cy = qy * l2 - dy * y, cz = qz * l2 - dz * y;
  const x2 = cx * cx + cy * cy + cz * cz;
  const y2 = y * y * l2, z2 = z * z * l2;
  const k = (rr < 0 ? -1 : rr > 0 ? 1 : 0) * rr * rr * x2;
  if ((z < 0 ? -1 : z > 0 ? 1 : 0) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if ((y < 0 ? -1 : y > 0 ? 1 : 0) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

/** Torus (kesin). `axis` halkanın normal ekseni: 0 = x, 1 = y, 2 = z. */
export function sdTorus(px: number, py: number, pz: number, cx: number, cy: number, cz: number, axis: 0 | 1 | 2, ring: number, tube: number): number {
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  const along = axis === 0 ? dx : axis === 1 ? dy : dz;
  const u = axis === 0 ? dy : dx;
  const v = axis === 2 ? dy : dz;
  const radial = Math.sqrt(u * u + v * v) - ring;
  return Math.sqrt(radial * radial + along * along) - tube;
}

/** Bir noktanın AABB'ye uzaklığı (içerideyse 0) — ilkel/grup atlamak için geçerli alt sınır. */
export function boxLower(px: number, py: number, pz: number, b: Readonly<Float64Array>): number {
  const dx = Math.max(b[0]! - px, 0, px - b[3]!), dy = Math.max(b[1]! - py, 0, py - b[4]!), dz = Math.max(b[2]! - pz, 0, pz - b[5]!);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * `boxLower`in KARESİ; `offset` konumundan başlayan düz bir AABB dizisiyle
 * çalışır. Sıcak döngüde karekök almamak için: `boxLower > t` testi
 * `t <= 0 || boxLower2 > t·t` ile aynıdır.
 */
export function boxLower2(px: number, py: number, pz: number, b: Readonly<Float64Array>): number {
  // `Math.max(a, 0, b)` (3 argümanlı) V8'de hızlı yola girmiyor; sıcak döngüde
  // ölçülebilir fark yaratıyor → karşılaştırmalar elle yazıldı.
  let dx = b[0]! - px; if (dx < 0) { dx = px - b[3]!; if (dx < 0) dx = 0; }
  let dy = b[1]! - py; if (dy < 0) { dy = py - b[4]!; if (dy < 0) dy = 0; }
  let dz = b[2]! - pz; if (dz < 0) { dz = pz - b[5]!; if (dz < 0) dz = 0; }
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Euler XYZ dönüşünün TERSİ (R transpozu) 9 sayı olarak; ilkel yerel çerçevesine
 * geçmek için `q = Rᵀ·(p − c)`. Satır-major döner.
 */
export function inverseEulerXYZ(ex: number, ey: number, ez: number): Float64Array {
  const cx = Math.cos(ex), sx = Math.sin(ex), cy = Math.cos(ey), sy = Math.sin(ey), cz = Math.cos(ez), sz = Math.sin(ez);
  // three.js Euler 'XYZ' → R = Rz? Hayır: three `makeRotationFromEuler` XYZ sırası R = Rx·Ry·Rz değil,
  // matris şu şekildedir (three/src/math/Matrix4.js, order === 'XYZ'):
  const ae = cx * cz, af = cx * sz, be = sx * cz, bf = sx * sz;
  const m = [
    cy * cz, -cy * sz, sy,
    af + be * sy, ae - bf * sy, -sx * cy,
    bf - ae * sy, be + af * sy, cx * cy,
  ];
  // Transpoz (dönme matrisinin tersi).
  return new Float64Array([m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!]);
}
