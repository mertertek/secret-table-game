// @vitest-environment jsdom
/**
 * Tek kontrol yöneticisi — FINISH_PLAN §2A davranış testleri.
 *
 * Gerçek `useTableControls` kancası; sahne (WebGL) veya ağ yok. Tuşlar `window`
 * üzerinde gerçek `KeyboardEvent` olarak gönderilir; seçim round-trip'i
 * `GameScreen` kablolamasını taklit eder.
 */
import { useState } from 'react';
import type {
  SceneController,
  SceneIntent,
  SceneSelection,
  SceneTargets,
  SceneView,
} from '@secret-table/contracts';
import { getSceneFixture } from '@secret-table/fixtures';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildHud,
  commandForCode,
  commandForKeyEvent,
  consequenceText,
  optionTargets,
  type FocusTarget,
} from './controlScheme';
import { useTableControls } from './useTableControls';

afterEach(cleanup);

const nominationView = getSceneFixture('nomination')!.view; // requiresConfirmation: true
const votingView = getSceneFixture('voting')!.view; // requiresConfirmation: false
const executiveView = getSceneFixture('executive-action')!.view;

/** Sahne üç yuvayı da sahiplenmiş durum (Pointer Lock / hedefleme açık). */
const ownedSlots: SceneTargets = {
  slots: [
    { actionId: 'act_nominate', optionId: 'nom_p3' },
    { actionId: 'act_nominate', optionId: 'nom_p4' },
    { actionId: 'act_nominate', optionId: 'nom_p6' },
  ],
  hovered: null,
  inspectedIndex: -1,
};

/** D12 tur 3 — `n` hedefli infaz görünümü (rakam ipuçları ve 4+ seçenek için). */
function manyOptionsView(n: number): SceneView {
  const base = executionView();
  const action = base.actions[0]!;
  return {
    ...base,
    actions: [
      {
        ...action,
        options: Array.from({ length: n }, (_unused, i) => ({
          optionId: `target_${i + 1}`,
          labelKey: 'player.name' as const,
          targetPlayerId: `p${i + 1}`,
        })),
      },
    ],
  };
}

function executionView(): SceneView {
  return {
    ...executiveView,
    table: {
      ...executiveView.table,
      currentPower: { power: 'execution', actorId: 'p1', targetId: null },
    },
  };
}

type HarnessProps = {
  view: SceneView;
  lockedAt?: number | null;
  extraTargets?: FocusTarget[];
  controller?: SceneController | null;
  sceneTargets?: SceneTargets | null;
  onIntentSpy?: (i: SceneIntent) => void;
  onSubmitSpy?: (s: SceneSelection) => void;
  onCamera?: () => void;
  onMenu?: () => void;
  rolePanelOpen?: boolean;
  lean?: { available: boolean; active: boolean };
  onLeanBoard?: () => void;
};

function Harness({
  view,
  lockedAt = null,
  extraTargets,
  controller,
  sceneTargets,
  onIntentSpy,
  onSubmitSpy,
  onCamera,
  onMenu,
  rolePanelOpen = false,
  lean,
  onLeanBoard,
}: HarnessProps) {
  const [selection, setSelection] = useState<SceneSelection | null>(null);

  const onIntent = (i: SceneIntent) => {
    onIntentSpy?.(i);
    if (i.type === 'select_option') setSelection({ actionId: i.actionId, optionId: i.optionId });
    else if (i.type === 'clear_selection') setSelection(null);
  };
  const submitSelected = () => {
    if (selection) onSubmitSpy?.(selection);
  };
  const clearSelection = () => setSelection(null);

  const controls = useTableControls({
    enabled: true,
    view,
    selection,
    rolePanelOpen,
    extraTargets,
    controller,
    sceneTargets,
    lockedAt,
    onIntent,
    submitSelected,
    clearSelection,
    onCamera,
    lean,
    onLeanBoard,
    onMenu,
  });

  return (
    <div>
      <span data-testid="stage">{controls.stage}</span>
      <span data-testid="shortcuts">{controls.hud.shortcuts.map((s) => `${s.keys}:${s.label}`).join('|')}</span>
      <span data-testid="hints">{controls.hud.hints.map((s) => `${s.keys}:${s.label}`).join('|')}</span>
      <span data-testid="focus">{controls.hud.focusLabel ?? ''}</span>
      <span data-testid="sel">{selection ? selection.optionId : ''}</span>
      <button data-testid="btn" type="button">
        x
      </button>
      <input data-testid="text" />
    </div>
  );
}

