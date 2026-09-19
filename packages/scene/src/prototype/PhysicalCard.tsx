import { useCallback } from 'react';
import type { CardArt } from '../materials/cardArt';
import { drawCard } from '../materials/cardArt';
import { Block, PrintedFace, lettering } from '../objects/Surface';
const concealed: CardArt = { kind: 'back' };
/** No private artwork is constructed when only the back is permitted. */
export function PhysicalCard({ art, onPick, selected = false, aimed = false, slot }: { art: CardArt; onPick?: () => void; selected?: boolean; aimed?: boolean; slot?: number }) {
  const kind = art.kind;
  const value = art.kind === 'policy' ? art.policy : art.kind === 'role' ? art.role : art.kind === 'ballot' ? art.vote : art.kind === 'membership' ? art.party : '';
  const drawFront = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    drawCard(ctx, w, h, art);
    if (slot !== undefined && (art.kind === 'policy' || art.kind === 'ballot')) {
      const title = art.kind === 'policy' ? (art.policy === 'liberal' ? 'LİBERAL' : 'FAŞİST') : art.vote === 'yes' ? 'EVET' : 'HAYIR';
      const color = art.kind === 'policy' ? (art.policy === 'liberal' ? '#286173' : '#9b352d') : '#253c35';
      // A repeated, full-word corner index remains exposed in a held fan.
      ctx.fillStyle = '#eee1c7'; ctx.fillRect(w * .065, h * .065, w * .87, h * .16);
      lettering(ctx, `${slot + 1} · ${title}`, w / 2, h * .12, w * .115, color, true, w * .85);
      ctx.save(); ctx.translate(w * .13, h * .37); ctx.rotate(-Math.PI / 2);
      lettering(ctx, title, 0, 0, w * .082, color, true); ctx.restore();
    }
  }, [kind, value, slot]);
  const drawBack = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => drawCard(ctx, w, h, concealed), []);
  return <group name={art.kind === 'back' ? 'PrototypeCard:concealed' : 'PrototypeCard:authorized'} onClick={(e) => { if (onPick) { e.stopPropagation(); onPick(); } }}>
    <Block size={[.19, .008, .272]} color="#eee1c7" radius={.004} />
    <PrintedFace width={.183} height={.265} position={[0, .0045, 0]} draw={drawFront} resolution={512} />
    <PrintedFace width={.183} height={.265} position={[0, -.0045, 0]} rotation={[Math.PI / 2, 0, Math.PI]} draw={drawBack} resolution={512} />
    {aimed && <mesh position={[0, .0058, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.186, .268]} /><meshBasicMaterial color="#efbf55" transparent opacity={.20} depthWrite={false} /></mesh>}
    {selected && <mesh position={[.084, .0053, .11]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.009, 12]} /><meshBasicMaterial color="#c9a551" /></mesh>}
    {onPick && <mesh><boxGeometry args={[.195, .024, .28]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
  </group>;
}
