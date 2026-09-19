/** Scene-owned offline QA only. Not exported by the package or imported by the app. */
import { useEffect, useRef, useState } from 'react';
import type { PlayerCount, SceneCue, SceneView, SceneSelection, SceneIntent } from '@secret-table/contracts';
import { getSceneFixture, makePlayers } from '../../../fixtures/src/index';
import { TableScene } from '../index';
const scenarios = { deal: 'president-discard', votes: 'election-result', enact: 'policy-result', office: 'president-discard', move: 'president-discard', eliminated: 'game-over-liberal', end: 'game-over-liberal', role: 'role-reveal-liberal', batch: 'president-discard' } as const;
type Scenario = keyof typeof scenarios;
const initial = getSceneFixture('president-discard')!;
export default function X03Preview() {
  const [scenario, setScenario] = useState<Scenario>('deal'); const [count, setCount] = useState<PlayerCount>(7);
  const [view, setView] = useState(initial.view); const [cues, setCues] = useState<readonly SceneCue[]>([]);
  const [selection, setSelection] = useState<SceneSelection | null>(null); const [intent, setIntent] = useState('—');
  const [sound, setSound] = useState(false); const [reduced, setReduced] = useState(false); const [low, setLow] = useState(false);
  const revision = useRef(100); const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [sample, setSample] = useState('');
  const [measurements, setMeasurements] = useState<string[]>([]);
  const measurementTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => () => { clearTimeout(timer.current); measurementTimers.current.forEach(clearTimeout); }, []);
  function build(): { next: SceneView; events: SceneCue[] } {
    const fixture = getSceneFixture(scenarios[scenario])!; const revisionNow = ++revision.current;
    const players = makePlayers({ count }).map((p) => ({ ...p, ...fixture.view.players.find((old) => old.playerId === p.playerId) }));
    const next: SceneView = { ...fixture.view, revision: revisionNow, localPlayerId: 'p1', players, playerCountAtStart: count, boardVariant: count <= 6 ? 'small' : count <= 8 ? 'medium' : 'large' };
    next.table = { ...next.table }; next.privateView = { ...next.privateView };
    const base = { gameId: next.gameId!, revision: revisionNow };
    let events: SceneCue[] = fixture.cues.map((cue, i) => ({ ...cue, ...base, cueId: `qa:${revisionNow}:${i}` }));
    if (scenario === 'votes' || scenario === 'batch') {
      const election = getSceneFixture('election-result')!.view.table.lastElection!;
      next.table.lastElection = { ...election, votes: players.map((p, i) => ({ playerId: p.playerId, vote: i % 3 === 0 ? 'no' : 'yes' })) };
      events = [{ ...base, cueId: `qa:${revisionNow}:votes`, kind: 'votes_revealed', ...next.table.lastElection }];
      if (scenario === 'batch') events.push(...fixture.cues.map((c, i) => ({ ...c, ...base, cueId: `qa:${revisionNow}:deal${i}` })));
    }
    if (scenario === 'office' || scenario === 'batch') {
      if (scenario === 'office') events = [];
      events.push(...players.filter((p) => p.office !== 'none').map((p): SceneCue => ({ ...base, cueId: `qa:${revisionNow}:${p.office}`, kind: 'office_moved', office: p.office as 'president' | 'chancellor', toPlayerId: p.playerId })));
    }
    if (scenario === 'move') { next.privateView.hand = []; events = [{ ...base, cueId: `qa:${revisionNow}:move`, kind: 'cards_moved', count: 2, from: 'president', to: 'discard' }]; }
    if (scenario === 'eliminated') { next.result = null; next.phase = 'nomination'; events = [{ ...base, cueId: `qa:${revisionNow}:out`, kind: 'player_eliminated', playerId: 'p3' }]; }
    if (scenario === 'end' && next.result) next.result = { ...next.result, revealedRoles: players.map((p, i) => ({ playerId: p.playerId, role: i === 2 ? 'hitler' : i % 3 ? 'liberal' : 'fascist' })) };
    return { next, events };
  }
  function run(mode: 'play' | 'interrupt' | 'resync' | 'new-view' = 'play') {
    clearTimeout(timer.current); measurementTimers.current.forEach(clearTimeout);
    const { next, events } = build(); setSelection(null); setView(next); setCues(events);
    const capture = (at: number) => {
      const host = stage.current?.querySelector<HTMLElement>('[data-scene-cues-active]');
      const canvas = stage.current?.querySelector('canvas');
      setMeasurements((previous) => [...previous, JSON.stringify({ scenario, count, mode, reduced, at, ...host?.dataset, frames: canvas?.dataset.sceneFrames })].slice(-20));
    };
    measurementTimers.current = [120, 1000].map((at) => setTimeout(() => capture(at), at));
    if (mode !== 'play') timer.current = setTimeout(() => {
      if (mode === 'interrupt') setView({ ...next, connection: 'reconnecting' });
      if (mode === 'resync') setCues([]);
      if (mode === 'new-view') { setView({ ...next, revision: ++revision.current, phase: 'nomination', privateView: { ...next.privateView, hand: [] } }); setCues([]); }
      // Capture the real public DOM after React has committed the interruption.
      timer.current = setTimeout(() => setSample(JSON.stringify(stage.current?.querySelector('[data-scene-cues-active]')?.getAttribute('data-scene-cues-active'))), 60);
    }, 180);
  }
  const onIntent = (i: SceneIntent) => { setIntent(JSON.stringify(i)); if (i.type === 'select_option') setSelection({ actionId: i.actionId, optionId: i.optionId }); };
  return <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100dvh', background: '#15231f', color: '#eee1c7', font: '13px system-ui' }}>
    <header style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <strong>X03 · Hareket ve ses</strong>
      <label>Örnek <select aria-label="Örnek" value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
        {Object.entries({ deal: 'Kart dağıtımı', votes: 'Oyları aç', enact: 'Politika yerleşimi', office: 'Görev işaretleri', move: 'Kapalı kart aktarımı', eliminated: 'Elenme', end: 'Oyun sonu', role: 'Kimlik zarfı', batch: 'Oy + el + görev' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Kişi <select aria-label="Kişi" value={count} onChange={(e) => setCount(Number(e.target.value) as PlayerCount)}>{[5, 6, 7, 8, 9, 10].map((n) => <option key={n}>{n}</option>)}</select></label>
      <button onClick={() => run()}>Yeni olay</button><button onClick={() => setCues([...cues])}>Aynı olayı yinele</button>
      <button onClick={() => run('resync')}>180 ms → eşitle</button><button onClick={() => run('interrupt')}>180 ms → kesinti</button><button onClick={() => run('new-view')}>180 ms → yeni görünüm</button>
      <label><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />Ses</label>
      <label><input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />Hareket azalt</label>
      <label><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} />Düşük kalite</label>
      <details><summary>Ölçüm günlüğü</summary><pre aria-label="Ölçüm günlüğü">{measurements.join('\n')}</pre></details>
      <output aria-label="Kesinti ölçümü">Aktif: {sample || '—'}</output><output aria-label="Son seçim">{intent}</output>
    </header>
    <main ref={stage} style={{ minHeight: 0, position: 'relative' }}><TableScene view={view} cues={cues} selection={selection} onIntent={onIntent} quality={low ? 'low' : 'standard'} soundEnabled={sound} reducedMotion={reduced} /></main>
  </div>;
}
