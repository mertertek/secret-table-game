/**
 * D18/B4 — cue dağıtımı.
 *
 * Hamle cue'ları eskiden yalnız komut yanıtında, yani YALNIZ hamleyi yapana
 * gidiyordu (`getView` her zaman `cues: []`). Artık son uygulanan komutun
 * olayları durum satırıyla birlikte saklanır ve `getView({ sinceRevision })`
 * istemci TAM bir sonraki sürümü istiyorsa cue'ları ALICIYA GÖRE süzülü verir.
 *
 * Burada doğrulanan sözleşme:
 *  1. ardışık sürümde cue döner (hamleyi yapmayan oyuncuya da),
 *  2. D21/C — elimizdekinden İLERİ her sürümde son komutun cue'ları; `sinceRevision`
 *     yokken, sürüm elimizdeyken ya da `sinceGameId` başka oyunu gösterirken boş,
 *  3. `resync` istendiğinde boş,
 *  4. alıcı süzmesi (kapalı el yalnız sahibine),
 *  5. `cueId` deterministik ve idempotent (komut yanıtı ile görünüm aynı kimliği verir).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, type DevScenarioName, type SceneCue } from '@secret-table/contracts';

import { ackAllRoles, actFirst, makeStartedGame, type Harness } from './test-harness';

async function cuesFor(
  h: Harness,
  userId: string,
  options: { resync?: boolean; sinceRevision?: number; sinceGameId?: string },
): Promise<readonly SceneCue[]> {
  const res = await h.service.getView({ roomId: h.roomId, userId }, options);
  if (!res.ok) throw new Error(`getView başarısız: ${res.error}`);
  return res.response.cues;
}

/** Aday belirlenmiş, son oy HARİÇ herkes "evet" demiş masaya getirir. */
async function upToLastVote(h: Harness): Promise<{
  lastVoter: string;
  presidentUser: string;
  revisionBefore: number;
}> {
  await ackAllRoles(h);
  const nomination = await h.view('u1');
  const presidentId =
    nomination.players.find((p) => p.isPresidentialCandidate)?.playerId ??
    nomination.players.find((p) => p.office === 'president')?.playerId;
  const presidentUser = h.userIds.find((u) => h.playerIdByUser[u] === presidentId);
  if (!presidentUser) throw new Error('başkan bulunamadı');
  await actFirst(h, presidentUser);

  const voters = [...h.userIds];
  const lastVoter = voters.pop() as string;
  for (const userId of voters) {
    const res = await h.submit(userId, 'act_vote', 'vote_yes');
    if (!res.ok) throw new Error(`oy reddedildi: ${res.error}`);
  }
  const before = await h.view(lastVoter);
  return { lastVoter, presidentUser, revisionBefore: before.revision };
}

