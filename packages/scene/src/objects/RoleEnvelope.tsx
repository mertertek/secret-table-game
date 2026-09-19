import { useCallback, useMemo } from 'react';
import { Motion } from '../animation/Motion';
import type { SecretRole } from '@secret-table/contracts';
import { Block, PrintedFace, lettering } from './Surface';
import { RoleCard } from './RoleCard';
import { sceneText, useSceneLanguage } from '../i18n/sceneText';
export function RoleEnvelope({ role, open = false, onPick, reducedMotion = false }: { role?: SecretRole; open?: boolean; onPick?: () => void; reducedMotion?: boolean }) {
  // Purely local reveal, never stores an old role. Closing unmounts the face immediately.
  const opening = useMemo(() => open ? { startedAt: performance.now(), duration: 550 } : undefined, [open]);
  const language = useSceneLanguage();
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = '#ac9875'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w / 2, h * .58); ctx.lineTo(w, 0); ctx.stroke();
    lettering(ctx, sceneText(language, 'envelope.identity'), w / 2, h * .81, h * .09, '#75664e');
  }, [language]);
  return <group name="RoleEnvelope" onClick={(e) => { if (onPick) { e.stopPropagation(); onPick(); } }}>
    <Block size={[.22, .013, .30]} color="#d7c4a0" position={[0, .007, 0]} radius={.005} />
    {open && role ? <group position={[0, .02, -.085]}><Motion active={opening} reducedMotion={reducedMotion} from={[0, .03, .085]}><RoleCard role={role} /></Motion></group> : <>
      <PrintedFace width={.213} height={.293} position={[0, .015, 0]} draw={draw} resolution={512} />
      <mesh position={[0, .023, .015]}>
        <cylinderGeometry args={[.026, .028, .008, 20]} />
        <meshStandardMaterial color="#8b5141" roughness={.6} />
      </mesh>
    </>}
    {open && <Block size={[.22, .006, .14]} color="#e0ceaa" position={[0, .008, -.22]} radius={.002} />}
    {onPick && <mesh position={[0, .03, 0]}><boxGeometry args={[.25, .09, .36]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
  </group>;
}
