# D6 — Baş üstü isim etiketi: tasarım taslağı (2026-09-11)

Durum: **taslak, kullanıcı onayı bekliyor. Uygulama koduna dokunulmadı.**
Teslimler: bu belge · `docs/design/d6/nameplate-states.svg` (durum sayfası, 1 m = 1000 px,
tarayıcıda açılır, harici font yok) · `docs/design/d6/mockup-seat.png` ve
`mockup-overview.png` (D5 karelerinin üstüne fotomontaj; eski plakalar keçe rengiyle
örtüldü; genel masada yan koltukların eski plaka izi keçe gölgesi yüzünden hafifçe seçilir, montaj
sınırlamasıdır) · `docs/design/d6/render.py` (SVG + montajı üreten Pillow betiği; ölçü/renk
sözlüğü tek yerde, tasarım aracıdır, uygulama kodu değildir).

Kullanıcı şikâyeti: "isim kartları gözüme kötü geliyor; masada yan durmaları çok bozuk".
Karar: masa üstü plakalar (Nameplate + OfficePlacard) kalkar; her avatarın başının üstünde
kameraya dönük **tek** etiket taşır: isim + makam + durum + D5 oy rozeti (aynı etikete gömülü).

## 1. İlkeler

1. **Bir oyuncu, bir etiket.** İsim, makam, bağlantı/eleme durumu ve oy tek panoda; masada
   ayrı isimlik veya makam plakası kalmaz. Masa yüzeyi yalnız kart ve tahtaya kalır.
2. **Her zaman kameraya dönük, her zaman okunur.** Etiket tam billboard'dur; ekranda en az
   48 css px yüksek kalacak kadar büyür (kompakt 32 px), yakında 1× altına inmez.
3. **HUD dili, sahne malzemesi değil.** D8/D9 ile aynı sözlük: koyu yarı saydam pano, ince
   çizgi, krem yazı, altın vurgu; ışıklandırmadan bağımsız (unlit), gölge yok.
4. **Durum = çerçeve + kelime + simge.** Tek başına renk hiçbir şey anlatmaz (makam simgesi,
   oy tik/çarpı, kelime). Rol ima eden renk/simge yok; oy sonuçları zaten kamu.
5. **Sığmazsa kısal, taşma.** İsim 15 karakterde kırpılır, oy çipi kelime sığmazsa yalnız
   simgeye iner, telefon tek satıra iner; etiket hiçbir durumda 0,60 m'yi aşmaz.

## 2. Anatomi (metre; canvas px = m × 1707, `PrintedFace resolution=1024`)

```
        ┌SEN┐ (yalnız yerel, genel masa)               ┌ hedeflendi köşe kancaları (aimed)
   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ▲
   ┃                    Elif                            ┃  │  isim satırı  (merkez y 0,064)
   ┃        ● BAŞKAN                    (✓ EVET)        ┃  │  satır 2      (merkez y 0,135)
   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ▼ 0,18
   ◄──────────────────── 0,60 ─────────────────────────►
                          ▲ alt kenar = baş tepesi + 0,05  →  dünya y = 0,48 (koltuk kökü)
```

| Öğe | Ölçü (m) | Canvas px | Not |
| --- | --- | --- | --- |
| Pano | 0,60 × 0,18, köşe r 0,032 | 1024 × 307, r 55 | tek `PrintedFace`, kameraya dönük |
| Çerçeve | 0,006 (hedeflendi 0,010) | 10 (17) | rengi durum verir (§5) |
| İç pay | 0,030 | 51 | sol/sağ |
| İsim | boy 0,066, ağırlık 550, merkez y 0,064, en ≤ 0,50 | 113 px | ortalı; >15 karakter → 14 + "…" |
| Satır 2 metni | büyük harf 0,038, ağırlık 600, +0,06 em aralık, merkez y 0,135 | 65 px | makam / durum kelimesi |
| Makam simgesi | ⌀ 0,026, metinle 0,012 boşluk | 44 px | başkan = dolu altın disk, şansölye = altın halka; adaylar kesikli |
| Oy çipi | yükseklik 0,060, hap; iç pay 0,020; simge r 0,014; yazı 0,034 (650) | ayrı `PrintedFace` 0,26 × 0,06 → 444 × 102 | krem dolgu, vurgu renkli simge + kelime; sığmazsa yalnız simge ⌀ 0,060 |
| SEN etiketi | 0,090 × 0,034, sol üst (0,030; −0,012), pirinç dolgu, mürekkep yazı 0,022 | 154 × 58 | çerçeveyi 0,012 taşar |
| Hedef kancaları | 4 köşe, 0,030 uzun, çerçeveden 0,010 dışta | — | yalnız `aimed` |
| Kompakt varyant | 0,60 × 0,11, r 0,026; isim 0,056; simge ismin solunda, çip ismin sağında (⌀ 0,048) | 1024 × 188 | telefon / dar alan (§8) |

