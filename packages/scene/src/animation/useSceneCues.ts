import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SceneCue, SceneView } from '@secret-table/contracts';
import { CueLedger, cueMatchesView, durations, sceneIdentity } from './cues';
import type { ActiveCue } from './cues';
import { SceneAudio } from '../audio/SceneAudio';
import type { AudioStats, SoundKind } from '../audio/SceneAudio';
import { EXECUTION } from './execution';
const sounds: Record<SceneCue['kind'], SoundKind> = { cards_dealt: 'paper', cards_moved: 'paper', votes_revealed: 'turn', policy_enacted: 'wood', office_moved: 'wood', player_eliminated: 'shot', game_ended: 'end' };
export function useSceneCues(view: SceneView, cues: readonly SceneCue[], reducedMotion: boolean, soundEnabled: boolean, epoch = 0, suspended = false) {
  const ledger = useRef(new CueLedger());
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [active, setActive] = useState<ActiveCue[]>([]);
  const activeEpoch = useRef(epoch);
  const [played, setPlayed] = useState(0);
  const [audioStats, setAudioStats] = useState<AudioStats>({ state: 'locked', played: 0, voices: 0 });
  const audio = useRef<SceneAudio | null>(null);
  const audioView = useRef('');
  /** D12: ateş sesi cue başında değil, koreografinin 1300. ms'sinde çalar. */
  const timers = useRef<number[]>([]);
  const clearTimers = () => { for (const id of timers.current) clearTimeout(id); timers.current = []; };
  const later = (kind: SoundKind, ms: number) => {
    timers.current.push(window.setTimeout(() => audio.current?.play(kind), ms));
  };
  useEffect(() => {
    const engine = new SceneAudio(setAudioStats); audio.current = engine;
    engine.setEnabled(soundEnabled && visible && view.connection === 'connected' && !view.paused);
    const unlock = (event: Event) => { if (event.isTrusted) engine.unlock(); };
    const visibility = () => {
      // Consume while hidden even when the browser throttles React work.
      if (document.visibilityState === 'hidden') engine.stop();
      setVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('click', unlock, true); document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('click', unlock, true); document.removeEventListener('visibilitychange', visibility);
      engine.dispose(); audio.current = null; clearTimers();
    };
  }, []);
  useLayoutEffect(() => {
    const nextAudioView = `${sceneIdentity(view)}/${view.revision}/${epoch}`;
    if (audioView.current !== nextAudioView) { audio.current?.stop(); clearTimers(); }
    audioView.current = nextAudioView;
    audio.current?.setEnabled(soundEnabled && !suspended && visible && view.connection === 'connected' && !view.paused);
    const now = performance.now();
    const next = ledger.current.update(view, cues, now, visible && !suspended, reducedMotion, epoch);
    activeEpoch.current = epoch;
    setActive(next.active);
    setPlayed((n) => n + next.added.length);
    // One foley sound for a simultaneous batch, avoiding a noisy pile of office/deal sounds.
    // D12 §4: infaz paketinde ses cue başında DEĞİL, ateş anında (t=1300) çalar;
    // aynı pakette gelen oyun sonu sesi de koreografi bittikten sonra gelir.
    const execution = next.added.find((a) => a.cue.kind === 'player_eliminated');
    const sound = execution ? undefined : next.added.find((a) => a.cue.kind === 'game_ended') ?? next.added.find((a) => a.cue.kind === 'votes_revealed') ?? next.added[0];
    if (sound) audio.current?.play(sounds[sound.cue.kind]);
    if (execution) {
      later('shot', EXECUTION.fireAt);
      if (next.added.some((a) => a.cue.kind === 'game_ended')) later('end', durations.player_eliminated);
    }
    if (!next.active.length) { audio.current?.stop(); clearTimers(); }

  }, [view, cues, visible, reducedMotion, soundEnabled, epoch, suspended]);
  useEffect(() => {
    if (!active.length) return;
    const remaining = Math.max(0, Math.min(...active.map((a) => a.startedAt + a.duration - performance.now())));
    const timer = window.setTimeout(() => setActive((previous) => previous.filter((a) => a.startedAt + a.duration > performance.now())), remaining + 16);
    return () => window.clearTimeout(timer);
  }, [active]);
  // Gate in render too: a new view cannot show an old hand for even one painted frame.
  const current = activeEpoch.current === epoch && !suspended && visible && !view.paused && view.connection === 'connected' ? active.filter((a) => cueMatchesView(a.cue, view)) : [];
  const playLocal = (kind: SoundKind) => { if (!suspended && visible && !view.paused && view.connection === 'connected') audio.current?.play(kind); };
  return { active: current, played, audioStats, playLocal, visible };
}
