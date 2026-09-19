// @vitest-environment jsdom
/**
 * A6 (docs/ROADMAP.md) — geliştirme bot koşucusu.
 *
 * `apiClient` taklit edilir: ağ yok, sunucu yok. Supabase ortam değişkeni de
 * yok, bu yüzden koşucu `dev:bot-…` kimliklerine düşer (yerel bellek kipi).
 * Doğrulananlar: eksik koltuk kadar bot katılır, yalnız botların koltuğuna
 * hamle gider, seçim yalnız görünümdeki geçerli `actionId`/`optionId`
 * çiftlerinden gelir ve `stop()` sonrası istek çıkmaz.
 */
import type {
  AllowedAction,
  LobbyMember,
  PlayerView,
  SceneView,
} from '@secret-table/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../multiplayer/apiClient', () => ({
  joinRoom: vi.fn(),
  fetchLobby: vi.fn(),
  fetchView: vi.fn(),
  sendCommand: vi.fn(),
  sendLobbyCommand: vi.fn(),
  sendHeartbeat: vi.fn(),
}));

import * as api from '../multiplayer/apiClient';
import type { LobbyView } from '../multiplayer/apiClient';
import { avatarForSeat } from '@secret-table/contracts';

import {
  BOT_NAMES,
  BOT_QUOTA_MESSAGE,
  actorPlayerId,
  chooseMove,
  clearBotSession,
  isRateLimitError,
  pickBotAvatar,
  readBotSession,
  startBots,
  writeBotSession,
  type BotRunner,
} from './botRunner';

/**
 * Sahte kimlik: gerçek Supabase anonim oturumu AÇILMAZ (test ağa çıkmaz).
 * Üretimdeki karşılığı bot başına ayrı, kalıcı olmayan istemcidir.
 */
function fakeAuth(index: number, label: string) {
  return Promise.resolve({
    label,
    getToken: async () => `dev:bot-${index}`,
    dispose: () => undefined,
  });
}

const HUMAN = 'p-human';
const OTHERS = ['p-h2', 'p-h3', 'p-h4'];

/** displayName → sunucunun vereceği sabit oyuncu kimliği. */
function pidOf(name: string): string {
  return `p-${name.toLowerCase()}`;
}

type World = {
  roomId: string;
  /** Odadaki oyuncu kimlikleri, koltuk sırasıyla. */
  seats: string[];
  status: 'lobby' | 'in_game';
  /** token → oyuncu kimliği. */
  tokens: Map<string, string>;
  /** Herkese açık görünüm (lider botun okuduğu). */
  view: SceneView | null;
  /** oyuncu kimliği → o oyuncunun kendi `actions` listesi. */
  actions: Map<string, AllowedAction[]>;
};

let world: World;
let runner: BotRunner | null = null;

function member(playerId: string, seatIndex: number): LobbyMember {
  return {
    playerId,
    seatIndex,
    displayName: playerId,
    connected: true,
    ready: true,
    isHost: seatIndex === 0,
    isLocal: false,
    avatar: avatarForSeat(seatIndex),
  };
}

function lobbyFor(token: string): LobbyView {
  const localPlayerId = world.tokens.get(token) ?? HUMAN;
  return {
    roomId: world.roomId,
    inviteCode: 'INVITE',
    status: world.status,
    localPlayerId,
    isHost: false,
    members: world.seats.map((pid, i) => ({ ...member(pid, i), isLocal: pid === localPlayerId })),
    minPlayers: 5,
    maxPlayers: 10,
    canStart: false,
  };
}

function player(playerId: string, seatIndex: number, extra: Partial<PlayerView> = {}): PlayerView {
  return {
    playerId,
    seatIndex,
    displayName: playerId,
    connected: true,
    ready: false,
    alive: true,
    isHost: seatIndex === 0,
    office: 'none',
    isPresidentialCandidate: false,
    isChancellorCandidate: false,
    hasVoted: false,
    avatar: avatarForSeat(seatIndex),
    ...extra,
  };
}

