/**
 * D1 tur 6 — el inceleme görünümü (YALNIZ geliştirme/QA; oyun verisi yok).
 *
 * Tek el, seçilen kavrama, düz zemin ve TEK yönlü ışık: yapışık/birleşik
 * bölgeler (komşu parmak köprüsü, baş parmak–işaret arası, uçların avuca
 * gömülmesi) gölge gürültüsü olmadan okunur.
 *
 * `view`: `palm` avuç içi, `back` el sırtı, `tips` parmak ucu hizası.
 */
import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { SkinnedHand } from './SkinnedHand';
import type { HandHandle } from './SkinnedHand';
import { GRIPS } from './poses';
import type { GripName } from './poses';
import { handGeometry } from './geometry';
import type { HandTier } from './geometry';
import type { SkinId } from '../characters/spec';

export type HandGalleryView = 'palm' | 'back' | 'tips';
export type HandGalleryProps = {
  grip?: GripName;
  view?: HandGalleryView;
  /** `standard` (ilk şahıs) ya da `distant` (kamu elleri). */
  tier?: 'standard' | 'low';
  /** Kadrajı sıkar (yakın inceleme). */
  zoom?: number;
  /** D3.4 — ten tonu (ilk şahıs eli oyuncunun seçimini alır). */
  skin?: SkinId;
};

/** El şablonu: bilek orijin, parmaklar −Z, avuç içi −Y, baş parmak −X. */
const TARGET: readonly [number, number, number] = [0, -.01, -.085];

function Camera({ view, zoom }: { view: HandGalleryView; zoom: number }) {
  const { camera, invalidate, size } = useThree();
  useEffect(() => {
    const d = .26 / Math.max(.4, zoom);
    // palm: avuç içi (−Y) tarafından; back: el sırtı (+Y); tips: parmak uçlarından (−Z).
    const eye = view === 'palm' ? [.02, -d, -.10] : view === 'back' ? [.02, d, -.10] : [.02, .04, -.085 - d];
    camera.position.set(eye[0]!, eye[1]!, eye[2]!);
    camera.up.set(view === 'tips' ? 0 : 0, view === 'tips' ? 1 : 0, view === 'tips' ? 0 : -1);
    camera.lookAt(TARGET[0], TARGET[1], TARGET[2]);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, view, zoom, invalidate, size]);
  return null;
}

function Diagnostics({ tier }: { tier: HandTier }) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const build = handGeometry(tier);
    const timer = setInterval(() => {
      gl.domElement.dataset.d1Calls = String(gl.info.render.calls);
      gl.domElement.dataset.d1Triangles = String(build.triangles);
      gl.domElement.dataset.d1BuildMs = build.buildMs.toFixed(1);
      gl.domElement.dataset.d1Ready = '1';
      invalidate();
    }, 200);
    return () => clearInterval(timer);
  }, [gl, tier, invalidate]);
  return null;
}

function Hand({ grip, skin }: { grip: GripName; skin: SkinId }) {
  const ref = useMemo(() => ({ current: null as HandHandle | null }), []);
  const { invalidate } = useThree();
  useEffect(() => {
    ref.current?.apply({ position: [0, 0, 0], rotation: [0, 0, 0], grip });
    invalidate();
  }, [ref, grip, invalidate]);
  return <SkinnedHand arm={false} side={1} skin={skin}
    ref={(handle) => { ref.current = handle; handle?.apply({ position: [0, 0, 0], rotation: [0, 0, 0], grip }); }} />;
}

export function HandGallery({ grip = 'rest', view = 'palm', tier = 'standard', zoom = 1, skin = 'orta' }: HandGalleryProps) {
  const valid: GripName = GRIPS.includes(grip) ? grip : 'rest';
  return <div style={{ width: '100%', height: '100%', position: 'relative', background: '#26302e' }}
    data-d1-gallery={valid} data-d1-view={view} data-d1-skin={skin}>
    <Canvas style={{ position: 'absolute', inset: 0 }} frameloop="demand" dpr={[1, 2]}
      camera={{ position: [0, -.30, -.10], fov: 32, near: .01, far: 5 }}>
      <color attach="background" args={['#26302e']} />
      <Camera view={view} zoom={zoom} />
      <Diagnostics tier={tier === 'low' ? 'low' : 'standard'} />
      {/* Tek yönlü ışık + çok zayıf dolgu: yapışık yüzeyler gölgede kaybolmasın. */}
      <hemisphereLight args={['#dfe6e2', '#1a201f', .55]} />
      <directionalLight position={[-.4, .9, -.8]} intensity={2.2} color="#fff3e2" />
      <directionalLight position={[.6, -.5, .4]} intensity={.35} color="#9fb6bd" />
      <Hand grip={valid} skin={skin} />
    </Canvas>
  </div>;
}
