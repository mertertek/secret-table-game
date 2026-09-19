/**
 * D2 oda geometrisi: yalnız parametrik three ilkelleri (Box/Cylinder/Lathe/Shape/
 * Plane/Torus), dış varlık yok. Tekrarlayan her şey ya `mergeGeometries` ile TEK
 * çizime iner ya da `InstancedMesh` verisi olarak dışa verilir.
 *
 * Renk, birleşmiş geometride köşe rengiyle (`vertexColors`) taşınır — bu yüzden
 * bir malzeme birçok parçaya yeter (`objects/furnitureGeometry.ts` ile aynı kalıp).
 */
import {
  BufferAttribute, BufferGeometry, BoxGeometry, CircleGeometry, Color, CylinderGeometry, LatheGeometry,
  PlaneGeometry, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette, room } from '../materials/palette';
import { ROOM, atHeight, octagonOutline, wallSegments } from './roomGeometry';
import type { WallSegment } from './roomGeometry';

type Part = {
  geometry: BufferGeometry; color: string;
  x?: number; y?: number; z?: number;
  rx?: number; ry?: number; rz?: number;
  /** UV'yi ölçekler: büyük yüzeylerde ahşap damarı gerilmesin. */
  uv?: number;
};

/** Parçaları tek geometriye indirger; renk köşe niteliğine yazılır. */
export function mergeParts(parts: Part[]): BufferGeometry {
  if (!parts.length) throw new Error('Oda geometrisi boş birleştirilemez.');
  const prepared = parts.map(({ geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, uv = 1 }) => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part !== geometry) geometry.dispose();
    if (rx) part.rotateX(rx);
    if (ry) part.rotateY(ry);
    if (rz) part.rotateZ(rz);
    part.translate(x, y, z);
    const map = part.getAttribute('uv');
    if (!map) {
      const count = part.getAttribute('position').count;
      part.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2));
    } else if (uv !== 1) {
      const array = map.array as Float32Array;
      for (let i = 0; i < array.length; i += 1) array[i] = (array[i] ?? 0) * uv;
      map.needsUpdate = true;
    }
    const rgb = new Color(color);
    const count = part.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = rgb.r; colors[i + 1] = rgb.g; colors[i + 2] = rgb.b; }
    part.setAttribute('color', new BufferAttribute(colors, 3));
    part.deleteAttribute('tangent');
    return part;
  });
  const result = mergeGeometries(prepared);
  prepared.forEach((part) => part.dispose());
  if (!result) throw new Error('Oda geometrisi birleştirilemedi.');
  return result;
}

/** Kutu; `uv` ahşap damarının gerilmesini engeller (0,55 m = bir doku tekrarı). */
const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
const grain = (w: number, h: number, d: number) => Math.max(.6, Math.max(w, h, d) / .55);

/** Bir duvar kenarına oturan kutu: uzunluk kenar boyunca, `inward` içeri kaydırır. */
function onWall(wall: WallSegment, size: { length?: number; height: number; depth: number }, h: number, inward: number, color: string, along = 0): Part {
  const length = size.length ?? wall.length;
  const [nx, nz] = wall.normal;
  return {
    geometry: box(length, size.height, size.depth), color,
    ry: -wall.angle, uv: grain(length, size.height, size.depth),
    x: wall.center[0] + nx * inward + Math.cos(wall.angle) * along,
    y: atHeight(h),
    z: wall.center[1] + nz * inward + Math.sin(wall.angle) * along,
  };
}

// ---------------------------------------------------------------------------
// 1 — Kabuk: duvar şeritleri, tavan, trim
// ---------------------------------------------------------------------------

/**
 * Sekizgen duvar şeridi (h0→h1). Üçgen sarımı İÇ yüzü ön yüz yapar → `FrontSide`
 * ile dışarıdaki genel bakış kamerası duvarları görmez ("bebek evi", tasarım §5).
 * `uScale` metre cinsinden bir doku tekrarının genişliğidir.
 */
