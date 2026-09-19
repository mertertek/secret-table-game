/**
 * D3 §b/§f/§g — SDF → marching cubes → köşe kümeleme → vertex renk + skin +
 * yüz UV/malzeme grubu → tek `BufferGeometry`.
 *
 * Önbellek iki katmanlı: geometrik kısım `karakter:kademe` (konum, normal, skin,
 * uv, indis — ten değişince yeniden üretilmez), tam geometri `karakter:ten:kademe`
 * (yalnız `color` özniteliği kopyadır). Oyuncu başına 2 çizim: gövde grubu
 * (vertex renk) + yüz grubu (tuval dokusu).
 */
import { BufferAttribute, BufferGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, TorusGeometry, Vector3 } from 'three';
import { Color } from 'three';
import { clusterDecimate, gradientNormals, marchField, projectToSurface, taubinSmooth } from '../hands/marchingCubes';
import type { MeshData } from '../hands/marchingCubes';
import { characterField, evalPrim, primThinness } from './field';
import type { CharacterField, Nearest2, Prim } from './field';
import {
  BOUNDARY_LIMIT, BOUNDARY_SEARCH, NO_BOUNDARY, boundaryDistance, colorFromKey,
  palette, primColorKey, primDistances,
} from './colors';
import type { BoundaryMech, ColorKey } from './colors';
import { BONE_INDEX, skinWeights } from './skeleton';
import { SPEC, characterSpec, skinTones } from './spec';
import type { CharacterSpec, SkinId, Tier } from './spec';

/**
 * §g bütçesi QEM sadeleştirme varsayar (`meshoptimizer`); yeni bağımlılık
 * yasak olduğu için D1'in köşe kümeleme seyreltmesi kullanılır. `cell` üçgen
 * sayısını belirler (üçgen ≈ 2 · alan / cell²); baş ve yüz penceresi
 * `refineFactor` ile daha ince kümelenir.
 *
 * Tur 3: `project` = iso-yüzeye Newton yansıtma iterasyon sayısı, `gradient` =
 * köşe normalini SDF gradyanından hesapla. İkisi de köşe başına 6–7 EK alan
 * çağrısıdır ve yüzeydeki noktalar en pahalı örneklerdir (AABB elemesi orada
 * çalışmaz): standard'da ~+300 ms, low'da ~+30 ms (köşe sayısı 1/4).
 */
export const TIERS: Readonly<Record<Tier, { voxel: number; cell: number; refine: number; castShadow: boolean; smooth: number; project: number; gradient: boolean; face: readonly [number, number] }>> = {
  standard: { voxel: .007, cell: .0245, refine: .60, castShadow: true, smooth: 3, project: 2, gradient: true, face: [1024, 768] },
  low: { voxel: .012, cell: .034, refine: .60, castShadow: false, smooth: 2, project: 1, gradient: true, face: [512, 384] },
};

/**
 * Bu yarıçapın altındaki ilkellerin köşeleri yumuşatmada SABİTLENİR
 * (gözlük teli 8 mm, zincir 7 mm, siperlik 14 mm, burun 20 mm, düğme 12 mm).
 */
const PIN_RADIUS = .021;

/**
 * İnce tel aksesuarları (gözlük halkası/sapı/köprüsü, zincir) gerçek
 * torus/silindir olarak üretilir ve aynı `BufferGeometry`'ye eklenir: SDF'te
 * 9 mm voxelle lekeye dönüşüyorlardı. Ağırlık head 1,0, UV 0 → gövde grubunda
 * çizilir, ek çizim çağrısı YOKTUR.
 */
