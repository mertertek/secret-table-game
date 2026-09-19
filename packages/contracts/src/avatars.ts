/**
 * D3.4 / B3 — oyuncu karakteri (avatar) seçimi.
 *
 * Karakter ve ten kimlikleri TASARIM kaynağındadır (`docs/design/d3/characters.json`,
 * `docs/design/D3-characters.md`). Sunucu üç katmanda da (DB CHECK, HTTP şeması,
 * projeksiyon) aynı listeye bakmak zorunda olduğu ve `@secret-table/server` 3D
 * sahne paketini (three) İÇE AKTARAMAYACAĞI için liste burada, sözleşmede yaşar.
 * `packages/scene/src/characters/spec.ts` bu listeyi JSON'la karşılaştıran bir
 * testle bağlar; JSON'a karakter eklenirse test kırmızıya döner.
 *
 * Gizlilik/kural: avatar rolü İMA ETMEZ. Seçim herkese açıktır (lobide ve masada
 * görünür), gizli veri değildir; aynı karakteri iki oyuncu seçebilir.
 */

/** §3 — 8 karakter. Sıra `characters.json` ile aynıdır (varsayılan türetme buna bağlı). */
export const AVATAR_CHARACTER_IDS = [
  'biyikli-amca',
  'gozluklu',
  'topuzlu',
  'fotr',
  'sakalli',
  'kivircik',
  'bereli-teyze',
  'kepli-cocuk',
] as const;

export type AvatarCharacterId = (typeof AVATAR_CHARACTER_IDS)[number];

/** §3 — 3 ten tonu (`characters.json` `skins`). */
export const AVATAR_SKIN_IDS = ['acik', 'orta', 'koyu'] as const;

export type AvatarSkinId = (typeof AVATAR_SKIN_IDS)[number];

/**
 * Bir oyuncunun görünen karakteri. `PlayerView` ve `LobbyMember` üzerinde HER
 * ZAMAN doludur: oyuncu seçim yapmadıysa sunucu koltuk sırasından türetilen
 * varsayılanı verir (`avatarForSeat`).
 */
export type AvatarSelection = {
  character: AvatarCharacterId;
  skin: AvatarSkinId;
};

export function isAvatarCharacterId(value: unknown): value is AvatarCharacterId {
  return typeof value === 'string' && (AVATAR_CHARACTER_IDS as readonly string[]).includes(value);
}

export function isAvatarSkinId(value: unknown): value is AvatarSkinId {
  return typeof value === 'string' && (AVATAR_SKIN_IDS as readonly string[]).includes(value);
}

/**
 * Seçim yapılmamış koltuğun varsayılanı: koltuk sırası → karakter, sıra mod 3 →
 * ten. D3.3'teki `packages/scene` davranışının birebir aynısıdır; eski istemci,
 * fixture'lar ve yeni sunucu aynı görüntüyü üretir.
 */
export function avatarForSeat(seatIndex: number): AvatarSelection {
  const c = AVATAR_CHARACTER_IDS.length;
  const s = AVATAR_SKIN_IDS.length;
  return {
    character: AVATAR_CHARACTER_IDS[((seatIndex % c) + c) % c]!,
    skin: AVATAR_SKIN_IDS[((seatIndex % s) + s) % s]!,
  };
}

/**
 * DB/ağdan gelen ham değeri güvenli `AvatarSelection`e çevirir. Tanınmayan ya da
 * eksik alan koltuk varsayılanına düşer (0008 migration'ı uygulanmamış eski
 * satırlar da bu yoldan geçer).
 */
export function normalizeAvatar(
  value: { character?: unknown; skin?: unknown } | null | undefined,
  seatIndex: number,
): AvatarSelection {
  const fallback = avatarForSeat(seatIndex);
  if (!value) return fallback;
  return {
    character: isAvatarCharacterId(value.character) ? value.character : fallback.character,
    skin: isAvatarSkinId(value.skin) ? value.skin : fallback.skin,
  };
}

/**
 * Aynı karakteri seçen iki oyuncu masada birbirine karışmasın diye sunucunun
 * ÖNERDİĞİ ten. Zorlayıcı değildir: kullanıcı yine aynı teni seçebilir
 * (kullanıcı benzersizlik kısıtı istemedi — `docs/design/D3-characters-plan.md` §3).
 *
 * `taken` aynı odadaki DİĞER oyuncuların seçimleridir.
 */
export function suggestSkin(
  character: AvatarCharacterId,
  taken: readonly AvatarSelection[],
  preferred: AvatarSkinId,
): AvatarSkinId {
  const used = new Set(
    taken.filter((entry) => entry.character === character).map((entry) => entry.skin),
  );
  if (!used.has(preferred)) return preferred;
  const start = AVATAR_SKIN_IDS.indexOf(preferred);
  for (let i = 1; i <= AVATAR_SKIN_IDS.length; i += 1) {
    const candidate = AVATAR_SKIN_IDS[(start + i) % AVATAR_SKIN_IDS.length]!;
    if (!used.has(candidate)) return candidate;
  }
  return preferred;
}
