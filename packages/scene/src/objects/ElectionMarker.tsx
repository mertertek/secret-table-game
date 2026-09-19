import { useCallback } from 'react';
import { PrintedFace, lettering } from './Surface';
import { palette } from '../materials/palette';
import { sceneText, useSceneLanguage } from '../i18n/sceneText';
export function ElectionMarker({ value }: { value: number }) {
  const language = useSceneLanguage();
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    lettering(ctx, sceneText(language, 'board.tracker'), w * .23, h * .52, h * .28, '#c4c7ad');
    for (let i = 0; i < 4; i++) {
      const x = w * (.51 + i * .125);
      ctx.beginPath(); ctx.arc(x, h * .5, h * .28, 0, Math.PI * 2); ctx.strokeStyle = '#8d9c7b'; ctx.lineWidth = 2; ctx.stroke();
      lettering(ctx, String(i), x, h * .52, h * .29, '#c4c7ad');
    }
  }, [language]);
  return <group name="ElectionMarker">
    <PrintedFace width={1.3} height={.11} draw={draw} />
    <mesh position={[(.51 + Math.max(0, Math.min(3, value)) * .125 - .5) * 1.3, .013, 0]} castShadow>
      <cylinderGeometry args={[.032, .035, .023, 20]} /><meshStandardMaterial color={palette.gold} metalness={.6} roughness={.34} />
    </mesh>
  </group>;
}
