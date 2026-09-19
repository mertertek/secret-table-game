import { useCallback } from 'react';
import { useSceneMaterials } from '../materials/SceneMaterials';
import { palette } from '../materials/palette';
import { PrintedFace, lettering } from './Surface';

export function Table() {
  const { wood, felt } = useSceneMaterials();
  const brand = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    lettering(ctx, 'SECRET TABLE', w / 2, h * .5, h * .4, '#b6b69a', true);
    ctx.strokeStyle = '#839b7d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w * .07, h * .85); ctx.lineTo(w * .93, h * .85); ctx.stroke();
  }, []);
  return <group name="Table">
    <mesh position={[0, -.13, 0]} scale={[2.35, 1, 1.65]} castShadow receiveShadow>
      <cylinderGeometry args={[1, .98, .21, 96]} />
      <meshStandardMaterial map={wood} color="#c4a58b" roughness={.43} />
    </mesh>
    <mesh position={[0, -.0475, 0]} scale={[2.32, 1, 1.62]} castShadow receiveShadow>
      <cylinderGeometry args={[.985, 1, .055, 96]} />
      <meshStandardMaterial map={wood} color="#dabda1" roughness={.38} />
    </mesh>
    <mesh position={[0, -.008, 0]} scale={[2.12, 1, 1.42]} receiveShadow>
      <cylinderGeometry args={[1, 1, .016, 96]} />
      <meshStandardMaterial map={felt} color="#a3b5ac" roughness={1} bumpMap={felt} bumpScale={.003} />
    </mesh>
    {[{ x: 2.14, z: 1.44 }, { x: 2.25, z: 1.55 }].map(({ x, z }) =>
      <mesh key={x} position={[0, .006, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[x, z, 1]}>
        <torusGeometry args={[1, .004, 6, 96]} />
        <meshStandardMaterial color={palette.brass} metalness={.68} roughness={.38} />
      </mesh>)}
    {[-1.4, 1.4].map((x) => <group key={x} position={[x, -.46, 0]}>
      <mesh castShadow><cylinderGeometry args={[.18, .23, .62, 16]} /><meshStandardMaterial map={wood} color={palette.walnut} /></mesh>
      <mesh position={[0, -.3, 0]} scale={[.6, 1, .85]} castShadow><cylinderGeometry args={[1, 1.02, .06, 32]} /><meshStandardMaterial color={palette.walnut} /></mesh>
    </group>)}
    <PrintedFace width={1.14} height={.08} position={[0, .008, -.69]} draw={brand} />
  </group>;
}