function wireMesh(prim: Prim): BufferGeometry {
  let geometry: BufferGeometry;
  const matrix = new Matrix4();
  if (prim.kind === 4) {
    // Tur 3: 6×18 → 8×28. Halka yakın planda (1,2 m) köşeli okunuyordu;
    // 8 mm boru ~1,2 k üçgen ekler, gövde bütçesinin yanında ihmal edilebilir.
    geometry = new TorusGeometry(prim.rx, prim.ry, 8, 28);
    if (prim.axis === 1) geometry.rotateX(Math.PI / 2);
    else if (prim.axis === 0) geometry.rotateY(Math.PI / 2);
    if (prim.rotEuler) geometry.applyMatrix4(matrix.makeRotationFromEuler(new Euler(...prim.rotEuler, 'XYZ')));
    geometry.translate(prim.cx, prim.cy, prim.cz);
    return geometry;
  }
  // Kapsül → kapaklı silindir: a → b ekseni, uçlar başın/lensin içinde kalır.
  const a = new Vector3(prim.ax, prim.ay, prim.az), b = new Vector3(prim.bx, prim.by, prim.bz);
  const dir = new Vector3().subVectors(b, a);
  const length = dir.length() || .001;
  geometry = new CylinderGeometry(prim.r1, prim.r0, length, 12, 1, false);
  geometry.applyMatrix4(matrix.makeRotationFromQuaternion(
    new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()),
  ));
  geometry.translate((prim.ax + prim.bx) / 2, (prim.ay + prim.by) / 2, (prim.az + prim.bz) / 2);
  return geometry;
}

/** §f yüz penceresi (planar Z projeksiyonu). */
const WINDOW = {
  x0: SPEC.faces.window.x[0]!, x1: SPEC.faces.window.x[1]!,
  y0: SPEC.faces.window.y[0]!, y1: SPEC.faces.window.y[1]!,
  nz: SPEC.faces.membership.normalZmax,
};
const FACE_PRIMS = new Set(['head', 'cheek.L', 'cheek.R']);

/**
 * Kümelemede korunacak bölgeler: yüz penceresi, boyun/omuz dikişi, dirsek bandı
 * ve giysi ÖN BÖLGESİ. Ön bölge önemlidir: V yaka / orta şerit sınırı yalnız
 * köşe rengiyle çizildiği için hücre boyu kadar (24 mm) zikzak yapar; burada
 * hücre 0,6 katına iner (§e "1 üçgen tolerans" notu).
 */
function refinePredicate(x: number, y: number, z: number): boolean {
  if (z < -.06 && y > WINDOW.y0 && y < WINDOW.y1 && x > WINDOW.x0 && x < WINDOW.x1) return true; // yüz penceresi
  if (y > .34 && y < .60 && (z < -.04 || Math.abs(x) > .15)) return true;  // yaka/V + omuz sınırı
  return Math.abs(y - .40) < .025 && Math.abs(x) > .17;                    // dirsek bandı
}

type BaseBuild = {
  positions: Float32Array; normals: Float32Array; uv: Float32Array;
  indices: Uint32Array; bodyCount: number; faceCount: number;
  faceTop: number;
  skinIndex: Uint16Array; skinWeight: Float32Array;
  /** Tur 4 — sınır kenar-yumuşatması: bölge tablosu + köşe başına iki bölge + işaretli uzaklık. */
  keyTable: readonly ColorKey[]; keyA: Uint8Array; keyB: Uint8Array; boundary: Float32Array;
  triangles: number; vertices: number; buildMs: number; rawTriangles: number;
  /** Sınır bağlamı için çoğaltılan köşe sayısı (rapor/test). */
  splitVertices: number;
};

const baseCache = new Map<string, BaseBuild>();
const geometryCache = new Map<string, CharacterBuild>();

/** Palet yuvaları — her karakterde vardır, tablonun başında sabit dururlar. */
const SLOT_KEYS: readonly ColorKey[] = ['skin', 'skinShadow', 'outfit', 'outfitDark', 'shirt', 'leg'];
const MECHS: readonly BoundaryMech[] = ['prim', 'front', 'neck'];
/** `köşe * CTX_STRIDE + bağlam` anahtarı; bağlam sayısı bunu aşamaz. */
const CTX_STRIDE = 4096;

type SplitInput = {
  positions: Float32Array; normals: Float32Array; uv: Float32Array;
  skinIndex: Uint16Array; skinWeight: Float32Array; prims: readonly Prim[];
  body: readonly number[]; face: readonly number[];
};

