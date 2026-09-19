// @vitest-environment jsdom
/**
 * Tam ekran öncelikli oyun ekranı — ROADMAP A2 / A3 render testleri.
 *
 * Gerçek `GameScreen` + `ActionBar` + `GameMenu` + `useTableControls` render
 * edilir; 3D sahne (`SceneFrame` → WebGL) taklit edilir ve aldığı props
 * doğrulanır. Ağ yok: `RoomState` sahte bir nesnedir.
 */
import { useCallback, useState } from 'react';
import type { SceneCue, SceneIntent, SceneSelection, SceneView } from '@secret-table/contracts';
import { getSceneFixture } from '@secret-table/fixtures';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoomState } from '../multiplayer/useRoomState';
import { GameScreen } from './GameScreen';

type GameRoom = Extract<RoomState, { phase: 'game' }>;
type SceneFrameProps = { onIntent: (i: SceneIntent) => void; immersive?: Record<string, unknown> };

const hoisted = vi.hoisted(() => {
  // jsdom'da Pointer Lock / Fullscreen API'leri yok; "Oyuna odaklan" akışının
  // render edildiğini görebilmek için varlıklarını taklit et (davranış değil).
  if (typeof document !== 'undefined') {
    if (!('pointerLockElement' in document)) {
      Object.defineProperty(document, 'pointerLockElement', {
        value: null,
        writable: true,
        configurable: true,
      });
    }
    if (!document.documentElement.requestFullscreen) {
      Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
        value: () => Promise.resolve(),
        writable: true,
        configurable: true,
      });
    }
  }
  return { sceneProps: [] as SceneFrameProps[] };
});

vi.mock('./SceneFrame', () => ({
  SceneFrame: (props: SceneFrameProps) => {
    hoisted.sceneProps.push(props);
    return null;
  },
}));

const lastSceneProps = () => hoisted.sceneProps[hoisted.sceneProps.length - 1]!;

afterEach(cleanup);
beforeEach(() => {
  hoisted.sceneProps.length = 0;
  try {
    globalThis.localStorage?.removeItem?.('secret-table:prefs');
  } catch {
    /* depolama kapalı olabilir */
  }
});

type HarnessProps = {
  view: SceneView;
  submitSpy?: (selection: SceneSelection | null) => void;
  playAgain?: () => void;
  cues?: readonly SceneCue[];
};

/** `useRoomState`in oyun dalını taklit eder (yerel seçim yaşam döngüsü dahil). */
function Harness({ view, submitSpy, playAgain, cues = [] }: HarnessProps) {
  const [selection, setSelection] = useState<SceneSelection | null>(null);
  const [rolePanelOpen, setRolePanelOpen] = useState(false);

  const onIntent = useCallback((intent: SceneIntent) => {
    if (intent.type === 'select_option') {
      setSelection({ actionId: intent.actionId, optionId: intent.optionId });
    } else if (intent.type === 'clear_selection') {
      setSelection(null);
    } else if (intent.type === 'inspect_own_role') {
      setRolePanelOpen(intent.open ?? true);
    }
  }, []);

  const room: GameRoom = {
    phase: 'game',
    mode: 'dev',
    connection: 'connected',
    view,
    cues,
    selection,
    busyActionId: null,
    transient: null,
    rolePanelOpen,
    resetEpoch: 0,
    peerViewpoints: [],
    onIntent,
    submitSelected: () => submitSpy?.(selection),
    clearSelection: () => setSelection(null),
    setRolePanelOpen,
    sendViewpoint: () => undefined,
    sendEmote: () => false,
    playAgain: playAgain ?? (() => undefined),
    returnToLobby: () => undefined,
    refresh: () => undefined,
  };

  return <GameScreen room={room} />;
}

const nominationView = getSceneFixture('nomination')!.view;
const gameOverBase = getSceneFixture('game-over-liberal')!.view;
/** Oda sahibi koltuğundan bakıldığında rematch kontrolleri görünür. */
const gameOverView: SceneView = {
  ...gameOverBase,
  localPlayerId: gameOverBase.players.find((p) => p.isHost)!.playerId,
};

