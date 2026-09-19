# D2 — Oda: uygulama raporu (2026-09-12)

Durum: **teslim, kullanıcı görsel kabulü bekliyor.** Tasarım `docs/design/D2-room.md`
(sekizgen oda, gece Berlin silueti + aylı pencere, duman tutamı yok yalnız sis) aynen
uygulandı; sapmalar §5'te. D2.1 kabuk + D2.2 mobilya + D2.3 süs tek turda tamamlandı.

## 1. Yapılanlar

Yeni paket klasörü `packages/scene/src/room/`:

| Dosya | İçerik |
| --- | --- |
| `roomGeometry.ts` | Saf matematik: `ROOM` ölçüleri, `octagonOutline`, `wallSegments` (iç normal), `roomPerimeter`, `roomFloorArea`, `fogFor`, `overviewDistance`, `roomBudget`, `ROOM_LIMITS`. three yok → DOM'suz test edilir. |
| `roomTextures.ts` | Prosedürel canvas dokular: balıksırtı parke, yeşil damask, halı bordürü, kasetli tavan, gece penceresi (ay + Berlin silueti), Berlin haritası, 3 afiş + saat atlası, kitap sırtı. `document` yoksa hepsi `null`. |
| `roomMeshes.ts` | Geometri üretimi: `wallBandGeometry` (sekizgen şerit, iç yüz, metre ölçekli UV), `ceilingGeometry`, `trimGeometry`, `brassGeometry`, `glowGeometry`, `woodGeometry`, `curtainGeometry`, `glasswareGeometry`, `shadeGeometry`, `greeneryGeometry`, `posterGeometry`, `mapPlaneGeometry`, `bookInstances`, `chandelierShades`. Hepsi `mergeGeometries` + köşe rengi. |
| `RoomShell.tsx` | D2.1 kabuk + avize + `ROOM_LIGHTS`. |
| `RoomFurniture.tsx` | D2.2 mobilya. |
| `RoomDecorations.tsx` | D2.3 süs. |
| `Room.tsx` | Tek giriş; doku ömrü, `RoomFog`. |
| `roomGeometry.test.ts` | 25 test (bütçe, kabuk matematiği, sis, doku güvenliği). |

Değişen: `materials/palette.ts` (`room.*` sözlüğü, tasarım §3 ile birebir),
`TableScene.tsx` (ışık planı, arka plan = `room.fog`, sabit `<fog>` kalktı),
`prototype/FirstPersonStage.tsx`. **Silinen:** `objects/RoomDecor.tsx` (19 çizim).

Oyun kuralları, karakterler, eller, tahtalar, etiketler, D12 infaz ve D11 HUD'a dokunulmadı.
`frameloop="demand"` korundu: oda katmanında tek bir `useFrame` yok.

## 2. Bütçe tablosu

Çizim başına bir birleşik geometri (`mergeGeometries` + `vertexColors`) ya da bir
`InstancedMesh`. Ölçüm: `roomMeshes.ts` geometrilerinin üçgen sayıları.

