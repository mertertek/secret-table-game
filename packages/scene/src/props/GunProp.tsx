/**
 * D12 §2/§4 — el şablonu uzayında çizilen tabanca + ateş efektleri.
 *
 * Tur 4 patlaması: namlu flaşı (büyüyüp sönen 6 kollu yıldız), duman bulutu
 * (4 yuvarlak sprite, tek `InstancedMesh`) ve kıvılcımlar (8 nokta, tek
 * `InstancedMesh`). Patlama sırasında SAHNEYE en çok **3 ek çizim** girer,
 * bitince üçü de görünmez olur (çizim maliyeti sıfırlanır).
 *
 * Tek `mesh` (paylaşımlı geometri, köşe rengi) + efektler yalnız
 * `player_eliminated` cue'su / hazır poz sırasında mount edilir.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import {
  AdditiveBlending, CanvasTexture, EquirectangularReflectionMapping, Group, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PMREMGenerator,
  PlaneGeometry, Quaternion, SRGBColorSpace, Vector3,
} from 'three';
import type { Texture, WebGLRenderer } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { BLAST, blastFrame } from '../animation/execution';
import { patchBoundaryShader } from '../characters/boundaryMaterial';
import { GUN, gunGeometry, requestGunGeometry } from './gun';
import type { GunBuild } from './gun';
import { prop } from '../materials/palette';

/**
 * Tur 5 — silah malzemesi: TEK çizim, köşe başına renk + **renk sınırı
 * kenar-yumuşatması** (D3 `boundaryMaterial` shader yaması) + köşe başına
 * **metalness/roughness** (gövde metal, kabza ahşap, halka pirinç).
 *
 * Yansıma için sahnenin ortamı DEĞİŞMEZ: yalnız bu malzemeye özel, 256×128
 * prosedürel equirect (koyu zemin + sıcak tavan lekesi + soğuk pencere lekesi)
 * PMREM'den geçirilip `envMap` olarak verilir. Bir kez üretilir, paylaşılır.
 */
const GUN_CACHE_KEY = 'd12-gun-pbr';

function environmentCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  // Zemin: yukarısı biraz açık, aşağısı koyu (oda ışığı yukarıdan gelir).
  const base = ctx.createLinearGradient(0, 0, 0, 128);
  base.addColorStop(0, '#2d3230');
  base.addColorStop(.55, '#1a201f');
  base.addColorStop(1, '#0d1211');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 128);
  const blob = (x: number, y: number, r: number, inner: string, outer: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  // Sıcak tavan ışığı (üst şerit) + soğuk pencere (yan).
  blob(96, 16, 54, 'rgba(255,236,196,.95)', 'rgba(255,236,196,0)');
  blob(206, 44, 46, 'rgba(150,186,214,.75)', 'rgba(150,186,214,0)');
  blob(28, 58, 30, 'rgba(226,190,132,.35)', 'rgba(226,190,132,0)');
  return canvas;
}

let environment: { texture: Texture; source: CanvasTexture; pmrem: PMREMGenerator } | undefined;
function gunEnvironment(gl: WebGLRenderer): Texture {
  if (environment) return environment.texture;
  const source = new CanvasTexture(environmentCanvas());
  source.mapping = EquirectangularReflectionMapping;
  source.colorSpace = SRGBColorSpace;
  const pmrem = new PMREMGenerator(gl);
  const target = pmrem.fromEquirectangular(source);
  environment = { texture: target.texture, source, pmrem };
  return target.texture;
}

let material: MeshStandardMaterial | undefined;
let users = 0;
function gunMaterial(gl: WebGLRenderer): MeshStandardMaterial {
  if (material) return material;
  const next = new MeshStandardMaterial({ vertexColors: true, roughness: .32, metalness: .75, envMapIntensity: .9 });
  next.envMap = gunEnvironment(gl);
  next.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    // 1) Renk sınırı kenar-yumuşatması (kabza/gövde, pirinç halka).
    patchBoundaryShader(shader);
    // 2) Köşe başına malzeme: vec2(metalness, roughness).
    shader.vertexShader = `attribute vec2 gunMaterial;\nvarying vec2 vGunMaterial;\n` +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvGunMaterial = gunMaterial;');
    shader.fragmentShader = `varying vec2 vGunMaterial;\n` +
      shader.fragmentShader
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = vGunMaterial.y;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor = vGunMaterial.x;');
  };
  next.customProgramCacheKey = () => GUN_CACHE_KEY;
  material = next;
  return next;
}

/** Son kullanıcı da ayrılınca paylaşılan malzeme/ortam bırakılır. */
function releaseGunMaterial(): void {
  users -= 1;
  if (users > 0) return;
  material?.dispose(); material = undefined;
  environment?.texture.dispose();
  environment?.source.dispose();
  environment?.pmrem.dispose();
  environment = undefined;
}

/**
 * §4 flaş dokusu: ortada parlak beyaz disk + sıcak sarı hâle, çevresinde
 * 6 kollu simetrik yıldız (sivrilen üçgen kollar). Ekleme karışımla çizilir.
 */