export function wallBandGeometry(inset: number, h0: number, h1: number, uScale: number): BufferGeometry {
  const walls = wallSegments(inset);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  const y0 = atHeight(h0), y1 = atHeight(h1);
  let travelled = 0;
  for (const wall of walls) {
    const [ax, az] = wall.a, [bx, bz] = wall.b, [nx, nz] = wall.normal;
    const u0 = travelled / uScale, u1 = (travelled + wall.length) / uScale;
    const v0 = 0, v1 = (h1 - h0) / uScale;
    // a(y0) b(y0) b(y1) / a(y0) b(y1) a(y1) — normal = kenar yönü × yukarı = iç normal
    const quad: [number, number, number, number, number][] = [
      [ax, y0, az, u0, v0], [bx, y0, bz, u1, v0], [bx, y1, bz, u1, v1],
      [ax, y0, az, u0, v0], [bx, y1, bz, u1, v1], [ax, y1, az, u0, v1],
    ];
    for (const [x, y, z, u, v] of quad) {
      positions.push(x, y, z); normals.push(nx, 0, nz); uvs.push(u, v);
    }
    travelled += wall.length;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  return geometry;
}

/** Tavan: sekizgen düzlem, yüzü AŞAĞI bakar; UV metre cinsindendir. */
export function ceilingGeometry(): BufferGeometry {
  const shape = new Shape();
  octagonOutline(.02).forEach(([x, z], i) => { if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z); });
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);     // +z normali → −y (aşağı bakar)
  geometry.translate(0, atHeight(ROOM.ceilingH), 0);
  return geometry;
}

/** Zemin: sekizgeni tümüyle örten düzlem (duvar dibinde boşluk kalmaz). */
export function floorGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(ROOM.halfX * 2 + .4, ROOM.halfZ * 2 + .4);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, ROOM.floorY, 0);
  return geometry;
}

/** Bir duvar kenarına eşit aralıklı lambri panel çerçeveleri. */
function wainscotPanels(wall: WallSegment): Part[] {
  const usable = wall.length - .22;
  const count = Math.max(1, Math.round(usable / .82));
  const pitch = usable / count;
  const width = Math.min(.72, pitch - .1), height = .88;
  const parts: Part[] = [];
  for (let i = 0; i < count; i += 1) {
    const along = -usable / 2 + pitch * (i + .5);
    // çerçeve: 2 dikey + 2 yatay ince çıta
    for (const [w, hgt, dy] of [[width, .035, height / 2], [width, .035, -height / 2]] as const) {
      parts.push(onWall(wall, { length: w, height: hgt, depth: .03 }, .2 + height / 2 + dy, .045, room.wainscot2, along));
    }
    for (const dx of [-width / 2, width / 2]) {
      parts.push({ ...onWall(wall, { length: .035, height, depth: .03 }, .2 + height / 2, .045, room.wainscot2, along + dx) });
    }
  }
  return parts;
}

/**
 * Süpürgelik + korniş + (standart kalitede) lambri panel çıtaları + tavan göbeği.
 * `rose=false`: kamera koltuk yüksekliğinde DEĞİLKEN (genel bakış / tahta incelemesi)
 * tavan göbeği kadrajı kapatmasın diye çıkarılır.
 */
export function trimGeometry(low: boolean, rose = true): BufferGeometry {
  const walls = wallSegments(.015);
  const parts: Part[] = [];
  for (const wall of walls) {
    parts.push(onWall(wall, { height: ROOM.baseboardH, depth: .07 }, ROOM.baseboardH / 2, .035, room.wainscot2));
    parts.push(onWall(wall, { height: .05, depth: .05 }, ROOM.wainscotH + .02, .03, palette.walnut));
    parts.push(onWall(wall, { height: ROOM.corniceH, depth: .09 }, ROOM.ceilingH - ROOM.corniceH / 2, .045, room.cornice));
    if (!low) parts.push(...wainscotPanels(wall));
  }
  if (rose) {
    // tavan göbeği (avize kökü)
    const profile = [[0, 0], [.44, 0], [.42, .035], [.3, .06], [.26, .10], [.12, .12], [.06, .17], [0, .18]]
      .map(([r, y]) => new Vector2(r!, y!));
    parts.push({ geometry: new LatheGeometry(profile, 16), color: room.ceiling, y: atHeight(ROOM.ceilingH) - .18, rx: Math.PI, uv: 1 });
  }
  return mergeParts(parts);
}

