/**
 * D1 — kendi marching cubes'umuz. three'nin `MarchingCubes` nesnesi küp ızgara +
 * metaball odaklıdır; burada dikdörtgen kutu, keyfi SDF ve KÖŞE BİRLEŞTİRME gerekir
 * (her ızgara kenarı tek köşe üretir → kapalı, kaynaklı yüzey). Yalnız Paul Bourke
 * arama tabloları three/addons'tan alınır; algoritma buradadır.
 */
import { triTable } from 'three/addons/objects/MarchingCubes.js';
import type { V3 } from './anatomy';

export type MeshData = { positions: Float32Array; normals: Float32Array; indices: Uint32Array };

/** Hücre köşe sırası (Bourke): x hızlı, sonra z, sonra y. */
const CORNER: readonly V3[] = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]];
/** Kenar → [köşeA, köşeB, önbellek ızgara noktası (di,dj,dk), eksen]. */
const EDGE: readonly (readonly [number, number, number, number, number, number])[] = [
  [0, 1, 0, 0, 0, 0], [1, 2, 1, 0, 0, 2], [3, 2, 0, 0, 1, 0], [0, 3, 0, 0, 0, 2],
  [4, 5, 0, 1, 0, 0], [5, 6, 1, 1, 0, 2], [7, 6, 0, 1, 1, 0], [4, 7, 0, 1, 0, 2],
  [0, 4, 0, 0, 0, 1], [1, 5, 1, 0, 0, 1], [2, 6, 1, 0, 1, 1], [3, 7, 0, 0, 1, 1],
];

export type FieldFn = (x: number, y: number, z: number) => number;

