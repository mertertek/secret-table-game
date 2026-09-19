// @vitest-environment jsdom
/**
 * D19 — menü sekmeleri (Ayarlar / Nasıl oynanır) ve "Nasıl oynanır" içeriği.
 *
 * Kapsam: varsayılan sekme Ayarlar (mevcut bölümler yerinde), sekme geçişi
 * içeriği değiştirir, kural tabloları `rules.ts`tan gelen satırları çizer,
 * telefonda uzun içerik KAYDIRILABİLİR (gövde `overflow-y`, tablo kendi kabında
 * yatay kayar).
 */
import { getSceneFixture } from '@secret-table/fixtures';
import { BOARD_LAYOUTS, ROLE_SETUPS } from '@secret-table/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GameMenu } from './GameMenu';
import { howToPlaySections } from './howToPlay';
import type { Prefs } from './usePrefs';

const view = getSceneFixture('nomination')!.view;

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

function renderMenu(open = true) {
  return render(
    <GameMenu
      open={open}
      view={view}
      connectionLabel={null}
      prefs={prefs}
      setPrefs={() => undefined}
      canResume={false}
      canExitFocus={false}
      isHost
      onClose={() => undefined}
      onResume={() => undefined}
      onExitFocus={() => undefined}
      onReturnLobby={() => undefined}
      onRefresh={() => undefined}
    />,
  );
}

/**
 * D29 — sekme içeriği TEMBEL yüklenir (lobideki modalle aynı chunk); tıkladıktan
 * sonra ilk bölüm başlığı gelene kadar beklenir.
 */
async function openHowTo() {
  fireEvent.click(screen.getByRole('tab', { name: 'Nasıl oynanır' }));
  await screen.findByRole('heading', { name: /Amaç ve roller/ });
}

afterEach(cleanup);

