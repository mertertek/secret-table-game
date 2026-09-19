import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from './index';
import {
  gameCommandSchema,
  lobbyCommandSchema,
  playerViewRequestSchema,
  safeParseGameCommand,
} from './schemas';

describe('gameCommandSchema', () => {
  it('geçerli hamle zarfını kabul eder', () => {
    const input = {
      protocolVersion: PROTOCOL_VERSION,
      gameId: 'game_1',
      phaseId: 'phase_1',
      commandId: 'cmd_1',
      actionId: 'act_1',
      optionId: 'opt_1',
    };
    expect(gameCommandSchema.parse(input)).toEqual(input);
  });

  it('optionId olmadan da geçerlidir', () => {
    const res = safeParseGameCommand({
      protocolVersion: PROTOCOL_VERSION,
      gameId: 'g',
      phaseId: 'p',
      commandId: 'c',
      actionId: 'a',
    });
    expect(res.success).toBe(true);
  });

  // D21/I — şema artık eylem kimliğine BAKMAZ: `optionId` zorunluluğu tek
  // yerde, sunucuda (`engine-map.ts`) projeksiyondaki seçenek sayısından
  // türetilir. Eskiden buradaki `ACTIONS_REQUIRING_OPTION` listesi ikinci bir
  // doğruluk kaynağıydı ve projeksiyonla uyumsuzlaşabiliyordu.
  it.each(['act_nominate', 'act_vote', 'act_discard', 'act_enact', 'act_respond_veto'])(
    '%s optionId olmadan da ŞEMADAN geçer (kontrol sunucuda)',
    (actionId) => {
      const res = safeParseGameCommand({
        protocolVersion: PROTOCOL_VERSION,
        gameId: 'g',
        phaseId: 'p',
        commandId: 'c',
        actionId,
      });
      expect(res.success).toBe(true);
    },
  );

  it('act_use_power optionId olmadan şemadan geçer (kontrol sunucuda)', () => {
    // Seçenek sayısına bakan kontrol sunucuda (`resolveEngineCommand`): D21'den
    // sonra seçenekli her eylemde `optionId` zorunlu (tek seçenekli inceleme /
    // infaz dahil), seçeneksiz eylemlerde aranmaz.
    expect(
      safeParseGameCommand({
        protocolVersion: PROTOCOL_VERSION,
        gameId: 'g',
        phaseId: 'p',
        commandId: 'c',
        actionId: 'act_use_power',
      }).success,
    ).toBe(true);
  });

  it('yanlış protokol sürümünü reddeder', () => {
    const res = safeParseGameCommand({
      protocolVersion: 2,
      gameId: 'g',
      phaseId: 'p',
      commandId: 'c',
      actionId: 'a',
    });
    expect(res.success).toBe(false);
  });

  it('bilinmeyen alanları düşürür (strip)', () => {
    const parsed = gameCommandSchema.parse({
      protocolVersion: PROTOCOL_VERSION,
      gameId: 'g',
      phaseId: 'p',
      commandId: 'c',
      actionId: 'a',
      internalState: { role: 'hitler' },
    });
    expect('internalState' in parsed).toBe(false);
  });
});

describe('lobbyCommandSchema', () => {
  it('set_ready komutunu ayrıştırır', () => {
    const parsed = lobbyCommandSchema.parse({
      protocolVersion: PROTOCOL_VERSION,
      commandId: 'c',
      type: 'set_ready',
      ready: true,
    });
    expect(parsed.type).toBe('set_ready');
  });

  it('bilinmeyen tür reddedilir', () => {
    expect(
      lobbyCommandSchema.safeParse({
        protocolVersion: PROTOCOL_VERSION,
        commandId: 'c',
        type: 'nuke_room',
      }).success,
    ).toBe(false);
  });
});

describe('playerViewRequestSchema (D18)', () => {
  it('sinceRevision opsiyoneldir ve tam sayı olmalıdır', () => {
    expect(playerViewRequestSchema.safeParse({ roomId: 'r' }).success).toBe(true);
    expect(playerViewRequestSchema.parse({ roomId: 'r', sinceRevision: 7 }).sinceRevision).toBe(7);
    expect(playerViewRequestSchema.safeParse({ roomId: 'r', sinceRevision: -1 }).success).toBe(false);
    expect(playerViewRequestSchema.safeParse({ roomId: 'r', sinceRevision: 1.5 }).success).toBe(false);
    expect(playerViewRequestSchema.safeParse({ roomId: 'r', sinceRevision: '3' }).success).toBe(false);
  });

  // D21/C — cue dağıtımı artık "ileri her sürümde" çalıştığı için oyun kimliği
  // de gönderilir: "Yeniden oyna" sonrası eski sürümle yeni oyunun cue'ları
  // eşleşmesin.
  it('sinceGameId opsiyoneldir (D21)', () => {
    expect(playerViewRequestSchema.safeParse({ roomId: 'r' }).success).toBe(true);
    expect(
      playerViewRequestSchema.parse({ roomId: 'r', sinceRevision: 3, sinceGameId: 'g1' })
        .sinceGameId,
    ).toBe('g1');
    expect(playerViewRequestSchema.safeParse({ roomId: 'r', sinceGameId: 5 }).success).toBe(false);
  });
});