Satır 2 yerleşimi: `[makam simgesi] [kelime]` sol grup, `[oy çipi]` sağa yaslı (sağ pay 0,030);
sol grup kalan alanda ortalanır. Çip yokken sol grup panoda ortalanır; kelime dolgu
(`KOLTUK NN`) ise ve çip varsa dolgu düşer, çip ortalanır. Sığdırma: sol grup + 0,014 + tam
çip > 0,54 ise çip yalnız simgeye iner (ör. "ŞANSÖLYE ADAYI" + HAYIR).

## 3. Tipografi

- Font: mevcut "Table Sans" (Noto Sans, yerel). İsimde 550, satır 2'de 600, çipte 650, SEN'de 700.
- Büyük harf satırlarında Türkçe İ/ı doğru üretilir (`toLocaleUpperCase('tr')`).
- Kırpma: `Array.from(name).length > 15` → ilk 14 + "…"; `maxWidth 0,50 m` canvas güvenlik sınırı
  (mevcut 23 karakter sınırı **düşer**; tam ad hover balonunda ve HUD oyuncu listesinde).
- Ekran boyutları (fov 40°, 900 css px): karşı koltuk 3,97 m → pano 56 px, isim 21 px, satır 2
  12 px. Yan komşu 1,5 m → 148 px. Genel masa ~8,5 m → 27 px → 48 px'e büyütülür (zoom 1,78):
  isim 17,6 px, satır 2 10 px, çip yazısı 9 px (bu yüzden uzak ölçekte çip kelimesi zaten
  büyük harf + simge ile okunur; 9 px altına inmez çünkü 48 px taban vardır).

## 4. Renk tokenleri

| Token | Hex / alfa | Kullanım |
| --- | --- | --- |
| `label.bg` | `#17241f` α .86 | pano zemini (elendi: `#141d1c` α .55) |
| `label.line` | `#59625a` | varsayılan çerçeve |
| `label.lineLocal` | `#b49359` (brass) | yerel oyuncu çerçevesi + SEN dolgusu |
| `label.target` | `#a4c9b7` | hedef seçilebilir çerçeve ve "HEDEF SEÇ" |
| `label.gold` | `#e3be73` (gold) | hover/aimed çerçeve, seçili dolgu, makam simgesi ve kelimesi |
| `label.warn` | `#e6a95c` | bağlantı yok çerçeve + kelime (D8 `--warn`) |
| `label.ready` | `#8fd3a5` | HAZIR (D8 `--ready`) |
| `label.lineDead` | `#3d4643` | elendi çerçevesi |
| `cream` / `cream2` / `cream3` | `#eee1c7` / `#cfc3a9` / `#a39a86` | isim / ikincil / dolgu-elendi metni |
| `ink` | `#1b1f1e` | seçili panoda ve SEN etiketinde metin |
| `voteYes` / `voteNo` / `voteIdle` | `#4f9464` / `#c0564e` / `#5a6860` | çip **kenarı** (D5 ile aynı); çip dolgusu `#eee1c7`, bekliyor α .78 |
| `voteYesText` / `voteNoText` / `voteIdleText` | `#2a5f3c` / `#8f3a33` / `#4a5650` | çip kelimesi ve tik/çarpı/halka simgesi (krem üstünde ≥ 5,7:1) |