describe('D18/B4 — getView cue dağıtımı', () => {
  it('ardışık sürümde cue döner; hamleyi YAPMAYAN oyuncu da oy açılışını görür', async () => {
    const h = await makeStartedGame(5);
    const { lastVoter, revisionBefore } = await upToLastVote(h);

    const final = await h.submit(lastVoter, 'act_vote', 'vote_yes');
    expect(final.ok).toBe(true);
    if (!final.ok) return;

    // Hamleyi yapmayan bir oyuncu (oy açılışını eskiden HİÇ görmüyordu).
    const observer = h.userIds.find((u) => u !== lastVoter) as string;
    const cues = await cuesFor(h, observer, { sinceRevision: revisionBefore });

    expect(cues.length).toBeGreaterThan(0);
    expect(cues.map((c) => c.kind)).toContain('votes_revealed');
    expect(cues.every((c) => c.revision === final.revision)).toBe(true);
  });

  // D21/C — koşul artık "TAM bir sonraki sürüm" değil, "elimizdekinden İLERİ
  // herhangi bir sürüm": iki sürüm geride kalan istemci de EN YENİ sürümün
  // cue'larını alır (sahne zaten yalnız güncel sürümü oynatır). Sürümü elinde
  // olan ya da alanı hiç göndermeyen istemciye cue gitmez.
  it('geride kalan istemciye EN YENİ sürümün cue\'ları gider; elinde olana gitmez', async () => {
    const h = await makeStartedGame(5);
    const { lastVoter, revisionBefore } = await upToLastVote(h);
    const final = await h.submit(lastVoter, 'act_vote', 'vote_yes');
    expect(final.ok).toBe(true);

    const observer = h.userIds.find((u) => u !== lastVoter) as string;
    // İki sürüm geride: D18'de boş dönüyordu, artık son sürümün cue'ları gelir.
    const behind = await cuesFor(h, observer, { sinceRevision: revisionBefore - 1 });
    expect(behind.map((c) => c.kind)).toContain('votes_revealed');
    // Bir sürüm geride: yine gelir.
    expect(
      (await cuesFor(h, observer, { sinceRevision: revisionBefore })).map((c) => c.kind),
    ).toContain('votes_revealed');
    // Sürümü zaten elinde olan istemci: aynı cue ikinci kez gelmez.
    expect(await cuesFor(h, observer, { sinceRevision: revisionBefore + 1 })).toEqual([]);
    // Alanı hiç göndermeyen (eski) istemci: eski davranış.
    expect(await cuesFor(h, observer, {})).toEqual([]);
  });

  // D21/C — oyun kimliği eşleşmezse cue gitmez ("Yeniden oyna" sürüm sayacını
  // sürdürdüğü için eski sürüm yeni oyunun cue'larını açmamalı).
  it('sinceGameId başka bir oyunu gösteriyorsa cue gönderilmez', async () => {
    const h = await makeStartedGame(5);
    const { lastVoter, revisionBefore } = await upToLastVote(h);
    expect((await h.submit(lastVoter, 'act_vote', 'vote_yes')).ok).toBe(true);

    const observer = h.userIds.find((u) => u !== lastVoter) as string;
    const view = await h.view(observer);
    expect(
      await cuesFor(h, observer, { sinceRevision: revisionBefore, sinceGameId: 'baska-oyun' }),
    ).toEqual([]);
    expect(
      (await cuesFor(h, observer, { sinceRevision: revisionBefore, sinceGameId: view.gameId ?? undefined }))
        .length,
    ).toBeGreaterThan(0);
  });

  it('resync istendiğinde cue gönderilmez', async () => {
    const h = await makeStartedGame(5);
    const { lastVoter, revisionBefore } = await upToLastVote(h);
    expect((await h.submit(lastVoter, 'act_vote', 'vote_yes')).ok).toBe(true);

    const observer = h.userIds.find((u) => u !== lastVoter) as string;
    expect(await cuesFor(h, observer, { resync: true, sinceRevision: revisionBefore })).toEqual([]);
  });

  it('alıcı süzmesi: kapalı el cue\'su yalnız başkana gider', async () => {
    const h = await makeStartedGame(5);
    const { lastVoter, presidentUser, revisionBefore } = await upToLastVote(h);
    expect((await h.submit(lastVoter, 'act_vote', 'vote_yes')).ok).toBe(true);

    const presidentCues = await cuesFor(h, presidentUser, { sinceRevision: revisionBefore });
    expect(presidentCues.map((c) => c.kind)).toContain('cards_dealt');

    for (const userId of h.userIds.filter((u) => u !== presidentUser)) {
      const cues = await cuesFor(h, userId, { sinceRevision: revisionBefore });
      expect(cues.map((c) => c.kind)).not.toContain('cards_dealt');
      // Kapalı kart HAREKETİ herkese açıktır (adet + uçlar, tür yok).
      expect(cues.map((c) => c.kind)).toContain('cards_moved');
    }
  });

  it('cueId deterministik: komut yanıtı ile görünüm aynı kimlikleri verir (tek oynatma)', async () => {
    const h = await makeStartedGame(5);
    const { lastVoter, revisionBefore } = await upToLastVote(h);
    const final = await h.submit(lastVoter, 'act_vote', 'vote_yes');
    expect(final.ok).toBe(true);
    if (!final.ok) return;

    // Hamleyi YAPAN oyuncu cue'ları hem yanıttan hem görünümden alır; kimlikler
    // aynı olduğu için sahnenin dedupe'u ikinci kez oynatmaz.
    const fromView = await cuesFor(h, lastVoter, { sinceRevision: revisionBefore });
    expect(fromView.map((c) => c.cueId)).toEqual(final.cues.map((c) => c.cueId));

    // Aynı istek iki kez: yan etki yok, kimlikler değişmez (idempotent).
    const again = await cuesFor(h, lastVoter, { sinceRevision: revisionBefore });
    expect(again.map((c) => c.cueId)).toEqual(fromView.map((c) => c.cueId));
    expect(fromView.every((c) => c.cueId.startsWith(`${final.view.gameId}:${final.revision}:`))).toBe(
      true,
    );
  });

  it('yeni oyunda (play_again) önceki oyunun olayları taşınmaz', async () => {
    const h = await makeStartedGame(5);
    const { lastVoter } = await upToLastVote(h);
    expect((await h.submit(lastVoter, 'act_vote', 'vote_yes')).ok).toBe(true);
    const record = await h.gateway.getGameState(h.roomId);
    expect(record?.lastEvents?.length).toBeGreaterThan(0);

    await h.gateway.startGame({
      roomId: h.roomId,
      gameId: 'g_new',
      state: record!.state,
      now: new Date(h.clock.ms).toISOString(),
    });
    const after = await h.gateway.getGameState(h.roomId);
    expect(after?.lastEvents).toBeNull();
  });
});

