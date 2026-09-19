# D8 — Giriş / Katıl / Lobi: modern tasarım taslağı (2026-09-11)

Durum: **taslak, kullanıcı onayı bekliyor. Uygulama koduna dokunulmadı.**
Mockup'lar: `docs/design/d8/entry.html`, `join.html`, `lobby.html` (tek dosya, inline
CSS, harici JS yok; yalnız Google Fonts bağlantısı). Ekran görüntüleri
`docs/design/d8/shot-*.png` (390×844 telefon, 390 tam sayfa `-full`, 1440×900 masaüstü;
Playwright + yerel Chrome, DPR 2). Arka plan görseli `docs/design/d8/bg-table.png`
(mockup için, 359 kB) ve `bg-table.webp` (üretim hedefi, **19 kB**).

## 1. Neden B6 beğenilmedi, bu taslak ne yapıyor

| B6 sorunu | D8 kararı |
| --- | --- |
| Düz CSS masa/koltuk çizimi ucuz duruyor | Çizim yok. Arka plan gerçek sahne render'ı (blur + vinyet), önde cam paneller |
| Her şey tek krem "form kutusu" içinde; web sitesi değil form gibi | Giriş bir **açılış sayfası**: üst çubuk, büyük serif başlık, sağda tek eylem kartı, altta 3 adım, altbilgi |
| Tipografi zayıf (sistem sans, her şey aynı ağırlık) | Fraunces (opsz 144) başlık + Inter gövde; 5 kademeli ölçek, italik altın vurgu |
| Hiyerarşi yok | Sayfa başına tek altın (primary) düğme; ikincil eylemler hayalet/çerçeve |
| Lobi koltukları "çocuksu" daire çizimi | Koltuklar **oyuncu kartı** ızgarası (5 sütun masaüstü, 2 sütun telefon); boş koltuk kesikli, ilk boş koltuk "Davet et" |
| Boşluklar dengesiz | 4/8/12/16/24/40 px aralık ölçeği, `clamp()` kenar boşluğu, 1280 px konteyner |

## 2. Tasarım ilkeleri

1. **Sahne zaten var; onu göster.** Giriş/lobi, oyunun kendi 3B masasının önünde geçer
   (statik render, three yüklenmez). Palet aynı: ceviz, keçe, krem, pirinç.
2. **Sayfa başına tek altın düğme.** "Oda aç" / "Odaya katıl" / "Oyunu başlat". Diğer her
   şey hayalet, çerçeve ya da metin bağlantısı.
3. **Derinlik katmanla, çizimle değil.** Blur'lu render → vinyet → cam panel (backdrop-blur,
   1 px açık kenar, üstte pirinç hairline) → içerik. Gölge yalnız panelde ve altın düğmede.
4. **Telefon önce.** 390 px'te tek sütun; lobide hazır anahtarı + başlat düğmesi sabit alt
   çubukta; oda kodu üst çubukta hep görünür; dokunma hedefi ≥44 px.
5. **Durum, renk + ikon + metin.** Hazır = yeşil halka + tik + "Hazır"; kopuk = gri avatar +
   kesikli kenar + amber "Bağlantı koptu"; boş = kesikli kutu + numara. Rol ima eden hiçbir
   renk/simge yok (liberal mavisi ve faşist kırmızısı lobide kullanılmaz).

## 3. Referanslar (okundu, 2026-09-11)

