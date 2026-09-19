/**
 * D23 — sahnenin kendi iki dilli metinleri.
 *
 * Sahne paketi web uygulamasının `i18n` modülünü İÇE AKTARMAZ (bağımlılık yönü
 * korunur): `TableScene` additive bir `language` propu alır (varsayılan `tr`),
 * bileşenler `sceneLanguage()` bağlamından okur.
 *
 * Buradaki metinler tuvale ÇİZİLİR (tahta şeritleri, kart yüzleri, isim
 * plakaları). Bu yüzden dil dokunun önbellek anahtarına girer: dil değişince
 * doku yeniden üretilir, eskisi `PrintedFace` içindeki temizlikle dispose olur.
 */
import { createContext, useContext } from 'react';

export type SceneLanguage = 'tr' | 'en';

const TEXT = {
  tr: {
    // Kart yüzleri (`materials/cardArt.ts`)
    'card.policy': 'POLİTİKA',
    'card.role': 'GİZLİ KİMLİK',
    'card.membership': 'PARTİ ÜYELİĞİ',
    'card.ballot': 'OY PUSULASI',
    'card.yes': 'EVET',
    'card.no': 'HAYIR',
    'card.hitler': 'HİTLER',
    'card.liberal': 'LİBERAL',
    'card.fascist': 'FAŞİST',

    // Tahtalar (`objects/boardArt.ts`, `objects/PolicyBoard.tsx`)
    'board.liberal': 'LİBERAL',
    'board.fascist': 'FAŞİST',
    'board.power.investigate_loyalty.1': 'SADAKAT',
    'board.power.investigate_loyalty.2': 'İNCELEMESİ',
    'board.power.call_special_election.1': 'ÖZEL',
    'board.power.call_special_election.2': 'SEÇİM',
    'board.power.policy_peek.1': 'DESTE',
    'board.power.policy_peek.2': 'TEPESİ',
    'board.power.execution.1': 'İNFAZ',
    'board.win.fascist.1': 'FAŞİST',
    'board.win.fascist.2': 'ZAFERİ',
    'board.win.liberal.1': 'LİBERAL',
    'board.win.liberal.2': 'ZAFERİ',
    'board.hitlerStrip': 'HİTLER ŞANSÖLYE SEÇİLİRSE FAŞİSTLER KAZANIR',
    'board.chaosStrip': '3 BAŞARISIZ SEÇİM → ÜSTTEKİ KANUN UYGULANIR',
    'board.veto': 'VETO AÇILDI',
    'board.tracker': 'SEÇİM SAYACI',
    'board.trackerNote.1': 'ALTIN PUL MASADA',
    'board.trackerNote.2': 'HER BAŞARISIZ SEÇİMDE',
    'board.trackerNote.3': 'BİR ADIM İLERLER',

    // Özel alan / zarf (`objects/PrivateArea.tsx`, `objects/RoleEnvelope.tsx`)
    'private.hand': 'ÖZEL ELİN',
    'private.vote': 'SENİN OYUN',
    'private.inspection': 'ÖZEL İNCELEME',
    'private.identity': 'SENİN KİMLİĞİN',
    'envelope.identity': 'KİMLİK',
    'hand.private': 'ÖZEL · KİMLİK',

    // İsim plakası (`objects/nameplateState.ts`, `objects/voteState.ts`)
    'plate.president': 'BAŞKAN',
    'plate.chancellor': 'ŞANSÖLYE',
    'plate.president_candidate': 'BAŞKAN ADAYI',
    'plate.chancellor_candidate': 'ŞANSÖLYE ADAYI',
    'plate.waiting': 'BEKLİYOR',
    'plate.voted': 'OY VERDİ',
    'plate.dead': 'ELENDİ',
    'plate.offline': 'BAĞLANTI YOK',
    'plate.selected': 'SEÇİLDİ',
    'plate.targetable': 'HEDEF SEÇ',

    // Sahne içi inceleme şeridi (`TableScene.tsx`; üretimde kapalı, /dev/scene açık)
    'nav.overview': 'Genel masa',
    'nav.seat': 'Kendi koltuğum',
    'nav.backToTable': 'Masaya dön',
    'nav.inspectPrivate': 'Özel alanı incele',
    'nav.leanBoard': 'Tahtaya eğil',
    'nav.inspectBoard': 'Tahtayı incele',
    'nav.identityClose': 'Kimliği kapat',
    'nav.identityOpen': 'Kimliği aç',
    'nav.prevCard': 'Önceki kartı incele',
    'nav.nextCard': 'Sonraki kartı incele',
    'nav.cardCount': 'Kart {index} / {total}',
    'nav.privateArea': 'Özel alanın',
    'nav.inspectOnly': 'Yalnız inceleme · Seçim değişmez.',
    'nav.liberalBoard': 'Liberal politikalar',
    'nav.fascistBoard': 'Faşist politikalar',
    'nav.boardNote': 'Yetki ve tur bilgileri oyun panelinde.',
    'nav.liberalCount': 'Liberal · {count}/5',
    'nav.fascistCount': 'Faşist · {count}/6',
  },
  en: {
    'card.policy': 'POLICY',
    'card.role': 'SECRET ROLE',
    'card.membership': 'PARTY MEMBERSHIP',
    'card.ballot': 'BALLOT',
    'card.yes': 'JA',
    'card.no': 'NEIN',
    'card.hitler': 'HITLER',
    'card.liberal': 'LIBERAL',
    'card.fascist': 'FASCIST',

    'board.liberal': 'LIBERAL',
    'board.fascist': 'FASCIST',
    'board.power.investigate_loyalty.1': 'INVESTIGATE',
    'board.power.investigate_loyalty.2': 'LOYALTY',
    'board.power.call_special_election.1': 'SPECIAL',
    'board.power.call_special_election.2': 'ELECTION',
    'board.power.policy_peek.1': 'POLICY',
    'board.power.policy_peek.2': 'PEEK',
    'board.power.execution.1': 'EXECUTION',
    'board.win.fascist.1': 'FASCISTS',
    'board.win.fascist.2': 'WIN',
    'board.win.liberal.1': 'LIBERALS',
    'board.win.liberal.2': 'WIN',
    'board.hitlerStrip': 'IF HITLER IS ELECTED CHANCELLOR THE FASCISTS WIN',
    'board.chaosStrip': '3 FAILED ELECTIONS → THE TOP POLICY IS ENACTED',
    'board.veto': 'VETO UNLOCKED',
    'board.tracker': 'ELECTION TRACKER',
    'board.trackerNote.1': 'THE BRASS MARKER',
    'board.trackerNote.2': 'ADVANCES ONE STEP ON',
    'board.trackerNote.3': 'EVERY FAILED ELECTION',

    'private.hand': 'YOUR HAND',
    'private.vote': 'YOUR VOTE',
    'private.inspection': 'PRIVATE LOOK',
    'private.identity': 'YOUR IDENTITY',
    'envelope.identity': 'IDENTITY',
    'hand.private': 'PRIVATE · IDENTITY',

    'plate.president': 'PRESIDENT',
    'plate.chancellor': 'CHANCELLOR',
    'plate.president_candidate': 'PRESIDENT NOMINEE',
    'plate.chancellor_candidate': 'CHANCELLOR NOMINEE',
    'plate.waiting': 'WAITING',
    'plate.voted': 'VOTED',
    'plate.dead': 'DEAD',
    'plate.offline': 'OFFLINE',
    'plate.selected': 'SELECTED',
    'plate.targetable': 'PICK TARGET',

    'nav.overview': 'Table view',
    'nav.seat': 'My seat',
    'nav.backToTable': 'Back to table',
    'nav.inspectPrivate': 'Inspect private area',
    'nav.leanBoard': 'Lean to the board',
    'nav.inspectBoard': 'Inspect the board',
    'nav.identityClose': 'Close identity',
    'nav.identityOpen': 'Open identity',
    'nav.prevCard': 'Inspect the previous card',
    'nav.nextCard': 'Inspect the next card',
    'nav.cardCount': 'Card {index} / {total}',
    'nav.privateArea': 'Your private area',
    'nav.inspectOnly': 'Inspection only · Your choice does not change.',
    'nav.liberalBoard': 'Liberal policies',
    'nav.fascistBoard': 'Fascist policies',
    'nav.boardNote': 'Powers and round details are in the game panel.',
    'nav.liberalCount': 'Liberal · {count}/5',
    'nav.fascistCount': 'Fascist · {count}/6',
  },
} as const;

export type SceneTextKey = keyof (typeof TEXT)['tr'];

/** Anahtar + dil → çizilecek metin. `{param}` yer tutucuları doldurulur. */
export function sceneText(
  language: SceneLanguage,
  key: SceneTextKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  const table = TEXT[language] ?? TEXT.tr;
  const value: string = table[key] ?? TEXT.tr[key] ?? key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/**
 * Sahne dili bağlamı. `TableScene` propu buraya yazar; tuvale çizen bileşenler
 * `useSceneLanguage()` ile okur ve dili `useMemo`/`useCallback` bağımlılığına
 * ekler → dil değişince doku yeniden üretilir.
 */
export const SceneLanguageContext = createContext<SceneLanguage>('tr');

export function useSceneLanguage(): SceneLanguage {
  return useContext(SceneLanguageContext);
}

/** Bağlamdan okuyup metin döndüren kısayol. */
export function useSceneText(): (
  key: SceneTextKey,
  params?: Readonly<Record<string, string | number>>,
) => string {
  const language = useSceneLanguage();
  return (key, params) => sceneText(language, key, params);
}
