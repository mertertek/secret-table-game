import { describe, expect, it } from 'vitest';

import { errorText, powerActionText } from './text';

describe('errorText — QA-R04', () => {
  it('büyük harfli ham kodu Türkçe açıklamaya çevirir (SERVICE_UNAVAILABLE)', () => {
    const text = errorText('SERVICE_UNAVAILABLE');
    expect(text).not.toBe('SERVICE_UNAVAILABLE');
    expect(text).toMatch(/ulaşılamıyor/i);
    expect(text).toMatch(/tekrar dene/i); // uygulanabilir sonraki adım
  });

  it('messageKey biçimini de çözer (error.service_unavailable)', () => {
    expect(errorText('error.service_unavailable')).toBe(errorText('SERVICE_UNAVAILABLE'));
  });

  it('bilinen sözleşme kodlarında ham kodu göstermez ve adım içerir', () => {
    for (const code of ['NOT_ALLOWED', 'STALE_ACTION', 'RATE_LIMITED', 'VERSION_MISMATCH', 'ROOM_NOT_FOUND']) {
      const text = errorText(code);
      expect(text).not.toBe(code);
      expect(text.length).toBeGreaterThan(15);
    }
  });

  it('bilinmeyen kod görünümlü anahtarda ham kodu tek başına göstermez', () => {
    const text = errorText('WAT_IS_THIS_9000');
    expect(text).not.toContain('WAT_IS_THIS_9000');
    expect(text).toMatch(/tekrar dene/i);
  });

  it('boş/null anahtarda jenerik Türkçe metin döner', () => {
    expect(errorText(null)).toMatch(/hata/i);
    expect(errorText(undefined)).toMatch(/hata/i);
  });

  it('insan mesajını (boşluklu) olduğu gibi geçirir', () => {
    expect(errorText('Oturum yenilenemedi.')).toBe('Oturum yenilenemedi.');
  });
});

describe('powerActionText — QA-R03', () => {
  it('infazda hedefin eleneceğini açıkça söyler', () => {
    const p = powerActionText('execution');
    expect(p.title).toBe('İnfaz');
    expect(p.submitLabel).toMatch(/nfaz/); // "İnfaz et"
    expect(p.consequence('Bot-Gul')).toMatch(/Bot-Gul/);
    expect(p.consequence('Bot-Gul')).toMatch(/elen/i);
  });

  it('her yetki için ayrı başlık ve sonuç metni verir', () => {
    for (const power of ['investigate_loyalty', 'call_special_election', 'policy_peek'] as const) {
      const p = powerActionText(power);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.submitLabel).not.toBe('Gönder');
      expect(p.consequence('X').length).toBeGreaterThan(0);
    }
  });
});
