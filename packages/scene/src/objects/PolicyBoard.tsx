import { Motion } from '../animation/Motion';
import type { ActiveCue } from '../animation/cues';
import { useCallback } from 'react';
import type { BoardVariant, EnactedPolicy, PolicyType, SceneQuality } from '@secret-table/contracts';
import { Block, PrintedFace, lettering } from './Surface';
import { palette } from '../materials/palette';
import { emblem } from '../materials/cardArt';
import { PolicyTile } from './PolicyTile';
import {
  BOARD_GEOMETRY, boardSlotPlans, drawBand, drawChaosStrip, drawHitlerStrip, drawSlot, drawTrackerColumn,
  hitlerStripSlots,
} from './boardArt';
import { sceneText, useSceneLanguage } from '../i18n/sceneText';
const VARIANT_RANGE: Record<BoardVariant, string> = { small: '5–6', medium: '7–8', large: '9–10' };
/**
 * D10 — politika tahtası (`docs/design/D10-boards.md`). Tek `PrintedFace`; bütün yuva,
 * yetki bandı ve şerit çizimi `boardArt.ts` üzerinden tuvale gider (çizim çağrısı artmaz).
 * Yuva/kart konum kesirleri değişmedi; yetki düzeni `BOARD_LAYOUTS`'tan türetilir.
 */
export function PolicyBoard({ party, count, variant, enacted, active, reducedMotion = false, quality = 'standard' }: { active?: ActiveCue; reducedMotion?: boolean; party: PolicyType; count: number; variant: BoardVariant; enacted: readonly EnactedPolicy[]; quality?: SceneQuality }) {
  const slots = party === 'liberal' ? 5 : 6;
  // D23: dil `draw` kimliğine girer → dil değişince doku yeniden üretilir,
  // eski doku `PrintedFace` temizliğinde dispose edilir.
  const language = useSceneLanguage();
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const { w: W, h: H } = BOARD_GEOMETRY;
    ctx.save();
    ctx.scale(w / W, h / H); // Tasarım uzayı: 1940 × 450 px = 1,94 × 0,45 m.
    ctx.fillStyle = palette.cream; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = palette[party]; ctx.lineWidth = 3; ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.fillStyle = palette[party]; ctx.fillRect(16, 16, W * .25, H - 32);
    emblem(ctx, party, W * .14, H * .34, H * .19, palette.cream, palette[party]);
    lettering(ctx, sceneText(language, party === 'liberal' ? 'board.liberal' : 'board.fascist'), W * .14, H * .68, H * .11, palette.cream, true);
    lettering(ctx, `${VARIANT_RANGE[variant]} ${language === 'tr' ? 'OYUNCU' : 'PLAYERS'}`, W * .14, H * .84, H * .058, palette.cream);
    const strip = hitlerStripSlots(party, variant);
    if (strip) drawHitlerStrip(ctx, strip, language);
    for (const plan of boardSlotPlans(party, variant, language)) {
      drawSlot(ctx, plan);
      if (plan.band) drawBand(ctx, plan.index, plan.band, party, language);
    }
    if (party === 'liberal') { drawChaosStrip(ctx, language); drawTrackerColumn(ctx, language); }
    ctx.restore();
  }, [party, variant, language]);
  return <group name={`PolicyBoard:${party}:${variant}`}>
    <Block size={[1.96, .034, .47]} color="#d3bf99" position={[0, .017, 0]} radius={.015} />
    <PrintedFace width={1.94} height={.45} position={[0, .035, 0]} draw={draw} resolution={quality === 'low' ? 1024 : 2048} />
    {Array.from({ length: slots }, (_, i) => {
      const policy = enacted.find((tile) => tile.board === party && tile.slotIndex === i)?.policy ?? (i < count ? party : undefined);
      return policy ? <group key={i} position={[(.358 + i * .109 - .5) * 1.94, .039, 0]} scale={.93}><Motion active={active?.cue.kind === 'policy_enacted' && active.cue.slotIndex === i ? active : undefined} reducedMotion={reducedMotion} from={[.25, .14, .55]}><PolicyTile policy={policy} /></Motion></group> : null;
    })}
  </group>;
}