Kontrast (hesaplandı, `#17241f` üstünde): cream 12,4:1, gold 9,1:1, target 8,9:1, warn 7,8:1,
ready 9,2:1, cream3 5,7:1. Seçili altın dolgu üstünde ink 9,4:1. Çip kremi üstünde D5 vurguları
yetersizdi (voteYes 2,8:1, voteNo 3,5:1); bu yüzden kelime/simge koyu tonlara alındı:
voteYesText 5,8:1, voteNoText 5,75:1, voteIdleText 5,9:1. Hepsi ≥ 4,5.

## 5. Durum matrisi

Çerçeve önceliği: seçili > hedeflendi (aimed) > hover > elendi > bağlantı yok > hedef
seçilebilir > sen > varsayılan. Satır 2 kelime önceliği: ELENDİ > BAĞLANTI YOK > SEÇİLDİ >
HEDEF SEÇ > makam kelimesi > HAZIR (lobi) > KOLTUK NN. Makam **simgesi** kelimeden bağımsız
her zaman kalır (ör. "● BAĞLANTI YOK" = kopuk başkan). Oy çipi elenmişte ve yerel oyuncuda
yoktur (`voteState` zaten null döner).

| Durum | Çerçeve | Zemin | İsim | Satır 2 | Oy çipi |
| --- | --- | --- | --- | --- | --- |
| Normal | line | bg | cream | `KOLTUK 04` cream3 | varsa (dolgu düşer) |
| Sen (genel masa) | brass | bg | cream | `KOLTUK 01` | yok |
| Başkan | line | bg | cream | ● `BAŞKAN` gold | varsa |
| Şansölye | line | bg | cream | ○ `ŞANSÖLYE` gold | varsa |
| Başkan adayı | line | bg | cream | ◌● `BAŞKAN ADAYI` | varsa (kısa) |
| Şansölye adayı | line | bg | cream | ◌ `ŞANSÖLYE ADAYI` | varsa (kısa) |
| Hedef seçilebilir | target | bg | cream | `HEDEF SEÇ` target (makam simgesi kalır) | — |
| Hover | gold | bg | cream | `HEDEF SEÇ` gold | — |
| Hedeflendi (klavye) | gold 0,010 + köşe kancaları | bg | cream | `HEDEF SEÇ` gold | — |
| Seçili | gold | gold α .96 | ink | `SEÇİLDİ` ink | — |
| Elendi | lineDead | bgDead α .55 | cream3 | `ELENDİ` cream3, simge yok | yok |
| Bağlantı yok | warn | bg | cream | [simge] `BAĞLANTI YOK` warn | varsa |
| Hazır (lobi) | line | bg | cream | `HAZIR` ready | — |
| Lobi, hazır değil | line | bg | cream | `KOLTUK 06` cream3 | — |
| Oy: bekliyor | — | — | — | — | ○ `BEKLİYOR` idle, α .78 |
| Oy: oy verdi | — | — | — | — | ✓ `OY VERDİ` yes |
| Oy: evet / hayır | — | — | — | — | ✓ `EVET` yes / ✗ `HAYIR` no |
| Başkan + evet | line | bg | cream | ● `BAŞKAN` | ✓ `EVET` (tam) |
| Şansölye adayı + hayır | line | bg | cream | ◌ `ŞANSÖLYE ADAYI` | ✗ (yalnız simge) |
| Bağlantı yok + bekliyor | warn | bg | cream | `BAĞLANTI YOK` | ○ (yalnız simge) |
| Şansölye + hedef seçilebilir | target | bg | cream | ○ `HEDEF SEÇ` | — |
| Başkan + hedeflendi | gold + kancalar | bg | cream | ● `BAŞKAN` (hedef metni yerine; hedeflenebilir değilse) | — |
| Uzun isim + başkan + evet | line | bg | `Ayşegül Demirt…` | ● `BAŞKAN` | ✓ `EVET` |

Hepsi `nameplate-states.svg` sayfasında gerçek oranlarda çizilidir.

## 6. Animasyon (hepsi `reducedMotion` ile anlık)

