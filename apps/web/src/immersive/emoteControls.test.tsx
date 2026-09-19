// @vitest-environment jsdom
/**
 * D16 — jest çarkı: saf geometri + gerçek kanca davranışı.
 *
 * Kullanıcı kararı (2026-09-12): alt şeritte çip sırası yok; `G` ile açılan
 * dairesel menü. Testler çark açma/kapama, fare deltasıyla dilim seçimi,
 * basılı tutup bırakma ve açıkken rakamların SEÇENEKLERE gitmemesini ölçer.
 */
import { useState } from 'react';
import type { EmoteKind, SceneIntent, SceneSelection, SceneView } from '@secret-table/contracts';
import { EMOTE_KINDS, EMOTE_LABEL, EMOTE_SYMBOL } from '@secret-table/contracts';
import { getSceneFixture } from '@secret-table/fixtures';
import { cleanup, act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EMOTE_DEADZONE,
  EMOTE_HOLD_MS,
  EMOTE_SLOTS,
  clampPointer,
  emoteForSlot,
  holdSelects,
  sliceAt,
  sliceVector,
  stepSlice,
  wheelSize,
} from './emoteWheel';
import { emoteSlot, emoteStepFor, commandForCode, buildHud, optionTargets } from './controlScheme';
import { useEmoteWheel } from './useEmoteWheel';
import { useTableControls } from './useTableControls';
import { EmoteWheel } from '../ui/EmoteWheel';

afterEach(cleanup);

const nominationView = getSceneFixture('nomination')!.view;

describe('jest çarkı geometrisi (saf)', () => {
  it('8 dilim tasarım sırasındadır ve yuvadan jeste çevrilir', () => {
    expect(EMOTE_SLOTS).toBe(8);
    expect(emoteForSlot(0)).toBe('point');
    expect(emoteForSlot(7)).toBe('facepalm');
    expect(emoteForSlot(8)).toBeNull();
    expect(emoteForSlot(-1)).toBeNull();
    for (const kind of EMOTE_KINDS) {
      expect(EMOTE_SYMBOL[kind].length).toBeGreaterThan(0);
      expect(EMOTE_LABEL[kind].length).toBeGreaterThan(0);
    }
  });

  it('işaretçi vektörü dilime çevrilir; ölü bölgede vurgu değişmez', () => {
    expect(sliceAt(0, -100)).toBe(0); // yukarı
    expect(sliceAt(100, 0)).toBe(2); // sağ
    expect(sliceAt(0, 100)).toBe(4); // aşağı
    expect(sliceAt(-100, 0)).toBe(6); // sol
    expect(sliceAt(0, 0)).toBeNull();
    expect(sliceAt(EMOTE_DEADZONE - 2, 0)).toBeNull();
    expect(sliceAt(NaN, 5)).toBeNull();
    // Dilim merkezleri kendi sırasını geri verir.
    for (let i = 0; i < EMOTE_SLOTS; i++) {
      const v = sliceVector(i);
      expect(sliceAt(v.x * 90, v.y * 90)).toBe(i);
    }
  });

  it('ok tuşu dilim gezer, basılı tutma eşiği 250 ms, çark 260 px altına inmez', () => {
    expect(stepSlice(null, 1)).toBe(0);
    expect(stepSlice(null, -1)).toBe(7);
    expect(stepSlice(7, 1)).toBe(0);
    expect(stepSlice(0, -1)).toBe(7);
    expect(holdSelects(1000, 1000 + EMOTE_HOLD_MS)).toBe(true);
    expect(holdSelects(1000, 1240)).toBe(false);
    expect(wheelSize(390, 844)).toBeGreaterThanOrEqual(260);
    expect(wheelSize(320, 480)).toBe(260);
    expect(wheelSize(2560, 1440)).toBeLessThanOrEqual(420);
    expect(clampPointer(400, 0).x).toBeLessThanOrEqual(130);
  });

  it('`G` komutu bağlanır, WASD YALNIZ çark açıkken gezinir', () => {
    expect(commandForCode('KeyG')).toBe('toggle-emotes');
    expect(commandForCode('KeyW')).toBeNull();
    expect(emoteStepFor({ code: 'KeyW', key: 'w' })).toBe(-1);
    expect(emoteStepFor({ code: 'KeyD', key: 'd' })).toBe(1);
    expect(emoteStepFor({ code: 'KeyQ', key: 'q' })).toBeNull();
    expect(emoteSlot('option-8')).toBe(7);
    expect(emoteSlot('option-9')).toBeNull();
    expect(emoteSlot('activate')).toBeNull();
  });

  it('HUD kısayol şeridinde `G Jest` durur', () => {
    const hud = buildHud({
      view: nominationView,
      targets: optionTargets(nominationView),
      focusIndex: 0,
      stage: 'idle',
      rolePanelOpen: false,
      menuAvailable: true,
      emotes: true,
    });
    expect(hud.shortcuts.some((s) => s.keys === 'G' && s.label === 'Jest')).toBe(true);
    const without = buildHud({
      view: nominationView,
      targets: optionTargets(nominationView),
      focusIndex: 0,
      stage: 'idle',
      rolePanelOpen: false,
      menuAvailable: true,
    });
    expect(without.shortcuts.some((s) => s.keys === 'G')).toBe(false);
  });
});

