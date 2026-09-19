// @vitest-environment jsdom
/**
 * D14 — menüdeki "Geliştirici" SEKMESİ (yalnız `import.meta.env.DEV`).
 *
 * D19: bölüm artık kendi sekmesinde; testler önce "Geliştirici" sekmesine
 * geçiyor (tembel `import()` o tıklamada çözülür).
 *
 * Vitest'te `import.meta.env.DEV` `true`; üretim paketinde `GameMenu` içindeki
 * `import.meta.env.DEV ? lazy(() => import(...)) : null` dalı derlemede düşer ve
 * `dev/devScenarioMenu` chunk'ı hiç üretilmez (build çıktısında `dev_scenario` /
 * "Geliştirici" aranarak doğrulandı — docs/qa/claude/D14-dev-scenario.md).
 */
import { getSceneFixture } from '@secret-table/fixtures';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  sendLobbyCommand: vi.fn(async () => ({ ok: true as const, data: { ok: true } })),
}));

vi.mock('../multiplayer/apiClient', () => ({
  sendLobbyCommand: hoisted.sendLobbyCommand,
}));
vi.mock('../multiplayer/guestSession', () => ({
  ensureGuestSession: async () => ({ userId: 'u1', accessToken: 'dev:u1', mode: 'dev' as const }),
  currentAccessToken: async () => 'dev:u1',
}));

import { GameMenu } from './GameMenu';
import type { Prefs } from './usePrefs';

const view = getSceneFixture('nomination')!.view;

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

const prefs: Prefs = {
  quality: 'standard',
  reducedMotion: false,
  announcements: true,
  soundEnabled: true,
  sensitivity: 1,
  cameraMode: 'seat',
  fullscreenHintSeen: true,
  language: 'tr' as const,
};

/** D19 — dev bölümü sekme arkasında: önce sekmeye geç. */
async function openDevTab() {
  const tab = await screen.findByRole('tab', { name: 'Geliştirici' });
  tab.click();
  return tab;
}

function renderMenu(onRefresh = () => undefined, isHost = true) {
  return render(
    <GameMenu
      open
      view={view}
      connectionLabel={null}
      prefs={prefs}
      setPrefs={() => undefined}
      canResume={false}
      canExitFocus={false}
      isHost={isHost}
      onClose={() => undefined}
      onResume={() => undefined}
      onExitFocus={() => undefined}
      onReturnLobby={() => undefined}
      onRefresh={onRefresh}
    />,
  );
}

afterEach(cleanup);
beforeEach(() => {
  hoisted.sendLobbyCommand.mockClear();
});

describe('GameMenu — Geliştirici bölümü (DEV)', () => {
  it('DEV derlemesinde sekme, başlık ve tüm senaryo düğmeleri görünür', async () => {
    renderMenu();
    await openDevTab();
    expect(await screen.findByRole('heading', { name: 'Geliştirici' })).toBeTruthy();
    for (const label of [
      'İnfaza atla (şimdi)',
      'İnfaz turu (kanunlar hazır)',
      'Sadakat incelemesi (şimdi)',
      'Özel seçim (şimdi)',
      'Veto turu (şansölye sen)',
      'Veto turu (başkan sen)',
      'Hitler bölgesi (3 faşist kanun)',
      'Kaos turu (sayaç 2)',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(escapeRe(label)) })).toBeTruthy();
    }
  });

  it('oyuncu sayısına uymayan senaryo devre dışı ve gerekçesi yazılı', async () => {
    // Fixture masası 7 kişilik: `investigate_loyalty` VAR, `policy_peek` YOK.
    renderMenu();
    await openDevTab();
    const investigate = await screen.findByRole('button', { name: /Sadakat incelemesi/ });
    expect((investigate as HTMLButtonElement).disabled).toBe(false);
    const peek = screen.getByRole('button', { name: /Deste tepesi/ });
    expect((peek as HTMLButtonElement).disabled).toBe(true);
    expect(peek.textContent).toContain('5-6 kişi gerekir');
  });

  it('düğme `dev_scenario` lobi komutunu gönderir ve görünümü tazeler', async () => {
    const refresh = vi.fn();
    renderMenu(refresh);
    await openDevTab();
    const button = await screen.findByRole('button', { name: 'İnfaza atla (şimdi)' });
    button.click();

    await waitFor(() => {
      expect(hoisted.sendLobbyCommand).toHaveBeenCalledTimes(1);
    });
    const [token, roomId, command] = hoisted.sendLobbyCommand.mock.calls[0] as unknown as [
      string,
      string,
      { type: string; scenario: string; commandId: string },
    ];
    expect(token).toBe('dev:u1');
    expect(roomId).toBe(view.roomId);
    expect(command.type).toBe('dev_scenario');
    expect(command.scenario).toBe('execution_now');
    expect(command.commandId.length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('ikinci düğme infaz turu senaryosunu gönderir', async () => {
    renderMenu();
    await openDevTab();
    const button = await screen.findByRole('button', { name: 'İnfaz turu (kanunlar hazır)' });
    button.click();
    await waitFor(() => {
      expect(hoisted.sendLobbyCommand).toHaveBeenCalledTimes(1);
    });
    const command = (hoisted.sendLobbyCommand.mock.calls[0] as unknown as unknown[])[2] as {
      scenario: string;
    };
    expect(command.scenario).toBe('execution_round');
  });

  it('sunucu reddederse hata menüde gösterilir', async () => {
    hoisted.sendLobbyCommand.mockResolvedValueOnce({
      ok: true as const,
      data: { ok: false, error: 'NOT_ALLOWED' },
    } as never);
    renderMenu();
    await openDevTab();
    const button = await screen.findByRole('button', { name: 'İnfaza atla (şimdi)' });
    button.click();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('NOT_ALLOWED');
  });

  // D21/I — `INVALID_OPTION` tek bir nedene bağlanmaz: HAM kod her zaman
  // yazılır, oyuncu sayısı yalnız "muhtemel neden" olarak anılır (aynı kod
  // geçersiz/eksik `optionId` için de gelir).
  it('INVALID_OPTION yanıtında ham kod ve olası nedenler yazılır', async () => {
    hoisted.sendLobbyCommand.mockResolvedValueOnce({
      ok: true as const,
      data: { ok: false, error: 'INVALID_OPTION' },
    } as never);
    renderMenu();
    await openDevTab();
    (await screen.findByRole('button', { name: 'İnfaza atla (şimdi)' })).click();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('INVALID_OPTION');
    expect(alert.textContent).toContain('SCENARIO_NEEDS_PLAYERS');
    expect(alert.textContent).toContain('geçersiz seçenek');
  });

  // D21/K — senaryoları yalnız oda sahibi uygulayabilir (sunucu da reddeder).
  it('host olmayan oyuncuda tüm senaryolar devre dışı ve neden yazılı', async () => {
    renderMenu(() => undefined, false);
    await openDevTab();
    expect(await screen.findByRole('heading', { name: 'Geliştirici' })).toBeTruthy();
    const button = screen.getByRole('button', { name: /İnfaza atla/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.textContent).toContain('oda sahibi gerekir');
    expect(document.body.textContent).toContain('Oda sahibi değilsin');
    button.click();
    expect(hoisted.sendLobbyCommand).not.toHaveBeenCalled();
  });
});