/** SDF'yi kutu ızgarada örnekler ve iso=0 yüzeyini kaynaklı üçgen ağı olarak döndürür. */
export function marchField(field: FieldFn, min: V3, max: V3, voxel: number): MeshData {
  const nx = Math.max(2, Math.ceil((max[0] - min[0]) / voxel) + 1);
  const ny = Math.max(2, Math.ceil((max[1] - min[1]) / voxel) + 1);
  const nz = Math.max(2, Math.ceil((max[2] - min[2]) / voxel) + 1);
  const values = new Float32Array(nx * ny * nz);
  const at = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  // Kabuk taraması: önce S kat kaba ızgara. SDF 1-Lipschitz olduğundan bir blok
  // köşelerinin en küçük değeri `safe + 2·voxel` üstündeyse blok yüzeyden uzaktır;
  // o 64 nokta hesaplanmadan pozitif bir alt sınırla doldurulur (işaret doğru,
  // komşu kenarlarda sıfır geçişi imkânsız).
  const S = 4, step = S * voxel, safe = step * Math.sqrt(3) / 2, cut = safe + 2 * voxel;
  const cnx = Math.floor((nx - 1) / S) + 2, cny = Math.floor((ny - 1) / S) + 2, cnz = Math.floor((nz - 1) / S) + 2;
  const coarse = new Float32Array(cnx * cny * cnz);
  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
    coarse[(k * cny + j) * cnx + i] = field(min[0] + i * step, min[1] + j * step, min[2] + k * step);
  }
  for (let ck = 0; ck < cnz - 1; ck++) for (let cj = 0; cj < cny - 1; cj++) for (let ci = 0; ci < cnx - 1; ci++) {
    let lowest = Infinity, highest = -Infinity;
    for (let a = 0; a < 8; a++) {
      const v = coarse[((ck + (a >> 2 & 1)) * cny + cj + (a >> 1 & 1)) * cnx + ci + (a & 1)]!;
      if (v < lowest) lowest = v;
      if (v > highest) highest = v;
    }
    // Simetrik iç eleme: blok tamamen DERİN İÇERİDEyse (en büyük köşe < −cut)
    // her noktanın gerçek değeri < −2·voxel'dir → işaret doğru, kenarda sıfır
    // geçişi imkânsız. D3 karakterlerinde hacmin ~%15'i bu durumda.
    const outside = lowest > cut, inside = highest < -cut;
    const skip = outside || inside, fill = outside ? lowest - safe : highest + safe;
    const i1 = Math.min(nx, (ci + 1) * S), j1 = Math.min(ny, (cj + 1) * S), k1 = Math.min(nz, (ck + 1) * S);
    for (let k = ck * S; k < k1; k++) {
      const z = min[2] + k * voxel;
      for (let j = cj * S; j < j1; j++) {
        const y = min[1] + j * voxel, row = (k * ny + j) * nx;
        if (skip) { values.fill(fill, row + ci * S, row + i1); continue; }
        for (let i = ci * S; i < i1; i++) values[row + i] = field(min[0] + i * voxel, y, z);
      }
    }
  }
  // Izgara merkezî farkı: köşe normalleri bedava ve pürüzsüz gelir.
  const grad = (i: number, j: number, k: number, out: Float32Array) => {
    const ci = Math.min(nx - 2, Math.max(1, i)), cj = Math.min(ny - 2, Math.max(1, j)), ck = Math.min(nz - 2, Math.max(1, k));
    out[0] = values[at(ci + 1, cj, ck)]! - values[at(ci - 1, cj, ck)]!;
    out[1] = values[at(ci, cj + 1, ck)]! - values[at(ci, cj - 1, ck)]!;
    out[2] = values[at(ci, cj, ck + 1)]! - values[at(ci, cj, ck - 1)]!;
  };
  const cache = new Int32Array(nx * ny * nz * 3).fill(-1);
  const px: number[] = [], py: number[] = [], pz: number[] = [], nxs: number[] = [], nys: number[] = [], nzs: number[] = [];
  const indices: number[] = [];
  const ga = new Float32Array(3), gb = new Float32Array(3);
  const edgeVertex = (i: number, j: number, k: number, edge: number): number => {
    const e = EDGE[edge]!;
    const bi = i + e[2]!, bj = j + e[3]!, bk = k + e[4]!, axis = e[5]!;
    const slot = at(bi, bj, bk) * 3 + axis;
    const hit = cache[slot]!;
    if (hit >= 0) return hit;
    const ca = CORNER[e[0]!]!, cb = CORNER[e[1]!]!;
    const ia = i + ca[0], ja = j + ca[1], ka = k + ca[2];
    const ib = i + cb[0], jb = j + cb[1], kb = k + cb[2];
    const va = values[at(ia, ja, ka)]!, vb = values[at(ib, jb, kb)]!;
    const t = va === vb ? .5 : Math.min(1, Math.max(0, -va / (vb - va)));
    grad(ia, ja, ka, ga); grad(ib, jb, kb, gb);
    let gx = ga[0]! + (gb[0]! - ga[0]!) * t, gy = ga[1]! + (gb[1]! - ga[1]!) * t, gz = ga[2]! + (gb[2]! - ga[2]!) * t;
    const len = Math.hypot(gx, gy, gz) || 1; gx /= len; gy /= len; gz /= len;
    const index = px.length;
    px.push(min[0] + (ia + (ib - ia) * t) * voxel);
    py.push(min[1] + (ja + (jb - ja) * t) * voxel);
    pz.push(min[2] + (ka + (kb - ka) * t) * voxel);
    nxs.push(gx); nys.push(gy); nzs.push(gz);
    cache[slot] = index; return index;
  };
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let cube = 0;
    for (let c = 0; c < 8; c++) { const o = CORNER[c]!; if (values[at(i + o[0], j + o[1], k + o[2])]! < 0) cube |= 1 << c; }
    if (cube === 0 || cube === 255) continue;
    const base = cube * 16;
    for (let t = 0; triTable[base + t]! !== -1; t += 3) {
      const a = edgeVertex(i, j, k, triTable[base + t]!);
      const b = edgeVertex(i, j, k, triTable[base + t + 1]!);
      const c = edgeVertex(i, j, k, triTable[base + t + 2]!);
      if (a === b || b === c || a === c) continue;
      // Sarım yönünü alan gradyanına göre sabitle (dışa bakan yüz).
      const ux = px[b]! - px[a]!, uy = py[b]! - py[a]!, uz = pz[b]! - pz[a]!;
      const vx = px[c]! - px[a]!, vy = py[c]! - py[a]!, vz = pz[c]! - pz[a]!;
      const gxn = nxs[a]! + nxs[b]! + nxs[c]!, gyn = nys[a]! + nys[b]! + nys[c]!, gzn = nzs[a]! + nzs[b]! + nzs[c]!;
      const flip = (uy * vz - uz * vy) * gxn + (uz * vx - ux * vz) * gyn + (ux * vy - uy * vx) * gzn < 0;
      indices.push(a, flip ? c : b, flip ? b : c);
    }
  }
  const positions = new Float32Array(px.length * 3), normals = new Float32Array(px.length * 3);
  for (let v = 0; v < px.length; v++) {
    positions[v * 3] = px[v]!; positions[v * 3 + 1] = py[v]!; positions[v * 3 + 2] = pz[v]!;
    normals[v * 3] = nxs[v]!; normals[v * 3 + 1] = nys[v]!; normals[v * 3 + 2] = nzs[v]!;
  }
  return { positions, normals, indices: Uint32Array.from(indices) };
}

