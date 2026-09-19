/**
 * Metin çözücüler. Sözleşme `labelKey` / `messageKey` anahtarlarını ve
 * uygulama içi sabit metinleri i18n sözlüğüne bağlar (docs/CONTRACT.md § 4, § 6).
 *
 * D23: metnin kendisi artık `apps/web/src/i18n/{tr,en}.ts` içindedir; burada
 * yalnız sözleşme kodu → sözlük anahtarı eşlemesi kaldı. Bu yüzden eski sabit
 * tablolar (`PHASE_NAMES` vb.) FONKSİYONA döndü: dil çalışma anında değişir.
 *
 * `labelKey` çözümü: bilinen anahtar → sözlük metni; `player.name` gibi veriye
 * bağlı anahtarlar `resolveOptionLabel` içinde oyuncu adıyla doldurulur.
 */

import type {
  AllowedAction,
  ActionOption,
  ConnectionStatus,
  ExecutivePower,
  GameEndReason,
  Party,
  PlayerView,
  ScenePhase,
  SecretRole,
} from '@secret-table/contracts';

import { t, type TextKey } from '../i18n';

/** Bağlantı durumu metinleri. `connected` için şerit gösterilmez. */
export function connectionText(
  status: ConnectionStatus,
): { label: string; hint: string } | null {
  if (status === 'connected') return null;
  return {
    label: t(`connection.${status}.label` as TextKey),
    hint: t(`connection.${status}.hint` as TextKey),
  };
}

const LABEL_KEYS: Record<string, TextKey> = {
  'role.ready': 'option.role.ready',
  'vote.yes': 'option.vote.yes',
  'vote.no': 'option.vote.no',
  'policy.liberal': 'option.policy.liberal',
  'policy.fascist': 'option.policy.fascist',
  'veto.request': 'option.veto.request',
  'veto.accept': 'option.veto.accept',
  'veto.reject': 'option.veto.reject',
  'power.peek': 'option.power.peek',
  'inspection.ack': 'option.inspection.ack',
};

/** Aksiyon türü → kullanıcıya gösterilen başlık ve yardım metni. */
export function actionTitle(kind: AllowedAction['kind']): { title: string; hint: string } {
  return {
    title: t(`action.${kind}.title` as TextKey),
    hint: t(`action.${kind}.hint` as TextKey),
  };
}

export function phaseName(phase: ScenePhase): string {
  return t(`phase.${phase}` as TextKey);
}

/** Gizli rol adları (oyun sonu açıklaması, özel bilgi paneli). */
export function roleName(role: SecretRole): string {
  return t(`role.${role}` as TextKey);
}

/** Herkesçe bilinen başkanlık yetkisi adları. */
export function powerName(power: ExecutivePower): string {
  return t(`power.${power}` as TextKey);
}

/** Tüm yetki adları (tablo üretimi ve test için). */
export function powerNames(): Record<ExecutivePower, string> {
  return {
    investigate_loyalty: powerName('investigate_loyalty'),
    call_special_election: powerName('call_special_election'),
    policy_peek: powerName('policy_peek'),
    execution: powerName('execution'),
  };
}

/** Oyunun bitiş nedeni. */
export function endReasonName(reason: GameEndReason): string {
  return t(`end.${reason}` as TextKey);
}

export function winnerName(winner: Party): string {
  return t(`winner.${winner}` as TextKey);
}

/**
 * `use_power` aksiyonu için yetkiye özgü metin (QA-R03). Üst panelde yetkinin adı,
 * ne yaptığı ve onaydan önce sonucunun (özellikle infazda oyuncunun eleneceği)
 * açıkça görünmesi için kullanılır.
 */
export function powerActionText(power: ExecutivePower): {
  title: string;
  hint: string;
  submitLabel: string;
  /** Hedef seçilince gösterilen onay satırı. */
  consequence: (targetName: string) => string;
} {
  switch (power) {
    case 'execution':
    case 'investigate_loyalty':
    case 'call_special_election':
    case 'policy_peek':
      return {
        title: t(`powerAction.${power}.title` as TextKey),
        hint: t(`powerAction.${power}.hint` as TextKey),
        submitLabel: t(`powerAction.${power}.submit` as TextKey),
        consequence: (name) => t(`powerAction.${power}.consequence` as TextKey, { name }),
      };
    default: {
      const _exhaustive: never = power;
      void _exhaustive;
      return {
        title: actionTitle('use_power').title,
        hint: actionTitle('use_power').hint,
        submitLabel: t('powerAction.default.submit'),
        consequence: (name) => t('powerAction.default.consequence', { name }),
      };
    }
  }
}

/**
 * Hata anahtarları: hem sözleşme `messageKey`'leri (`error.snake_case`) hem de
 * ağ/HTTP katmanının büyük harfli ham kodları (`SERVICE_UNAVAILABLE`). Her giriş
 * açıklama + uygulanabilir sonraki adım içerir (QA-R04).
 */
const ERROR_KEYS: readonly string[] = [
  'error.room_not_found',
  'error.room_full',
  'error.game_already_started',
  'error.session_invalid',
  'error.reconnect_expired',
  'error.stale_action',
  'error.not_allowed',
  'error.invalid_option',
  'error.rate_limited',
  'error.version_mismatch',
  'error.retryable_conflict',
  'error.service_unavailable',
  'error.MISSING_TOKEN',
  'error.SUPABASE_NOT_CONFIGURED',
  'error.CLIENT_NOT_CONFIGURED',
  'error.GUEST_LIMIT_REACHED',
  'error.NETWORK_ERROR',
  'error.REQUEST_FAILED',
  'error.INVALID_COMMAND',
  'error.MISSING_ROOM_ID',
  'error.MISSING_INVITE_CODE',
  'error.MISSING_ACTION',
  'error.METHOD_NOT_ALLOWED',
  'error.UNKNOWN_ACTION',
];

const ERROR_SET = new Set(ERROR_KEYS);

/**
 * Ham kodu sözlük anahtarına çevirir: `error.room_full` olduğu gibi,
 * `SERVICE_UNAVAILABLE` önce `error.SERVICE_UNAVAILABLE`, yoksa
 * `error.service_unavailable` olarak denenir.
 */
function errorKeyFor(key: string): TextKey | null {
  if (ERROR_SET.has(key)) return key as TextKey;
  if (/^[A-Z0-9_]+$/.test(key)) {
    const upper = `error.${key}`;
    if (ERROR_SET.has(upper)) return upper as TextKey;
    const lowered = `error.${key.toLowerCase()}`;
    if (ERROR_SET.has(lowered)) return lowered as TextKey;
  }
  return null;
}

export function errorText(key: string | null | undefined): string {
  if (!key) return t('error.generic');
  const mapped = errorKeyFor(key);
  if (mapped) return t(mapped);
  // Kod görünümlü bilinmeyen anahtar: ham kodu tek açıklama olarak gösterme (QA-R04).
  if (/^[A-Za-z0-9_.]+$/.test(key)) return t('error.generic');
  // İnsan tarafından yazılmış mesaj (boşluk içerir): olduğu gibi göster.
  return key;
}

/** `labelKey` + veri → görünen seçenek metni. */
export function resolveOptionLabel(
  option: ActionOption,
  players: readonly PlayerView[],
): string {
  if (option.labelKey === 'player.name' && option.targetPlayerId) {
    const player = players.find((p) => p.playerId === option.targetPlayerId);
    return player ? player.displayName : t('common.player');
  }
  const mapped = LABEL_KEYS[option.labelKey];
  return mapped ? t(mapped) : option.labelKey;
}