// ---------------------------------------------------------------------------
// 2 — Pirinç: ray, avize gövdesi, aplik kolları, kulplar, ayaklı lamba gövdeleri
// ---------------------------------------------------------------------------

/** Aplik konumları: dört pah duvarı, h 2,0. */
export const sconceWalls = () => wallSegments(.02).filter((wall) => Math.abs(wall.length - Math.hypot(ROOM.chamfer, ROOM.chamfer)) < .01);

/**
 * `chandelier=false` avizeyi çıkarır: genel bakış ve tahta incelemesi kameraları
 * masanın 1,9–5,9 m üstünde durduğu için avize kadrajı tümüyle kapatıyordu.
 */
export function brassGeometry(low: boolean, chandelier = true): BufferGeometry {
  const parts: Part[] = [];
  // Pirinç ray (lambri üstü) — tüm kalitelerde.
  for (const wall of wallSegments(.02)) {
    parts.push(onWall(wall, { height: .04, depth: .035 }, ROOM.railH - .02, .03, palette.brass));
  }
  // Avize: zincir + halka + 8 kol.
  const ringY = atHeight(ROOM.chandelierH);
  if (chandelier) {
    parts.push({ geometry: new CylinderGeometry(.016, .016, ROOM.ceilingH - ROOM.chandelierH - .1, 8), color: palette.brass, y: ringY + (ROOM.ceilingH - ROOM.chandelierH - .1) / 2 });
    parts.push({ geometry: new TorusGeometry(ROOM.chandelierR, .022, 6, 40), color: palette.brass, y: ringY, rx: Math.PI / 2 });
    parts.push({ geometry: new TorusGeometry(ROOM.chandelierR * .42, .016, 5, 24), color: palette.brass, y: ringY + .13, rx: Math.PI / 2 });
    for (let i = 0; i < 8; i += 1) {
      const a = i / 8 * Math.PI * 2;
      parts.push({
        geometry: box(ROOM.chandelierR * .62, .016, .016), color: palette.brass,
        ry: -a, rz: -.22,
        x: Math.cos(a) * ROOM.chandelierR * .72, y: ringY + .07, z: Math.sin(a) * ROOM.chandelierR * .72,
      });
    }
  }
  if (low) return mergeParts(parts);
  // Aplik (4 pah duvarı): arkalık + kol. Arkalık olmadan abajur duvarda uçuyordu.
  for (const wall of sconceWalls()) {
    const [nx, nz] = wall.normal;
    parts.push({
      geometry: box(.14, .34, .03), color: palette.brass, ry: -wall.angle,
      x: wall.center[0] + nx * .025, y: atHeight(1.98), z: wall.center[1] + nz * .025,
    });
    parts.push({
      geometry: box(.045, .045, .2), color: palette.brass, ry: -wall.angle,
      x: wall.center[0] + nx * .12, y: atHeight(2.02), z: wall.center[1] + nz * .12,
    });
  }
  // Ayaklı lamba gövdeleri (x ±3,6 · z −1,7) — eski 3 parçadan birleşik gövdeye.
  for (const sx of [-3.6, 3.6]) {
    parts.push({ geometry: new CylinderGeometry(.19, .22, .08, 20), color: palette.brass, x: sx, y: atHeight(.04), z: -1.7 });
    parts.push({ geometry: new CylinderGeometry(.018, .026, 1.2, 10), color: palette.brass, x: sx, y: atHeight(.64), z: -1.7 });
  }
  // Konsol lambası pirinç gövdesi.
  parts.push({ geometry: new CylinderGeometry(.05, .08, .04, 16), color: palette.brass, x: .58, y: atHeight(.87), z: -3.75 });
  parts.push({ geometry: new CylinderGeometry(.017, .017, .4, 10), color: palette.brass, x: .58, y: atHeight(1.09), z: -3.75 });
  // Kapı kolları.
  for (const dx of [-.12, .12]) {
    parts.push({ geometry: new SphereGeometry(.038, 10, 8), color: palette.brass, x: dx, y: atHeight(1.05), z: 3.86 });
  }
  // Askılık (sol ön pah) ve bar arabası çerçevesi (sağ ön pah).
  parts.push({ geometry: new CylinderGeometry(.03, .03, 1.75, 8), color: room.brassDark, x: -3.45, y: atHeight(.88), z: 2.95 });
  for (let i = 0; i < 4; i += 1) {
    const a = i / 4 * Math.PI * 2 + .4;
    parts.push({ geometry: box(.2, .022, .022), color: room.brassDark, ry: -a, x: -3.45 + Math.cos(a) * .11, y: atHeight(1.68), z: 2.95 + Math.sin(a) * .11 });
  }
  for (const dx of [-.26, .26]) for (const dz of [-.18, .18]) {
    parts.push({ geometry: new CylinderGeometry(.014, .014, .74, 8), color: room.brassDark, x: 3.5 + dx, y: atHeight(.37), z: 2.9 + dz });
  }
  return mergeParts(parts);
}

