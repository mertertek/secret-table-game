# D2 — Oda: tasarım taslağı (2026-09-12, kod yok)

Durum: **tasarım taslağı teslim, kullanıcı onayı bekliyor.** Kullanıcı 2026-09-12: "etrafı
düzenleyelim, boşlukta oturmayalım artık, temaya uygun güzel bir oda yapalım." Onaydan sonra
ayrı kodlama ajanı uygular (`packages/scene/src/objects/RoomDecor.tsx` yeniden yazılır).

Dosyalar: `docs/design/d2/plan.svg` (üstten kroki, ölçekli) · `docs/design/d2/elevation.svg`
(arka duvar kesiti, koltuktan) · `docs/design/d2/concept.svg` + `concept.png` (1600×900, 190 KB)
· `docs/design/d2/gen_d2.py` (üçünü üreten betik; `python3 docs/design/d2/gen_d2.py`).

## 1. Konsept

1932 Berlin'inde bir kulübün arka odası: dışarıda gece, içeride sıcak lamba ışığı. Koyu ceviz
lambri ve pirinç ray belden aşağıyı sarar; üstte koyu yeşil, ince altın motifli duvar kâğıdı.
Karşı duvarda bordo kadife perdeli tek pencere, iki yanında dolu kitaplıklar, altında radyo ve
yeşil abajurlu lambanın durduğu bir konsol. Masanın üstünde sekiz abajurlu pirinç avize; köşe
lambalarının halkaları ve hafif sis "sigara dumanı" hissini verir. Ton komplocu ama davetkâr:
karikatür karakterlerle uyumlu yumuşak kenarlar, doygun ama koyu renkler; korkutucu değil.
Kırmızı/mavi yalnız nötr dekorda (perde bordosu, pencere gecesi) ve rol ima etmeyecek yerlerde.

## 2. Ölçü ve yerleşim

Sahne birimi metre; masa yüzeyi `y=0`, zemin `y=−0,81` (aşağıda **h** = zeminden yükseklik).
Oda **uzatılmış sekizgen**: x ±4,6 · z ±4,0, köşe pahı 1,5 m (düz arka duvar −3,1…+3,1).
Tavan h 3,3 (y 2,49). Koltuk elipsi (x 2,64 · z 2,0) ve masa (4,7×3,3) değişmez; karşı
sandalye arkası ≈ z −2,35 → arka duvara 1,65 m boşluk (kitaplık 0,35 + geçiş).

