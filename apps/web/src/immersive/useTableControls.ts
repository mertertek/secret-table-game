/**
 * Tek uygulama kontrol yöneticisi — FINISH_PLAN §2A, CODEX-017.
 *
 * TEK `window` keydown dinleyicisi (+ Pointer Lock etkinken tek `mousedown`
 * dinleyicisi). Sahne kendi ikinci global dinleyicisini kurmaz; sahnedeki
 * hedef/gezinme girdileri opak `actionId/optionId` olarak uygulamaya gelir ve
 * buradan aynı `select_option` → `submitSelected` yoluna girer. Yeni "draw"
 * komutu icat edilmez.
 *
 * Fare/dokunma (alt eylem çubuğu) da aynı yolu kullanır: `activateAt` →
 * `submit` → `cancel`.
 *
 * Korumalar: metin yazarken kısayol yok; `event.repeat` / basılı tutma / aynı
 * fiziksel Enter hem onay açıp hem gönderemez; Pointer Lock'u açan ilk girişten
 * sonra kısa süre seç/gönder yok; tek olay hem app hem native düğme tarafından
 * işlenmez.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SceneController,
  SceneIntent,
  SceneSelection,
  SceneTargets,
  SceneView,
} from '@secret-table/contracts';

import {
  buildHud,
  buildTargets,
  commandForKeyEvent,
  emoteSlot,
  emoteStepFor,
  optionSlot,
  shouldPreventDefault,
  type ControlHudModel,
  type ControlStage,
  type FocusTarget,
  type LeanState,
} from './controlScheme';

/** Pointer Lock'u açan tıklama/tuştan sonra bu süre seç/gönder yok sayılır (ms). */
const LOCK_GRACE_MS = 300;

export type TableControlsInput = {
  /** Yalnız oyun ekranında, menü kapalıyken ve odak bir kontrolde değilken. */
  enabled: boolean;
  view: SceneView;
  selection: SceneSelection | null;
  rolePanelOpen: boolean;
  /** Aksiyon dışı hedefler (oyun sonu: yeniden oyna / lobiye dön). Memoize edin. */
  extraTargets?: readonly FocusTarget[];
  /**
   * Sahnenin kaydettiği denetleyici (CODEX-014/015/017). Verilirse E / 1–3 /
   * oklar bu arayüzden yürür (`selectSlot` yalnız `SceneSelection` döndürür,
   * göndermez; gönderim yine uygulama `onIntent`/`submitSelected` yolundadır).
   * Sahnenin çizdiği bir yuvada `selectSlot` null dönerse EYLEM YOKTUR — panel
   * seçeneğine düşülmez (CODEX-017/1).
   */
  controller?: SceneController | null;
  /** Sahnenin bildirdiği ekran yuva sırası; 1/2/3, HUD ve alt çubuk bunu kullanır. */
  sceneTargets?: SceneTargets | null;
  /** Pointer Lock'un en son etkinleştiği zaman (`performance.now()`), yoksa null. */
  lockedAt: number | null;
  onIntent: (intent: SceneIntent) => void;
  submitSelected: () => void;
  clearSelection: () => void;
  /** `V` — genel/koltuk kamerası geçişi. */
  onCamera?: () => void;
  /**
   * D15 — tahtaya eğilme. `available` yalnız koltuk kamerasında doğrudur; `B`
   * eğilmeyi açar/kapatır, `Esc` yalnız eğilmedeyken geri döner (başka hiçbir
   * durumda Escape yutulmaz: tam ekran/kilit çıkışı korunur).
   */
  lean?: LeanState;
  onLeanBoard?: () => void;
  /** `M` — menü / tuş yardımını açar (Pointer Lock'u bırakır). */
  onMenu?: () => void;
  /**
   * D16 — jest çarkı. Açıkken seçenek çubuğu ve diğer sahne kısayolları devre
   * dışıdır: rakamlar jeste gider, oklar/WASD dilim gezer, Enter/sol tık seçer,
   * `Esc`/`G` kapatır. Pointer Lock BIRAKILMAZ (fare deltası çarkı yönetir).
   */
  emotes?: {
    open: boolean;
    available: boolean;
    press: () => void;
    release: () => void;
    close: () => void;
    step: (dir: -1 | 1) => void;
    commit: () => void;
    pick: (slot: number) => void;
  };
};