/**
 * Köşe kümeleme (vertex clustering) ile seyreltme: köşeler `cell` ızgarasına
 * toplanır, konum/normal kümenin ortalamasıdır, yozlaşan üçgenler atılır.
 * Eklem bantlarını korumak için `keep` verilen köşeleri kendi kümesinde tutar.
 */
export function clusterDecimate(mesh: MeshData, cell: number, refine?: (x: number, y: number, z: number) => boolean, refineFactor = .55,
  group?: (x: number, y: number, z: number) => number): MeshData {
  if (cell <= 0) return mesh;
  const count = mesh.positions.length / 3;
  const map = new Map<string, number>();
  const owner = new Int32Array(count);
  const sums: number[] = []; const weights: number[] = [];
  const fine = cell * refineFactor;
  for (let v = 0; v < count; v++) {
    const x = mesh.positions[v * 3]!, y = mesh.positions[v * 3 + 1]!, z = mesh.positions[v * 3 + 2]!;
    // Eklem bantları daha ince ızgarada kümelenir (bükülmede köşe kaybolmasın).
    const c = refine?.(x, y, z) ? fine : cell;
    // D1 tur 6 — AYRI PARÇALAR KAYNAŞMAZ: `group` veren köşeler (parmak zinciri /
    // avuç) yalnız kendi grubu içinde kümelenir. Aksi hâlde 5,2 mm hücre,
    // 4 mm'lik parmak arası boşluğun iki duvarındaki köşeleri tek köşeye
    // indiriyor ve pozda gerilen ince "perde" yamaları çıkıyordu.
    const g = group ? group(x, y, z) : 0;
    const key = `${g}|${c === cell ? 'c' : 'f'}${Math.round(x / c)},${Math.round(y / c)},${Math.round(z / c)}`;
    let id = map.get(key);
    if (id === undefined) { id = weights.length; map.set(key, id); weights.push(0); sums.push(0, 0, 0, 0, 0, 0); }
    owner[v] = id; weights[id]! += 1;
    sums[id * 6]! += x; sums[id * 6 + 1]! += y; sums[id * 6 + 2]! += z;
    sums[id * 6 + 3]! += mesh.normals[v * 3]!; sums[id * 6 + 4]! += mesh.normals[v * 3 + 1]!; sums[id * 6 + 5]! += mesh.normals[v * 3 + 2]!;
  }
  const total = weights.length;
  const positions = new Float32Array(total * 3), normals = new Float32Array(total * 3);
  for (let id = 0; id < total; id++) {
    const w = weights[id]!;
    positions[id * 3] = sums[id * 6]! / w; positions[id * 3 + 1] = sums[id * 6 + 1]! / w; positions[id * 3 + 2] = sums[id * 6 + 2]! / w;
    const nx = sums[id * 6 + 3]!, ny = sums[id * 6 + 4]!, nz = sums[id * 6 + 5]!;
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[id * 3] = nx / len; normals[id * 3 + 1] = ny / len; normals[id * 3 + 2] = nz / len;
  }
  const out: number[] = [];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = owner[mesh.indices[t]!]!, b = owner[mesh.indices[t + 1]!]!, c = owner[mesh.indices[t + 2]!]!;
    if (a !== b && b !== c && a !== c) out.push(a, b, c);
  }
  return { positions, normals, indices: Uint32Array.from(out) };
}

