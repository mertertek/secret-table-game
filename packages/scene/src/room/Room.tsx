/**
 * D2 — Odanın TEK girişi. Kabuk (D2.1), mobilya (D2.2) ve süs (D2.3) katmanları
 * ile dokuların ömrünü yönetir; sis uzaklığını kameraya göre ayarlar.
 *
 * `frameloop="demand"` bozulmaz: burada `useFrame` yok, animasyon yok.
 */
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { Fog } from 'three';
import { useThree } from '@react-three/fiber';
import { room } from '../materials/palette';
import { RoomShell } from './RoomShell';
import { RoomFurniture } from './RoomFurniture';
import { RoomDecorations } from './RoomDecorations';
import { fogFor, overviewDistance } from './roomGeometry';
import { createRoomTextures, disposeRoomTextures } from './roomTextures';

export { ROOM_LIGHTS } from './RoomShell';

/**
 * Sis: koltukta sabit (6/18), genel bakış ve tahta incelemesinde kamera
 * uzaklığına oranlı. Telefon dikeyde d ≈ 16 olabildiği için sabit değer arka
 * duvarı yutuyordu (tasarım §4).
 */
function RoomFog({ seat }: { seat: boolean }) {
  const scene = useThree((state) => state.scene);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const { near, far } = fogFor(seat ? 'seat' : 'overview', overviewDistance(size.width, size.height));
    const previous = scene.fog;
    scene.fog = new Fog(room.fog, near, far);
    invalidate();
    return () => { scene.fog = previous; };
  }, [scene, seat, size.width, size.height, invalidate]);
  return null;
}

/**
 * `seat`: kamera oda İÇİNDE, koltuk göz hizasında mı? Genel bakış ve tahta
 * incelemesi kameraları odanın/masanın üstünde durur; orada avize gizlenir ve
 * sis kamera uzaklığına göre açılır.
 *
 * `overhead` (D15): tavan takımı (avize + tavan göbeği) çizilsin mi. Varsayılan
 * `seat`. Tahtaya EĞİLMEDE kamera oda içindedir (sis koltuk kipinde kalır) ama
 * göz avize halkasının hizasına çıkabildiği için avize kadrajı kapatır: eğilmede
 * `overhead={false}` verilir. Avize IŞIĞI her hâlde durur.
 */
export function Room({ quality, seat = false, overhead = seat }: { quality: 'low' | 'standard'; seat?: boolean; overhead?: boolean }) {
  const low = quality === 'low';
  const textures = useMemo(() => createRoomTextures(low ? 'low' : 'standard'), [low]);
  useEffect(() => () => disposeRoomTextures(textures), [textures]);
  return <group name="Room">
    <RoomFog seat={seat} />
    <RoomShell low={low} seat={overhead} textures={textures} />
    {!low && <RoomFurniture textures={textures} />}
    {!low && <RoomDecorations textures={textures} />}
  </group>;
}
