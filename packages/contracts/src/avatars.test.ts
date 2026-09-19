import { describe, expect, it } from 'vitest';

import {
  AVATAR_CHARACTER_IDS,
  AVATAR_SKIN_IDS,
  avatarForSeat,
  isAvatarCharacterId,
  isAvatarSkinId,
  normalizeAvatar,
  suggestSkin,
} from './avatars';
import { lobbyCommandSchema } from './schemas';
import { PROTOCOL_VERSION } from './index';

describe('avatar kimlikleri', () => {
  it('8 karakter × 3 ten, tekrarsız', () => {
    expect(AVATAR_CHARACTER_IDS).toHaveLength(8);
    expect(new Set(AVATAR_CHARACTER_IDS).size).toBe(8);
    expect(AVATAR_SKIN_IDS).toEqual(['acik', 'orta', 'koyu']);
  });

  it('koltuk varsayılanı D3.3 davranışını korur', () => {
    expect(avatarForSeat(0)).toEqual({ character: 'biyikli-amca', skin: 'acik' });
    expect(avatarForSeat(3)).toEqual({ character: 'fotr', skin: 'acik' });
    expect(avatarForSeat(9)).toEqual({ character: AVATAR_CHARACTER_IDS[1], skin: 'acik' });
    // Negatif koltuk (olmamalı) yine geçerli bir seçim döndürür.
    expect(isAvatarCharacterId(avatarForSeat(-1).character)).toBe(true);
    expect(isAvatarSkinId(avatarForSeat(-1).skin)).toBe(true);
  });

  it('normalizeAvatar geçersiz/eksik değerde koltuk varsayılanına düşer', () => {
    expect(normalizeAvatar(null, 2)).toEqual(avatarForSeat(2));
    expect(normalizeAvatar({ character: 'yok', skin: 'yok' }, 2)).toEqual(avatarForSeat(2));
    expect(normalizeAvatar({ character: 'fotr', skin: 'koyu' }, 2)).toEqual({
      character: 'fotr',
      skin: 'koyu',
    });
    // Yarım kayıt: yalnız geçerli alan kullanılır.
    expect(normalizeAvatar({ character: 'fotr', skin: null }, 2).skin).toBe(avatarForSeat(2).skin);
  });

  it('suggestSkin aynı karakterde kullanılmamış ten önerir, zorlamaz', () => {
    const taken = [{ character: 'fotr', skin: 'acik' }] as const;
    expect(suggestSkin('fotr', taken, 'acik')).toBe('orta');
    expect(suggestSkin('fotr', taken, 'koyu')).toBe('koyu');
    expect(suggestSkin('gozluklu', taken, 'acik')).toBe('acik');
    // Üç ten de doluysa tercih edilen ten geri döner (benzersizlik zorunlu değil).
    const full = AVATAR_SKIN_IDS.map((skin) => ({ character: 'fotr' as const, skin }));
    expect(suggestSkin('fotr', full, 'orta')).toBe('orta');
  });
});

describe('set_avatar şeması', () => {
  const base = { protocolVersion: PROTOCOL_VERSION, commandId: 'c1', type: 'set_avatar' as const };

  it('geçerli kimlikleri kabul eder', () => {
    expect(lobbyCommandSchema.safeParse({ ...base, character: 'fotr', skin: 'koyu' }).success).toBe(
      true,
    );
  });

  it('bilinmeyen karakter/ten reddedilir', () => {
    expect(lobbyCommandSchema.safeParse({ ...base, character: 'x', skin: 'koyu' }).success).toBe(
      false,
    );
    expect(lobbyCommandSchema.safeParse({ ...base, character: 'fotr', skin: 'x' }).success).toBe(
      false,
    );
  });
});