| Olay | Süre | Davranış |
| --- | --- | --- |
| Makam değişimi (`office_moved`) | 300 ms | satır 2 çapraz solma: eski kelime 100 ms söner, yeni kelime 200 ms belirir + 0,006 m yukarı kayar; çerçeve tek altın nabız (0→1→0, yanıp sönme yok) |
| Oy çipi girişi | 240 ms (`VOTE_BADGE_ENTER_MS`) | ölçek 0,6→1 easeOutCubic + alfa; durum değişince (BEKLİYOR→OY VERDİ) aynı giriş yeniden |
| Oy çipi çıkışı | 160 ms | alfa 1→0; `VOTE_REVEAL_MS` sonunda |
| Çerçeve rengi (hover/aimed/target) | 120 ms | renk lerp |
| Seçili dolgu | 160 ms | zemin bg→gold, metin cream→ink |
| Eleme | 300 ms | alfa .86→.55, çerçeve→lineDead, çip söner |
| Ölçek (min px) | anlık | kamera hareketine bağlı, animasyon değil |

## 7. Ölçek kuralı ve çakışma

- Etiket grubu **alt-merkez** pivotludur (geometri +H/2 kaydırılır); büyürken yukarı büyür,
  başa girmez. `zoom = clamp(1, MIN_PX·perPixel / H, 2.4)`; `MIN_PX = 48` (kompakt 32).
- Malzeme: unlit, `transparent`, `depthTest false`, `depthWrite false`; `renderOrder` kameraya
  uzaklığa göre (yakın etiket üste). Lamba/başka avatar etiketi örtemez.
- Yan komşu çakışması (10 kişi): koltuk görünümünde komşular ekran dışı veya ≥ 400 px
  aralıklıdır (1440 px genişlik; seat+2/+3 için hesaplandı), genel masada koltuk aralığı
  ~1,45 m ≈ 435 px ve büyütülmüş etiket 320 px → çakışma yok. Güvenlik: iki etiketin ekran
  dikdörtgeni %15'ten fazla kesişirse **uzaktaki** kompakt varyanta iner (300 ms histerezis).
- Tıklama/hedefleme: etiketin kendisi raycast hedefidir (`onClick`/`onPointerOver`); ayrıca
  billboard grubunda 0,60 × 0,18 × 0,02 `TargetZone` (klavye `aimed` ve `onSlotsVisible` için).
  Avatar gövdesindeki mevcut `TargetZone` kalır.

## 8. Telefon (390 × 844, dikey)

- `size.width < 700` → **kompakt varyant** (0,60 × 0,11): isim + makam simgesi + çip simgesi;
  kelime yok. Min 32 css px. Genel masa kamerasında en fazla 10 etiket × ~110 px genişlik.
- Mevcut DOM düğmesi (`<Html>` + `data-scene-name`) kalkar; etiket 3B'de tıklanır (44 px
  dokunma alanı zoom ile sağlanır: 32 px pano + 6 px görünmez pay üst/alt).
- Erişilebilirlik: tam ad ve durum HUD oyuncu listesinde (`docs/qa/claude/d5/phone-players.png`
  paneli) zaten metin olarak var; etiket yalnız görsel katmandır.

## 9. OfficePlacard kararı

**Kalkar.** Makam, etiketin satır 2'sine (simge + kelime) taşınır; `office_moved` cue'su plaka
kaydırma yerine §6 çapraz solmayı tetikler. `docs/DESIGN.md` §4 nesne tablosunda OfficePlacard
satırı "Nameplate'e gömüldü (D6)" olarak güncellenir. Masa üstünde makamla ilgili tek şey
kalmaz; ElectionMarker etkilenmez.

## 10. Uygulama notları (onay sonrası, Claude)