| Öğe | Konum / ölçü (m) | Geometri | Doku | Çizim | Üçgen | Low |
| --- | --- | --- | --- | --- | --- | --- |
| Zemin (parke) | 10×9 düzlem, h 0 | `PlaneGeometry` | canvas 1024² balıksırtı, tekrar 6×5, roughness 0,85 | 1 | 2 | ✔ |
| Halı | elips 7,2×5,5, h 0,005 (mevcut şekil) | `CircleGeometry` ölçekli (mevcut) | canvas 512² art-deco pirinç bordür + keçe dokusu | 1 | 190 | ✔ (düz renk) |
| Duvar kâğıdı bandı | 8 kenar, h 1,35→3,3, iç yüz | tek `ExtrudeGeometry`/birleşik kutu şeritleri, `FrontSide` | canvas 512² yeşil damask, tekrar | 1 | 96 | ✔ |
| Lambri bandı | 8 kenar, h 0→1,35 | birleşik kutu şeritleri | mevcut `wood` (koyu tint) | 1 | 96 | ✔ |
| Lambri panel çıtaları | 8 kenar × 6–12 panel, 0,5×0,95 | `InstancedMesh` çerçeve (4 ince kutu birleşik) | düz | 1 | ~1 400 | ✘ |
| Süpürgelik + korniş | 8 kenar, h 0–0,12 / 3,18–3,3 | birleşik kutu | düz (ceviz / krem) | 1 | 200 | ✔ |
| Pirinç ray | 8 kenar, h 1,33–1,37 (mevcut) | birleşik kutu | metalness 0,65 | 1 | 100 | ✘ |
| Tavan | 8 kenar düzlem, h 3,3, yüz aşağı | `ShapeGeometry` | canvas 256² kasetli (koffer) doku | 1 | 12 | ✔ |
| Tavan göbeği | r 0,45, merkez | `LatheGeometry` 12 seg | düz krem | 1 | 300 | ✘ |
| Avize | merkez; halka r 0,65, h 2,76; zincir → tavan | tor 48×10 + zincir silindir (birleşik); 8 abajur `LatheGeometry` instanced; 8 ampul küre instanced (emissive) | düz pirinç / krem yarı saydam | 3 | 2 600 | ✔ (2 çizim, 4 abajur) |
| Kitaplık ×2 | x ±2,1, z −3,825, 1,6×0,35×2,3 | iki gövde + raflar tek birleşik geometri | `wood` | 1 | 400 | ✘ |
| Kitaplar | 2 × ~60 sırt, rastgele en/boy | `InstancedMesh` kutu, örnek rengi 8 tondan | düz | 1 | 1 440 | ✘ |
| Pencere çerçevesi + kayıt | x ±0,9, h 0,9–2,6, z −4 | birleşik kutu | `wood` | 1 | 150 | ✘ |
| Pencere camı | 1,8×1,7 | `PlaneGeometry` | canvas 256² gece: gradyan gök, ay, siluet binalar, birkaç sıcak pencere; emissive 0,6 | 1 | 2 | ✔ (düz emissive) |
| Perde ×2 + pelmet | x ±(0,9…1,45), h 0,1–2,78; pelmet 3,0×0,2 | sinüs profili `ExtrudeGeometry` (6 pile), pelmet kutu; tek birleşik | düz bordo, roughness 1 | 1 | 900 | ✘ |
| Konsol | x ±0,85, z −3,75, 1,7×0,45×0,85 | kutu + 3 kapak çıtası birleşik | `wood` | 1 | 120 | ✘ |
| Radyo | konsol sol, 0,45×0,40×0,25 | yuvarlatılmış kutu + kadran kutu (emissive şerit) | düz + küçük emissive | 2 | 160 | ✘ |
| Yeşil abajurlu lamba | konsol sağ, h 0,85–1,33 | pirinç silindir + `LatheGeometry` yeşil abajur (içi emissive) | düz | 2 | 260 | ✘ |
| Sürahi + 3 bardak | konsol orta | `LatheGeometry` (transmission yok, opak yarı saydam) instanced | düz | 1 | 500 | ✘ |
| Ayaklı lamba ×2 (mevcut) | x ±3,6, z −1,7 | mevcut 3 parça → gövde+taban birleşik, abajur ayrı | düz | 2 (eski 6) | 600 | ✘ |
| Sehpa ×2 + küllük | x ±3,6, z −0,95, r 0,25 h 0,62 | lathe tabla + silindir ayak birleşik; küllük küçük lathe | `wood` | 1 | 400 | ✘ |
| Duman tutamı ×2 | sehpa üstü, h 0,65–1,2 | kameraya dönük `Sprite` | canvas 128² alfa tutam | 1 | 4 | ✘ |
| Berlin haritası | sol duvar x −4,58, z −1,6…−0,1, h 1,6–2,7, çerçeveli | düzlem + çerçeve kutu | canvas 512² prosedürel: kâğıt tonu, sokak ızgarası, Spree kıvrımı, yazı yok | 2 | 60 | ✘ |
| Afiş ×3 + saat | sağ duvar x +4,58, z −1,9/−1,1/−0,3, 0,6×0,85; saat z +0,6 h 2,75 | düzlemler tek atlas dokusu + birleşik çerçeve; saat lathe + kadran düzlem | canvas 512² atlas: 3 soyut art-deco afiş (yazısız) + saat kadranı | 3 | 320 | ✘ |
| Aplik ×4 | pah duvarları, h 2,0 | pirinç kol kutu + kesik koni abajur instanced (emissive) | düz | 2 | 480 | ✘ |
| Çift kapı | yakın duvar z +4, 1,3×2,3 | birleşik kutu + 2 pirinç kol | `wood` | 2 | 140 | ✘ |
| Köşe: bitki, küre, askı, bar arabası (D2.3) | pahlar (±3,9, ±3,3) | bitki ve küre SDF→marching cubes (mevcut hat), askı/bar silindir-tor birleşik | düz | 4 | 5 000 | ✘ |
| **Toplam** | | | | **≈ 41** (eski RoomDecor 19 → net **+22**) | **≈ 16 000** | low ≈ 8 çizim / 3 000 üçgen |

Mevcut RoomDecor'un 200 m zemin düzlemi, 9 ayrı dikme ve lambaların 3'er parçası kalkar; masa,
sandalyeler, karakterler, tahtalar değişmez.

## 3. Renk paleti — `palette.ts`'e `room` sözlüğü önerisi

