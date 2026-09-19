/**
 * D3 — karakter galerisi (yalnız geliştirme/QA görünümü, oyun verisi yok).
 *
 * `mode="lineup"`: 8 karakter yan yana (istenen ten tonu ile).
 * `mode="faces"`: tek karakter, 4 ifade.
 * `mode="skins"`: tek karakter, 3 ten.
 * `mode="single"`: TEK karakter + ten (D3.4 lobi önizlemesi — tek Canvas,
 *   karakter başına ≤3 çizim + zemin, toplam ≤9 çizim bütçesi içinde kalır).
 */
import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CharacterAvatar, SEAT_OFFSET_Y } from './CharacterAvatar';
import { CHARACTERS, SKIN_IDS } from './spec';
import type { ExpressionName, SkinId } from './spec';
import { palette } from '../materials/palette';

const EXPRESSIONS: readonly ExpressionName[] = ['neutral', 'smile', 'surprised', 'grumpy'];

/** Kamera karakterlerin ÖNÜNE (−Z tarafı) kurulur: karakterler −Z'ye bakar. */
function Framing({ distance, height }: { distance: number; height: number }) {
  const { camera, invalidate, size } = useThree();
  useEffect(() => {
    camera.position.set(0, height + .18, -distance);
    camera.lookAt(0, height, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, distance, height, invalidate, size]);
  return null;
}

function Diagnostics() {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const timer = setInterval(() => {
      gl.domElement.dataset.d3Calls = String(gl.info.render.calls);
      gl.domElement.dataset.d3SceneTriangles = String(gl.info.render.triangles);
      gl.domElement.dataset.d3Ready = '1';
      invalidate();
    }, 250);
    return () => clearInterval(timer);
  }, [gl, invalidate]);
  return null;
}

export type CharacterGalleryProps = {
  mode?: 'lineup' | 'faces' | 'skins' | 'single';
  character?: string;
  skin?: SkinId;
  reducedMotion?: boolean;
};

export function CharacterGallery({ mode = 'lineup', character, skin = 'orta', reducedMotion = false }: CharacterGalleryProps) {
  const items = useMemo(() => {
    if (mode === 'lineup') return CHARACTERS.map((c, i) => ({ key: c.id, character: c.id, skin: SKIN_IDS[i % SKIN_IDS.length]!, expression: undefined as ExpressionName | undefined, label: c.name }));
    const id = character ?? CHARACTERS[0]!.id;
    if (mode === 'single') return [{ key: `${id}:${skin}`, character: id, skin, expression: undefined as ExpressionName | undefined, label: id }];
    if (mode === 'faces') return EXPRESSIONS.map((e) => ({ key: e, character: id, skin, expression: e, label: e }));
    return SKIN_IDS.map((s) => ({ key: s, character: id, skin: s, expression: undefined as ExpressionName | undefined, label: s }));
  }, [mode, character, skin]);

  const gap = .78;
  const span = (items.length - 1) * gap;
  // Kadraj: dizilimin genişliği + kenar payı; hedef gövde ortası (dünya y ≈ 0,2).
  const distance = Math.max(1.5, span * .58 + 1.25);
  const height = .19;
  return <div style={{ width: '100%', height: '100%', position: 'relative' }} data-d3-gallery={mode} data-d3-count={items.length}>
    <Canvas style={{ position: 'absolute', inset: 0 }} frameloop="demand" dpr={[1, 2]} shadows="percentage"
      camera={{ position: [0, .37, -distance], fov: 38, near: .05, far: 40 }}>
      <color attach="background" args={[palette.background]} />
      <Framing distance={distance} height={height} />
      <Diagnostics />
      <hemisphereLight args={['#f2e4cf', '#2c4844', 1.6]} />
      <directionalLight position={[-2.2, 4, -3]} intensity={2.4} color="#ffe6c7" castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={3} shadow-camera-bottom={-2} shadow-bias={-.0003} shadow-normalBias={.018} />
      <directionalLight position={[3, 2, 3]} intensity={1.1} color="#a9c4c5" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEAT_OFFSET_Y, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color={palette.leather} roughness={.95} />
      </mesh>
      {/* Kamera −Z tarafında olduğu için +x SOLDA görünür: dizilim sırası
          ekranda soldan sağa okunsun diye x işareti ters çevrilir. */}
      {items.map((item, i) => <group key={item.key} position={[span / 2 - i * gap, 0, 0]}>
        <CharacterAvatar character={item.character} skin={item.skin} expression={item.expression}
          index={i} connected reducedMotion={reducedMotion} />
      </group>)}
    </Canvas>
  </div>;
}