let flashTexture: CanvasTexture | undefined;
function muzzleFlashTexture(): CanvasTexture {
  if (flashTexture) return flashTexture;
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  ctx.translate(c, c);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const long = (i % 2 === 0 ? .96 : .66) * c;
    const half = (i % 2 === 0 ? .11 : .085) * c;
    ctx.save();
    ctx.rotate(a);
    const arm = ctx.createLinearGradient(0, 0, long, 0);
    arm.addColorStop(0, prop.muzzleFlash);
    arm.addColorStop(1, 'rgba(255,196,64,0)');
    ctx.fillStyle = arm;
    ctx.beginPath();
    ctx.moveTo(0, -half); ctx.lineTo(long, 0); ctx.lineTo(0, half);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, c * .46);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(.42, 'rgba(255,241,196,1)');
  glow.addColorStop(.72, 'rgba(255,196,64,.75)');
  glow.addColorStop(1, 'rgba(255,170,40,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, c * .46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, c * .17, 0, Math.PI * 2); ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  flashTexture = new CanvasTexture(canvas);
  flashTexture.colorSpace = SRGBColorSpace;
  return flashTexture;
}

/** Tur 4 — duman: yumuşak gri-beyaz yuvarlak (normal karışım). */
let smokeTexture: CanvasTexture | undefined;
function puffTexture(): CanvasTexture {
  if (smokeTexture) return smokeTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c * .92, 0, c, c, c);
  g.addColorStop(0, 'rgba(246,244,238,1)');
  g.addColorStop(.42, 'rgba(216,214,208,.82)');
  g.addColorStop(.75, 'rgba(176,175,172,.34)');
  g.addColorStop(1, 'rgba(150,150,148,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
  smokeTexture = new CanvasTexture(canvas);
  smokeTexture.colorSpace = SRGBColorSpace;
  return smokeTexture;
}

/** Tur 4 — kıvılcım: küçük sıcak nokta (ekleme karışım). */
let sparkTexture: CanvasTexture | undefined;
function emberTexture(): CanvasTexture {
  if (sparkTexture) return sparkTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.35, 'rgba(255,214,120,.9)');
  g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
  sparkTexture = new CanvasTexture(canvas);
  sparkTexture.colorSpace = SRGBColorSpace;
  return sparkTexture;
}

export type GunHandle = {
  /**
   * `scale` 0…1 (silah belirir/kaybolur); `sinceFire` ateşten beri geçen ms
   * (ateş yoksa `null`) — flaş, duman ve kıvılcımlar buradan türer.
   */
  apply: (scale: number, sinceFire: number | null, reduced?: boolean) => void;
};

/** Flaş yarıçapı (el birimi); gövde ölçeğiyle birlikte büyür. */
const FLASH_R = .075 * GUN.scale;
/** Duman sprite'ının taban yarı boyu ve kıvılcım boyu. */
const PUFF_R = .075, EMBER_R = .012;

/** Dumanın ve kıvılcımların namlu ucundaki çıkış noktası. */
const MUZZLE: readonly [number, number, number] = [0, GUN.barrel.y, GUN.muzzle.z - .012 * GUN.scale];

/** Sabit (rastgele olmayan) dağılım: her infazda aynı okunur biçim. */
const PUFFS = Array.from({ length: BLAST.smokeCount }, (_unused, i) => {
  const t = i / Math.max(1, BLAST.smokeCount - 1);
  return {
    reach: BLAST.smokeReach[0] + (BLAST.smokeReach[1] - BLAST.smokeReach[0]) * t,
    up: .03 + .07 * t,
    side: (i % 2 === 0 ? 1 : -1) * (.02 + .035 * t),
    size: 1 - .25 * t,
    delay: t * .18,
  };
});

const EMBERS = Array.from({ length: BLAST.sparkCount }, (_unused, i) => {
  const a = (i + .5) * Math.PI * 2 / BLAST.sparkCount;
  const t = (i % 3) / 2;
  return {
    reach: BLAST.sparkReach[0] + (BLAST.sparkReach[1] - BLAST.sparkReach[0]) * t,
    side: Math.cos(a) * .055,
    up: Math.sin(a) * .055 + .015,
  };
});

