import type { SceneFixture } from '../types';
import { makePlayers, makeView } from '../builders';

const players = makePlayers({
  count: 7,
  overrides: {
    0: { ready: true },
    1: { ready: true },
    2: { ready: true },
    4: { ready: true },
    5: { connected: false },
  },
});

export const lobbyFixture: SceneFixture = {
  id: 'lobby',
  title: 'Lobi — 7 kişi',
  description:
    'Oyun başlamadan önce masa. gameId null, playerCountAtStart null. Hazır olma ve başlatma HTML kontrol katmanında.',
  view: makeView({
    phase: 'lobby',
    phaseId: 'lobby_1',
    revision: 6,
    players,
    localPlayerId: 'p2',
  }),
  cues: [],
  selection: null,
};

/**
 * D3.4 — lobide karakter seçimi yapılmış masa. Her koltuk FARKLI bir seçim
 * taşır (koltuk varsayılanından sapar) ve iki oyuncu AYNI karakteri farklı
 * tenle seçmiştir: sahne `PlayerView.avatar`ı gerçekten okuyor mu, tek bakışta
 * görünür.
 */
const avatarPlayers = makePlayers({
  count: 7,
  overrides: {
    0: { ready: true, avatar: { character: 'kepli-cocuk', skin: 'koyu' } },
    1: { ready: true, avatar: { character: 'bereli-teyze', skin: 'acik' } },
    2: { ready: true, avatar: { character: 'fotr', skin: 'orta' } },
    3: { avatar: { character: 'fotr', skin: 'koyu' } },
    4: { ready: true, avatar: { character: 'sakalli', skin: 'acik' } },
    5: { connected: false, avatar: { character: 'topuzlu', skin: 'orta' } },
    6: { avatar: { character: 'gozluklu', skin: 'koyu' } },
  },
});

export const lobbyAvatarsFixture: SceneFixture = {
  id: 'lobby-avatars',
  title: 'Lobi — seçilmiş karakterler',
  description:
    'D3.4: her koltuk lobide kendi karakterini seçmiş (3. ve 4. koltuk aynı karakter, farklı ten). Sahne koltuk sırasından değil, PlayerView.avatar alanından okur.',
  view: makeView({
    phase: 'lobby',
    phaseId: 'lobby_2',
    revision: 9,
    players: avatarPlayers,
    localPlayerId: 'p3',
  }),
  cues: [],
  selection: null,
};
