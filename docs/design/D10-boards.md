# D10 — Politika tahtaları: tasarım taslağı (2026-09-11)

Durum: **taslak, kullanıcı onayı bekliyor. Uygulama koduna dokunulmadı.**
Teslimler: bu belge · `docs/design/d10/icons.svg` + `icons.json` (5 ikon, 100×100, yalnız dolgu,
Path2D'ye birebir) · `board-fascist-{small,medium,large}.svg`, `board-liberal.svg`,
`board-liberal-filled.svg` (1940×450, tarayıcıda açılır, harici font yok; medium 3 kart, liberal-filled
4 kart konmuş hâl) · `*.png` (headless Chrome ile 1:1; `qlmanage` SVG'yi kare kırptığı için
kullanılmadı) · `render.py` (tek ölçü/renk sözlüğünden hepsini üreten Pillow'suz Python betiği;
tasarım aracıdır, uygulama kodu değildir).

Kullanıcı isteği: "ortadaki faşist ve liberal ana tahtalar orijinal oyundaki gibi olmalı: Hitler
bölgesi yazsın, yetki/mermi işaretleri olsun." Mevcut tahta yalnız numaralı boş kutular.

## 1. İlkeler

1. **Yuva = kural.** Her faşist yuva, `BOARD_LAYOUTS.fascistPowers` ile birebir aynı yetkiyi ikon +
   Türkçe etiketle gösterir; üç oyuncu düzeni ayrı tahtadır. Tahta kuralın kaynağı değildir, resmidir.
2. **Kart konunca bilgi kaybolmaz.** İkon ve etiket yuvanın **altındaki** bantta; yuva içindeki
   hayalet ikon yalnız boş yuvayı "orijinal gibi" gösterir, kart gelince kapanması sorun değildir.
3. **Yatay okunur.** Koltuk kamerası tahtayı ~17° eğimle görür (dikey 3× sıkışır); bu yüzden bant
   düzeni "sol ikon + sağda etiket"dir, şeritler tek satır ve geniştir, dikeye yaslanan bileşen yok.
4. **Renk kamu bilgisi.** Yalnız parti renkleri (`palette.liberal/fascist`) ve koyu tonları; rol,
   el veya deste ima eden hiçbir renk/işaret yok. Bilgi renk + ikon + kelime ile üçlü taşınır.
5. **Mevcut ızgara korunur.** Yuva merkezleri `PolicyBoard.tsx` kesirleriyle aynı (kart konum satırı
   değişmez); iki tahta üst üste durduğu için liberal 1–5 yuvaları faşist 1–5 ile hizalı kalır.

## 2. Anatomi (tuval 1940×450 px = 1,94×0,45 m; 1 px = 1 mm)

```
 8 ┌──────────────────────────────────────────────────────────────────────────────────┐
16 │▓▓ PARTİ BANDI ▓▓│      [üst şerit y 20–62: HİTLER BÖLGESİ, yalnız faşist 3→6]        │
   │▓▓  amblem     ▓▓│ ┌01──┐ ┌02──┐ ┌03──┐ ┌04──┐ ┌05──┐ ┌06──┐   yuva y 72–334        │
   │▓▓  FAŞİST     ▓▓│ │    │ │    │ │hyl.│ │hyl.│ │hyl.│ │hyl.│   (kart 177×253 içinde)│
   │▓▓  7–8 OYUNCU ▓▓│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                        │
   │▓▓ x 16–501    ▓▓│        [ikon│etk] [ikon│etk] [ikon│etk] [ikon│etk] [★ ZAFER] y 342–436│
   └──────────────────────────────────────────────────────────────────────────────────┘ 442
```

| Öğe | px (x, y, en, boy) | Not |
| --- | --- | --- |
| Kâğıt + çerçeve | 0,0,1940,450; çerçeve 8,8,1924,434 kalınlık 3 parti rengi | mevcut |
| Parti bandı | 16,16,485,418 parti dolgusu; amblem (272,153) r 85; "FAŞİST/LİBERAL" serif 50 px y 306; "7–8 OYUNCU" 26 px y 378 | mevcut, değişmez |
| Yuva i (0–5) | x = 601 + i·211,5, en 186; y 72–334 (boy 262); çizgi `#c1b49a` 2 px | merkez = kod: `(.358 + i·.109)·1940` |
| Yuva numarası | sol üst (x+12, 98) 26 px 600 `#9b9076` | kart gelince kapanır (kasıtlı) |
| Hayalet ikon | 100 px, yuva merkezi (cx, 203), dolgu `#dccfb2` | yalnız yetkili ve zafer yuvalarında |
| Kart (dolu) | 177×253, merkez (cx, 203) | CardBody 0,19×0,272 m × scale .93; yuva içinde 4,5 mm pay |
| Üst şerit | y 20–62 (boy 42), x = yuva-3 sol (1024) → yuva-6 sağ (1845), r 6, `fascistDeep`; altında yuva 3'e küçük üçgen (x 1038–1058) | faşist Hitler bölgesi; liberalde boş |
| Bant | x = yuva x, en 186; y 342–436 (boy 94), r 8, `paper2` | yalnız yetkili yuvalarda; `none` yuvada bant yok |
| Bant ikonu | 64 px, (x+8, 357) | parti rengi |
| Bant etiketi | başlangıç x+82, satır 1 taban 383, satır 2 taban 405; 15 px 700, +0,8 px aralık, en ≤ 100 | `ink`; zaferde `cream` |
| Veto etiketi | (x+80, 396) 98×24 r 5 `brass`; "VETO AÇILDI" 12,5 px 700 `ink` ortalı | yalnız 5. yuva bandı, "İNFAZ" altında |
| Zafer bandı | bant ile aynı kutu, dolgu parti rengi; yıldız ikonu + "FAŞİST/LİBERAL" / "ZAFERİ" `cream` | faşist 6, liberal 5 |

Dikey bütçe: 10 + 10 + 42 (şerit) + 10 + 262 (yuva) + 8 + 94 (bant) + 6 + 8 = 450. Kart 253 mm,
yuva 262 mm; kart yuvadan taşmaz, bant kartın altında ve kameraya en yakın kenarda kalır.

## 3. Faşist düzenler (`rules.ts BOARD_LAYOUTS`)

| Yuva | small 5–6 | medium 7–8 | large 9–10 | Bant içeriği |
| --- | --- | --- | --- | --- |
| 1 | — | — | `investigate_loyalty` | büyüteç · SADAKAT / İNCELEMESİ |
| 2 | — | `investigate_loyalty` | `investigate_loyalty` | büyüteç · SADAKAT / İNCELEMESİ |
| 3 | `policy_peek` | `call_special_election` | `call_special_election` | göz+3 kart · DESTE / TEPESİ **veya** sandık · ÖZEL / SEÇİM |
| 4 | `execution` | `execution` | `execution` | mermi · İNFAZ |
| 5 | `execution` | `execution` | `execution` | mermi · İNFAZ + **VETO AÇILDI** (`vetoUnlockAt: 5`) |
| 6 | zafer | zafer | zafer | yıldız · FAŞİST / ZAFERİ (parti dolgusu) |

"—" yuvalarda bant çizilmez, yuva içinde yalnız numara (orijinaldeki gibi boş). Üst şerit üç
düzende aynı: yuva 3–6 (`hitlerChancellorWinAt: 3`), metin
**"HİTLER ŞANSÖLYE SEÇİLİRSE FAŞİSTLER KAZANIR"** 24 px 700, +2,4 px aralık, `cream` on
`fascistDeep`, ortalı (x 1434). Metin eni ≈ 700 px / şerit 821 px.

## 4. Liberal tahta ve seçim sayacı kararı

- Yuva 1–4: numara, bant yok. Yuva 5: hayalet yıldız + zafer bandı "LİBERAL / ZAFERİ" (`liberal`
  dolgu). Üst şerit yok (yuvalar faşistle aynı y'de kalsın diye satır boş bırakıldı).
- **Kaos şeridi** yuva 1–4'ün altında (x 601–1445, y 356–422, r 6, `liberalDeep`): sol başta ○○●
  piktogramı (r 10, x 635/665/695), metin **"3 BAŞARISIZ SEÇİM → ÜSTTEKİ KANUN UYGULANIR"**
  22 px 700, +2 px, `cream`, x 725'ten sola yaslı. Orijinaldeki gibi sayaç bilgisi liberal yuvaların
  altında durur.
- **Karar: sayaç ayrı kalır.** `ElectionMarker` (1,3×0,11 m, z .57, altın pul) yerel oyuncuya en
  yakın nesnedir; liberal tahta ise en uzaktaki (z −.4). Pulu tahtaya gömmek en zor görülen yere
  taşırdı ve `TableScene` yerleşimini bozardı. Bunun yerine liberal tahtanın boş sağ sütununa
  (x 1668–1916, y 72–334, `paper2`) **sayaç açıklaması** konur: "SEÇİM SAYACI", 0–1–2 halka
  (`ink2`), **3** dolu `fascist` + altında "KAOS", ve "ALTIN PUL MASADA / HER BAŞARISIZ SEÇİMDE /
  BİR ADIM İLERLER" 14 px. Şerit kuralı, sütun pulun anlamını söyler; ikisi aynı şeyi tekrar etmez.
- `ElectionMarker` için küçük öneri (ayrı iş): 3. halkayı `fascist` dolgu + "KAOS" yap; diğerleri
  değişmez. Bu belgede zorunlu değil.

## 5. Tipografi

| Kullanım | Font | px | Ağırlık | Aralık | Renk |
| --- | --- | --- | --- | --- | --- |
| Parti adı | Table Serif | 50 | 600 | — | cream (mevcut) |
| Oyuncu sayısı | Table Sans | 26 | 550 | +1,5 | cream (mevcut) |
| Hitler şeridi | Table Sans | 24 | 700 | +2,4 | cream / fascistDeep |
| Kaos şeridi | Table Sans | 22 | 700 | +2,0 | cream / liberalDeep |
| Bant etiketi | Table Sans | 15 | 700 | +0,8 | ink (zaferde cream) |
| Veto etiketi | Table Sans | 12,5 | 700 | +1,0 | ink / brass |
| Yuva numarası | Table Sans | 26 | 600 | — | num |
| Sayaç sütunu | Table Sans | 20 / 19 / 16 / 14 | 700 / 700 / 700 / 600 | +2 / — / +1,5 / +1,2 | ink / ink2 / fascist / ink2 |

Türkçe: tüm büyük harf metinler **sabit dizgi** olarak yazılır ("İNCELEMESİ", "SEÇİM", "AÇILDI",
"ZAFERİ"); dinamik üretimde `toLocaleUpperCase('tr')` şart (`'i'.toUpperCase()` → "I" hatası).
`lettering()` ortalı çizer; bant etiketleri için `textAlign = 'left'` gerekir (bkz. §9).
Harf aralığı canvas'ta `ctx.letterSpacing = '2px'` (Chrome 99+/Safari 17+; yoksa 0 ile de sığar:
en uzun satır "İNCELEMESİ" 15 px ≈ 96 px < 100).

## 6. Renk tokenleri

| Token | Hex | Kullanım | Kontrast |
| --- | --- | --- | --- |
| `cream` | `#eee1c7` | kâğıt, şerit/zafer metni | — |
| `fascist` / `liberal` | `#a94743` / `#427e9e` | parti bandı, çerçeve, bant ikonu, zafer bandı | cream/fascist 4,4:1; cream/liberal 3,5:1 (zafer bandı büyük harf 15 px 700 → geniş metin eşiği 3:1 geçer) |
| **`fascistDeep`** / **`liberalDeep`** | `#7e332f` / `#2f5f78` | Hitler ve kaos şeritleri | cream üstünde 6,8:1 / 5,4:1 |
| **`paper2`** | `#e4d6b8` | bant ve sayaç sütunu zemini | ink 10:1; fascist ikon 4,0:1; liberal ikon 3,1:1 (ikon, metin değil) |
| `line` | `#c1b49a` | yuva çerçevesi | mevcut |
| **`ghost`** | `#dccfb2` | yuva içi hayalet ikon | 1,2:1 — kasıtlı dekor, bilgi taşımıyor |
| `num` | `#9b9076` | yuva numarası | 2,4:1 (mevcut; kart gelince kapanır, sayım kartlarla okunur) |
| `ink` / `ink2` | `#252b2c` / `#6f6b58` | bant etiketi / ikincil | ink2/paper2 3,7:1 (yalnız sayaç sütunu ikincil satırlar) |
| `brass` | `#b49359` | veto etiketi dolgusu | ink üstte 5,0:1 |

Yeni tokenler (kalın) `palette.ts`'e `board` sözlüğü olarak eklenir; parti renkleri değişmez.

## 7. İkon seti (`d10/icons.json`, viewBox 0 0 100 100)

| Anahtar | Biçim | Path sayısı | Not |
| --- | --- | --- | --- |
| `investigate_loyalty` | büyüteç; mercek içinde parti kartı çerçevesi | 3 | halka ve kart çerçevesi aynı path içinde alt yol (delik) |
| `call_special_election` | oy sandığı (kapak + yarık) ve işaretli pusula | 2 | yarık ve tik delik |
| `policy_peek` | göz (göz bebeği delik) + üç dik kart | 4 | |
| `execution` | −28° eğik mermi, iki oluk, dip halkası | 2 | dik tanım `render.py`'de döndürülür |
| `victory` | beş köşeli yıldız + iki kurdele | 3 | zafer bandında cream, hayalette ghost |

Kurallar: yalnız dolgu, çizgi yok; delikler **aynı path dizgisi içinde** alt yol; ayrı path'ler
birbirine binmez. Canvas: `for (const d of paths) ctx.fill(new Path2D(d), 'evenodd')`;
konum/ölçek `ctx.translate(x, y); ctx.scale(size / 100, size / 100)`. Parti amblemleri mevcut
`emblem()` ile çizilir, ikon setine girmez.

## 8. Okunurluk (ölçülmüş, 1440×900 css, fov 40)

| Kamera | px/mm yatay | px/mm dikey | Bant ikonu 64 mm | Etiket 15 px | Hitler şeridi 24 px |
| --- | --- | --- | --- | --- | --- |
| Koltuk, faşist tahta (d ≈ 2,0 m, ~17° eğim; `d6/seat-result.png`'den: tahta 806 css px en, 59 px boy) | 0,415 | 0,13 | 27 × 8 px | 6 × 2 px | 3 px yüksek kırmızı bant |
| Koltuk, liberal tahta (0,56 m daha uzak) | 0,33 | 0,09 | 21 × 6 px | — | — |
| "Tahtayı incele" (`cameraFraming`: d 2,03 m, 74° tepe) | 0,61 | 0,59 | 39 × 38 px | 9 px font (büyük harf ≈ 6,5 px) | 15 px font |
| Genel masa (d 7,8 m) | 0,16 | 0,12 | 10 px | — | 4 px bant |

Sonuç: brief'teki "koltukta ikon ≥ 18 px" **yatayda** sağlanır (27 px, siluet + parti rengi);
"şerit metni ≥ 12 px" koltuktan **sağlanamaz** (450 mm tahtada 90 mm harf gerekirdi) — metin
"Tahtayı incele" kamerasında okunur (15 px), koltukta şerit yalnız "yuva 3'ten itibaren kırmızı
bölge" olarak okunur; bu orijinal fiziksel oyunda da böyledir. Etiketler incelemede 9 px
fonttur (sınırda); ikon ve bant rengi anlamı taşır, metin doğrulamadır. İyileştirme seçenekleri
(kapsam dışı, kod sahibine not): `cameraFraming` inceleme uzaklığında `1.18/(tan·aspect)` yerine
`1.0` (tahta genişliğine sığdır → %15 büyür); veya inceleme modunda tahtaya HTML tooltip.

## 9. Uygulama notları (Opus / `PolicyBoard.tsx`)

1. **Doku çözünürlüğü**: `PrintedFace resolution={2048}` (şu an 1024 → 15 px etiket 8 doku px'e
   düşer, okunmaz). 2048×475 RGBA ≈ 3,9 MB × 2 tahta × 1 varyant; kabul edilebilir. Tüm ölçüler
   `k = w / 1940` ile çarpılır (bu belge 1 px = 1 mm; doku px = değer × 1,056).
2. `boardArt.ts` (yeni): `BOARD_ICONS: Record<IconKey, string[]>` (`icons.json`'dan kopya),
   `drawIcon(ctx, key, x, y, size, color)`, `drawBand(...)`, `drawStrip(...)`; `PolicyBoard.draw`
   yalnız düzeni bilir. `powers = BOARD_LAYOUTS[variant].fascistPowers.slice(0, 5)` + zafer.
3. Etiketler sola yaslı: `lettering()` ortalıdır; `boardArt` içinde `ctx.textAlign = 'left'` ile
   ayrı küçük yardımcı (veya `lettering`'e `align` parametresi — tek yazar Claude).
4. Kart konumu satırı (`(.358 + i * .109 - .5) * 1.94`) **değişmez**; yuva çerçevesi y'si
   `h*.14/h*.69` → `y 72/262 px` oranına (`.16/.582`) güncellenir. Kart 0,253 m, yuva 0,262 m.
5. `Motion from={[.25,.14,.55]}` kart düşüş animasyonu bandı geçici örter; bant kartın altındaki
   kenar olduğundan bitişte tamamen görünür.
6. Liberal tahta `variant` etiketini faşistle aynı basar (mevcut davranış korunur).
7. `ElectionMarker` bu görevde değişmez; §4 önerisi ayrı küçük iş.
8. Test: `PolicyBoard` için üç varyant × iki parti snapshot yerine, `boardArt` saf fonksiyonlarına
   birim test (yuva → ikon anahtarı, veto yalnız 5. yuva, Hitler şeridi 3–6). Görsel kabul
   `docs/qa/claude/d10/` karelerinde (koltuk, inceleme, genel masa).

## 10. Kabul ölçütleri

- [ ] Üç faşist düzen §3 tablosuyla birebir; `none` yuvalarda bant yok.
- [ ] Hitler şeridi yuva 3–6 üstünde, metin tam ve Türkçe İ/Ş doğru; "VETO AÇILDI" yalnız yuva 5;
      yuva 6 / liberal 5 zafer bandı parti dolgusu.
- [ ] 3 kart konmuş tahtada 1–3 bantları tamamen görünür (`board-fascist-medium.svg` ile aynı).
- [ ] Liberal: kaos şeridi 1–4 altında, sağ sütun sayaç açıklaması; `ElectionMarker` yerinde.
- [ ] "Tahtayı incele" karesinde (1440×900) bant etiketleri okunur, ikonlar ≥ 36 px; koltuk
      karesinde ikonlar ≥ 24 px en ve şeritler renkli bant olarak seçilir.
- [ ] Doku 2048; `pnpm typecheck`, `pnpm test` (scene) geçer; sahne FPS'de fark yok (`C3-perf`
      ölçümüyle karşılaştır).
- [ ] Rol/el ima eden renk veya işaret yok (yalnız kamu parti renkleri).

## 11. Riskler

- Koltuk kamerasında metin okunmaz (fiziksel oyunda da öyle); kullanıcı "yazsın" derken koltuktan
  okumayı bekliyorsa inceleme kamerası yaklaştırılmalı (§8 seçenekleri) — kod sahibine devredildi.
- `letterSpacing` eski Safari'de yok; tasarım 0 aralıkla da sığar, sadece daha sıkışık.
- Mermi ikonu sansür/mağaza hassasiyeti: stilize, tek renk, silah yok; gerekirse `execution`
  için alternatif (hedef halkası) `icons.json`'a eklenebilir.
- 2048 doku düşük cihazda 2 × 3,9 MB GPU belleği; `quality === 'low'` için 1024'e düşürülebilir
  (etiketler o modda bulanır, ikonlar kalır).