export const GunProp = forwardRef<GunHandle, { castShadow?: boolean }>(function GunProp({ castShadow = true }, ref) {
  // İlk kare kaba sürümle çizilir; HD geometri boşta zamanda gelir (tur 5).
  const [build, setBuild] = useState<GunBuild>(() => gunGeometry('low'));
  const texture = useMemo(() => muzzleFlashTexture(), []);
  const body = useRef<Group>(null);
  const flash = useRef<Mesh>(null);
  const { gl, camera, invalidate } = useThree();

  // Duman ve kıvılcım: sprite başına çizim YOK — tek `InstancedMesh` (1 + 1).
  const smoke = useMemo(() => {
    const mesh = new InstancedMesh(
      new PlaneGeometry(PUFF_R * 2, PUFF_R * 2),
      new MeshBasicMaterial({ map: puffTexture(), transparent: true, opacity: 0, depthWrite: false }),
      BLAST.smokeCount,
    );
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2;
    return mesh;
  }, []);
  const sparks = useMemo(() => {
    const mesh = new InstancedMesh(
      new PlaneGeometry(EMBER_R * 2, EMBER_R * 2),
      new MeshBasicMaterial({
        map: emberTexture(), transparent: true, opacity: 0, depthWrite: false,
        blending: AdditiveBlending, toneMapped: false,
      }),
      BLAST.sparkCount,
    );
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 3;
    return mesh;
  }, []);
  useEffect(() => () => {
    smoke.geometry.dispose(); (smoke.material as MeshBasicMaterial).dispose();
    sparks.geometry.dispose(); (sparks.material as MeshBasicMaterial).dispose();
  }, [smoke, sparks]);

  /** D27 — patlama malzemelerinin ön ısıtılacağı kare sayısı (örnek başına bir kez). */
  const warm = useRef(2);
  const scratch = useMemo(() => ({
    m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3(), w: new Quaternion(),
  }), []);
  const surface = useMemo(() => { users += 1; return gunMaterial(gl); }, [gl]);
  useEffect(() => () => releaseGunMaterial(), []);
  useEffect(() => {
    let live = true;
    requestGunGeometry((next) => { if (live) { setBuild(next); invalidate(); } });
    return () => { live = false; };
  }, [invalidate]);
  useEffect(() => {
    gl.domElement.dataset.d12GunTriangles = String(build.triangles);
    gl.domElement.dataset.d12GunMs = build.buildMs.toFixed(0);
  }, [gl, build]);

  useImperativeHandle(ref, () => ({
    apply(scale, sinceFire, reduced = false) {
      if (body.current) {
        const s = Math.max(.0001, scale);
        body.current.scale.set(s, s, s);
        body.current.visible = scale > .001;
      }
      const live = scale > .001 && sinceFire !== null;
      const b = live ? blastFrame(sinceFire, reduced) : blastFrame(-1);
      // D27 — ön ısıtma: üç patlama malzemesi ilk kez GÖRÜNÜR olduğu karede derlenir;
      // canlı oyunda bu, tam ateş anında ~0,5 s'lik donma demekti. Silah ele geldiğinde
      // (hedef seçimi, atıştan saniyeler önce) iki kare boyunca opaklık 0 ile çizilir:
      // ekranda hiçbir şey görünmez, program ve dokular hazır olur.
      const warming = !live && scale > .001 && warm.current > 0;
      if (warming) { warm.current -= 1; invalidate(); }
      if (flash.current) {
        flash.current.visible = warming || b.flash > .01;
        (flash.current.material as MeshBasicMaterial).opacity = b.flash;
        flash.current.scale.setScalar(b.flashScale);
        // Tek düzlem; kameraya döner (kadraj farkı gözetmeksizin aynı parlama).
        if (flash.current.visible) flash.current.lookAt(camera.position);
      }
      // Sprite'lar kamera düzlemine döner: grup yerel çerçevesindeki karşılığı.
      const billboard = () => {
        smoke.getWorldQuaternion(scratch.w);
        return scratch.q.copy(scratch.w).invert().multiply(camera.quaternion);
      };
      smoke.visible = warming || b.smoke > .005;
      (smoke.material as MeshBasicMaterial).opacity = b.smoke;
      if (smoke.visible) {
        const q = billboard();
        PUFFS.forEach((puff, i) => {
          const p = Math.max(0, (b.smokeP - puff.delay) / (1 - puff.delay));
          const grow = BLAST.smokeScale[0] + (BLAST.smokeScale[1] - BLAST.smokeScale[0]) * p;
          scratch.p.set(
            MUZZLE[0] + puff.side * p,
            MUZZLE[1] + puff.up * p,
            MUZZLE[2] - puff.reach * p,
          );
          scratch.s.setScalar(grow * puff.size);
          smoke.setMatrixAt(i, scratch.m.compose(scratch.p, q, scratch.s));
        });
        smoke.instanceMatrix.needsUpdate = true;
      }
      sparks.visible = warming || b.spark > .01;
      (sparks.material as MeshBasicMaterial).opacity = b.spark;
      if (sparks.visible) {
        const q = billboard();
        EMBERS.forEach((ember, i) => {
          scratch.p.set(
            MUZZLE[0] + ember.side * b.sparkP,
            MUZZLE[1] + ember.up * b.sparkP,
            MUZZLE[2] - ember.reach * b.sparkP,
          );
          scratch.s.setScalar(1 - .4 * b.sparkP);
          sparks.setMatrixAt(i, scratch.m.compose(scratch.p, q, scratch.s));
        });
        sparks.instanceMatrix.needsUpdate = true;
      }
    },
  }), [camera, invalidate, scratch, smoke, sparks]);

  return <group ref={body} name="Gun">
    <mesh geometry={build.geometry} material={surface} castShadow={castShadow} />
    <mesh ref={flash} position={[MUZZLE[0], MUZZLE[1], MUZZLE[2]]} visible={false}>
      <planeGeometry args={[FLASH_R * 2, FLASH_R * 2]} />
      <meshBasicMaterial map={texture} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </mesh>
    <primitive object={smoke} />
    <primitive object={sparks} />
  </group>;
});