export type TableControls = {
  hud: ControlHudModel;
  /** Ekran yuva sırası; boş yuva `null` kalır (numara kaymaz). */
  targets: readonly (FocusTarget | null)[];
  focusIndex: number;
  stage: ControlStage;
  /** Fare/dokunma: yuvayı seç (klavye 1/2/3 ile aynı yol). */
  activateAt: (index: number) => void;
  /** Fare/dokunma: seçili hedefi gönder (Enter ile aynı yol). */
  submit: () => void;
  /** Fare/dokunma: gönderilmemiş seçimi bırak (Backspace ile aynı yol). */
  cancel: () => void;
  /** Yalnız odağı taşı (ok tuşlarıyla aynı yol). */
  focusAt: (index: number) => void;
};

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return t.isContentEditable;
}

function isClickableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.tagName === 'BUTTON' || t.tagName === 'A') return true;
  return t.getAttribute('role') === 'button';
}

/**
 * Son gezinme klavyeyle mi yapıldı (D11).
 *
 * Fare tıklaması bir HUD düğmesini odaklamış olsa bile Enter/E OYUN komutudur:
 * aksi hâlde "Oyuna odaklan" düğmesi odakta kalıp Enter onayı düğmeyi tıklar ve
 * tam ekran + Pointer Lock kazayla düşer. Yalnız Tab ile gelen (gerçek klavye
 * odağı) kullanıcıda native düğme etkinleştirmesi korunur.
 *
 * Tek `window` dinleyici çifti; `useTableControls` ilk bağlanışta kurar.
 */
let keyboardNavigation = false;
let focusTrackerBound = false;

function bindFocusTracker(): void {
  if (focusTrackerBound || typeof window === 'undefined') return;
  focusTrackerBound = true;
  const pointerUsed = () => {
    keyboardNavigation = false;
  };
  window.addEventListener('pointerdown', pointerUsed, true);
  window.addEventListener('mousedown', pointerUsed, true);
  window.addEventListener('touchstart', pointerUsed, true);
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Tab' || e.code === 'Tab') keyboardNavigation = true;
    },
    true,
  );
}

/**
 * Bu olayı native düğme etkinleştirmesine bırak: hedef tıklanabilir VE odak
 * gerçekten klavyeden geldi (`:focus-visible` + Tab izi). Fare odağında false →
 * olay oyun komutu olur ve `preventDefault` edilir.
 */
function keepsNativeActivation(t: EventTarget | null): boolean {
  if (!isClickableTarget(t)) return false;
  if (!keyboardNavigation) return false;
  try {
    return (t as HTMLElement).matches(':focus-visible');
  } catch {
    // `:focus-visible` desteklenmiyorsa Tab izine güven.
    return true;
  }
}

/** Boş yuvaları atlayarak sonraki/önceki dolu yuvayı bulur. */
function stepFocus(list: readonly (FocusTarget | null)[], from: number, dir: 1 | -1): number {
  const n = list.length;
  if (n === 0) return from;
  for (let step = 1; step <= n; step += 1) {
    const i = (((from + dir * step) % n) + n) % n;
    if (list[i]) return i;
  }
  return from;
}

function firstFocusable(list: readonly (FocusTarget | null)[]): number {
  const i = list.findIndex((t) => t != null);
  return i >= 0 ? i : 0;
}

