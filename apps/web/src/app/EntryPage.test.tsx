// @vitest-environment jsdom
/**
 * ROADMAP B6 — giriş ekranı: isim/kod doğrulaması, kod biçimlendirme,
 * `?code=` ön dolumu ve "Nasıl oynanır" şeridi.
 *
 * Ağ katmanı çağrılmaz: testler yalnız gönderim ÖNCESİ durumu okur.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

// Kayıtlı ad testler arasında sızmasın; `nameStore` ayrıca kendi başına test edilmiyor.
vi.mock('./nameStore', () => ({ loadName: () => '', saveName: () => undefined }));

import { EntryPage, normalizeInviteCode } from './EntryPage';

afterEach(cleanup);

function mount(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EntryPage />
    </MemoryRouter>,
  );
}

it('ad boşken "Oda aç" devre dışı, ad yazılınca etkin olur', () => {
  mount();
  const open = screen.getByRole('button', { name: 'Oda aç' }) as HTMLButtonElement;
  expect(open.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('Görünen adın'), { target: { value: 'Mert' } });
  expect(open.disabled).toBe(false);
});

it('davet kodu alanı büyük harfe çevirir, geçersiz karakteri atar ve 6 karakterde durur', () => {
  mount();
  const code = screen.getByLabelText('Davet kodu') as HTMLInputElement;

  fireEvent.change(code, { target: { value: 'abc-234xy' } });
  expect(code.value).toBe('ABC234');
});

it('kod 6 karakter olmadan "Davet koduyla katıl" devre dışı', () => {
  mount();
  const join = screen.getByRole('button', { name: 'Davet koduyla katıl' }) as HTMLButtonElement;
  expect(join.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('Davet kodu'), { target: { value: 'abc23' } });
  expect(join.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('Davet kodu'), { target: { value: 'abc234' } });
  expect(join.disabled).toBe(false);
});

it('`?code=` ile gelindiğinde kod alanı dolu gelir', () => {
  mount('/?code=xy7zq9');
  expect((screen.getByLabelText('Davet kodu') as HTMLInputElement).value).toBe('XY7ZQ9');
});

it('"Nasıl oynanır" şeridi üç adım gösterir', () => {
  mount();
  const steps = screen.getByRole('list');
  expect(steps.querySelectorAll('li')).toHaveLength(3);
  expect(screen.getByText('Oda aç ve bağlantıyı gönder')).toBeTruthy();
  expect(screen.getByText('Herkes hazır olunca başlat')).toBeTruthy();
  expect(screen.getByText('Rolünü öğren, oy ver, kanun çıkar')).toBeTruthy();
});

it('normalizeInviteCode Türkçe küçük harf ve boşlukları temizler', () => {
  expect(normalizeInviteCode(' ab c2 3 4 ')).toBe('ABC234');
  expect(normalizeInviteCode('abc234zz')).toBe('ABC234');
});

/**
 * D29 — üç adımlık şerit "bu sayfada ne yapacağım"ı söyler; oyunun KURALLARI
 * artık aynı yerdeki düğmenin açtığı modaldedir. Solo oyun (D26) lobiyi
 * atladığı için kılavuza giriş ekranından da ulaşılabilmesi gerekir.
 */
it('D29 — giriş ekranındaki düğme kılavuz modalini açar', async () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Nasıl oynanır' }));
  const dialog = await screen.findByRole('dialog', { name: 'Nasıl oynanır' });
  expect(await within(dialog).findByRole('heading', { name: /Amaç ve roller/ })).toBeTruthy();
  // Tahta görseli de gelir (kart/tahta resimleriyle anlatım).
  expect(dialog.querySelector('[data-art="boards"]')).not.toBeNull();
});
