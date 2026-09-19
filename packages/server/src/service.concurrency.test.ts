import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '@secret-table/contracts';
import type { GameCommand } from '@secret-table/contracts';

import { ackAllRoles, makeStartedGame } from './test-harness';
import type { Harness } from './test-harness';

async function toVoting(h: Harness): Promise<void> {
  await ackAllRoles(h);
  const presidentPlayerId = (await h.view('u1')).players.find((p) => p.isPresidentialCandidate)
    ?.playerId;
  const nominator = h.userIds.find((u) => h.playerIdByUser[u] === presidentPlayerId) as string;
  const nominateOption = (await h.view(nominator)).actions[0]?.options[0]?.optionId;
  const res = await h.submit(nominator, 'act_nominate', nominateOption);
  if (!res.ok) throw new Error(`nominate reddedildi: ${res.error}`);
}

/** Bir oyuncunun oy zarfını kurar (aynı phaseId/gameId). */
async function voteCommand(h: Harness, userId: string, commandId: string): Promise<GameCommand> {
  const view = await h.view(userId);
  return {
    protocolVersion: PROTOCOL_VERSION,
    gameId: view.gameId as string,
    phaseId: view.phaseId,
    commandId,
    actionId: 'act_vote',
    optionId: 'vote_yes',
  };
}

describe('eşzamanlı oylar', () => {
  it('farklı oyuncuların oyları paralel gelse de hepsi sayılır', async () => {
    const h = await makeStartedGame(7, { seed: 11 });
    await toVoting(h);

    const commands = await Promise.all(
      h.userIds.map((userId, i) => voteCommand(h, userId, `v${i}`)),
    );
    const results = await Promise.all(
      h.userIds.map((userId, i) =>
        h.service.submitCommand({ roomId: h.roomId, userId }, commands[i] as GameCommand),
      ),
    );

    expect(results.every((r) => r.ok)).toBe(true);

    // Herkes oy verdi → seçim çözüldü, yasama aşamasına geçildi.
    const view = await h.view('u1');
    expect(view.phase).toBe('president_discard');
    expect(view.table.lastElection?.votes).toHaveLength(7);
  });

  it('başka oyuncunun oyu, benim oyumun kabulünü geçersizleştirmez', async () => {
    const h = await makeStartedGame(7, { seed: 12 });
    await toVoting(h);

    const first = await h.service.submitCommand(
      { roomId: h.roomId, userId: 'u2' },
      await voteCommand(h, 'u2', 'a'),
    );
    expect(first.ok).toBe(true);

    // u3 oy verir (revision değişir); u2 tekrar oy vermeye çalışırsa ALREADY -> NOT_ALLOWED,
    // ama u4'ün ilk oyu hâlâ kabul edilmeli.
    const other = await h.service.submitCommand(
      { roomId: h.roomId, userId: 'u3' },
      await voteCommand(h, 'u3', 'b'),
    );
    expect(other.ok).toBe(true);

    const u4 = await h.service.submitCommand(
      { roomId: h.roomId, userId: 'u4' },
      await voteCommand(h, 'u4', 'c'),
    );
    expect(u4.ok).toBe(true);
  });
});

describe('tekrar gönderilen komut (idempotency)', () => {
  it('aynı commandId ile tekrar gönderim ikinci etki oluşturmaz', async () => {
    const h = await makeStartedGame(5, { seed: 13 });
    await toVoting(h);

    const cmd = await voteCommand(h, 'u2', 'dup1');
    const first = await h.service.submitCommand({ roomId: h.roomId, userId: 'u2' }, cmd);
    expect(first.ok).toBe(true);
    const revAfterFirst = first.ok ? first.revision : -1;

    const stateAfterFirst = await h.gateway.getGameState(h.roomId);
    const votesAfterFirst =
      stateAfterFirst?.state.phase.kind === 'voting'
        ? Object.keys(stateAfterFirst.state.phase.votes).length
        : -1;

    const replay = await h.service.submitCommand({ roomId: h.roomId, userId: 'u2' }, cmd);
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.revision).toBe(revAfterFirst);

    const stateAfterReplay = await h.gateway.getGameState(h.roomId);
    const votesAfterReplay =
      stateAfterReplay?.state.phase.kind === 'voting'
        ? Object.keys(stateAfterReplay.state.phase.votes).length
        : -1;
    expect(votesAfterReplay).toBe(votesAfterFirst);
  });

  it('aynı commandId farklı içerikle reddedilir', async () => {
    const h = await makeStartedGame(5, { seed: 14 });
    await toVoting(h);

    const yes = await voteCommand(h, 'u2', 'same');
    const first = await h.service.submitCommand({ roomId: h.roomId, userId: 'u2' }, yes);
    expect(first.ok).toBe(true);

    const no: GameCommand = { ...yes, optionId: 'vote_no' };
    const conflict = await h.service.submitCommand({ roomId: h.roomId, userId: 'u2' }, no);
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.error).toBe('NOT_ALLOWED');
  });

  it('eski phaseId ile hamle STALE_ACTION', async () => {
    const h = await makeStartedGame(5, { seed: 15 });
    await ackAllRoles(h);
    const stalePhaseId = (await h.view('u1')).phaseId;

    // Adaylık ile aşama ilerlet.
    const presidentPlayerId = (await h.view('u1')).players.find((p) => p.isPresidentialCandidate)
      ?.playerId;
    const nominator = h.userIds.find((u) => h.playerIdByUser[u] === presidentPlayerId) as string;
    await h.submit(nominator, 'act_nominate', (await h.view(nominator)).actions[0]?.options[0]?.optionId);

    const view = await h.view('u2');
    const stale = await h.service.submitCommand(
      { roomId: h.roomId, userId: 'u2' },
      {
        protocolVersion: PROTOCOL_VERSION,
        gameId: view.gameId as string,
        phaseId: stalePhaseId,
        commandId: 'stale1',
        actionId: 'act_vote',
        optionId: 'vote_yes',
      },
    );
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error).toBe('STALE_ACTION');
  });
});
