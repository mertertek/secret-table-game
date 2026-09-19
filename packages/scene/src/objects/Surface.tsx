import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import type { Mesh } from 'three';
import { canvasTexture, useSceneMaterials } from '../materials/SceneMaterials';
import { palette } from '../materials/palette';

export type Position = [number, number, number];
export function Block({ size, color, radius = .012, ...props }: {
  size: Position; color: string; radius?: number;
} & Omit<ThreeElements['mesh'], 'args' | 'ref'>) {
  return <RoundedBox args={size} radius={Math.min(radius, Math.min(...size) / 2 - .0001)} smoothness={2} bevelSegments={2} castShadow receiveShadow {...props}>
    <meshStandardMaterial color={color} roughness={.68} />
  </RoundedBox>;
}

/** Canvas lettering stays a texture on physical geometry; font files are local.
 * `unlit` + `depthTest={false}` turns the same face into a HUD plate (D6 isim etiketi):
 * ışıktan bağımsız, gölgesiz, başka nesnelerin arkasında kalmaz. */
export function PrintedFace({ width, height, draw, position = [0, .001, 0], rotation = [-Math.PI / 2, 0, 0], resolution = 1024, unlit = false, depthTest = true, meshRef }: {
  width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  position?: Position; rotation?: Position; resolution?: number;
  unlit?: boolean; depthTest?: boolean; meshRef?: RefObject<Mesh | null>;
}) {
  const { fontsReady } = useSceneMaterials();
  const texture = useMemo(() => canvasTexture(resolution, Math.round(resolution * height / width),
    (ctx) => draw(ctx, ctx.canvas.width, ctx.canvas.height)), [draw, fontsReady, resolution, width, height]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh ref={meshRef} position={position} rotation={rotation}>
    <planeGeometry args={[width, height]} />
    {unlit
      ? <meshBasicMaterial map={texture} transparent toneMapped={false} depthTest={depthTest} depthWrite={false} />
      : <meshStandardMaterial map={texture} transparent roughness={.86} polygonOffset polygonOffsetFactor={-1} />}
  </mesh>;
}

export function lettering(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number,
  color: string = palette.ink, serif = false, maxWidth?: number) {
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${serif ? 600 : 550} ${size}px "Table ${serif ? 'Serif' : 'Sans'}", ${serif ? 'serif' : 'sans-serif'}`;
  ctx.fillText(text, x, y, maxWidth);
}
