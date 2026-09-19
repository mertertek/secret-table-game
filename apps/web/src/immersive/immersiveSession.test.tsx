// @vitest-environment jsdom
/**
 * `useImmersiveSession` — desteklenmeyen ortamda güvenli davranış (FINISH_PLAN §2:
 * "Desteklenmeyen cihazda mevcut sürükle/klavye/touch kontrolleri çalışır").
 *
 * jsdom'da Fullscreen / Pointer Lock API'leri yoktur; gerçek kilit giriş/çıkış
 * doğrulaması tarayıcıda elle yapılır (docs/qa/claude/FINAL-INTEGRATION.md).
 */
import { useRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useImmersiveSession } from './useImmersiveSession';

afterEach(cleanup);

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  const s = useImmersiveSession(ref);
  return (
    <div ref={ref}>
      <span data-testid="supported">{String(s.supported)}</span>
      <span data-testid="fullscreen">{String(s.fullscreen)}</span>
      <span data-testid="locked">{String(s.locked)}</span>
      <span data-testid="needsResume">{String(s.needsResume)}</span>
      <button type="button" data-testid="enter" onClick={s.enter}>
        enter
      </button>
      <button type="button" data-testid="exit" onClick={s.exit}>
        exit
      </button>
      <button type="button" data-testid="release" onClick={s.releaseLock}>
        release
      </button>
    </div>
  );
}

describe('useImmersiveSession', () => {
  it('API yoksa güvenli varsayılan durum döner', () => {
    render(<Harness />);
    // jsdom: requestFullscreen / pointerLock yok.
    expect(screen.getByTestId('supported').textContent).toBe('false');
    expect(screen.getByTestId('fullscreen').textContent).toBe('false');
    expect(screen.getByTestId('locked').textContent).toBe('false');
    expect(screen.getByTestId('needsResume').textContent).toBe('false');
  });

  it('enter / exit / releaseLock desteklenmeyen ortamda hata fırlatmaz', () => {
    render(<Harness />);
    expect(() => {
      screen.getByTestId('enter').click();
      screen.getByTestId('release').click();
      screen.getByTestId('exit').click();
    }).not.toThrow();
  });
});
