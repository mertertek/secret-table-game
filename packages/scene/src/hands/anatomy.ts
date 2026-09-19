/**
 * D1 — el anatomisi sayıları. Tek kaynak: `docs/design/D1-hands.md` §a/§b/§c.
 * Şablon = SAĞ el: bilek orijin, parmaklar −Z, avuç içi −Y, baş parmak −X.
 * Sol el sahnede `scale [-1,1,1]` ile üretilir; burada ayna yoktur.
 * Bütün uzunluklar metre, açılar radyandır.
 */
export type V3 = readonly [number, number, number];

export const FINGERS = ['index', 'middle', 'ring', 'pinky'] as const;
export type FingerName = (typeof FINGERS)[number];

/** MCP kökü (el yerel), 3 falanks boyu, 4 düğüm yarıçapı (baş→uç). */
export type FingerSpec = { mcp: V3; lengths: V3; radii: readonly [number, number, number, number] };

/**
 * D1 tur 5 (kullanıcı 2026-09-12: "parmaklar arasındaki etleri silsek; balık
 * adam gibi görünüyor"): MCP aralığı 22 → **24 mm**, falanks yarıçapları ~%7
 * inceldi. Bind pozunda komşu parmak yüzeyleri arasında ~4 mm boşluk kalır;
 * 3 mm voxel bu boşluğu çözebilir, perde görünümü kalkar. El yarı genişliği
 * 43,5 → 45,8 mm (+2,3 mm).
 */
export const FINGER: Record<FingerName, FingerSpec> = {
  index: { mcp: [-.036, .000, -.088], lengths: [.034, .024, .020], radii: [.0098, .0089, .0082, .0075] },
  middle: { mcp: [-.012, .001, -.094], lengths: [.038, .027, .021], radii: [.0102, .0093, .0086, .0078] },
  ring: { mcp: [.012, .001, -.090], lengths: [.036, .025, .020], radii: [.0098, .0089, .0082, .0075] },
  pinky: { mcp: [.036, -.001, -.080], lengths: [.028, .020, .016], radii: [.0086, .0079, .0072, .0066] },
};

/** Baş parmak: CMC kökü + taban çerçevesi (Euler XYZ), 3 kemik, 4 yarıçap. */
export const THUMB = {
  cmc: [-.036, -.010, -.026] as V3,
  euler: [-.4101, .7201, .8503] as V3,
  lengths: [.048, .036, .030] as V3,
  radii: [.0140, .0125, .0110, .0095] as const,
};

/**
 * D1 tur 5: avuç dilimi eskiden z = −0,108'e kadar uzanıp BOĞUM ÇİZGİSİNİN
 * 2 cm ötesinde parmak aralarını dolduruyordu (perde etkisinin asıl kaynağı).
 * Merkez öne alındı, uzunluk kısaldı: distal yüzey −0,096 (boğumların hemen
 * ötesi), proksimal yüzey +0,008 (değişmedi).
 */
export const PALM = { center: [0, 0, -.044] as V3, half: [.042, .013, .040] as V3, radius: .012 };
export const THENAR = { center: [-.030, -.004, -.045] as V3, radii: [.022, .014, .032] as V3 };
export const HYPOTHENAR = { center: [.032, -.002, -.050] as V3, radii: [.016, .012, .036] as V3 };
export const WRIST = { a: [0, 0, .014] as V3, b: [0, 0, -.024] as V3, ra: .030, rb: .028, squashY: .6 };
/**
 * D1 tur 5 — parmak arası perdeler KALDIRILDI (`WEB` artık yalnız boğum
 * çizgisinin 4 mm altında kalan, siluette görünmeyen minik dolgudur). Eski
 * 7 mm yarıçaplı kapsüller MCP hizasının üstüne çıkıp parmakları birbirine
 * bağlıyordu.
 */
export const WEB = { y: -.008, z: -.086, radius: .0035 };
/** Baş parmak perdesi gerçek elde vardır; kalınlığı ve yumuşatması yarıya indi. */
export const THUMB_WEB = { a: [-.034, -.006, -.040] as V3, b: [-.052, -.014, -.062] as V3, radius: .0045 };

/** smooth-min katsayıları (§b tablosu). */
/**
 * D1 tur 5: `fingerToPalm` 12 → 5 mm (parmak kökü avuca yumuşak bağlanır ama
 * komşu parmağa taşmaz), `web` 10 → 4 mm, `thumbWeb` 12 → 6 mm.
 * KOMŞU parmaklar arasında smooth-min YOKTUR (`sdf.handField` sert `min`).
 */
export const K = {
  thenar: .014, hypothenar: .012, wrist: .016, phalanx: .008, fingerToPalm: .005,
  thumb: .009, thumbToThenar: .014, web: .004, thumbWeb: .006,
};

/** Kemik adları — `docs/design/d1/poses.json` `bones` sırasıyla birebir aynı. */
export const BONES = [
  'wrist',
  'thumb.cmc', 'thumb.mcp', 'thumb.ip',
  'index.mcp', 'index.pip', 'index.dip',
  'middle.mcp', 'middle.pip', 'middle.dip',
  'ring.mcp', 'ring.pip', 'ring.dip',
  'pinky.mcp', 'pinky.pip', 'pinky.dip',
] as const;
export type BoneName = (typeof BONES)[number];

/** Baş parmak yastık noktası distal falanks boyunun oranı (§a). */
export const PAD = { finger: .72, thumb: .70, lateral: .55 };
