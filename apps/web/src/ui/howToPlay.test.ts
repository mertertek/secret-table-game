/**
 * D19 — "Nasıl oynanır" içeriğinin KURAL KAYNAĞIYLA tutarlılığı.
 *
 * Bu testin amacı metnin güzelliği değil: sekmedeki sayıların elle yazılmadığını
 * ve `rules.ts` / `controlScheme.ts` / `viewpoint.ts` değişirse içeriğin
 * kendiliğinden doğru kaldığını (ya da testin kırılacağını) garanti eder.
 */

import { describe, expect, it } from 'vitest';

import {
  BOARD_LAYOUTS,
  CHANCELLOR_DRAW_COUNT,
  ELECTION_TRACKER_MAX,
  EMOTE_KINDS,
  EMOTE_LABEL,
  POLICY_DECK_COMPOSITION,
  PRESIDENT_DRAW_COUNT,
  REDUCED_TERM_LIMIT_ALIVE_THRESHOLD,
  ROLE_SETUPS,
  type PlayerCount,
} from '@secret-table/contracts';

import { KEY_BINDINGS, OPTION_DIGITS } from '../immersive/controlScheme';
import {
  boardSlotArt,
  boardVariantOptions,
  howToPlaySections,
  keyboardRows,
  emoteRows,
  hitlerKnowsFascistsCounts,
  playerCountsWithPower,
  powerTable,
  powerUsageBlocks,
  roleSetupTable,
  variantForPlayers,
  type HowToPlayBlock,
} from './howToPlay';
import { powerNames } from './text';

/** Bölümdeki tüm metni tek dizeye indirir (arama kolaylığı). */
function flatten(blocks: readonly HowToPlayBlock[]): string {
  const out: string[] = [];
  for (const block of blocks) {
    if (block.kind === 'text') out.push(block.text);
    else if (block.kind === 'list') out.push(...block.items);
    else if (block.kind === 'keys') out.push(...block.rows.map((r) => `${r.keys} ${r.label}`));
    // D29 — görsel bloğunda yalnız altyazı metindir; çizim `howToPlayArt.tsx`te.
    else if (block.kind === 'art') out.push(block.caption);
    else out.push(block.caption, ...block.head, ...block.rows.map((r) => r.join(' ')));
  }
  return out.join('\n');
}

const ALL_TEXT = howToPlaySections().map((s) => `${s.title}\n${flatten(s.blocks)}`).join('\n');

function sectionById(id: string) {
  const found = howToPlaySections().find((s) => s.id === id);
  if (!found) throw new Error(`bölüm yok: ${id}`);
  return found;
}

describe('howToPlay — bölüm yapısı', () => {
  it('görev listesindeki 10 bölüm sırayla var', () => {
    expect(howToPlaySections().map((s) => s.id)).toEqual([
      'amac',
      'tur',
      'yasama',
      'sayac',
      'kisit',
      'yetkiler',
      'veto',
      'hitler',
      'zafer',
      'kontrol',
    ]);
  });

  it('her bölümün başlığı ve en az bir bloğu var; kimlikler benzersiz', () => {
    const ids = new Set<string>();
    for (const section of howToPlaySections()) {
      expect(section.title.length).toBeGreaterThan(3);
      expect(section.blocks.length).toBeGreaterThan(0);
      expect(ids.has(section.id)).toBe(false);
      ids.add(section.id);
    }
  });

  it('metin Türkçe (İngilizce kural terimi sızmamış)', () => {
    for (const word of ['president', 'chancellor', 'policy', 'fascist ', 'veto power']) {
      expect(ALL_TEXT.toLowerCase()).not.toContain(word);
    }
  });
});

