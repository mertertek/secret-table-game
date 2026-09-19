import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { CardArt } from '../materials/cardArt';
import { drawCard } from '../materials/cardArt';
import { Block, PrintedFace } from './Surface';
import { palette } from '../materials/palette';
import { useSceneLanguage } from '../i18n/sceneText';
export function CardBody({ art, selected = false, onPick, reducedMotion = false }: {
  art: CardArt; selected?: boolean; onPick?: () => void; reducedMotion?: boolean;
}) {
  const group = useRef<Group>(null);
  const language = useSceneLanguage();
  const [hover, setHover] = useState(false);
  const { invalidate } = useThree();
  const lift = selected ? .055 : hover && onPick ? .026 : 0;
  useEffect(() => { invalidate(); }, [lift, invalidate]);
  useFrame((_state, delta) => {
    if (!group.current) return;
    const next = reducedMotion ? lift : group.current.position.y + (lift - group.current.position.y) * (1 - Math.exp(-22 * Math.min(delta, .05)));
    group.current.position.y = Math.abs(next - lift) < .0005 ? lift : next;
    if (group.current.position.y !== lift) invalidate();
  });
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => drawCard(ctx, w, h, art, language), [art, language]);
  return <group ref={group} name={art.kind === 'back' ? 'Card:concealed' : `Card:${art.kind}`}
    onPointerOver={(e) => { if (onPick) { e.stopPropagation(); setHover(true); } }} onPointerOut={() => setHover(false)}
    onClick={(e) => { if (onPick) { e.stopPropagation(); onPick(); } }}>
    {(selected || (hover && onPick)) && <Block size={[.204, .006, .286]} color={palette.gold} position={[0, .001, 0]} radius={.014} />}
    <Block size={[.19, .009, .272]} color={palette.cream} position={[0, .007, 0]} radius={.004} />
    <PrintedFace width={.183} height={.265} position={[0, .012, 0]} draw={draw} resolution={512} />
    {onPick && <mesh position={[0, .008, 0]}><boxGeometry args={[.22, .04, .3]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
  </group>;
}