describe('D18/B4 — infaz cue\'su kurbana ve seyirciye ulaşır', () => {
  const ENV_KEY = 'SECRET_TABLE_DEV_TOOLS';
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedEnv = process.env[ENV_KEY];
    process.env[ENV_KEY] = '1';
  });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = savedEnv;
  });

  const scenario: DevScenarioName = 'execution_now';

  it('player_eliminated cue vurulan oyuncuya ve üçüncü oyuncuya döner', async () => {
    const h = await makeStartedGame(5);
    await ackAllRoles(h);

    const setup = await h.service.submitLobbyCommand(
      { roomId: h.roomId, userId: 'u1' },
      { protocolVersion: PROTOCOL_VERSION, commandId: 'dev_exec', type: 'dev_scenario', scenario },
    );
    expect(setup).toEqual({ ok: true });

    const view = await h.view('u1');
    const president =
      view.players.find((p) => p.isPresidentialCandidate)?.playerId ??
      view.players.find((p) => p.office === 'president')?.playerId;
    const presidentUser = h.userIds.find((u) => h.playerIdByUser[u] === president) as string;
    const ready = await h.view(presidentUser);
    const power = ready.actions.find((a) => a.kind === 'use_power');
    const target = power?.options[0];
    expect(target?.targetPlayerId).toBeTruthy();
    const victimUser = h.userIds.find(
      (u) => h.playerIdByUser[u] === target?.targetPlayerId,
    ) as string;
    const revisionBefore = ready.revision;

    const fired = await h.submit(presidentUser, power!.actionId, target!.optionId);
    expect(fired.ok).toBe(true);

    for (const userId of h.userIds) {
      const cues = await cuesFor(h, userId, { sinceRevision: revisionBefore });
      expect(cues.map((c) => c.kind)).toContain('player_eliminated');
    }
    // Kurban kendi ölümünün cue'sunu görür (D18 madde 2: vinyet + "VURULDUN").
    const victimCues = await cuesFor(h, victimUser, { sinceRevision: revisionBefore });
    expect(
      victimCues.some(
        (c) => c.kind === 'player_eliminated' && c.playerId === h.playerIdByUser[victimUser],
      ),
    ).toBe(true);
  });
});
