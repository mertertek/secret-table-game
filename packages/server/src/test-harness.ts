/**
 * Yalnız testler için kurulum yardımcıları (InMemoryGateway + GameService).
 * `index.ts` bunları dışa vermez.
 */

import type { GameCommand, SceneView } from '@secret-table/contracts';
import { PROTOCOL_VERSION } from '@secret-table/contracts';

import { InMemoryGateway } from './memory-gateway';
import { GameService } from './service';

export type Harness = {
  gateway: InMemoryGateway;
  service: GameService;
  clock: { ms: number };
  roomId: string;
  /** userId -> playerId */
  playerIdByUser: Record<string, string>;
  userIds: string[];
  advance: (seconds: number) => void;
  view: (userId: string) => Promise<SceneView>;
  heartbeatAll: () => Promise<void>;
  submit: (
    userId: string,
    actionId: string,
    optionId?: string,
    commandId?: string,
  ) => Promise<import('@secret-table/contracts').CommandResponse>;
  rawCommand: (userId: string, command: GameCommand) => Promise<
    import('@secret-table/contracts').CommandResponse
  >;
};

export async function makeStartedGame(
  playerCount: number,
  opts?: { seed?: number },
): Promise<Harness> {
  const gateway = new InMemoryGateway();
  const clock = { ms: Date.parse('2026-09-09T12:00:00.000Z') };
  let idCounter = 0;

  const service = new GameService(gateway, {
    now: () => new Date(clock.ms),
    newId: () => `id_${(idCounter += 1)}`,
    newInviteCode: () => 'TESTAA',
    newSeed: () => opts?.seed ?? 4242,
    reconnectSeconds: 600,
  });

  const userIds = Array.from({ length: playerCount }, (_u, i) => `u${i + 1}`);
  const created = await service.createRoom({ userId: userIds[0] as string, displayName: 'Host' });
  const roomId = created.roomId;

  for (let i = 1; i < playerCount; i += 1) {
    const joined = await service.joinRoom({
      inviteCode: created.inviteCode,
      userId: userIds[i] as string,
      displayName: `Oyuncu ${i + 1}`,
    });
    if (!joined.ok) throw new Error(`join başarısız: ${joined.error}`);
  }

  // Başlatma tüm aktif üyelerin hazır olmasını ister (service.startGame).
  for (let i = 0; i < playerCount; i += 1) {
    await service.submitLobbyCommand(
      { roomId, userId: userIds[i] as string },
      { protocolVersion: PROTOCOL_VERSION, commandId: `ready_${i}`, type: 'set_ready', ready: true },
    );
  }

  const started = await service.submitLobbyCommand(
    { roomId, userId: userIds[0] as string },
    { protocolVersion: PROTOCOL_VERSION, commandId: 'start', type: 'start_game' },
  );
  if (!started.ok) throw new Error(`start_game başarısız: ${started.error}`);

  const members = await gateway.listMembers(roomId);
  const playerIdByUser: Record<string, string> = {};
  for (const member of members) playerIdByUser[member.userId] = member.playerId;

  let commandSeq = 0;

  const harness: Harness = {
    gateway,
    service,
    clock,
    roomId,
    playerIdByUser,
    userIds,
    advance: (seconds) => {
      clock.ms += seconds * 1000;
    },
    view: async (userId) => {
      const res = await service.getView({ roomId, userId });
      if (!res.ok) throw new Error(`getView başarısız: ${res.error}`);
      return res.response.view;
    },
    heartbeatAll: async () => {
      for (const userId of userIds) await service.heartbeat({ roomId, userId });
    },
    submit: async (userId, actionId, optionId, commandId) => {
      const res = await service.getView({ roomId, userId });
      if (!res.ok) throw new Error(`getView başarısız: ${res.error}`);
      const { view } = res.response;
      return service.submitCommand(
        { roomId, userId },
        {
          protocolVersion: PROTOCOL_VERSION,
          gameId: view.gameId as string,
          phaseId: view.phaseId,
          commandId: commandId ?? `cmd_${(commandSeq += 1)}`,
          actionId,
          optionId,
        },
      );
    },
    rawCommand: (userId, command) => service.submitCommand({ roomId, userId }, command),
  };

  await harness.heartbeatAll();
  return harness;
}

/** Bir aşamada bir oyuncunun ilk aksiyonunu (varsa ilk seçenekle) uygular. */
export async function actFirst(
  harness: Harness,
  userId: string,
  optionPicker?: (view: SceneView) => string | undefined,
): Promise<void> {
  const view = await harness.view(userId);
  const action = view.actions[0];
  if (!action) throw new Error(`${userId} için aksiyon yok (aşama ${view.phase})`);
  const optionId = optionPicker ? optionPicker(view) : action.options[0]?.optionId;
  const res = await harness.submit(userId, action.actionId, optionId);
  if (!res.ok) throw new Error(`${userId} ${action.actionId} reddedildi: ${res.error}`);
}

/** role_reveal aşamasında herkes onaylar. */
export async function ackAllRoles(harness: Harness): Promise<void> {
  for (const userId of harness.userIds) {
    const view = await harness.view(userId);
    if (view.phase !== 'role_reveal') continue;
    const ack = view.actions.find((a) => a.kind === 'ack_role');
    if (ack) await harness.submit(userId, ack.actionId, ack.options[0]?.optionId);
  }
}