describe('GameScreen — tam ekran düzen (A2)', () => {
  it('üst şeritte aşama ve ne yapılması gerektiği yazar', () => {
    render(<Harness view={nominationView} />);
    const strip = screen.getByRole('status');
    expect(strip.textContent).toContain('Aday belirleme');
    expect(strip.textContent).toContain('Sıra sende: şansölye adayını seç');
  });

  it('eski sağ yan panel yok; oyuncu listesi ve geçmiş menüde', () => {
    render(<Harness view={nominationView} />);
    expect(screen.queryByRole('heading', { name: 'Oyuncular' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Tur geçmişi' })).toBeNull();
    expect(document.querySelector('.game__side')).toBeNull();
  });

  it('alt çubuk seçenekleri tuş rozetleriyle listeler', () => {
    render(<Harness view={nominationView} />);
    const bar = screen.getByRole('group', { name: 'Yapılabilecek işlemler' });
    for (const name of ['Deniz', 'Kaan', 'Barış']) {
      expect(bar.textContent).toContain(name);
    }
    const digits = [...bar.querySelectorAll('.actionbar__digit')].map((el) => el.textContent);
    expect(digits).toEqual(['1', '2', '3']);
    // Sabit kısayol rozetleri her zaman görünür.
    const keys = bar.querySelector('.actionbar__keys')?.textContent ?? '';
    for (const key of ['E', 'Enter', 'Backspace', 'V', 'M']) {
      expect(keys).toContain(key);
    }
  });

  it('tıklama seç → onay satırı → gönder yolunu kullanır', () => {
    const submitSpy = vi.fn();
    render(<Harness view={nominationView} submitSpy={submitSpy} />);

    fireEvent.click(screen.getByRole('button', { name: /Deniz/ }));
    expect(screen.getByText(/Gönderilecek: Deniz/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Onayla/ }));
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy).toHaveBeenCalledWith({ actionId: 'act_nominate', optionId: 'nom_p3' });
  });

  it('klavye 1 ile de aynı seçim yapılır', () => {
    render(<Harness view={nominationView} />);
    fireEvent.keyDown(window, { code: 'Digit2' });
    expect(screen.getByText(/Gönderilecek: Kaan/)).toBeTruthy();
  });

  it('menü açılır, oyuncular/masa/geçmiş içerir ve kapanır', () => {
    render(<Harness view={nominationView} />);
    fireEvent.click(screen.getByRole('button', { name: /Menü/ }));

    const dialog = screen.getByRole('dialog', { name: 'Menü' });
    expect(dialog.textContent).toContain('Oyuncular');
    expect(dialog.textContent).toContain('Masa');
    expect(dialog.textContent).toContain('Tur geçmişi');
    expect(screen.getByLabelText('Fare hassasiyeti')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByRole('dialog', { name: 'Menü' })).toBeNull();
  });

  it('M kısayolu menüyü açar, menü açıkken oyun kısayolları kapalıdır', () => {
    render(<Harness view={nominationView} />);
    fireEvent.keyDown(window, { code: 'KeyM' });
    expect(screen.getByRole('dialog', { name: 'Menü' })).toBeTruthy();
    fireEvent.keyDown(window, { code: 'Digit1' });
    expect(screen.queryByText(/Gönderilecek:/)).toBeNull();
  });

  it('H kimlik katmanını açar (sahne ile tek kaynak)', () => {
    render(<Harness view={getSceneFixture('role-reveal-liberal')!.view} />);
    expect(document.querySelector('.game__role-layer')).toBeNull();
    fireEvent.keyDown(window, { code: 'KeyH' });
    expect(document.querySelector('.game__role-layer')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Özel bilgin' })).toBeTruthy();
  });

  it('oyun sonu katmanı sonucu, rolleri ve host kontrollerini gösterir', () => {
    const playAgain = vi.fn();
    render(<Harness view={gameOverView} playAgain={playAgain} />);
    const dialog = screen.getByRole('dialog', { name: 'Oyun bitti' });
    expect(dialog.textContent).toContain('Liberaller kazandı');
    expect(dialog.textContent).toMatch(/Hitler|Faşist|Liberal/);
    fireEvent.click(screen.getByRole('button', { name: 'Aynı oyuncularla yeniden oyna' }));
    expect(playAgain).toHaveBeenCalledTimes(1);
  });

  it('"Oyuna odaklan" düğmesi görünür', () => {
    render(<Harness view={nominationView} />);
    expect(screen.queryByRole('button', { name: 'Oyuna odaklan' })).toBeTruthy();
  });
});

/** Tarayıcı tam ekranını taklit et: `document.fullscreenElement` + olay. */
function enterFullscreen(el: Element | null): void {
  Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true });
  act(() => {
    document.dispatchEvent(new Event('fullscreenchange'));
  });
}

