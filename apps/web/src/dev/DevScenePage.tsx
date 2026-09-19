import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EMOTE_KINDS, type EmoteKind, type HeadViewpoint, type SceneIntent, type SceneQuality, type SceneSelection } from '@secret-table/contracts';
import { DEFAULT_FIXTURE_ID, getSceneFixture, sceneFixtureList } from '@secret-table/fixtures';
import { TableScene } from '@secret-table/scene';

import { useFrozenScene } from './useFrozenScene';

import './DevScenePage.css';

type IntentLogEntry = { at: string; intent: SceneIntent };

export function DevScenePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get('fixture') ?? DEFAULT_FIXTURE_ID;
  // D12 görsel kanıt: `&t=1300` cue zamanını o ana dondurur (yalnız dev).
  useFrozenScene(searchParams.get('t'));
  const fixture = getSceneFixture(requestedId) ?? getSceneFixture(DEFAULT_FIXTURE_ID);
  // D16 görsel kanıt: `&emote=point` yerel jesti oynatır, fixture `peers`
  // alanı karşıdaki oyuncuların jestini TAZE `t` ile besler (yalnız dev).
  const emoteParam = searchParams.get('emote');
  const localEmote = useMemo(() => {
    const kind = EMOTE_KINDS.find((k) => k === emoteParam) as EmoteKind | undefined;
    return kind ? { kind, seq: 1, at: Date.now() } : null;
  }, [emoteParam]);
  // D24 ölçümü: `&sweep=540` uzak başları 540 ms'de bir örneklenen bir üçgen
  // taramayla besler (yalnız dev; gerçek kanal değişmez).
  // Parametre yoksa tarama KAPALI (0): `Math.max(100, …)` her sahneyi taramaya
  // sokuyordu ve fixture jestlerini düşürüyordu (tur 3'te bulundu).
  const sweepRaw = Number(searchParams.get('sweep')) || 0;
  const sweep = sweepRaw > 0 ? Math.max(100, Math.min(3000, sweepRaw)) : 0;
  // D24 tur 2: `&jitter=300` paketi 0–300 ms geciktirir, `&loss=0.1` %10'unu
  // düşürür (gerçek Realtime davranışı; yalnız dev, gönderim kodu değişmez).
  const jitter = Math.max(0, Math.min(1000, Number(searchParams.get('jitter')) || 0));
  const loss = Math.max(0, Math.min(.5, Number(searchParams.get('loss')) || 0));
  // D16 tur 3 görsel kanıtı: `&peerYaw=1` fixture'daki uzak bakış yaw'ını ezer
  // (jestin bakışla dönüşünü tek karede görmek için; yalnız dev).
  const peerYaw = useMemo(() => {
    const raw = searchParams.get('peerYaw');
    const value = Number(raw);
    return raw !== null && Number.isFinite(value) ? Math.max(-1.4, Math.min(1.4, value)) : null;
  }, [searchParams]);
  const [peerTick, setPeerTick] = useState(0);
  const [sweepPeers, setSweepPeers] = useState<readonly HeadViewpoint[]>([]);
  useEffect(() => {
    if (sweep || !fixture?.peers?.length) return;
    // Bakış örnekleri alıcı saatine göre bayatlar; jest `seq`i sabit kaldığı
    // için tazeleme jesti yeniden başlatmaz.
    const timer = setInterval(() => setPeerTick((n) => n + 1), 1500);
    return () => clearInterval(timer);
  }, [fixture, sweep]);
  // Tarama akışı: NOMİNAL slotta açı üretilir, paket `jitter` kadar geç teslim
  // edilir ya da `loss` olasılıkla hiç teslim edilmez. `t` teslim anıdır —
  // gerçek kanalda da `acceptHeadWire` alıcı saatini yazar.
  useEffect(() => {
    if (!sweep || !fixture) return;
    const peerSeats = fixture.view.players.filter((p) => p.playerId !== fixture.view.localPlayerId);
    const start = Date.now();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let stopped = false;
    let slot = 0;
    const emit = () => {
      if (stopped) return;
      const sentAt = start + slot * sweep;
      slot += 1;
      // Üçgen tarama: 4 s'de bir tur, ±0,5 rad (sabit hız → düzenli fark).
      // Tur 2: periyot gönderim aralığının tam katı DEĞİL (4000 / 540 = 7,4);
      // katı olsaydı tepe hep aynı fazda örneklenir, iki eşit örnek arası düz
      // ara değer yapay bir "donuk kare" platosu üretirdi.
      const phase = (sentAt % 4000) / 4000;
      const yaw = (phase < .5 ? phase * 4 - 1 : 3 - phase * 4) * .5;
      if (loss > 0 && slot > 1 && Math.random() < loss) return;
      const deliver = () => {
        if (stopped) return;
        const now = Date.now();
        setSweepPeers(peerSeats.map((p) => ({
          roomId: fixture.view.roomId, playerId: p.playerId, seatIndex: p.seatIndex, yaw, pitch: yaw * .2, t: now,
        })));
      };
      if (jitter <= 0) { deliver(); return; }
      const timer = setTimeout(() => { timers.delete(timer); deliver(); }, Math.random() * jitter);
      timers.add(timer);
    };
    emit();
    const id = setInterval(emit, sweep);
    return () => {
      stopped = true; clearInterval(id);
      for (const timer of timers) clearTimeout(timer);
    };
  }, [fixture, sweep, jitter, loss]);
  const peers = useMemo<readonly HeadViewpoint[]>(() => {
    void peerTick;
    if (sweep) return sweepPeers;
    if (!fixture?.peers?.length) return [];
    const now = Date.now();
    return fixture.peers.map((peer) => ({
      roomId: fixture.view.roomId,
      playerId: peer.playerId,
      seatIndex: peer.seatIndex,
      yaw: peerYaw ?? peer.yaw,
      pitch: peer.pitch,
      t: now,
      ...(peer.emote ? { emote: { kind: peer.emote, seq: 1, at: now } } : {}),
    }));
  }, [fixture, peerTick, peerYaw, sweep, sweepPeers]);
  // `&camera=seat` kamerayı koltuğa sabitler (dondurulmuş saatte geçiş oynamaz).
  const camera = searchParams.get('camera') === 'seat' ? ('seat' as const) : undefined;
  const immersive = useMemo(
    () => (localEmote || peers.length || camera
      ? { active: false, cameraMode: camera, peers, emote: localEmote }
      : undefined),
    [localEmote, peers, camera],
  );

  const [selection, setSelection] = useState<SceneSelection | null>(fixture?.selection ?? null);
  const [quality, setQuality] = useState<SceneQuality>('standard');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [intentLog, setIntentLog] = useState<IntentLogEntry[]>([]);

  // Sahne değişince yerel seçim ve günlük sıfırlanır (phaseId değişimi davranışı).
  useEffect(() => {
    setSelection(fixture?.selection ?? null);
    setIntentLog([]);
  }, [fixture]);

  const selectFixture = useCallback(
    (id: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('fixture', id);
        return next;
      });
    },
    [setSearchParams],
  );

  const currentIndex = useMemo(
    () => sceneFixtureList.findIndex((item) => item.id === fixture?.id),
    [fixture],
  );

  const step = useCallback(
    (delta: number) => {
      if (currentIndex === -1) return;
      const next = sceneFixtureList[(currentIndex + delta + sceneFixtureList.length) % sceneFixtureList.length];
      if (next) selectFixture(next.id);
    },
    [currentIndex, selectFixture],
  );

  const handleIntent = useCallback((intent: SceneIntent) => {
    setIntentLog((log) => [{ at: new Date().toLocaleTimeString('tr-TR'), intent }, ...log].slice(0, 24));
    if (intent.type === 'select_option') {
      setSelection({ actionId: intent.actionId, optionId: intent.optionId });
    } else if (intent.type === 'clear_selection') {
      setSelection(null);
    }
  }, []);

  if (!fixture) {
    return <main className="dev-scene__empty">Sahne örneği bulunamadı.</main>;
  }

  return (
    <div className="dev-scene">
      <aside className="dev-scene__sidebar">
        <header>
          <h1>/dev/scene</h1>
          <p className="dev-scene__hint">Sentetik yetkili görünümler. Gerçek oturum/rol yok.</p>
        </header>

        <label className="dev-scene__field">
          <span>Sahne örneği</span>
          <select
            value={fixture.id}
            onChange={(event) => selectFixture(event.target.value)}
          >
            {sceneFixtureList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>

        <div className="dev-scene__row">
          <button type="button" onClick={() => step(-1)}>
            ← Önceki
          </button>
          <button type="button" onClick={() => step(1)}>
            Sonraki →
          </button>
        </div>

        <p className="dev-scene__desc">{fixture.description}</p>

        <fieldset className="dev-scene__field">
          <legend>Props</legend>
          <label>
            <input
              type="checkbox"
              checked={quality === 'low'}
              onChange={(event) => setQuality(event.target.checked ? 'low' : 'standard')}
            />
            düşük grafik (quality=low)
          </label>
          <label>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            hareket azaltma
          </label>
          <label>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(event) => setSoundEnabled(event.target.checked)}
            />
            ses açık
          </label>
        </fieldset>

        <div className="dev-scene__field">
          <span>Yerel seçim (selection)</span>
          <pre>{selection ? JSON.stringify(selection, null, 2) : 'null'}</pre>
          {selection ? (
            <button type="button" onClick={() => handleIntent({ type: 'clear_selection' })}>
              Seçimi temizle
            </button>
          ) : null}
        </div>

        <div className="dev-scene__field">
          <span>onIntent günlüğü</span>
          <ol className="dev-scene__log">
            {intentLog.length === 0 ? <li className="dev-scene__hint">Sahneye tıkla…</li> : null}
            {intentLog.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <code>{entry.at}</code> {entry.intent.type}
                {'playerId' in entry.intent ? ` · ${entry.intent.playerId}` : ''}
                {'optionId' in entry.intent ? ` · ${entry.intent.optionId}` : ''}
                {'cardId' in entry.intent ? ` · ${entry.intent.cardId}` : ''}
              </li>
            ))}
          </ol>
        </div>

        <details className="dev-scene__field">
          <summary>SceneView (ham)</summary>
          <pre>{JSON.stringify(fixture.view, null, 2)}</pre>
        </details>
      </aside>

      <main className="dev-scene__stage">
        <Suspense fallback={<div className="dev-scene__loading">Sahne yükleniyor…</div>}>
          <TableScene
            view={fixture.view}
            cues={fixture.cues}
            selection={selection}
            onIntent={handleIntent}
            quality={quality}
            reducedMotion={reducedMotion}
            soundEnabled={soundEnabled}
            immersive={immersive}
          />
        </Suspense>
      </main>
    </div>
  );
}

export default DevScenePage;
