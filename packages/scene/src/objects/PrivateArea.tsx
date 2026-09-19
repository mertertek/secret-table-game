import type { ActiveCue } from '../animation/cues';
import { Motion } from '../animation/Motion';
import { useCallback } from 'react';
import type { AllowedAction, SceneIntent, SceneSelection, SceneView } from '@secret-table/contracts';
import { PolicyTile } from './PolicyTile';
import { BallotCard } from './BallotCard';
import { RoleEnvelope } from './RoleEnvelope';
import { CardBody } from './CardBody';
import { PrintedFace, lettering } from './Surface';
import { palette } from '../materials/palette';
import { pickOption, selectedSceneOption } from '../layout/presentation';
import { TargetZone } from '../live/Targeting';
import { sceneSlots } from '../live/inputs';
import { sceneText, useSceneLanguage } from '../i18n/sceneText';
export function PrivateArea({ view, actions, selection, onIntent, reducedMotion, roleOpen, onToggleRole, deal }: {
  deal?: ActiveCue; view: SceneView; actions: readonly AllowedAction[]; selection: SceneSelection | null;
  onIntent: (intent: SceneIntent) => void; reducedMotion: boolean; roleOpen: boolean; onToggleRole: () => void;
}) {
  const selected = selectedSceneOption(actions, selection);
  const slots = sceneSlots(view);
  const hand = view.privateView.hand;
  const voting = view.phase === 'voting';
  const inspection = view.privateView.inspection;
  const language = useSceneLanguage();
  const drawLabel = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const key = hand.length ? 'private.hand' : voting ? 'private.vote' : inspection ? 'private.inspection' : 'private.identity';
    lettering(ctx, sceneText(language, key), w / 2, h / 2, h * .5, palette.cream);
  }, [hand.length, voting, inspection, language]);
  const hasContent = hand.length > 0 || voting || inspection || view.privateView.role;
  if (!hasContent) return null;
  return <group name="PrivateArea" position={[0, .026, .97]}>
    <PrintedFace width={.45} height={.065} position={[-.76, .002, .04]} draw={drawLabel} resolution={512} />
    {hand.length > 0 ? hand.map((card, index) => <group key={card.cardId} position={[(index - (hand.length - 1) / 2) * .34, 0, 0]} scale={1.45}>
      <TargetZone slot selection={slots[index] ?? null} size={[.22, .02, .29]} />
      <Motion active={deal} reducedMotion={reducedMotion} delay={index * 55} from={[(-1.28 - (index - (hand.length - 1) / 2) * .34) / 1.45, .1, -1.04 / 1.45]}><PolicyTile policy={card.policy} selected={selected?.cardId === card.cardId} reducedMotion={reducedMotion}
        onPick={() => onIntent(pickOption(actions, (option) => option.cardId === card.cardId) ?? { type: 'inspect_card', cardId: card.cardId })} /></Motion>
    </group>) : voting ? (['yes', 'no'] as const).map((vote, i) => <group key={vote} position={[(i - .5) * .37, 0, 0]} scale={1.35}>
      <TargetZone slot selection={slots[i] ?? null} size={[.22, .02, .29]} />
      <BallotCard vote={vote} selected={selected?.vote === vote || view.privateView.submittedVote === vote}
        reducedMotion={reducedMotion} onPick={actions.some((action) => action.options.some((option) => option.vote === vote)) ? () => {
          const intent = pickOption(actions, (option) => option.vote === vote); if (intent) onIntent(intent);
        } : undefined} />
    </group>) : inspection ? inspection.kind === 'policy_peek' ? inspection.upcoming.map((policy, i) => <group key={i} position={[(i - (inspection.upcoming.length - 1) / 2) * .34, 0, 0]} scale={1.4}><PolicyTile policy={policy} /></group>) :
      <group scale={1.4}><CardBody art={{ kind: 'membership', party: inspection.party }} /></group> :
      <group scale={1.16}><RoleEnvelope role={view.privateView.role ?? undefined} open={roleOpen} onPick={onToggleRole} reducedMotion={reducedMotion} /></group>}
  </group>;
}
