/**
 * D18/B2 — `optionId` atlanınca sunucu artık sessizce ilk seçeneği uygulamaz.
 *
 * Ölçülen eski davranış (RULES-AUDIT B2): oy → "evet", adaylık → ilk uygun
 * oyuncu, veto → kabul.
 *
 * **D21/I** — kural yalnız sunucuda (sözleşmedeki sabit eylem listesi
 * kaldırıldı) ve koşul "gerçek bir seçim var mı": birden çok seçenek VEYA
 * oyuncuyu hedefleyen seçenek → `optionId` zorunlu (tek uygun hedefi kalmış
 * inceleme/infaz dahil). Onaylar ve `policy_peek` etkilenmez.
 *
 * `rawCommand` şemayı atlayarak doğrudan servis yolunu sınar (bozuk/eski
 * istemci ya da başka bir API girişi).
 */

import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, type CommandResponse } from '@secret-table/contracts';

import { ackAllRoles, makeStartedGame, type Harness } from './test-harness';

/** Şemayı atlayarak `optionId` OLMADAN komut gönderir. */
async function submitWithoutOption(
  h: Harness,
  userId: string,
  actionId: string,
): Promise<CommandResponse> {
  const view = await h.view(userId);
  return h.rawCommand(userId, {
    protocolVersion: PROTOCOL_VERSION,
    gameId: view.gameId as string,
    phaseId: view.phaseId,
    commandId: `raw_${actionId}_${userId}`,
    actionId,
  });
}

async function presidentUser(h: Harness): Promise<string> {
  const view = await h.view('u1');
  const playerId =
    view.players.find((p) => p.isPresidentialCandidate)?.playerId ??
    view.players.find((p) => p.office === 'president')?.playerId;
  const user = h.userIds.find((u) => h.playerIdByUser[u] === playerId);
  if (!user) throw new Error('başkan bulunamadı');
  return user;
}

describe('D18/B2 — optionId zorunluluğu', () => {
  it('adaylıkta optionId yoksa INVALID_OPTION; hiçbir oyuncu aday olmaz', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    const president = await presidentUser(h);
    const before = await h.view(president);

    const res = await submitWithoutOption(h, president, 'act_nominate');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('INVALID_OPTION');

    const after = await h.view(president);
    expect(after.revision).toBe(before.revision);
    expect(after.phase).toBe('nomination');
    expect(after.players.some((p) => p.office === 'chancellor')).toBe(false);
  });

  it('oyda optionId yoksa INVALID_OPTION; sessiz "evet" yazılmaz', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    const president = await presidentUser(h);
    const nomination = await h.view(president);
    const action = nomination.actions.find((a) => a.kind === 'nominate');
    expect((await h.submit(president, action!.actionId, action!.options[0]?.optionId)).ok).toBe(true);

    const before = await h.view('u1');
    expect(before.phase).toBe('voting');

    const res = await submitWithoutOption(h, 'u1', 'act_vote');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('INVALID_OPTION');

    const after = await h.view('u1');
    expect(after.revision).toBe(before.revision);
    // Oy kaydedilmemiş: aksiyon hâlâ açık.
    expect(after.actions.some((a) => a.kind === 'vote')).toBe(true);
  });

  it('tek seçenekli onay (act_ack_role) optionId olmadan çalışır', async () => {
    const h = await makeStartedGame(5);
    const before = await h.view('u1');
    expect(before.phase).toBe('role_reveal');

    const res = await submitWithoutOption(h, 'u1', 'act_ack_role');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.revision).toBeGreaterThan(before.revision);
  });

  // D21/I — tek uygun hedef kalsa bile sunucu "kimi vurduğunu" varsaymaz.
  it('tek hedefi kalan infazda optionId yoksa INVALID_OPTION', async () => {
    const saved = process.env.SECRET_TABLE_DEV_TOOLS;
    process.env.SECRET_TABLE_DEV_TOOLS = '1';
    try {
      const h = await makeStartedGame(5);
      await ackAllRoles(h);
      // Host'a infaz yetkisi (dev senaryosu, yalnız host).
      const applied = await h.service.submitLobbyCommand(
        { roomId: h.roomId, userId: 'u1' },
        {
          protocolVersion: PROTOCOL_VERSION,
          commandId: 'exec_now',
          type: 'dev_scenario',
          scenario: 'execution_now',
        },
      );
      expect(applied).toEqual({ ok: true });

      const before = await h.view('u1');
      const power = before.actions.find((a) => a.kind === 'use_power');
      expect(power?.options.length).toBeGreaterThan(0);
      expect(power?.options.every((o) => o.targetPlayerId !== undefined)).toBe(true);

      const res = await submitWithoutOption(h, 'u1', power!.actionId);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('INVALID_OPTION');

      const after = await h.view('u1');
      expect(after.revision).toBe(before.revision);
      expect(after.players.every((p) => p.alive !== false)).toBe(true);
    } finally {
      if (saved === undefined) delete process.env.SECRET_TABLE_DEV_TOOLS;
      else process.env.SECRET_TABLE_DEV_TOOLS = saved;
    }
  });

  // D21/I — `policy_peek` tek ve HEDEFSİZ seçenek: alan atlanabilir.
  it('policy_peek optionId olmadan çalışır', async () => {
    const saved = process.env.SECRET_TABLE_DEV_TOOLS;
    process.env.SECRET_TABLE_DEV_TOOLS = '1';
    try {
      const h = await makeStartedGame(5);
      await ackAllRoles(h);
      expect(
        await h.service.submitLobbyCommand(
          { roomId: h.roomId, userId: 'u1' },
          {
            protocolVersion: PROTOCOL_VERSION,
            commandId: 'peek_now',
            type: 'dev_scenario',
            scenario: 'policy_peek_now',
          },
        ),
      ).toEqual({ ok: true });

      const before = await h.view('u1');
      const power = before.actions.find((a) => a.kind === 'use_power');
      expect(power?.options).toHaveLength(1);
      expect(power?.options[0]?.targetPlayerId).toBeUndefined();

      const res = await submitWithoutOption(h, 'u1', power!.actionId);
      expect(res.ok).toBe(true);
    } finally {
      if (saved === undefined) delete process.env.SECRET_TABLE_DEV_TOOLS;
      else process.env.SECRET_TABLE_DEV_TOOLS = saved;
    }
  });

  it('bilinmeyen optionId hâlâ INVALID_OPTION', async () => {
    const h = await makeStartedGame(5);
    const res = await h.submit('u1', 'act_ack_role', 'yok_boyle_bir_secenek');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('INVALID_OPTION');
  });
});