| Token | Hex | Kullanım |
| --- | --- | --- |
| `room.floor` / `room.floor2` | `#4a3220` / `#5e4129` | parke koyu/açık lata |
| `room.floorLine` | `#2c1c10` | parke derzi |
| `room.rug` / `room.rugLine` | `#243932` / `#b49359` | halı zemin / pirinç bordür (mevcut `brass`) |
| `room.wainscot` / `room.wainscot2` | `#3a2617` / `#4c3320` | lambri gövde / panel çıtası |
| `room.wallpaper` / `room.wallpaper2` | `#2b4438` / `#355344` | duvar kâğıdı zemin / motif |
| `room.wallGold` | `#6f5b36` | motif ince çizgi (mat altın) |
| `room.ceiling` / `room.ceiling2` | `#cdbb98` / `#a8976f` | tavan (dumanla sararmış krem) / kaset gölgesi |
| `room.cornice` | `#e2d3b3` | korniş |
| `room.velvet` / `room.velvet2` | `#5c2a30` / `#7a3a40` | perde gölge / pile ışığı (bordo; `fascist #a94743`'ten uzak, DESIGN.md "bordo") |
| `room.night` / `room.night2` | `#132236` / `#25405c` | pencere gökyüzü / binalar (petrol; `liberal #427e9e`'den uzak) |
| `room.moon` | `#f1e6c8` | ay, sürahi camı |
| `room.brassDark` | `#8a6d3b` | pirinç gölge tonu |
| `room.lampGreen` / `room.lampGlow` | `#2f6b4f` / `#e9f2d2` | yeşil abajur / iç ışığı |
| `room.lampWarm` | `#ffd08a` | ampul emissive, avize/aplik ışığı |
| `room.paper` | `#d8c7a0` | harita/afiş kâğıdı |
| `room.smoke` | `#cfc6b5` | duman tutamı (alfa ≤ 0,15) |
| `room.fog` | `#101715` | sis rengi = yeni arka plan (`palette.background` `#141d1c` yerine) |
| `room.books[8]` | `#6b3a3a #3d5a4a #8a6d3b #2f3f5c #5a4634 #b39a6a #4a5a3a #7d5a48` | kitap sırtları |

Kontrol: parti renkleri (`liberal`, `fascist`) hiçbir oda öğesinde yok; bordo ve petrol tonları
oyun kartlarıyla yan yana durduğunda ayrışıyor (perde `#5c2a30` vs `#a94743`: koyuluk farkı
belirgin; pencere `#132236` vs `#427e9e`).

## 4. Işık planı

| Işık | Değer | Not |
| --- | --- | --- |
| Hemisphere (mevcut, güncelle) | gök `#e8d6b8`, zemin `#3a2a1c`, 1,2 | tavan sıcak, zemin kahve |
| Yönlü anahtar (mevcut) | `[-3, 6, 3]`, `#ffe6c7`, 2,4, gölge | tek gölge kaynağı kalır; gölge kamerası ±4 masa+sandalye |
| Yönlü dolgu (mevcut, taşı) | `[0, 2, -6]` → pencere yönünden, `#9db7c9`, 0,9 | "ay ışığı" hissi, soğuk kenar |
| **Avize nokta (yeni)** | `[0, 1.85, 0]`, `#ffd08a`, 6, distance 8, decay 2 | ana sıcak kaynak, masayı ve yüzleri aydınlatır; low'da tek ek ışık |
| Ayaklı lamba nokta ×2 (mevcut) | 2 → 2,5, distance 3,5 | standard'da açık, low'da kapalı |
| Aplik, yeşil lamba, ampuller | yalnız `emissive` | ışık yok; toplam nokta ışık ≤ 3 |
| **Sis** | `<fog color=room.fog near far>`; koltuk: 6/18; genel bakış: `0,9·d` / `2,4·d` (d kamera uzaklığı) | dumanlı hava; telefon dikeyde d 16 m olabilir, sabit değer duvarı yutar |

Post-process yok. Duman "hareketi" yok: `frameloop="demand"` olduğu için sprite sabit,
yalnız kamera geçişlerinde yeniden çizilir.

## 5. Kamera notları

- **Koltuk (göz y 0,51 = h 1,32; yaw ±80°, pitch −48…+12°):** yatay bakışta karşı duvarın
  h 1,35 rayı tam göz hizasında; başların (h ≤ 1,56) ve etiketlerin (h ≤ 1,9) üstünde **kahraman
  bant h 1,6–2,6**: pencere üst yarısı + perde, kitaplık üst rafları, harita/afişler, aplikler.
  Elevation'da işaretli. Avize eye'ın 1,44 m üstünde ve 2 m ötede → yalnız pitch +12°'de üst
  kenarda görünür; abajur altları h 2,5 başların çok üstünde, görüşü kapatmaz.
- **Yan bakış (yaw ±80°):** yan duvarın harita/afiş bölümü ve lamba; duvar x ±4,6, sandalyeden
  ~2 m → doku 512² yeterli.
- **Genel bakış:** eye `(0, 0,76·d, 0,65·d)`, d ≥ 7,8 → **kamera yakın duvarın (z +4) ve tavanın
  dışında**. Çözüm: bütün kabuk iç yüze bakan tek taraflı (`FrontSide`) → arka yüzler ayıklanır,
  "bebek evi" görünümü; tavan yüzü aşağı bakar, yukarıdan görünmez. Yakın duvar ve kapı zaten
  sade. Telefon dikeyde d ≈ 16: sis uzaklığı kameraya bağlı (yukarıda).
- **Tahta inceleme:** kamera masanın 1,2–2 m üstünde; yalnız halı ve masa görünür, değişiklik yok.
- **Gölge:** yönlü ışık gölge kamerası ±4; duvarlar gölge almaz (yalnız `receiveShadow` zemin/halı),
  `shadow-bias` mevcut değer.

## 6. Aşamalandırma

| Aşama | İş | Kabul |
| --- | --- | --- |
| **D2.1 Kabuk** | zemin parke dokusu, sekizgen lambri+duvar kâğıdı+süpürgelik+korniş, tavan, avize (3 çizim) + avize ışığı, sis/arka plan rengi, hemisphere/dolgu güncellemesi, `room` tokenleri | koltuk + genel bakış + telefon dikey kareleri; overview'da duvar içinden görme; FPS ≥ 30 (CPU 4×) |
| **D2.2 Mobilya** | kitaplıklar+kitaplar, pencere+cam+perde+pelmet, konsol+radyo+yeşil lamba+sürahi, ayaklı lamba birleştirme, sehpalar, kapı, lambri çıtaları | karşı duvar koltuk karesi; çizim sayısı raporu |
| **D2.3 Süs** | harita, afişler+saat, aplikler, duman, köşe eşyaları (bitki/küre/askı/bar) | 10 kişilik genel bakış; doku toplamı; low karşılaştırma |

Her aşama `/dev/scene` önce/sonra kareleriyle `docs/qa/claude/d2/` altında raporlanır.

## 7. Performans bütçesi

| Kalem | Bütçe | Tahmin |
| --- | --- | --- |
| Ek çizim çağrısı | ≤ +30 | +22 (41 − 19) |
| Üçgen (oda) | ≤ 60 k | ≈ 16 k (low ≈ 3 k) |
| Doku belleği | ≤ 12 MB | parke 1024² 4 MB · duvar kâğıdı 512² 1 MB · halı 512² 1 MB · harita 512² 1 MB · afiş atlası 512² 1 MB · pencere 256² 0,25 · tavan 256² 0,25 · duman 128² 0,06 → **≈ 8,6 MB** (mipmap +33 % → 11,4 MB) |
| Nokta ışık | ≤ 3 | 3 (avize + 2 lamba); low 1 |
| Üretim süresi (canvas dokular) | < 150 ms toplam, tembel | parke ve duvar kâğıdı ilk karede, gerisi `requestIdleCallback` |
| Telefon | 30 FPS | low: kabuk + avize, DPR 1, gölge kapalı |

Ölçüm: D2.1 sonunda `renderer.info` (calls, triangles) ve CPU 4× FPS raporu.

## 8. Kullanıcıya onay soruları

1. **Oda biçimi:** uzatılmış sekizgen (pahlı köşeler, konseptteki gibi) mi, düz dikdörtgen mi?
   Sekizgen köşeleri gizler ve kulüp hissi verir; dikdörtgen 4 duvar, daha az iş.
2. **Pencere:** karşı duvarda gece Berlin silueti + ay (konsept) mi, yoksa perdesi kapalı
   "gizli oda" mı (pencere yok, yerine büyük kitaplık/pano)? Kapalı seçenek daha komplocu, daha az doku.
3. **Duman:** sehpalardaki sabit duman tutamları + sis kalsın mı, yoksa yalnız sis (temiz hava)?
   Tutamlar `demand` frameloop'ta hareket etmez; hareket istenirse ayrı iş.
