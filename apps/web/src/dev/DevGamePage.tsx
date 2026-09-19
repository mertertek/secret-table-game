import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { HeadViewpoint, SceneIntent, SceneSelection } from '@secret-table/contracts';
import { DEFAULT_FIXTURE_ID, getSceneFixture, sceneFixtureList } from '@secret-table/fixtures';

import type { RoomState } from '../multiplayer/useRoomState';
import { GameScreen } from '../ui/GameScreen';
import { useFrozenScene } from './useFrozenScene';

type GameRoom = Extract<RoomState, { phase: 'game' }>;

/**
 * `/dev/game?fixture=…` — YALNIZ geliştirme girişi (routes.tsx `import.meta.env.DEV`).
 *
 * Gerçek `GameScreen` düzenini sentetik `SceneView` fixture'ları ile açar; ağ,
 * Supabase oturumu veya gerçek oda yoktur. Tam ekran düzeni, üst şerit, alt
 * eylem çubuğu ve menüyü gerçek tarayıcıda kontrol etmek içindir.
 */
export function DevGamePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get('fixture') ?? DEFAULT_FIXTURE_ID;
  // D12 görsel kanıt: `&t=1300` cue zamanını o ana dondurur (yalnız dev).
  useFrozenScene(searchParams.get('t'));
  const fixture = getSceneFixture(requestedId) ?? getSceneFixture(DEFAULT_FIXTURE_ID)!;

  const [selection, setSelection] = useState<SceneSelection | null>(fixture.selection);
  const [rolePanelOpen, setRolePanelOpen] = useState(false);
  // D16 görsel kanıt: fixture'ın sentetik akranları TAZE `t` ile beslenir; jest
  // `seq`i sabit kaldığı için tazeleme jesti yeniden başlatmaz. Yerel jest
  // gerçek `GameScreen` yolundan geçer (`sendEmote` burada hep başarılı).
  const [peerTick, setPeerTick] = useState(0);
  useEffect(() => {
    if (!fixture.peers?.length) return;
    const timer = setInterval(() => setPeerTick((n) => n + 1), 1500);
    return () => clearInterval(timer);
  }, [fixture]);
  const peerViewpoints = useMemo<readonly HeadViewpoint[]>(() => {
    void peerTick;
    if (!fixture.peers?.length) return [];
    const now = Date.now();
    return fixture.peers.map((peer) => ({
      roomId: fixture.view.roomId,
      playerId: peer.playerId,
      seatIndex: peer.seatIndex,
      yaw: peer.yaw,
      pitch: peer.pitch,
      t: now,
      ...(peer.emote ? { emote: { kind: peer.emote, seq: 1, at: now } } : {}),
    }));
  }, [fixture, peerTick]);

  const onIntent = useCallback((intent: SceneIntent) => {
    if (intent.type === 'select_option') {
      setSelection({ actionId: intent.actionId, optionId: intent.optionId });
    } else if (intent.type === 'clear_selection') {
      setSelection(null);
    } else if (intent.type === 'inspect_own_role') {
      setRolePanelOpen((cur) => intent.open ?? !cur);
    }
  }, []);

  const room = useMemo<GameRoom>(
    () => ({
      phase: 'game',
      mode: 'dev',
      connection: 'connected',
      view: fixture.view,
      cues: fixture.cues,
      selection,
      busyActionId: null,
      transient: null,
      rolePanelOpen,
      resetEpoch: 0,
      peerViewpoints,
      onIntent,
      submitSelected: () => setSelection(null),
      clearSelection: () => setSelection(null),
      setRolePanelOpen,
      sendViewpoint: () => undefined,
      sendEmote: () => true,
      playAgain: () => undefined,
      returnToLobby: () => undefined,
      refresh: () => undefined,
    }),
    [fixture, selection, rolePanelOpen, onIntent, peerViewpoints],
  );

  return (
    <>
      <GameScreen room={room} />
      <select
        className="dev-game__picker"
        value={fixture.id}
        aria-label="Sahne senaryosu"
        onChange={(e) => {
          const next = e.target.value;
          setSelection(null);
          setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set('fixture', next);
            return params;
          });
        }}
      >
        {sceneFixtureList.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
    </>
  );
}