// ---------------------------------------------------------------------------
// 3 — Işıltı (unlit): ampuller, radyo kadranı, aplik konileri, yeşil lamba içi
// ---------------------------------------------------------------------------

export function glowGeometry(low: boolean, chandelier = true): BufferGeometry {
  const parts: Part[] = [];
  const ringY = atHeight(ROOM.chandelierH);
  if (chandelier) for (let i = 0; i < 8; i += 1) {
    const a = i / 8 * Math.PI * 2;
    parts.push({
      geometry: new SphereGeometry(.045, 8, 6), color: room.lampWarm,
      x: Math.cos(a) * ROOM.chandelierR, y: ringY - .14, z: Math.sin(a) * ROOM.chandelierR,
    });
  }
  // Low + avizesiz durumda dizi boş kalmasın: ray ışıltısı yerine görünmez nokta.
  if (low && !chandelier) parts.push({ geometry: new SphereGeometry(.0001, 3, 2), color: room.lampWarm, y: atHeight(ROOM.ceilingH) });
  if (low) return mergeParts(parts);
  for (const wall of sconceWalls()) {
    const [nx, nz] = wall.normal;
    parts.push({
      geometry: new CylinderGeometry(.105, .05, .17, 12, 1, true), color: room.lampWarm, ry: -wall.angle,
      x: wall.center[0] + nx * .2, y: atHeight(2.06), z: wall.center[1] + nz * .2,
    });
  }
  // Radyo kadranı (konsol solu).
  parts.push({ geometry: box(.3, .07, .012), color: room.lampGlow, x: -.55, y: atHeight(1.06), z: -3.53 });
  // Yeşil lambanın içi.
  parts.push({ geometry: new CylinderGeometry(.15, .09, .01, 16), color: room.lampGlow, x: .58, y: atHeight(1.27), z: -3.75 });
  // Ayaklı lamba ampulleri.
  for (const sx of [-3.6, 3.6]) parts.push({ geometry: new SphereGeometry(.05, 8, 6), color: room.lampWarm, x: sx, y: atHeight(1.22), z: -1.7 });
  return mergeParts(parts);
}