function makeView(
  phase: SceneView['phase'],
  players: PlayerView[],
  actions: AllowedAction[] = [],
): SceneView {
  return {
    protocolVersion: 1,
    roomId: world.roomId,
    gameId: 'g1',
    revision: 7,
    phaseId: `${phase}-1`,
    phase,
    connection: 'connected',
    paused: null,
    playerCountAtStart: 6,
    boardVariant: 'medium',
    localPlayerId: players[0]!.playerId,
    players,
    table: {
      liberalPolicies: 0,
      fascistPolicies: 0,
      electionTracker: 0,
      drawCount: 17,
      discardCount: 0,
      enactedPolicies: [],
      lastElection: null,
      currentPower: null,
      publicHistory: [],
    },
    privateView: { role: null, knownPlayers: [], hand: [], submittedVote: null, inspection: null },
    actions,
    result: null,
  };
}

const ack: AllowedAction = {
  actionId: 'act_ack_role',
  kind: 'ack_role',
  phaseId: 'role_reveal-1',
  options: [{ optionId: 'ack', labelKey: 'role.ready' }],
  requiresConfirmation: false,
};

const voteAction: AllowedAction = {
  actionId: 'act_vote',
  kind: 'vote',
  phaseId: 'voting-1',
  options: [
    { optionId: 'vote_yes', labelKey: 'vote.yes', vote: 'yes' },
    { optionId: 'vote_no', labelKey: 'vote.no', vote: 'no' },
  ],
  requiresConfirmation: false,
};

const nominate: AllowedAction = {
  actionId: 'act_nominate',
  kind: 'nominate',
  phaseId: 'nomination-1',
  options: [
    { optionId: 'nom_a', labelKey: 'player.name', targetPlayerId: 'p-a' },
    { optionId: 'nom_b', labelKey: 'player.name', targetPlayerId: 'p-b' },
    { optionId: 'nom_c', labelKey: 'player.name', targetPlayerId: 'p-c' },
  ],
  requiresConfirmation: true,
};

/** Mikro görev zincirlerini boşalt (koşucu tamamen `await` tabanlı). */
async function flush(times = 80): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

async function settle(ms = 0): Promise<void> {
  await flush();
  if (ms > 0) await vi.advanceTimersByTimeAsync(ms);
  await flush();
}

function tokenPid(token: unknown): string {
  return world.tokens.get(String(token)) ?? '?';
}

beforeEach(() => {
  vi.useFakeTimers();
  world = {
    roomId: `room-${Math.random().toString(36).slice(2, 8)}`,
    seats: [HUMAN, ...OTHERS],
    status: 'lobby',
    tokens: new Map(),
    view: null,
    actions: new Map(),
  };

  vi.mocked(api.joinRoom).mockImplementation(async (token, _invite, displayName) => {
    const pid = pidOf(displayName);
    world.tokens.set(token, pid);
    world.seats.push(pid);
    return { ok: true, data: { roomId: world.roomId } };
  });
  vi.mocked(api.fetchLobby).mockImplementation(async (token) => ({
    ok: true,
    data: lobbyFor(token),
  }));
  vi.mocked(api.fetchView).mockImplementation(async (token) => {
    if (!world.view) return { ok: false, status: 409, error: 'GAME_ALREADY_STARTED' };
    const pid = tokenPid(token);
    return {
      ok: true,
      data: {
        view: { ...world.view, localPlayerId: pid, actions: world.actions.get(pid) ?? [] },
        cues: [],
        resync: false,
      },
    };
  });
  vi.mocked(api.sendCommand).mockImplementation(async (token, _r, command) => {
    // Sunucu benzeri durum ilerlemesi: aynı hamle ikinci kez gönderilmesin.
    const pid = tokenPid(token);
    if (world.view) {
      const patch = (fn: (p: PlayerView) => PlayerView): void => {
        world.view = {
          ...world.view!,
          players: world.view!.players.map((p) => (p.playerId === pid ? fn(p) : p)),
        };
      };
      if (command.actionId === 'act_ack_role') patch((p) => ({ ...p, ready: true }));
      if (command.actionId === 'act_vote') patch((p) => ({ ...p, hasVoted: true }));
      world.actions.set(pid, []);
    }
    return {
      ok: true,
      data: { ok: true, commandId: command.commandId, revision: 8, view: world.view!, cues: [] },
    };
  });
  vi.mocked(api.sendLobbyCommand).mockResolvedValue({ ok: true, data: { ok: true } });
  vi.mocked(api.sendHeartbeat).mockResolvedValue({ ok: true, data: { ok: true, sessionGeneration: 1 } });
});

