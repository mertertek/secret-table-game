/**
 * D2 oda: bütçe, kabuk matematiği ve doku güvenliği.
 *
 * Testler DOM'suz (node) ortamda çalışır: doku üreticileri `document` yoksa
 * `null` döndürmeli, geometri üreticileri three ile sorunsuz kurulmalı.
 */
import { describe, expect, it } from 'vitest';
import { BufferGeometry } from 'three';
import {
  LEGACY_ROOM_DRAWS, ROOM, ROOM_LIMITS, atHeight, fogFor, octagonOutline,
  overviewDistance, roomBudget, roomFloorArea, roomPerimeter, wallSegments,
} from './roomGeometry';
import {
  bookInstances, brassGeometry, ceilingGeometry, chandelierShades, curtainGeometry,
  floorGeometry, glasswareGeometry, glowGeometry, greeneryGeometry, mapPlaneGeometry,
  posterGeometry, rugGeometry, shadeGeometry, trimGeometry, wallBandGeometry,
  windowGlassGeometry, woodGeometry,
} from './roomMeshes';
import {
  canDrawTextures, createRoomTextures, damaskTexture, nightTexture, parquetTexture,
} from './roomTextures';

const triangles = (geometry: BufferGeometry) =>
  (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;

describe('oda kabuğu ölçüleri', () => {
  it('sekizgen 8 köşe ve 8 kenardan oluşur', () => {
    expect(octagonOutline()).toHaveLength(8);
    expect(wallSegments()).toHaveLength(8);
  });

  it('düz arka duvar tasarımdaki −3,1…+3,1 aralığındadır', () => {
    const back = wallSegments().find((wall) => wall.a[1] === -ROOM.halfZ && wall.b[1] === -ROOM.halfZ)!;
    expect(back.a[0]).toBeCloseTo(-3.1, 6);
    expect(back.b[0]).toBeCloseTo(3.1, 6);
    expect(back.length).toBeCloseTo(6.2, 6);
  });

  it('her kenarın normali odanın İÇİNE bakar', () => {
    for (const wall of wallSegments()) {
      const [cx, cz] = wall.center, [nx, nz] = wall.normal;
      // merkezden içe doğru 1 cm gidince orijine yaklaşılmalı
      const before = Math.hypot(cx, cz);
      const after = Math.hypot(cx + nx * .01, cz + nz * .01);
      expect(after).toBeLessThan(before);
      expect(Math.hypot(nx, nz)).toBeCloseTo(1, 6);
    }
  });

  it('inset duvarı içeri çeker, çevre kısalır', () => {
    expect(roomPerimeter(.1)).toBeLessThan(roomPerimeter(0));
    expect(roomFloorArea(0)).toBeGreaterThan(roomFloorArea(.1));
  });

  it('oda karşı sandalyenin (z −2,0, arkası ≈ −2,35) arkasında yer bırakır', () => {
    expect(ROOM.halfZ - 2.35).toBeGreaterThan(1.5);
  });

  it('kahraman bant baş/etiket üstünde, tavanın altındadır', () => {
    const [low, high] = ROOM.heroBand;
    expect(low).toBeGreaterThan(1.56);
    expect(high).toBeLessThan(ROOM.ceilingH - ROOM.corniceH);
  });

  it('zeminden yükseklik dünya y’sine çevrilir', () => {
    expect(atHeight(0)).toBeCloseTo(ROOM.floorY, 6);
    expect(atHeight(ROOM.ceilingH)).toBeCloseTo(2.49, 6);
  });
});

describe('sis', () => {
  it('koltukta sabittir', () => {
    expect(fogFor('seat')).toEqual({ near: 6, far: 18 });
    expect(fogFor('seat', 40)).toEqual({ near: 6, far: 18 });
  });

  it('genel bakışta kamera uzaklığıyla büyür', () => {
    const near = fogFor('overview', 8);
    const far = fogFor('overview', 16);
    expect(far.near).toBeGreaterThan(near.near);
    expect(far.far).toBeGreaterThan(near.far);
  });

  it('her kadrajda arka duvarı (kameradan ≈ d + 4 m) sis içinde bırakmaz', () => {
    for (const [w, h] of [[1440, 900], [375, 812], [1024, 1366]] as const) {
      const d = overviewDistance(w, h);
      const { far } = fogFor('overview', d);
      // oda köşegeninin yarısı ≈ 6,1 m; duvar kameradan en çok d + 6,1 m uzakta
      expect(far).toBeGreaterThan(d + 6.1);
    }
  });

  it('telefon dikeyde genel bakış uzaklığı masaüstünden büyüktür', () => {
    expect(overviewDistance(375, 812)).toBeGreaterThan(overviewDistance(1440, 900));
    expect(overviewDistance(1440, 900)).toBeGreaterThanOrEqual(7.8);
  });
});

describe('bütçe', () => {
  it('standart kalite sözleşmeli sınırların altındadır', () => {
    const budget = roomBudget('standard');
    expect(budget.draws - LEGACY_ROOM_DRAWS).toBeLessThanOrEqual(ROOM_LIMITS.extraDraws);
    expect(budget.triangles).toBeLessThanOrEqual(ROOM_LIMITS.triangles);
    expect(budget.textureBytes).toBeLessThanOrEqual(ROOM_LIMITS.textureBytes);
    expect(budget.pointLights).toBeLessThanOrEqual(ROOM_LIMITS.pointLights);
  });

  it('low kalite her kalemde standarttan ucuzdur ve tek nokta ışık kullanır', () => {
    const low = roomBudget('low'), standard = roomBudget('standard');
    expect(low.draws).toBeLessThan(standard.draws);
    expect(low.triangles).toBeLessThan(standard.triangles);
    expect(low.textureBytes).toBeLessThan(standard.textureBytes);
    expect(low.pointLights).toBe(1);
  });

  it('gerçek geometri üçgen toplamı bütçeyi aşmaz', () => {
    const shell = [
      floorGeometry(), rugGeometry(),
      wallBandGeometry(0, ROOM.wainscotH, ROOM.ceilingH, 2.2),
      wallBandGeometry(.004, 0, ROOM.wainscotH + .02, 1.2),
      ceilingGeometry(), trimGeometry(false), brassGeometry(false), glowGeometry(false),
    ];
    const rest = [
      woodGeometry(), curtainGeometry(), glasswareGeometry(), shadeGeometry(),
      windowGlassGeometry(), mapPlaneGeometry(), posterGeometry(), greeneryGeometry(),
    ];
    const books = bookInstances().length * 12;
    const chandelier = chandelierShades(false).length * 14 * 2;
    const total = [...shell, ...rest].reduce((sum, geometry) => sum + triangles(geometry), 0) + books + chandelier;
    expect(total).toBeLessThanOrEqual(ROOM_LIMITS.triangles);
    expect(total).toBeLessThanOrEqual(roomBudget('standard').triangles);
    [...shell, ...rest].forEach((geometry) => geometry.dispose());
  });

  it('low kabuk gerçekten daha az üçgen üretir (panel çıtaları kapanır)', () => {
    const low = trimGeometry(true), standard = trimGeometry(false);
    expect(triangles(low)).toBeLessThan(triangles(standard));
    expect(triangles(brassGeometry(true))).toBeLessThan(triangles(brassGeometry(false)));
    expect(triangles(glowGeometry(true))).toBeLessThan(triangles(glowGeometry(false)));
    low.dispose(); standard.dispose();
  });
});

describe('geometri üretimi', () => {
  it('duvar şeridi 8 kenar × 2 üçgen üretir ve iç yüze bakar', () => {
    const band = wallBandGeometry(0, 0, 1.35, 1.2);
    expect(triangles(band)).toBe(16);
    const normal = band.getAttribute('normal');
    // ilk kenar arka duvar: normal +z
    expect(normal.getZ(0)).toBeCloseTo(1, 6);
    expect(normal.getY(0)).toBe(0);
    band.dispose();
  });

  it('duvar şeridi UV’si metre ölçeğinde tekrar eder', () => {
    const band = wallBandGeometry(0, 1.35, 3.3, 2.2);
    const uv = band.getAttribute('uv');
    let maxU = 0, maxV = 0;
    for (let i = 0; i < uv.count; i += 1) { maxU = Math.max(maxU, uv.getX(i)); maxV = Math.max(maxV, uv.getY(i)); }
    expect(maxU).toBeCloseTo(roomPerimeter(0) / 2.2, 4);
    expect(maxV).toBeCloseTo(1.95 / 2.2, 4);
    band.dispose();
  });

  it('tavan aşağı bakar ve tavan yüksekliğindedir', () => {
    const ceiling = ceilingGeometry();
    const normal = ceiling.getAttribute('normal');
    expect(normal.getY(0)).toBeCloseTo(-1, 5);
    ceiling.computeBoundingBox();
    expect(ceiling.boundingBox!.max.y).toBeCloseTo(atHeight(ROOM.ceilingH), 5);
    ceiling.dispose();
  });

  it('kitaplar iki kitaplığın raflarına sığar', () => {
    const books = bookInstances();
    expect(books.length).toBeGreaterThan(80);
    expect(books.length).toBeLessThan(400);
    for (const book of books) {
      const [x, y] = book.position;
      expect(Math.abs(x)).toBeGreaterThan(1.2);
      expect(Math.abs(x)).toBeLessThan(2.95);
      expect(y).toBeGreaterThan(ROOM.floorY);
      expect(y).toBeLessThan(atHeight(2.3));
    }
  });

  it('avize abajur sayısı kaliteyle düşer', () => {
    expect(chandelierShades(false)).toHaveLength(8);
    expect(chandelierShades(true)).toHaveLength(4);
  });

  it('oda öğeleri sekizgenin içinde kalır', () => {
    for (const build of [woodGeometry, curtainGeometry, glasswareGeometry, greeneryGeometry]) {
      const geometry = build();
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      expect(bounds.max.x).toBeLessThanOrEqual(ROOM.halfX);
      expect(bounds.min.x).toBeGreaterThanOrEqual(-ROOM.halfX);
      expect(bounds.max.z).toBeLessThanOrEqual(ROOM.halfZ);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-ROOM.halfZ);
      expect(bounds.min.y).toBeGreaterThanOrEqual(ROOM.floorY - .01);
      expect(bounds.max.y).toBeLessThanOrEqual(atHeight(ROOM.ceilingH));
      geometry.dispose();
    }
  });

  it('birleşik geometriler köşe rengi ve UV taşır (tek malzeme yeter)', () => {
    for (const build of [trimGeometry.bind(null, false), brassGeometry.bind(null, false), woodGeometry]) {
      const geometry = build();
      expect(geometry.getAttribute('color')).toBeTruthy();
      expect(geometry.getAttribute('uv')).toBeTruthy();
      geometry.dispose();
    }
  });

  it('afiş atlası dört çeyreğe bölünür', () => {
    const posters = posterGeometry();
    const uv = posters.getAttribute('uv');
    let maxU = 0, maxV = 0, minU = 1, minV = 1;
    for (let i = 0; i < uv.count; i += 1) {
      maxU = Math.max(maxU, uv.getX(i)); minU = Math.min(minU, uv.getX(i));
      maxV = Math.max(maxV, uv.getY(i)); minV = Math.min(minV, uv.getY(i));
    }
    expect(minU).toBeGreaterThanOrEqual(0);
    expect(maxU).toBeLessThanOrEqual(1);
    expect(minV).toBeGreaterThanOrEqual(0);
    expect(maxV).toBeLessThanOrEqual(1);
    posters.dispose();
  });
});

describe('dokular DOM olmadan güvenlidir', () => {
  it('bu ortamda canvas yoktur', () => {
    expect(canDrawTextures()).toBe(typeof document !== 'undefined');
  });

  it('üreticiler canvas yoksa null döner, hata atmaz', () => {
    if (canDrawTextures()) return;
    expect(parquetTexture()).toBeNull();
    expect(damaskTexture()).toBeNull();
    expect(nightTexture()).toBeNull();
    const textures = createRoomTextures('standard');
    expect(Object.values(textures).every((texture) => texture === null)).toBe(true);
  });
});