/**
 * Tur 4 — SINIR BAĞLAMI. Her üçgene, köşelerinin bölgelerinden türeyen tek bir
 * `(bölgeA, bölgeB, mekanizma)` bağlamı atanır; üçgenin üç köşesi de o bağlamın
 * iki rengini ve sınıra İŞARETLİ uzaklığını taşır. Bir köşe farklı bağlamlı
 * üçgenlere aitse ÇOĞALTILIR — böylece `vColor`/`vColorB` üçgen boyunca sabit
 * kalır ve shader sıfır düzeyini tam olarak sınıra oturtur.
 *
 * Üçgen sayısı DEĞİŞMEZ; yalnız sınır boyunca birkaç yüz köşe kopyalanır.
 *
 * Mekanizma seçimi: işaretleri köşelerin kendi bölgeleriyle UYUŞAN adaylar
 * arasından |uzaklık| toplamı en küçük olan (= en yakın gerçek sınır) seçilir.
 */
function splitByBoundary(field: CharacterField, spec: CharacterSpec, input: SplitInput) {
  const outfit = SPEC.outfits[spec.outfit];
  const count = input.positions.length / 3;
  const pos = input.positions;

  const keyTable: ColorKey[] = [...SLOT_KEYS];
  const keyIndex = new Map<ColorKey, number>(keyTable.map((k, i) => [k, i]));
  for (const p of field.all) {
    if (p.color && !keyIndex.has(p.color)) { keyIndex.set(p.color, keyTable.length); keyTable.push(p.color); }
  }
  if (keyTable.length > 255) throw new Error('D3: bölge tablosu 255 anahtarı aşıyor');
  const K = keyTable.length;

  // --- köşe başına bölge + bölge uzaklıkları --------------------------------
  const wireSet = new Set<Prim>(field.wires);
  const own = new Uint8Array(count);
  const dist = new Float32Array(count * K);
  const eligible = new Uint8Array(field.colorPrims.length);
  const row = new Float64Array(K);
  for (let v = 0; v < count; v++) {
    const x = pos[v * 3]!, y = pos[v * 3 + 1]!, z = pos[v * 3 + 2]!;
    const prim = input.prims[v]!;
    own[v] = keyIndex.get(primColorKey(prim, x, y, z, spec))!;
    // Tel aksesuarları (gözlük/zincir) SDF yüzeyinin parçası değildir: kendi
    // düz renklerini taşırlar, sınırları yoktur.
    if (wireSet.has(prim)) { dist.fill(Infinity, v * K, v * K + K); continue; }
    const cap = evalPrim(prim, x, y, z) + BOUNDARY_SEARCH;
    field.colorEligible(x, y, z, eligible);
    primDistances(field.colorPrims, eligible, keyIndex, spec, x, y, z, cap, row);
    dist.set(row, v * K);
  }

  // --- üçgen bağlamları ------------------------------------------------------
  const ctxA: number[] = [], ctxB: number[] = [], ctxMech: BoundaryMech[] = [];
  const ctxIndex = new Map<number, number>();
  const ctxOf = (a: number, b: number, mech: BoundaryMech): number => {
    const code = (a * 256 + b) * 4 + (mech === 'none' ? 0 : MECHS.indexOf(mech) + 1);
    const hit = ctxIndex.get(code);
    if (hit !== undefined) return hit;
    const id = ctxA.length;
    if (id >= CTX_STRIDE) throw new Error('D3: sınır bağlamı sayısı sınırı aştı');
    ctxA.push(a); ctxB.push(b); ctxMech.push(mech); ctxIndex.set(code, id);
    return id;
  };

  const outPos: number[] = [], outNormal: number[] = [], outUv: number[] = [];
  const outSkinIndex: number[] = [], outSkinWeight: number[] = [];
  const outKeyA: number[] = [], outKeyB: number[] = [], outBoundary: number[] = [];
  const copies = new Map<number, number>();
  const emit = (v: number, ctx: number, value: number): number => {
    const code = v * CTX_STRIDE + ctx;
    const hit = copies.get(code);
    if (hit !== undefined) return hit;
    const n = outKeyA.length;
    outPos.push(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!);
    outNormal.push(input.normals[v * 3]!, input.normals[v * 3 + 1]!, input.normals[v * 3 + 2]!);
    outUv.push(input.uv[v * 2]!, input.uv[v * 2 + 1]!);
    for (let i = 0; i < 4; i++) { outSkinIndex.push(input.skinIndex[v * 4 + i]!); outSkinWeight.push(input.skinWeight[v * 4 + i]!); }
    outKeyA.push(ctxA[ctx]!); outKeyB.push(ctxB[ctx]!); outBoundary.push(value);
    copies.set(code, n);
    return n;
  };

  const tri = [0, 0, 0], keys = [0, 0, 0], vals = [0, 0, 0], best = [0, 0, 0];
  const emitTriangles = (source: readonly number[], target: number[]): void => {
    for (let t = 0; t < source.length; t += 3) {
      tri[0] = source[t]!; tri[1] = source[t + 1]!; tri[2] = source[t + 2]!;
      keys[0] = own[tri[0]!]!; keys[1] = own[tri[1]!]!; keys[2] = own[tri[2]!]!;
      let ctx: number;
      if (keys[0] === keys[1] && keys[1] === keys[2]) {
        ctx = ctxOf(keys[0]!, keys[0]!, 'none');
        best[0] = best[1] = best[2] = NO_BOUNDARY;
      } else {
        const uniq = [...new Set(keys)].sort((a, b) => a - b);
        let topScore = Infinity, topA = uniq[0]!, topB = uniq[1]!, topMech: BoundaryMech | null = null;
        for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
          const ka = uniq[i]!, kb = uniq[j]!, nameA = keyTable[ka]!, nameB = keyTable[kb]!;
          const pair = `${nameA}|${nameB}`;
          for (const mech of MECHS) {
            if (mech === 'front' && !outfit.front.length) continue;
            if (mech === 'neck' && (outfit.neckRing === null || (pair !== 'skinShadow|outfit' && pair !== 'outfit|skinShadow'))) continue;
            let score = 0, ok = true, touched = false;
            for (let n = 0; n < 3; n++) {
              const v = tri[n]!;
              const value = boundaryDistance(mech, nameA, nameB, outfit,
                pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!, dist[v * K + ka]!, dist[v * K + kb]!);
              if (Number.isNaN(value)) { ok = false; break; }
              vals[n] = value;
              if (keys[n] === ka) { touched = true; if (value < 0) { ok = false; break; } score += value; }
              else if (keys[n] === kb) { touched = true; if (value > 0) { ok = false; break; } score -= value; }
            }
            if (!ok || !touched || score >= topScore) continue;
            topScore = score; topA = ka; topB = kb; topMech = mech;
            best[0] = vals[0]!; best[1] = vals[1]!; best[2] = vals[2]!;
          }
        }
        if (!topMech) {
          // Hiçbir mekanizma köşelerin bölgeleriyle uyuşmadı (üçlü kavşak gibi
          // seyrek durum): sınır köşeden köşeye keskin geçer.
          topMech = 'prim';
          for (let n = 0; n < 3; n++) best[n] = keys[n] === topA ? BOUNDARY_LIMIT : keys[n] === topB ? -BOUNDARY_LIMIT : 0;
        }
        ctx = ctxOf(topA, topB, topMech);
      }
      target.push(emit(tri[0]!, ctx, best[0]!), emit(tri[1]!, ctx, best[1]!), emit(tri[2]!, ctx, best[2]!));
    }
  };

  const body: number[] = [], face: number[] = [];
  emitTriangles(input.body, body);
  emitTriangles(input.face, face);

  return {
    positions: Float32Array.from(outPos), normals: Float32Array.from(outNormal),
    uv: Float32Array.from(outUv), skinIndex: Uint16Array.from(outSkinIndex),
    skinWeight: Float32Array.from(outSkinWeight), indices: Uint32Array.from([...body, ...face]),
    keyTable: keyTable as readonly ColorKey[], keyA: Uint8Array.from(outKeyA), keyB: Uint8Array.from(outKeyB),
    boundary: Float32Array.from(outBoundary),
  };
}