| Referans | Ne iyi | Ne alınır |
| --- | --- | --- |
| [Board Game Arena yeni arayüz / yeni lobi](https://en.boardgamearena.com/news?id=420) ([forum](https://forum.boardgamearena.com/viewtopic.php?t=13978)) | 11 yıllık UX'i yeni oyuncu testine göre "modası geçmiş" diye yeniledi; masaüstünde alışkanlığı bozmadan biçim/renk, mobilde gezinme değişti. | Aynı yaklaşım: akış aynı kalır (isim → oda → lobi), yalnız biçim/renk/tipografi değişir. |
| [Colonist.io lobi](https://blog.colonist.io/colonist-101-how-to-play/) ([Discord sürümü tasarım notları](https://github.com/colonistio/design/issues/173), [öneri: "I'm Ready" daha görünür olsun](https://colonist.featureupvote.com/suggestions/98986/make-im-ready-button-more-visible)) | Host belirgin, "I'm Ready" işareti ve "Start Game" yalnız hostta; ayar değişince herkes hazırdan düşer. | Hazır anahtarı büyük ve sabit; başlat düğmesinin altında neden başlamadığı tek satırda yazar. Kullanıcı şikâyeti (hazır düğmesi görünmüyor) bizde alt çubuk kararını doğruluyor. |
| [Codenames Online](https://codenames.game/) | Tek alan (takma ad) + tek düğme; oda bağlantısı paylaşımı akışın merkezi; kurulum yok hissi. | Girişte isim + tek altın düğme; davet bağlantısı lobide birincil eylem ("Kopyala" altın). |
| [Jackbox (jackbox.tv)](https://www.jackboxgames.com/how-to-play) ([destek](https://support.jackboxgames.com/hc/en-us/articles/15794759479959-How-do-I-join-a-game)) | Oda kodu büyük ve hep üstte; katılım "kod + isim + PLAY" ile bir dakikadan kısa. | 6 hücreli kod girişi (OTP deseni), lobide kod üst çubukta ortada, kopyalama ikonu yanında. |

## 4. Bilgi mimarisi ve akış

```
/            Giriş: isim → [Oda aç]            → /oda/:id (lobi, host)
             isim + kod → [Koda katıl]         → /katil/:code
/katil/:code Katıl: kod dolu + isim → [Odaya katıl] → lobi (konuk)
/oda/:id     Lobi: kod/davet · koltuk kartları · karakter (B3) · hazır · başlat (host)
```

Girişte "Nasıl oynanır" üst çubuk bağlantısı sayfa içi 3 adıma kaydırır (ayrı sayfa yok).
Katıl sayfasında "Başka kod gir" girişe `?code=` ile döner. Lobide üst çubuk menüsü
(☰): ses/hareket tercihleri, odadan ayrıl.

## 5. Ekran düzenleri

### Giriş (`entry.html`)
- **Masaüstü (≥900 px):** üst çubuk (marka solda, "Nasıl oynanır" sağda). Ana alan iki sütun:
  sol 1.15fr — eyebrow, 84 px Fraunces başlık ("Masaya otur. / *Kimseye güvenme.*"),
  lead, 3 küçük bilgi noktası; sağ 360–440 px cam kart — "Oyuna başla", canlı rozet
  "Sunucu açık" (`/api/health`), isim alanı, altın "Oda aç →", ayraç "veya davetle katıl",
  6 hücre kod, ipucu, çerçeveli "Koda katıl" (6 karakter olana dek devre dışı). Altta
  3 adımlı şerit, altbilgi (sürüm/protokol/istemci).
- **Telefon:** aynı sıra tek sütun; başlık 56 px; kart kaydırmadan "Oda aç"a kadar görünür
  (844 px'te düğme ~590 px'te). Arka plan render 1.6× büyütülüp koyulaştırılır, tahta
  kartın arkasına düşer.

### Katıl (`join.html`)
- Tek ortalanmış kart (≤460 px): eyebrow "Davet", başlık "**{host} seni masaya çağırıyor**"
  (host adı yoksa "Masaya davetlisin"), oda kutusu (pirinç zemin: "Oda kodu", `4 / 10
  oyuncu`, `Lobide` rozetleri, 6 dolu hücre, "Kod bağlantıdan alındı · Başka kod gir"),
  isim alanı (autofocus), altın "Odaya katıl →", bilgi notu (ekranını paylaşma), altta
  "← Ana sayfa" ve "yeni oda kur".
- Oda önizlemesi (`4/10`, `Lobide`) yeni bir hafif uç ister (`GET /api/room-preview?code=`,
  yalnız sayı+faz döner); yoksa bu satır gizlenir, tasarım bozulmaz.

### Lobi (`lobby.html`)
- **Üst çubuk:** marka · ortada oda kodu çipi (`ODA QT8SKK` + kopyala ikonu) · bağlantı
  noktası "Bağlı" · menü. Telefonda marka yalnız ikon, çip ortada kalır.
- **Masaüstü:** sol — "Lobi · canlı", H1 "Masa kuruluyor", özet satırı (`7 / 10 oyuncu ·
  3 hazır · 1 bağlantı bekleniyor`), sağda 10 dilimli koltuk ölçeri; altında **koltuk kartı
  ızgarası** 5 sütun × 2 satır (`minmax(140px,1fr)`), kartlar 172 px. Sağ ray 360 px,
  yapışkan: "Arkadaşlarını çağır" (bağlantı alanı, altın Kopyala, Paylaş yalnız
  `navigator.share` varsa), "Karakterin" (B3 yer tutucu: 5 renk kutusu, "Yakında"),
  eylem paneli (Hazırım anahtarı + "Oyunu başlat" + ilerleme çizgisi + neden satırı),
  DEV'de kesikli "5 bot ekle".
- **Telefon (≤960 px):** sıra — başlık/özet → davet paneli → 2 sütun kartlar → karakter →
  DEV. Eylem paneli `position: fixed` alt çubuk (safe-area dahil, üstü yuvarlak); toast
  üst çubuğun altına iner.
- **Koltuk kartı:** 60 px avatar (baş harf, Fraunces; kişi başına sabit toprak tonu),
  ad (tek satır, ellipsis), rozet satırı. Host: altın taç + "Oda sahibi". Sen: pirinç
  kenar + köşede "Sen". Hazır: yeşil halka (nabız) + tik. Kopuk: gri avatar, kesikli
  kenar, amber rozet. Boş: kesikli, numara; ilk boş koltuk "＋ Davet et" (tıklanınca
  paylaş/kopyala). Sıra sunucunun `seatIndex`'i; yerel oyuncu başa alınmaz (kart
  ızgarasında "altta" kavramı yok; "Sen" etiketi yeter).

## 6. Tipografi

| Rol | Font | Boyut / satır | Not |
| --- | --- | --- | --- |
| Display | Fraunces 500, `opsz 144`, `-0.025em` | 84/0.98 masaüstü · 56 telefon | ikinci satır italik 400, altın |
| H1 | Fraunces 500 | 40/1.05 · 30 telefon | lobi/katıl başlığı |
| H2 | Fraunces 500 | 22–24/1.2 | panel başlıkları (18 px rayda) |
| Gövde | Inter 400 | 16/1.5 | lead 19/1.55 |
| Etiket | Inter 600 | 13 | form etiketleri |
| Eyebrow | Inter 600, `+0.14em`, büyük harf | 12 | altın |
| Kod | ui-monospace | 24 hücre · 18 çip · 13 URL | tabular |

Font yükü: Google Fonts `Fraunces ital,opsz,wght 0,9..144,400;0,9..144,500;1,9..144,400`
+ `Inter 400;500;600`, `display=swap`. Üretimde **yerel alt küme** önerisi: Fraunces
Latin+Türkçe (ğışçöü) 2 stil ≈ 2×40 kB woff2, Inter 3 ağırlık ≈ 3×30 kB; toplam ≤180 kB,
`font-display: swap`, `<link rel=preload>` yalnız Fraunces 500. Lisans: OFL (ikisi de),
`docs/ASSETS.md`'ye kaydedilir.

## 7. Renk tokenleri (CSS değişkeni → hex)

| Token | Değer | Kullanım |
| --- | --- | --- |
| `--bg-0` | `#0b100f` | en koyu zemin, vinyet |
| `--bg-1` | `#121a18` | sayfa zemini, `theme-color` |
| `--felt` / `--felt-deep` | `#234b40` / `#183530` | avatar ve karakter tonları |
| `--walnut` / `--walnut-deep` | `#583b2b` / `#3b2618` | avatar tonu, taç ikonu |
| `--cream` | `#eee1c7` | birincil metin (13:1) |
| `--cream-2` | `#cfc3a9` | ikincil metin (≈9:1) |
| `--cream-3` | `#a39a86` | ipucu/altbilgi (≈5:1) |
| `--brass` | `#b49359` | ölçer dilimi, kenar |
| `--gold` / `--gold-hi` | `#e3be73` / `#f3d68f` | eyebrow, bağlantı, altın düğme |
| `--ink` | `#1b1f1e` | altın düğme ve toast metni |
| `--ready` | `#8fd3a5` | hazır, bağlı |
| `--warn` | `#e6a95c` | bağlantı koptu, başlatılamıyor nedeni |
| `--error` | `#e8907f` | form/hata satırı |
| `--glass` / `--glass-2` | `rgba(15,23,21,.68)` / `rgba(22,32,29,.52)` | panel / koltuk kartı |
| `--line` / `--line-strong` | `rgba(238,225,199,.10 / .20)` | kenarlar |
| `--brass-line` | `rgba(180,147,89,.42)` | hairline, "sen", davet kutusu |

Kontrast (`#121a18` üstünde, hesaplandı): cream 13.7:1, cream-2 10.1:1, cream-3 6.3:1,
gold 10.0:1, ready 10.1:1, warn 8.6:1, brass 6.1:1; altın düğme üstünde ink 9.4:1. Hepsi ≥4.5.

## 8. Bileşenler

- **Buton:** `.btn` 52 px (sm 40, ikon 40×40); `--primary` altın gradyan + iç parlaklık +
  sıcak gölge; `--secondary` çerçeve; `--ghost` şeffaf; `--dev` kesikli + `DEV` kbd.
  Devre dışı: %45 opaklık + `aria-disabled` + neden metni.
- **Metin alanı:** 52 px, koyu yarı saydam, odakta altın kenar + 4 px hale.
- **Kod girişi:** 6 hücre 56 px, 3+3 gruplama (fazladan 6 px boşluk), imleç hücresi altın;
  uygulamada tek `<input inputmode="latin" autocapitalize="characters" maxlength="6">`
  + üstüne çizilen hücreler (`EntryPage.normalizeInviteCode` korunur). Dolu hâl pirinç.
- **Oda çipi:** pill, `ODA` etiketi + mono kod + kopyala ikonu; telefonda etiket gizli.
- **Koltuk kartı:** §5; `<li>` + `sr-only` durum cümlesi ("Mert, oda sahibi, sen, hazır").
- **Rozet (`.tag`):** 24 px pill; `--ready`, `--warn`, `--host`, `--me`, `--live` (nabızlı nokta).
- **Ölçer:** 10 dilim (yeşil hazır / pirinç dolu / soluk boş) + "en az 5".
- **Anahtar:** `role="switch"` 56×32, açıkken yeşil.
- **Toast:** krem, koyu metin, alt orta (telefonda üst); 1.5 s.
- **Panel:** cam, 24 px yarıçap, üst pirinç hairline.

## 9. Durumlar

| Durum | Görünüm |
| --- | --- |
| Boş giriş | İsim boş → "Oda aç" devre dışı değil, gönderince alanın altına kırmızı tek satır ("2–20 karakter"). Kod <6 → "Koda katıl" `aria-disabled`. |
| Yükleniyor | Düğme metni "Oda açılıyor…" + altın halka; alanlar kilitli; sayfa değişmez (skeleton yok, geçiş <1 s). Lobi ilk açılış: kart ızgarası 5 soluk kesikli iskelet 300 ms. |
| Hata (form) | Kartın içinde `role="alert"` şerit: `--error` kenar, `errorText(key)` metni, sonraki adım cümlesi zaten metinde. |
| Oda bulunamadı / dolu / oyun başladı | Katıl kartı aynı yerde: başlık "Bu odaya girilemiyor", `ERROR_MESSAGES` metni, altın düğme "Yeni oda kur", ikincil "Ana sayfa". |
| Dolu oda (lobi) | Boş koltuk kartı kalmaz; özet "10 / 10 oyuncu"; davet paneli başlığı "Masa dolu", Kopyala ikincil olur. |
| Bağlantı koptu (yerel) | Üst çubuk noktası amber + "Yeniden bağlanılıyor…" (mevcut `ConnectionBanner` metinleri); eylem paneli `inert`, %60 opak; kartlar kalır. |
| Başkası koptu | Kartı gri/kesikli + amber rozet; başlat nedeni "Deniz bağlantı kurmalı." |
| Host başlatabilir | "Oyunu başlat" tam altın, ilerleme çizgisi dolu, neden satırı yeşil "Herkes hazır". |
| Konuk | Eylem panelinde başlat düğmesi yok; yerine "Oda sahibi başlatacak" satırı + ilerleme. |
| Reduced motion | Tüm animasyon/geçiş kapalı (`prefers-reduced-motion`). |

## 10. Animasyon / mikro-etkileşim (yalnız CSS)

- Sayfa girişi: paneller `enter` 500 ms yukarı kayma + opaklık, 80 ms kademeli.
- Koltuk kartları 40 ms kademeli giriş; yeni oyuncu katılınca aynı animasyon (React key).
- Hazır: avatar çevresinde 2.4 s `ping` halkası; anahtar 180 ms kayar.
- Canlı rozet noktası 2.2 s nabız. Kod imleci 1 s yanıp söner.
- Düğme hover `translateY(-1px)` + gölge; aktif geri.
- Toast 320 ms yükselir. Kopyalanınca düğme metni 1.5 s "Kopyalandı".
- Arka plan sabit (`position: fixed`), parallax yok (telefon pili).

## 11. Erişilebilirlik

- Tüm etkileşimler klavyeyle: sekme sırası görsel sıra; odak halkası 3 px altın, 3 px ofset.
- Kod hücreleri tek input olduğundan ok/backspace doğal çalışır; `aria-label="Davet kodu,
  6 karakter"`.
- Kartlar `<ul aria-label="Masadaki oyuncular">`, her kart `sr-only` durum cümlesi;
  boş koltuk "Boş koltuk 9"; "Davet et" `role="button"` + `tabindex`.
- Anahtar `role="switch" aria-checked`; başlat `aria-describedby` neden satırına.
- Renk tek başına anlam taşımaz (ikon + metin). Kontrast tablosu §7.
- Hedefler ≥44 px (kopyala ikonu 40 px ama çip 40 px yüksek + 8 px dolgu → 48).
- `lang="tr"`, `viewport-fit=cover`, `env(safe-area-inset-bottom)`.

## 12. Performans sınırı

- Giriş/katıl/lobi rotasında **three yüklenmez** (mevcut `React.lazy` + `preloadScene()`
  lobide korunur; giriş chunk'ına scene import'u girmez — B6'daki `node -e` denetimi tekrar).
- Arka plan: `bg-table.webp` **19 kB** (1280×750, q74); ≤150 kB sınırının çok altında.
  AVIF gerekmez. `<img loading="eager" fetchpriority="high" decoding="async">`,
  `aspect-ratio` ile CLS yok. Blur CSS'te; ayrı blur'lu dosya yok.
- Fontlar ≤180 kB toplam (§6). CSS ≈ 12 kB. İkonlar inline SVG (paket yok).
- `backdrop-filter` telefonda 4 panel + 10 kart = 14 katman; Android orta segmentte
  sorun görülürse kartlar için `backdrop-filter` kapatılıp düz `--glass-2` kalır
  (`@supports` / `(max-width)` ile).

## 13. Uygulama planı (kod yasağı kalkınca)

| Adım | Dosyalar | İş |
| --- | --- | --- |
| 1. Token + kabuk | `apps/web/src/ui/styles.css` (`.shell*`, `.hero*`, `.btn*`, `.howto*`, `.code-badge*`, `.table*`, `.seat*`, `.lobby*` bölümleri yeniden yazılır; `.game*` dokunulmaz), `apps/web/index.html` (font preload, `theme-color #121a18`), `apps/web/public/bg-table.webp` | 0.5 gün |
| 2. Screen/Backdrop | `apps/web/src/ui/Screen.tsx` (nav + `.bg` + panel), `TableBackdrop.tsx` **silinir** | 0.25 gün |
| 3. Giriş + katıl | `apps/web/src/app/EntryPage.tsx`, `JoinPage.tsx` (+ kod hücre bileşeni `ui/CodeInput.tsx`), testleri güncelle | 0.75 gün |
| 4. Lobi | `apps/web/src/ui/Lobby.tsx`, `LobbyTable.tsx` → `SeatGrid.tsx` (kart ızgarası), `Lobby.test.tsx` | 0.75 gün |
| 5. Fontlar | `apps/web/public/fonts/*.woff2` alt küme (fontTools yoksa Google Fonts CSS'ten unicode-range'li woff2 indirilir), `docs/ASSETS.md` | 0.25 gün |
| 6. QA | Playwright çekimler (`scratchpad/`), `docs/qa/claude/d8/`; typecheck/test/build; giriş chunk'ında THREE yok denetimi | 0.25 gün |

Toplam ≈ 2.75 gün. Sözleşme değişmez; isteğe bağlı `room-preview` ucu (katıl sayfası
önizlemesi) ayrı küçük görev (`apps/web/api/`, 0.25 gün) — yoksa satır gizlenir.

## Onay soruları

1. **Yön:** "sinematik render + cam panel + serif başlık" yönü onay mı? Alternatif: render
   yerine tamamen stilize illüstrasyon (daha temiz ama yeni üretim işi).
2. **Font:** Fraunces (karakterli, italik vurgu) mı, daha klasik **Playfair Display** mi,
   yoksa tek font Inter (serif yok) mu?
3. **Arka plan tipi:** seçilen kare `docs/qa/codex/qa-review/effects-deal-mid.png`
   (üstten genel masa, lambalar) — bu mu; yoksa birinci şahıs kare
   (`docs/qa/claude/a2-a3/desktop-1440x900.png`, eller ve kartlar) mı? İkincisi daha
   dramatik ama kanun kartları görünür.
4. **Lobi koltuk gösterimi:** kart ızgarası (bu taslak) mı, yoksa render'ın üstüne masa
   çevresine dizilmiş küçük kartlar (masa hissi, ama telefonda 10 kişide sıkışır) mı?
