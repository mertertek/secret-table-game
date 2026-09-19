/** Motorun reddetme kodları. Sunucu bunları ağ hata kodlarına eşler. */
export type EngineErrorCode =
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'NOT_A_PLAYER'
  | 'PLAYER_DEAD'
  | 'INVALID_TARGET'
  | 'INELIGIBLE_CHANCELLOR'
  | 'ALREADY_ACKED'
  | 'ALREADY_VOTED'
  | 'UNKNOWN_CARD'
  | 'VETO_NOT_AVAILABLE'
  | 'POWER_HAS_NO_TARGET'
  | 'POWER_NEEDS_TARGET'
  | 'GAME_OVER'
  /**
   * D19 — YALNIZ geliştirici senaryosu: istenen senaryo bu tahta düzeninde yok.
   * D21/I — eşleme açıkça (kaynak `contracts/rules.ts` `BOARD_LAYOUTS`):
   * `policy_peek` yalnız **5-6** kişilik düzende, `investigate_loyalty` yalnız
   * **7-10** kişilik düzende bulunur. Yani `policy_peek_now` 7+ kişilik masada,
   * `investigate_now` 5-6 kişilik masada bu kodu verir. Normal oyun akışında
   * ASLA üretilmez.
   */
  | 'SCENARIO_NEEDS_PLAYERS';

export type EngineResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: EngineErrorCode };

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  constructor(code: EngineErrorCode) {
    super(code);
    this.name = 'EngineError';
    this.code = code;
  }
}
