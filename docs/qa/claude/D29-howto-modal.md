# D29 — "Nasıl oynanır" lobide, düğmeyle açılan görsel modal

- Tarih: 2026-09-18 (Opus yan ajan)
- Kullanıcı isteği: *"nasıl oynanır kısmı lobi kurulduktan sonra butonla bence modal
  olarak açılsın ve kart resimleriyle falan açıklayıcı şekilde anlatılsın onu oraya
  taşıyalım"*
- Durum: **teslim**. Commit YOK.
- Kareler: `docs/qa/claude/d29/` (8 jpeg, gitignore'lu)

---

## 1. Ne yapıldı

| Yer | Önce | Sonra |
| --- | --- | --- |
| Lobi (oda kurulduktan sonra) | kılavuz YOK | sağ sütunda tam genişlikte **"Nasıl oynanır" / "How to play"** düğmesi → modal |
| Giriş ekranı | üç adımlık düz metin şerit | üç adım KALDI + altında aynı düğme → aynı modal |
| Oyun içi menü (`M` → sekme) | düz metin sekme | aynı sekme, **aynı bileşen**, artık görselli ve tembel yüklü |

İçerik tek kaynak: lobi modali, giriş modali ve menü sekmesi hep `HowToPlay`
(`ui/HowToPlayPanel.tsx`) çizer. D19 verisi (roller tablosu, yetki tablosu, tuşlar,
jestler) aynen korundu ve kurallardan türemeye devam ediyor; üstüne bölüm başına bir
görsel eklendi.

### Giriş ekranı kararı (gerekçe)

Üç adımlık şerit **silinmedi**, kısaltılmadı: iki farklı soruya cevap veriyorlar.
Şerit *"bu sayfada ne yapacağım"* (oda aç → linki gönder → başlat), modal ise
*"oyun nasıl oynanır"* (roller, tur, yetkiler). Şerit üç kısa satır, modali
gölgelemiyor; altına konan düğme de D26 solo oyuncusu için kılavuza tek erişim
noktası (solo lobiyi atlıyor).

## 2. Görseller — kod içinde, dış dosya yok

Yeni `apps/web/src/ui/howToPlayArt.tsx`: yalnız satır içi SVG. Hiçbir `.png`/`.svg`
dosyası eklenmedi.

Üretilen parçalar:

- **Politika kartları** (liberal / faşist) ve **rol kartları** (Liberal, Faşist,
  Hitler): `materials/cardArt.ts`'in `drawCard()` yerleşimi birebir SVG'ye çevrildi
  (krem kâğıt, `#bca57c` iç çerçeve, %12'de tür etiketi, %43'te amblem çemberi,
  %72'de parti renginde başlık, %90,5'te "SECRET TABLE"). Amblemler de aynı
  dosyadan: liberal yaprak (iki quadratic eğri + krem damar çizgileri), faşist burç
  (çokgen + üç krem oyuk).
- **Oy pusulaları** JA / NEIN (Türkçede EVET / HAYIR): aynı kart çerçevesi,
  `cardArt.ts`'teki onay/çarpı vuruşları (`lineWidth` w×0,055, yuvarlak uç).
- **Kart arkası**: koyu yeşil `#253c35`, çapraz tarama, 45° döndürülmüş pirinç
  eşkenar + "ST" — yasama akışında "kimse görmüyor" anlamını taşıyor.
- **İki tahta**: liberal 5 yuva, faşist 6 yuva; sol başlık bloğu parti renginde
  amblem + parti adı + oyuncu aralığı, yuvalarda yetki ikonları, `vetoUnlockAt`
  yuvasında pirinç **VETO** rozeti, Hitler bölgesi şeridi.
- **Seçim sayacı**: `ELECTION_TRACKER_MAX + 1` adım, son adım kaos (faşist dolgu).
- **Kimlik zarfı**, **koltuk plakaları** (BAŞKAN / ŞANSÖLYE, tur kısıtında üstü
  çizili), **dolu/boş yuva şeridi**, **akış okları**.

### Tek kaynak

`BOARD_ICONS` yol verileri **yeniden kullanıldı** (istenen buydu). Bunun için
`@secret-table/scene` paketine yeni bir alt yol açıldı:

- yeni `packages/scene/src/art.ts` — `palette`, `board`, `BOARD_ICONS`,
  `boardSlotPlans`, `hitlerStripSlots`, `sceneText` dışa verir;
- `packages/scene/package.json` `exports` → `"./art"`.

Neden alt yol: paketin kök girişi `TableScene`'i, o da `three` + R3F'i çekiyor.
Kökten içe aktarmak giriş paketine sahne ağırlığını statik olarak bağlardı
(`vite.config.ts`'teki `manualChunks` yorumunda kayıtlı eski tuzak). `art.ts` içinde
`three` içeren tek bir modül yok; bu yüzden ikonlar, palet ve yuva planı hem 3D
masada hem kılavuzda **aynı kaynaktan** okunuyor, ikinci bir kopya yok.

Yuva → yetki eşlemesi de elle yazılmadı: `ui/howToPlay.ts` içindeki yeni
`boardSlotArt(party, variant)` `boardSlotPlans()` üzerinden `BOARD_LAYOUTS`tan türer
(yetki, ikon, zafer yuvası, veto yuvası, Hitler bölgesi, tahta bandı yazısı).

### Bilerek yapılan iki sapma

1. **Tahtanın ölçüsü yeniden kuruldu.** Oyundaki tahta 1940 × 450 (4,3:1) ve bant
   yazıları 15 px; 360 px genişlikte o yazı ~2,5 px'e iner, okunmaz. Kılavuzdaki
   tahta daha dar yuvalarla yeniden yerleştirildi, bant yazısı yerine yuvaya ikon
   kondu ve **yetki adları tahtanın altındaki HTML açıklama listesinde** verildi
   (telefonda gerçek yazı boyunda okunur). Renk, ikon ve plan yine tek kaynaktan.
2. **Yuva ikonları parti renginde**, oyundaki `board.ghost` (1,2:1 kontrast) tonunda
   değil. Masada o ikon dekordur, kılavuzda bilgi taşır.

## 3. Metin (i18n)

45 yeni anahtar `tr.ts` ve `en.ts`'e eklendi (`howto.openButton`, `howto.modalTitle`,
`howto.loading`, `howto.art.*`). Türkçe hiçbir metin silinmedi. Anahtarlar şablon
dizgi + cast ile değil, açık `Record<…, TextKey>` haritalarıyla çözülüyor
(`ART_CAPTION`, `ROLE_CAPTION`) — eksik anahtar derleme hatası veriyor,
`i18n.test.ts` iki sözlüğün anahtar kümesini ve `{param}` eşitliğini zaten sınıyor.

İstisna (bilinçli): kartların ve tahtanın **üzerine basılı** büyük harf dizgiler
(`POLİTİKA`, `LİBERAL`, `HİTLER`, `EVET/HAYIR` ↔ `JA/NEIN`, `KİMLİK`, `BAŞKAN`,
`SEÇİM SAYACI`, `VETO AÇILDI`) web sözlüğüne kopyalanmadı; sahnenin kendi iki dilli
sözlüğünden (`sceneText`, `tr`/`en`, `satisfies` ile tip güvenli) okunuyor. Böylece
kılavuzdaki kart, 3D masadaki kartla **aynı dizgiyi** gösteriyor.

## 4. Modal

`apps/web/src/ui/HowToPlayModal.tsx` — `HowToPlayButton` (odak sahibi) +
`HowToPlayModal` (kabuk).

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; düğmede
  `aria-haspopup="dialog"` + `aria-expanded`.
- Açılınca odak **başlığa** (`tabIndex={-1}`), kapanınca **düğmeye** döner.
- `Escape`, zemine tıklama ve "Kapat" düğmesi kapatır.
- `Tab` / `Shift+Tab` odağı panel içinde döndürür (odak tuzağı).
- Açıkken `document.body` kaydırması kilitlenir, kapanınca eski değere döner.

**Portal zorunluydu.** İlk sürümde modal lobinin kartı (`.shell__card`) içinde
kalıyordu; o kartın `card-rise` animasyonu `fill: both` ile duruyor, yani hesaplanmış
`transform` değeri kalıyor ve kart `position: fixed` için **kapsayan blok** oluyor.
Ölçüldü (1280×720): modal kutusu 758 × 1067,5 ve `top: -389`, panel `top: -193,7` —
başlık ekranın üstünde kalıyordu. `createPortal(…, document.body)` ile `inset: 0`
yeniden görüntü alanı oldu: modal 1280 × 720, panel `top: 21,6`, `height: 676,8`.

## 5. Paket ve solo kip

İçerik **tembel**: hem modal hem menü sekmesi `lazy(() => import('./HowToPlayPanel'))`
kullanıyor, yani kural verisi + SVG'ler + sahne paleti/ikonları giriş paketinde
değil. Düğmenin üstüne gelince / odaklanınca chunk önden indiriliyor, tıklamada
bekleme görünmüyor. Solo oyuna giren ziyaretçi düğmeye basmazsa **ek istek yok**.

| Dosya | Önce | Sonra | Fark |
| --- | --- | --- | --- |
| Giriş paketi (`index-*.js`) | 396 994 B (gzip 111,02 kB) | 399 590 B (gzip 112,00 kB) | **+2 596 B / +0,98 kB gzip** |
| CSS (`index-*.css`) | 35,29 kB (gzip 7,88 kB) | 39,43 kB (gzip 8,65 kB) | +4,14 kB / +0,77 kB gzip |
| **İlk yükleme toplamı** | — | — | **+6,74 kB ham, +1,75 kB gzip** |
| Tembel `HowToPlayPanel-*.js` | — | 23,13 kB (gzip 6,45 kB) | yalnız kılavuz açılınca |
| Tembel `boardArt-*.js` + `palette-*.js` | (sahne chunk'ının içindeydi) | 9,40 + 1,41 kB | sahne chunk'ı ile PAYLAŞILIR |
| Sahne chunk'ı | 172,19 kB | 163,11 kB | −9,08 kB (ortak parçalar ayrıldı) |

Giriş paketindeki +2,6 kB'ın neredeyse tamamı iki dildeki yeni metinler
(`tr.ts`/`en.ts` tek modül, bölünemez); D19 kural verisi ise giriş paketinden çıkıp
tembel chunk'a taşındı.

## 6. Mobil

Telefonda (390 × 844, testte 360 px'e kadar daraltıldı) modal dikey, gövdesi
kaydırmalı (`overscroll-behavior: contain`), başlık şeridi sabit. Bölüm görselleri
`flex-wrap` ile iki sütuna iner (`max-width: 420px` altında `flex-basis: 44%`,
kart `max-width: 58px`), SVG'ler `width: 100%; height: auto` ile ölçeklenir —
`viewBox` sabit olduğu için yüksek DPI'da nettir, daralınca ezilmez. Tahtanın yetki
adları SVG içinde değil, altındaki listede olduğu için telefonda tam boyda okunur.

## 7. Testler

`pnpm -r --workspace-concurrency=1 typecheck` → 6/6, 0 hata.
`pnpm -r --workspace-concurrency=1 test` → **1066** test (önce 1046, **+20**),
32 dosya web tarafında hepsi geçti.
`pnpm --filter @secret-table/web build` → geçti.

Yeni / değişen testler:

- `ui/HowToPlayModal.test.tsx` (**yeni**, 11 test): düğme → modal; `aria-modal` ve
  başlık bağı; `Escape` / zemin / "Kapat" kapatır; odak başlıkta açılır, düğmeye
  döner; gövde kaydırma kilidi; `Tab` ve `Shift+Tab` sarması; kart/pusula/zarf
  görsellerinin çizilmesi; **7 kişide 2. faşist yuva = sadakat incelemesi**,
  düzen anahtarı **9-10**'a geçince **iki** sadakat incelemesi (ikisi de
  `BOARD_LAYOUTS` ile karşılaştırılıyor).
- `ui/howToPlay.test.ts` (+7 test): görsel bloklarının kimlikleri/altyazıları;
  faşist tahtanın her yuvası `fascistPowers` ile birebir; liberal tahtada yetki yok;
  veto rozeti `vetoUnlockAt`, Hitler bölgesi `hitlerChancellorWinAt`'ten başlar;
  düzen anahtarı listesi; `variantForPlayers`. `flatten()` yeni `art` bloğunu tanır.
- `ui/Lobby.test.tsx` (+1): lobideki düğme modali açar, masadaki 7 kişi için
  **7-8** düzeni seçili gelir, `Escape` kapatır ve odak düğmeye döner.
- `app/EntryPage.test.tsx` (+1): giriş ekranındaki düğme modali açar, tahta görseli
  çizilir.
- `ui/GameMenu.tabs.test.tsx`: `openHowTo()` artık `async` (içerik tembel);
  9 test `await` alacak şekilde güncellendi, **iddia kaybı yok**.

## 8. Canlı doğrulama

Bellek kipi, Playwright (chromium headless shell 1217, `executablePath`), 2026-09-18:

```
SUPABASE_URL= VITE_SUPABASE_URL= pnpm --filter @secret-table/web dev --port 5211 --strictPort
```

Dört koşu — masaüstü 1280 × 720 ve telefon 390 × 844, `tr-TR` ve `en-US`
(D28 gereği dil TR/EN anahtarından seçildi, tarayıcı diline bakılmıyor):

1. Oda kur → 7 kişilik bot masası → lobide düğme → modal → roller / tahtalar /
   düzen anahtarı 9-10 / zafer bölümü → `Escape`.
2. Giriş ekranı → düğme → modal → tur akışı bölümü.

Sonuç: dört koşuda da **konsol ve sayfa hatası 0**; `Escape` modali kapattı ve odak
"Nasıl oynanır" / "How to play" düğmesine döndü. Sunucu kapatıldı.

Kareler (`docs/qa/claude/d29/`):

| Dosya | Ne |
| --- | --- |
| `desktop-tr-1-lobby.jpg` | lobide düğme (TR, 1280×720) |
| `desktop-tr-2-modal-top.jpg` | modal açık, rol kartları + rol tablosu |
| `desktop-tr-3-boards.jpg` | iki tahta, 7-8 düzeni, yetki ikonları + VETO + Hitler bölgesi |
| `desktop-tr-4-boards-9-10.jpg` | düzen anahtarı 9-10: 1. ve 2. yuva sadakat incelemesi |
| `desktop-tr-5-victory.jpg` | dört zafer yolu |
| `desktop-en-entry-round.jpg` | giriş ekranından açılan modal, tur akışı (EN) |
| `phone-en-3-boards.jpg` | telefon 390×844, tahtalar + açıklama listesi (EN) |
| `phone-tr-entry-modal.jpg` | telefon 390×844, giriş ekranı modali (TR) |

## 9. Değişen dosyalar

**Yeni**

- `apps/web/src/ui/howToPlayArt.tsx`
- `apps/web/src/ui/HowToPlayModal.tsx`
- `apps/web/src/ui/HowToPlayModal.test.tsx`
- `packages/scene/src/art.ts`
- `docs/qa/claude/D29-howto-modal.md` (bu dosya)

**Değişen**

- `apps/web/src/ui/howToPlay.ts` — `art` blok tipi, `boardSlotArt`,
  `boardVariantOptions`, `variantForPlayers`, bölümlere görsel eklendi
- `apps/web/src/ui/HowToPlayPanel.tsx` — `art` bloğu çizimi, `playerCount` propu
- `apps/web/src/ui/GameMenu.tsx` — `HowToPlay` tembel, `playerCount` geçiliyor
- `apps/web/src/ui/Lobby.tsx` — `lobby__help` + düğme
- `apps/web/src/app/EntryPage.tsx` — şeridin altına düğme
- `apps/web/src/ui/styles.css` — modal, görsel ve mobil kuralları
- `apps/web/src/i18n/tr.ts`, `apps/web/src/i18n/en.ts` — 45 yeni anahtar
- `packages/scene/package.json` — `exports["./art"]`
- `apps/web/src/ui/howToPlay.test.ts`, `ui/Lobby.test.tsx`,
  `ui/GameMenu.tabs.test.tsx`, `app/EntryPage.test.tsx`

**Değişmeyen:** sözleşme (`packages/contracts`), `packages/server`,
`packages/game-core`, migration, `apps/web/api/*`, README ön izleme linki.

## 10. Bilinen küçük eksik

Modal açıkken fare tekerleği **zeminin üstündeyken** arkadaki lobi kaydırılabiliyor.
Sayfanın kaydırma kabı `document.body` değil `.shell` (kabuk kendi `overflow-y`sine
sahip), bu yüzden gövde kilidi orada iş görmüyor. Panelin kendi içinde
`overscroll-behavior: contain` var; panel 900 px genişliğinde neredeyse tüm ekranı
kapladığı için zemin şeridi dar. Düzeltmek için ya kaydırma kabının modal tarafından
bilinmesi ya da kabuğun kaydırmayı `body`ye devretmesi gerekir — ikisi de bu görevin
kapsamı dışında bırakıldı.
