# FINAL-SCENE — üretim sahnesi teslimi

2026-09-09 · Codex · FINISH_PLAN §2A/3 ve COORD-003/004.

Sahne üretim paketine bağlandı. Varsayılan genel masa korunuyor; koltuk kamerası, eller, kartlar, zarf, kamu el hareketleri ve doğrulanmış baş örneklerinin sunumu artık **`@secret-table/scene` / `TableScene`** üzerinden kullanılabilir. Bu, gerçek arkadaş grubu kabulü veya tüm uygulama kontrollerinin tamamlandığı anlamına gelmez. **CODEX-017 uygulama düzeltmeleri ve gerçek Pointer Lock testi açık.** Bu oturum Vercel açmadı.

## Önizleme

- **Üretim girişi kullanan mevcut rota:** [7 kişilik masa](http://127.0.0.1:5174/dev/scene?fixture=president-discard). “Kendi koltuğum” ile geçilir. Bu rota yeni QA HTML dosyasına bağlı değildir.
- [Ayrıntılı son sahne kontrolleri](http://127.0.0.1:5174/@fs<proje-klasörü>/docs/qa/codex/final-scene/index.html): 5–10 koltuk, 1/2/3 kart, controller, reset, kesinti, reduced motion ve sentetik başlar. Bu yalnız test kabuğudur; kamu paket girişini kullanır, ağ/hamle göndermez.
- Sunucu: mevcut yerel Vite 5174. Claude’un 5173 oturumu değiştirilmedi. Preview kapalıysa normal proje dev sunucusu başlatılır; üretim import yolunda `docs`, `dev`, `@fs` veya fixtures yoktur.

## Kullanıcı kart geri bildirimi

Yelpaze, ortak alt kavrama çevresinde **0,80 rad** yan açı, yatay pay ve derinlik birlikte değiştirilerek açıldı. Üst ve açık kenardaki tür yazıları seçmeden görülebiliyor. Alt kenarlar ortak tutuşta örtüşür; kartları ayrı havada konumlandırmak için elden uzaklaştırmadık. 1/2/3 baskıları render edilen opak kart ID sırasıyla eşleşir; `actions.options` sırasına dayanmaz.

Seçilen kart düzleşir ve tam okunur hâle gelir. Sağ el önce karta ulaşır, ardından kartı kavrama noktasından kaldırır; vazgeçmede kart yerine indirilmeden el çekilmez. Başka kart seçilince önceki kart geri iner. Kalan paketi sol el taşır. Yeni seçim yakın inceleme odağını taşır; sonra oklarla gezinmek seçimi değiştirmez.

Kalan kartlar opak ID ile son çizilmiş konumdan **240 ms** içinde kapanır. 3→2→1 sırasında kalan elin başlangıç dönüşümü korunur; kaldırılan kartın eski yüzü saklanmaz. Reduced motion doğrudan son düzeni çizer.

### Aynı referans açı / seçimsiz tutuş

1440×1000 viewport, 1150×751 Canvas, 7 koltuk, göz `[0,.56,1.92]`, FOV49, standard, DPR1. İlk ve son görüntü aynı eski örnek kabuğunda alındı; üretimde de aynı fan/rig kullanılıyor. Eski kabuğun “bağımsız prototip” başlığı tarihsel; üretim entegrasyonunun durumu yukarıdadır.

Önce:

![Referans önce](final-scene/fan-before-reference.jpg)

Sonra:

![Referans sonra](final-scene/fan-final-reference.jpg)

| Küçük ekran | Önce | Sonra |
| --- | --- | --- |
| 390×844 portre | [Görüntü](final-scene/fan-before-390.jpg) | [Görüntü](final-scene/fan-final-390.jpg) |
| 844×390 yatay | [Görüntü](final-scene/fan-before-844.jpg) | [Görüntü](final-scene/fan-final-844.jpg) |

Yatay eski prototip kabuğu sahneyi daralttığından küçük yazı için üretim yakın incelemesi kullanılmalı. Gerçek GameScreen kapsayıcısı ve tahta yakın görünümü ayrıca aşağıda kontrol edildi; tüm yazıları genel masaya sıkıştırma hedefi yoktur.

- [Sol 1](final-scene/selected-1.jpg), [orta 2](final-scene/selected-2.jpg), [sağ 3](final-scene/selected-3.jpg): üç seçili kartın tamamı kadrajda; [opak ID eşlemesi](final-scene/slot-mapping.json).
- Son kavrama düzeltmesi: [seçme ara](final-scene/select-contact-mid.jpg), [seçme son](final-scene/select-contact-end.jpg), [kamu bırakma ara](final-scene/place-final-mid.jpg). Kart kaldırılırken el-kart kavrama dönüşümü sayısal testte de eşleşir.
- 3→2→1: [iki kart ara](final-scene/hand-2-mid.jpg), [iki kart son](final-scene/hand-2-end.jpg), [bir kart ara](final-scene/hand-1-mid.jpg), [bir kart son](final-scene/hand-1-end.jpg). Ara görüntüler kontrollü UI değişikliğini takip eder; kesin başlangıç sürekliliği birim testleriyle doğrulandı.
- [390 px yeni seçilen kart 2](final-scene/selected-2-final-390.jpg), [tek kart / reduced motion](final-scene/one-reduced-390.jpg).

## Üretim sunumu ve yaşam döngüsü

| Hareket | Süre | Son durum / sınır |
| --- | ---: | --- |
| Yetkili el çekme | 1450 ms | Güncel el tutuşta; yeniden bağlanmada eski dağıtım oynatılmaz |
| Seçme | 440 ms | Önce kavrama, sonra seçili kart yükselir; sunucu hamlesi yok |
| Vazgeçme | 420 ms | Kart pakete iner; onay/bırakma üretilmez |
| Kabul edilmiş kapalı bırakma | 1350 ms | Kanonik dış kenar yolu; önceki özel seçim/tür aktarılmaz |
| Açıklanmış oy | 1150 ms | Yalnız güncel kamu lastElection yüzü; yerel oy görseli iki kez çizilmez |
| Zarf açma | 1650 ms | Güncel yetkili rol; kapanışta yüz hemen temizlenir |
| Kamera modu | 620 ms | Kendi koltuğuna bağlı; uçuşta özel yüzler kapalı |
| Kalan fanın kapanışı | 240 ms | Opak ID başına sayısal süreklilik |

- **Normal `cues=[]` iptal değildir.** Kabul edilmiş kamu cue ve uzun yerel hareket kendi süresini tamamlar. 950 ms app drain süresini uzatma veya ortak süre haritası ekleme gerekmedi.
- `resetEpoch` değişimi, room/game/local identity değişimi, kesinti/hidden/suspended, yeni geçerli görünüm nesli veya özel bilginin geçersizleşmesi eski sunumu temizler. Resync aynı revision’da da keser; eski timer yeni hareketi silemez. Güncel görünüm daima önceliklidir.
- Kamera modu değişimi hareketi yeniden başlatmaz; görünmeyen modda eski özel yüz gösterilmez, dönüşte cue yeniden oynatılmaz. Genel masa eski düz özel alan sunumunu korur; el rig’i yalnız koltukta görünür. Genel masa için “bütün kendi kartları mutlaka kapalı” iddiası yoktur; eski yetkili özel alan davranışı korunmuştur.
- Reduced motion yerel poz/kamera/fanı son konuma taşır; baş yumuşatma atlanır. Uygulama oyun işlemini hiçbir animasyon tamamlanma bildirimi için beklemez; sahnede böyle bir callback veya sunucu çağrısı yoktur.
- Kanıt: [zarf/normal drain ve reset](final-scene/local-lifetime.json), [kapalı bırakma drain](final-scene/place-lifetime.json), [özel veri/suspension/unmount](final-scene/privacy-reduced-unmount.json), [zarf son](final-scene/envelope-end.jpg), [oy ara](final-scene/vote-mid.jpg), [oy son](final-scene/vote-end.jpg). 950/1650 sınırları kontrollü saatle testte; tarayıcı fotoğrafları kare zamanı ölçümü değildir.

## Girdi, hedef ve mahremiyet

- `immersive.cameraMode` ve `pointerLocked` bağımsızdır; `active` yalnız eski çağıranlar için fallback. Hassasiyet .2–3 aralığında; göreli deltalarda finite kontrol ve yatay ±1,4 rad sınırı. Kamera koltuktan ayrılmaz.
- Tek global klavye/Fullscreen/Pointer Lock yöneticisi uygulamadadır. Sahne controller kaydını mount/unmount bildirir; `lookBy`, `inspectBy`, `selectSlot`, `target`, `resetLook` sunar. Sahne içinde ikinci global tuş/komut dinleyicisi yoktur.
- 6 px üzeri yerel Canvas drag sonrası tıklama bastırılır. Kilitli Canvas tıklaması scene `select_option` göndermez; uygulama `target()` üzerinden seçer. `selectSlot()` ve `target()` yalnız `SceneSelection|null` döndürür, komut göndermez.
- Frustum dışında/izinsiz kartlar `slots` içinde null kalır; numaralar sıkıştırılmaz. Seçim güncel izin/phase’e karşı doğrulanır. Uzak el hareketi yalnız kamu olayından, başlar yalnız app tarafından doğrulanmış örnekten gelir. Özel inceleme bakışı `onLocalViewpoint` üzerinden gönderilmez.
- [Drag ve görünmeyen yuva](final-scene/drag-and-hidden-slot.json): bakış değişti, seçim/niyet artmadı; uzağa bakınca üç yuva null. [İnceleme oku](final-scene/inspect-inputs.json): odak değişti, seçim ve bakış yayını değişmedi.
- **Gerçek Pointer Lock isteği bu in-app browser’da reddedildi.** `pointerlockerror` alındı, `document.pointerLockElement` null kaldı. Chrome otomasyon yüzeyi mevcut değildi. [Gerçek giriş denemesi kaydı](final-scene/pointer-lock-iab.json). Gerçek kilitli fare/E/Fullscreen tam oyun testi tamamlandı denmiyor.
- Ayrı, açıkça “sentetik” etiketli `pointerLocked` prop testiyle göreli look, reticle, kartın amber hedef vurgusu ve `target()` opak ID eşleşmesi kontrol edildi: [görsel](final-scene/target-simulated.jpg), [önce/sonra veri](final-scene/target-simulated.json). Bu gerçek tarayıcı kilidi kanıtı değildir. Ayrıca [6 kişilik oyuncu hedefi](final-scene/player-target-simulated.jpg) `act_nominate/nom_p4` ile eşleşti; hassasiyet .5→2 aynı deltanın yatay sonucunu -.216→-.864 rad yaptı ve seçim değişmedi: [kayıt](final-scene/player-target-sensitivity.json).

## Koltuk ve küçük ekran matrisi

| Kontrol | Sonuç / kanıt |
| --- | --- |
| Genel masa 5,6,7,8,9,10 — 390×844 | Altı kadraj görsel olarak incelendi. [5](final-scene/overview-5-390.jpg), [6](final-scene/overview-6-390.jpg), [7](final-scene/overview-7-390.jpg), [8](final-scene/overview-8-390.jpg), [9](final-scene/overview-9-390.jpg), [10](final-scene/overview-10-390.jpg) |
| Koltuk 5,6,7,8,9,10 — 390×844 | Yakın el kadraja sığıyor; kendi avatar/isimliği önünü kapatmıyor. [5](final-scene/seat-5-final-390.jpg), [6](final-scene/seat-6-final-390.jpg), [7](final-scene/seat-7-final-390.jpg), [8](final-scene/seat-8-final-390.jpg), [9](final-scene/seat-9-final-390.jpg), [10](final-scene/seat-10-final-390.jpg) |
| 10 kişi özel yakın plan | [Tam okunur kart](final-scene/private-10-390.jpg); genel masadaki küçük yazı için bu katman var |
| 844×390 tahta yakın plan | [Tahta ve ayrı sayaç hiyerarşisi](final-scene/board-844.jpg) |
| Gerçek GameScreen HTML / 844×390 | Canvas **457,64×335 px**, yatay taşma yok. [Ölçüm](final-scene/app-844.json), [görsel](final-scene/app-844.jpg). Üstteki QA şeridi 74 px ekler; canlı oyun kabulü değildir |
| HTML Göster → scene Kimliği kapat; scene aç → HTML Gizle | İki yönde panel kapalı kaldı; eski açma niyeti geri üretilmedi. [Çapraz kontrol](final-scene/app-role-crosscontrol.json) |
| Baş yumuşatma / 10 kişi | Sentetik doğrulanmış tip, sınırlar ve nötre dönüş; [görsel](final-scene/heads-final-1500ms.jpg), [veri](final-scene/heads-final-1500ms.json), [nötr kayıt](final-scene/heads-neutral.json). Son QA örnek aralığı 10 kişide1500, 7 kişide735 ms |

Başların gerçek ağ kimliği ve yük testi bu sahne raporuna ait değildir. NETWORK-001’in güncel `HeadViewpoint.t` alanı **alıcı yerel epoch alım zamanıdır**; adapter bunu monotonic render saatine bir kez çevirir. Tekrar props TTL’yi yenilemez. 4 saniye bayatlık/kesinti sonrası nötr ve taze örnek bekleme vardır; ağın epoch/seq doğrulaması tekrar uygulanmaz.

Fiziksel telefon/dokunma, Safari, gerçek kilitli fare, klavye ile tam oyun ve gerçek arkadaş grubu testi yapılmadı. Canvas Pointer Events yolu hazır; masaüstü pencere boyutlandırmasını fiziksel mobil başarı diye sunmuyoruz.

## X04 performans cilası / ölçüm

Yerel aynı Mac, Codex in-app browser / Three r186, 7 kişilik **üretim `/dev/scene?fixture=president-discard`**, viewport1440×1000, Canvas1120×1000, DPR1, 3 kart tutuş, seçim yok, başlar nötr, reduced motion kapalı. Göz `[0,.600,2.035]`, FOV64. Aşağıdaki her satır kendi önceki aynı grafik ayarıyla karşılaştırıldı.

| Ayar | Önce draw / üçgen | Son draw / üçgen | Geometri / doku önce→son |
| --- | ---: | ---: | --- |
| Standard | 280 / 79.554 | **199 / 76.986** | **192→144 / 44→42** |
| Low | 146 / 31.758 | **102 / 30.298** | Renderer kayıtları aşağıda |

- [Standard önce veri](final-scene/production-before-standard.json), [son veri](final-scene/production-final-standard.json); [önce görsel](final-scene/production-before-standard.jpg), [son görsel](final-scene/production-final-standard.jpg).
- [Low önce veri](final-scene/production-before-low.json), [son veri](final-scene/production-final-low.json), [son görsel](final-scene/production-final-low.jpg).
- Parmak/avuç/kol parçaları el başına üç instanced çizimde; uzak kollar birleştirilmiş geometri. Kart baskıları yalnız tür/slot değişince üretilir. Kendi isimliği koltukta çizilmez; uzak isimlik açısı koltuk kamerasında okunabilir tutulur. Gereksiz çift yerel oy kartı kaldırıldı.
- Son sürüm 36,742 sn boşta **79→79 çizilmiş kare**: [kayıt](final-scene/production-idle-final.json). Talep üzerine çizim duruyor. Bu bir FPS ölçümü değildir.
- 10 kişi son QA kabuğu (Canvas1165×1000): standard **244 draw /100.222 üçgen**, low **119 draw /38.772 üçgen**. [Kayıt](final-scene/ten-player-budget.json). Kabuğu/kamerasını değiştiren bu sayılar 7 kişilik önce/sonra yüzdesine katılmadı.
- Ölçülen üçgen sayıları başlangıç 150 bin bütçesinin **altında**. Yaklaşık120 draw hedefi standard kalitede **henüz karşılanmıyor**; low 7/10 ölçümleri120 altında. FPS, GPU kare zamanı ve GPU byte bellek ölçülmedi; geometri/doku adetleri RAM/VRAM baytı değildir. 60/30 FPS kabulü iddia edilmiyor.
- Build JS 1.561,00 kB / gzip 440,93 kB; yerel fontlar toplam3.936.288 bayt. Vite büyük chunk uyarısı sürüyor. Uygulama tarafı yükleme/code-splitting kararı devirdedir; ortak manifest veya bağımlılık değiştirilmedi.

## Testler ve Claude / entegrasyon sahibi devri

**269 test geçti:** contracts11, fixtures28, game-core65, scene79, server33, web53. **Typecheck6/6 ve build geçti.** [Test logu](final-scene/tests.log), [typecheck](final-scene/typecheck.log), [build](final-scene/build.log). Sayısal testlerde opak sıralama/null yuva, 3→2→1 başlangıcı, seçme/kavrama, yeni nesil/1650ms/950ms/reset, gizlilik ve baş TTL var. Three.Clock deprecation uyarısı bağımlılık kaynaklı kalıyor; [tarayıcı logu](final-scene/console-final.json).

CODEX-016 kesin ortak tipler ACK; değiştirilmedi. **CODEX-017 henüz yanıtlanmadı** ve şu app işleri tamamlanmadan tüm entegrasyona kabul verilmez:

1. Controller mevcutsa `selectSlot()` null sonucundan eski option’a fallback yapılmamalı. HUD/1–3/onay aynı opak `SceneTargets.slots` sırasından çözülmeli.
2. Kilitli E/sol tık `controller.target()` kullanmalı; null’da paneldeki ilk/odaklı seçeneği seçmemeli. Scene kilitli tıklamayı göndermez. İlk giriş grace ve Enter onayı tek uygulama yöneticisinde kalmalı.
3. Scene `set_camera` niyeti GameScreen’de `setCameraMode` ile tüketilmeli. **Gerçek HTML harness’te hata tekrarlandı:** [niyet var, kamera overview kalıyor](final-scene/app-camera-handoff.json). V kısayolu ayrı handler kullanıyor; yollar birleştirilmeli.
4. Menü açıkken suspended, hassasiyet ayarı ve odaklanırken koltuk seçme davranışı app’te tamamlanmalı. Fullscreen ve Pointer Lock ayrı yaşam döngüsüyle gerçek tarayıcıda denenmeli.
5. `cards_moved` motor/projeksiyon tarafından hâlâ üretilmiyorsa yetkili kabul olayından sağlanmalı. Sahne kendi kart çekme/oyun komutunu uydurmaz; görsel süre oyun onayını bekletmez. Kanonik kamu hareketi eski özel seçimi kullanmaz.
6. Ağ tarafı NETWORK-INTEGRATION devirleri, 7/10 yük profili, gerçek kullanıcı/cihaz ve yayın kabulü entegrasyon sahibinde. Bu oturum uygulama/API/Supabase dosyalarını değiştirmedi ve dağıtım yapmadı.

Raporda bağlantısı verilen dosyalar teslim kanıtlarıdır; aynı klasördeki bağlantı verilmemiş bazı görüntüler/ölçümler çalışma arası kayıtlardır. Başka yanıt beklemek için sürekli dosya kontrolü yapılmadı. Güncel kısa durum ve açık devir: [CODEX.md](../../agents/CODEX.md).
