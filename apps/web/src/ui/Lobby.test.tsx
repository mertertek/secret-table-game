// @vitest-environment jsdom
/**
 * A6 (docs/ROADMAP.md) — lobideki geliştirme bot düğmesi.
 * B6 — yeniden tasarlanan lobi: yuvarlak masa çizimi, hazır/oda sahibi
 * rozetleri, başlatma gerekçesi ve `navigator.share` koşullu "Paylaş".
 *
 * `import.meta.env.DEV` vitest'te `true`; üretim paketinde bu dal derleme
 * sırasında düşer (build çıktısında `botRunner`/`Bot-Ada` aranarak doğrulandı).
 * Sahne ön-yüklemesi (three/WebGL) taklit edilir.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('./SceneFrame', () => ({ preloadScene: () => undefined, SceneFrame: () => null }));
// D3.4: 3D önizleme (three) jsdom'da yüklenmez; seçicinin HTML'i test edilir.
vi.mock('./AvatarPreview', () => ({ default: () => null }));
vi.mock('../dev/botRunner', () => ({
  runningBotCount: () => 0,
  botRunnerFor: () => null,
  startBots: vi.fn(),
}));

import type { LobbyMember } from '@secret-table/contracts';
import { avatarForSeat } from '@secret-table/contracts';

import type { RoomState } from '../multiplayer/useRoomState';
import { Lobby } from './Lobby';

type LobbyRoom = Extract<RoomState, { phase: 'lobby' }>;

afterEach(() => {
  cleanup();
  delete (navigator as { share?: unknown }).share;
});

function member(i: number, over: Partial<LobbyMember> = {}): LobbyMember {
  return {
    playerId: `p${i + 1}`,
    seatIndex: i,
    displayName: `Oyuncu ${i + 1}`,
    connected: true,
    ready: false,
    isHost: i === 0,
    isLocal: i === 0,
    avatar: avatarForSeat(i),
    ...over,
  };
}

function room(over: Partial<LobbyRoom['snapshot']> = {}, roomOver: Partial<LobbyRoom> = {}): LobbyRoom {
  return {
    phase: 'lobby',
    mode: 'dev',
    connection: 'connected',
    snapshot: {
      roomId: 'room-1',
      inviteCode: 'ABC123',
      status: 'lobby',
      localPlayerId: 'p1',
      isHost: true,
      members: [member(0, { displayName: 'Ben' })],
      minPlayers: 5,
      maxPlayers: 10,
      canStart: false,
      ...over,
    },
    inviteUrl: 'http://localhost:5173/katil/ABC123',
    busy: false,
    transient: null,
    setReady: () => undefined,
    setAvatar: () => undefined,
    startGame: () => undefined,
    cancelGame: () => undefined,
    refresh: () => undefined,
    ...roomOver,
  };
}

function seats() {
  return within(screen.getByRole('list', { name: 'Masadaki oyuncular' })).getAllByRole('listitem');
}

it('DEV lobisinde bot ekleme düğmesi ve masa boyu seçimi görünür (D19)', async () => {
  render(<Lobby room={room()} />);
  // Varsayılan hedef 7 kişi; odada 1 üye varsa 6 bot eklenir.
  expect(await screen.findByRole('button', { name: '6 bot ekle (dev)' })).toBeTruthy();
  const select = screen.getByRole('combobox', { name: 'Bot masası boyu' }) as HTMLSelectElement;
  expect(select.value).toBe('7');
  fireEvent.change(select, { target: { value: '9' } });
  expect(screen.getByRole('button', { name: '8 bot ekle (dev)' })).toBeTruthy();
});

it('6 oyuncu için masada 6 koltuk çizer', () => {
  const members = Array.from({ length: 6 }, (_, i) => member(i));
  render(<Lobby room={room({ members })} />);
  expect(seats()).toHaveLength(6);
  expect(screen.getByText('Oyuncu 6')).toBeTruthy();
});

it('oyuncu sayısı azken boş koltuklar `minPlayers` sayısına tamamlanır', () => {
  render(<Lobby room={room({ members: [member(0), member(1)] })} />);
  const list = seats();
  expect(list).toHaveLength(5);
  expect(within(screen.getByRole('list', { name: 'Masadaki oyuncular' })).getAllByText('Boş')).toHaveLength(3);
});

it('hazır ve oda sahibi rozetlerini koltukta gösterir', () => {
  const members = [
    member(0, { displayName: 'Ben', ready: true, isHost: true, isLocal: true }),
    member(1, { displayName: 'Konuk', ready: false, isHost: false, isLocal: false }),
  ];
  render(<Lobby room={room({ members })} />);
  const rows = seats();
  const host = rows[0] as HTMLElement;
  const guest = rows[1] as HTMLElement;

  expect(host.className).toContain('is-ready');
  expect(within(host).getByText(/oda sahibi/)).toBeTruthy();
  expect(within(host).getByText('sen')).toBeTruthy();
  expect(within(host).getByText(/, hazır/)).toBeTruthy();
  expect(guest.className).not.toContain('is-ready');
  expect(within(guest).getByText(/bekliyor/)).toBeTruthy();
});

it('bağlı olmayan oyuncunun koltuğu soluk işaretlenir', () => {
  const members = [member(0), member(1, { connected: false })];
  render(<Lobby room={room({ members })} />);
  expect((seats()[1] as HTMLElement).className).toContain('is-offline');
});

it('canStart false iken "Oyunu başlat" devre dışı ve gerekçe yazılır', () => {
  const members = [member(0), member(1), member(2)];
  render(<Lobby room={room({ members, canStart: false })} />);

  const start = screen.getByRole('button', { name: 'Oyunu başlat' }) as HTMLButtonElement;
  expect(start.disabled).toBe(true);
  expect(screen.getByText('En az 5 oyuncu gerekli (3 var).')).toBeTruthy();
});

it('yeterli oyuncu varken eksik hazır gerekçesi gösterilir', () => {
  const members = Array.from({ length: 5 }, (_, i) => member(i, { ready: i < 4 }));
  render(<Lobby room={room({ members, canStart: false })} />);
  expect(screen.getByText('Herkesin hazır olması bekleniyor.')).toBeTruthy();
});

it('konuk için başlatma düğmesi yerine bilgi satırı çıkar', () => {
  render(
    <Lobby
      room={room({
        isHost: false,
        members: [member(0, { isHost: false, isLocal: true }), member(1, { isHost: true, isLocal: false })],
      })}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Oyunu başlat' })).toBeNull();
  expect(screen.getByText('Oda sahibi başlatacak.')).toBeTruthy();
});

it('hazır anahtarı durumu aria-pressed ile bildirir', () => {
  render(<Lobby room={room({ members: [member(0, { ready: true })] })} />);
  const toggle = screen.getByRole('button', { name: 'Hazır değilim' });
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
});

it('"Paylaş" düğmesi yalnız navigator.share varken görünür', () => {
  render(<Lobby room={room()} />);
  expect(screen.queryByRole('button', { name: 'Paylaş' })).toBeNull();
  cleanup();

  Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true });
  render(<Lobby room={room()} />);
  expect(screen.getByRole('button', { name: 'Paylaş' })).toBeTruthy();
});

it('oda kodu rozeti ve karakter seçici görünür', () => {
  render(<Lobby room={room()} />);
  expect(screen.getByText('ABC123')).toBeTruthy();
  expect(screen.getByRole('radiogroup', { name: 'Karakter' })).toBeTruthy();
  expect(screen.getByRole('radiogroup', { name: 'Ten tonu' })).toBeTruthy();
  // Koltuk 0 varsayılanı seçili gelir.
  expect(screen.getByRole('radio', { name: 'Bıyıklı Amca' }).getAttribute('aria-checked')).toBe('true');
});

it('D3.4 — karakter kartına tıklayınca set_avatar gönderilir', () => {
  const setAvatar = vi.fn();
  render(<Lobby room={room({}, { setAvatar })} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Fötr' }));
  expect(setAvatar).toHaveBeenCalledWith({ character: 'fotr', skin: 'acik' });
});

it('D3.4 — ten örneği seçimi karakteri korur', () => {
  const setAvatar = vi.fn();
  render(<Lobby room={room({}, { setAvatar })} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Koyu ten' }));
  expect(setAvatar).toHaveBeenCalledWith({ character: 'biyikli-amca', skin: 'koyu' });
});

it('D3.4 — aynı karakteri başkası seçtiyse farklı ten önerilir', () => {
  const setAvatar = vi.fn();
  const members = [
    member(0, { isLocal: true }),
    member(1, { isLocal: false, avatar: { character: 'fotr', skin: 'acik' } }),
  ];
  render(<Lobby room={room({ members }, { setAvatar })} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Fötr' }));
  expect(setAvatar).toHaveBeenCalledWith({ character: 'fotr', skin: 'orta' });
});

it('D3.4 — diğer oyuncuların karakteri masada görünür', () => {
  const members = [
    member(0, { isLocal: true }),
    member(1, { isLocal: false, displayName: 'Konuk', avatar: { character: 'kivircik', skin: 'koyu' } }),
  ];
  render(<Lobby room={room({ members })} />);
  const guest = seats()[1] as HTMLElement;
  expect(within(guest).getByText('Kıvırcık')).toBeTruthy();
  expect(within(guest).getByText(/Kıvırcık, koyu ten/)).toBeTruthy();
});

it('D3.4 — komut hatası lobide gösterilir', () => {
  render(<Lobby room={room({}, { transient: 'NOT_ALLOWED' })} />);
  expect(screen.getByRole('alert').textContent).toContain('Bu işleme şu anda izin yok');
});

it('D3.4 — komut uçarken seçici kapalı', () => {
  render(<Lobby room={room({}, { busy: true })} />);
  expect((screen.getByRole('radio', { name: 'Fötr' }) as HTMLButtonElement).disabled).toBe(true);
});

/**
 * D29 — kullanıcı isteği: kılavuz oda kurulduktan SONRA, lobide bir düğmeyle
 * modal olarak açılsın. İçerik oyun içi menüdeki sekmeyle aynı bileşendir.
 */
it('D29 — lobideki "Nasıl oynanır" düğmesi kılavuzu modal olarak açar', async () => {
  const members = Array.from({ length: 7 }, (_u, i) => member(i));
  render(<Lobby room={room({ members })} />);

  fireEvent.click(screen.getByRole('button', { name: 'Nasıl oynanır' }));
  const dialog = await screen.findByRole('dialog', { name: 'Nasıl oynanır' });
  expect(await within(dialog).findByRole('heading', { name: /Amaç ve roller/ })).toBeTruthy();
  // Masadaki oyuncu sayısının tahta düzeni açık gelir (7 kişi → 7-8).
  expect(within(dialog).getByRole('button', { name: '7-8' }).getAttribute('aria-pressed')).toBe(
    'true',
  );

  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nasıl oynanır' }));
});