// --- Kanca davranışı ---------------------------------------------------------

function Harness({ view = nominationView, locked = false, onEmote, blocked = false, phaseKey, ui = false }: {
  view?: SceneView; locked?: boolean; onEmote: (kind: EmoteKind) => void; blocked?: boolean;
  /** D18 madde 5 — değişince çark kapanır. */
  phaseKey?: string;
  /** Gerçek `EmoteWheel` bileşenini de çiz (zemin dokunuşu / "Geri" testleri). */
  ui?: boolean;
}) {
  const [selection, setSelection] = useState<SceneSelection | null>(null);
  const onIntent = (i: SceneIntent) => {
    if (i.type === 'select_option') setSelection({ actionId: i.actionId, optionId: i.optionId });
  };
  const wheel = useEmoteWheel({ onEmote, locked, enabled: !blocked, phaseKey });
  const controls = useTableControls({
    enabled: true,
    view,
    selection,
    rolePanelOpen: false,
    lockedAt: locked ? 0 : null,
    onIntent,
    submitSelected: () => {},
    clearSelection: () => setSelection(null),
    emotes: {
      open: wheel.open,
      available: !blocked,
      press: wheel.press,
      release: wheel.release,
      close: wheel.close,
      step: wheel.step,
      commit: wheel.commit,
      pick: wheel.pick,
    },
  });
  return (
    <div>
      <span data-testid="open">{wheel.open ? 'open' : 'closed'}</span>
      <span data-testid="index">{wheel.index === null ? '' : String(wheel.index)}</span>
      <span data-testid="sel">{selection?.optionId ?? ''}</span>
      <span data-testid="stage">{controls.stage}</span>
      {ui ? <EmoteWheel wheel={wheel} /> : null}
    </div>
  );
}

const open = () => screen.getByTestId('open').textContent;
const index = () => screen.getByTestId('index').textContent;
const sel = () => screen.getByTestId('sel').textContent;

/** jsdom `movementX/Y`yi olay başlatıcıdan almaz; Pointer Lock deltası böyle taklit edilir. */
const move = (dx: number, dy: number) =>
  act(() => {
    const event = new MouseEvent('mousemove', { bubbles: true });
    Object.defineProperty(event, 'movementX', { value: dx });
    Object.defineProperty(event, 'movementY', { value: dy });
    document.dispatchEvent(event);
  });

const key = (code: string, type: 'down' | 'up' = 'down') =>
  act(() => {
    const init = { code, key: code.replace('Key', '').replace('Digit', '').toLowerCase(), bubbles: true };
    if (type === 'down') fireEvent.keyDown(window, init);
    else fireEvent.keyUp(window, init);
  });

