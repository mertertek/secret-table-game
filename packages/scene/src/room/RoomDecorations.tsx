/**
 * D2.3 — Süs: Berlin haritası (sol duvar), üç soyut afiş + duvar saati (sağ duvar),
 * köşe eşyaları (bitki, küre, askılık paltosu). Aplik kolları/konileri ve duvar
 * çerçeveleri çizim bütçesi için kabuk ve mobilya birleşimlerinde taşınır.
 *
 * `quality='low'`da bu katman hiç çizilmez. Yazı yok: bütün afişler soyut.
 */
import { useEffect, useMemo } from 'react';
import { room } from '../materials/palette';
import { greeneryGeometry, mapPlaneGeometry, posterGeometry } from './roomMeshes';
import type { RoomTextures } from './roomTextures';

export function RoomDecorations({ textures }: { textures: RoomTextures }) {
  const geometries = useMemo(() => ({
    map: mapPlaneGeometry(),
    posters: posterGeometry(),
    greenery: greeneryGeometry(),
  }), []);
  useEffect(() => () => { for (const geometry of Object.values(geometries)) geometry.dispose(); }, [geometries]);

  return <group name="RoomDecorations">
    {/* 16 — Berlin haritası (prosedürel kâğıt, yazısız) */}
    <mesh geometry={geometries.map}>
      <meshStandardMaterial map={textures.map ?? undefined} color={textures.map ? '#ffffff' : room.paper} roughness={.95} />
    </mesh>
    {/* 17 — 3 afiş + saat kadranı, tek atlas dokusu */}
    <mesh geometry={geometries.posters}>
      <meshStandardMaterial map={textures.posters ?? undefined} color={textures.posters ? '#ffffff' : room.paper} roughness={.9} />
    </mesh>
    {/* 18 — köşe yeşilliği, küre, palto kütlesi */}
    <mesh geometry={geometries.greenery}>
      <meshStandardMaterial vertexColors roughness={.9} flatShading />
    </mesh>
  </group>;
}
