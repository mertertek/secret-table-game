# 3D tasarım ve nesne üretim planı

Sahip: Claude (2026-09-11'den itibaren; önceki bölümler Codex tarihçesi). Durum: X01/X02 ve X03 v1 üretildi; sentetik tarayıcı kontrolleri tamamlandı (2026-09-09). Uzak çok oyunculu doğrulama ve X04 cila ayrı.

## 1. Hedef görüntü

Akşam aydınlatılmış bir toplantı odasında, fiziksel bir masa oyunu hissi. Ceviz kenarlı koyu yeşil keçe masa, hafif pürüzlü krem kartlar, mat pirinç isimlikler, az miktarda bordo ve petrol mavisi. Dikkat kartlarda, isimlerde ve sıradaki oyuncuda kalır.

Fotogerçekçilik zorunlu değil. Kenar yuvarlatmaları, tutarlı ölçek, iyi gölgeler ve kısa animasyonlarla elle tutulur nesneler hedeflenir. Ortam/harita, karakter/avatar tasarımları, masa, kartlar ve tarafların görsel kimliği Codex’in varsayılan alanıdır. İlk oyuncu temsili stilize karakter/avatar, koltuk ve isimlik olarak planlanır; karakter ayrıntısı kullanıcı yönlendirmesiyle belirlenir. Serbest dolaşım ayrı bir oyun özelliğidir.

HTML ekranlarının görsel dili de Codex tasarımına uyar; bu ekranların veri bağlantısı, davranışı ve uygulamaya entegrasyonu varsayılan olarak Claude’a aittir. Kullanıcı bu işleri de başka bir ajana devredebilir.

Kart grafikleri ve dekorlar özgün üretilecek. Masa ve kart gibi düzenli nesneler kodla gerçek 3D geometri olarak yapılacak; tek bir masa görselinin sahneye yapıştırılması yeterli teslim sayılmaz.

## 2. Tasarım değişkenleri

| Kullanım | Başlangıç değeri |
| --- | --- |
| Arka plan | `#121719` |
| Keçe | `#234B40` |
| Ceviz | `#583B2B` |
| Krem kâğıt | `#EEE1C7` |
| Mürekkep | `#252B2C` |
| Pirinç | `#B49359` |
| Liberal işareti | `#427E9E` + ayrı sembol ve yazı |
| Faşist işareti | `#A94743` + ayrı sembol ve yazı |
| Seçim vurgusu | `#E3BE73` |

Renkler ilk sahne görüntüsünde ayarlanabilir. Oyun bilgisi yalnızca renge dayanmaz. Statik etiketlerde serif hissi, arayüz ve oyuncu isimlerinde okunaklı sans kullanılır; Türkçe karakterler zorunlu. Fontlar yerel paketlenir, kaynağı ve lisansı ASSETS'e yazılır.

## 3. Geometri sözleşmesi

- Sahne birimi: metre. Yukarı ekseni `+Y`, masa yüzeyi `Y=0`, masa merkezi `(0,0,0)`.
- Masaya konan nesnelerin kökü alt merkezindedir. Kartın eni X, boyu Z, kalınlığı Y; açık yüzü `+Y` tarafında.
- Nesne grupları dünya kamera açısına göre modellenmez; yerleşim ayrı katmanda döndürülür.
- Dış varlık gerekiyorsa glTF/GLB, metre ölçeği ve uygulanmış dönüşümler. Model adı ve sürümü varlık listesinde bulunur.
- Etkileşim alanı geometriyle aynı olmak zorunda değildir; küçük nesnelerde görünmez geniş tıklama yüzeyi kullanılır.
- Tüm kapalı kart yüzleri aynı görünür. Rol, kart türü veya kimliği arka yüz, kenar rengi, ölçü veya animasyon süresinden anlaşılmaz.
- Özel kartlar sadece yerel oyuncunun özel alanında bulunur. Başkasının kartının ön yüzünü kamerayla dolaşarak görme ihtimali tasarımla yaratılmaz; veri zaten istemcide yoktur.

### Başlangıç ölçüleri

| Nesne | Yaklaşık ölçü | Not |
| --- | --- | --- |
| Masa | 3,2 × 2,2 m; yüzey 0,08 m kalın | Yuvarlatılmış dikdörtgen veya oval; ilk sahnede seçilir |
| Keçe | 2,95 × 1,95 m | Tahta ve kişisel alanlar sığmalı |
| Kart | 0,12 × 0,17 × 0,002 m | Yakın incelemede kamera/özel alan büyütür |
| Rol zarfı | 0,15 × 0,20 m | Kart ve kapak ayrı hareket edebilir |
| İsimlik | 0,28 × 0,07 m ön yüz | En az 20 karakter için kırpma/HTML tam ad alternatifi |
| Görev işareti | 0,20 × 0,11 m | Başkan ve şansölye yazıyla ayrılır |
| Orta oyun alanı | Yaklaşık 1,20 × 0,70 m | İki politika yolu ve seçim sayacı |
| Deste alanı | 0,18 × 0,23 m | Kapalı kart sayısını görsel olarak sınırlandır |

Ölçüler başlangıç referansıdır; X01'de 10 oyuncu yerleşimiyle birlikte doğrulanır. Taşma varsa masa veya bölgeler birlikte ayarlanır, rastgele nesne ölçekleri kullanılmaz.

## 4. Nesne listesi ve teslimler

| Varlık | Yapı / durumlar | Öncelik |
| --- | --- | --- |
| Table | Ceviz kenar, keçe, basit ayaklar; üst ve yakın görünüm | X01 |
| Chair | Tek tekrar kullanılabilir model; 5–10 yerleşim | X01 |
| Nameplate | Baş üstü tek etiket (D6): isim, makam, bağlantı/eleme durumu, oy çipi ve seçilebilir hedef vurgusu | X01 · D6 |
| PlayerAvatar | Stilize karakter/avatar, nötr oyuncu temsili; gizli role göre ayırt edici görünüm yok | X02 |
| PolicyBoard | Liberal/faşist yollar, sayaca ait alanlar, oyuncu sayısı varyantı | X02 |
| PolicyTile | Kapalı, liberal, faşist, seçili, tahtaya yerleşmiş | X02 |
| BallotCard | Evet/hayır özel seçim; kapalı gönderim; açık sonuç | X02 |
| RoleEnvelope | Kapalı, açılıyor, açık, tekrar kapalı | X02 |
| RoleCard | Yerel rol incelemesi; oyun sonu açık rol sunumu | X02 |
| OfficePlacard | Nameplate'e gömüldü (D6); masa üstü plaka kalktı | X02 · D6 |
| ElectionMarker | Sayaç konumları arasında kısa hareket | X02 |
| Deck/Discard | Kapalı yığın, kart çekme/bırakma bağlantı noktaları | X02 |
| RoomDecor | Sade zemin, duvar ve ışık hissi | X04; masa hazır olduktan sonra |

Her nesne için parametrik React bileşeni veya GLB, durum örnekleri ve ASSETS kaydı teslim edilir. Geometri, malzeme ve animasyon ayrı düzenlenebilir parçalarda tutulur. Paket yalnızca dışa açılan girişler üzerinden kullanılır.

## 5. Yerleşim ve kamera

- Sunucu koltukları sabit `seatIndex` ile verir. Yerel görüntü kendi koltuğunu ekranın altına getirecek şekilde döndürülür; sunucu sırası değiştirilmez.
- 5–10 katılımcı için eşit açılı oval yerleşim başlangıçtır. İsimlik örtüşmeleri ve kenar mesafeleri için kişi sayısına göre küçük ayarlar yapılabilir.
- Oyun başladıktan sonra elenen/bağlantısı kopan oyuncunun koltuğu korunur. Masa ve tahta varyantı başlangıç oyuncu sayısıyla kalır.
- Ana kamera eğimli perspektif, yaklaşık 38–45° görüş açısı. Serbest orbit yok; kontrollü küçük yakınlaşma ve kart inceleme geçişi var.
- Kamera değişimi bir oyun eylemini tetiklemez. Küçük hareketler yereldir ve ağa gönderilmez.
- Aktif oyuncu ışık halesi ve isimlik simgesiyle ayrılır; sürekli yanıp sönme olmaz.
- Masa üzerindeki yazı küçük kaldığında Claude'un HTML kontrol alanı okunabilir açıklama sağlar.
- Küçük ekran yatay görünümünde özel kartlar ve eylemler alt panelde; masa daha yukarıda. Menü açıkken masa yanlışlıkla tıklanmaz.

## 6. Etkileşim ve animasyon

| Olay | Görsel davranış | Başlangıç süresi |
| --- | --- | --- |
| Üzerine gelme / seçim | Kart hafif yükselir, ince vurgu | 100–180 ms |
| Rolünü açma | Yerel zarf açılır, kart öne çıkar | 450–700 ms |
| Kart dağıtımı | Deste → yetkili özel alan | 350–550 ms |
| Oy gönderimi | Sunucu görünümündeki gönderildi işareti; seçim ayrı yükselir | Snapshot anlık; ayrı gönderim cue yok |
| Oyları açıklama | Sunucunun sonuç olayında kartlar birlikte döner | 350–500 ms |
| Yasa yerleştirme | Kart orta tahtadaki doğru yuvaya taşınır | 450–650 ms |
| Sıra / görev değişimi | İşaret yeni koltuğa kayar | 300–500 ms |
| Eleme | Koltuk vurgusu söner, isimliğe durum simgesi gelir | 250–400 ms |
| Oyun sonu | Sakin masa halkası ve açıklanmış rol kartlarının dönüşü | En fazla 900 ms |

Süreler deneyim hedefidir, ağ zamanlayıcısı değildir. Sunucu görsel efektin bitmesini beklemez. Geciken animasyon iptal edilir veya hızla son duruma alınır; güncel görünüm her zaman üstündür. Yeniden bağlanmada eski olaylar tekrar oynatılmaz.

Azaltılmış hareket seçeneğinde kart yerleştirme kısa solma/konum değişimine iner, kamera uçuşu kaldırılır. Ses ilk kullanıcı etkileşiminden sonra etkinleşir; sessize alma kalıcı yerel tercihtir. Ses oyun bilgisinin tek taşıyıcısı olmaz.

## 7. Bağımsız tasarım geliştirmesi

Claude `/dev/scene` sayfasını ve tip güvenli sentetik verileri sağlar. Codex şu durumları bağlantı kurmadan inceleyebilir:

- 5, 6, 7, 8, 9 ve 10 kişilik lobi/masa.
- Sırası gelen oyuncu ve aday seçimi.
- Kısmen oy verilmiş masa ve oy sonucu.
- Yerel özel elde kartlar; diğer oyuncularda yalnızca kapalı nesneler.
- Dolu politika tahtası, yetki seçimi, veto görünümü.
- Elenen, çevrimdışı ve uzun isimli oyuncular.
- Geri dönüşten sonraki sabit durum; iki farklı oyun sonu.

Sayfadaki örnek seçici, ekran ölçüsü ve olay tetikleme kontrolleri Claude'a; sahne içindeki nesne örnekleri Codex'e ait. Codex yeni örnek gerekiyorsa Claude'a mesaj bırakır.

## 8. Performans bütçesi

Bunlar ölçüm öncesi hedeflerdir; garanti edilmiş sonuçlar değildir.

- Masaüstünde 1080p, DPR en fazla 1,5: 60 FPS hedefi.
- Entegre GPU / düşük kalite: 30 FPS hedefi; gerçek cihaz ve tarayıcı bilgisi rapora yazılır.
- Görünür sahne için başlangıç bütçesi 150 bin üçgen ve yaklaşık 120 çizim çağrısı.
- İlk grafik/font/ses varlıkları sıkıştırılmış toplamı hedef en fazla 8 MB; ilk açılışta gerekmeyen varlıklar ertelenir.
- Tek ana gölge kaynağı; yüksek maliyetli ekran efektleri ilk sürümde kapalı.
- Geometri ve malzeme paylaşımı; tekrar eden nesnelerde ölçüm gerektiğini gösterirse instancing.
- Düşük kalitede DPR 1, gölge çözünürlüğü azaltılmış veya gölgeler kapalı; ek dekorlar devre dışı.
- Sahne durgunsa sürekli gereksiz render yapma; animasyon ve kontroller sırasında gerekli kareleri üret.
- Bellek sızıntısı, oda değişimi ve nesne temizliği tarayıcıda kontrol edilir.

## 9. Görsel kabul

Her ana teslim için 6 ve 10 kişilik masa genel görünümü, yerel kart yakın planı ve küçük ekran görünümü alınır. 5/7/8/9 kişi yerleşimleri de çalıştırılarak kontrol edilir. Görüntüler `docs/qa/codex/` altında görev kimliğiyle saklanır; yol ve ölçüm özeti ajan devrine eklenir.

Kabul: okunabilir kartlar ve isimler; kesilmeyen metin; kart/tahta örtüşmesi olmaması; seçili nesnenin anlaşılması; kapalı nesnelerden gizli bilgi çıkarılamaması; oynanışı bekleten animasyon olmaması. Kullanıcı ilk X01 görünümüne yön verdiğinde tasarım değişkenleri burada güncellenir.

## 10. X01/X02 uygulama kararları — 2026-09-09

- 10 kişide fiziksel aralıkları korumak için masa 4,70 × 3,30 m oval, keçe 4,24 × 2,84 m seçildi. Yüzey Y=0; koltuk merkezleri X=2,64 / Z=2,00 yarıçaplarında. İlk ölçü tablosu başlangıç referansı, güncel kesin ölçüler ASSETS içindedir.
- Ceviz damarı ve keçe lifleri deterministik Canvas dokusu; yerel Noto Sans/Serif. 3D avatarlar nötr ceket/saç varyasyonları kullanır; hiçbir gizli alan görünümlerini etkilemez.
- Kartlar gerçek ince ve yuvarlatılmış geometri; özgün yaprak ve hisar işaretleri yazılarla desteklenir. 5–10 arka zarf ve isimlik yerleşimleri çarpışma kontrolünden geçirildi.
- Küçük ekranda isimlik kompakt tek satıra iner (D6; HTML ad etiketi kaldırıldı); ana ve özel alan için iki sabit kamera. Özel alan düğmeleri yalnız yerel incelemedir, oyun eylemi değildir.
- X01/X02 temelinde son görünüm hemen çizilir; X03 olay süslemeleri aşağıdaki ek kurallarla uygulanır.
- Görsel kanıtlar ve testlerin sınırı: [X01/X02 QA](qa/codex/X01-X02.md). Standart çizim bütçesi/FPS ve canlı HTML erişilebilirlik paneli X04/C04/C05 devrinde takip edilecek.

## 10. X03 uygulama kararları

- Mevcut 7 `SceneCue` türü desteklenir. Son görünümün revision'ı ile aynı ve içerikle tutarlı olaylar alınır; eski/gelecek/başka oyun olayları bekletilmez. Aynı cueId oyun boyunca ikinci kez oynatılmaz. 4096 kimlik sınırından sonra yeni süslemeler atlanır; görünüm çalışmayı sürdürür.
- Eşzamanlı olaylar giriş sırasıyla başlar, oyun aşamaları yapay olarak sıraya sokulmaz. Oy sonucu motor tarafından yasama aşamasına geçilmişken de, eşleşen `lastElection` üzerinden gösterilebilir. Yerel oyuncunun sonuç oyu özel el ile çakışmasın diye sol özel alanda ayrılır.
- Hareket süreleri: dağıtım 520, aktarım 460, oy açma 480, politika 620, görev 420, elenme 350, sonuç 850 ms. Rol çıkarma 550 ms; isteğe bağlı yakın plan kamera geçişi 500 ms. Oyun olayları kamerayı kendiliğinden taşımaz.
- Reduced motion konumu/dönüşü doğrudan son duruma alır; olay ömrü 100 ms. Ses tercihi ayrı kalır. Kesinti, paused, gizli sekme, boş cues ve yeni revision hareketi iptal eder. Kapalı kartın yüzü/ölçüsü/hareketi içeriğe göre değişmez.
- Kart kimliği veya eski el yüzü animasyondan geri yüklenmez. Dağıtımda çizim ve seçim yalnız güncel `privateView.hand` üzerinden; olay kart ID'leri komutlara geçirilmez.
- 5 özgün kısa ses yerel Web Audio ile üretilir. Güvenilir ilk pointer/klavye/tıklama AudioContext'i sessizce açar; `soundEnabled=false` hiçbir ses çalmaz. Kilitliyken kaçan ses ertelenmez. Bir eşzamanlı olay grubunda tek foley çalar; mute/kesinti/gizlenme anında kaynaklar durur. Ses tınısı gizli rol/oy/politika değerini kodlamaz.
- Oy gönderildi işareti ve seçim sayacı için mevcut sözleşmede ayrı olay yok; bunlar güncel snapshot'ı anında gösterir. Ek olay veya oyun kararı sahnede üretilmedi.
- QA deneme ekranı `packages/scene/src/dev/` ve `docs/qa/codex/x03.html` altında; üretim paket girişinden erişilmez. Sayısal `data-scene-*` alanlarında özel bilgi tutulmaz.


## 12. Bağımsız birinci şahıs prototip kararları — F02/F03-P

Kullanıcı 2026-09-09'da önceki bekleme kararını yalnız bağımsız görsel prototip için değiştirdi. FIRST_PERSON_PLAN içindeki F00 koşulu canlı entegrasyon için sürer. Aşağıdaki kaynaklar ayrı `scene/src/prototype/` girişindedir; mevcut TableScene, 0.2.0 sözleşmesi ve uygulama davranışı korunur.

- Kendi koltuğundaki göz `(0, 0.60, 2.035)`; yerleşim mevcut `layoutSeats` ile yerel oyuncuya döndürülür. Kamera pozisyonu sürüklemeyle değişmez. Yatay ±58°, dikey aşağı 48° / yukarı 12° sınırı; ilk bakış yaklaşık 15° aşağı. Sallanma, pointer lock veya serbest dolaşım yok.
- Üç isteğe bağlı görünüm: masa geneli, koltuk, özel alanı yakın inceleme. Geçiş 620 ms; hareket azaltmada anlık. Yakın inceleme önceki koltuk bakışını korur. Dar ekranda yatay görüş alanı korunacak şekilde perspektif genişler. Yatay telefonda sahne ekranda sabit kalır, kontrol paneli kendi içinde kayar.
- Fare/dokunma aynı Pointer Events yolunu kullanır. 6 px eşiğini geçen sürükleme kart tıklamasını bastırır; pointer capture kayıp/iptal temizliği vardır. HTML düğmeleri kamera girdisine dönüşmez. Ok tuşları ve Home için odaklanabilir sahne bölgesi vardır. Gerçek dokunmatik cihaz kontrolü henüz yok.
- Stilize avuç, eklemli parmak/başparmak, bilek, manşet ve önkol; küçük bir kol devamı aşağı/yan bakışta kesik uç görünmesini önler. Tam vücut ve fizik motoru yoktur. Kart tutuşu, seçilen kartı yükseltme ve bırakma sırasında sağ bileğin karta eşlik etmesi ayrı pozlarla üretilir.
- Kart çekme için masanın yakınında sentetik kart verme alanı bulunur. Çekme 1450, seçme 440, vazgeçme 420, bırakma 1350, oy çevirme 1150, zarf 1650 ms. Bunlar görsel deneme süreleridir; mevcut X03 sürelerini ve uygulamadaki 950 ms drain'i değiştirmez.
- Son pozlar güncel yetkili `privateView` alanlarını kullanır. Genel görünümde ve koltuğa kamera uçuşu sırasında özel yüzler arka baskıya dönüşür. Diğer oyuncuların kartları daima aynı kapalı geometri. Oy çevirme yalnız açık `lastElection` verisini kullanır; gizli `submittedVote` kullanılmaz. Kaldırılan özel el/rol yüzü saklanmaz.
- Sentetik baş örnekleri her 1100 ms'de yerel üretilir; açı sınırı, sıralama ve 1800 ms ömür kontrolünden geçer. Alıcı başı yumuşatır; örnek kesilince nötre döner. Gerçek kimlik/oturum doğrulaması, arka plan/özel inceleme paylaşım politikası ve ağ gönderim bütçesi burada uygulanmış sayılmaz.
- Örnek sayfasındaki seçim/ret/kabul yerel gösterimdir. Canlı hamle, SceneIntent, Supabase veya API çağrısı yoktur. Yerel hareket tuşları koreografi çakışmasını önlemek için kısa süre kapanır; bu davranış canlı oyunda animasyonun sunucu hamlesini bekletmesi için örnek alınmamalıdır.

Görseller, kontroller ve bilinen sınırlar: [F02/F03-P QA](qa/codex/F02-F03.md). Claude için F01 girdileri CODEX-011 devrinde. Önizleme açmak uygulamada yeni rota veya paket kurulumu gerektirmez.
