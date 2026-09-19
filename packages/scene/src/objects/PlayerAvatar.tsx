import { useEffect, useMemo } from 'react';
import { avatarGeometry } from './furnitureGeometry';
export function PlayerAvatar({ seatIndex, alive }: { seatIndex: number; alive: boolean }) {
  const geometry = useMemo(() => avatarGeometry(seatIndex, alive), [seatIndex, alive]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="PlayerAvatar" geometry={geometry} position={[0, .44, -.02]} castShadow receiveShadow>
    <meshStandardMaterial vertexColors roughness={.85} />
  </mesh>;
}