/** Abajurlar: avize dışındaki tüm abajur kabukları tek çizimde. */
export function shadeGeometry(): BufferGeometry {
  const cone = (r0: number, r1: number, height: number) =>
    new LatheGeometry([new Vector2(r0, 0), new Vector2(r1, height)], 18);
  const parts: Part[] = [
    ...[-3.6, 3.6].map((sx) => ({ geometry: cone(.32, .18, .35), color: '#f4d3a1', x: sx, y: atHeight(1.06), z: -1.7 })),
    { geometry: cone(.2, .1, .13), color: room.lampGreen, x: .58, y: atHeight(1.27), z: -3.75 },
  ];
  return mergeParts(parts);
}

/** Avize abajuru — 8 kez örneklenir (`chandelierShades`). */
export function chandelierShadeGeometry(): BufferGeometry {
  return new LatheGeometry([new Vector2(.055, .17), new Vector2(.135, 0)], 14);
}

export function chandelierShades(low: boolean, chandelier = true): { position: [number, number, number] }[] {
  const count = chandelier ? (low ? 4 : 8) : 0;
  const y = atHeight(ROOM.chandelierH) - .17;
  return Array.from({ length: count }, (_, i) => {
    const a = i / count * Math.PI * 2;
    return { position: [Math.cos(a) * ROOM.chandelierR, y, Math.sin(a) * ROOM.chandelierR] as [number, number, number] };
  });
}

// ---------------------------------------------------------------------------
// 4 — Ahşap mobilya (D2.2): kitaplık, pencere kasası, konsol, sehpa, kapı, çerçeveler
// ---------------------------------------------------------------------------

const BOOKCASE = { x: 2.1, z: -3.8, w: 1.6, d: .35, h: 2.3 } as const;
/** Raf tahtalarının merkez yüksekliği; kitap örnekleri de bunu kullanır. */
const SHELF_CENTERS = [.54, .98, 1.42, 1.86] as const;
/** Kitapların oturduğu raf üstü (alt tabla dahil) ve üstündeki boşluğun tavanı. */
const SHELF_BAYS = [[.1, .526], [.554, .966], [.994, 1.406], [1.434, 1.846], [1.874, 2.25]] as const;

