/**
 * Tek kontrol şeması — FINISH_PLAN §2A.
 *
 * Tuş → komut eşlemesi, o an gerçekten yapılabilen eylemler ve HUD metni burada
 * TEK kaynaktan üretilir. HUD ile davranış aynı bu modelden okunur; oyun
 * sözleşmesine (backend) UI tuşları taşınmaz.
 *
 * Bu dosya saf: DOM veya React yok. `useTableControls` bunu tüketir.
 */

import type {
  ActionId,
  ActionKind,
  OptionId,
  SceneTargets,
  SceneView,
} from '@secret-table/contracts';

import { t } from '../i18n';
import { powerActionText, resolveOptionLabel } from '../ui/text';

// ---------------------------------------------------------------------------
// Tuş → komut
// ---------------------------------------------------------------------------

/**
 * Rakam tuşuyla seçilebilen en fazla seçenek (D12 tur 3). 10 kişilik masada
 * en çok 9 hedef olur; daha fazlası olursa kalanlar yalnız ok tuşlarıyla.
 */
export const OPTION_DIGITS = 9;
/** `option-1` … `option-9`. */
export type OptionCommand = `option-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
/** Komut bir seçenek rakamıysa 0 tabanlı yuva sırası, değilse `null`. */
export function optionSlot(command: ControlCommand): number | null {
  if (!command.startsWith('option-')) return null;
  const slot = Number(command.slice('option-'.length)) - 1;
  return Number.isInteger(slot) && slot >= 0 && slot < OPTION_DIGITS ? slot : null;
}

/**
 * D16 — jest çarkı 8 dilim. Rakam tuşları AYRI bağlanmaz: `option-1…8` çark
 * açıkken jeste, kapalıyken seçeneğe gider (fiziksel tuş bir kez bağlanabilir).
 */
export const EMOTE_DIGITS = 8;
/**
 * YALNIZ çark açıkken geçerli gezinme tuşları (WASD). Global bağlanmaz: çark
 * kapalıyken W/A/S/D oyun kısayolu değildir ve tarayıcıya dokunulmaz.
 */
export const EMOTE_STEP_KEYS: ReadonlyMap<string, -1 | 1> = new Map<string, -1 | 1>([
  ['KeyW', -1], ['KeyA', -1], ['KeyS', 1], ['KeyD', 1],
]);
export function emoteStepFor(event: Pick<KeyboardEvent, 'code' | 'key'>): -1 | 1 | null {
  if (event.code) return EMOTE_STEP_KEYS.get(event.code) ?? null;
  const key = event.key.toLowerCase();
  return key === 'w' || key === 'a' ? -1 : key === 's' || key === 'd' ? 1 : null;
}
/** Komut bir jest rakamıysa 0 tabanlı dilim sırası, değilse `null`. */
export function emoteSlot(command: ControlCommand): number | null {
  const slot = optionSlot(command);
  return slot !== null && slot < EMOTE_DIGITS ? slot : null;
}

export type ControlCommand =
  | 'activate' // E / sol tık: odaklı hedefi seç (sunucu hamlesi değil)
  | OptionCommand // 1–9: yuva sırasıyla seç
  | 'focus-prev' // ← / ↑
  | 'focus-next' // → / ↓
  | 'confirm' // Enter: onay adımı, ayrı basışta gönder
  | 'cancel' // Backspace: gönderilmemiş seçimi iptal
  | 'toggle-role' // H
  | 'toggle-camera' // V
  | 'lean-board' // B: koltuktan tahtaların üstüne eğil / geri dön (D15)
  | 'toggle-emotes' // G: jest çarkını aç/kapat (D16); basılı tutup bırakmak seçer
  | 'exit-lean' // Esc: eğilmeden dön (yalnız eğilmedeyken iş yapar)
  | 'toggle-menu'; // M

const OPTION_COMMANDS: readonly OptionCommand[] = Array.from(
  { length: OPTION_DIGITS },
  (_unused, i) => `option-${i + 1}` as OptionCommand,
);

/** `KeyboardEvent.code` → komut. Fiziksel tuş; klavye düzeninden bağımsız. */
export const KEY_BINDINGS: ReadonlyArray<{ code: string; command: ControlCommand }> = [
  { code: 'KeyE', command: 'activate' },
  // D12 tur 3: 1–9 (ve Numpad1–9) yuva sırasıyla seçer.
  ...OPTION_COMMANDS.flatMap((command, i) => [
    { code: `Digit${i + 1}`, command },
    { code: `Numpad${i + 1}`, command },
  ]),
  { code: 'ArrowLeft', command: 'focus-prev' },
  { code: 'ArrowUp', command: 'focus-prev' },
  { code: 'ArrowRight', command: 'focus-next' },
  { code: 'ArrowDown', command: 'focus-next' },
  { code: 'Enter', command: 'confirm' },
  { code: 'NumpadEnter', command: 'confirm' },
  { code: 'Backspace', command: 'cancel' },
  { code: 'KeyH', command: 'toggle-role' },
  { code: 'KeyV', command: 'toggle-camera' },
  { code: 'KeyB', command: 'lean-board' },
  { code: 'KeyG', command: 'toggle-emotes' },
  { code: 'Escape', command: 'exit-lean' },
  { code: 'KeyM', command: 'toggle-menu' },
];

const BINDING_BY_CODE = new Map(KEY_BINDINGS.map((b) => [b.code, b.command] as const));

/** Bu komutlar tarayıcı varsayılanını bastırır (geri gezinme, sayfa kaydırma). */
const PREVENT_DEFAULT: ReadonlySet<ControlCommand> = new Set<ControlCommand>([
  'focus-prev',
  'focus-next',
  'confirm',
  'cancel',
  'activate',
  ...OPTION_COMMANDS,
]);

export function commandForCode(code: string): ControlCommand | null {
  return BINDING_BY_CODE.get(code) ?? null;
}

/**
 * `KeyboardEvent.key` yedeği: bazı sanal klavyeler / otomasyon araçları `code`
 * alanını boş gönderir. Yalnız `code` boşken kullanılır; harf tuşları küçük harfe
 * indirgenir.
 */
const BINDING_BY_KEY: ReadonlyMap<string, ControlCommand> = new Map<string, ControlCommand>([
  ['e', 'activate'],
  ...OPTION_COMMANDS.map((command, i) => [String(i + 1), command] as const),
  ['arrowleft', 'focus-prev'],
  ['arrowup', 'focus-prev'],
  ['arrowright', 'focus-next'],
  ['arrowdown', 'focus-next'],
  ['enter', 'confirm'],
  ['backspace', 'cancel'],
  ['h', 'toggle-role'],
  ['v', 'toggle-camera'],
  ['b', 'lean-board'],
  ['g', 'toggle-emotes'],
  ['escape', 'exit-lean'],
  ['m', 'toggle-menu'],
]);

export function commandForKeyEvent(event: Pick<KeyboardEvent, 'code' | 'key'>): ControlCommand | null {
  if (event.code) return commandForCode(event.code);
  return BINDING_BY_KEY.get(event.key.toLowerCase()) ?? null;
}

export function shouldPreventDefault(command: ControlCommand): boolean {
  return PREVENT_DEFAULT.has(command);
}

// ---------------------------------------------------------------------------
// Odaklanılabilir hedefler
// ---------------------------------------------------------------------------

/** Gerçek bir aksiyon seçeneği (mevcut `select_option` / `submitSelected` yolu). */
export type OptionTarget = {
  kind: 'option';
  id: string;
  label: string;
  actionId: ActionId;
  optionId: OptionId;
  actionKind: ActionKind;
  requiresConfirmation: boolean;
  /**
   * Sahnenin bildirdiği ekran yuvası (`SceneTargets.slots` dizini). Sahne bu
   * seçeneği çizmiyorsa `null`: seçim kimliği `controller.selectSlot()` yerine
   * hedefin kendi opak kimliğinden gelir (CODEX-017/1).
   */
  slotIndex: number | null;
};

/** Aksiyon dışı bir komut hedefi (yeniden oyna, lobiye dön, …). */
export type CommandTarget = {
  kind: 'command';
  id: string;
  label: string;
  requiresConfirmation: boolean;
  /** Onay adımı metni (varsa). */
  consequence?: string;
  run: () => void;
};

export type FocusTarget = OptionTarget | CommandTarget;

/**
 * `SceneView.actions` → düz, soldan sağa sıralı seçenek listesi. Görsel sıra ile
 * gönderilen `optionId` eşleşir (FINISH_PLAN §2A). 1/2/3 yalnız ilk üç öğeye.
 */
export function optionTargets(view: SceneView): OptionTarget[] {
  const out: OptionTarget[] = [];
  for (const action of view.actions) {
    for (const option of action.options) {
      out.push({
        kind: 'option',
        id: `${action.actionId}:${option.optionId}`,
        label: resolveOptionLabel(option, view.players),
        actionId: action.actionId,
        optionId: option.optionId,
        actionKind: action.kind,
        requiresConfirmation: action.requiresConfirmation,
        slotIndex: null,
      });
    }
  }
  return out;
}

/**
 * Ekran sırası — CODEX-017/1.
 *
 * Sahne o an yuva SAHİPLENİYORSA (`SceneTargets.slots` içinde en az bir dolu
 * yuva var) 1/2/3, HUD ve alt çubuk AYNI opak sırayı kullanır: yetkisiz veya
 * çizilmeyen yuva `null` kalır, numara kaymaz ve o yuvada `selectSlot()` null
 * dönerse eylem olmaz. Sahnenin çizmediği ama yetkili görünümde bulunan
 * seçenekler (ör. veto düğmesi) sıradan sonra eklenir; `slotIndex`leri `null`.
 *
 * Sahne hiç yuva sahiplenmiyorsa (Pointer Lock yok → sahne hedefleme kapalı,
 * telefon, genel masa kamerası, sahne yüklenmedi) uygulamanın yetkili
 * `view.actions` sırası kullanılır. Aksi hâlde fare/dokunmatik oyun tümüyle
 * kilitlenirdi; sahne o durumda zaten hiçbir yuvayı çözemiyor.
 */
export function buildTargets(params: {
  view: SceneView;
  sceneTargets?: SceneTargets | null;
  extraTargets?: readonly FocusTarget[];
}): (FocusTarget | null)[] {
  const { view, sceneTargets, extraTargets } = params;
  const options = optionTargets(view);
  const slots = sceneTargets?.slots;

  if (!slots || !slots.some((slot) => slot != null)) {
    return [...options, ...(extraTargets ?? [])];
  }

  const byKey = new Map<string, OptionTarget>(
    options.map((o) => [`${o.actionId}:${o.optionId}`, o]),
  );
  const used = new Set<string>();
  const ordered: (FocusTarget | null)[] = slots.map((slot, index) => {
    if (!slot) return null;
    const key = `${slot.actionId}:${slot.optionId}`;
    const found = byKey.get(key);
    if (!found) return null; // sahnenin bildirdiği yuva yetkili görünümde yok
    used.add(key);
    return { ...found, slotIndex: index };
  });

  const rest = options
    .filter((o) => !used.has(`${o.actionId}:${o.optionId}`))
    .map((o): OptionTarget => ({ ...o, slotIndex: null }));

  return [...ordered, ...rest, ...(extraTargets ?? [])];
}

/** Odaklı seçeneğin dizinine karşılık gelen 1..3 rakamı (yoksa null). */
export function digitForIndex(index: number): number | null {
  return index >= 0 && index < 3 ? index + 1 : null;
}

// ---------------------------------------------------------------------------
// Onay / sonuç metni
// ---------------------------------------------------------------------------

/**
 * Seçili hedef için onay satırı. `use_power` + infazda hedefin eleneceği açıkça
 * yazılır (QA-R03 ile aynı metin kaynağı).
 */
export function consequenceText(target: FocusTarget, view: SceneView): string {
  if (target.kind === 'command') return target.consequence ?? t('hint.selected', { label: target.label });
  const power =
    target.actionKind === 'use_power' && view.table.currentPower
      ? powerActionText(view.table.currentPower.power)
      : null;
  if (power) return power.consequence(target.label);
  return t('hint.willSend', { label: target.label });
}

/** Gönder düğmesi / HUD "onayla" etiketi. */
export function submitLabelFor(target: FocusTarget, view: SceneView): string {
  if (target.kind === 'option' && target.actionKind === 'use_power' && view.table.currentPower) {
    return powerActionText(view.table.currentPower.power).submitLabel;
  }
  return t('actionbar.confirm');
}

// ---------------------------------------------------------------------------
// HUD modeli
// ---------------------------------------------------------------------------

export type ControlStage = 'idle' | 'selected' | 'confirming';

export type HudHint = { keys: string; label: string };

export type ControlHudModel = {
  /** O an gerçekten işe yarayan tuşlar. Yapılamayan eylem gösterilmez. */
  hints: HudHint[];
  /**
   * Alt çubukta sürekli duran kısayol rozetleri (ROADMAP A2/3). İçerik durumla
   * birlikte etiket değiştirir ama liste kaybolmaz; oyuncu tuşları arayacak
   * yer bilir.
   */
  shortcuts: HudHint[];
  /** Odaktaki hedefin adı (idle/selected). */
  focusLabel: string | null;
  /** Seçili/onay adımındaki sonuç metni. */
  consequence: string | null;
  /** Onay/gönder düğmesinin etiketi (odak varsa). */
  submitLabel: string | null;
  stage: ControlStage;
};

/**
 * D15 — tahtaya eğilme durumu. `available` yalnız koltuk kamerasında doğrudur;
 * genel bakışta "Tahta" eski tepeden incelemedir ve `B` kısayolu gösterilmez.
 */
export type LeanState = { available: boolean; active: boolean };

export function buildHud(params: {
  view: SceneView;
  targets: readonly (FocusTarget | null)[];
  focusIndex: number;
  stage: ControlStage;
  rolePanelOpen: boolean;
  menuAvailable: boolean;
  lean?: LeanState;
  /** D16 — jest çarkı bu oyunda kullanılabilir mi (HUD rozetleri). */
  emotes?: boolean;
}): ControlHudModel {
  const { view, targets, focusIndex, stage, rolePanelOpen, menuAvailable } = params;
  const lean = params.lean ?? { available: false, active: false };
  const focus = targets[focusIndex] ?? null;
  const hints: HudHint[] = [];

  if (stage === 'confirming' && focus) {
    hints.push({ keys: 'Enter', label: submitLabelFor(focus, view) });
    hints.push({ keys: 'Backspace', label: t('hint.cancel') });
  } else {
    const optionCount = targets.filter((t) => t != null).length;
    if (optionCount > 0) {
      // Numaralar YUVA sırasıdır: boş yuva atlanmaz, numara kaymaz.
      const digits = Math.min(targets.length, OPTION_DIGITS);
      if (digits > 0) hints.push({ keys: digits === 1 ? '1' : `1–${digits}`, label: t('hint.pick') });
      if (optionCount > 1) hints.push({ keys: '← →', label: t('hint.browse') });
      hints.push({ keys: 'E', label: t('hint.pick') });
      if (stage === 'selected' && focus) {
        hints.push({
          keys: 'Enter',
          label: focus.requiresConfirmation ? t('hint.confirmStep') : submitLabelFor(focus, view),
        });
        hints.push({ keys: 'Backspace', label: t('hint.cancel') });
      }
    }
  }

  // D15: eğilmedeyken eller gizlidir; kart seçimi alt seçenek çubuğundan yapılır.
  if (lean.active && targets.some((t) => t != null) && stage !== 'confirming') {
    hints.push({ keys: '1–9', label: t('hint.pickFromBar') });
  }

  const roleAvailable = Boolean(
    view.privateView.role || view.privateView.hand.length || view.privateView.inspection,
  );
  if (roleAvailable) {
    hints.push({ keys: 'H', label: rolePanelOpen ? t('hint.identityClose') : t('hint.identityOpen') });
  }
  if (lean.available) {
    hints.push({
      keys: lean.active ? 'B / Esc' : 'B',
      label: lean.active ? t('hint.backToTable') : t('hint.leanBoard'),
    });
  }
  if (params.emotes) hints.push({ keys: 'G', label: t('hint.emote') });
  hints.push({ keys: 'V', label: t('hint.camera') });
  if (menuAvailable) hints.push({ keys: 'M', label: t('hint.menuKeys') });

  // D12 tur 3: rakam rozetleri artık 9 seçeneğe kadar var; sabit şerit de
  // kaç rakamın çalıştığını söyler (seçenek yokken gösterilmez).
  const digitKeys = Math.min(targets.length, OPTION_DIGITS);
  const shortcuts: HudHint[] = [
    ...(digitKeys > 0 && stage !== 'confirming'
      ? [{
          keys: digitKeys === 1 ? '1' : `1–${digitKeys}`,
          // D15: eğilmede eller çizilmez; seçim yalnız bu çubuktan yapılır.
          label: lean.active ? t('hint.pickHandsHidden') : t('hint.pick'),
        }]
      : []),
    { keys: 'E', label: t('hint.pick') },
    { keys: 'Enter', label: focus ? submitLabelFor(focus, view) : t('hint.confirm') },
    { keys: 'Backspace', label: t('hint.cancel') },
  ];
  if (roleAvailable) {
    shortcuts.push({ keys: 'H', label: rolePanelOpen ? t('hint.identityClose') : t('hint.identity') });
  }
  if (lean.available) shortcuts.push({ keys: 'B', label: lean.active ? t('hint.backToTable') : t('hint.board') });
  if (params.emotes) shortcuts.push({ keys: 'G', label: t('hint.emoteShort') });
  shortcuts.push({ keys: 'V', label: t('hint.camera') });
  if (menuAvailable) shortcuts.push({ keys: 'M', label: t('hint.menu') });

  return {
    hints,
    shortcuts,
    focusLabel: stage !== 'confirming' && focus ? focus.label : null,
    consequence: stage !== 'idle' && focus ? consequenceText(focus, view) : null,
    submitLabel: focus ? submitLabelFor(focus, view) : null,
    stage,
  };
}