describe('howToPlay — rol tablosu ROLE_SETUPS ile aynı', () => {
  const table = roleSetupTable();

  it('satır sayısı ve değerler ROLE_SETUPS ile birebir', () => {
    const counts = Object.keys(ROLE_SETUPS).map((k) => Number(k) as PlayerCount).sort((a, b) => a - b);
    expect(table.rows).toHaveLength(counts.length);
    counts.forEach((count, index) => {
      const setup = ROLE_SETUPS[count];
      expect(table.rows[index]).toEqual([
        `${count}`,
        `${setup.liberals}`,
        `${setup.fascists}`,
        '1',
        setup.hitlerKnowsFascists ? 'evet' : 'hayır',
      ]);
    });
  });

  it('her satırda liberal + faşist + Hitler = oyuncu sayısı', () => {
    for (const row of table.rows) {
      const [count, liberals, fascists, hitler] = row.map(Number);
      expect((liberals ?? 0) + (fascists ?? 0) + (hitler ?? 0)).toBe(count);
    }
  });

  it('Hitler faşistleri bilen masalar ROLE_SETUPS`tan gelir', () => {
    const expected = Object.values(ROLE_SETUPS)
      .filter((s) => s.hitlerKnowsFascists)
      .map((s) => s.playerCount);
    expect(hitlerKnowsFascistsCounts()).toEqual(expected);
    // 1. bölüm metni bu masaları adıyla söyler.
    expect(flatten(sectionById('amac').blocks)).toContain(expected.join('-'));
  });
});