const stage = () => screen.getByTestId('stage').textContent;
const focus = () => screen.getByTestId('focus').textContent;
const sel = () => screen.getByTestId('sel').textContent;

describe('controlScheme (saf)', () => {
  it('fiziksel tuş kodlarını komuta çevirir', () => {
    expect(commandForCode('KeyE')).toBe('activate');
    expect(commandForCode('Digit2')).toBe('option-2');
    // D12 tur 3: rakamlar 9'a kadar (infazda 4+ hedef olabiliyor).
    expect(commandForCode('Digit4')).toBe('option-4');
    expect(commandForCode('Digit9')).toBe('option-9');
    expect(commandForCode('Numpad7')).toBe('option-7');
    expect(commandForCode('Digit0')).toBeNull();
    expect(commandForKeyEvent({ code: '', key: '6' })).toBe('option-6');
    expect(commandForCode('ArrowRight')).toBe('focus-next');
    expect(commandForCode('Backspace')).toBe('cancel');
    expect(commandForCode('KeyZ')).toBeNull();
    // D15: tahtaya eğilme.
    expect(commandForCode('KeyB')).toBe('lean-board');
    expect(commandForCode('Escape')).toBe('exit-lean');
    expect(commandForKeyEvent({ code: '', key: 'B' })).toBe('lean-board');
    expect(commandForKeyEvent({ code: '', key: 'Escape' })).toBe('exit-lean');
    // `code` boşsa (sanal klavye / otomasyon) `key` yedeği; doluysa `key` yok sayılır.
    expect(commandForKeyEvent({ code: '', key: 'M' })).toBe('toggle-menu');
    expect(commandForKeyEvent({ code: '', key: 'ArrowLeft' })).toBe('focus-prev');
    expect(commandForKeyEvent({ code: 'KeyZ', key: 'm' })).toBeNull();
  });

  it('optionTargets görsel (options) sırasını korur', () => {
    const targets = optionTargets(nominationView);
    expect(targets.map((t) => t.kind === 'option' && t.optionId)).toEqual([
      'nom_p3',
      'nom_p4',
      'nom_p6',
    ]);
  });

  it('HUD yalnız yapılabilir tuşları gösterir, olmayan "kart çek" mesajı yok', () => {
    const model = buildHud({
      view: votingView,
      targets: optionTargets(votingView),
      focusIndex: 0,
      stage: 'idle',
      rolePanelOpen: false,
      menuAvailable: true,
    });
    const labels = model.hints.map((h) => h.label).join(' ');
    expect(labels).not.toMatch(/çek/i);
    expect(model.hints.some((h) => h.keys === 'M')).toBe(true);
  });

  it('D12 tur 3 — ipucu tüm seçenek rakamlarını sayar (1–N)', () => {
    const view = manyOptionsView(6);
    const model = buildHud({
      view,
      targets: optionTargets(view),
      focusIndex: 0,
      stage: 'idle',
      rolePanelOpen: false,
      menuAvailable: true,
    });
    expect(model.hints.find((h) => h.label === 'Seç' && h.keys.startsWith('1'))?.keys).toBe('1–6');
    // 9'dan fazla seçenekte rakam 9'da durur, gezinme oklarda kalır.
    const wide = manyOptionsView(11);
    const wideModel = buildHud({
      view: wide,
      targets: optionTargets(wide),
      focusIndex: 0,
      stage: 'idle',
      rolePanelOpen: false,
      menuAvailable: true,
    });
    expect(wideModel.hints.find((h) => h.label === 'Seç' && h.keys.startsWith('1'))?.keys).toBe('1–9');
  });

  it('infazda onay metni hedefin eleneceğini söyler', () => {
    const view = executionView();
    const target = optionTargets(view)[0]!;
    const text = consequenceText(target, view);
    expect(text).toMatch(/elen/i);
    expect(text).toContain('Elif'); // p2
  });
});