describe('GameMenu — sekmeler', () => {
  it('varsayılan sekme Ayarlar; mevcut bölümler ve tercihler yerinde', () => {
    renderMenu();
    const settings = screen.getByRole('tab', { name: 'Ayarlar' });
    expect(settings.getAttribute('aria-selected')).toBe('true');

    const dialog = screen.getByRole('dialog', { name: 'Menü' });
    expect(dialog.textContent).toContain('Oyuncular');
    expect(dialog.textContent).toContain('Masa');
    expect(dialog.textContent).toContain('Tur geçmişi');
    expect(screen.getByLabelText('Fare hassasiyeti')).toBeTruthy();
    // "Nasıl oynanır" içeriği henüz çizilmedi.
    expect(screen.queryByRole('heading', { name: /Amaç ve roller/ })).toBeNull();
  });

  it('sekme geçişi içeriği değiştirir ve geri dönülebilir', async () => {
    renderMenu();
    await openHowTo();
    expect(screen.getByRole('tab', { name: 'Nasıl oynanır' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('heading', { name: /Amaç ve roller/ })).toBeTruthy();
    // Ayarlar içeriği artık DOM'da değil (panel tek seferde bir sekme çizer).
    expect(screen.queryByLabelText('Fare hassasiyeti')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Ayarlar' }));
    expect(screen.getByLabelText('Fare hassasiyeti')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Amaç ve roller/ })).toBeNull();
  });

  it('tabpanel sekmeye bağlıdır (erişilebilirlik)', async () => {
    renderMenu();
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe('game-menu-tab-settings');
    await openHowTo();
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(
      'game-menu-tab-howto',
    );
  });

  it('Esc menüyü kapatırken sekme seçimi paneli bozmaz', async () => {
    renderMenu();
    await openHowTo();
    // Panel hâlâ tek diyalog ve tek gövde.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(document.querySelectorAll('.game-menu__body')).toHaveLength(1);
  });
});

describe('GameMenu — Nasıl oynanır içeriği', () => {
  it('on bölüm başlığı da çizilir', async () => {
    renderMenu();
    await openHowTo();
    for (const section of howToPlaySections()) {
      expect(screen.getByRole('heading', { name: section.title })).toBeTruthy();
    }
  });

  it('rol tablosu her oyuncu sayısı için bir satır çizer', async () => {
    renderMenu();
    await openHowTo();
    const table = screen.getByRole('table', { name: /rol dağılımı/i });
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(Object.keys(ROLE_SETUPS).length);
    // 5 kişilik satır: 3 liberal / 1 faşist / 1 Hitler / Hitler bilir.
    const first = rows[0] as HTMLTableRowElement;
    const cells = [...first.querySelectorAll('th,td')].map((c) => c.textContent);
    expect(cells).toEqual(['5', '3', '1', '1', 'evet']);
  });

  it('yetki tablosu her tahta düzeni için bir satır çizer ve yetkileri adlandırır', async () => {
    renderMenu();
    await openHowTo();
    const table = screen.getByRole('table', { name: /başkanlık yetkisi/i });
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(Object.keys(BOARD_LAYOUTS).length);
    expect(table.textContent).toContain('İnfaz');
    expect(table.textContent).toContain('Sadakat incelemesi');
    expect(table.textContent).toContain('Özel seçim');
    expect(table.textContent).toContain('Deste tepesine bakma');
    expect(table.textContent).toContain('oyun biter');
  });

  it('tuş ve jest listeleri kbd olarak çizilir (G ve 8 jest)', async () => {
    renderMenu();
    await openHowTo();
    const keys = [...document.querySelectorAll('.howto__keys kbd')].map((k) => k.textContent);
    expect(keys).toContain('G');
    expect(keys).toContain('H');
    expect(keys).toContain('Esc');
    // Jest çarkı 8 dilim: 1..8 rakamları ayrı bir listede.
    const emoteList = document.querySelectorAll('.howto__keys')[1] as HTMLElement;
    expect(emoteList.querySelectorAll('.game-menu__key-row')).toHaveLength(8);
    expect(emoteList.textContent).toContain('Orta parmak');
  });

  it('telefonda kaydırılabilir: gövde dikey, tablolar kendi kabında yatay kayar', async () => {
    renderMenu();
    await openHowTo();
    const body = document.querySelector('.game-menu__body') as HTMLElement;
    expect(body).not.toBeNull();
    // Sınıf sözleşmesi: gövde dikey kaydırma kabı, tablo kabı yatay.
    const scrollers = document.querySelectorAll('.howto__table-scroll');
    expect(scrollers.length).toBeGreaterThanOrEqual(2);
    for (const scroller of scrollers) {
      expect(scroller.querySelector('table')).not.toBeNull();
    }
  });
});

// D21/F — menü her açılışta "Ayarlar"da başlar. Panel `open=false` iken
// unmount edilmediği için sekme durumu yaşıyordu: bir kez "Nasıl oynanır"a
// bakan oyuncu sonraki `M` basışlarında bağlantı/oyuncular yerine onu buluyordu.
describe('GameMenu — açılışta sekme sıfırlanır (D21/F)', () => {
  it('kapatılıp yeniden açılınca Ayarlar sekmesi seçilidir', async () => {
    const { rerender } = renderMenu();
    await openHowTo();
    expect(
      screen.getByRole('tab', { name: 'Nasıl oynanır' }).getAttribute('aria-selected'),
    ).toBe('true');

    const props = {
      view,
      connectionLabel: null,
      prefs,
      setPrefs: () => undefined,
      canResume: false,
      canExitFocus: false,
      isHost: true,
      onClose: () => undefined,
      onResume: () => undefined,
      onExitFocus: () => undefined,
      onReturnLobby: () => undefined,
      onRefresh: () => undefined,
    };
    rerender(<GameMenu open={false} {...props} />);
    rerender(<GameMenu open {...props} />);

    expect(screen.getByRole('tab', { name: 'Ayarlar' }).getAttribute('aria-selected')).toBe('true');
    expect(
      screen.getByRole('tab', { name: 'Nasıl oynanır' }).getAttribute('aria-selected'),
    ).toBe('false');
  });
});