/** Her kenarın tam iki üçgene ait olması (kapalı yüzey) kontrolü — testlerde kullanılır. */
export function boundaryEdges(indices: ArrayLike<number>): number {
  const seen = new Map<number, number>();
  for (let t = 0; t < indices.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = indices[t + e]!, b = indices[t + (e + 1) % 3]!;
    const key = Math.min(a, b) * 4294967296 + Math.max(a, b);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  let open = 0; for (const n of seen.values()) if (n !== 2) open++;
  return open;
}

/**
 * Taubin (λ|μ) yumuşatma — köşe kümeleme sonrası kalan "kil" dalgalarını siler,
 * BÜZÜŞME yapmaz: her iterasyon önce λ ile içe, sonra μ (< −λ) ile dışa taşır.
 * Üçgen ve köşe sayısı değişmez. `pinned[v] === 1` olan köşeler (ince aksesuar
 * telleri, siperlik, burun gibi korunacak ayrıntılar) yerinde kalır.
 */
export function taubinSmooth(mesh: MeshData, iterations = 2, lambda = .5, mu = -.53, pinned?: Uint8Array): MeshData {
  const count = mesh.positions.length / 3;
  if (iterations <= 0 || count === 0) return mesh;
  // Komşuluk: CSR (offsets + flat komşu dizisi), her kenar iki yönde bir kez.
  const degree = new Uint32Array(count + 1);
  const pairs: number[] = [];
  const seen = new Set<number>();
  for (let t = 0; t < mesh.indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = mesh.indices[t + e]!, b = mesh.indices[t + (e + 1) % 3]!;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const key = lo * 4294967296 + hi;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(lo, hi);
      degree[lo + 1]! += 1; degree[hi + 1]! += 1;
    }
  }
  for (let v = 0; v < count; v++) degree[v + 1]! += degree[v]!;
  const offsets = degree;
  const cursor = new Uint32Array(count);
  const neighbours = new Uint32Array(pairs.length);
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i]!, b = pairs[i + 1]!;
    neighbours[offsets[a]! + cursor[a]!++] = b;
    neighbours[offsets[b]! + cursor[b]!++] = a;
  }
  let positions = Float32Array.from(mesh.positions);
  let next = new Float32Array(positions.length);
  const step = (factor: number) => {
    for (let v = 0; v < count; v++) {
      const from = offsets[v]!, to = offsets[v + 1]!;
      const x = positions[v * 3]!, y = positions[v * 3 + 1]!, z = positions[v * 3 + 2]!;
      if (pinned?.[v] || to === from) { next[v * 3] = x; next[v * 3 + 1] = y; next[v * 3 + 2] = z; continue; }
      let sx = 0, sy = 0, sz = 0;
      for (let i = from; i < to; i++) {
        const n = neighbours[i]!;
        sx += positions[n * 3]!; sy += positions[n * 3 + 1]!; sz += positions[n * 3 + 2]!;
      }
      const inv = 1 / (to - from);
      next[v * 3] = x + factor * (sx * inv - x);
      next[v * 3 + 1] = y + factor * (sy * inv - y);
      next[v * 3 + 2] = z + factor * (sz * inv - z);
    }
    const swap = positions; positions = next; next = swap;
  };
  for (let i = 0; i < iterations; i++) { step(lambda); step(mu); }
  return { positions, normals: vertexNormals(positions, mesh.indices), indices: mesh.indices };
}

/**
 * SDF gradyanından köşe normalleri (merkezi fark, adım `h`). Üçgen komşuluğundan
 * hesaplanan alan normalleri seyreltilmiş ağda FASET üretir (üçgen 23–28 mm);
 * gradyan normali gerçek yüzeyin normalidir, üçgen sayısından bağımsızdır ve
 * pürüzsüz gölgeleme verir. Köşe başına 6 alan çağrısı.
 */
