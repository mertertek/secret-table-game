// @vitest-environment jsdom
/**
 * Ekran ortası duyuru katmanı — ROADMAP D9 render testleri.
 *
 * `Announcer` tek başına (ilk yükleme tohumu + faz değişimi) ve `GameScreen`
 * içinde (tercih kapalıyken çizilmemesi) sınanır. 3D sahne taklit edilir.
 */
import { useCallback, useState } from 'react';
import type { SceneCue, SceneIntent, SceneSelection, SceneView } from '@secret-table/contracts';
import { getSceneFixture } from '@secret-table/fixtures';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoomState } from '../multiplayer/useRoomState';
import { Announcer } from './Announcer';
import { GameScreen } from './GameScreen';
import { EXECUTION_FIRE_MS, PHASE_MS } from './announcements';

type GameRoom = Extract<RoomState, { phase: 'game' }>;

vi.mock('./SceneFrame', () => ({ SceneFrame: () => null }));

afterEach(cleanup);
beforeEach(() => {
  try {
    globalThis.localStorage?.removeItem?.('secret-table:prefs');
  } catch {
    /* depolama kapalı olabilir */
  }
});

const nominationView = getSceneFixture('nomination')!.view;
const votingView = getSceneFixture('voting')!.view;
const discardFixture = getSceneFixture('president-discard')!;

const card = () => document.querySelector('.announcer__card');

describe('Announcer', () => {
  it('ilk yüklemede hiçbir duyuru çizmez (geçmiş faz oynatılmaz)', () => {
    render(<Announcer view={votingView} cues={[]} />);
    expect(card()).toBeNull();
  });

  it('faz değişiminde görünür metinle duyuru çizer', () => {
    const { rerender } = render(<Announcer view={votingView} cues={[]} />);
    rerender(<Announcer view={nominationView} cues={[]} />);

    const region = screen.getByRole('status');
    expect(region.textContent).toContain('ADAY SEÇİMİ');
    expect(region.textContent).toContain('Şansölye adayını seç');
    expect(card()?.className).toContain('announcer__card--you');
  });

  it('aynı faz tekrar render edilince duyuru ikinci kez çıkmaz', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<Announcer view={votingView} cues={[]} />);
      rerender(<Announcer view={nominationView} cues={[]} />);
      expect(card()).not.toBeNull();

      // Süresi dolsun (bekleme + 200 ms çıkış).
      act(() => {
        vi.advanceTimersByTime(PHASE_MS + 400);
      });
      expect(card()).toBeNull();

      rerender(<Announcer view={{ ...nominationView }} cues={[]} />);
      expect(card()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cue temelli sonuç duyurusu (infaz) tehlike tonuyla ve ATEŞ anında çıkar', () => {
    const shot: SceneCue = {
      cueId: 'cue_shot',
      gameId: discardFixture.view.gameId!,
      revision: 99,
      kind: 'player_eliminated',
      playerId: 'p3',
    };
    vi.useFakeTimers();
    try {
      const { rerender } = render(<Announcer view={discardFixture.view} cues={[]} />);
      rerender(<Announcer view={discardFixture.view} cues={[shot]} />);

      // D12 §4: silah kalkarken duyuru YOK; 1300 ms'de (ateş) görünür.
      expect(card()).toBeNull();
      act(() => {
        vi.advanceTimersByTime(EXECUTION_FIRE_MS - 50);
      });
      expect(card()).toBeNull();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.getByRole('status').textContent).toContain('İNFAZ');
      expect(card()?.className).toContain('announcer__card--danger');
    } finally {
      vi.useRealTimers();
    }
  });

  it('tıklamayı engellemez: katman pointer-events almaz', () => {
    const { rerender } = render(<Announcer view={votingView} cues={[]} />);
    rerender(<Announcer view={nominationView} cues={[]} />);
    expect(document.querySelector('.announcer')).not.toBeNull();
    // Sınıf sözleşmesi: `.announcer { pointer-events: none }` (styles.css).
    expect(card()?.closest('.announcer')).not.toBeNull();
  });
});

/** `useRoomState`in oyun dalını taklit eder. */
function Harness({ view }: { view: SceneView }) {
  const [selection, setSelection] = useState<SceneSelection | null>(null);
  const [rolePanelOpen, setRolePanelOpen] = useState(false);
  const onIntent = useCallback((intent: SceneIntent) => {
    if (intent.type === 'select_option') {
      setSelection({ actionId: intent.actionId, optionId: intent.optionId });
    } else if (intent.type === 'clear_selection') {
      setSelection(null);
    }
  }, []);

  const room: GameRoom = {
    phase: 'game',
    mode: 'dev',
    connection: 'connected',
    view,
    cues: [],
    selection,
    busyActionId: null,
    transient: null,
    rolePanelOpen,
    resetEpoch: 0,
    peerViewpoints: [],
    onIntent,
    submitSelected: () => setSelection(null),
    clearSelection: () => setSelection(null),
    setRolePanelOpen,
    sendViewpoint: () => undefined,
    sendEmote: () => false,
    playAgain: () => undefined,
    returnToLobby: () => undefined,
    refresh: () => undefined,
  };
  return <GameScreen room={room} />;
}

describe('GameScreen — duyuru tercihi', () => {
  it('menüde "Duyurular" anahtarı vardır ve kapatılınca katman çizilmez', () => {
    const { rerender } = render(<Harness view={votingView} />);
    fireEvent.click(screen.getByRole('button', { name: /Menü/ }));
    const toggle = screen.getByLabelText('Duyurular') as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));

    rerender(<Harness view={nominationView} />);
    expect(card()).toBeNull();
  });
});
