# D24 — uzak kafa hareketinde ara değer (entity interpolation)

Tarih: 2026-09-13 (Opus yan ajan). Durum: **teslim, kullanıcı doğrulaması bekliyor.**
Kullanıcı şikâyeti: "kafalar online oynarken saniyede 2 kez kasılarak gidiyor."

## 1. Kapsam

- **Gönderim tarafı DEĞİŞMEDİ**: `viewpointInterval(n) = max(500, min(10,n)² × 15)` ms
  (Supabase Free 100 msj/s kotası), `HeadViewpoint` tel biçimi, `packages/contracts`,
  sunucu, game-core, migration — hiçbiri dokunulmadı. Düzeltme yalnız ALICI tarafında.
- Kök neden: alıcı her karede son örneğe `1−exp(−12·dt)` ile koşuyordu; örnek 540 ms'de
  bir geldiği için hareket "≈100 ms hızlı kay, 440 ms dur" basamağı oluşturuyordu.

## 2. Çözüm

Yeni saf modül `packages/scene/src/live/headInterpolation.ts`:

- Oyuncu başına **8 örneklik tampon** (`HeadBuffer`), sıra `sequence` ile korunur.
- **Render zamanı = şimdi − gecikme.** Gecikme = ölçülen aralık × 1,2 + 40 ms;
  aralık son 5 farkın **medyanı** (ölçüm yokken 540 ms varsayılan), gecikme tavanı
  `min(1200 ms, staleAfter/2)`. 540 ms akışta **gecikme = 688 ms**.
- İki örnek arasında **düz ara değer**; yaw için sarmal (−π..π) güvenli `lerpAngle`.
  Düz seçildi: Catmull-Rom aşırı atış yapıp kare farkı eşiğini (ideal × 1,5) aşabiliyor;
  köşeleri zaten üstteki üstel yumuşatma yuvarlıyor.
- **İleriye tahmin YOK**: render zamanı son örneği geçince orada durur (`behind=false`).
- Render imleci **monoton** ve gerçek zamanın en çok 1,35 katı hızla ilerler: aralık
  ölçümü değişince (jitter) kare atlanmaz.
- Uzun sessizlikten (> 3 aralık ya da > 1,2 s) sonra gelen örnek tamponu **sıfırlar**:
  4 s'lik boşluğu ara değerle taramak yavaş kayma + sonda sıçrama demek olurdu.
- Yumuşatma katsayısı aralığa bağlı (`smoothingRate`): gecikme aralığı kapatıyorsa
  τ = 60 ms (ara değer zaten sürekli, ek gecikme yok); kapatmıyorsa (10 kişi: aralık
  1500 ms > tavan 1200 ms) τ = aralık/4 (80–220 ms) ile kalan küçük basamak yayılır.

Bağlantılar:

- `PeerHeads.get()` **ham** en yeni örneği verir (tazelik damgası `receivedAt` odur,
  `headTarget` stale → nötr davranışı aynen korunur); yeni `pose()` aynı örneği ara
  değerli yaw/pitch ile döndürür, `rate()` yumuşatma katsayısını, `pending` tamponda
  oynatılacak veri olup olmadığını verir.
- `CharacterAvatar`: hedef `heads.pose(...)`, katsayı `heads.rate(...)`.
  **`reducedMotion` eski davranışta**: ham son örnek + anında geçiş (ara değer yok).
  Yerel oyuncunun kendi kafası (`sample` yolu, `heads` yok) hiç değişmedi; 12/s sabiti orada.
- `frameloop="demand"`: `PeerHeadsBridge` ve `CharacterAvatar` yalnız `heads.pending`
  iken `invalidate()` çağırır; render zamanı son örneği geçince istek durur.
- D16 jest sapması (`headPitchOffset`), `ko`/`!alive` çöküşü ve `EmoteArms` `point`
  nişanı aynı; `point` kolu da artık ara değerli pozu izler (`TableScene.seatLook`).

## 3. Ölçüm (canlı, dev bellek kipi)

