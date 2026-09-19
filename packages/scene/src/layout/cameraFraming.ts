/** `lean` (D15) YALNIZ koltuk kamerasında geçerlidir; kadrajı `leanFrame` üretir. */
export type InspectionMode = 'overview' | 'private' | 'liberal' | 'fascist' | 'lean';
export type CameraFrame = { eye: [number, number, number]; target: [number, number, number] };
/** Screen-space fit with room for the HTML inspection controls. */
export function cameraFrame(mode: InspectionMode, width: number, height: number, privateX = 0): CameraFrame {
  const aspect = width / Math.max(height, 1), tangent = Math.tan(40 * Math.PI / 360);
  if (mode === 'overview') {
    const d = Math.max(7.8, 3.3 / (tangent * aspect));
    return { eye: [0, d * .76, d * .65], target: [0, 0, .12] };
  }
  const usableHeight = Math.max(height * .45, height - 130);
  const verticalFit = height / usableHeight;
  const privateArea = mode === 'private';
  /**
   * D10: "Tahtayı incele" tahtanın 1,94 m genişliğine oturur (yarım genişlik ekranın
   * ~%94'ü). `.12` sabiti yakın kenar payıdır: tahta .45 m derin ve kamera .28·d ileride
   * durduğu için ön kenar merkezden ~.12 m daha yakındır; onsuz tahta yanlardan kırpılır.
   * Eski sabit `1.18/(tan·aspect)` tahtayı ~%87'de bırakıyordu → inceleme %5–11 yakınlaştı.
   */
  const boardFit = 1.03 / (tangent * aspect) + .12;
  const d = Math.max(privateArea ? .86 : 1.20, (privateArea ? .27 : .30) * verticalFit / tangent,
    privateArea ? .23 / (tangent * aspect) : boardFit);
  // `lean` koltuk kamerasının kipidir (`leanFrame`); buraya düşerse faşist tahta kadrajı.
  const x = privateArea ? privateX : 0, z = privateArea ? .99 : mode === 'liberal' ? -.4 : .16;
  return { eye: [x, d * .96, z + d * .28], target: [x, .02, z] };
}

// --- D15: koltuktan tahtalara eğilme ---------------------------------------

/** D15 — eğilmede bakış serbest değil, "göz gezdirme"dir: ±12° yaw, ±8° pitch. */
export const LEAN_LOOK = { yaw: 12 * Math.PI / 180, pitch: 8 * Math.PI / 180 } as const;
/** Eğilme kadrajı: konum + bakış noktası + o ekran oranı için gereken dikey fov (derece). */
export type LeanFrame = CameraFrame & { fov: number };
/** İki tahtanın birlikte kapladığı alan (D10 ölçüleri): x ±.97, z −.625…+.385, üst yüz ~.07. */
export const BOARD_SPAN = { halfWidth: .97, nearZ: .385, farZ: -.625, top: .07 } as const;
/** Liberal (z −.4) ile faşist (z .16) tahtanın ortası; eğilmede bakılan nokta. */
export const LEAN_TARGET: readonly [number, number, number] = [0, .02, -.12];
/**
 * `elevation` eğilme açısı (yatayla), `reach` koltuk–merkez yatay mesafesinin kalan oranı
 * (küçüldükçe daha çok öne eğilinir), `margin` kenar payı, `stretch` dar (telefon dikey)
 * ekranda gözün geriye kaçmasına izin verilen en çok oran.
 */
const LEAN = { elevation: 48 * Math.PI / 180, reach: .70, minOffset: .78, maxOffset: 1.22, margin: 1.07, fovMin: 40, fovMax: 90, stretch: 1.15 } as const;
const clampNumber = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Gözden bakıldığında iki tahtanın köşelerini kadraja sığdıran en küçük `tan(fov/2)`. */
function requiredTangent(eye: readonly [number, number, number], aspect: number): number {
  const fx = LEAN_TARGET[0] - eye[0], fy = LEAN_TARGET[1] - eye[1], fz = LEAN_TARGET[2] - eye[2];
  const flen = Math.hypot(fx, fy, fz) || 1;
  const f: [number, number, number] = [fx / flen, fy / flen, fz / flen];
  // Sağ = ileri × dünya yukarısı (yatay), yukarı = sağ × ileri.
  const rx = -f[2], rz = f[0], rlen = Math.hypot(rx, rz) || 1;
  const r: [number, number, number] = [rx / rlen, 0, rz / rlen];
  const u: [number, number, number] = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  let needed = 0;
  for (const dx of [-BOARD_SPAN.halfWidth, BOARD_SPAN.halfWidth]) for (const dz of [BOARD_SPAN.farZ, BOARD_SPAN.nearZ]) {
    const vx = dx - eye[0], vy = BOARD_SPAN.top - eye[1], vz = dz - eye[2];
    const depth = Math.max(vx * f[0] + vy * f[1] + vz * f[2], .05);
    const sideways = Math.abs(vx * r[0] + vy * r[1] + vz * r[2]) / depth / Math.max(aspect, .05);
    const vertical = Math.abs(vx * u[0] + vy * u[1] + vz * u[2]) / depth;
    needed = Math.max(needed, sideways, vertical);
  }
  return needed * LEAN.margin;
}

/**
 * D15 — koltuktan iki tahtanın üstüne eğilme.
 *
 * Göz KENDİ koltuğunun tarafında kalır (merkezden koltuğa doğru `offset` kadar geride),
 * yatayda merkeze doğru ilerler ve ~48° eğimle yükselir: yakın tahta altta büyük, uzak
 * tahta üstte kalır — tepeden dik bakış değildir. Dikey fov iki tahtanın köşelerinden
 * hesaplanır; geniş ekranda 40–44°, dar (telefon dikey) ekranda kadraj sığsın diye açılır
 * ve `fovMax`a dayanınca göz bir tık daha yükselir (tahtalar arka arkaya görünür).
 */
export function leanFrame(chair: readonly [number, number, number], width: number, height: number): LeanFrame {
  const aspect = width / Math.max(height, 1);
  const [tx, ty, tz] = LEAN_TARGET;
  // Koltuk gözü — `SeatCamera` ile aynı nokta.
  const seatX = chair[0], seatZ = chair[2] + .035;
  let dx = tx - seatX, dz = tz - seatZ, span = Math.hypot(dx, dz);
  if (span < 1e-4) { dx = 0; dz = -1; span = 1; }
  const ux = dx / span, uz = dz / span;
  let offset = clampNumber(span * LEAN.reach, Math.min(LEAN.minOffset, span), Math.min(LEAN.maxOffset, span));
  let rise = offset * Math.tan(LEAN.elevation);
  let eye: [number, number, number] = [tx - ux * offset, ty + rise, tz - uz * offset];
  let fov = LEAN.fovMin;
  for (let pass = 0; pass < 4; pass += 1) {
    eye = [tx - ux * offset, ty + rise, tz - uz * offset];
    const needed = requiredTangent(eye, aspect);
    fov = 2 * Math.atan(needed) * 180 / Math.PI;
    if (fov <= LEAN.fovMax || pass === 3) break;
    // Kadraj dar ekranda sığmıyor: göz geriye DEĞİL, önce yukarı kaçar.
    const grow = needed / Math.tan(LEAN.fovMax * Math.PI / 360);
    const distance = Math.hypot(offset, rise) * grow;
    offset = Math.min(offset * LEAN.stretch, span);
    rise = Math.sqrt(Math.max(distance * distance - offset * offset, offset * offset));
  }
  return { eye, target: [tx, ty, tz], fov: clampNumber(fov, LEAN.fovMin, LEAN.fovMax) };
}
