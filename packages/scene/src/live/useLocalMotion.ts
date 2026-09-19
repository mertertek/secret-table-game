import { useLayoutEffect, useRef, useState } from 'react';
import type { SceneSelection, SceneView } from '@secret-table/contracts';
import { cueOfficePlayerId } from '../animation/cues';
import type { ActiveCue } from '../animation/cues';
import { localAimYaw, executionShooterId } from '../animation/execution';
import { layoutSeats } from '../layout/seats';
import { LocalMotion } from './LocalMotion';
export function useLocalMotion(view: SceneView, selection: SceneSelection | null, roleOpen: boolean, epoch: number, suspended: boolean, reduced: boolean, active: readonly ActiveCue[]) {
  const motion = useRef(new LocalMotion());
  const [, repaint] = useState(0);
  // Synchronous current-view gate: no stale card or timer can survive an authority change.
  let state = motion.current.update(view, selection, roleOpen, epoch, suspended, performance.now(), reduced);
  const cue = !suspended && active.find((a) => { const c = a.cue; return c.kind === 'votes_revealed' || (c.kind === 'cards_moved' && cueOfficePlayerId(view, c.from) === view.localPlayerId); });
  if (cue) state = motion.current.acceptPublic(cue.cue.cueId, cue.cue.kind === 'votes_revealed' ? 'vote' : 'place', performance.now(), reduced);
  // D12 §4/§5 — infaz: yerel oyuncu BAŞKANSA silah onun elinde kalkar. Nişan yaw'ı
  // koltuk düzeninden gelir (kamu bilgisi); cue yalnız bir kez tüketilir.
  const shot = suspended ? undefined : active.find((a) => a.cue.kind === 'player_eliminated' && executionShooterId(view, a.cue.playerId, cueOfficePlayerId(view, 'president')) === view.localPlayerId);
  const shotCue = shot && shot.cue.kind === 'player_eliminated' ? shot.cue : undefined;
  if (shotCue) {
    const seats = layoutSeats(view);
    const me = seats.find((s) => s.player.playerId === view.localPlayerId);
    const target = seats.find((s) => s.player.playerId === shotCue.playerId);
    if (me && target && me !== target) state = motion.current.acceptExecution(shotCue.cueId, localAimYaw(me, target), performance.now());
  }
  const generation = state.revision;
  useLayoutEffect(() => {
    if (!state.motion) return;
    const timer = setTimeout(() => { if (motion.current.state.revision === generation) repaint((n) => n + 1); }, Math.max(0, state.motion.startedAt + state.motion.duration - performance.now()) + 16);
    return () => clearTimeout(timer);
  }, [generation, state.motion]);
  return state;
}