export function woodGeometry(): BufferGeometry {
  const parts: Part[] = [];
  const push = (w: number, h: number, d: number, x: number, hh: number, z: number, color: string = palette.walnut, ry = 0) =>
    parts.push({ geometry: box(w, h, d), color, x, y: atHeight(hh), z, ry, uv: grain(w, h, d) });

  // Kitaplık ×2: yanlar, tepe, taban, 4 raf, arka panel.
  for (const side of [-1, 1]) {
    const cx = side * BOOKCASE.x;
    push(.05, BOOKCASE.h, BOOKCASE.d, cx - BOOKCASE.w / 2, BOOKCASE.h / 2, BOOKCASE.z);
    push(.05, BOOKCASE.h, BOOKCASE.d, cx + BOOKCASE.w / 2, BOOKCASE.h / 2, BOOKCASE.z);
    push(BOOKCASE.w, .07, BOOKCASE.d, cx, BOOKCASE.h - .035, BOOKCASE.z);
    push(BOOKCASE.w, .1, BOOKCASE.d, cx, .05, BOOKCASE.z);
    for (const hh of SHELF_CENTERS) push(BOOKCASE.w - .1, .028, BOOKCASE.d - .03, cx, hh, BOOKCASE.z);
    push(BOOKCASE.w, BOOKCASE.h - .17, .02, cx, BOOKCASE.h / 2, BOOKCASE.z - BOOKCASE.d / 2 + .01, room.wainscot);
    // korniş
    push(BOOKCASE.w + .09, .06, BOOKCASE.d + .06, cx, BOOKCASE.h + .03, BOOKCASE.z + .02, room.wainscot2);
  }

  // Pencere kasası (z −3,98) — dikmeler, üst/alt kayıt, orta kayıt, denizlik.
  for (const dx of [-.95, .95]) push(.12, 1.85, .12, dx, 1.72, -3.93);
  push(2.02, .12, .12, 0, 2.66, -3.93);
  push(2.02, .1, .12, 0, .84, -3.93);
  push(2.2, .06, .18, 0, .77, -3.9, room.wainscot2);
  push(.07, 1.7, .07, 0, 1.75, -3.93);
  push(1.84, .07, .07, 0, 2.06, -3.93);

  // Konsol (x 0, z −3,75): tabla, gövde, 3 kapak çıtası, 4 ayak.
  push(1.78, .05, .5, 0, .83, -3.75, room.wainscot2);
  push(1.66, .46, .42, 0, .57, -3.75);
  for (const dx of [-.55, 0, .55]) push(.5, .34, .02, dx, .57, -3.55, room.wainscot2);
  for (const dx of [-.76, .76]) for (const dz of [-.18, .18]) push(.07, .34, .07, dx, .17, -3.75 + dz);

  // Radyo gövdesi (konsol solu).
  push(.45, .4, .25, -.55, 1.06, -3.68, room.wainscot2);
  push(.34, .16, .02, -.55, 1.21, -3.545, room.wainscot);

  // Sehpa ×2 (x ±3,6 · z −0,95) + küllük tablası.
  for (const sx of [-3.6, 3.6]) {
    parts.push({ geometry: new CylinderGeometry(.27, .27, .04, 20), color: palette.walnut, x: sx, y: atHeight(.6), z: -.95, uv: 1 });
    parts.push({ geometry: new CylinderGeometry(.06, .09, .58, 12), color: palette.walnut, x: sx, y: atHeight(.31), z: -.95, uv: 1 });
    parts.push({ geometry: new CylinderGeometry(.2, .16, .025, 14), color: room.wainscot2, x: sx, y: atHeight(.03), z: -.95, uv: 1 });
    parts.push({ geometry: new LatheGeometry([new Vector2(.02, 0), new Vector2(.07, 0), new Vector2(.075, .03), new Vector2(.055, .035)], 12), color: '#5a5a52', x: sx, y: atHeight(.62), z: -.95, uv: 1 });
  }

  // Çift kapı (yakın duvar z +4) — kasa, iki kanat, iki panel.
  push(1.5, .1, .1, 0, 2.35, 3.93);
  for (const dx of [-.78, .78]) push(.1, 2.3, .1, dx, 1.15, 3.93);
  for (const dx of [-.34, .34]) {
    push(.66, 2.24, .06, dx, 1.12, 3.9, room.wainscot);
    push(.46, .86, .02, dx, 1.62, 3.86, room.wainscot2);
    push(.46, .7, .02, dx, .66, 3.86, room.wainscot2);
  }

  // Duvar çerçeveleri: harita (sol duvar) + 3 afiş & saat (sağ duvar).
  // Sol duvar: harita 1,5 × 1,1 (z −1,6…−0,1 · h 1,6…2,7)
  for (const dz of [-1.65, -.05]) parts.push({ geometry: box(.05, 1.2, .06), color: room.wainscot2, x: -4.53, y: atHeight(2.15), z: dz, uv: 1 });
  for (const dy of [-.6, .6]) parts.push({ geometry: box(.05, .06, 1.72), color: room.wainscot2, x: -4.53, y: atHeight(2.15 + dy), z: -.85, uv: 1 });
  // Sağ duvar: 3 afiş
  for (const cz of [-1.9, -1.1, -.3]) {
    for (const dz of [-.36, .36]) parts.push({ geometry: box(.05, .95, .05), color: room.wainscot2, x: 4.53, y: atHeight(2.15), z: cz + dz, uv: 1 });
    for (const dy of [-.48, .48]) parts.push({ geometry: box(.05, .05, .77), color: room.wainscot2, x: 4.53, y: atHeight(2.15 + dy), z: cz, uv: 1 });
  }
  // Saat gövdesi (sağ duvar, z +0,6 · h 2,75)
  // Gövde kadranın 4 cm ARKASINDA durur: eş düzlemde z-fighting moiré yapıyordu.
  parts.push({ geometry: new CylinderGeometry(.25, .25, .07, 22), color: room.wainscot2, x: 4.55, y: atHeight(2.6), z: .6, rz: Math.PI / 2, uv: 1 });
  // Bitki saksısı ve küre ayağı (ön/arka pahlar).
  parts.push({ geometry: new LatheGeometry([new Vector2(.17, 0), new Vector2(.22, .06), new Vector2(.2, .3), new Vector2(.23, .34), new Vector2(0, .35)], 14), color: room.wainscot2, x: -3.6, y: ROOM.floorY, z: -3.05, uv: 1 });
  parts.push({ geometry: new CylinderGeometry(.05, .17, .62, 12), color: palette.walnut, x: 3.6, y: atHeight(.31), z: -3.05, uv: 1 });
  parts.push({ geometry: new TorusGeometry(.24, .018, 5, 20), color: room.brassDark, x: 3.6, y: atHeight(.86), z: -3.05, rx: .5, uv: 1 });
  // Bar arabası tablaları.
  for (const hh of [.74, .34]) parts.push({ geometry: box(.62, .035, .42), color: palette.walnut, x: 3.5, y: atHeight(hh), z: 2.9, uv: grain(.62, .035, .42) });

  return mergeParts(parts);
}

