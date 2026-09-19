import { useEffect, useMemo } from 'react';
import { chairGeometry } from './furnitureGeometry';
export function Chair() {
  const geometry = useMemo(chairGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="Chair" geometry={geometry} castShadow receiveShadow>
    <meshStandardMaterial vertexColors roughness={.74} />
  </mesh>;
}
