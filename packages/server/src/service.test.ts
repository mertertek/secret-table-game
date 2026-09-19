import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '@secret-table/contracts';

import { InMemoryGateway } from './memory-gateway';
import { GameService } from './service';
import { ackAllRoles, makeStartedGame } from './test-harness';

describe('oda yaşam döngüsü', () => {
  it('oda aç, katıl, başlat', async () => {
    const h = await makeStartedGame(5);
    const view = await h.view('u1');
    expect(view.phase).toBe('role_reveal');
    expect(view.players).toHaveLength(5);
    expect(view.gameId).not.toBeNull();
  });

  it('geçersiz davet kodu ROOM_NOT_FOUND', async () => {
    const service = new GameService(new InMemoryGateway());
    const res = await service.joinRoom({ inviteCode: 'NOPE00', userId: 'x', displayName: 'X' });
    expect(res).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('başlamış oyuna katılım GAME_ALREADY_STARTED', async () => {
    const h = await makeStartedGame(5);
    const room = await h.gateway.getRoom(h.roomId);
    const res = await h.service.joinRoom({
      inviteCode: room?.inviteCode as string,
      userId: 'late',
      displayName: 'Geç',
    });
    expect(res).toEqual({ ok: false, error: 'GAME_ALREADY_STARTED' });
  });

  it('dolu oda ROOM_FULL', async () => {
    const gateway = new InMemoryGateway();
    let idc = 0;
    const service = new GameService(gateway, { newId: () => `id${(idc += 1)}`, newInviteCode: () => 'FULL01' });
    const { inviteCode } = await service.createRoom({ userId: 'h', displayName: 'H' });
    for (let i = 0; i < 9; i += 1) {
      const r = await service.joinRoom({ inviteCode, userId: `p${i}`, displayName: `P${i}` });
      expect(r.ok).toBe(true);
    }
    const full = await service.joinRoom({ inviteCode, userId: 'over', displayName: 'Over' });
    expect(full).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('üye olmayan hamle gönderemez', async () => {
    const h = await makeStartedGame(5);
    const res = await h.service.submitCommand(
      { roomId: h.roomId, userId: 'stranger' },
      {
        protocolVersion: PROTOCOL_VERSION,
        gameId: 'x',
        phaseId: 'x',
        commandId: 'c',
        actionId: 'act_ack_role',
      },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('SESSION_INVALID');
  });

  it('protokol sürümü uyuşmazlığı VERSION_MISMATCH', async () => {
    const h = await makeStartedGame(5);
    const res = await h.service.submitCommand(
      { roomId: h.roomId, userId: 'u1' },
      {
        protocolVersion: 2 as typeof PROTOCOL_VERSION,
        gameId: 'x',
        phaseId: 'x',
        commandId: 'c',
        actionId: 'act_ack_role',
      },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('VERSION_MISMATCH');
  });
});

describe('gizli bilgi doğru oyuncuya gider', () => {
  it('her oyuncu yalnız kendi rolünü görür; herkese açık oyuncu nesnesinde rol yok', async () => {
    const h = await makeStartedGame(7);
    const stateRecord = await h.gateway.getGameState(h.roomId);
    const engineRoles = new Map(
      stateRecord?.state.players.map((p) => [p.playerId, p.role]) ?? [],
    );

    for (const userId of h.userIds) {
      const view = await h.view(userId);
      const myPlayerId = h.playerIdByUser[userId] as string;
      expect(view.privateView.role).toBe(engineRoles.get(myPlayerId));
      for (const player of view.players) {
        expect(Object.keys(player)).not.toContain('role');
        expect(Object.keys(player)).not.toContain('party');
      }
    }
  });

  it('faşistler takımı bilir, liberaller kimseyi bilmez (7 kişi Hitler faşistleri bilmez)', async () => {
    const h = await makeStartedGame(7);
    const stateRecord = await h.gateway.getGameState(h.roomId);
    const roleByPlayer = new Map(stateRecord?.state.players.map((p) => [p.playerId, p.role]) ?? []);

    for (const userId of h.userIds) {
      const view = await h.view(userId);
      const myPlayerId = h.playerIdByUser[userId] as string;
      const myRole = roleByPlayer.get(myPlayerId);

      if (myRole === 'fascist') {
        // Diğer faşistleri ve Hitler'i bilir.
        const knownIds = new Set(view.privateView.knownPlayers.map((k) => k.playerId));
        const expected = [...roleByPlayer.entries()]
          .filter(([pid, role]) => pid !== myPlayerId && (role === 'fascist' || role === 'hitler'))
          .map(([pid]) => pid);
        for (const pid of expected) expect(knownIds.has(pid)).toBe(true);
      } else if (myRole === 'liberal') {
        expect(view.privateView.knownPlayers).toHaveLength(0);
      } else {
        // 7 kişide Hitler faşistleri bilmez.
        expect(view.privateView.knownPlayers).toHaveLength(0);
      }
    }
  });

  it('5 kişide Hitler faşisti bilir', async () => {
    const h = await makeStartedGame(5);
    const stateRecord = await h.gateway.getGameState(h.roomId);
    const hitler = stateRecord?.state.players.find((p) => p.role === 'hitler');
    const hitlerUser = h.userIds.find((u) => h.playerIdByUser[u] === hitler?.playerId) as string;
    const view = await h.view(hitlerUser);
    expect(view.privateView.knownPlayers.length).toBe(1);
    expect(view.privateView.knownPlayers[0]?.source).toBe('hitler_knows_fascists');
  });

  it('yasama elini yalnız ilgili oyuncu görür; cards_dealt cue yalnız alıcıya', async () => {
    const h = await makeStartedGame(5, { seed: 7 });
    await ackAllRoles(h);

    // Adaylık + oy → yasama.
    const nominator = await presidentUser(h);
    const chancellorOption = (await h.view(nominator)).actions[0]?.options[0];
    await h.submit(nominator, 'act_nominate', chancellorOption?.optionId);
    for (const userId of h.userIds) {
      const v = await h.view(userId);
      if (v.actions.some((a) => a.kind === 'vote')) {
        await h.submit(userId, 'act_vote', 'vote_yes');
      }
    }

    const president = await presidentUser(h);
    for (const userId of h.userIds) {
      const view = await h.view(userId);
      if (userId === president) {
        expect(view.privateView.hand.length).toBe(3);
      } else {
        expect(view.privateView.hand).toHaveLength(0);
      }
    }

    // Başkan atma komutu yanıtında cards_dealt cue şansölyeye gider; başkanın kendi
    // yanıtında değil. Burada başkanın discard yanıtındaki cue'ları kontrol ediyoruz.
    const pView = await h.view(president);
    const discard = pView.actions.find((a) => a.kind === 'discard_policy');
    const res = await h.submit(president, 'act_discard', discard?.options[0]?.optionId);
    expect(res.ok).toBe(true);
    if (res.ok) {
      // Başkanın kendi yanıtında şansölyeye ait cards_dealt cue OLMAMALI.
      expect(res.cues.some((c) => c.kind === 'cards_dealt')).toBe(false);
    }
  });
});

describe('yeniden bağlanma / duraklama', () => {
  it('gerekli oyuncu zaman aşımına uğrayınca paused; heartbeat ile açılır', async () => {
    const h = await makeStartedGame(5, { seed: 3 });
    await ackAllRoles(h);
    const president = await presidentUser(h);

    // Başkan dışı bir oyuncu değil — duraklama gereken oyuncuya bağlı: başkan.
    // Başkanın heartbeat'ini kesip zamanı ilerlet.
    h.advance(601);
    // Diğerleri heartbeat atsın (başkan hariç).
    for (const userId of h.userIds) {
      if (userId !== president) await h.service.heartbeat({ roomId: h.roomId, userId });
    }

    const observer = h.userIds.find((u) => u !== president) as string;
    const view = await h.view(observer);
    expect(view.paused).not.toBeNull();
    expect(view.paused?.reason).toBe('player_offline');
    expect(view.paused?.waitingForPlayerIds).toContain(h.playerIdByUser[president]);

    await h.service.heartbeat({ roomId: h.roomId, userId: president });
    const after = await h.view(observer);
    expect(after.paused).toBeNull();
  });

  it('claimControl oturum neslini artırır', async () => {
    const h = await makeStartedGame(5);
    const first = await h.service.claimControl({ roomId: h.roomId, userId: 'u2' });
    const second = await h.service.claimControl({ roomId: h.roomId, userId: 'u2' });
    expect(second.sessionGeneration).toBe(first.sessionGeneration + 1);
  });
});

describe('uçtan uca tam oyun (servis üzerinden)', () => {
  it('5 kişilik oyun servis çağrılarıyla biter', async () => {
    const h = await makeStartedGame(5, { seed: 20 });

    let guard = 0;
    while (guard < 300) {
      guard += 1;
      const anyView = await h.view('u1');
      if (anyView.phase === 'game_over') break;

      let actedThisRound = false;
      for (const userId of h.userIds) {
        const view = await h.view(userId);
        if (view.phase === 'game_over') break;
        const action = view.actions[0];
        if (!action) continue;
        // Yasama: faşist tercih et ki oyun ilerlesin; ack/nominate/vote ilk seçenek.
        const option =
          action.kind === 'enact_policy' || action.kind === 'discard_policy'
            ? (action.options.find((o) => o.labelKey === 'policy.fascist') ?? action.options[0])
            : action.options[0];
        const res = await h.submit(userId, action.actionId, option?.optionId);
        expect(res.ok).toBe(true);
        actedThisRound = true;
      }
      if (!actedThisRound) throw new Error(`kimse hareket edemedi (aşama ${anyView.phase})`);
    }

    const final = await h.view('u1');
    expect(final.phase).toBe('game_over');
    expect(final.result).not.toBeNull();
    expect(['liberal', 'fascist']).toContain(final.result?.winner);
    // Oyun sonu: roller açıklanır.
    expect(final.result?.revealedRoles).toHaveLength(5);
  });
});

async function presidentUser(h: Awaited<ReturnType<typeof makeStartedGame>>): Promise<string> {
  const view = await h.view('u1');
  const presidentPlayerId =
    view.players.find((p) => p.isPresidentialCandidate)?.playerId ??
    view.players.find((p) => p.office === 'president')?.playerId;
  const user = h.userIds.find((u) => h.playerIdByUser[u] === presidentPlayerId);
  if (!user) throw new Error('başkan bulunamadı');
  return user;
}
