import { useMemo } from 'react';
import type { SecretRole } from '@secret-table/contracts';
import type { CardArt } from '../materials/cardArt';
import { CardBody } from './CardBody';
export function RoleCard({ role }: { role?: SecretRole }) {
  const art = useMemo<CardArt>(() => role ? { kind: 'role', role } : { kind: 'back' }, [role]);
  return <CardBody art={art} />;
}
