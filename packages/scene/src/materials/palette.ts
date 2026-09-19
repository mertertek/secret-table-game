export const palette = {
  background: '#141d1c', felt: '#234b40', walnut: '#583b2b', cream: '#eee1c7',
  ink: '#252b2c', brass: '#b49359', gold: '#e3be73', liberal: '#427e9e',
  fascist: '#a94743', leather: '#233631', muted: '#88968b',
  // Oy rozetleri (D5): partiden bağımsız evet/hayır dili.
  voteYes: '#4f9464', voteNo: '#c0564e', voteIdle: '#5a6860',
  // D6 oy çipi: krem dolgu üstünde kelime/simge koyu tonlara iner (≥ 5,7:1).
  voteYesText: '#2a5f3c', voteNoText: '#8f3a33', voteIdleText: '#4a5650',
} as const;

/**
 * D12 infaz sahnesi prop tokenleri (`docs/design/D12-execution.md` §2).
 * Oyuncak tonu: mat koyu gövde, ceviz kabza, pirinç namlu ağzı halkası.
 * Parti renkleriyle karışmaz (gövde nötr gri-mavi, kabza ahşap).
 */
export const prop = {
  gunBody: '#3a3d44', gunGrip: '#7a4a2e', gunBrass: '#c9a24a',
  /** Namlu flaşı (ekleme karışım; doku tek kanalda çizilir). */
  muzzleFlash: '#ffe3a8',
} as const;

/**
 * D10 politika tahtası tokenleri (`docs/design/D10-boards.md` §6).
 * Yalnız kamu bilgisi: parti renkleri ve kâğıt tonları; rol/el ima eden renk yok.
 * Kontrast: cream/fascistDeep 6,8:1 · cream/liberalDeep 5,4:1 · ink/paper2 10:1 ·
 * ink/brass 5,0:1. `ghost` (1,2:1) kasıtlı dekordur, bilgi taşımaz.
 */
export const board = {
  fascistDeep: '#7e332f', liberalDeep: '#2f5f78',
  paper2: '#e4d6b8', ghost: '#dccfb2', line: '#c1b49a', num: '#9b9076',
  ink: '#252b2c', ink2: '#6f6b58',
} as const;

/**
 * D6 baş üstü isim etiketi tokenleri (`docs/design/D6-nameplate.md` §4).
 * HUD dili: unlit pano, ince çizgi, krem yazı. Rol ima eden renk yok.
 */
export const label = {
  bg: '#17241f', bgAlpha: .86, bgDead: '#141d1c', bgDeadAlpha: .55,
  line: '#59625a', lineLocal: '#b49359', lineDead: '#3d4643',
  target: '#a4c9b7', gold: '#e3be73', warn: '#e6a95c', ready: '#8fd3a5',
  cream: '#eee1c7', cream2: '#cfc3a9', cream3: '#a39a86', ink: '#1b1f1e',
  chipFill: '#eee1c7', selectedBg: '#e3be73', selectedBgAlpha: .96,
} as const;

/**
 * D2 oda tokenleri (`docs/design/D2-room.md` §3). 1932 Berlin arka odası:
 * koyu ceviz lambri, yeşil damask duvar kâğıdı, bordo kadife, gece penceresi.
 * Parti renkleri (`liberal #427e9e`, `fascist #a94743`) hiçbir oda öğesinde yok;
 * perde bordosu ve pencere petrolü onlardan koyuluk/doygunlukla ayrışır.
 */
export const room = {
  floor: '#4a3220', floor2: '#5e4129', floorLine: '#2c1c10',
  rug: '#243932', rugLine: '#b49359',
  wainscot: '#3a2617', wainscot2: '#4c3320',
  wallpaper: '#2b4438', wallpaper2: '#355344', wallGold: '#6f5b36',
  ceiling: '#cdbb98', ceiling2: '#a8976f', cornice: '#e2d3b3',
  velvet: '#5c2a30', velvet2: '#7a3a40',
  night: '#132236', night2: '#25405c', moon: '#f1e6c8',
  brassDark: '#8a6d3b',
  lampGreen: '#2f6b4f', lampGlow: '#e9f2d2', lampWarm: '#ffd08a',
  paper: '#d8c7a0', smoke: '#cfc6b5', fog: '#101715',
  books: ['#6b3a3a', '#3d5a4a', '#8a6d3b', '#2f3f5c', '#5a4634', '#b39a6a', '#4a5a3a', '#7d5a48'],
} as const;
