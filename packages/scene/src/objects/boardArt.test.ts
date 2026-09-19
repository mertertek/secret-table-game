import { describe, expect, it } from 'vitest';
import { BOARD_LAYOUTS } from '@secret-table/contracts';
import type { BoardVariant } from '@secret-table/contracts';
import { BOARD_ICONS, BOARD_GEOMETRY, boardSlotPlans, hitlerStripSlots, slotCenterX, slotLeft } from './boardArt';

const VARIANTS: readonly BoardVariant[] = ['small', 'medium', 'large'];
const lines = (variant: BoardVariant) => boardSlotPlans('fascist', variant).map((s) => s.band?.lines.join(' ') ?? null);

describe('D10 politika tahtası düzeni', () => {
  it('üç faşist düzeni şartname §3 tablosuyla birebir üretir', () => {
    expect(lines('small')).toEqual([null, null, 'DESTE TEPESİ', 'İNFAZ', 'İNFAZ', 'FAŞİST ZAFERİ']);
    expect(lines('medium')).toEqual([null, 'SADAKAT İNCELEMESİ', 'ÖZEL SEÇİM', 'İNFAZ', 'İNFAZ', 'FAŞİST ZAFERİ']);
    expect(lines('large')).toEqual(['SADAKAT İNCELEMESİ', 'SADAKAT İNCELEMESİ', 'ÖZEL SEÇİM', 'İNFAZ', 'İNFAZ', 'FAŞİST ZAFERİ']);
  });

  it('düzeni BOARD_LAYOUTS.fascistPowers üzerinden türetir; yetkisiz yuvada bant ve hayalet ikon yok', () => {
    for (const variant of VARIANTS) {
      const plans = boardSlotPlans('fascist', variant);
      expect(plans).toHaveLength(BOARD_LAYOUTS[variant].fascistSlots);
      plans.slice(0, 5).forEach((plan, i) => {
        const power = BOARD_LAYOUTS[variant].fascistPowers[i];
        if (power === 'none') { expect(plan.band).toBeUndefined(); expect(plan.ghost).toBeUndefined(); }
        else { expect(plan.band?.icon).toBe(power); expect(plan.ghost).toBe(power); }
      });
    }
  });

  it('Hitler şeridi 3. yuvadan 6. yuvaya uzanır, liberal tahtada yoktur', () => {
    for (const variant of VARIANTS) {
      expect(hitlerStripSlots('fascist', variant)).toEqual({ from: 2, to: 5 });
      expect(hitlerStripSlots('liberal', variant)).toBeNull();
      // Şerit gerçekten 3. yuvanın solundan 6. yuvanın sağına gider.
      expect(slotLeft(2)).toBe(1024);
      expect(slotLeft(5) + BOARD_GEOMETRY.slotW).toBe(1844.5);
    }
  });

  it('VETO AÇILDI yalnız 5. yuvada (vetoUnlockAt) görünür', () => {
    for (const variant of VARIANTS) {
      const veto = boardSlotPlans('fascist', variant).map((s) => s.band?.veto ?? false);
      expect(veto).toEqual([false, false, false, false, true, false]);
      expect(BOARD_LAYOUTS[variant].vetoUnlockAt).toBe(5);
      expect(boardSlotPlans('liberal', variant).some((s) => s.band?.veto)).toBe(false);
    }
  });

  it('zafer bandı faşistte 6., liberalde 5. yuvadadır ve parti dolgusu ister', () => {
    for (const variant of VARIANTS) {
      const fascist = boardSlotPlans('fascist', variant), liberal = boardSlotPlans('liberal', variant);
      expect(fascist.map((s) => s.band?.victory ?? false)).toEqual([false, false, false, false, false, true]);
      expect(liberal.map((s) => s.band?.victory ?? false)).toEqual([false, false, false, false, true]);
      expect(fascist[5]?.band?.lines).toEqual(['FAŞİST', 'ZAFERİ']);
      expect(liberal[4]?.band?.lines).toEqual(['LİBERAL', 'ZAFERİ']);
      expect(fascist[5]?.ghost).toBe('victory');
      // Liberal 1–4 boştur: numara dışında hiçbir şey yok.
      expect(liberal.slice(0, 4).every((s) => !s.band && !s.ghost)).toBe(true);
    }
  });

  it('Türkçe büyük harf etiketler sabit dizgidir (toUpperCase "İ" bozmaz)', () => {
    const all = VARIANTS.flatMap((v) => boardSlotPlans('fascist', v).flatMap((s) => s.band?.lines ?? []));
    expect(all).toContain('İNFAZ');
    expect(all).toContain('İNCELEMESİ');
    expect(all).toContain('SEÇİM');
    expect(all.some((line) => /[ıi]/.test(line))).toBe(false);
  });

  it('yuva ızgarası PolicyBoard kart konum kesirleriyle aynı kalır', () => {
    // Tasarım ızgarası tam mm'ye yuvarlanmıştır (601 / 211,5 / 186); kart konum satırı
    // değişmediği için sapma 1 mm'nin altında kalmalı.
    for (let i = 0; i < 6; i++) {
      expect(Math.abs(slotCenterX(i) - (.358 + i * .109) * BOARD_GEOMETRY.w)).toBeLessThan(1);
      expect(Math.abs(slotLeft(i) - (.31 + i * .109) * BOARD_GEOMETRY.w)).toBeLessThan(1);
    }
    expect(Math.abs(BOARD_GEOMETRY.slotW - .096 * BOARD_GEOMETRY.w)).toBeLessThan(1);
    // Kart 253 mm; yuva 262 mm → kart yuvadan taşmaz.
    expect(BOARD_GEOMETRY.slotY1 - BOARD_GEOMETRY.slotY0).toBeGreaterThan(253);
  });

  it('ikon seti yalnız dolgu path dizgisi taşır (icons.json kopyası)', () => {
    for (const [key, paths] of Object.entries(BOARD_ICONS)) {
      expect(paths.length, key).toBeGreaterThan(0);
      for (const d of paths) { expect(d.startsWith('M'), key).toBe(true); expect(d).not.toContain('stroke'); }
    }
  });
});
