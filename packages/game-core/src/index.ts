/**
 * @secret-table/game-core — saf TypeScript oyun motoru (C02).
 *
 * Resmî Secret Hitler kuralları, 5-10 oyuncu. Ağ, tarayıcı, Supabase veya React
 * bağımlılığı yok; yalnız `@secret-table/contracts` tipleri ve kurulum metaverisi
 * (`@secret-table/contracts/rules`) kullanılır.
 *
 * Bu paket tarayıcı derlemesine dahil edilmez; yalnız Vercel API içe aktarır.
 */

export { createGame } from './setup';
export type { CreateGameConfig } from './setup';
export { applyCommand } from './engine';
export type { ApplyResult, ApplyOutcome } from './engine';
/** D14 — yalnız geliştirme; sunucu `SECRET_TABLE_DEV_TOOLS=1` kapısı arkasında çağırır. */
export { devScenario } from './devScenario';
export type { DevScenarioInput, DevScenarioResult } from './devScenario';
export {
  alivePlayerIds,
  eligibleChancellorIds,
  investigatableTargetIds,
  knownPlayersFor,
  otherAliveTargetIds,
  requiredPlayerIds,
} from './selectors';
export type { KnownPlayerInfo } from './selectors';
export { createRng, shuffle } from './rng';
export type { Rng } from './rng';
export { EngineError } from './errors';
export type { EngineErrorCode, EngineResult } from './errors';
export type { EngineCommand, EngineCommandType } from './commands';
export type { GameEvent } from './events';
export type {
  DealtCard,
  EnginePhase,
  EnginePlayer,
  GameLogEntry,
  GameState,
  Government,
  InspectionResult,
  InvestigationRecord,
  PolicyCard,
  PublicElectionRecord,
  PublicVoteRecord,
} from './types';
