// @vitest-environment jsdom
/** ROADMAP B6 — `/katil/:code` ekranı: davet rozeti ve isim koşulu. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('./nameStore', () => ({ loadName: () => '', saveName: () => undefined }));

import { JoinPage } from './JoinPage';

afterEach(cleanup);

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/katil/:code" element={<JoinPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

it('davet kodunu rozet olarak büyük harfle gösterir', () => {
  mount('/katil/abc234');
  expect(screen.getByText('Davet')).toBeTruthy();
  expect(screen.getByText('ABC234')).toBeTruthy();
});

it('ad boşken "Katıl" devre dışı', () => {
  mount('/katil/ABC234');
  const join = screen.getByRole('button', { name: 'Katıl' }) as HTMLButtonElement;
  expect(join.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('Görünen adın'), { target: { value: 'Mert' } });
  expect(join.disabled).toBe(false);
});

it('ana sayfaya dönüş bağlantısı vardır', () => {
  mount('/katil/ABC234');
  expect(screen.getByRole('button', { name: '← Ana sayfaya dön' })).toBeTruthy();
});