/** Perde + pelmet: sinüs profilli pileler (`ExtrudeGeometry` yerine ucuz kutu pile). */
export function curtainGeometry(): BufferGeometry {
  const parts: Part[] = [];
  const height = 2.68;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      const x = side * (.98 + t * .48);
      const depth = .07 + Math.sin(i * 1.1) * .022;
      parts.push({
        geometry: box(.1, height, depth),
        color: i % 2 === 0 ? room.velvet : room.velvet2,
        x, y: atHeight(.1 + height / 2), z: -3.82 - (i % 2 ? .02 : 0),
        uv: 1,
      });
    }
  }
  // pelmet (perde alınlığı)
  parts.push({ geometry: box(3.1, .24, .2), color: room.velvet, x: 0, y: atHeight(2.78), z: -3.84, uv: 1 });
  for (let i = 0; i < 10; i += 1) {
    parts.push({ geometry: box(.26, .1, .18), color: room.velvet2, x: -1.35 + i * .3, y: atHeight(2.64), z: -3.84, uv: 1 });
  }
  return mergeParts(parts);
}

/** Sürahi + 3 bardak (konsol ortası). */
export function glasswareGeometry(): BufferGeometry {
  const carafe = new LatheGeometry([
    new Vector2(0, 0), new Vector2(.075, 0), new Vector2(.085, .05), new Vector2(.07, .13),
    new Vector2(.035, .18), new Vector2(.04, .23), new Vector2(.032, .24),
  ], 14);
  const glass = () => new LatheGeometry([
    new Vector2(0, 0), new Vector2(.032, 0), new Vector2(.036, .02), new Vector2(.034, .09), new Vector2(.03, .095),
  ], 12);
  const parts: Part[] = [{ geometry: carafe, color: room.moon, x: 0, y: atHeight(.855), z: -3.75, uv: 1 }];
  for (let i = 0; i < 3; i += 1) {
    parts.push({ geometry: glass(), color: room.moon, x: .16 + i * .09, y: atHeight(.855), z: -3.72 + (i % 2) * .07, uv: 1 });
  }
  return mergeParts(parts);
}

