/**
 * D29 — sahnenin ÇİZİM SABİTLERİ, `three` olmadan.
 *
 * `@secret-table/scene` kök girişi `TableScene`'i (ve dolayısıyla `three` +
 * R3F'i) çeker; web'in "Nasıl oynanır" görselleri için bu kabul edilemez.
 * Bu alt yol (`@secret-table/scene/art`) yalnız SAF veri ve saf fonksiyon
 * dışa verir: palet, tahta ikon yolları, yuva→yetki planı ve sahne metinleri.
 *
 * Amaç TEK KAYNAK: "Nasıl oynanır" görselleri 3D masadaki kart/tahta ile aynı
 * renkleri, aynı ikon yollarını ve aynı yuva planını kullanır; ikinci bir
 * kopya yoktur. Buraya `three`/R3F içeren hiçbir modül eklenmemelidir.
 */

export { palette, board, label, prop, room } from './materials/palette';
export {
  BOARD_ICONS,
  boardSlotPlans,
  hitlerStripSlots,
  type BoardIconKey,
  type BoardSlotPlan,
  type BoardBandPlan,
} from './objects/boardArt';
export { sceneText, type SceneLanguage, type SceneTextKey } from './i18n/sceneText';