describe('howToPlay — yetki tablosu BOARD_LAYOUTS ile aynı', () => {
  const table = powerTable();

  it('her düzen için bir satır; hücreler fascistPowers ile eşleşir', () => {
    const layouts = Object.values(BOARD_LAYOUTS);
    expect(table.rows).toHaveLength(layouts.length);
    // Başlık: oyuncu sütunu + yuva sayısı.
    expect(table.head).toHaveLength(1 + layouts[0]!.fascistSlots);

    layouts.forEach((layout, index) => {
      const row = table.rows[index] as readonly string[];
      const counts = [...layout.playerCounts];
      expect(row[0]).toBe(
        counts[0] === counts[counts.length - 1]
          ? `${counts[0]}`
          : `${counts[0]}-${counts[counts.length - 1]}`,
      );
      layout.fascistPowers.forEach((power, slot) => {
        const cell = row[slot + 1];
        if (slot === layout.fascistSlots - 1 && power === 'none') {
          expect(cell).toBe('oyun biter');
        } else if (power === 'none') {
          expect(cell).toBe('—');
        } else {
          expect(cell).toBe(powerNames()[power]);
        }
      });
    });
  });

  it('yetkinin bulunduğu oyuncu sayıları düzenlerden türer', () => {
    expect(playerCountsWithPower('investigate_loyalty')).toEqual([7, 8, 9, 10]);
    expect(playerCountsWithPower('call_special_election')).toEqual([7, 8, 9, 10]);
    expect(playerCountsWithPower('policy_peek')).toEqual([5, 6]);
    expect(playerCountsWithPower('execution')).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('dört yetkinin de "bu oyunda" açıklaması var', () => {
    const items = powerUsageBlocks().items.join('\n');
    for (const name of Object.values(powerNames())) {
      expect(items).toContain(name);
    }
    // Kritik kural ayrıntıları metinde geçiyor.
    expect(items).toContain('YALNIZ BİR KEZ'); // aynı oyuncu iki kez incelenemez
    expect(items).toContain('SIRASINI DEĞİŞTİREMEZ'); // deste tepesi
    expect(items).toContain('HİTLER'); // infazda Hitler → liberal zafer
    expect(items).toContain('başkanlık sırası onu atlar'); // elenen oyuncu
  });
});

describe('howToPlay — sayısal kurallar rules.ts ile tutarlı', () => {
  it('deste, çekiş ve sayaç sayıları metinde doğru', () => {
    const yasama = flatten(sectionById('yasama').blocks);
    expect(yasama).toContain(`${POLICY_DECK_COMPOSITION.liberal} liberal`);
    expect(yasama).toContain(`${POLICY_DECK_COMPOSITION.fascist} faşist`);
    expect(yasama).toContain(`${PRESIDENT_DRAW_COUNT} kart çeker`);
    expect(yasama).toContain(`kalan ${CHANCELLOR_DRAW_COUNT} kart`);

    const sayac = flatten(sectionById('sayac').blocks);
    expect(sayac).toContain(`${ELECTION_TRACKER_MAX} seçim başarısız`);

    const kisit = flatten(sectionById('kisit').blocks);
    expect(kisit).toContain(`${REDUCED_TERM_LIMIT_ALIVE_THRESHOLD} veya daha az`);
  });

  it('veto ve Hitler bölgesi eşikleri düzenden okunur', () => {
    expect(flatten(sectionById('veto').blocks)).toContain(
      `${BOARD_LAYOUTS.small.vetoUnlockAt}. faşist kanun`,
    );
    expect(flatten(sectionById('hitler').blocks)).toContain(
      `${BOARD_LAYOUTS.small.hitlerChancellorWinAt} veya daha fazla faşist kanun`,
    );
  });

  it('zafer bölümü dört yolu da sayar', () => {
    const zafer = flatten(sectionById('zafer').blocks);
    expect(zafer).toContain(`${BOARD_LAYOUTS.small.liberalSlots} liberal kanun`);
    expect(zafer).toContain(`${BOARD_LAYOUTS.small.fascistSlots} faşist kanun`);
    expect(zafer).toContain('Hitler infaz edilir');
    expect(zafer).toContain('Hitler şansölye seçilir');
  });

  it('veto eşiği her düzende aynıdır (metin tek sayı yazabilir)', () => {
    const values = new Set(Object.values(BOARD_LAYOUTS).map((l) => l.vetoUnlockAt));
    expect(values.size).toBe(1);
    const zones = new Set(Object.values(BOARD_LAYOUTS).map((l) => l.hitlerChancellorWinAt));
    expect(zones.size).toBe(1);
  });
});

describe('howToPlay — kontroller controlScheme ile tutarlı', () => {
  const bound = new Set(KEY_BINDINGS.map((b) => b.code));

  it('anlatılan her tuş gerçekten bağlı', () => {
    const expectations: ReadonlyArray<[string, string]> = [
      ['E / sol tık', 'KeyE'],
      ['Enter', 'Enter'],
      ['Backspace', 'Backspace'],
      ['H', 'KeyH'],
      ['V', 'KeyV'],
      ['B', 'KeyB'],
      ['G', 'KeyG'],
      ['M', 'KeyM'],
      ['Esc', 'Escape'],
    ];
    for (const [label, code] of expectations) {
      expect(keyboardRows().some((r) => r.keys === label)).toBe(true);
      expect(bound.has(code)).toBe(true);
    }
  });

  it('rakam aralığı OPTION_DIGITS ile aynı ve tuşları bağlı', () => {
    expect(keyboardRows().some((r) => r.keys === `1–${OPTION_DIGITS}`)).toBe(true);
    for (let i = 1; i <= OPTION_DIGITS; i += 1) {
      expect(bound.has(`Digit${i}`)).toBe(true);
    }
  });

  it('jest listesi EMOTE_KINDS ile birebir ve sıralı', () => {
    const rows = emoteRows();
    expect(rows).toHaveLength(EMOTE_KINDS.length);
    expect(rows).toHaveLength(8);
    EMOTE_KINDS.forEach((kind, index) => {
      expect(rows[index]).toEqual({ keys: `${index + 1}`, label: EMOTE_LABEL[kind] });
    });
  });

  it('kontrol bölümü kamera, telefon ve ayarlardan söz eder', () => {
    const kontrol = flatten(sectionById('kontrol').blocks);
    for (const word of ['kendi koltuğum', 'Telefon', 'hareketi azalt', 'Oyuna odaklan']) {
      expect(kontrol).toContain(word);
    }
  });
});

// ---------------------------------------------------------------------------
// D29 — görsellerin veri planı
// ---------------------------------------------------------------------------

describe('howToPlay — D29 görsel blokları', () => {
  it('her görsel bloğun altyazısı doludur ve kimlikler benzersizdir', () => {
    const ids = new Set<string>();
    for (const section of howToPlaySections()) {
      for (const block of section.blocks) {
        if (block.kind !== 'art') continue;
        expect(block.caption.length, block.art).toBeGreaterThan(8);
        expect(ids.has(block.art), block.art).toBe(false);
        ids.add(block.art);
      }
    }
    // Görev listesindeki bölümlerin hepsinde bir görsel var.
    expect([...ids].sort()).toEqual([
      'boards',
      'hitlerZone',
      'legislation',
      'roles',
      'round',
      'termLimit',
      'tracker',
      'veto',
      'victory',
    ]);
  });
});

describe('howToPlay — D29 tahta görseli BOARD_LAYOUTS`tan türer', () => {
  it('faşist tahtanın her yuvası fascistPowers ile birebir', () => {
    for (const layout of Object.values(BOARD_LAYOUTS)) {
      const slots = boardSlotArt('fascist', layout.variant);
      expect(slots).toHaveLength(layout.fascistSlots);
      layout.fascistPowers.forEach((power, index) => {
        const slot = slots[index]!;
        const last = index === layout.fascistSlots - 1;
        expect(slot.index).toBe(index);
        expect(slot.power, `${layout.variant}/${index}`).toBe(power === 'none' ? null : power);
        expect(slot.icon).toBe(last && power === 'none' ? 'victory' : slot.power);
        expect(slot.victory).toBe(last);
      });
    }
  });

  it('görev örnekleri: 7 kişide 2. yuva sadakat, 9 kişide 1. ve 2. yuva sadakat', () => {
    const medium = boardSlotArt('fascist', variantForPlayers(7));
    expect(medium[1]!.power).toBe('investigate_loyalty');
    expect(medium[0]!.power).toBeNull();

    const large = boardSlotArt('fascist', variantForPlayers(9));
    expect(large[0]!.power).toBe('investigate_loyalty');
    expect(large[1]!.power).toBe('investigate_loyalty');
  });

  it('liberal tahtada yetki yoktur; yalnız son yuva zaferdir', () => {
    for (const layout of Object.values(BOARD_LAYOUTS)) {
      const slots = boardSlotArt('liberal', layout.variant);
      expect(slots).toHaveLength(layout.liberalSlots);
      expect(slots.filter((s) => s.power)).toHaveLength(0);
      expect(slots.filter((s) => s.victory).map((s) => s.index)).toEqual([layout.liberalSlots - 1]);
      expect(slots.some((s) => s.hitlerZone)).toBe(false);
      expect(slots.some((s) => s.veto)).toBe(false);
    }
  });

  it('veto rozeti vetoUnlockAt, Hitler bölgesi hitlerChancellorWinAt yuvasından başlar', () => {
    for (const layout of Object.values(BOARD_LAYOUTS)) {
      const slots = boardSlotArt('fascist', layout.variant);
      expect(slots.filter((s) => s.veto).map((s) => s.index + 1)).toEqual([layout.vetoUnlockAt]);
      const zone = slots.filter((s) => s.hitlerZone).map((s) => s.index);
      expect(zone[0]).toBe(layout.hitlerChancellorWinAt - 1);
      expect(zone[zone.length - 1]).toBe(layout.fascistSlots - 1);
    }
  });

  it('düzen anahtarı BOARD_LAYOUTS düzenlerini oyuncu aralığıyla listeler', () => {
    expect(boardVariantOptions()).toEqual([
      { variant: 'small', label: '5-6' },
      { variant: 'medium', label: '7-8' },
      { variant: 'large', label: '9-10' },
    ]);
  });

  it('oyuncu sayısı → düzen; bilinmeyen/aralık dışı sayı en küçük masaya düşer', () => {
    expect(variantForPlayers(undefined)).toBe('small');
    expect(variantForPlayers(5)).toBe('small');
    expect(variantForPlayers(6)).toBe('small');
    expect(variantForPlayers(7)).toBe('medium');
    expect(variantForPlayers(8)).toBe('medium');
    expect(variantForPlayers(9)).toBe('large');
    expect(variantForPlayers(10)).toBe('large');
    // Lobide masa henüz dolmamış olabilir; 1 kişi de geçerli bir tahta gösterir.
    expect(variantForPlayers(1)).toBe('small');
    expect(variantForPlayers(99)).toBe('large');
  });
});