export function gradientNormals(positions: Float32Array, field: FieldFn, h: number): Float32Array {
  const count = positions.length / 3;
  const normals = new Float32Array(positions.length);
  for (let v = 0; v < count; v++) {
    const x = positions[v * 3]!, y = positions[v * 3 + 1]!, z = positions[v * 3 + 2]!;
    let gx = field(x + h, y, z) - field(x - h, y, z);
    let gy = field(x, y + h, z) - field(x, y - h, z);
    let gz = field(x, y, z + h) - field(x, y, z - h);
    const len = Math.hypot(gx, gy, gz);
    // Medyal eksende gradyan sıfıra yaklaşır; o köşede eski normal korunur.
    if (len < 1e-9) { normals[v * 3] = 0; normals[v * 3 + 1] = 1; normals[v * 3 + 2] = 0; continue; }
    gx /= len; gy /= len; gz /= len;
    normals[v * 3] = gx; normals[v * 3 + 1] = gy; normals[v * 3 + 2] = gz;
  }
  return normals;
}

/**
 * Newton adımı: `p ← p − f(p)·∇f/|∇f|²`. Köşe kümeleme köşeleri hücre
 * ORTALAMASINA taşıdığı için kümelenmiş ağ iso-yüzeyin içine çöker (dışbükey
 * yerlerde sistematik büzüşme, ince yerlerde dalga). Bir-iki iterasyon köşeleri
 * yüzeye geri yansıtır. `maxStep` tek adımdaki en büyük yer değiştirmedir
 * (kümenin iki yakadan köşe topladığı yerde fırlamayı engeller).
 * Köşe başına iterasyon başına 7 alan çağrısı.
 */
export function projectToSurface(
  positions: Float32Array, field: FieldFn, h: number,
  iterations = 1, maxStep = Infinity, pinned?: Uint8Array,
): Float32Array {
  const count = positions.length / 3;
  const out = Float32Array.from(positions);
  for (let it = 0; it < iterations; it++) {
    for (let v = 0; v < count; v++) {
      if (pinned?.[v]) continue;
      const x = out[v * 3]!, y = out[v * 3 + 1]!, z = out[v * 3 + 2]!;
      const f = field(x, y, z);
      if (f === 0) continue;
      const gx = field(x + h, y, z) - field(x - h, y, z);
      const gy = field(x, y + h, z) - field(x, y - h, z);
      const gz = field(x, y, z + h) - field(x, y, z - h);
      // ∇f = (gx, gy, gz) / (2h); adım = f·∇f/|∇f|² = f·2h·g/|g|².
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 < 1e-18) continue;
      let s = f * 2 * h / g2;
      const move = Math.abs(s) * Math.sqrt(g2);
      if (move > maxStep) s *= maxStep / move;
      out[v * 3] = x - s * gx; out[v * 3 + 1] = y - s * gy; out[v * 3 + 2] = z - s * gz;
    }
  }
  return out;
}

/** Alan ağırlıklı köşe normalleri (yumuşatmadan sonra yeniden hesaplanır). */
export function vertexNormals(positions: Float32Array, indices: ArrayLike<number>): Float32Array {
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]! * 3, b = indices[t + 1]! * 3, c = indices[t + 2]! * 3;
    const ux = positions[b]! - positions[a]!, uy = positions[b + 1]! - positions[a + 1]!, uz = positions[b + 2]! - positions[a + 2]!;
    const vx = positions[c]! - positions[a]!, vy = positions[c + 1]! - positions[a + 1]!, vz = positions[c + 2]! - positions[a + 2]!;
    // Çapraz çarpım alanla orantılıdır → normalize edilmeden eklenir.
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { normals[i]! += nx; normals[i + 1]! += ny; normals[i + 2]! += nz; }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const len = Math.hypot(normals[v]!, normals[v + 1]!, normals[v + 2]!) || 1;
    normals[v]! /= len; normals[v + 1]! /= len; normals[v + 2]! /= len;
  }
  return normals;
}