afterEach(async () => {
  runner?.stop();
  runner = null;
  await flush();
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function start(target?: number): Promise<BotRunner> {
  runner = await startBots({
    roomId: world.roomId,
    inviteCode: 'INVITE',
    currentMembers: world.seats.length,
    ...(target === undefined ? {} : { target }),
    random: () => 0.5,
    log: () => undefined,
    createAuth: fakeAuth,
  });
  return runner;
}

describe('startBots — katılım', () => {
  it('4 üyeli odaya hedefi (6) tamamlayacak kadar bot ekler ve hazır yapar', async () => {
    const handle = await start();

    expect(handle.count).toBe(2);
    expect(vi.mocked(api.joinRoom)).toHaveBeenCalledTimes(2);
    const names = vi.mocked(api.joinRoom).mock.calls.map((c) => c[2]);
    expect(names).toEqual([BOT_NAMES[0], BOT_NAMES[1]]);
    // Her bot ayrı, kalıcı olmayan kimlik: token'lar farklı ve `dev:bot-` önekli.
    const tokens = vi.mocked(api.joinRoom).mock.calls.map((c) => c[0]);
    expect(new Set(tokens).size).toBe(2);
    expect(tokens).toEqual(['dev:bot-0', 'dev:bot-1']);
    // D3.4: her bot önce `set_avatar`, sonra `set_ready` gönderir.
    const lobbyCalls = vi.mocked(api.sendLobbyCommand).mock.calls.map((c) => c[2]);
    expect(lobbyCalls).toHaveLength(4);
    expect(lobbyCalls.filter((c) => c.type === 'set_ready')).toHaveLength(2);
    const avatars = lobbyCalls.filter((c) => c.type === 'set_avatar');
    expect(avatars).toHaveLength(2);
    expect(new Set(avatars.map((c) => (c as { character: string }).character)).size).toBe(2);
    expect(lobbyCalls[0]).toMatchObject({ type: 'set_avatar' });
    expect(lobbyCalls[1]).toMatchObject({ type: 'set_ready', ready: true });
  });

  it('D19 — 9 bot adı var; 1 kişilik odaya 10 hedefiyle 9 bot katılır', async () => {
    expect(BOT_NAMES).toHaveLength(9);
    expect(new Set(BOT_NAMES).size).toBe(9);
    world.seats = [HUMAN];
    const handle = await start(10);
    expect(handle.count).toBe(9);
    const names = vi.mocked(api.joinRoom).mock.calls.map((c) => c[2]);
    expect(names).toEqual([...BOT_NAMES]);
  });

  it('D19 — 7 kişilik masa: 1 insan + 6 bot', async () => {
    world.seats = [HUMAN];
    const handle = await start(7);
    expect(handle.count).toBe(6);
  });

  it('oda zaten doluysa bot eklemez', async () => {
    world.seats = [HUMAN, ...OTHERS, 'p-x', 'p-y'];
    const handle = await start();
    expect(handle.count).toBe(0);
    expect(vi.mocked(api.joinRoom)).not.toHaveBeenCalled();
  });
});

describe('oyun döngüsü', () => {
  it('role_reveal: yalnız hazır olmayan botlar onay gönderir, kullanıcı koltuğu dokunulmaz', async () => {
    const handle = await start();
    const bots = handle.count === 2 ? [pidOf(BOT_NAMES[0]), pidOf(BOT_NAMES[1])] : [];
    world.status = 'in_game';
    world.view = makeView('role_reveal', [
      player(HUMAN, 0),
      ...OTHERS.map((p, i) => player(p, i + 1, { ready: true })),
      player(bots[0]!, 4),
      player(bots[1]!, 5),
    ]);
    for (const pid of bots) world.actions.set(pid, [ack]);
    world.actions.set(HUMAN, [ack]);

    await settle(4_000);

    const sent = vi.mocked(api.sendCommand).mock.calls;
    expect(sent).toHaveLength(2);
    expect(sent.map((c) => tokenPid(c[0])).sort()).toEqual([...bots].sort());
    expect(sent.every((c) => c[2].actionId === 'act_ack_role' && c[2].optionId === 'ack')).toBe(true);
  });

  it('voting: yalnız oy vermemiş botlar oy verir', async () => {
    const handle = await start();
    expect(handle.count).toBe(2);
    const [b0, b1] = [pidOf(BOT_NAMES[0]), pidOf(BOT_NAMES[1])];
    world.status = 'in_game';
    world.view = makeView('voting', [
      player(HUMAN, 0),
      ...OTHERS.map((p, i) => player(p, i + 1)),
      player(b0, 4, { hasVoted: true }),
      player(b1, 5, { hasVoted: false }),
    ]);
    world.actions.set(b1, [voteAction]);
    world.actions.set(HUMAN, [voteAction]);

    await settle(4_000);

    const sent = vi.mocked(api.sendCommand).mock.calls;
    expect(sent).toHaveLength(1);
    expect(tokenPid(sent[0]![0])).toBe(b1);
    expect(sent[0]![2].actionId).toBe('act_vote');
    expect(['vote_yes', 'vote_no']).toContain(sent[0]![2].optionId);
  });

  it('sıradaki aktör bot değilse hamle göndermez', async () => {
    await start();
    world.status = 'in_game';
    world.view = makeView('nomination', [
      player(HUMAN, 0, { isPresidentialCandidate: true }),
      ...OTHERS.map((p, i) => player(p, i + 1)),
      player(pidOf(BOT_NAMES[0]), 4),
      player(pidOf(BOT_NAMES[1]), 5),
    ]);
    world.actions.set(HUMAN, [nominate]);

    await settle(4_000);

    expect(vi.mocked(api.sendCommand)).not.toHaveBeenCalled();
  });

  it('aktör bot ise yalnız kendi görünümündeki geçerli çiftlerden birini gönderir', async () => {
    await start();
    const b0 = pidOf(BOT_NAMES[0]);
    world.status = 'in_game';
    world.view = makeView('nomination', [
      player(HUMAN, 0),
      ...OTHERS.map((p, i) => player(p, i + 1)),
      player(b0, 4, { isPresidentialCandidate: true }),
      player(pidOf(BOT_NAMES[1]), 5),
    ]);
    world.actions.set(b0, [nominate]);

    await settle(4_000);

    const sent = vi.mocked(api.sendCommand).mock.calls;
    expect(sent).toHaveLength(1);
    expect(tokenPid(sent[0]![0])).toBe(b0);
    expect(sent[0]![2].actionId).toBe('act_nominate');
    expect(nominate.options.map((o) => o.optionId)).toContain(sent[0]![2].optionId);
  });

  it('stop() sonrası hiç istek gitmez', async () => {
    const handle = await start();
    world.status = 'in_game';
    world.view = makeView('nomination', [
      player(HUMAN, 0, { isPresidentialCandidate: true }),
      ...OTHERS.map((p, i) => player(p, i + 1)),
      player(pidOf(BOT_NAMES[0]), 4),
      player(pidOf(BOT_NAMES[1]), 5),
    ]);
    await settle(4_000);

    handle.stop();
    await flush();
    const calls = () =>
      vi.mocked(api.fetchView).mock.calls.length +
      vi.mocked(api.fetchLobby).mock.calls.length +
      vi.mocked(api.sendHeartbeat).mock.calls.length +
      vi.mocked(api.sendCommand).mock.calls.length;
    const before = calls();

    await settle(60_000);

    expect(calls()).toBe(before);
  });
});

describe('chooseMove / actorPlayerId', () => {
  const view = (phase: SceneView['phase'], actions: AllowedAction[]): SceneView => {
    world = world ?? ({ roomId: 'r' } as World);
    return makeView(phase, [player(HUMAN, 0)], actions);
  };

  it('yalnız görünümdeki geçerli actionId/optionId çiftini döndürür', () => {
    for (const r of [0, 0.2, 0.49, 0.5, 0.99, 0.999999]) {
      const move = chooseMove(view('nomination', [nominate]), () => r);
      expect(move).not.toBeNull();
      expect(move!.action.actionId).toBe('act_nominate');
      expect(nominate.options.map((o) => o.optionId)).toContain(move!.optionId);
    }
  });

  it('chancellor_choice: veto açıkken %30 veto, kalanında enact (D19)', () => {
    const enact: AllowedAction = {
      actionId: 'act_enact',
      kind: 'enact_policy',
      phaseId: 'chancellor_choice-1',
      options: [
        { optionId: 'enact_c1', labelKey: 'policy.liberal', cardId: 'c1' },
        { optionId: 'enact_c2', labelKey: 'policy.fascist', cardId: 'c2' },
      ],
      requiresConfirmation: true,
    };
    const veto: AllowedAction = {
      actionId: 'act_request_veto',
      kind: 'request_veto',
      phaseId: 'chancellor_choice-1',
      options: [{ optionId: 'veto', labelKey: 'veto.request' }],
      requiresConfirmation: false,
    };
    // VETO_REQUEST_RATE = 0,3 → 0,3'ün ALTI veto önerir, üstü kanun koyar.
    for (const r of [0, 0.1, 0.29]) {
      const move = chooseMove(view('chancellor_choice', [veto, enact]), () => r);
      expect(move!.action.actionId).toBe('act_request_veto');
      expect(move!.optionId).toBe('veto');
    }
    for (const r of [0.3, 0.5, 0.9]) {
      const move = chooseMove(view('chancellor_choice', [veto, enact]), () => r);
      expect(move!.action.actionId).toBe('act_enact');
      expect(['enact_c1', 'enact_c2']).toContain(move!.optionId);
    }
    // Veto kapalıyken (yalnız enact görünür) her zaman kanun koyar.
    for (const r of [0, 0.5, 0.99]) {
      const move = chooseMove(view('chancellor_choice', [enact]), () => r);
      expect(move!.action.actionId).toBe('act_enact');
    }
  });

  it('veto_response: bot başkan %50 kabul, %50 ret (D19)', () => {
    const respond: AllowedAction = {
      actionId: 'act_respond_veto',
      kind: 'respond_veto',
      phaseId: 'veto_response-1',
      options: [
        { optionId: 'veto_accept', labelKey: 'veto.accept' },
        { optionId: 'veto_reject', labelKey: 'veto.reject' },
      ],
      requiresConfirmation: false,
    };
    for (const r of [0, 0.2, 0.49]) {
      expect(chooseMove(view('veto_response', [respond]), () => r)!.optionId).toBe('veto_accept');
    }
    for (const r of [0.5, 0.8, 0.99]) {
      expect(chooseMove(view('veto_response', [respond]), () => r)!.optionId).toBe('veto_reject');
    }
  });

  it('aksiyon yoksa null döner', () => {
    expect(chooseMove(view('nomination', []), () => 0)).toBeNull();
  });

  it('aktör eşlemesi fazlara göre doğru koltuğu bulur', () => {
    const players = [
      player(HUMAN, 0, { office: 'president', isPresidentialCandidate: true }),
      player('p-c', 1, { office: 'chancellor' }),
    ];
    expect(actorPlayerId(makeView('nomination', players))).toBe(HUMAN);
    expect(actorPlayerId(makeView('president_discard', players))).toBe(HUMAN);
    expect(actorPlayerId(makeView('chancellor_choice', players))).toBe('p-c');
    expect(actorPlayerId(makeView('veto_response', players))).toBe(HUMAN);
    expect(actorPlayerId(makeView('election_result', players))).toBeNull();
  });

  /**
   * D14 — `dev_scenario` ile infaz yetkisi YEREL oyuncuya verilir. Botlar
   * yalnız kendi sıralarında oynar: yetki insandaysa hiçbir bot hedef seçmez
   * (oy verme yolu değişmedi, `playVoting` ayrı).
   */
  it('executive_action: yetki sahibi `currentPower.actorId`tir (insan ise bot oynamaz)', () => {
    const players = [
      player(HUMAN, 0, { office: 'president' }),
      player('p-c', 1, { office: 'chancellor' }),
    ];
    const base = makeView('executive_action', players);
    const withPower: SceneView = {
      ...base,
      table: {
        ...base.table,
        currentPower: { power: 'execution', actorId: HUMAN, targetId: null },
      },
    };
    expect(actorPlayerId(withPower)).toBe(HUMAN);
    // İnsanın görünümündeki eylemler bota gitmez; botun kendi görünümü boştur.
    expect(chooseMove(makeView('executive_action', players, []), () => 0)).toBeNull();
  });

  /**
   * D19 — inceleme ve özel seçim de aynı kuralla çalışır: yetki İNSANDAYSA
   * botun yetkili görünümü boş (`actions: []`) olur ve hiçbir hedef seçilmez;
   * yetki BOTTAYSA görünümündeki hedeflerden rastgele biri seçilir.
   */
  for (const power of ['investigate_loyalty', 'call_special_election'] as const) {
    it(`${power}: yetki insandayken bot hedef seçmez, bottayken rastgele seçer`, () => {
      const players = [
        player(HUMAN, 0, { office: 'president' }),
        player(pidOf(BOT_NAMES[0]), 1, { office: 'chancellor' }),
        player(pidOf(BOT_NAMES[1]), 2),
      ];
      // 1) Yetki insanda: botun görünümü boş → hamle yok.
      expect(chooseMove(makeView('executive_action', players, []), () => 0.5)).toBeNull();

      // 2) Yetki botta: hedef listesi botun kendi görünümünde gelir.
      const usePower: AllowedAction = {
        actionId: 'act_use_power',
        kind: 'use_power',
        phaseId: 'executive_action-1',
        options: [
          { optionId: 'target_human', labelKey: 'player.name', targetPlayerId: HUMAN },
          { optionId: 'target_bot2', labelKey: 'player.name', targetPlayerId: pidOf(BOT_NAMES[1]) },
        ],
        requiresConfirmation: true,
      };
      const move = chooseMove(makeView('executive_action', players, [usePower]), () => 0.5);
      expect(move?.action.kind).toBe('use_power');
      expect(['target_human', 'target_bot2']).toContain(move?.optionId);
    });
  }

  it('policy_peek: seçeneksiz yetki `optionId` göndermez', () => {
    const peek: AllowedAction = {
      actionId: 'act_use_power',
      kind: 'use_power',
      phaseId: 'executive_action-1',
      options: [],
      requiresConfirmation: false,
    };
    const players = [player(HUMAN, 0), player(pidOf(BOT_NAMES[0]), 1, { office: 'president' })];
    const move = chooseMove(makeView('executive_action', players, [peek]), () => 0.5);
    expect(move?.action.actionId).toBe('act_use_power');
    expect(move?.optionId).toBeUndefined();
  });
});

/** D3.4 — botlar lobide rastgele ama farklı karakter seçer (yalnız dev). */
describe('pickBotAvatar', () => {
  it('kullanılmamış karakterlerden seçer', () => {
    const used = ['biyikli-amca', 'gozluklu', 'topuzlu', 'fotr', 'sakalli', 'kivircik', 'bereli-teyze'];
    expect(pickBotAvatar(used, () => 0).character).toBe('kepli-cocuk');
  });

  it('hepsi doluysa yine geçerli bir seçim döner', () => {
    const all = [
      'biyikli-amca', 'gozluklu', 'topuzlu', 'fotr',
      'sakalli', 'kivircik', 'bereli-teyze', 'kepli-cocuk',
    ];
    const picked = pickBotAvatar(all, () => 0.5);
    expect(all).toContain(picked.character);
    expect(['acik', 'orta', 'koyu']).toContain(picked.skin);
  });

  it('arka arkaya seçimler birikimli listeyle çakışmaz', () => {
    const taken: string[] = [];
    const random = (() => { let i = 0; return () => ((i += 3) % 7) / 7; })();
    for (let n = 0; n < 5; n += 1) {
      const next = pickBotAvatar(taken, random);
      expect(taken).not.toContain(next.character);
      taken.push(next.character);
    }
  });
});

/**
 * D21/H — bot oturumları anonim giriş KOTASINI tüketmesin.
 *
 * Supabase anonim giriş sınırı IP başına ~30/saat; her "bot ekle" tıklaması 9
 * yeni anonim kullanıcı açtığı için iki-üç tur sonra gerçek oyuncu da
 * giremiyordu. Oturumlar bot ADINA göre `localStorage`'da saklanır ve yeniden
 * kullanılır; 429'da anlaşılır mesaj verilir ve denemeler durur.
 */
describe('bot oturumu saklama (D21/H)', () => {
  // NOT: bu ortamda gerçek `localStorage` kullanılamaz (Node'un dosyasız
  // native stub'ı jsdom'unkini gölgeliyor), bu yüzden depo taklit edilir.
  // Üretimdeki davranış aynıdır; erişilemezse kod sessizce boş döner.
  function stubStorage(): Map<string, string> {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    return store;
  }

  it('yaz → oku → temizle; bozuk kayıt null döner', () => {
    const store = stubStorage();
    expect(readBotSession('Bot-Ada')).toBeNull();

    writeBotSession('Bot-Ada', { access_token: 'a1', refresh_token: 'r1' });
    expect(readBotSession('Bot-Ada')).toEqual({ access_token: 'a1', refresh_token: 'r1' });
    // Bot adına göre ayrı yuva: başka bot etkilenmez.
    expect(readBotSession('Bot-Bora')).toBeNull();
    // Kullanıcının kendi oturum anahtarına DOKUNULMAZ (ayrı önek).
    expect([...store.keys()]).toEqual(['secret-table:dev-bot-session:Bot-Ada']);

    store.set('secret-table:dev-bot-session:Bot-Cem', '{bozuk');
    expect(readBotSession('Bot-Cem')).toBeNull();
    store.set('secret-table:dev-bot-session:Bot-Cem', '{"access_token":"x"}');
    expect(readBotSession('Bot-Cem')).toBeNull();

    clearBotSession('Bot-Ada');
    expect(readBotSession('Bot-Ada')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('depo erişilemezse (gizli pencere) sessizce boş döner', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    });
    expect(readBotSession('Bot-Ada')).toBeNull();
    expect(() => writeBotSession('Bot-Ada', { access_token: 'a', refresh_token: 'b' })).not.toThrow();
    expect(() => clearBotSession('Bot-Ada')).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('429 / oran sınırı hatası tanınır ve mesajı anlaşılır', () => {
    expect(isRateLimitError({ status: 429, message: 'nope' })).toBe(true);
    expect(isRateLimitError({ message: 'email rate limit exceeded' })).toBe(true);
    expect(isRateLimitError({ message: 'Too Many Requests' })).toBe(true);
    expect(isRateLimitError({ status: 400, message: 'bad grant' })).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(BOT_QUOTA_MESSAGE).toContain('anonim giriş sınırı');
    expect(BOT_QUOTA_MESSAGE).toContain('1 saat');
  });

  it('kimlik alınamazsa neden loglanır ve BOT EKLEME DURUR', async () => {
    const lines: string[] = [];
    const runner = await startBots({
      roomId: 'r1',
      inviteCode: 'AAAAAA',
      target: 6,
      currentMembers: 4,
      random: () => 0.5,
      log: (line) => lines.push(line),
      createAuth: async (_index, label, report) => {
        report?.(BOT_QUOTA_MESSAGE);
        void label;
        return null;
      },
    });
    expect(runner.count).toBe(0);
    expect(lines.join(' | ')).toContain(BOT_QUOTA_MESSAGE);
    // Sınır zorlanmaz: tek denemeden sonra durulur.
    expect(lines.filter((l) => l.includes(BOT_QUOTA_MESSAGE))).toHaveLength(1);
    runner.stop();
  });
});