export function useTableControls(input: TableControlsInput): TableControls {
  const [stage, setStage] = useState<ControlStage>('idle');
  const [focusIndex, setFocusIndex] = useState(0);

  const extraTargets = input.extraTargets;
  const sceneTargets = input.sceneTargets;
  const targets = useMemo<(FocusTarget | null)[]>(
    () => buildTargets({ view: input.view, sceneTargets, extraTargets }),
    [input.view, sceneTargets, extraTargets],
  );

  // Aşama / faz değişiminde odağı ve aşamayı sıfırla.
  const phaseKey = `${input.view.gameId ?? ''}:${input.view.phaseId}`;
  useEffect(() => {
    setFocusIndex(0);
    setStage('idle');
  }, [phaseKey]);

  // Sahne inceleme odağını sürüyorsa HUD odağı onu izler (CODEX-014).
  const sceneInspectedIndex = sceneTargets?.inspectedIndex ?? -1;
  useEffect(() => {
    if (sceneInspectedIndex >= 0) setFocusIndex(sceneInspectedIndex);
  }, [sceneInspectedIndex]);

  // Dış `selection` ile eşitle (faz değişimi seçimi temizlemiş olabilir).
  useEffect(() => {
    if (!input.selection) {
      setStage((s) => (s === 'idle' ? s : 'idle'));
      return;
    }
    const idx = targets.findIndex(
      (t) =>
        t?.kind === 'option' &&
        t.actionId === input.selection?.actionId &&
        t.optionId === input.selection?.optionId,
    );
    if (idx >= 0) {
      setFocusIndex(idx);
      setStage((s) => (s === 'idle' ? 'selected' : s));
    }
  }, [input.selection, targets]);

  // --- Dinleyici için canlı ref'ler (dinleyici bir kez bağlanır) ---
  const paramsRef = useRef(input);
  paramsRef.current = input;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const focusIndexRef = useRef(focusIndex);
  focusIndexRef.current = focusIndex;
  /** Onay adımını AÇAN fiziksel Enter; aynı basış/repeat gönderemez. */
  const armedByKeyRef = useRef(false);

  const commit = useCallback((t: FocusTarget) => {
    const p = paramsRef.current;
    if (t.kind === 'option') p.submitSelected();
    else t.run();
    armedByKeyRef.current = false;
    setStage('idle');
  }, []);

  /**
   * Seçim kimliğini çöz (CODEX-017/1): sahne bu yuvayı çiziyorsa opak kimlik
   * YALNIZ `controller.selectSlot()`ten gelir; null dönerse EYLEM YOKTUR.
   * Yedek (`view.actions` kimliği) yalnız controller hiç yokken ya da hedefi
   * sahne çizmiyorken (`slotIndex === null`) kullanılır. Gönderim her hâlde
   * uygulama `onIntent` yolundadır.
   */
  const optionSelection = useCallback(
    (t: Extract<FocusTarget, { kind: 'option' }>): SceneSelection | null => {
      const controller = paramsRef.current.controller;
      if (controller && t.slotIndex != null) return controller.selectSlot(t.slotIndex);
      return { actionId: t.actionId, optionId: t.optionId };
    },
    [],
  );

  const activate = useCallback(
    (t: FocusTarget) => {
      const p = paramsRef.current;
      if (t.kind === 'option') {
        const selection = optionSelection(t);
        if (!selection) return; // sahne bu yuvada yetkili hedef vermedi
        p.onIntent({ type: 'select_option', ...selection });
        setStage('selected');
        return;
      }
      if (t.requiresConfirmation) setStage('confirming');
      else {
        t.run();
        setStage('idle');
      }
    },
    [optionSelection],
  );

  /** Pointer Lock etkinken E / sol tık: nişangâhın hedefi (CODEX-017/2). */
  const activateAimed = useCallback(() => {
    const p = paramsRef.current;
    const controller = p.controller;
    if (!controller) return false;
    const selection = controller.target();
    if (!selection) return true; // kilitli + hedef yok → hiçbir şey (panel odağına düşme yok)
    p.onIntent({ type: 'select_option', ...selection });
    const idx = targetsRef.current.findIndex(
      (t) =>
        t?.kind === 'option' &&
        t.actionId === selection.actionId &&
        t.optionId === selection.optionId,
    );
    if (idx >= 0) setFocusIndex(idx);
    setStage('selected');
    return true;
  }, []);

  const inGrace = useCallback((): boolean => {
    const p = paramsRef.current;
    return p.lockedAt != null && performance.now() - p.lockedAt < LOCK_GRACE_MS;
  }, []);

  // --- Fare / dokunma yüzeyi (alt eylem çubuğu) ---

  const activateAt = useCallback(
    (index: number) => {
      const t = targetsRef.current[index];
      if (!t) return;
      setFocusIndex(index);
      activate(t);
    },
    [activate],
  );

  const submit = useCallback(() => {
    const t = targetsRef.current[focusIndexRef.current];
    if (!t) return;
    if (stageRef.current === 'idle') {
      activate(t);
      return;
    }
    commit(t);
  }, [activate, commit]);

  const cancel = useCallback(() => {
    paramsRef.current.clearSelection();
    armedByKeyRef.current = false;
    setStage('idle');
  }, []);

  const focusAt = useCallback((index: number) => {
    if (!targetsRef.current[index]) return;
    setFocusIndex(index);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const p = paramsRef.current;
      if (!p.enabled) return;
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // tarayıcı kısayolları / Esc korunur
      if (e.isComposing || e.keyCode === 229) return; // IME
      if (isTypingTarget(e.target)) return;

      const wheel = p.emotes;
      // D16 — çark açıkken TÜM oyun kısayolları çarka aittir.
      if (wheel?.open) {
        if (e.repeat) { e.preventDefault(); return; }
        const step = emoteStepFor(e);
        if (step) { e.preventDefault(); wheel.step(step); return; }
        const wheelCommand = commandForKeyEvent(e);
        if (wheelCommand === 'toggle-emotes') { wheel.close(); return; }
        if (wheelCommand === 'exit-lean') { wheel.close(); return; }
        if (wheelCommand === 'focus-prev' || wheelCommand === 'focus-next') {
          e.preventDefault();
          wheel.step(wheelCommand === 'focus-next' ? 1 : -1);
          return;
        }
        if (wheelCommand === 'confirm' || wheelCommand === 'activate') { e.preventDefault(); wheel.commit(); return; }
        if (wheelCommand) {
          const slot = emoteSlot(wheelCommand);
          if (slot !== null) { e.preventDefault(); wheel.pick(slot); return; }
          if (shouldPreventDefault(wheelCommand)) e.preventDefault();
        }
        // Menü ve kamera dahil hiçbir komut çark açıkken iş yapmaz.
        return;
      }

      const command = commandForKeyEvent(e);
      if (!command) return;
      if (command === 'toggle-emotes') {
        if (wheel?.available && !e.repeat) wheel.press();
        return;
      }

      // Odak KLAVYEYLE bir düğmeye taşındıysa Enter/E'yi native bırak (çift
      // hamle olmasın). Fare tıklamasıyla odakta kalan düğmede komut oyuna
      // aittir; aksi hâlde Enter onayı "Odağı bırak"ı tıklar (D11).
      if ((command === 'confirm' || command === 'activate') && keepsNativeActivation(e.target)) {
        return;
      }

      if (e.repeat) {
        if (shouldPreventDefault(command)) e.preventDefault();
        return;
      }
      if (shouldPreventDefault(command)) e.preventDefault();

      const grace = inGrace();
      const list = targetsRef.current;

      switch (command) {
        case 'toggle-menu':
          p.onMenu?.();
          return;
        case 'toggle-camera':
          p.onCamera?.();
          return;
        case 'lean-board':
          if (p.lean?.available) p.onLeanBoard?.();
          return;
        case 'exit-lean':
          // Escape yalnız eğilmedeyken iş yapar; varsayılanı hiç engellenmez.
          if (p.lean?.active) p.onLeanBoard?.();
          return;
        case 'toggle-role':
          p.onIntent({ type: 'inspect_own_role', open: !p.rolePanelOpen });
          return;
        case 'cancel':
          cancel();
          return;
        case 'focus-prev':
        case 'focus-next': {
          if (stageRef.current === 'confirming') return; // onaydayken ok yok
          if (list.length === 0) return;
          const dir = command === 'focus-next' ? 1 : -1;
          setFocusIndex((i) => stepFocus(list, i, dir));
          // Ok yalnız odağı değiştirir; mevcut seçime/gönderime dokunmaz (§2A).
          setStage((s) => (s === 'selected' ? 'selected' : 'idle'));
          // Sahne kamerası da yerel inceleme odağını izlesin (yalnız odak).
          p.controller?.inspectBy(dir === 1 ? 1 : -1);
          return;
        }
        case 'activate': {
          if (grace) return;
          // Kilitliyken E nişangâhın hedefine bakar (CODEX-017/2).
          if (p.lockedAt != null && activateAimed()) return;
          let idx = focusIndexRef.current;
          if (!list[idx]) {
            idx = firstFocusable(list);
            setFocusIndex(idx);
          }
          const t = list[idx];
          if (t) activate(t);
          return;
        }
        case 'confirm': {
          if (grace) return;
          const t = list[focusIndexRef.current];
          if (!t) return;
          const st = stageRef.current;
          if (st === 'idle') {
            // Hazır seçim yok: Enter odaklıyı seçer, GÖNDERMEZ (aynı `activate`).
            activate(t);
            return;
          }
          if (st === 'selected') {
            if (t.requiresConfirmation) {
              setStage('confirming');
              armedByKeyRef.current = true; // aynı basış gönderemez
            } else {
              commit(t);
            }
            return;
          }
          // confirming
          if (armedByKeyRef.current) return; // onayı açan basış / repeat
          commit(t);
          return;
        }
        default: {
          // D12 tur 3: `option-1` … `option-9` → yuva sırasıyla seçim.
          const slot = optionSlot(command);
          if (slot === null || grace) return;
          const t = list[slot]; // boş yuva → eylem yok, numara kaymaz
          if (!t) return;
          setFocusIndex(slot);
          activate(t);
          return;
        }
      }
    },
    [activate, activateAimed, cancel, commit, inGrace],
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') armedByKeyRef.current = false;
    // D16 — basılı tutup bırakma: vurgulu dilim seçilir (kısa basış açık bırakır).
    if (e.code === 'KeyG' || (!e.code && e.key.toLowerCase() === 'g')) paramsRef.current.emotes?.release();
  }, []);

  useEffect(() => {
    bindFocusTracker();
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [handleKeyDown, handleKeyUp]);

  /**
   * Pointer Lock etkinken sol tık = E (CODEX-017/2). İlk kilit tıklaması grace
   * penceresinde yutulur; Enter onayı ayrı kalır. Kilit yokken HTML düğmeler
   * kendi `onClick`'leriyle çalışır, burada iş yapılmaz.
   */
  const lockActive = input.lockedAt != null;
  useEffect(() => {
    if (!lockActive) return;
    const onMouseDown = (e: MouseEvent) => {
      const p = paramsRef.current;
      if (!p.enabled || e.button !== 0) return;
      // D16 — çark açıkken sol tık vurgulu dilimi seçer, sahneye gitmez.
      if (p.emotes?.open) { e.preventDefault(); p.emotes.commit(); return; }
      if (isTypingTarget(e.target) || isClickableTarget(e.target)) return;
      if (inGrace()) return;
      activateAimed();
    };
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [lockActive, activateAimed, inGrace]);

  const hud = useMemo(
    () =>
      buildHud({
        view: input.view,
        targets,
        focusIndex,
        stage,
        rolePanelOpen: input.rolePanelOpen,
        menuAvailable: Boolean(input.onMenu),
        lean: input.lean,
        emotes: Boolean(input.emotes?.available),
      }),
    [input.view, targets, focusIndex, stage, input.rolePanelOpen, input.onMenu, input.lean, input.emotes?.available],
  );

  return { hud, targets, focusIndex, stage, activateAt, submit, cancel, focusAt };
}
