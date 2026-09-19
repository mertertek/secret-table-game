import type { CommandErrorCode } from '@secret-table/contracts';
import type { EngineErrorCode } from '@secret-table/game-core';

/** Motor ret kodu -> ağ hata kodu. Yanıt gizli durum dökümü içermez. */
export function mapEngineError(code: EngineErrorCode): {
  error: CommandErrorCode;
  retryable: boolean;
  messageKey: string;
} {
  switch (code) {
    case 'WRONG_PHASE':
    case 'GAME_OVER':
      return { error: 'STALE_ACTION', retryable: false, messageKey: 'error.stale_action' };
    case 'NOT_A_PLAYER':
      return { error: 'SESSION_INVALID', retryable: false, messageKey: 'error.session_invalid' };
    case 'NOT_YOUR_TURN':
    case 'PLAYER_DEAD':
    case 'ALREADY_ACKED':
    case 'ALREADY_VOTED':
    case 'VETO_NOT_AVAILABLE':
      return { error: 'NOT_ALLOWED', retryable: false, messageKey: 'error.not_allowed' };
    case 'INVALID_TARGET':
    case 'INELIGIBLE_CHANCELLOR':
    case 'UNKNOWN_CARD':
    case 'POWER_HAS_NO_TARGET':
    case 'POWER_NEEDS_TARGET':
    // D19 — yalnız dev senaryosu: bu oyuncu sayısında o yetki/aşama yok.
    case 'SCENARIO_NEEDS_PLAYERS':
      return { error: 'INVALID_OPTION', retryable: false, messageKey: 'error.invalid_option' };
    default: {
      const _exhaustive: never = code;
      void _exhaustive;
      return { error: 'NOT_ALLOWED', retryable: false, messageKey: 'error.not_allowed' };
    }
  }
}

export const messageKeyForError: Readonly<Record<CommandErrorCode, string>> = {
  ROOM_NOT_FOUND: 'error.room_not_found',
  ROOM_FULL: 'error.room_full',
  GAME_ALREADY_STARTED: 'error.game_already_started',
  SESSION_INVALID: 'error.session_invalid',
  RECONNECT_EXPIRED: 'error.reconnect_expired',
  STALE_ACTION: 'error.stale_action',
  NOT_ALLOWED: 'error.not_allowed',
  INVALID_OPTION: 'error.invalid_option',
  RATE_LIMITED: 'error.rate_limited',
  VERSION_MISMATCH: 'error.version_mismatch',
  RETRYABLE_CONFLICT: 'error.retryable_conflict',
  SERVICE_UNAVAILABLE: 'error.service_unavailable',
};