| Dosya | Değişiklik |
| --- | --- |
| `packages/scene/src/objects/Nameplate.tsx` | yeniden yazılır: billboard grup (D5 `VoteBadge` kameraya dönme + min px yöntemi), alt-merkez pivot, pano `PrintedFace` (1024) + `VoteChip` alt bileşeni; `Html` ve DOM düğmesi kalkar; hover balonu (tam ad) kalır |
| `packages/scene/src/objects/nameplateState.ts` (yeni, saf) | `PlayerView` + etkileşim → `{frame, text, glyph, chipForm}`; kelime önceliği, kırpma, sığdırma. Vitest |
| `packages/scene/src/objects/VoteBadge.tsx` | `VoteChip`e dönüşür (etiket içi, kendi giriş animasyonu); `VOTE_BADGE_Y` kalkar. `voteState.ts` **değişmez** |
| `packages/scene/src/objects/OfficePlacard.tsx` | silinir |
| `packages/scene/src/layout/seats.ts` | `plate` kalkar; `label: [chair.x, .48, chair.z]` eklenir. `presentation.test.ts` plaka testleri → etiket çapası testleri (10 kişide çapalar arası ≥ 1,2 m) |
| `packages/scene/src/TableScene.tsx` ~151–170 | plaka grubu, `OfficePlacard`, `VoteBadge` grubu kalkar; tek `<Nameplate>` `seat.label`de (`local && seatMode` iken çizilmez, bugünkü gibi) |
| `packages/scene/src/prototype/FirstPersonStage.tsx` | `seat.plate` → `seat.label` |
| `packages/scene/src/objects/Surface.tsx` | `PrintedFace`e `unlit`/`depthTest` seçenekleri (veya `HudFace`) |
| `packages/scene/src/materials/palette.ts` | `label.*` tokenleri (§4) |
| `docs/DESIGN.md` | Nameplate/OfficePlacard satırları, isimlik ölçüsü |
| QA | `docs/qa/claude/d6/`: koltuk, genel masa, telefon; 10 kişi + uzun isim + oylama + sonuç kareleri; konsol hatası yok |

Kaldırılanlar: `Nameplate` içindeki `Block` plaka gövdesi, altın nokta küresi, `seats.plate`,
`OfficePlacard`, masa üstü `TargetZone [.65,.065,.25]`, `VOTE_BADGE_Y`.

## 11. Kabul ölçütleri

1. Masada isimlik/makam plakası yok; her avatarın üstünde tek etiket, üç kamerada da kameraya dönük.
2. Koltuk görünümünde karşı oyuncu etiketi ≥ 48 css px, genel masada da ≥ 48 px (zoom ≤ 2,4);
   telefonda kompakt ≥ 32 px. Etiket hiçbir zoom'da başı örtmez.
3. §5 matrisindeki 24 durum `/dev/scene` fixture'larıyla üretilir ve `nameplate-states.svg` ile
   eşleşir (kelime, çerçeve, simge, çip biçimi).
4. Oy çipi D5 davranışını korur: oylamada BEKLİYOR/OY VERDİ, açılışta EVET/HAYIR 5 s, yerel
   oyuncuda yok, `privateView` okunmaz (mevcut gizlilik testleri geçer).
5. 10 kişilik masada koltuk ve genel masa görünümünde etiketler kesişmez; kesişirse uzaktaki
   kompakt olur.
6. 23 karakterlik fixture (`longNames.ts`) 14 + "…" olarak kırpılır; hover'da tam ad görünür.
7. Etiket tıklanır/klavyeyle hedeflenir; `aimed` köşe kancaları, seçili altın dolgu görünür.
8. `reducedMotion` ile hiçbir geçiş oynamaz; `frameloop="demand"` dışında kare istenmez.
9. `pnpm -r typecheck`, `pnpm test` geçer; DOM'da `data-scene-name` düğmesi kalmaz.

## 12. Riskler

- Çip kelimesi genel masada ~9 px: simge + renk taşır; kabul edilmezse `MIN_PX` 56'ya çıkar
  (etiket 0,20 m gibi görünür, çakışma payı azalır).
- 10 kişide telefon genel masa kamerasında kompakt etiketler bile sıkışabilir; kamera
  çerçevelemesi (`cameraFraming.ts`) doğrulanmalı.
- Etiket başın üstünde olduğu için koltuk görünümünde duvar/lamba önüne düşer; `depthTest`
  kapalı olduğundan görünür ama lamba gölgeliğiyle üst üste binebilir (montajda görülüyor).
- Makam bilgisinin masadan kalkması: "kimin sırası" HUD şeridi + etiket simgesiyle taşınır;
  Codex sahne notlarında OfficePlacard'a bağlı bir plan varsa MD üzerinden koordine edilir.
