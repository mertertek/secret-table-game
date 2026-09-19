/**
 * D3 tur 4 — renk sınırı kenar-yumuşatması (fragment shader).
 *
 * Sorun: bölge rengi yalnız KÖŞEDE tanımlıydı; 24,5 mm'lik üçgenlerde V yaka,
 * hırka şeridi, sakal/ten ve saç/ten sınırları köşe ızgarasına çakılıp testere
 * dişi yapıyordu. Bandı genişletmek (tur 3) kenarı yumuşatıyor ama
 * düzleştirmiyordu.
 *
 * Çözüm: her köşe SINIRIN İKİ RENGİNİ (`color` / `colorB`) ve sınıra İŞARETLİ
 * UZAKLIĞI (`dBoundary`, m) taşır. Bir üçgenin üç köşesi aynı renk çiftini
 * taşıdığı için (bkz. `geometry.ts` üçgen bağlamı + köşe çoğaltma) `vColor` ve
 * `vColorB` üçgen boyunca SABİTTİR, yalnız `vBoundary` doğrusal değişir.
 * Fragment shader'ı sıfır düzeyini `fwidth` ile bir piksele yayar:
 *
 *     mix(vColorB, vColor, smoothstep(-w, w, vBoundary)),  w = fwidth(vBoundary)
 *
 * Böylece sınır üçgen çözünürlüğünden bağımsız olarak keskin ve kenar-
 * yumuşatmalı çizilir. Maliyet: 2 ek öznitelik (vec3 + float), ek çizim yok.
 * Düşük kademede de açıktır.
 */
import { MeshStandardMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';

const VERTEX_PARS = `attribute vec3 colorB;
attribute float dBoundary;
varying vec3 vColorB;
varying float vBoundary;
`;

const VERTEX_BODY = `#include <begin_vertex>
	vColorB = colorB;
	vBoundary = dBoundary;`;

const FRAGMENT_PARS = `varying vec3 vColorB;
varying float vBoundary;
`;

/**
 * `fwidth` ekran uzayında piksel başına değişimdir; eşik onunla ölçeklendiği
 * için `dBoundary`'nin mutlak ölçeği önemsizdir, yalnız işareti ve sıfır
 * düzeyi önemlidir. Düz bölgelerde türev 0 olur → 0'a bölmeyi önlemek için taban.
 *
 * `vec3( vColor )`: three r186'da `vColor` **vec4**'tür (r15x'te vec3'tü);
 * kurucu her iki sürümde de doğru çalışır.
 */
const FRAGMENT_BODY = `	float boundaryWidth = max( fwidth( vBoundary ), 1e-6 );
	diffuseColor.rgb *= mix( vColorB, vec3( vColor ), smoothstep( -boundaryWidth, boundaryWidth, vBoundary ) );`;

/** Bir `meshStandardMaterial` shader'ını sınır karışımıyla yamalar (test edilebilir). */
export function patchBoundaryShader(shader: { vertexShader: string; fragmentShader: string }): void {
  shader.vertexShader = VERTEX_PARS + shader.vertexShader.replace('#include <begin_vertex>', VERTEX_BODY);
  shader.fragmentShader = FRAGMENT_PARS + shader.fragmentShader.replace('#include <color_fragment>', FRAGMENT_BODY);
}

/** Program önbelleği anahtarı: yamalı ve yamasız standard malzeme karışmasın. */
export const BOUNDARY_CACHE_KEY = 'd3-boundary-aa';

/** Gövde malzemesi: köşe rengi + sınır kenar-yumuşatması (§e). */
export function boundaryMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0 });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => { patchBoundaryShader(shader); };
  material.customProgramCacheKey = () => BOUNDARY_CACHE_KEY;
  return material;
}
