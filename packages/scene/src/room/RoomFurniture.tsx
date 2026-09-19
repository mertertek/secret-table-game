/**
 * D2.2 — Mobilya: kitaplıklar + kitaplar, pencere/cam/perde/pelmet, konsol +
 * radyo + yeşil lamba + sürahi, ayaklı lambalar, sehpalar, çift kapı.
 *
 * Ahşabın tamamı TEK birleşik geometridir (`woodGeometry`); kitaplar
 * `InstancedMesh`. `quality='low'`da bu katman hiç çizilmez.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, Matrix4, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { useThree } from '@react-three/fiber';
import { room } from '../materials/palette';
import { useSceneMaterials } from '../materials/SceneMaterials';
import {
  bookInstances, curtainGeometry, glasswareGeometry, shadeGeometry,
  windowGlassGeometry, woodGeometry,
} from './roomMeshes';
import type { RoomTextures } from './roomTextures';

export function RoomFurniture({ textures }: { textures: RoomTextures }) {
  const { wood } = useSceneMaterials();
  const invalidate = useThree((state) => state.invalidate);
  const geometries = useMemo(() => ({
    wood: woodGeometry(),
    curtain: curtainGeometry(),
    glassware: glasswareGeometry(),
    shades: shadeGeometry(),
    glass: windowGlassGeometry(),
  }), []);
  useEffect(() => () => {
    geometries.wood.dispose(); geometries.curtain.dispose();
    geometries.glassware.dispose(); geometries.shades.dispose(); geometries.glass.dispose();
  }, [geometries]);

  const books = useMemo(() => bookInstances(), []);
  const bookRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = bookRef.current;
    if (!mesh) return;
    const matrix = new Matrix4(), position = new Vector3(), scale = new Vector3();
    const quaternion = new Quaternion(), axis = new Vector3(0, 0, 1), color = new Color();
    books.forEach((entry, i) => {
      position.set(...entry.position); scale.set(...entry.scale);
      quaternion.setFromAxisAngle(axis, entry.tilt);
      mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
      mesh.setColorAt(i, color.set(entry.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [books, invalidate]);

  return <group name="RoomFurniture">
    {/* 10 — bütün ahşap: kitaplık, pencere kasası, konsol, radyo, sehpa, kapı, çerçeve */}
    <mesh geometry={geometries.wood}>
      <meshStandardMaterial map={wood} vertexColors roughness={.72} />
    </mesh>
    {/* 11 — kitap sırtları */}
    <instancedMesh ref={bookRef} args={[undefined, undefined, books.length]}>
      <boxGeometry args={[1, 1, 1]} />
      {/* Renk ÖRNEK başına gelir (`setColorAt`); köşe rengi yok. */}
      <meshStandardMaterial map={textures.books ?? undefined} roughness={.86} />
    </instancedMesh>
    {/* 12 — pencere camı: gece Berlin silueti + ay */}
    <mesh geometry={geometries.glass}>
      <meshStandardMaterial map={textures.night ?? undefined} color={textures.night ? '#ffffff' : room.night}
        emissiveMap={textures.night ?? undefined} emissive="#ffffff" emissiveIntensity={.6} roughness={.4} toneMapped={false} />
    </mesh>
    {/* 13 — bordo kadife perdeler + pelmet */}
    <mesh geometry={geometries.curtain}>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
    {/* 14 — abajurlar (ayaklı lamba ×2, yeşil konsol lambası) */}
    <mesh geometry={geometries.shades}>
      <meshStandardMaterial vertexColors emissive="#3a2a14" emissiveIntensity={1} roughness={.9} side={DoubleSide} />
    </mesh>
    {/* 15 — sürahi ve bardaklar */}
    <mesh geometry={geometries.glassware}>
      <meshStandardMaterial vertexColors roughness={.22} metalness={.05} />
    </mesh>
    {/* Ayaklı lamba nokta ışıkları (tasarım §4: standard'da açık). */}
    {[-3.6, 3.6].map((x) => (
      <pointLight key={x} position={[x, .41, -1.7]} color="#ffc779" intensity={2.5} distance={3.5} decay={2} />
    ))}
  </group>;
}
