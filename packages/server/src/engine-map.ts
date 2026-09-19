/**
 * Ağ komutunu (`actionId` + `optionId`) motor komutuna çevirir.
 *
 * Tek kaynak `projectActions`: istemcinin görebildiği eylem/seçenekler neyse,
 * çeviri de onları geri okur. Böylece "istemcinin gönderdiği rastgele alan"
 * yetki kaynağı olmaz; sunucu yine motoru çağırıp tüm kuralları uygular.
 */

import type { CommandErrorCode } from '@secret-table/contracts';
import type { EngineCommand, GameState } from '@secret-table/game-core';

import { phaseIdOf, projectActions } from './projection';

export type ResolveResult =
  | { ok: true; command: EngineCommand }
  | { ok: false; error: CommandErrorCode };

export function resolveEngineCommand(
  state: GameState,
  playerId: string,
  gameId: string,
  requestedPhaseId: string,
  actionId: string,
  optionId: string | undefined,
): ResolveResult {
  const phaseId = phaseIdOf(state, gameId);
  if (requestedPhaseId !== phaseId) {
    return { ok: false, error: 'STALE_ACTION' };
  }

  const actions = projectActions(state, playerId, phaseId);
  const action = actions.find((a) => a.actionId === actionId);
  if (!action) return { ok: false, error: 'NOT_ALLOWED' };

  /**
   * D18/B2 — `optionId` atlanırsa sunucu ARTIK sessizce ilk seçeneği uygulamaz.
   *
   * Eskiden `action.options[0]` varsayılanı vardı; ölçülen etkisi: oy → "evet",
   * adaylık → ilk uygun oyuncu, veto → kabul. Bozuk/eski bir istemci ya da
   * yarım bir istek oyuncunun adına karar veriyordu.
   *
   * **D21/I** — kural tek yerde, BURADA yaşıyor (sözleşmedeki sabit eylem
   * kimliği listesi `ACTIONS_REQUIRING_OPTION` kaldırıldı; projeksiyonla
   * uyumsuzlaşabiliyordu). Koşul artık "seçenek sayısı > 1" değil, **gerçek bir
   * seçim var mı**:
   *
   *  - birden çok seçenek varsa (oy, adaylık, atma, koyma, veto yanıtı), ya da
   *  - seçenek bir OYUNCUYU hedefliyorsa (`targetPlayerId`) — tek uygun hedefi
   *    kalmış inceleme/infaz dahil: "kimi vurduğunu" sunucu varsaymaz —
   *
   * `optionId` ZORUNLUDUR. Gerçek seçim içermeyen onaylarda (`act_ack_role`,
   * `act_ack_private`, `act_request_veto`) ve `policy_peek`te (tek, hedefsiz
   * "bak" seçeneği) alan atlanabilir; o tek seçenek uygulanır.
   */
  const requiresOption =
    action.options.length > 1 || action.options.some((o) => o.targetPlayerId !== undefined);

  let option: (typeof action.options)[number] | undefined;
  if (optionId !== undefined) {
    option = action.options.find((o) => o.optionId === optionId);
    if (!option) return { ok: false, error: 'INVALID_OPTION' };
  } else {
    if (requiresOption) return { ok: false, error: 'INVALID_OPTION' };
    option = action.options[0];
  }

  switch (action.kind) {
    case 'ack_role':
      return { ok: true, command: { type: 'ack_role', playerId } };

    case 'nominate':
      if (!option?.targetPlayerId) return { ok: false, error: 'INVALID_OPTION' };
      return { ok: true, command: { type: 'nominate', playerId, chancellorId: option.targetPlayerId } };

    case 'vote':
      if (!option?.vote) return { ok: false, error: 'INVALID_OPTION' };
      return { ok: true, command: { type: 'vote', playerId, vote: option.vote } };

    case 'discard_policy':
      if (!option?.cardId) return { ok: false, error: 'INVALID_OPTION' };
      return { ok: true, command: { type: 'discard_policy', playerId, cardId: option.cardId } };

    case 'enact_policy':
      if (!option?.cardId) return { ok: false, error: 'INVALID_OPTION' };
      return { ok: true, command: { type: 'enact_policy', playerId, cardId: option.cardId } };

    case 'request_veto':
      return { ok: true, command: { type: 'request_veto', playerId } };

    case 'respond_veto':
      // İki seçenekli (kabul/ret): D18/B2 sonrası `optionId` zorunlu, ama
      // "kabul mü ret mi" kararı asla tahmine bırakılmasın diye açıkça kontrol.
      if (!option) return { ok: false, error: 'INVALID_OPTION' };
      return {
        ok: true,
        command: { type: 'respond_veto', playerId, accept: option.optionId === 'veto_accept' },
      };

    case 'use_power':
      return {
        ok: true,
        command: option?.targetPlayerId
          ? { type: 'use_power', playerId, targetId: option.targetPlayerId }
          : { type: 'use_power', playerId },
      };

    case 'ack_private_result':
      return { ok: true, command: { type: 'ack_private_result', playerId } };

    default: {
      const _exhaustive: never = action.kind;
      void _exhaustive;
      return { ok: false, error: 'NOT_ALLOWED' };
    }
  }
}