describe('useTableControls — tuş akışı', () => {
  it('D12 tur 3 — 4. seçenek de rakamla seçilir', () => {
    const onIntentSpy = vi.fn();
    render(<Harness view={manyOptionsView(5)} onIntentSpy={onIntentSpy} />);

    fireEvent.keyDown(window, { code: 'Digit4' });
    expect(sel()).toBe('target_4');
    expect(stage()).toBe('selected');
    fireEvent.keyDown(window, { code: 'Digit5' });
    expect(sel()).toBe('target_5');
  });

  it('1/2/3 görünür sıradaki seçeneği seçer (optionId eşleşir)', () => {
    const onIntentSpy = vi.fn();
    render(<Harness view={nominationView} onIntentSpy={onIntentSpy} />);

    fireEvent.keyDown(window, { code: 'Digit2' });
    expect(sel()).toBe('nom_p4');
    expect(stage()).toBe('selected');
    expect(onIntentSpy).toHaveBeenLastCalledWith({
      type: 'select_option',
      actionId: 'act_nominate',
      optionId: 'nom_p4',
    });
  });

  it('oklar yalnız odağı değiştirir; seçimi/göndermeyi sessizce değiştirmez', () => {
    const onIntentSpy = vi.fn();
    render(<Harness view={nominationView} onIntentSpy={onIntentSpy} />);

    fireEvent.keyDown(window, { code: 'Digit1' }); // nom_p3 (Deniz)
    expect(focus()).toBe('Deniz');
    fireEvent.keyDown(window, { code: 'ArrowRight' }); // odak → Kaan
    expect(focus()).toBe('Kaan');
    expect(sel()).toBe('nom_p3'); // seçim değişmedi
    const selectCalls = onIntentSpy.mock.calls.filter((c) => c[0].type === 'select_option');
    expect(selectCalls).toHaveLength(1);
    const clearCalls = onIntentSpy.mock.calls.filter((c) => c[0].type === 'clear_selection');
    expect(clearCalls).toHaveLength(0);
  });

  it('Enter iki adımlıdır: aynı fiziksel basış onayı açıp gönderemez', () => {
    const onSubmitSpy = vi.fn();
    render(<Harness view={nominationView} onSubmitSpy={onSubmitSpy} />);

    fireEvent.keyDown(window, { code: 'Digit1' }); // seç
    expect(stage()).toBe('selected');

    fireEvent.keyDown(window, { code: 'Enter' }); // onay adımını AÇ
    expect(stage()).toBe('confirming');
    expect(onSubmitSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: 'Enter', repeat: true }); // key repeat
    expect(onSubmitSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: 'Enter' }); // keyup YOK → hâlâ aynı basış sayılır
    expect(onSubmitSpy).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { code: 'Enter' });
    fireEvent.keyDown(window, { code: 'Enter' }); // ayrı basış → gönder
    expect(onSubmitSpy).toHaveBeenCalledTimes(1);
    expect(stage()).toBe('idle');
  });

  it('onay gerektirmeyen aksiyonda seç + ayrı Enter gönderir', () => {
    const onSubmitSpy = vi.fn();
    render(<Harness view={votingView} onSubmitSpy={onSubmitSpy} />);

    fireEvent.keyDown(window, { code: 'Digit1' }); // vote_yes
    expect(stage()).toBe('selected');
    fireEvent.keyDown(window, { code: 'Enter' }); // gönder (onay adımı yok)
    expect(onSubmitSpy).toHaveBeenCalledTimes(1);
    expect(stage()).toBe('idle');
  });

  it('Backspace gönderilmemiş seçimi iptal eder ve tarayıcı gezinmesini engeller', () => {
    render(<Harness view={nominationView} />);
    fireEvent.keyDown(window, { code: 'Digit1' });
    expect(sel()).toBe('nom_p3');
    const notPrevented = fireEvent.keyDown(window, { code: 'Backspace' });
    expect(notPrevented).toBe(false); // preventDefault çağrıldı
    expect(sel()).toBe('');
    expect(stage()).toBe('idle');
  });

  it('metin kutusuna yazarken oyun kısayolları çalışmaz', () => {
    const onIntentSpy = vi.fn();
    render(<Harness view={nominationView} onIntentSpy={onIntentSpy} />);
    const input = screen.getByTestId('text');
    input.focus();
    fireEvent.keyDown(input, { code: 'KeyH' });
    fireEvent.keyDown(input, { code: 'Digit1' });
    expect(onIntentSpy).not.toHaveBeenCalled();
  });

  it('KLAVYEYLE (Tab) odaklanmış düğmede Enter yöneticide çift hamle üretmez', () => {
    const onSubmitSpy = vi.fn();
    render(<Harness view={votingView} onSubmitSpy={onSubmitSpy} />);
    fireEvent.keyDown(window, { code: 'Digit1' }); // seçili
    const btn = screen.getByTestId('btn');
    fireEvent.keyDown(window, { code: 'Tab', key: 'Tab' }); // klavye gezinmesi
    btn.focus();
    const notPrevented = fireEvent.keyDown(btn, { code: 'Enter' });
    expect(onSubmitSpy).not.toHaveBeenCalled(); // native düğme işi; yönetici atlar
    expect(notPrevented).toBe(true); // preventDefault YOK: düğme kendi işini görür
  });

  /**
   * D11: fareyle tıklanıp odakta kalan düğme Enter'ı YUTMAZ. Aksi hâlde "Oyuna
   * odaklan" düğmesi odakta kalır, Enter onayı onu tıklar ve tam ekran düşer.
   */
  it('FAREYLE odaklanmış düğmede Enter oyun komutudur ve varsayılanı engeller', () => {
    const onSubmitSpy = vi.fn();
    render(<Harness view={votingView} onSubmitSpy={onSubmitSpy} />);
    fireEvent.keyDown(window, { code: 'Digit1' }); // seçili
    const btn = screen.getByTestId('btn');
    fireEvent.mouseDown(btn); // fare etkileşimi: klavye izi silinir
    btn.focus();
    const notPrevented = fireEvent.keyDown(btn, { code: 'Enter' });
    expect(onSubmitSpy).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false); // preventDefault çağrıldı → native tık yok
  });

  it('Pointer Lock az önce açıldıysa seç/gönder yok; H yine çalışır', () => {
    const onIntentSpy = vi.fn();
    render(
      <Harness view={nominationView} lockedAt={performance.now()} onIntentSpy={onIntentSpy} />,
    );
    fireEvent.keyDown(window, { code: 'Digit1' });
    expect(sel()).toBe(''); // grace: seçim yok
    fireEvent.keyDown(window, { code: 'KeyH' });
    expect(onIntentSpy).toHaveBeenCalledWith({ type: 'inspect_own_role', open: true });
  });

  it('grace penceresi geçince seçim çalışır', () => {
    render(<Harness view={nominationView} lockedAt={performance.now() - 5_000} />);
    fireEvent.keyDown(window, { code: 'Digit1' });
    expect(sel()).toBe('nom_p3');
  });

  it('H yön vererek rol panelini açar/kapatır (tek kaynak)', () => {
    const onIntentSpy = vi.fn();
    const { rerender } = render(
      <Harness view={nominationView} rolePanelOpen={false} onIntentSpy={onIntentSpy} />,
    );
    fireEvent.keyDown(window, { code: 'KeyH' });
    expect(onIntentSpy).toHaveBeenLastCalledWith({ type: 'inspect_own_role', open: true });
    rerender(<Harness view={nominationView} rolePanelOpen onIntentSpy={onIntentSpy} />);
    fireEvent.keyDown(window, { code: 'KeyH' });
    expect(onIntentSpy).toHaveBeenLastCalledWith({ type: 'inspect_own_role', open: false });
  });

  it('V ve M enjekte edilen geri çağrıları tetikler', () => {
    const onCamera = vi.fn();
    const onMenu = vi.fn();
    render(<Harness view={nominationView} onCamera={onCamera} onMenu={onMenu} />);
    fireEvent.keyDown(window, { code: 'KeyV' });
    fireEvent.keyDown(window, { code: 'KeyM' });
    expect(onCamera).toHaveBeenCalledTimes(1);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('sahne yuvayı sahipleniyorsa seçim kimliği selectSlot() tan gelir', () => {
    const onIntentSpy = vi.fn();
    const selectSlot = vi.fn((_i: number) => ({ actionId: 'act_nominate', optionId: 'nom_p6' }));
    const inspectBy = vi.fn();
    const controller: SceneController = {
      lookBy: vi.fn(),
      inspectBy,
      selectSlot,
      target: () => null,
      resetLook: vi.fn(),
    };
    render(
      <Harness
        view={nominationView}
        controller={controller}
        sceneTargets={ownedSlots}
        onIntentSpy={onIntentSpy}
      />,
    );

    fireEvent.keyDown(window, { code: 'Digit1' }); // yuva 0 → scene nom_p6 der
    expect(selectSlot).toHaveBeenCalledWith(0);
    expect(onIntentSpy).toHaveBeenLastCalledWith({
      type: 'select_option',
      actionId: 'act_nominate',
      optionId: 'nom_p6',
    });

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    expect(inspectBy).toHaveBeenCalledWith(1);
    fireEvent.keyDown(window, { code: 'ArrowLeft' });
    expect(inspectBy).toHaveBeenCalledWith(-1);
  });

  // CODEX-017/1 — sahnenin SAHİPLENDİĞİ yuvada null = EYLEM YOK (panele düşme yok).
  it('sahne yuvayı sahiplenmişken selectSlot() null dönünce hiçbir eylem olmaz', () => {
    const onIntentSpy = vi.fn();
    const controller: SceneController = {
      lookBy: vi.fn(),
      inspectBy: vi.fn(),
      selectSlot: () => null,
      target: () => null,
      resetLook: vi.fn(),
    };
    render(
      <Harness
        view={nominationView}
        controller={controller}
        sceneTargets={ownedSlots}
        onIntentSpy={onIntentSpy}
      />,
    );
    fireEvent.keyDown(window, { code: 'Digit2' });
    expect(onIntentSpy).not.toHaveBeenCalled();
    expect(sel()).toBe('');
    expect(stage()).toBe('idle');
  });

  it('controller hiç yoksa view.actions yedeği kullanılır', () => {
    const onIntentSpy = vi.fn();
    render(<Harness view={nominationView} controller={null} onIntentSpy={onIntentSpy} />);
    fireEvent.keyDown(window, { code: 'Digit2' });
    expect(onIntentSpy).toHaveBeenLastCalledWith({
      type: 'select_option',
      actionId: 'act_nominate',
      optionId: 'nom_p4',
    });
  });

  /**
   * Sahne hedefleme kapalıyken (Pointer Lock yok / telefon / genel masa) sahne
   * hiçbir yuvayı çözemez ve `slots` tamamen boş gelir. Bu durumda uygulamanın
   * yetkili `view.actions` sırası kullanılır; aksi hâlde fare/dokunmatik oyun
   * tümüyle kilitlenirdi.
   */
  it('sahne hiç yuva sahiplenmiyorsa controller varken bile view.actions kullanılır', () => {
    const onIntentSpy = vi.fn();
    const selectSlot = vi.fn(() => null);
    const controller: SceneController = {
      lookBy: vi.fn(),
      inspectBy: vi.fn(),
      selectSlot,
      target: () => null,
      resetLook: vi.fn(),
    };
    render(
      <Harness
        view={nominationView}
        controller={controller}
        sceneTargets={{ slots: [null, null, null], hovered: null, inspectedIndex: -1 }}
        onIntentSpy={onIntentSpy}
      />,
    );
    fireEvent.keyDown(window, { code: 'Digit2' });
    expect(selectSlot).not.toHaveBeenCalled();
    expect(onIntentSpy).toHaveBeenLastCalledWith({
      type: 'select_option',
      actionId: 'act_nominate',
      optionId: 'nom_p4',
    });
  });

  // CODEX-017/1 — 1/2/3 sahnenin opak yuva sırasını izler; boş yuva numarayı kaydırmaz.
  it('sahne yuva sırası numaraları belirler; boş yuva atlanmaz', () => {
    const onIntentSpy = vi.fn();
    const selectSlot = vi.fn((index: number) =>
      index === 2 ? { actionId: 'act_nominate', optionId: 'nom_p6' } : null,
    );
    const controller: SceneController = {
      lookBy: vi.fn(),
      inspectBy: vi.fn(),
      selectSlot,
      target: () => null,
      resetLook: vi.fn(),
    };
    const sceneTargets: SceneTargets = {
      // 2. yuva sahnede çizilmiyor → `2` tuşu boş kalır, `3` hâlâ 3. yuvadır.
      slots: [
        { actionId: 'act_nominate', optionId: 'nom_p3' },
        null,
        { actionId: 'act_nominate', optionId: 'nom_p6' },
      ],
      hovered: null,
      inspectedIndex: -1,
    };
    render(
      <Harness
        view={nominationView}
        controller={controller}
        sceneTargets={sceneTargets}
        onIntentSpy={onIntentSpy}
      />,
    );

    fireEvent.keyDown(window, { code: 'Digit2' }); // boş yuva
    expect(onIntentSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: 'Digit3' });
    expect(selectSlot).toHaveBeenLastCalledWith(2);
    expect(sel()).toBe('nom_p6');
  });

  // CODEX-017/2 — kilitliyken E / sol tık nişangâhın hedefini kullanır.
  it('Pointer Lock etkinken E controller.target() hedefini seçer', () => {
    const onIntentSpy = vi.fn();
    const target = vi.fn(() => ({ actionId: 'act_nominate', optionId: 'nom_p4' }));
    const selectSlot = vi.fn(() => null);
    const controller: SceneController = {
      lookBy: vi.fn(),
      inspectBy: vi.fn(),
      selectSlot,
      target,
      resetLook: vi.fn(),
    };
    render(
      <Harness
        view={nominationView}
        controller={controller}
        lockedAt={performance.now() - 5_000}
        onIntentSpy={onIntentSpy}
      />,
    );

    fireEvent.keyDown(window, { code: 'KeyE' });
    expect(target).toHaveBeenCalled();
    expect(selectSlot).not.toHaveBeenCalled();
    expect(sel()).toBe('nom_p4');
    expect(stage()).toBe('selected');
  });

  it('kilitli sol tık E ile aynı yoldan gider', () => {
    const target = vi.fn(() => ({ actionId: 'act_nominate', optionId: 'nom_p6' }));
    const controller: SceneController = {
      lookBy: vi.fn(),
      inspectBy: vi.fn(),
      selectSlot: () => null,
      target,
      resetLook: vi.fn(),
    };
    render(
      <Harness
        view={nominationView}
        controller={controller}
        lockedAt={performance.now() - 5_000}
      />,
    );

    fireEvent.mouseDown(document.body, { button: 0 });
    expect(target).toHaveBeenCalled();
    expect(sel()).toBe('nom_p6');
  });

  it('kilitliyken target() null ise hiçbir şey olmaz (panel odağına düşülmez)', () => {
    const onIntentSpy = vi.fn();
    const controller: SceneController = {
      lookBy: vi.fn(),
      inspectBy: vi.fn(),
      selectSlot: vi.fn(() => ({ actionId: 'act_nominate', optionId: 'nom_p3' })),
      target: () => null,
      resetLook: vi.fn(),
    };
    render(
      <Harness
        view={nominationView}
        controller={controller}
        lockedAt={performance.now() - 5_000}
        onIntentSpy={onIntentSpy}
      />,
    );

    fireEvent.keyDown(window, { code: 'KeyE' });
    fireEvent.mouseDown(document.body, { button: 0 });
    expect(onIntentSpy).not.toHaveBeenCalled();
    expect(sel()).toBe('');
    expect(stage()).toBe('idle');
  });

  it('kilit yokken E odaklı hedefi seçer (mevcut davranış)', () => {
    const target = vi.fn(() => null);
    const controller: SceneController = {
      lookBy: vi.fn(),
      inspectBy: vi.fn(),
      selectSlot: (index: number) =>
        index === 0 ? { actionId: 'act_nominate', optionId: 'nom_p3' } : null,
      target,
      resetLook: vi.fn(),
    };
    render(<Harness view={nominationView} controller={controller} sceneTargets={ownedSlots} />);
    fireEvent.keyDown(window, { code: 'KeyE' });
    expect(target).not.toHaveBeenCalled();
    expect(sel()).toBe('nom_p3');
  });

  it('oyun sonu komut hedefleri Enter / oklarla yürür (yeni draw komutu yok)', () => {
    const playAgain = vi.fn();
    const returnLobby = vi.fn();
    const gameOver = getSceneFixture('game-over-liberal')!.view;
    const extraTargets: FocusTarget[] = [
      {
        kind: 'command',
        id: 'play_again',
        label: 'Aynı oyuncularla yeniden oyna',
        requiresConfirmation: false,
        run: playAgain,
      },
      {
        kind: 'command',
        id: 'return_lobby',
        label: 'Lobiye dön',
        requiresConfirmation: false,
        run: returnLobby,
      },
    ];
    render(<Harness view={gameOver} extraTargets={extraTargets} />);

    fireEvent.keyDown(window, { code: 'Enter' }); // odak[0] → play_again
    expect(playAgain).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'Enter' }); // odak[1] → return_lobby
    expect(returnLobby).toHaveBeenCalledTimes(1);
  });
});

