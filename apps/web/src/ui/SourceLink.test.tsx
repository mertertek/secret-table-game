// @vitest-environment jsdom
/**
 * D30 — depo bağlantısı her iki dilde görünür ve doğru adrese gider.
 * Gerekçe: bir paylaşımda ~3-4 bin görüntülenme sonrası sıfır yıldız geldi;
 * ölçüldü ki arayüzde hiç GitHub bağlantısı yoktu.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { SourceLink, REPO_URL } from './SourceLink';
import { setLanguage } from '../i18n';

afterEach(() => { cleanup(); setLanguage('tr'); });

describe('SourceLink', () => {
  it('yeni sekmede güvenli biçimde depoya gider', () => {
    render(<SourceLink />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(REPO_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('iki dilde de metin taşır', () => {
    setLanguage('en');
    render(<SourceLink />);
    expect(screen.getByRole('link').textContent).toContain('GitHub');
    cleanup();
    setLanguage('tr');
    render(<SourceLink />);
    expect(screen.getByRole('link').textContent).toContain('GitHub');
  });
});
