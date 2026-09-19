/**
 * D3.4 — lobi metin tablosu tasarım kaynağıyla eşleşmeli.
 *
 * `avatarText.ts` adları/renkleri KOPYALAR (lobi paketi 47 KB'lık tasarım
 * JSON'unu ve three'yi indirmesin). Bu test JSON'u YALNIZ TESTTE okur ve iki
 * tarafın kaymasını yakalar.
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_CHARACTER_IDS, AVATAR_SKIN_IDS } from '@secret-table/contracts';

import spec from '../../../../docs/design/d3/characters.json';
import { AVATAR_ACCENT, avatarLabel, avatarText, skinText } from './avatarText';

type DesignCharacter = { id: string; name: string; tagline: string; accent: string };
type DesignSkin = { id: string; base: string };
const design = spec as unknown as {
  characters: readonly DesignCharacter[];
  skins: readonly DesignSkin[];
};

describe('avatarText', () => {
  it('her karakter kimliği için ad, özet ve vurgu rengi vardır', () => {
    for (const id of AVATAR_CHARACTER_IDS) {
      const entry = avatarText(id);
      expect(entry, id).toBeDefined();
      expect(entry.name.length, id).toBeGreaterThan(0);
      expect(entry.accent, id).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(Object.keys(AVATAR_ACCENT).sort()).toEqual([...AVATAR_CHARACTER_IDS].sort());
  });

  it('ad / özet / vurgu tasarım JSON`u ile birebir aynı', () => {
    for (const character of design.characters) {
      const entry = avatarText(character.id as (typeof AVATAR_CHARACTER_IDS)[number]);
      expect(entry.name, character.id).toBe(character.name);
      expect(entry.tagline, character.id).toBe(character.tagline);
      expect(entry.accent, character.id).toBe(character.accent);
    }
  });

  it('ten örnekleri tasarımdaki `skins[].base` renkleridir', () => {
    for (const skin of design.skins) {
      expect(skinText(skin.id as (typeof AVATAR_SKIN_IDS)[number]).swatch, skin.id).toBe(skin.base);
    }
  });

  it('erişilebilir etiket "Ad, ten" biçimindedir', () => {
    expect(avatarLabel('fotr', 'koyu')).toBe('Fötr, koyu ten');
  });
});