/** Pointer Lock'u taklit et (jsdom API'yi uygulamaz). */
function lockPointer(el: Element | null): void {
  Object.defineProperty(document, 'pointerLockElement', {
    value: el,
    configurable: true,
    writable: true,
  });
  act(() => {
    document.dispatchEvent(new Event('pointerlockchange'));
  });
}

describe('GameScreen — tam ekran deneyimi (D11)', () => {
  afterEach(() => {
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    Object.defineProperty(document, 'pointerLockElement', {
      value: null,
      configurable: true,
      writable: true,
    });
  });

  it('tek sağ üst araç çubuğu: kamera/inceleme + odak + bağlantı + menü', () => {
    render(<Harness view={nominationView} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Görünüm ve menü' });
    for (const name of ['Genel masa', 'Kendi koltuğum', 'Tahta', 'Oyuna odaklan']) {
      expect(toolbar.querySelector('button')).toBeTruthy();
      expect(toolbar.textContent).toContain(name);
    }
    expect(toolbar.textContent).toContain('Menü');
    expect(toolbar.querySelector('.dot')).not.toBeNull();
    // Üst şeritte YALNIZ bu çubuk var; ikinci bir düğme katmanı yok.
    expect(document.querySelectorAll('.game__top .game__tools')).toHaveLength(1);
  });

  it('sahne kendi sağ üst şeridini çizmez (showInspectionNav=false)', () => {
    render(<Harness view={nominationView} />);
    expect((lastSceneProps() as { showInspectionNav?: boolean }).showInspectionNav).toBe(false);
  });

  it('araç çubuğu yüksekliği `--hud-top` ile yayınlanır; rol paneli onu kullanır', () => {
    render(<Harness view={getSceneFixture('role-reveal-liberal')!.view} />);
    const root = document.querySelector('.game') as HTMLElement;
    expect(root.style.getPropertyValue('--hud-top')).toMatch(/px$/);

    fireEvent.keyDown(window, { code: 'KeyH' });
    const layer = document.querySelector('.game__role-layer');
    expect(layer).not.toBeNull();
    // Panel üst şeritten SONRA gelir; sabit piksel ofsetiyle konumlanmaz.
    expect(root.querySelector('.game__top')!.compareDocumentPosition(layer!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('"Tahta" düğmesi koltukta EĞİLMEYİ açar/kapatır (D15)', () => {
    render(<Harness view={nominationView} />);
    type BoardProps = { boardInspection?: string };
    const board = () => screen.getByRole('button', { name: 'Tahta' });
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('off');
    expect(board().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(board());
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('lean');
    expect(board().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(board());
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('off');
    expect(board().getAttribute('aria-pressed')).toBe('false');
  });

  it('genel masada "Tahta" eski tepeden incelemeyi kullanmayı sürdürür (D15)', () => {
    render(<Harness view={nominationView} />);
    type BoardProps = { boardInspection?: string };
    fireEvent.click(screen.getByRole('button', { name: 'Genel masa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tahta' }));
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('fascist');
  });

  it('B kısayolu koltukta eğilmeyi açar, Esc ve B geri döndürür (D15)', () => {
    render(<Harness view={nominationView} />);
    type BoardProps = { boardInspection?: string };
    fireEvent.keyDown(window, { code: 'KeyB' });
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('lean');
    // Eğilmedeyken alt şerit `B` rozetini "Masaya dön" olarak gösterir.
    expect(screen.getAllByText('Masaya dön').length).toBeGreaterThan(0);
    fireEvent.keyDown(window, { code: 'Escape' });
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('off');
    fireEvent.keyDown(window, { code: 'KeyB' });
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('lean');
    fireEvent.keyDown(window, { code: 'KeyB' });
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('off');
  });

  it('genel bakışa geçiş eğilmeyi kapatır; B orada eğmez (D15)', () => {
    render(<Harness view={nominationView} />);
    type BoardProps = { boardInspection?: string };
    fireEvent.keyDown(window, { code: 'KeyB' });
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('lean');
    fireEvent.click(screen.getByRole('button', { name: 'Genel masa' }));
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('off');
    fireEvent.keyDown(window, { code: 'KeyB' });
    expect((lastSceneProps() as BoardProps).boardInspection).toBe('off');
  });

  it('HUD düğmesine fareyle basmak DOM odağını almaz (Enter tam ekranı düşürmez)', () => {
    render(<Harness view={nominationView} />);
    const focusButton = screen.getByRole('button', { name: 'Oyuna odaklan' });
    const notPrevented = fireEvent.mouseDown(focusButton);
    expect(notPrevented).toBe(false); // preventDefault → odak düğmeye geçmez
    expect(document.activeElement).toBe(document.querySelector('.game'));
  });

  it('kilitliyken 3 s hareketsizlikte HUD solar; fare hareketi geri getirir', () => {
    vi.useFakeTimers();
    try {
      render(<Harness view={getSceneFixture('voting-waiting')!.view} />);
      const root = document.querySelector('.game') as HTMLElement;
      lockPointer(root);
      expect(root.dataset.hudIdle).toBe('false');

      act(() => {
        vi.advanceTimersByTime(3100);
      });
      expect(root.dataset.hudIdle).toBe('true');

      act(() => {
        fireEvent.mouseMove(window);
      });
      expect(root.dataset.hudIdle).toBe('false');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sıra sendeyken HUD asla gizlenmez', () => {
    vi.useFakeTimers();
    try {
      render(<Harness view={nominationView} />); // "Sıra sende: şansölye adayını seç"
      const root = document.querySelector('.game') as HTMLElement;
      lockPointer(root);
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(root.dataset.hudIdle).toBe('false');
    } finally {
      vi.useRealTimers();
    }
  });

  it('tam ekran ipucu 4 s sonra kapanır ve bir daha çıkmaz', () => {
    vi.useFakeTimers();
    try {
      render(<Harness view={nominationView} />);
      const root = document.querySelector('.game');
      enterFullscreen(root);
      const hint = document.querySelector('.game__hint');
      expect(hint?.textContent).toContain('Enter');
      expect(hint?.textContent).toContain('menü');

      act(() => {
        vi.advanceTimersByTime(4100);
      });
      expect(document.querySelector('.game__hint')).toBeNull();

      // Tam ekrandan çıkıp yeniden girince ipucu TEKRAR gösterilmez.
      enterFullscreen(null);
      enterFullscreen(root);
      expect(document.querySelector('.game__hint')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('GameScreen — sahne bağlantısı (A3)', () => {
  it('hassasiyet tercihi sahneye iletilir', () => {
    render(<Harness view={nominationView} />);
    expect(lastSceneProps().immersive?.sensitivity).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /Menü/ }));
    fireEvent.change(screen.getByLabelText('Fare hassasiyeti'), { target: { value: '2.5' } });
    expect(lastSceneProps().immersive?.sensitivity).toBeCloseTo(2.5);
  });

  it('masaüstünde varsayılan kamera koltuktur', () => {
    render(<Harness view={nominationView} />);
    expect(lastSceneProps().immersive?.cameraMode).toBe('seat');
  });

  it('sahnenin set_camera niyeti uygulama kamera durumunu değiştirir', () => {
    render(<Harness view={nominationView} />);
    expect(lastSceneProps().immersive?.cameraMode).toBe('seat');

    act(() => {
      lastSceneProps().onIntent({ type: 'set_camera', target: 'overview' });
    });
    expect(lastSceneProps().immersive?.cameraMode).toBe('overview');
  });

  it('V kısayolu aynı kamera yolunu kullanır', () => {
    render(<Harness view={nominationView} />);
    fireEvent.keyDown(window, { code: 'KeyV' });
    expect(lastSceneProps().immersive?.cameraMode).toBe('overview');
    fireEvent.keyDown(window, { code: 'KeyV' });
    expect(lastSceneProps().immersive?.cameraMode).toBe('seat');
  });

  it('menü açık olması sahneyi askıya almaz (CODEX-017/5)', () => {
    render(<Harness view={nominationView} />);
    fireEvent.keyDown(window, { code: 'KeyM' });
    expect(lastSceneProps().immersive?.suspended).toBe(false);
  });
});


describe('GameScreen — seçenek rakamları (D12 tur 3)', () => {
  /** İnfaz hedef listesi 3'ten fazla olabilir; her yuvanın rakamı olmalı. */
  const manyTargets: SceneView = (() => {
    const base = getSceneFixture('executive-action')!.view;
    const action = base.actions[0]!;
    return {
      ...base,
      actions: [
        {
          ...action,
          options: Array.from({ length: 5 }, (_unused, i) => ({
            optionId: `target_${i + 1}`,
            labelKey: 'player.name' as const,
            targetPlayerId: base.players[i + 1]!.playerId,
          })),
        },
      ],
    };
  })();

  it('beş seçenekte beş rakam rozeti çıkar ve ipucu 1–5 der', () => {
    render(<Harness view={manyTargets} />);
    const bar = screen.getByRole('group', { name: 'Yapılabilecek işlemler' });
    const digits = [...bar.querySelectorAll('.actionbar__digit')].map((el) => el.textContent);
    expect(digits).toEqual(['1', '2', '3', '4', '5']);
    expect(bar.querySelector('.actionbar__keys')?.textContent ?? '').toContain('1–5');
  });

  it('4. seçenek rakam tuşuyla seçilir', () => {
    render(<Harness view={manyTargets} />);
    fireEvent.keyDown(window, { code: 'Digit4' });
    const bar = screen.getByRole('group', { name: 'Yapılabilecek işlemler' });
    const pressed = [...bar.querySelectorAll('.actionbar__option')].findIndex(
      (el) => el.getAttribute('aria-pressed') === 'true',
    );
    expect(pressed).toBe(3);
  });
});

describe('GameScreen — vurulan oyuncunun ekranı (D12 §6)', () => {
  const base = getSceneFixture('execution-shot')!;
  /** Yerel oyuncu HEDEFTİR: p7 vuruldu. */
  const victimView: SceneView = { ...base.view, localPlayerId: 'p7' };

  it('hayattayken vinyet yok', () => {
    render(<Harness view={nominationView} />);
    expect(document.querySelector('.shot-layer')).toBeNull();
  });

  it('ateş anında (1300 ms) vinyet ve "VURULDUN" gelir, tıklamayı engellemez', () => {
    vi.useFakeTimers();
    try {
      render(<Harness view={victimView} cues={base.cues} />);
      // Silah kalkarken ekran değişmez.
      expect(document.querySelector('.shot-layer')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1300);
      });
      const layer = document.querySelector('.shot-layer');
      expect(layer).not.toBeNull();
      expect(layer?.textContent).toContain('VURULDUN');
      expect(layer?.textContent).toContain('konuşma ve oy yok');
      expect(layer?.getAttribute('data-fresh')).toBe('true');
      expect(document.querySelector('.shot-layer__vignette')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * D18 madde 2 — E2E bulgu 1: kurbana cue GİTMİYORDU (B4) ve başlık yalnız
   * cue'lu dalda çiziliyordu; ekranda sadece belirsiz bir vinyet kalıyordu.
   * Katman artık görünümden türer: `!alive` iken vinyet + "VURULDUN" durur.
   */
  it('cue yoksa (yeniden bağlanma / atlanan sürüm) vinyet ve başlık ANINDA durur', () => {
    render(<Harness view={victimView} cues={[]} />);
    const layer = document.querySelector('.shot-layer');
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute('data-fresh')).toBe('false');
    expect(layer?.getAttribute('data-shot')).toBe('persistent');
    expect(layer?.textContent).toContain('VURULDUN');
  });

  it('cue kuyruğu boşalınca katman kaybolmaz ve gecikme sıfırlanmaz', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<Harness view={victimView} cues={base.cues} />);
      act(() => {
        vi.advanceTimersByTime(1300);
      });
      expect(document.querySelector('.shot-layer')).not.toBeNull();
      // Kuyruk ~950 ms sonra boşalır (`useRoomState` rutin temizliği).
      rerender(<Harness view={victimView} cues={[]} />);
      const layer = document.querySelector('.shot-layer');
      expect(layer).not.toBeNull();
      expect(layer?.textContent).toContain('VURULDUN');
    } finally {
      vi.useRealTimers();
    }
  });

  it('oyuncu hayattayken katman kalkar (yeni oyun)', () => {
    const { rerender } = render(<Harness view={victimView} cues={[]} />);
    expect(document.querySelector('.shot-layer')).not.toBeNull();
    rerender(<Harness view={nominationView} cues={[]} />);
    expect(document.querySelector('.shot-layer')).toBeNull();
  });
});