describe('jest çarkı kancası', () => {
  it('`G` açar, ikinci `G` kapatır; `Esc` de kapatır', () => {
    render(<Harness onEmote={vi.fn()} />);
    expect(open()).toBe('closed');
    key('KeyG'); key('KeyG', 'up');
    expect(open()).toBe('open');
    key('KeyG'); key('KeyG', 'up');
    expect(open()).toBe('closed');
    key('KeyG'); key('KeyG', 'up');
    key('Escape');
    expect(open()).toBe('closed');
  });

  it('ok tuşu / WASD dilim gezer, Enter seçer', () => {
    const onEmote = vi.fn();
    render(<Harness onEmote={onEmote} />);
    key('KeyG'); key('KeyG', 'up');
    key('ArrowRight');
    expect(index()).toBe('0');
    key('KeyD');
    expect(index()).toBe('1');
    key('ArrowLeft');
    expect(index()).toBe('0');
    key('Enter');
    expect(onEmote).toHaveBeenCalledWith('point');
    expect(open()).toBe('closed');
  });

  it('çark AÇIKKEN rakamlar jeste gider, seçeneklere gitmez', () => {
    const onEmote = vi.fn();
    render(<Harness onEmote={onEmote} />);
    key('KeyG'); key('KeyG', 'up');
    key('Digit3');
    expect(onEmote).toHaveBeenCalledWith('thumbs_up');
    expect(sel()).toBe('');
    expect(open()).toBe('closed');
    // Kapalıyken aynı rakam yine seçeneği seçer (çakışma yok).
    key('Digit1');
    expect(sel()).not.toBe('');
    expect(onEmote).toHaveBeenCalledTimes(1);
  });

  it('fare deltası dilimi vurgular (Pointer Lock kilidi bırakılmaz)', () => {
    const onEmote = vi.fn();
    render(<Harness onEmote={onEmote} locked />);
    key('KeyG'); key('KeyG', 'up');
    move(0, -90);
    expect(index()).toBe('0');
    move(180, 90);
    expect(index()).toBe('2');
    // Sol tık vurgulu dilimi seçer.
    act(() => { fireEvent.mouseDown(document, { button: 0 }); });
    expect(onEmote).toHaveBeenCalledWith('thumbs_up');
    expect(open()).toBe('closed');
  });

  it('basılı tutup bırakmak vurgulu dilimi seçer; kısa basış açık bırakır', () => {
    const onEmote = vi.fn();
    const now = vi.spyOn(performance, 'now');
    let t = 1000;
    now.mockImplementation(() => t);
    render(<Harness onEmote={onEmote} />);
    key('KeyG');
    key('ArrowRight'); // vurgu 0
    t = 1000 + EMOTE_HOLD_MS + 10;
    key('KeyG', 'up');
    expect(onEmote).toHaveBeenCalledWith('point');
    expect(open()).toBe('closed');
    // Kısa basış: menü açık kalır, seçim yok.
    t = 5000;
    key('KeyG');
    t = 5100;
    key('KeyG', 'up');
    expect(open()).toBe('open');
    expect(onEmote).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });

  it('jest kullanılamıyorken `G` çarkı açmaz', () => {
    render(<Harness onEmote={vi.fn()} blocked />);
    key('KeyG'); key('KeyG', 'up');
    expect(open()).toBe('closed');
  });
});

/**
 * D18 madde 5 — telefonda çarkın KAPANMA yolları (E2E bulgu 5: dilim
 * seçilmezse çark ekranın ortasında kalıyordu, faz değişse bile).
 */