/** Yeşillik + küre: köşe eşyalarının renkli kütleleri. */
export function greeneryGeometry(): BufferGeometry {
  const parts: Part[] = [];
  const leaf = () => new SphereGeometry(.19, 7, 5);
  for (let i = 0; i < 9; i += 1) {
    const a = i / 9 * Math.PI * 2;
    const lift = .45 + (i % 3) * .16;
    parts.push({
      geometry: leaf(), color: i % 2 ? '#3d5a4a' : '#4a5a3a',
      x: -3.6 + Math.cos(a) * .22, y: atHeight(lift), z: -3.05 + Math.sin(a) * .2,
      rz: .3, uv: 1,
    });
  }
  parts.push({ geometry: new SphereGeometry(.24, 16, 12), color: '#2f4a58', x: 3.6, y: atHeight(.86), z: -3.05, uv: 1 });
  // askılıktaki palto kütlesi
  parts.push({ geometry: new SphereGeometry(.17, 10, 8), color: '#3a3f3a', x: -3.45, y: atHeight(1.35), z: 3.06, uv: 1 });
  return mergeParts(parts);
}

// ---------------------------------------------------------------------------
// 5 — Örneklenen kitaplar
// ---------------------------------------------------------------------------

export type BookInstance = {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  tilt: number;
};

/** Kitaplık raflarını dolduran sırtlar; her raf sona doğru seyrelir. */
export function bookInstances(): BookInstance[] {
  let seed = 1543;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const books: BookInstance[] = [];
  for (const side of [-1, 1]) {
    const cx = side * BOOKCASE.x;
    for (const [base, top] of SHELF_BAYS) {
      const gap = top - base;
      let x = cx - BOOKCASE.w / 2 + .06;
      const limit = cx + BOOKCASE.w / 2 - .06 - random() * .3;
      while (x < limit) {
        const width = .022 + random() * .036;
        const height = gap * (.7 + random() * .26);
        const tilt = random() > .93 ? (random() - .5) * .3 : 0;
        books.push({
          position: [x + width / 2, atHeight(base + height / 2), BOOKCASE.z - .02],
          scale: [width, height, .24 + random() * .04],
          color: room.books[Math.floor(random() * room.books.length)]!,
          tilt,
        });
        x += width + .004;
      }
    }
  }
  return books;
}

/** Pencere camı (gece dokusu) — ayrı düzlem, emissive. */
export function windowGlassGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(1.84, 1.72);
  geometry.translate(0, atHeight(1.74), -3.975);
  return geometry;
}

/** Harita düzlemi (sol duvar, içeri bakar). */
export function mapPlaneGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(1.62, 1.12);
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-4.5, atHeight(2.15), -.85);
  return geometry;
}

/**
 * Sağ duvar afiş atlası: 3 afiş + saat kadranı tek dokudan (UV çeyrekleri).
 * Atlas: (0,0)=afiş1 sol-üst · (1,0)=afiş2 · (0,1)=afiş3 · (1,1)=saat.
 */
export function posterGeometry(): BufferGeometry {
  const quads: BufferGeometry[] = [];
  const place = (width: number, height: number, z: number, h: number, col: number, row: number, x = 4.5) => {
    const plane = new PlaneGeometry(width, height);
    const uv = plane.getAttribute('uv');
    const array = uv.array as Float32Array;
    for (let i = 0; i < array.length; i += 2) {
      array[i] = (array[i]! * .98 + .01 + col) / 2;
      array[i + 1] = (array[i + 1]! * .98 + .01 + (1 - row)) / 2;
    }
    uv.needsUpdate = true;
    plane.rotateY(-Math.PI / 2);
    plane.translate(x, atHeight(h), z);
    quads.push(plane);
  };
  place(.66, .9, -1.9, 2.15, 0, 0);
  place(.66, .9, -1.1, 2.15, 1, 0);
  place(.66, .9, -.3, 2.15, 0, 1);
  place(.44, .44, .6, 2.6, 1, 1, 4.49);
  const merged = mergeGeometries(quads);
  quads.forEach((q) => q.dispose());
  if (!merged) throw new Error('Afiş atlası birleştirilemedi.');
  return merged;
}

/** Halı: mevcut elips ölçüsü korunur (7,2 × 5,5). */
export function rugGeometry(): BufferGeometry {
  const geometry = new CircleGeometry(1, 96);
  geometry.scale(3.6, 2.75, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, ROOM.floorY + .005, 0);
  return geometry;
}