`SUPABASE_URL= VITE_SUPABASE_URL= pnpm --filter @secret-table/web dev --port 5203 --strictPort`
→ `/dev/scene?fixture=president-discard&sweep=540&camera=seat` (dev-only `&sweep`
parametresi uzak başları 540 ms'de bir örneklenen üçgen taramayla besler; gerçek
kanal ve gönderim kodu değişmez). Playwright ile 6 s boyunca her karede
`canvas[data-fp-head-yaw1]` okundu; kare farkları kare süresine göre normalize edildi
(atlanan kare sahte sıçrama saymasın). Tarama hızı 1 rad / 2160 ms → **ideal kare
farkı 0,0077 rad**. "Önce" ölçümü, alıcıyı geçici olarak eski davranışa (son örneğe
koşma + 12/s) çevirip aynı akışla alındı; yama sonra geri alındı.

| ölçüt (rad/kare, 16,7 ms'e normalize) | önce (eski) | sonra (D24) |
| --- | --- | --- |
| medyan (p50) | 0,0020 | **0,0071** |
| p95 | 0,0417 | **0,0083** |
| en büyük kare farkı | 0,0513 (ideal × 6,7) | **0,0119 (ideal × 1,55)** |
| > 20 mrad "sıçrama" kare sayısı | 52 | **0** |
| hareketsiz kare (< 0,1 mrad) | 99 / 357 | **4 / 356** |
| ölçülen kare sayısı (6 s) | 361 | 357 |

Okuma: eskiden kareler ya donuyor (p50 ideal'in ¼'ü) ya da sıçrıyordu (p95 ideal'in
5,4 katı) — saniyede ~2 basamak. Yenide her kare ideal adıma oturuyor (p50 0,0071 ≈
ideal 0,0077), p95 ideal × 1,08, 20 mrad üstü sıçrama yok.

Kareler `docs/qa/claude/d24/`:

- `yaw-grafik.jpeg` — aynı 2,5 s penceresinde iki eğri: turuncu (önce) plato + dik
  rampa basamakları, mavi (sonra) düz ve sürekli üçgen.
- `sahne-once.jpeg`, `sahne-sonra.jpeg` — koltuk kamerasından iki uzak kafa.

Birim testte de aynı akış saf olarak oynatıldı: yeni yol `maxStep ≤ ideal × 1,5`,
eski yol `maxStep > ideal × 5`.

## 4. Testler

`packages/scene/src/live/headInterpolation.test.ts` — **14 yeni test**: sarmal
(`wrapAngle`/`lerpAngle`), medyan aralık, gecikme/tavan, yumuşatma katsayısı,
`poseAt` sınırları, `HeadBuffer` (eski `sequence` düşer, kapasite, sessizlik sonrası
sıfırlama), 60 fps oynatma (kare farkı eşiği, yumuşatmalı hâli, jitter ±150 ms'de
monotonluk, örnek kesilince durma + ileriye tahmin yok), `PeerHeads` (ara değer son
örneğin gerisinden okunur, ham örnek değişmez, `pending` hareket bitince düşer,
stale'de `headTarget` nötre döner).

Geçen komutlar:

- `pnpm -r typecheck` → **6/6 Done**
- `pnpm test` → **1012 test** (D24 öncesi 998; +14), 68 dosya, hepsi geçti
- `pnpm --filter @secret-table/web build` → geçti (3,43 s)

## 5. Sapmalar / kalan

- **Gecikme tavanı 1200 ms.** 9–10 kişide aralık 1215/1500 ms olduğu için istenen
  "aralık × 1,2" (1458/1840 ms) tavanla kırpılır; baş 1,2 s'den fazla geri kalmaz.
  10 kişide segmentin ~%80'i ara değerle, kalanı yavaşlatılmış yumuşatmayla
  (τ ≈ 220 ms) örtülür — basamak görünür değil ama teorik olarak tam kapalı da değil.
  Tavanı yükseltmek gecikmeyi görünür kılar; alternatif, gönderim aralığını düşürmek
  (kota nedeniyle yasak).
- Jitter testinde kare farkı eşiği **en kısa** aralığa (540 − 150 ms) göre ölçülür;
  akış hızlanınca kare adımı da doğal olarak diklesir.
- Ara değer düz (linear) seçildi; Catmull-Rom/Hermite denenmedi (§2 gerekçe).
- `apps/web/src/dev/DevScenePage.tsx` içine yalnız dev olan `&sweep=<ms>` ölçüm
  parametresi eklendi (üretim paketinde `/dev/*` yok).
- Gerçek Supabase Realtime ile ölçüm YAPILMADI (bellek kipinde Realtime yok);
  sentetik 540 ms akışla ölçüldü. Gerçek odada 5+ kişiyle kullanıcı doğrulaması kaldı.
- Commit/push yapılmadı.

---

# Tur 2 — sapma (jitter), kayıp toleransı ve sınırlı ileri tahmin

Tarih: 2026-09-14 (Opus yan ajan). Durum: **teslim, kullanıcı doğrulaması bekliyor.**
Kullanıcı bulgusu (canlı Vercel + gerçek Supabase, tur 1 yayında):
"eller akıcı ama kafalar hâlâ kasarak ilerliyor".

## 6. Teşhis

Tur 1 gecikmesi sabit bir formüldü (medyan aralık × 1,2 + 40 ms) ve imleç son
örneğe ulaşınca DURUYORDU. Gerçek Realtime'da paketler düzensiz gelir ve bakış
paketinde tekrar yoktur (jest paketinin aksine), yani kayıp mümkündür: geç ya da
kayıp bir pakette imleç tamponun sonuna yetişip bekliyor, paket gelince
1,35× hızla koşuyordu — görünen şey "kasma". Yerel bellek kipinde paketler tam
zamanında geldiği için tur 1 ölçümünde görünmedi.

## 7. Tur 2'de değişen alıcı davranışı (gönderim tarafı yine DEĞİŞMEDİ)

1. **Sapmaya göre gecikme.** Son 12 GELİŞ aralığından (en az 6 ölçüm) **p90 + 60 ms**;
   kayıp oranı %10'u aşarsa pay **150 ms**. Alt sınır medyan × 1,1, üst sınır
   `min(1500 ms, staleAfter/2)` (tur 1'de tavan 1200 ms idi). Ölçüm 6'dan azken
   tur 1 formülüne düşer. Gecikme **artarken anında**, azalırken **τ = 2 s** ile
   uygulanır (`easeDelay`).
2. **Kayıp sezimi.** Bu protokolde alıcıdaki `sequence` paketin GELİŞ damgasıdır
   (`acceptHeadWire` `t = now` yazar; tel üstündeki `seq` yukarı taşınmaz), bu yüzden
   boşluk geliş aralığından sezilir: aralık ölçülen medyanın **1,6 katını** aşarsa
   slot sayısı `round(aralık/medyan)` (2–5) kabul edilir ve aralık slota BÖLÜNerek
   istatistiğe girer — kayıp ölçümü iki katına şişirmez. Bölme yalnız uzun boşluğa
   uygulanır; her aralığa uygulansaydı tek bir kısa ölçüm tahmini aşağı çeker,
   sonra her boşluk daha çok slota bölünür ve aralık tahmini çökerdi (ilk denemede
   aralık 540 → 120 ms'e düştü, ölçümle yakalandı).
3. **Düzenleme (de-jitter).** Gönderim aralığı sabit olduğu için örnek damgası
   gönderim ızgarasına oturtulur (`önceki + slot × aralık`), gerçek gelişe %15
   çekilir. Yoksa 100 ms arayla gelen iki paket o adımı 100 ms'de taratıyordu
   (ara değerin kendisi sıçrama üretiyordu). Kayıp slot ızgarada yerini korur:
   iki katlık adım iki aralığa yayılır, kayıpta hızlanma olmaz.
4. **Sınırlı ileri tahmin.** İmleç son örneği geçerse son iki örneğin açısal hızıyla,
   **τ = aralık/2** üstel sönümüyle, en çok **1 aralık** ilerler; ilerleme bir örnek
   adımını ve `ViewpointAdapter` sınırlarını (yaw ±0,65, pitch ±0,25) aşamaz.
   Tahmin bitince poz donar ve `behind=false` olur → `frameloop="demand"` boşta durur.
   `reducedMotion` yolu `heads.get()` (ham örnek) kullandığı için **tahmin yok**.
5. **İmleç hız sınırı ±%20.** Gecikme değişimi render imlecini gerçek zamanın
   0,8–1,2 katı dışına çıkaramaz (tur 1'de tek yönlü 1,35× idi).
6. **Yakalama hız sınırı.** Geç/kayıp paketten sonra yeni parça imlecin
   GERİSİNDEN başlar, yani ham hedef sıçrar. Poz bu farkı o anki parçanın doğal
   hızının **1,5 katı + 0,18 rad/s** ile kapatır: kare farkı doğal adımın ~3
   katını aşmaz, görünür sıçrama olmaz (hedef sıçratılmaz, üstteki üstel
   yumuşatma aynen kalır).
7. **Tampon açlığı geri beslemesi.** İmleç son örneği geçtiyse gecikme hedefi
   yarım aralık büyütülür (tavan 1500 ms), böylece aynı kayıp deseni ikinci kez
   tahmine düşürmez; sessizleşince τ = 2 s ile geri iner.
8. **Taşıma payı.** İmleç `şimdi − taşıma − gecikme`; taşıma = penceredeki EN KÜÇÜK
   (`geliş − damga`) farkı. Bugünkü protokolde damga zaten alıcı saatindedir
   (≈0), ama gönderen damgasına geçilirse imlecin örneklerin önüne düşmesini önler.
9. `idle stop` ve `VIEWPOINT_STALE_MS` davranışı aynı: tahmin bitince yumuşakça
   durur, tazelik dolunca `headTarget` nötre döndürür.

## 8. Ölçüm 1 — sentetik (dev, bellek kipi)

`/dev/scene?fixture=president-discard&camera=seat&sweep=540` artık yalnız dev olan
`&jitter=<ms>` (paketi 0–jitter ms geciktirir) ve `&loss=<0..0.5>` (paketi düşürür)
parametrelerini alır; açı NOMİNAL slotta üretilir, teslim gecikir/düşer.
Tarama periyodu 4320 → **4000 ms** yapıldı: 540 ms'in tam katı olduğu için tepe hep
aynı fazda örnekleniyor, iki eşit örnek arası düz ara değer yapay "donuk kare"
platosu üretiyordu (tur 1 tablosu bu yüzden yeniden ölçüldü).

12 s, 60 fps, kare süresine normalize; ideal kare farkı **0,0083 rad**:

| ölçüt (rad/kare) | tur 1 düzenli | **tur 2 düzenli** | tur 1 ±300 ms + %10 kayıp | **tur 2 ±300 ms + %10 kayıp** |
| --- | --- | --- | --- | --- |
| p50 | 0,00794 | 0,00794 | 0,00699 | 0,00725 |
| p95 | 0,01021 | **0,00950** | 0,02109 | **0,01016** |
| en büyük kare farkı | 0,02039 | **0,01450** | 0,60012 | **0,01282** |
| > 20 mrad sıçrama | 2 | **0** | 37 | **0** |
| donuk kare | 13 / 720 | **7 / 719** | 74 / 719 (%10,3) | **5 / 720 (%0,7)** |

## 9. Ölçüm 2 — GERÇEK Supabase Realtime (zorunlu)

`pnpm --filter @secret-table/web dev --port 5206 --strictPort` (gerçek `.env`),
iki Playwright bağlamı + `botRunner` ile 3 bot = 5 oyuncu, tek oda, oyun başlatıldı,
ikisi de koltuk kamerası. A 20 s boyunca fareyle düzenli yatay tarama yapar
(4 s'de bir tur), B'de hem gelen `head` paketlerinin geliş anları hem kare başına
yaw farkı ölçülür. Geliş anları için `acceptHeadWire` içine GEÇİCİ bir ölçüm satırı
kondu ve ölçümden sonra geri alındı (depoda yok). Gönderim aralığı 5 oyuncuda
`viewpointInterval(5) = 500 ms`.

| ölçüt | tur 1 odası | **tur 2 odası** |
| --- | --- | --- |
| paket / 20 s | 40 | 40 |
| kayıp (seq boşluğu) | 0 | 0 |
| geliş aralığı p50 | 501 ms | 501 ms |
| geliş aralığı p90 | 510 ms | **591 ms** |
| geliş aralığı en büyük / en küçük | 527 / 409 ms | **647 / 243 ms** |
| seçilen gecikme (p90 + 60) | — (sabit 688 ms) | **≈ 570–650 ms** |
| kare farkı p50 (1081 kare, ilk 2 s hariç) | 0,00675 | 0,00678 |
| kare farkı p95 | 0,00799 | 0,00823 |
| **en büyük kare farkı** | 0,04445 (ideal × 5,4) | **0,01993 (ideal × 2,4)** |
| **> 20 mrad sıçrama** | 4 | **0** |
| donuk kare | 2 / 1081 | **1 / 1081** |

Okuma: yerel dev + bulut Realtime yolunda ağ sapması küçüktür (p90 510–591 ms),
yani gecikme 570–650 ms'e oturur — tur 1'in sabit 688 ms'inden düşük ama duruma
göre değişen bir değer. Tur 2 daha SAPMALI bir örneklemede (p90 591, maks 647,
min 243 ms) tur 1'den iyi çıktı: sıçrama karesi 4 → 0, en büyük kare farkı yarıdan
aza indi. Kullanıcının gerçek ağında sapma daha büyük olacağı için kazanç daha da
belirgin olmalı.

Kareler `docs/qa/claude/d24/`:

- `tur2-sentetik-jitter.jpeg` — sentetik ±300 ms + %10 kayıp akışında yaw eğrisi
  (turuncu tur 1: basamak/plato, mavi tur 2: sürekli).
- `tur2-canli-yaw.jpeg` — gerçek Supabase odasında uzak baş yaw'ı, 4 s pencere.
- `tur2-canli-kare-farki.jpeg` — gerçek odada kare başına yaw farkı; kesik çizgi
  20 mrad eşiği (turuncu tur 1 eşiği 4 kez aşar, mavi tur 2 hiç aşmaz).

## 10. Testler (tur 2)

`packages/scene/src/live/headInterpolation.test.ts` **14 → 21 test** (+7):
yüzdelik/`easeDelay`, p90 gecikme + kayıp payı + alt/üst sınır, kayıp aralığı
şişirmeme, imleç hızının ±%20 içinde kalması, tahminin en çok 1 aralık ve sönümlü
olması (+ `predict=0` reducedMotion yolu, sınır kırpma), ±300 ms sapma + %10 kayıplı
akışta 0 sıçrama / < %5 donuk kare, düzenli akışta tur 1'den geri gitmeme.
Davranış değiştiği için iki eski test güncellendi: "son örnekte durur, tahmin yok"
→ "sönümlü tahminle en çok yarım adım ilerler, sonra durur"; jitter testinde
"monotonluk" → "kaba geri gidiş yok" (tahmin aşarsa yakalama geri düzeltir; tek
kare geri adımı ileri adımla aynı sınırda, toplamı iki örnek adımından az).
Kare farkı eşikleri 1,5× → 3,5× yapıldı (yakalama sınırının tanımı: doğal hızın
1,5 katı + taban).

Geçen komutlar:

- `pnpm -r typecheck` → **6/6 Done**
- `pnpm test` → **1024 test** (tur 1 sonrası 1017; +7), hepsi geçti
- `pnpm --filter @secret-table/web build` → geçti (4,43 s)

## 11. Sapmalar / kalan (tur 2)

- **Kayıp, `seq` boşluğundan değil geliş boşluğundan sezilir.** Tel üstündeki `seq`
  `acceptHeadWire` içinde tüketilir ve sahneye taşınmaz (sözleşme değişmeyeceği için
  öyle bırakıldı); alıcıdaki `sequence` geliş damgasıdır. Sonuç aynı yere çıkar
  (kayıp = uzun geliş boşluğu), ama boşluk + sapma ayrımı %100 kesin değildir.
  Canlı ölçümde kayıp 0 çıktığı için 150 ms'lik kayıp payı yalnız sentetik akışta
  ve birim testte doğrulandı.
- **İstenenin ötesinde dört ek:** ızgaraya oturtma (de-jitter), yakalama hız sınırı,
  tampon açlığı geri beslemesi, taşıma payı. İlk ikisi olmadan "0 sıçrama karesi"
  ölçütü tutturulamadı (ölçümle gösterildi); dördü de yalnız alıcıdadır.
- **Tahmin dinlenirken aşabilir:** karşı oyuncu hareketi bırakır ve yeni paket
  göndermezse baş, son iki örneğin hızıyla adımın en çok %44'ü kadar ileride
  DURUR; bir sonraki pakette yumuşakça düzelir. Gerçek `idle stop` akışında son
  paket genelde yavaşlamış bir adım taşıdığı için görünür değil.
- **Hareketsizlikten ilk harekete geçiş** hâlâ tek seferlik bir yakalama üretir:
  canlı ölçümde kayıt başlangıcında 44 karelik durağan pencere + 0,075 rad'lık
  düzeltme görüldü (ilk 2 s hariç tutuldu). Tampon tek örnekken tahmin
  yapılamıyor; ikinci paketle akış normale dönüyor.
- Gecikme tavanı 1200 → 1500 ms: 9–10 kişide (aralık 1215/1500 ms) baş daha da
  geriden gelir ama basamak yerine akıcı olur. `staleAfter/2` sınırı korunuyor.
- Dev tarama periyodu 4320 → 4000 ms (ölçüm yanlılığı, §8).
- Commit/push yapılmadı.
