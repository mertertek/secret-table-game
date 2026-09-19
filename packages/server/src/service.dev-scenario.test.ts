/**
 * D14 — `dev_scenario` lobi komutunun sunucu kapısı ve kayıt yolu.
 *
 * Kapı: `SECRET_TABLE_DEV_TOOLS === '1'`. Kapalıyken yanıt bilinmeyen/izinsiz
 * komutla aynıdır (`NOT_ALLOWED`), yani üretimde komutun varlığı sızmaz.
 *
 * D21/K — ikinci kapı: env açıkken bile YALNIZ oda hostu senaryo uygulayabilir.
 * Senaryolar yetkiyi (ve `policy_peek_now` ile deste tepesini) GÖNDERENE
 * verdiği için host olmayan bir oyuncu masayı kendi lehine kuramaz. Bu yüzden
 * bu dosyadaki senaryolar host (`u1`) tarafından gönderilir.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, type DevScenarioName } from '@secret-table/contracts';

import { ackAllRoles, makeStartedGame, type Harness } from './test-harness';

const ENV_KEY = 'SECRET_TABLE_DEV_TOOLS';
let savedEnv: string | undefined;

beforeEach(() => {
  savedEnv = process.env[ENV_KEY];
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedEnv;
});

function sendScenario(
  h: Harness,
  userId: string,
  scenario: DevScenarioName,
  commandId = `dev_${scenario}`,
) {
  return h.service.submitLobbyCommand(
    { roomId: h.roomId, userId },
    { protocolVersion: PROTOCOL_VERSION, commandId, type: 'dev_scenario', scenario },
  );
}

describe('dev_scenario — ortam kapısı', () => {
  it('SECRET_TABLE_DEV_TOOLS yokken NOT_ALLOWED', async () => {
    delete process.env[ENV_KEY];
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    const before = await h.view('u1');

    expect(await sendScenario(h, 'u1', 'execution_now')).toEqual({
      ok: false,
      error: 'NOT_ALLOWED',
    });

    const after = await h.view('u1');
    expect(after.revision).toBe(before.revision);
    expect(after.phase).toBe(before.phase);
  });

  it('değer "1" değilse (örn. "0") yine NOT_ALLOWED', async () => {
    process.env[ENV_KEY] = '0';
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'execution_round')).toEqual({
      ok: false,
      error: 'NOT_ALLOWED',
    });
  });

  // D21/K
  it('env açık olsa bile host OLMAYAN oyuncu senaryo uygulayamaz', async () => {
    process.env[ENV_KEY] = '1';
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    const before = await h.view('u2');

    expect(await sendScenario(h, 'u2', 'policy_peek_now')).toEqual({
      ok: false,
      error: 'NOT_ALLOWED',
    });

    const after = await h.view('u2');
    expect(after.revision).toBe(before.revision);
    expect(after.phase).toBe(before.phase);
    // Host aynı senaryoyu uygulayabilir (kapı yalnız host dışını kapatır).
    expect(await sendScenario(h, 'u1', 'policy_peek_now')).toEqual({ ok: true });
  });
});

describe('dev_scenario — açıkken sonuç', () => {
  beforeEach(() => {
    process.env[ENV_KEY] = '1';
  });

  it('execution_now: yürütme fazı, yetki gönderende, revision artar', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    const before = await h.view('u1');

    expect(await sendScenario(h, 'u1', 'execution_now')).toEqual({ ok: true });

    const view = await h.view('u1');
    expect(view.phase).toBe('executive_action');
    expect(view.table.currentPower).toEqual({
      power: 'execution',
      actorId: h.playerIdByUser.u1,
      targetId: null,
    });
    expect(view.table.fascistPolicies).toBe(4);
    expect(view.revision).toBe(before.revision + 1);
    // Yetki yalnız gönderende: başka oyuncunun eylemi yok.
    const other = await h.view('u2');
    expect(other.actions).toHaveLength(0);
  });

  it('execution_now → act_use_power hedefi öldürür ve player_eliminated cue üretir', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'execution_now')).toEqual({ ok: true });

    const view = await h.view('u1');
    const action = view.actions.find((a) => a.kind === 'use_power');
    expect(action).toBeDefined();
    const option = action?.options[0];
    expect(option?.targetPlayerId).toBeDefined();

    const res = await h.submit('u1', action?.actionId as string, option?.optionId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.cues.some((c) => c.kind === 'player_eliminated')).toBe(true);

    const target = option?.targetPlayerId as string;
    const after = await h.view('u1');
    expect(after.players.find((p) => p.playerId === target)?.alive).toBe(false);
  });

  it('execution_round: aday belirleme fazı, başkan gönderen', async () => {
    const h = await makeStartedGame(7);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'execution_round')).toEqual({ ok: true });

    const view = await h.view('u1');
    expect(view.phase).toBe('nomination');
    expect(view.table.fascistPolicies).toBe(3);
    expect(view.players.find((p) => p.isPresidentialCandidate)?.playerId).toBe(
      h.playerIdByUser.u1,
    );
    expect(view.actions.some((a) => a.kind === 'nominate')).toBe(true);
  });

  it('aynı commandId iki kez uygulanmaz (idempotent)', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'execution_now', 'same')).toEqual({ ok: true });
    const first = await h.view('u1');
    expect(await sendScenario(h, 'u1', 'execution_now', 'same')).toEqual({ ok: true });
    const second = await h.view('u1');
    expect(second.revision).toBe(first.revision);
  });

  it('aynı commandId farklı senaryoyla NOT_ALLOWED', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'execution_now', 'dup')).toEqual({ ok: true });
    expect(await sendScenario(h, 'u1', 'execution_round', 'dup')).toEqual({
      ok: false,
      error: 'NOT_ALLOWED',
    });
  });

  it('üye olmayan gönderemez (SESSION_INVALID)', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'yabanci', 'execution_now')).toEqual({
      ok: false,
      error: 'SESSION_INVALID',
    });
  });

  // -------------------------------------------------------------------------
  // D19 — yetki / veto / Hitler bölgesi / kaos senaryoları uçtan uca
  // -------------------------------------------------------------------------

  it('investigate_now (7 kişi): inceleme yetkisi gönderende, sonuç YALNIZ ona', async () => {
    const h = await makeStartedGame(7);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'investigate_now')).toEqual({ ok: true });

    const view = await h.view('u1');
    expect(view.phase).toBe('executive_action');
    expect(view.table.currentPower?.power).toBe('investigate_loyalty');
    expect(view.table.fascistPolicies).toBe(2);

    const action = view.actions.find((a) => a.kind === 'use_power');
    const option = action?.options[0];
    const target = option?.targetPlayerId as string;
    const res = await h.submit('u1', action?.actionId as string, option?.optionId);
    expect(res.ok).toBe(true);

    const mine = await h.view('u1');
    expect(mine.privateView.inspection?.kind).toBe('party_membership');
    // Başka oyuncu sonucu GÖRMEZ.
    const other = await h.view('u3');
    expect(other.privateView.inspection).toBeNull();
    expect(JSON.stringify(other)).not.toContain('party_membership');
    expect(target.length).toBeGreaterThan(0);
  });

  it('aynı oyuncu iki kez incelenemez: ikinci turda hedef listesinde YOK', async () => {
    const h = await makeStartedGame(9);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'investigate_now', 'i1')).toEqual({ ok: true });
    let view = await h.view('u1');
    let action = view.actions.find((a) => a.kind === 'use_power');
    const first = action?.options[0];
    const investigated = first?.targetPlayerId as string;
    await h.submit('u1', action?.actionId as string, first?.optionId);
    // Başkan özel sonucu onaylar.
    view = await h.view('u1');
    const ack = view.actions.find((a) => a.kind === 'ack_private_result');
    await h.submit('u1', ack?.actionId as string, ack?.options[0]?.optionId);

    // İkinci inceleme turu BAŞKA başkanda.
    expect(await sendScenario(h, 'u1', 'investigate_now', 'i2')).toEqual({ ok: true });
    view = await h.view('u1');
    action = view.actions.find((a) => a.kind === 'use_power');
    const targets = (action?.options ?? []).map((o) => o.targetPlayerId);
    expect(targets).not.toContain(investigated);
  });

  it('special_election_now (7 kişi): hedef sonraki başkan olur', async () => {
    const h = await makeStartedGame(7);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'special_election_now')).toEqual({ ok: true });

    const view = await h.view('u1');
    expect(view.table.currentPower?.power).toBe('call_special_election');
    const action = view.actions.find((a) => a.kind === 'use_power');
    const option = action?.options[0];
    const target = option?.targetPlayerId as string;
    expect(await h.submit('u1', action?.actionId as string, option?.optionId)).toMatchObject({
      ok: true,
    });

    const after = await h.view('u1');
    expect(after.phase).toBe('nomination');
    expect(after.players.find((p) => p.isPresidentialCandidate)?.playerId).toBe(target);
  });

  it('policy_peek_now (5 kişi): 3 kart yalnız başkanda; 7 kişide INVALID_OPTION', async () => {
    const small = await makeStartedGame(5);
    await ackAllRoles(small);
    expect(await sendScenario(small, 'u1', 'policy_peek_now')).toEqual({ ok: true });
    const view = await small.view('u1');
    expect(view.table.currentPower?.power).toBe('policy_peek');
    const action = view.actions.find((a) => a.kind === 'use_power');
    await small.submit('u1', action?.actionId as string, action?.options[0]?.optionId);
    const mine = await small.view('u1');
    expect(mine.privateView.inspection?.kind).toBe('policy_peek');
    expect(
      mine.privateView.inspection?.kind === 'policy_peek'
        ? mine.privateView.inspection.upcoming
        : null,
    ).toHaveLength(3);
    const other = await small.view('u2');
    expect(other.privateView.inspection).toBeNull();

    // Bu yetki 7+ kişilik düzende yok → anlaşılır ret.
    const big = await makeStartedGame(7);
    await ackAllRoles(big);
    expect(await sendScenario(big, 'u1', 'policy_peek_now')).toEqual({
      ok: false,
      error: 'INVALID_OPTION',
    });
  });

  it('investigate_now 5 kişide INVALID_OPTION (o düzende yetki yok)', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'investigate_now')).toEqual({
      ok: false,
      error: 'INVALID_OPTION',
    });
  });

  it('veto_round: gönderen ŞANSÖLYE, veto isteği açık, kartlar yalnız ona', async () => {
    const h = await makeStartedGame(7);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'veto_round')).toEqual({ ok: true });

    const view = await h.view('u1');
    expect(view.phase).toBe('chancellor_choice');
    expect(view.table.fascistPolicies).toBe(5);
    expect(view.players.find((p) => p.office === 'chancellor')?.playerId).toBe(
      h.playerIdByUser.u1,
    );
    expect(view.privateView.hand).toHaveLength(2);
    expect(view.actions.some((a) => a.kind === 'request_veto')).toBe(true);
    // Başkan (başka oyuncu) eli GÖRMEZ.
    const presidentId = view.players.find((p) => p.office === 'president')?.playerId;
    const presidentUser = Object.keys(h.playerIdByUser).find(
      (u) => h.playerIdByUser[u] === presidentId,
    ) as string;
    const pres = await h.view(presidentUser);
    expect(pres.privateView.hand).toHaveLength(0);

    // Veto isteği → başkanın yanıtı bekleniyor.
    const req = view.actions.find((a) => a.kind === 'request_veto');
    expect(await h.submit('u1', req?.actionId as string, req?.options[0]?.optionId)).toMatchObject({
      ok: true,
    });
    const afterReq = await h.view(presidentUser);
    expect(afterReq.phase).toBe('veto_response');
    const respond = afterReq.actions.find((a) => a.kind === 'respond_veto');
    expect((respond?.options ?? []).map((o) => o.optionId)).toEqual([
      'veto_accept',
      'veto_reject',
    ]);
  });

  it('veto_round_president: gönderen BAŞKAN, kabul → sayaç +1 ve tur kapanır', async () => {
    const h = await makeStartedGame(7);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'veto_round_president')).toEqual({ ok: true });

    const view = await h.view('u1');
    expect(view.phase).toBe('veto_response');
    const respond = view.actions.find((a) => a.kind === 'respond_veto');
    const accept = respond?.options.find((o) => o.optionId === 'veto_accept');
    expect(await h.submit('u1', respond?.actionId as string, accept?.optionId)).toMatchObject({
      ok: true,
    });

    const after = await h.view('u1');
    expect(after.phase).toBe('nomination');
    expect(after.table.electionTracker).toBe(1);
    expect(after.table.fascistPolicies).toBe(5);
  });

  it('veto_round_president: ret → şansölye yeniden karar verir, sayaç 0', async () => {
    const h = await makeStartedGame(7);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'veto_round_president')).toEqual({ ok: true });
    const view = await h.view('u1');
    const respond = view.actions.find((a) => a.kind === 'respond_veto');
    const reject = respond?.options.find((o) => o.optionId === 'veto_reject');
    await h.submit('u1', respond?.actionId as string, reject?.optionId);

    const after = await h.view('u1');
    expect(after.phase).toBe('chancellor_choice');
    expect(after.table.electionTracker).toBe(0);
  });

  it('hitler_zone_round: 3 faşist kanun, gönderen başkan, aday belirleme', async () => {
    const h = await makeStartedGame(7);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'hitler_zone_round')).toEqual({ ok: true });

    const view = await h.view('u1');
    expect(view.phase).toBe('nomination');
    expect(view.table.fascistPolicies).toBe(3);
    expect(view.players.find((p) => p.isPresidentialCandidate)?.playerId).toBe(
      h.playerIdByUser.u1,
    );
    // Tur kısıtı yok: gönderen dışındaki tüm hayatta oyuncular aday olabilir.
    const nominate = view.actions.find((a) => a.kind === 'nominate');
    expect(nominate?.options).toHaveLength(6);
  });

  it('chaos_round: sayaç 2, üçüncü ret kaos politikası koyar ve sınırları sıfırlar', async () => {
    const h = await makeStartedGame(7);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'chaos_round')).toEqual({ ok: true });

    let view = await h.view('u1');
    expect(view.phase).toBe('nomination');
    expect(view.table.electionTracker).toBe(2);
    const boardBefore = view.table.fascistPolicies + view.table.liberalPolicies;

    const nominate = view.actions.find((a) => a.kind === 'nominate');
    const option = nominate?.options[0];
    await h.submit('u1', nominate?.actionId as string, option?.optionId);

    // Herkes HAYIR: sayaç 3 → kaos.
    view = await h.view('u1');
    expect(view.phase).toBe('voting');
    for (const user of Object.keys(h.playerIdByUser)) {
      const own = await h.view(user);
      const vote = own.actions.find((a) => a.kind === 'vote');
      if (!vote) continue;
      const no = vote.options.find((o) => o.vote === 'no');
      await h.submit(user, vote.actionId, no?.optionId);
    }

    const after = await h.view('u1');
    expect(after.table.electionTracker).toBe(0);
    expect(after.table.fascistPolicies + after.table.liberalPolicies).toBe(boardBefore + 1);
    // Kaos politikası yetki AÇMAZ.
    expect(after.phase).toBe('nomination');
    expect(after.table.currentPower).toBeNull();
  });

  it('bitmiş oyunda reddedilir', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);
    expect(await sendScenario(h, 'u1', 'execution_now', 'c1')).toEqual({ ok: true });
    // Hitler'i bulup infaz et: oyun biter.
    const state = await h.gateway.getGameState(h.roomId);
    const hitler = state?.state.players.find((p) => p.role === 'hitler');
    const view = await h.view('u1');
    const action = view.actions.find((a) => a.kind === 'use_power');
    const option = action?.options.find((o) => o.targetPlayerId === hitler?.playerId);
    if (option) {
      await h.submit('u1', action?.actionId as string, option.optionId);
      const ended = await h.view('u1');
      expect(ended.phase).toBe('game_over');
      const res = await sendScenario(h, 'u1', 'execution_now', 'c2');
      expect(res.ok).toBe(false);
    }
  });
});