| Çizim | Öğe | Üçgen (standard) | Üçgen (low) |
| --- | --- | ---: | ---: |
| 1 | Parke zemin | 2 | 2 |
| 2 | Halı (elips; low'da dokusuz) | 96 | 96 |
| 3 | Duvar kâğıdı bandı (h 1,35→3,3) | 16 | 16 |
| 4 | Lambri bandı (h 0→1,37) | 16 | 16 |
| 5 | Kasetli tavan | 6 | 6 |
| 6 | Trim: süpürgelik + korniş + panel çıtaları + tavan göbeği | 2 144 | 512 |
| 7 | Pirinç: ray, avize gövdesi, aplikler, lamba gövdeleri, kulplar, askı, bar | 1 872 | 944 |
| 8 | Işıltı (unlit): ampuller, radyo kadranı, aplik konileri, yeşil lamba içi | 972 | 640 |
| 9 | Avize abajurları (`InstancedMesh`, 8 / low 4) | 224 | 112 |
| 10 | Ahşap: kitaplık ×2, pencere kasası, konsol, radyo, sehpa ×2, çift kapı, çerçeveler, saksı, küre ayağı, bar tablaları | 1 740 | — |
| 11 | Kitaplar (`InstancedMesh`, 325 örnek) | 3 900 | — |
| 12 | Pencere camı (gece dokusu, emissive) | 2 | — |
| 13 | Perde ×2 + pelmet | 276 | — |
| 14 | Abajurlar (ayaklı lamba ×2 + yeşil konsol lambası) | 108 | — |
| 15 | Sürahi + 3 bardak | 456 | — |
| 16 | Berlin haritası | 2 | — |
| 17 | 3 afiş + saat kadranı (tek atlas) | 8 | — |
| 18 | Yeşillik + küre + palto | 996 | — |
| | **Toplam** | **18 çizim · 12 836 üçgen** | **9 çizim · 2 344 üçgen** |

| Kalem | Sınır | Gerçekleşen |
| --- | --- | --- |
| Ek çizim çağrısı (eski RoomDecor 19'a göre) | ≤ +30 | **−1** (18 < 19) |
| Oda üçgeni | ≤ 60 000 | **12 836** (low 2 344) |
| Doku belleği (mipmap dahil) | ≤ 12 MB | **≈ 11,55 MB** (low ≈ 7,32 MB) |
| Nokta ışık | ≤ 3 | **3** (avize + 2 ayaklı lamba); low **1** |

Doku dökümü (RGBA, mipmap +%33): parke 1024² 4 MB · duvar kâğıdı 512² 1 MB ·
halı 512² 1 MB · afiş atlası 512² 1 MB · harita 512×384 0,75 MB · pencere 256² 0,25 MB ·
tavan 256² 0,25 MB · kitap 64×128 0,03 MB.

## 3. Sahne ölçümleri (`gl.info.render`, 1440×900 · DPR 1,5)

Bu sayılar **bütün sahne** içindir (masa, karakterler, eller, HUD dahil).

| Kare | Çizim | Üçgen |
| --- | ---: | ---: |
| Koltuk, merkez (5 kişi) | 181 | 248 878 |
| Koltuk, tam sol (yaw +1,4) | 145 | 239 248 |
| Koltuk, tam sağ (yaw −1,4) | 139 | 238 060 |
| Koltuk, yukarı (pitch +0,2) | 180 | 247 550 |
| Genel bakış | 183 | 260 468 |
| Tahta inceleme | 130 | 234 092 |
| Genel bakış · **low** | 115 | 82 292 |
| Telefon dikey (375×812) koltuk | 144 | 237 902 |
| Telefon dikey genel bakış | 183 | 260 468 |
| 10 kişilik genel bakış | 192 | 352 012 |
| 10 kişilik koltuk | 181 | 333 222 |

Konsol hatası yok (12 karenin tamamında `pageerror` / `console.error` = 0).

## 4. Performans — 10 kişilik koltuk, 5 s sürükleme, **CPU 4× kısık**

Ölçüm: `scratchpad/d2-perf.mjs` (`Emulation.setCPUThrottlingRate 4`, `sceneFrames` farkı).
"Önce" için eski `RoomDecor` geçici olarak geri alınıp ölçüldü, sonra geri çevrildi.

| | FPS | Çizim | Üçgen |
| --- | ---: | ---: | ---: |
| Önce (eski RoomDecor) · standard | 59,5 | 188 | 327 130 |
| **Sonra (yeni oda) · standard** | **59,9** | **183** | **336 148** |
| Önce · low | 59,8 | 100 | 94 174 |
| **Sonra · low** | **59,8** | **109** | **99 352** |

Her iki ölçüm de 60 FPS tavanında; CPU 4× kısıkken bile oda darboğaz değil. Çizim
çağrısı 5 **azaldı** (eski 19 ayrı mesh yerine birleşik geometri), üçgen +9 018 arttı.
Hedef "10 kişilik koltuk ≥ 30 FPS" fazlasıyla karşılanıyor.

## 5. Tasarımdan sapmalar

1. **Genel bakış ve tahta incelemesinde avize + tavan göbeği çizilmez** (ışığı kalır).
   Tasarım §5 kabuğu "bebek evi" gibi tek taraflı yapıyor ama avizeyi bu kameralar için
   değerlendirmemiş: genel bakış kamerası (0, 5,9, 5,1) ve tahta incelemesi kamerası
   (y ≈ 1,9) avizenin içinden/altından bakıyor; ilk denemede avize kadrajı **tamamen**
   kapatıyordu (bkz. `d2/board-inspect.jpg` öncesi). `Room seat={…}` bayrağı ile
   avize/göbek yalnız koltuk kamerasında çizilir.
2. **Toplam çizim 18, tasarımın öngördüğü 41 değil.** Aynı öğeler var; malzemeye göre
   birleştirildi (tüm ahşap tek çizim, tüm pirinç tek çizim, bütün ışıltı tek unlit çizim,
   3 afiş + saat tek atlas). Bütçe lehine sapma.
3. **Duman tutamı yok** — kullanıcı kararı (yalnız sis). Tasarım tablosundaki "Duman
   tutamı ×2" satırı uygulanmadı.
4. **`quality='low'`da pencere camı da kapalı.** Tasarım tablosu camı low'da ✔
   işaretliyor ama çerçevesini ✘ bırakıyordu; çerçevesiz cam duvarda yüzen bir
   dikdörtgen gibi duruyordu. Low artık görev tanımındaki "yalnız kabuk + zemin +
   1 ışık"a birebir uyuyor (kabuk + avize + tek nokta ışık).
5. **Köşe eşyaları ±3,9 / ±3,3 yerine ±3,6 / ±3,05.** Tasarımdaki nokta pah duvarının
   0,1 m dışında kalıyordu (x − z = 7,2 > 7,1); içeri alındı. Bar arabası ve askılık da
   ön pahlara oturacak şekilde 3,5 / 2,9'a çekildi.
6. **Bar arabası, askılık ve küre sadeleşti** (silindir-tor gövde + tabla). SDF/marching
   cubes hattı kullanılmadı: 5 000 üçgenlik tasarım tahmini yerine 996 üçgenlik tek
   birleşik "yeşillik" çizimi.
7. **Tavan göbeği 16 dilim** (tasarım 12), **avize halkası 40 dilimli tor**.
   Görsel fark yok, üçgen bütçesi içinde.

Düzeltilen iki hata (kare kanıtlarında yok, notu tarihçe için):
saat kadranı düzlemi gövde silindiriyle eş düzlemdeydi → moiré (gövde 4 cm geri itildi);
aplik abajuru duvarda arkalıksız yüzüyordu → pirinç arkalık + daha kalın kol eklendi.

## 6. Kontrol noktaları

- **Koltuk kamerası (göz y 0,51 · yaw ±1,4 · pitch −48…+12°):** merkez, tam sol, tam sağ
  ve yukarı bakış karelerinde **boşluk / eksik yüz yok**. Kahraman bant (h 1,6–2,6)
  karşıda pencere üst yarısı + perde + kitaplık üst rafları, solda Berlin haritası,
  sağda 3 afiş + saat, pahlarda aplikler ile dolu.
- **Genel bakış / tahta inceleme:** `layout/cameraFraming.ts` ve `prototype/SeatCamera.tsx`
  değişmedi; kadrajlar bozulmadı (avize gizlenince tahta tamamen okunur).
- **Telefon dikey (375×812):** koltuk ve genel bakış kareleri temiz; sis uzaklığı
  `fogFor('overview', d)` ile kamera mesafesine bağlı olduğu için arka duvar yutulmuyor
  (sabit 11/24 sis telefon dikeyde d ≈ 16'da duvarı siliyordu).
- **Gölge:** yalnız mevcut yönlü anahtar ışık gölge atar; oda meshleri `castShadow`
  yapmaz, zemin ve halı `receiveShadow` alır.

## 7. Testler

- `packages/scene/src/room/roomGeometry.test.ts` — **25 yeni test**: sekizgen köşe/kenar
  sayısı, düz arka duvarın −3,1…+3,1 aralığı, her kenarın iç normali, inset, kahraman
  bant, `atHeight`; sis (koltukta sabit, genel bakışta uzaklıkla büyür, her kadrajda
  arka duvarı yutmaz, telefon dikey); bütçe (sınırlar, low < standard, **gerçek**
  geometri üçgen toplamı); geometri (duvar şeridi 16 üçgen + iç normal + metre ölçekli
  UV, tavan aşağı bakar, kitaplar raflara sığar, oda öğeleri sekizgenin içinde kalır,
  birleşik geometriler köşe rengi + UV taşır, afiş atlası UV'si [0,1] içinde);
  doku üreticileri `document` yokken `null` döner.
- Gerçekten çalıştırıldı ve GEÇTİ:
  - `pnpm -r typecheck` → 6/6
  - `pnpm test` → **627** (contracts 11 · fixtures 37 · game-core 70 · **scene 275** · server 35 · web 199)
  - `pnpm --filter @secret-table/web build` → `✓ built in 3.22s`

## 8. Kareler — `docs/qa/claude/d2/`

| Dosya | İçerik |
| --- | --- |
| `seat-center.jpg` | Koltuk, merkez bakış (karşı duvar: pencere + kitaplıklar + konsol) |
| `seat-left.jpg` | Koltuk, tam sol dönüş (yaw +1,4): sol duvar, Berlin haritası, aplik |
| `seat-right.jpg` | Koltuk, tam sağ dönüş (yaw −1,4): 3 afiş, saat, küre |
| `seat-up.jpg` | Yukarı bakış: avize, kasetli tavan, korniş |
| `overview.jpg` | Genel bakış (avize gizli, "bebek evi") |
| `board-inspect.jpg` | Tahta incelemesi — kadraj temiz |
| `overview-low.jpg` · `seat-low.jpg` | `quality='low'`: yalnız kabuk + zemin + 1 ışık |
| `phone-seat.jpg` · `phone-overview.jpg` | Telefon dikey 375×812 |
| `overview-10.jpg` · `seat-10.jpg` | 10 kişilik masa |

Betikler: `scratchpad/d2-shots.mjs` (kareler), `scratchpad/d2-perf.mjs` (CPU 4× FPS).
Dev sunucu: `pnpm --filter @secret-table/web dev --port 5199 --strictPort`.

## 9. Kullanıcının canlı doğrulama adımları

1. `pnpm --filter @secret-table/web dev --port 5199 --strictPort` → <http://localhost:5199/dev/scene>
2. **Genel bakış:** oda dört yandan kapalı görünmeli, kamera duvarın dışında olduğu için
   yakın duvar ve tavan ayıklanmalı; avize görünmemeli, masa ışığı yine sıcak olmalı.
3. Soldaki **"düşük grafik (quality=low)"** kutusunu işaretle → yalnız kabuk (parke, halı,
   lambri, duvar kâğıdı, korniş, tavan, avize) kalmalı; mobilya ve süs kaybolmalı.
4. Sağ üstten **"Tahtayı incele"** → tahtanın önünde hiçbir oda öğesi olmamalı.
5. **"Kendi koltuğum"** → sürükleyerek tam sola ve tam sağa dön (yaw sınırı ±1,4 rad):
   duvarda delik, ince çizgi ya da eksik yüz olmamalı; yukarı bak → avize ve kasetli tavan.
6. `/dev/scene`'de **"Masa — 10 kişi (large)"** örneğini seç, genel bakış ve koltuk
   görüşünü kontrol et.
7. Telefonda (ya da tarayıcıyı 375×812 yapıp) aynı iki kamerayı dene: arka duvar sis
   içinde kaybolmamalı.
8. Renk kontrolü: odada rol ima eden kırmızı/mavi vurgu yok — perde bordosu `#5c2a30`
   (`fascist #a94743` değil), pencere gecesi `#132236` (`liberal #427e9e` değil).
