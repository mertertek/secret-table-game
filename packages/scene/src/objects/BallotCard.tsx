import { useMemo } from 'react';
import type { VoteValue } from '@secret-table/contracts';
import type { CardArt } from '../materials/cardArt';
import { CardBody } from './CardBody';
export function BallotCard({ vote, selected, onPick, reducedMotion }: { vote?: VoteValue; selected?: boolean; onPick?: () => void; reducedMotion?: boolean }) {
  const art = useMemo<CardArt>(() => vote ? { kind: 'ballot', vote } : { kind: 'back' }, [vote]);
  return <CardBody art={art} selected={selected} onPick={onPick} reducedMotion={reducedMotion} />;
}
