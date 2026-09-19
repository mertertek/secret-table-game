// @vitest-environment jsdom
/**
 * D29 — "Nasıl oynanır" modali: açılış/kapanış yolları, odak yönetimi ve
 * görsellerin `BOARD_LAYOUTS`tan türemiş kalması.
 *
 * İçerik TEMBEL yüklendiği için her açılıştan sonra `findBy…` beklenir.
 */
import { BOARD_LAYOUTS } from '@secret-table/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HowToPlayButton } from './HowToPlayModal';

afterEach(cleanup);

/** Düğmeye basar ve tembel içerik gelene kadar bekler. */
async function open(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: 'Nasıl oynanır' }));
  const dialog = await screen.findByRole('dialog', { name: 'Nasıl oynanır' });
  await screen.findByRole('heading', { name: /Amaç ve roller/ });
  return dialog;
}

describe('HowToPlayModal — açılır ve kapanır', () => {
  it('başlangıçta yalnız düğme vardır, modal yoktur', () => {
    render(<HowToPlayButton />);
    const button = screen.getByRole('button', { name: 'Nasıl oynanır' });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('düğme modali açar: role=dialog, aria-modal, başlık bağlı', async () => {
    render(<HowToPlayButton />);
    const dialog = await open();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('howto-modal-title');
    expect(screen.getByRole('button', { name: 'Nasıl oynanır' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('Escape kapatır ve odak düğmeye döner', async () => {
    render(<HowToPlayButton />);
    const dialog = await open();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nasıl oynanır' }));
  });

  it('zemine tıklamak kapatır', async () => {
    render(<HowToPlayButton />);
    await open();
    fireEvent.click(screen.getByTestId('howto-modal-scrim'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nasıl oynanır' }));
  });

  it('"Kapat" düğmesi kapatır', async () => {
    render(<HowToPlayButton />);
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kapat' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('modal açıkken sayfa gövdesi kaydırılmaz, kapanınca geri döner', async () => {
    render(<HowToPlayButton />);
    await open();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByTestId('howto-modal-scrim'));
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'));
  });
});

describe('HowToPlayModal — odak yönetimi', () => {
  it('açılınca odak başlığa gider', async () => {
    render(<HowToPlayButton />);
    await open();
    expect(document.activeElement).toBe(document.getElementById('howto-modal-title'));
  });

  it('Tab odağı panelin içinde döndürür (odak tuzağı)', async () => {
    render(<HowToPlayButton />);
    const dialog = await open();
    const sheet = dialog.querySelector('.howto-modal__sheet') as HTMLElement;
    const focusable = [
      ...sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ];
    expect(focusable.length).toBeGreaterThan(1);
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    // Son öğeden ileri Tab → ilk öğeye sarar.
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    // Başlıktan geri Tab → son öğeye sarar (başlık paneldeki ilk duraktır).
    (document.getElementById('howto-modal-title') as HTMLElement).focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

describe('HowToPlayModal — görseller kurallardan türer', () => {
  it('kart, tahta ve oy pusulası görselleri çizilir', async () => {
    render(<HowToPlayButton />);
    const dialog = await open();
    // Rol kartları (sahne sözlüğündeki kart dizgileriyle etiketli).
    const named = (name: string) => within(dialog).getAllByRole('img', { name }).length;
    expect(named('GİZLİ KİMLİK · HİTLER')).toBeGreaterThan(0);
    expect(named('GİZLİ KİMLİK · LİBERAL')).toBe(1);
    expect(named('GİZLİ KİMLİK · FAŞİST')).toBe(1);
    // Oy pusulaları.
    expect(named('OY PUSULASI · EVET')).toBe(1);
    expect(named('OY PUSULASI · HAYIR')).toBe(1);
    // Politika kartları ve kimlik zarfı.
    expect(named('POLİTİKA · FAŞİST')).toBeGreaterThan(0);
    expect(named('POLİTİKA · LİBERAL')).toBeGreaterThan(0);
    expect(named('KİMLİK')).toBe(1);
    // Her bölüm görseli bir `figure` olarak çizilir.
    expect(dialog.querySelectorAll('.howto__figure')).toHaveLength(9);
  });

  it('varsayılan tahta oyuncu sayısının düzenidir; yuva ikonları BOARD_LAYOUTS`tan gelir', async () => {
    render(<HowToPlayButton playerCount={7} />);
    const dialog = await open();
    const figure = dialog.querySelector('[data-art="boards"]') as HTMLElement;

    // 7 kişi → "7-8" düzeni seçili.
    expect(within(figure).getByRole('button', { name: '7-8' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(
      within(figure).getByRole('img', { name: /FAŞİST tahtası · 6 yuva · 7–8 oyuncu düzeni/ }),
    ).toBeTruthy();
    expect(
      within(figure).getByRole('img', { name: /LİBERAL tahtası · 5 yuva · 7–8 oyuncu düzeni/ }),
    ).toBeTruthy();

    // 7-8 düzeninde SADAKAT İNCELEMESİ bir kez (2. yuva) açıklama listesinde.
    const legends = figure.querySelectorAll('.howto-art__legend');
    const fascistLegend = legends[1] as HTMLElement;
    expect(within(fascistLegend).getAllByText('Sadakat incelemesi')).toHaveLength(1);
    expect(BOARD_LAYOUTS.medium.fascistPowers[1]).toBe('investigate_loyalty');
  });

  it('düzen anahtarı 9-10`a geçince iki sadakat incelemesi görünür', async () => {
    render(<HowToPlayButton playerCount={7} />);
    const dialog = await open();
    const figure = dialog.querySelector('[data-art="boards"]') as HTMLElement;

    fireEvent.click(within(figure).getByRole('button', { name: '9-10' }));
    const fascistLegend = figure.querySelectorAll('.howto-art__legend')[1] as HTMLElement;
    expect(within(fascistLegend).getAllByText('Sadakat incelemesi')).toHaveLength(2);
    expect(
      BOARD_LAYOUTS.large.fascistPowers.filter((p) => p === 'investigate_loyalty'),
    ).toHaveLength(2);
    expect(
      within(figure).getByRole('img', { name: /FAŞİST tahtası · 6 yuva · 9–10 oyuncu düzeni/ }),
    ).toBeTruthy();
  });
});
