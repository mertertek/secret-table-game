/**
 * D2.1 — Oda kabuğu: parke zemin, halı, sekizgen lambri + duvar kâğıdı bandı,
 * süpürgelik/korniş, tavan, avize ve odanın pirinç/ışıltı kütleleri.
 *
 * Kabuğun bütün dikey yüzleri `FrontSide` ve İÇ yüze bakar: genel bakış kamerası
 * odanın dışında durduğu için arka yüzler ayıklanır ("bebek evi", tasarım §5).
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { DoubleSide, FrontSide, Matrix4, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { useThree } from '@react-three/fiber';
import { room } from '../materials/palette';
import { useSceneMaterials } from '../materials/SceneMaterials';
import { ROOM, atHeight } from './roomGeometry';
import {
  brassGeometry, ceilingGeometry, chandelierShadeGeometry, chandelierShades,
  floorGeometry, glowGeometry, rugGeometry, trimGeometry, wallBandGeometry,
} from './roomMeshes';
import type { RoomTextures } from './roomTextures';

/** Duvar kâğıdı motifi ~0,55 m; bir doku tekrarı 2,2 m. Lambri damarı 1,2 m. */
const WALLPAPER_TILE = 2.2, WAINSCOT_TILE = 1.2;

/**
 * `seat=false` (genel bakış / tahta incelemesi): avize ve tavan göbeği çizilmez.
 * Bu kameralar masanın 1,9–5,9 m üstünde durur ve avize kadrajı tümüyle kapatır;
 * tasarımın "bebek evi" kuralının (§5) doğal uzantısı. Avize IŞIĞI kalır.
 */
export function RoomShell({ low, seat, textures }: { low: boolean; seat: boolean; textures: RoomTextures }) {
  const { wood } = useSceneMaterials();
  const invalidate = useThree((state) => state.invalidate);
  const geometries = useMemo(() => ({
    floor: floorGeometry(),
    rug: rugGeometry(),
    wallpaper: wallBandGeometry(0, ROOM.wainscotH, ROOM.ceilingH, WALLPAPER_TILE),
    wainscot: wallBandGeometry(.004, 0, ROOM.wainscotH + .02, WAINSCOT_TILE),
    ceiling: ceilingGeometry(),
    trim: trimGeometry(low, seat),
    brass: brassGeometry(low, seat),
    glow: glowGeometry(low, seat),
    shade: chandelierShadeGeometry(),
  }), [low, seat]);
  useEffect(() => () => { for (const geometry of Object.values(geometries)) geometry.dispose(); }, [geometries]);

  const shades = useMemo(() => chandelierShades(low, seat), [low, seat]);
  const shadeRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = shadeRef.current;
    if (!mesh) return;
    const matrix = new Matrix4(), offset = new Vector3();
    shades.forEach((shade, i) => mesh.setMatrixAt(i, matrix.makeTranslation(offset.set(...shade.position))));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = shades.length;
    invalidate();
  }, [shades, invalidate]);

  return <group name="RoomShell">
    {/* 1 — parke zemin */}
    <mesh geometry={geometries.floor} receiveShadow>
      <meshStandardMaterial map={textures.parquet ?? undefined} color={textures.parquet ? '#ffffff' : room.floor} roughness={.85} />
    </mesh>
    {/* 2 — halı (mevcut elips ölçüsü) */}
    <mesh geometry={geometries.rug} receiveShadow>
      <meshStandardMaterial map={textures.rug ?? undefined} color={textures.rug ? '#ffffff' : room.rug} roughness={1} />
    </mesh>
    {/* 3 — duvar kâğıdı bandı (h 1,35 → 3,3) */}
    <mesh geometry={geometries.wallpaper}>
      <meshStandardMaterial map={textures.damask ?? undefined} color={textures.damask ? '#ffffff' : room.wallpaper} roughness={.95} side={FrontSide} />
    </mesh>
    {/* 4 — lambri bandı (h 0 → 1,37) */}
    <mesh geometry={geometries.wainscot}>
      <meshStandardMaterial map={wood} color={room.wainscot} roughness={.7} side={FrontSide} />
    </mesh>
    {/* 5 — kasetli tavan */}
    <mesh geometry={geometries.ceiling}>
      <meshStandardMaterial map={textures.ceiling ?? undefined} color={textures.ceiling ? '#ffffff' : room.ceiling} roughness={.95} side={FrontSide} />
    </mesh>
    {/* 6 — süpürgelik, korniş, panel çıtaları, tavan göbeği */}
    <mesh geometry={geometries.trim}>
      <meshStandardMaterial vertexColors roughness={.72} side={FrontSide} />
    </mesh>
    {/* 7 — pirinç: ray, avize gövdesi, aplik kolları, lamba gövdeleri */}
    <mesh geometry={geometries.brass}>
      <meshStandardMaterial vertexColors metalness={.65} roughness={.38} />
    </mesh>
    {/* 8 — ışıltı kütleleri (unlit): ampuller, kadran, aplik konileri */}
    <mesh geometry={geometries.glow}>
      <meshBasicMaterial vertexColors toneMapped={false} side={DoubleSide} />
    </mesh>
    {/* 9 — avize abajurları (örneklenmiş; genel bakışta gizli) */}
    <instancedMesh ref={shadeRef} key={shades.length} visible={shades.length > 0} args={[geometries.shade, undefined, Math.max(1, shades.length)]}>
      <meshStandardMaterial color="#f3e0bd" emissive={room.lampWarm} emissiveIntensity={.42} roughness={.85} side={DoubleSide} />
    </instancedMesh>
    {/* Ana sıcak kaynak: avize (tasarım §4). Low'da tek ek ışık budur. */}
    <pointLight position={[0, atHeight(ROOM.chandelierH) - .2, 0]} color={room.lampWarm} intensity={6} distance={9} decay={2} />
  </group>;
}

/** Ana ışık takımının paylaşılan değerleri — TableScene ve prototip aynı odayı görür. */
export const ROOM_LIGHTS = {
  hemisphere: { sky: '#e8d6b8', ground: '#3a2a1c', intensity: 1.2 },
  key: { position: [-3, 6, 3] as [number, number, number], color: '#ffe6c7', intensity: 2.4 },
  fill: { position: [0, 2, -6] as [number, number, number], color: '#9db7c9', intensity: .9 },
} as const;
