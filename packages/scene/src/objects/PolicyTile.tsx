import { useMemo } from 'react';
import type { PolicyType } from '@secret-table/contracts';
import type { CardArt } from '../materials/cardArt';
import { CardBody } from './CardBody';
export function PolicyTile({ policy, selected, onPick, reducedMotion }: { policy?: PolicyType; selected?: boolean; onPick?: () => void; reducedMotion?: boolean }) {
  const art = useMemo<CardArt>(() => policy ? { kind: 'policy', policy } : { kind: 'back' }, [policy]);
  return <CardBody art={art} selected={selected} onPick={onPick} reducedMotion={reducedMotion} />;
}