function buildBase(id: string, tier: Tier): BaseBuild {
  const started = performance.now();
  const spec = characterSpec(id);
  const { voxel, cell, refine } = TIERS[tier];
  const field = characterField(id, tier);
  const raw: MeshData = marchField(field.field, field.bounds.min, field.bounds.max, voxel);
  const clustered = clusterDecimate(raw, cell, refinePredicate, refine);

  // Kümeleme köşeleri hücre ortalamasına taşıdığı için yüzeyde voxel ölçeğinde
  // dalga kalıyor ("kil" görüntüsü). Taubin bunu siler, hacmi korur; ince
  // aksesuarlar sabitlenir. Üçgen sayısı DEĞİŞMEZ.
  const pinCount = clustered.positions.length / 3;
  const pinned = new Uint8Array(pinCount);
  for (let v = 0; v < pinCount; v++) {
    const prim = field.nearest(clustered.positions[v * 3]!, clustered.positions[v * 3 + 1]!, clustered.positions[v * 3 + 2]!);
    if (primThinness(prim) < PIN_RADIUS) pinned[v] = 1;
  }
  // Tur 3 — YENİDEN YANSITMA. Kümeleme ortalaması iso-yüzeyin İÇİNE düşer
  // (dışbükey yerlerde sistematik büzüşme, ~hücre²/8R). Newton adımı köşeleri
  // yüzeye geri çeker; tek adımda en çok hücrenin yarısı kadar taşınır.
  if (TIERS[tier].project > 0) {
    clustered.positions = projectToSurface(
      clustered.positions, field.field, voxel / 2, TIERS[tier].project, cell / 2, pinned,
    );
  }
  const mesh = taubinSmooth(clustered, TIERS[tier].smooth, .5, -.53, pinned);
  // Tur 3 — NORMALLER ALAN GRADYANINDAN. `taubinSmooth` üçgen komşuluğundan
  // alan ağırlıklı normal üretir; 23 mm üçgenlerde bu, yüzeyi faset/yumru
  // gösteriyordu. Gradyan normali üçgen sayısından bağımsız, gerçek yüzey
  // normalidir (merkezi fark, h = voxel/2).
  if (TIERS[tier].gradient) mesh.normals = gradientNormals(mesh.positions, field.field, voxel / 2);

  const count = mesh.positions.length / 3;
  const prims: Prim[] = new Array(count);
  const uv = new Float32Array(count * 2);
  const member = new Uint8Array(count);
  const near: Nearest2 = { a: field.base[0]!, da: 0, b: null, db: 0 };
  /** Yüz grubunun en üst köşesi (m): kaşın şapka/saç altında kalmaması için tavan. */
  let faceTop = WINDOW.y0;
  for (let v = 0; v < count; v++) {
    const x = mesh.positions[v * 3]!, y = mesh.positions[v * 3 + 1]!, z = mesh.positions[v * 3 + 2]!;
    field.nearest2(x, y, z, near);
    const prim = near.a;
    prims[v] = prim;
    if (FACE_PRIMS.has(prim.id) && mesh.normals[v * 3 + 2]! < WINDOW.nz &&
      x > WINDOW.x0 && x < WINDOW.x1 && y > WINDOW.y0 && y < WINDOW.y1) {
      member[v] = 1;
      if (y > faceTop) faceTop = y;
      uv[v * 2] = (x - WINDOW.x0) / (WINDOW.x1 - WINDOW.x0);
      uv[v * 2 + 1] = (y - WINDOW.y0) / (WINDOW.y1 - WINDOW.y0);
    }
  }

  // Yüz üçgenleri (3 köşesi de üye) dizinin sonuna alınır → 2 malzeme grubu.
  const body: number[] = [], face: number[] = [];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t]!, b = mesh.indices[t + 1]!, c = mesh.indices[t + 2]!;
    (member[a] && member[b] && member[c] ? face : body).push(a, b, c);
  }
  const skin = skinWeights(spec, mesh.positions, prims);

  // --- İnce tel aksesuarları (gözlük/zincir) gövde grubuna eklenir ----------
  let positions = mesh.positions, normals = mesh.normals;
  let uvAll = uv, primsAll = prims;
  let skinIndex = skin.index, skinWeight = skin.weight;
  let bodyIndices = body;
  if (field.wires.length) {
    const parts = field.wires.map((prim) => ({ prim, geometry: wireMesh(prim) }));
    let extraVertices = 0, extraIndices = 0;
    for (const part of parts) {
      extraVertices += part.geometry.getAttribute('position').count;
      extraIndices += part.geometry.getIndex()!.count;
    }
    const total = count + extraVertices;
    positions = new Float32Array(total * 3); positions.set(mesh.positions);
    normals = new Float32Array(total * 3); normals.set(mesh.normals);
    uvAll = new Float32Array(total * 2); uvAll.set(uv);
    skinIndex = new Uint16Array(total * 4); skinIndex.set(skin.index);
    skinWeight = new Float32Array(total * 4); skinWeight.set(skin.weight);
    primsAll = prims.slice();
    const head = BONE_INDEX.head;
    const wireIndices: number[] = new Array(extraIndices);
    let v = count, w = 0;
    for (const part of parts) {
      const p = part.geometry.getAttribute('position'), n = part.geometry.getAttribute('normal');
      const index = part.geometry.getIndex()!;
      for (let i = 0; i < index.count; i++) wireIndices[w++] = v + index.getX(i);
      for (let i = 0; i < p.count; i++, v++) {
        positions[v * 3] = p.getX(i); positions[v * 3 + 1] = p.getY(i); positions[v * 3 + 2] = p.getZ(i);
        normals[v * 3] = n.getX(i); normals[v * 3 + 1] = n.getY(i); normals[v * 3 + 2] = n.getZ(i);
        skinIndex[v * 4] = head; skinIndex[v * 4 + 1] = head;
        skinWeight[v * 4] = 1;
        primsAll[v] = part.prim;
      }
      part.geometry.dispose();
    }
    bodyIndices = [...body, ...wireIndices];
  }

  const split = splitByBoundary(field, spec, {
    positions, normals, uv: uvAll, skinIndex, skinWeight, prims: primsAll,
    body: bodyIndices, face,
  });

  return {
    positions: split.positions, normals: split.normals, uv: split.uv,
    indices: split.indices, bodyCount: bodyIndices.length, faceCount: face.length,
    faceTop, skinIndex: split.skinIndex, skinWeight: split.skinWeight,
    keyTable: split.keyTable, keyA: split.keyA, keyB: split.keyB, boundary: split.boundary,
    triangles: split.indices.length / 3, vertices: split.positions.length / 3,
    splitVertices: split.positions.length / 3 - positions.length / 3,
    rawTriangles: raw.indices.length / 3,
    buildMs: performance.now() - started,
  };
}

