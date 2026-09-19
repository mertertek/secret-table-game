import { useCallback } from 'react';
import { Block, PrintedFace, lettering } from './Surface';
import { PolicyTile } from './PolicyTile';
import { palette } from '../materials/palette';
export function CardStack({ count, discard = false }: { count: number; discard?: boolean }) {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    lettering(ctx, `${discard ? 'ATIK' : 'DESTE'} · ${count}`, w / 2, h / 2, h * .45, palette.cream);
  }, [count, discard]);
  const layers = Math.min(5, Math.max(0, count));
  return <group name={discard ? 'Discard' : 'Deck'}>
    <Block size={[.29, .024, .37]} color="#26372f" position={[0, .012, 0]} radius={.02} />
    {Array.from({ length: layers }, (_, i) => <group key={i} position={[0, .026 + i * .012, 0]} rotation={[0, discard ? (i - 2) * .07 : 0, 0]}><PolicyTile /></group>)}
    <PrintedFace width={.38} height={.09} position={[0, .004, .25]} draw={draw} resolution={512} />
  </group>;
}
