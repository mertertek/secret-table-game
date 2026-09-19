// @vitest-environment jsdom
/**
 * CODEX-012 / QA-R02 — sahne, HTML ve klavye kontrolleri özel bilgi panelini tek
 * kaynaktan yönetir; biri diğerinin gizleme işlemini tersine çevirmez.
 *
 * Gerçek `RolePanel` bileşeni render edilir. Sahne tarafı, `useRoomState.onIntent`
 * ile birebir aynı çözümle (`nextRolePanelOpen`) taklit edilir — uzak oturum veya
 * gerçek `TableScene` (WebGL) çalıştırılmaz.
 */
import { useState } from 'react';
import type { SceneIntent } from '@secret-table/contracts';
import { getSceneFixture } from '@secret-table/fixtures';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { nextRolePanelOpen } from '../multiplayer/rolePanel';
import { RolePanel } from './RolePanel';

afterEach(cleanup);

const view = getSceneFixture('role-reveal-liberal')!.view;

/** `useRoomState`'in çapraz kontrol kablolaması: HTML "Göster/Gizle" ve sahne
 *  `inspect_own_role` niyeti aynı tek `open` state'ine gider. */
function Harness() {
  const [open, setOpen] = useState(false);
  const sceneIntent = (intent: SceneIntent) => {
    if (intent.type === 'inspect_own_role') setOpen((cur) => nextRolePanelOpen(cur, intent));
  };
  return (
    <>
      <button
        type="button"
        data-testid="scene-bare"
        onClick={() => sceneIntent({ type: 'inspect_own_role' })}
      >
        sahne yönsüz
      </button>
      <button
        type="button"
        data-testid="scene-close"
        onClick={() => sceneIntent({ type: 'inspect_own_role', open: false })}
      >
        sahne kapat
      </button>
      <button
        type="button"
        data-testid="scene-open"
        onClick={() => sceneIntent({ type: 'inspect_own_role', open: true })}
      >
        sahne aç
      </button>
      <RolePanel view={view} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Panel gövdesi yalnız açıkken DOM'da bulunur. */
const isOpen = () => document.getElementById('role-panel-body') != null;

describe('RolePanel çapraz kontrol — CODEX-012', () => {
  it('sahne / HTML kontrolleri birbirinin gizleme işlemini geri almaz', () => {
    render(<Harness />);
    expect(isOpen()).toBe(false);

    // 1) Sahne "Kimliği aç" (yönsüz eski niyet) → açılır.
    fireEvent.click(screen.getByTestId('scene-bare'));
    expect(isOpen()).toBe(true);

    // 2) HTML "Gizle" → kapanır.
    fireEvent.click(screen.getByRole('button', { name: 'Gizle' }));
    expect(isOpen()).toBe(false);

    // 3) HTML "Göster" → açılır.
    fireEvent.click(screen.getByRole('button', { name: 'Göster' }));
    expect(isOpen()).toBe(true);

    // 4) Sahne "Kimliği kapat" ({open:false}) → kapanır ve KAPALI kalır
    //    (HTML panelini yeniden açmaz).
    fireEvent.click(screen.getByTestId('scene-close'));
    expect(isOpen()).toBe(false);
  });

  it('yönsüz inspect_own_role açık paneli toggle ile kapatmaz (regresyon)', () => {
    render(<Harness />);

    fireEvent.click(screen.getByTestId('scene-open')); // {open:true}
    expect(isOpen()).toBe(true);

    // Eski davranış `intent.open ?? !current` bunu kapatırdı; yeni davranış hep "aç".
    fireEvent.click(screen.getByTestId('scene-bare'));
    expect(isOpen()).toBe(true);
  });
});

describe('nextRolePanelOpen — birim', () => {
  it('yön verilmezse her zaman true döner', () => {
    expect(nextRolePanelOpen(false, { type: 'inspect_own_role' })).toBe(true);
    expect(nextRolePanelOpen(true, { type: 'inspect_own_role' })).toBe(true);
  });

  it('yön verilirse ona uyar', () => {
    expect(nextRolePanelOpen(true, { type: 'inspect_own_role', open: false })).toBe(false);
    expect(nextRolePanelOpen(false, { type: 'inspect_own_role', open: true })).toBe(true);
  });
});