export type CharacterBuild = {
  readonly geometry: BufferGeometry;
  /** Yüz penceresinin görünen üst kenarı (karakter uzayı y, m). */
  readonly faceTop: number;
  readonly triangles: number;
  readonly faceTriangles: number;
  readonly vertices: number;
  readonly rawTriangles: number;
  /** Sınır bağlamı için çoğaltılan köşe sayısı (tur 4). */
  readonly splitVertices: number;
  readonly buildMs: number;
};

/** Karakter + ten + kademe → paylaşılan geometri (`karakter:ten:kademe` önbelleği). */
export function characterGeometry(id: string, skinId: SkinId, tier: Tier = 'standard'): CharacterBuild {
  const key = `${id}:${skinId}:${tier}`;
  const hit = geometryCache.get(key);
  if (hit) return hit;
  const started = performance.now();
  const baseKey = `${id}:${tier}`;
  let base = baseCache.get(baseKey);
  if (!base) { base = buildBase(id, tier); baseCache.set(baseKey, base); }

  const spec = characterSpec(id);
  const tone = skinTones(skinId);
  const p = palette(spec, tone);
  // Bölge tablosu bir kez renge çevrilir; köşe başına yalnız tablo okunur.
  const table = base.keyTable.map((key) => colorFromKey(key, p, new Color()));
  const colors = new Float32Array(base.vertices * 3);
  const colorsB = new Float32Array(base.vertices * 3);
  for (let v = 0; v < base.vertices; v++) {
    const a = table[base.keyA[v]!]!, b = table[base.keyB[v]!]!;
    colors[v * 3] = a.r; colors[v * 3 + 1] = a.g; colors[v * 3 + 2] = a.b;
    colorsB[v * 3] = b.r; colorsB[v * 3 + 1] = b.g; colorsB[v * 3 + 2] = b.b;
  }

  const geometry = new BufferGeometry();
  // Konum/normal/uv/skin öznitelikleri kademedeki bütün tenlerle PAYLAŞILIR
  // (aynı `BufferAttribute` nesnesi → tek GPU yüklemesi).
  geometry.setAttribute('position', new BufferAttribute(base.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(base.normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(base.uv, 2));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  // Tur 4 — sınırın öteki rengi ve sınıra işaretli uzaklık (m). `dBoundary`
  // tenle değişmez, bütün tenlerle paylaşılır (bkz. `boundaryMaterial.ts`).
  geometry.setAttribute('colorB', new BufferAttribute(colorsB, 3));
  geometry.setAttribute('dBoundary', new BufferAttribute(base.boundary, 1));
  geometry.setAttribute('skinIndex', new BufferAttribute(base.skinIndex, 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(base.skinWeight, 4));
  geometry.setIndex(new BufferAttribute(base.indices, 1));
  geometry.addGroup(0, base.bodyCount, 0);
  geometry.addGroup(base.bodyCount, base.faceCount, 1);
  geometry.computeBoundingSphere();

  const build: CharacterBuild = {
    geometry, faceTop: base.faceTop, triangles: base.triangles, faceTriangles: base.faceCount / 3,
    vertices: base.vertices, rawTriangles: base.rawTriangles, splitVertices: base.splitVertices,
    buildMs: base.buildMs + (performance.now() - started),
  };
  geometryCache.set(key, build);
  return build;
}

/** Sahne kapanışında / testlerde bütün önbellekleri bırakır. */
export function disposeCharacterGeometry(): void {
  for (const build of geometryCache.values()) build.geometry.dispose();
  geometryCache.clear();
  baseCache.clear();
}

/**
 * §g üretim kuyruğu. Standard kademe karakter başına ~0,3 s sürdüğü için oda
 * girişinde 8 karakter ana iş parçacığını saniyelerce kilitliyordu. Çözüm:
 * önce LOW kademe (~0,1 s) gösterilir, standard üretim boşta zaman diliminde
 * SIRAYLA yapılır ve hazır olunca geometri değişir. Kuyruk modül düzeyindedir,
 * böylece 10 oyuncu aynı karede 10 üretim tetiklemez.
 */
const queue: (() => void)[] = [];
let draining = false;

type IdleHost = { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number };

function schedule(run: () => void): void {
  const idle = (globalThis as unknown as IdleHost).requestIdleCallback;
  if (idle) idle(run, { timeout: 300 }); else setTimeout(run, 0);
}

function drain(): void {
  if (draining) return;
  draining = true;
  schedule(() => {
    draining = false;
    const job = queue.shift();
    if (!job) return;
    job();
    if (queue.length) drain();
  });
}

/**
 * Standard geometriyi kuyruğa alır; hazır olunca `onReady` çağrılır. Zaten
 * önbellekteyse eşzamanlı döner ve `true` verir.
 */
export function requestCharacterGeometry(id: string, skinId: SkinId, onReady: (build: CharacterBuild) => void): boolean {
  const cached = geometryCache.get(`${id}:${skinId}:standard`);
  if (cached) { onReady(cached); return true; }
  queue.push(() => onReady(characterGeometry(id, skinId, 'standard')));
  drain();
  return false;
}

/** Testler için: kuyruğu boşaltır. */
export function clearCharacterQueue(): void { queue.length = 0; }
