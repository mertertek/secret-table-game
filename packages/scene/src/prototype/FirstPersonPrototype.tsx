// @refresh reset
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerCount, SceneQuality, SceneView } from '@secret-table/contracts';
import { getSceneFixture, makePlayers } from '../../../fixtures/src/index';
import { FirstPersonStage } from './FirstPersonStage';
import { acceptHead, centeredLook, INITIAL_RIG, poseAfter } from './model';
import type { CameraMode, Gesture, HeadSample, Look, PoseName, RigState } from './model';
import './prototype.css';
const labels: Record<Gesture, string> = { draw: 'Kart çek', select: 'Kartı seç', cancel: 'Vazgeç', place: 'Kartı bırak', ballot: 'Oyu masaya koy', vote: 'Oy kartını çevir', envelope: 'Zarfı aç', shoot: 'İnfaz (silah)' };
const poseLabels: Record<PoseName, string> = { rest: 'Eller masada', hold: 'Kartlar elde', selected: 'Yerel seçim', placed: 'Kapalı kart bırakıldı', voted: 'Oy masada kapalı', vote: 'Açıklanmış oy', envelope: 'Özel kimlik incelemesi', ready: 'Silah hazır (infaz yetkisi)', aim: 'Nişan (infaz)' };
export default function FirstPersonPrototype() {
  const [count, setCount] = useState<PlayerCount>(7); const [localIndex, setLocalIndex] = useState(0);
  const [mode, setMode] = useState<CameraMode>('overview'); const [look, setLook] = useState<Look>(centeredLook);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [quality, setQuality] = useState<SceneQuality>('standard'); const [privateRemoved, setPrivateRemoved] = useState(false);
  const [rig, setRig] = useState<RigState>(INITIAL_RIG); const [selections, setSelections] = useState(0); const [drags, setDrags] = useState(0);
  const [headLoop, setHeadLoop] = useState(false); const [heads, setHeads] = useState<HeadSample[]>([]); const sequence = useRef(0);
  const [note, setNote] = useState('Masa geneliyle başla; sonra kendi koltuğuna geç.');
  const [voteFace, setVoteFace] = useState<'yes' | 'no'>('yes');
  const [longNames, setLongNames] = useState(false);
  const players = useMemo(() => makePlayers({ count }).map((p) => longNames ? { ...p, displayName: `${p.displayName} · Çağrı Şengül Uzun İsim Örneği` } : p), [count, longNames]);
  const view = useMemo<SceneView>(() => {
    const base = getSceneFixture('president-discard')!.view;
    return { ...base, players, localPlayerId: `p${localIndex + 1}`, playerCountAtStart: count, boardVariant: count <= 6 ? 'small' : count <= 8 ? 'medium' : 'large',
      privateView: privateRemoved ? { role: null, hand: [], inspection: null, submittedVote: null, knownPlayers: [] } : { ...base.privateView, role: 'liberal' },
      table: { ...base.table, lastElection: { electionId: 'prototype-public-vote', presidentId: 'p1', chancellorId: 'p2', outcome: 'elected', votes: [{ playerId: `p${localIndex + 1}`, vote: voteFace }] } } };
  }, [players, localIndex, count, privateRemoved, voteFace]);
  const busy = rig.motion !== null;
  useEffect(() => {
    if (!rig.motion) return;
    const revision = rig.revision;
    if (reduced) { setRig((previous) => ({ ...previous, motion: null })); return; }
    const timer = setTimeout(() => setRig((previous) => previous.revision === revision ? { ...previous, motion: null } : previous), Math.max(0, rig.motion.startedAt + rig.motion.duration - performance.now()) + 20);
    return () => clearTimeout(timer);
  }, [rig.motion, rig.revision, reduced]);
  useEffect(() => {
    if (!headLoop) return;
    const tick = () => {
      const now = performance.now(); const seq = ++sequence.current;
      setHeads((previous) => players.filter((p) => p.playerId !== view.localPlayerId).flatMap((p, i) => {
        const sample = acceptHead(previous.find((h) => h.playerId === p.playerId), { playerId: p.playerId, sequence: seq, receivedAt: now, yaw: Math.sin(seq * .8 + i * 1.7) * .62, pitch: Math.cos(seq + i) * .18 }, players.map((p) => p.playerId), now);
        return sample ? [sample] : [];
      }));
    }; tick(); const timer = setInterval(tick, 1100); return () => clearInterval(timer);
  }, [headLoop, players, view.localPlayerId]);
  function reset() { setRig({ ...INITIAL_RIG }); setHeads([]); setHeadLoop(false); setNote('Yerel prototip sıfırlandı.'); }
  function play(kind: Gesture, selected = rig.selected) {
    if (busy && kind !== 'cancel') return;
    if ((kind === 'draw' || kind === 'select' || kind === 'place') && privateRemoved) return;
    setRig((previous) => poseAfter(previous, kind, performance.now(), reduced, selected));
    if (kind === 'select') setSelections((n) => n + 1);
    setNote(kind === 'place' ? 'Sentetik kabul: seçilen kart kapalı bırakılır. Canlı hamle gönderilmez.' : kind === 'cancel' ? 'Seçim geri alındı; kart eldeki yerine dönüyor.' : kind === 'vote' ? 'Yalnız açıklanmış oy örneği çevriliyor.' : kind === 'envelope' ? 'Kimlik yüzü yalnız koltuk/yakın görünümde çizilir.' : kind === 'draw' ? 'Yakındaki kart verme alanından yetkili el alınıyor.' : 'Bu seçim yalnız bu önizlemede tutulur.');
  }
  const canSelect = !busy && !privateRemoved && (rig.pose === 'hold' || rig.pose === 'selected');
  return <div className="fp-prototype">
    <header className="fp-header"><div><p className="fp-eyebrow">SECRET TABLE / GÖRSEL ATÖLYE</p><h1>Masadaki yerin.</h1></div><span className="fp-badge">F02 / F03 · BAĞIMSIZ PROTOTİP</span></header>
    <main className="fp-layout">
      <section className="fp-stage-panel" aria-label="Birinci şahıs prototipi">
        <div className="fp-stage-top"><span className="fp-status-dot" /><span className="fp-local-caption" title={players[localIndex]?.displayName}>{mode === 'overview' ? 'Masa geneli' : mode === 'inspect' ? 'Özel alan yakın planı' : `${players[localIndex]?.displayName} · Kendi koltuğundan`}</span><span className="fp-stage-meta">{count} koltuk · Ağ bağlantısı yok</span></div>
        <FirstPersonStage key={`${count}/${localIndex}`} view={view} mode={mode} look={look} rig={rig} heads={heads} quality={quality} reducedMotion={reduced} onLook={setLook} onSelect={(i) => { if (canSelect) play('select', i); }} onDrag={() => setDrags((n) => n + 1)} />
        <nav className="fp-camera-controls" aria-label="Kamera">
          <button aria-pressed={mode === 'seat'} onClick={() => setMode('seat')}>Kendi koltuğum</button>
          <button aria-pressed={mode === 'overview'} onClick={() => setMode('overview')}>Masa geneli</button>
          <button aria-pressed={mode === 'inspect'} onClick={() => setMode(mode === 'inspect' ? 'seat' : 'inspect')}>{mode === 'inspect' ? 'Bakışa dön' : 'Kartları yakından incele'}</button>
          <button onClick={() => setLook({ ...centeredLook })}>Bakışı ortala</button>
        </nav>
        <p id="fp-look-help" className="fp-help">Koltukta fareyle veya tek parmakla sürükle. Klavye: oklar ile bak, Home ile ortala. Sürükleme kart seçmez.</p>
      </section>
      <aside className="fp-controls">
        <p className="fp-eyebrow">01 / KOLTUK VE GÖRÜNÜM</p>
        <div className="fp-fields"><label>Kişi sayısı<select value={count} onChange={(e) => { const n = Number(e.target.value) as PlayerCount; setCount(n); setLocalIndex((i) => Math.min(i, n - 1)); reset(); setMode('overview'); }}>
          {[5, 6, 7, 8, 9, 10].map((n) => <option key={n}>{n}</option>)}</select></label>
          <label>Benim koltuğum<select value={localIndex} onChange={(e) => { setLocalIndex(Number(e.target.value)); reset(); setLook({ ...centeredLook }); setMode('overview'); }}>{players.map((p, i) => <option key={p.playerId} value={i}>{i + 1} · {p.displayName}</option>)}</select></label></div>
        <p className="fp-eyebrow">02 / ELLERLE DENE</p>
        <div className="fp-actions">
          <button className="fp-primary" disabled={busy || privateRemoved} onClick={() => play('draw')}>{labels.draw}</button>
          <button disabled={!canSelect} onClick={() => play('select')}>{labels.select}</button>
          <button disabled={rig.pose !== 'selected'} onClick={() => play('cancel')}>{labels.cancel}</button>
          <button disabled={busy || rig.pose !== 'selected'} onClick={() => play('place')}>{labels.place}</button>
          <button disabled={busy} onClick={() => play('vote')}>{labels.vote}</button>
          <button disabled={busy || privateRemoved} onClick={() => play('envelope')}>{labels.envelope}</button>
        </div>
        <div className="fp-feedback" role="status"><strong>{poseLabels[rig.pose]}</strong><p>{note}</p></div>
        <p className="fp-eyebrow">03 / GÖRSEL KONTROLLER</p>
        <label className="fp-check"><input type="checkbox" checked={headLoop} onChange={(e) => setHeadLoop(e.target.checked)} />Sentetik baş hareketleri</label>
        <span className="fp-small">Kapattığında başlar 1,8 saniye sonra nötre döner.</span>
        <label className="fp-check"><input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />Hareketi azalt</label>
        <label className="fp-check"><input type="checkbox" checked={quality === 'low'} onChange={(e) => setQuality(e.target.checked ? 'low' : 'standard')} />Düşük grafik</label>
        <details className="fp-qa"><summary>Gizlilik ve kontrol denemeleri</summary>
          <label className="fp-check"><input type="checkbox" checked={privateRemoved} onChange={(e) => { setPrivateRemoved(e.target.checked); setRig({ ...INITIAL_RIG }); }} />Özel veriyi kaldır</label>
          <label className="fp-check"><input type="checkbox" checked={longNames} onChange={(e) => setLongNames(e.target.checked)} />Uzun ad örneği</label>
          <label className="fp-check">Açıklanmış oy<select value={voteFace} onChange={(e) => setVoteFace(e.target.value as 'yes' | 'no')}><option value="yes">EVET</option><option value="no">HAYIR</option></select></label>
          <p data-fp-selections={selections} data-fp-drags={drags}>Yerel seçim: {selections} · Sürükleme: {drags} · Gönderilen hamle: 0</p>
          <button disabled={rig.pose !== 'selected'} onClick={() => { setRig((s) => poseAfter(s, 'cancel', performance.now(), reduced)); setNote('Sentetik ret: kart geri döndü, bırakma kesinleşmedi.'); }}>Reddedilen işlem örneği</button>
        </details>
        <button className="fp-reset" onClick={reset}>Hareketi sıfırla</button>
        <p className="fp-footnote">Yalnız sentetik görsel çalışma. Canlı oyun, F00 kabulü ve baş hareketlerinin ağ üzerinden paylaşımı bu önizlemeye dahil değil.</p>
      </aside>
    </main>
  </div>;
}