describe('jest çarkı — kapanma yolları (D18)', () => {
  const openWheel = () => {
    key('KeyG');
    key('KeyG', 'up');
    expect(open()).toBe('open');
  };

  it('zemine DOKUNMA (pointerdown) çarkı kapatır', () => {
    render(<Harness onEmote={vi.fn()} ui />);
    openWheel();
    const backdrop = document.querySelector('.emote-wheel') as HTMLElement;
    act(() => {
      fireEvent.pointerDown(backdrop);
    });
    expect(open()).toBe('closed');
  });

  it('çark İÇİNE dokunmak (dial) kapatmaz', () => {
    render(<Harness onEmote={vi.fn()} ui />);
    openWheel();
    const dial = document.querySelector('.emote-wheel__dial') as HTMLElement;
    act(() => {
      fireEvent.pointerDown(dial);
    });
    expect(open()).toBe('open');
  });

  it('"Geri" düğmesi çarkı kapatır ve jest GÖNDERMEZ', () => {
    const onEmote = vi.fn();
    render(<Harness onEmote={onEmote} ui />);
    openWheel();
    act(() => {
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Geri' }));
    });
    expect(open()).toBe('closed');
    expect(onEmote).not.toHaveBeenCalled();
  });

  it('faz değişince çark kapanır', () => {
    const onEmote = vi.fn();
    const { rerender } = render(<Harness onEmote={onEmote} phaseKey="g1:4" ui />);
    openWheel();
    rerender(<Harness onEmote={onEmote} phaseKey="g1:5" ui />);
    expect(open()).toBe('closed');
    expect(onEmote).not.toHaveBeenCalled();
  });

  it('aynı faz kimliği yeniden render edilse çark açık kalır', () => {
    const onEmote = vi.fn();
    const { rerender } = render(<Harness onEmote={onEmote} phaseKey="g1:4" ui />);
    openWheel();
    rerender(<Harness onEmote={onEmote} phaseKey="g1:4" ui />);
    expect(open()).toBe('open');
  });
});

/**
 * D21/G — çarkın kapanma yolları sağlamlaştırıldı.
 *
 *  - Zemin ve "Geri" düğmesi `pointerdown` YANINDA `click` de dinler (Pointer
 *    Events vermeyen / sentetik tıklama üreten yollar: eski WebView, yardımcı
 *    teknoloji, klavyeyle düğme etkinleştirme). Aynı jestin iki olayı çarkı iki
 *    kez işlemez.
 *  - `Escape` artık `useEmoteWheel`in KENDİ dinleyicisiyle de kapatır; oyun
 *    kısayolları devre dışıyken (menü, başka ekran) kaçış yolu kalmıyordu.
 */
describe('jest çarkı — kapanma yolları (D21/G)', () => {
  const openWheel = () => {
    key('KeyG');
    key('KeyG', 'up');
    expect(open()).toBe('open');
  };

  it('zemine TIKLAMA (click) çarkı kapatır', () => {
    render(<Harness onEmote={vi.fn()} ui />);
    openWheel();
    const backdrop = document.querySelector('.emote-wheel') as HTMLElement;
    act(() => {
      fireEvent.click(backdrop);
    });
    expect(open()).toBe('closed');
  });

  it('"Geri" düğmesi TIKLAMA ile de kapatır ve jest göndermez', () => {
    const onEmote = vi.fn();
    render(<Harness onEmote={onEmote} ui />);
    openWheel();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Geri' }));
    });
    expect(open()).toBe('closed');
    expect(onEmote).not.toHaveBeenCalled();
  });

  it('aynı jestin pointerdown + click ikilisi çarkı yeniden açmaz/jest göndermez', () => {
    const onEmote = vi.fn();
    render(<Harness onEmote={onEmote} ui />);
    openWheel();
    const back = screen.getByRole('button', { name: 'Geri' });
    act(() => {
      fireEvent.pointerDown(back);
      fireEvent.click(back);
    });
    expect(open()).toBe('closed');
    expect(onEmote).not.toHaveBeenCalled();
  });

  it('oyun kısayolları BAĞLI DEĞİLKEN de Escape çarkı kapatır', () => {
    function Bare() {
      const wheel = useEmoteWheel({ onEmote: () => undefined, locked: false, enabled: true });
      return (
        <div>
          <span data-testid="open">{wheel.open ? 'open' : 'closed'}</span>
          <button type="button" onClick={wheel.toggle}>
            Jest
          </button>
        </div>
      );
    }
    render(<Bare />);
    act(() => {
      screen.getByRole('button', { name: 'Jest' }).click();
    });
    expect(open()).toBe('open');
    key('Escape');
    expect(open()).toBe('closed');
  });
});