describe('tahtaya eğilme kısayolu (D15)', () => {
  const shortcuts = () => screen.getByTestId('shortcuts').textContent ?? '';
  const hints = () => screen.getByTestId('hints').textContent ?? '';

  it('B koltukta eğilmeyi çağırır, genel bakışta çağırmaz', () => {
    const onLeanBoard = vi.fn();
    const { unmount } = render(
      <Harness view={nominationView} lean={{ available: true, active: false }} onLeanBoard={onLeanBoard} />,
    );
    fireEvent.keyDown(window, { code: 'KeyB' });
    expect(onLeanBoard).toHaveBeenCalledTimes(1);
    unmount();

    render(
      <Harness view={nominationView} lean={{ available: false, active: false }} onLeanBoard={onLeanBoard} />,
    );
    fireEvent.keyDown(window, { code: 'KeyB' });
    expect(onLeanBoard).toHaveBeenCalledTimes(1); // genel bakışta B eğmez
  });

  it('Escape YALNIZ eğilmedeyken geri döndürür; varsayılanı engellemez', () => {
    const onLeanBoard = vi.fn();
    const { unmount } = render(
      <Harness view={nominationView} lean={{ available: true, active: false }} onLeanBoard={onLeanBoard} />,
    );
    const idle = fireEvent.keyDown(window, { code: 'Escape' });
    expect(onLeanBoard).not.toHaveBeenCalled();
    expect(idle).toBe(true); // preventDefault yok → tam ekran/kilit çıkışı korunur
    unmount();

    render(
      <Harness view={nominationView} lean={{ available: true, active: true }} onLeanBoard={onLeanBoard} />,
    );
    const leaning = fireEvent.keyDown(window, { code: 'Escape' });
    expect(onLeanBoard).toHaveBeenCalledTimes(1);
    expect(leaning).toBe(true);
  });

  it('HUD şeridinde `B Tahta` var; eğilmede "Masaya dön" ve eller gizli ipucu', () => {
    const { unmount } = render(
      <Harness view={nominationView} lean={{ available: true, active: false }} onLeanBoard={vi.fn()} />,
    );
    expect(shortcuts()).toContain('B:Tahta');
    expect(hints()).toContain('B:Tahtaya eğil');
    expect(hints()).not.toContain('eller gizli');
    unmount();

    render(<Harness view={nominationView} lean={{ available: true, active: true }} onLeanBoard={vi.fn()} />);
    expect(shortcuts()).toContain('B:Masaya dön');
    expect(shortcuts()).toContain('Seç · eller gizli'); // görünen şerit de söyler
    expect(hints()).toContain('B / Esc:Masaya dön');
    expect(hints()).toContain('eller gizli');
  });

  it('eğilme yokken B/Esc rozetleri hiç görünmez', () => {
    render(<Harness view={nominationView} />);
    expect(shortcuts()).not.toContain('B:');
    expect(hints()).not.toContain('B:');
  });

  it('eğilmedeyken kart seçimi HUD yolundan çalışır', () => {
    const onSubmitSpy = vi.fn();
    render(
      <Harness
        view={votingView}
        lean={{ available: true, active: true }}
        onLeanBoard={vi.fn()}
        onSubmitSpy={onSubmitSpy}
      />,
    );
    fireEvent.keyDown(window, { code: 'Digit1' });
    expect(stage()).toBe('selected');
    fireEvent.keyDown(window, { code: 'Enter' });
    expect(onSubmitSpy).toHaveBeenCalledTimes(1);
  });
});
