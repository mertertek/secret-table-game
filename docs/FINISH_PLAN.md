# Son geliştirme ve yayın öncesi kabul

Tarih: 2026-09-09. Kullanıcı ataması: Claude/Codex QA düzeltmelerini tamamlasın; tam ekran + fareyle doğrudan bakış dahil kamera, eller ve diğer oyuncuların hareketleri canlı oyuna bağlansın; ardından sorun kalmadıysa Vercel aşamasına geçilsin.

Bu belge önceki FIRST_PERSON_PLAN ve COORD-002 bekleme sırasının güncellemesidir. Uygulama değişiklikleri bu plan oturumunda yapılmadı. Güncel durum için ajan dosyaları ve kaynaklar doğrulanır; yalnız MD'de tamam yazması yeterli değildir.

## 1. Başlangıç sırası ve kabul ayrımı

- Claude QA-R01/R03/R04/R07 ve uygulama tarafı R02; Codex sahne tarafı R02, R05/R06 düzeltmelerini bitirir. R02 rol gizleme çapraz akışta doğrulanır. Son kullanıcı devrine göre R01 için 0006 uzak migration/rematch kontrolü final test turuna ertelidir; yerel düzeltme doğrulandıktan sonra geliştirme devam edebilir, uzak R01 kapanmış veya yayına hazır sayılmaz.
- Uzak 6/7 kişilik tam bot oyunları ve gerçek tarayıcı + botlarla tam oyunlar raporlandı. QA-REVIEW canlı liberal politika zaferini de doğruladı; bu başlık eski J01 listesinde hâlâ açık görünüyorsa kaynak kanıtla güncellenir.
- Kullanıcının son bitirme atamasıyla, kritik QA düzeltmeleri doğrulandıktan sonra F01/F04 canlı entegrasyonuna ilerlenir. Gerçek arkadaş grubunun henüz toplanmamış olması bağımsız geliştirmeyi bekletmez. **F00 gerçek çok-insanlı kabulü yapılmış sayılmaz**; nihai kullanıcı kabul listesinde açık tutulur.
- Kod atamaları varsayılan sınırlarında: sahne/görsel Codex; app, contracts, bağlantı ve sunucu Claude. Bu plan yeni alt ajan açmaz, hâlen çalışan görevlerin kodunu başka oturumdan düzenlemez.
- Son kullanıcı talimatıyla Vercel test yayını artık bu görevin devamına dahildir: entegrasyon ve yerel zorunlu kontroller tamamlanınca Claude ücretsiz Hobby kapsamında test adresine deploy eder; deploy için tekrar genel izin beklemez. Giriş/hesap seçimi gerekiyorsa kullanıcıdan yalnız gerekli adımı ister. Gerçek cihaz ve arkadaş grubu kabulü yayın adresinde yapılır; bunlar deploy ön koşulu değildir. Ücretli hizmet açılmaz, DB topluca temizlenmez.

## 2. Tam ekran ve doğrudan fare kontrolü

Hedef masaüstünde “Oyuna odaklan” düğmesiyle koltuk kamerasında bakarak oynama. Kamera koltuktan ayrılmaz; yürüme/WASD/serbest dolaşım kapsam dışıdır.

- Claude tam oyun kapsayıcısında Fullscreen ve Pointer Lock yaşam döngüsünü yönetir; HTML kart/rol/onay/menü katmanları da tam ekranın içinde kalır. Sadece Canvas'ı tam ekran yapıp kontrolleri dışarıda bırakmaz.
- Codex kilitli fare hareketini göreli delta ile sınırlı yaw/pitch kameraya bağlar; ortada küçük hedef işareti, geçerli etkileşim vurgusu ve hassasiyet desteği sağlar. Fare ekran kenarında durmaz; basılı tutarak sürüklemek gerekmez.
- Pointer Lock/tam ekran durumları ayrı izlenir. Başlatma yalnız kullanıcı tıklamasıyla; başarı, ret ve özellik yokluğu gerçek tarayıcı olaylarıyla doğrulanır. Tek düğmeden birlikte istek tarayıcıda kabul edilmezse açık bir “Bakışı etkinleştir” devam kontrolü sunulur; sessizce aktif görünmez.
- Genel masa / koltuk görünümü, tam ekran ve kilitli bakış seçenekleri birbirini zorunlu kılmaz. Tam ekran olup serbest imleç kullanılabilir. Desteklenmeyen cihazda mevcut sürükle/klavye/touch kontrolleri çalışır.
- Hedef işareti yalnız mevcut yetkili eylem/seçenek kimliklerini seçebilir. Tıklama/E sadece seçimdir; hamle ayrı onaydan geçer. Onay katmanı DOM içinde erişilebilir kalır ve klavyeyle de işletilir; düğmeye tıklamak zorunlu değildir. Menü/özel inceleme açılınca kilit bırakılıp kamera bakışı durabilir; bu panellerin tamamı klavyeyle yönetilebilir ve bakışa dönüş açık kullanıcı etkileşimi ister. Basit hedef/seçim/onay HUD akışı bakış kilidini zorunlu bırakmadan da çalışabilir. İlk kilitleme tıklaması hamle seçmez/göndermez.
- Esc, pointerlockchange/error, fullscreenchange/error, odak kaybı, gerçek hidden sekme, kesinti, rota değişimi ve unmount güvenli çıkışla ele alınır. Tarayıcının Esc davranışı bastırılmaz. Kendiliğinden yeniden kilitleme veya tam ekrana geri zorlama yoktur; devam açık kullanıcı etkileşimi ister.
- Tercihler cihazda saklanabilir; gerçek kilit/tam ekran aktifliği saklanan bir bayraktan varsayılmaz. Yenilemede normal güvenli giriş olur. Azaltılmış hareket kamera sallantısı olmadan çalışır.
- Özel incelemedeki kamera hareketi baş yönü ağına aktarılmaz. Klavye ve HTML kontrolleri kullanılabilir kalır; telefon için küçük dokunma hedefleri yerine mevcut erişilebilir seçimler korunur.

## 2A. Son kullanıcı geri bildirimi — açık yelpaze ve klavyeyle tam oyun

Kullanıcı görseli: [mevcut üç kart tutuşu](references/card-fan-user-feedback.png). R06 el desteği düzeltmesi korunur; bu ek istek kartların birbirini fazla kapatmasını giderir. Son QA-FIXES raporunda 208 test, tip kontrolü ve build geçmiştir; eski ara TypeScript hatası kapanmıştır. Bu, aşağıdaki yeni özelliklerin test edildiği anlamına gelmez.

### Kart yelpazesi — Codex

- Üç kartın en arkadaki yüzü görselde fazla kapanıyor. Kartları ortak alt kavrama çevresinde daha geniş aç; gerekirse yatay aralık, açı ve derinliği kamera uzayındaki görünür alana göre birlikte ayarla. Sadece bütün eli büyütmek veya ön kartı kaldırmak yeterli değildir.
- Elde 1/2/3 kart durumlarını destekle; üçünde de kartın politika türü oyuncu tarafından ayırt edilsin. Seçili kart bütünüyle okunabilen öne/yukarı poza gelir. Kart değiştirme ekranından önce de her kartın türü görünür olmalı; renk tek belirteç olmasın.
- 1/2/3 göstergeleri ekrandaki soldan sağa görünür sırayla eşleşsin. İnceleme odağı, yerel seçim ve sunucuya gönderim ayrı kavramlardır; önizleme/gezinti kendi başına hamle göndermesin.
- Önceki ortak tutuş ve başparmak/parmak teması korunur. Kartlar havada ayrılmasın; özellikle 3→2 ve 2→1 geçişlerinde kalan kart/el sıçramasın. Yelpaze sırf gizli tür farklı diye değişmesin.
- Kullanıcının referans açısında önce/sonra; genel koltuk/yakın kamera, dar masaüstü, 390×844 ve 844×390 görüntülerinde üç farklı kartın okunabilirliği doğrulansın. Gerçek dokunmatik test ile viewport emülasyonu ayrı kaydedilsin.

### Tek kontrol yöneticisi — Claude; görsel hedefler Codex

Tam ekran olmak fareyi zorunlu kilitlemez. Pointer Lock açık modda bütün oyun akışı HTML düğmeye fareyle tıklamadan tamamlanabilmeli. Aşağıdaki varsayılanlar aynı uygulama kontrol yöneticisinden işletilir; scene kendi ikinci global keydown/komut dinleyicisini kurmaz. Sahne hedef/gezinme girdileri ile seçilebilir opak kimlikleri uygulamaya verir; uygulama doğrular ve aynı mevcut seçim/onay/gönderme yolunu kullanır.

| Tuş | Davranış |
| --- | --- |
| E veya sol tık | Bakılan uygun nesne/hedef ile etkileşim veya seçim; tek başına sunucu hamlesi onayı değil |
| 1 / 2 / 3 | Elde soldan sağa ilgili uygun kartı seç/öne getir; oy seçenekleri de ekranda açık etiketlenen 1/2 ile seçilebilir |
| Sağ / sol ok | Kartları yalnız inceleme veya açık panelde seçenek odağını değiştirme; seçimi/gönderimi sessizce değiştirmez |
| Enter | Hazır yerel seçimi açık onay adımına getirir; ayrı bırakıp yeniden basma onaylı hamleyi gönderir. Onay metni hedef ve sonucu söyler. Ready/rol hazır gibi tek adımlı işlemlerde mevcut ürün onay gereksinimi uygulanır |
| Backspace | Gönderilmemiş seçim/onayı iptal eder; oyun odaklı durumda tarayıcı gezinmesini tetiklemez |
| H | Kendi rol/özel el incelemesini aç/kapat; kapatınca hem 3D hem HTML gizli alan kapanır |
| V | Masa geneli / koltuk kamerası geçişi; oyun hamlesi yok |
| M | Menü ve tuş yardımını açar; fare kilidi serbestleşir. Menüden bakışa devam Enter veya tıklamayla, kullanıcı etkileşimi içinde istenir |
| Esc | Tarayıcının kilit/tam ekran çıkışını korur, uygulamada bekleyen etkileşimi güvenli bırakır; engellenmez veya otomatik tekrar kilitlenmez |

- Kart çekme sunucunun otomatik dağıtımıysa yeni bir draw komutu/oyun aşaması icat edilmez. E yalnız yetkili eldeki kartı yerel olarak ele alma/inceleme sunumunu başlatabilir; gerçek oyuncu eylemi varsa zaten sunulan actionId/optionId üzerinden yürür. HUD o anda gerçekten yapılabilen eylemi söyler; olmayan “E: kart çek” mesajı gösterilmez.
- Lobi hazır/başlat, rol onayı, aday/oy/kart, veto kabul/ret, özel yetki, sonuç ve rematch kontrollerinin hepsine klavye erişimi sağlanır. Daha çok seçenek varsa oklarla gezilen panel + Enter kullanılır; her hedefe ayrı tuş icat edilmez. Tab doğal fokus gezintisi korunur.
- Küçük kalıcı HUD yalnız mevcut eylem tuşlarını ve seçilen kart/hedefi gösterir. İnfazda hedefin eleneceği, veto/oy/kart onayında gönderilecek karar açık görünür. Tuş haritası uygulamada tek kaynaktan HUD ve davranışa gider; backend oyun sözleşmesine UI tuşları taşınmaz.
- Input/textarea/contenteditable, metin kutusu ve IME yazımı sırasında oyun kısayolları çalışmaz. Menü/dialog odağına göre komutlar kapsamlanır. Ctrl/Cmd/Alt tarayıcı kısayolları ve Esc engellenmez.
- key repeat, basılı Enter, click+keydown veya pointer lock'u açan ilk giriş aynı hamleyi iki kez işletmez. Yeni onay adımı aynı fiziksel keydown ile otomatik gönderilmez; keyup gerekir. Eski phaseId/selection, ağ kesintisi ve gizlenen sekme komutları iptal eder. Tek input olayını hem app hem scene işlememeli.
- HUD sahneyle aynı tam ekran kapsayıcısında kalır. Fare serbest mod, dokunmatik HTML kontroller ve erişilebilirlik alternatifleri korunur.

### Yatay ekran dış kapsayıcısı — Claude

CODEX-013 açık işi: 844×390'da 45vh satırı sahneye yaklaşık 176 px veriyor. İki sütun veya uygun yükseklik düzeniyle incelemeye yeterli alan sağla; yaklaşık 280–300 px sahne hedefini cihazın gerçek kullanılabilir alanına göre doğrula. HUD/menü/özel kart paneliyle yatay taşma veya bütün ekranı kapatan kontroller üretme; 390×844 portreyi bozma.

### Ek kabul

- Bir tam tarayıcı oyununda kilitli bakış + klavye ile adaylık, oy, kart ve onaylar düğmeye fareyle tıklamadan yürür. Nadir yetkiler için ayrıca doğru onay kontrolleri yapılır. Browser otomasyonu gerçek pointer lock sağlayamıyorsa bu kabulü sentetik event ile geçmiş sayma; uygulanabilir kullanıcı kontrolünü ayrı ver.
- Üç kartın her biri sırayla 1/2/3 ile seçilir; görsel sıra ile gönderilen optionId eşleşir, görünmeyen/izinsiz kart seçilemez. E ve Enter art arda/tekrarlı basma testleri çift hamle üretmez.
- Son kontrol için mevcut bağımsız QA görevi kullanılır; geliştirme iki yazarda kalır. Bu belge yeni görev başlatmaz. QA kaynak geliştirme dosyalarını değiştirmeden değişen kapsamı yeniden sınar.

## 3. Animasyon yaşam döngüsü — uygulanacak yön

Codex CODEX-011/r2 yaklaşımı temel alınır: **olay teslim kuyruğu ile kabul edilmiş görsel hareketin ömrü ayrılır**. Claude ve Codex kesin alan adlarını aynı devirde sabitler; bu plan doğrudan TypeScript tipi değiştirmez.

- App kuyruğunun normal temizlenmesi, sahnenin kabul ettiği hareketi iptal etmez. Sahne cueId ile bir kez kabul eder ve kendi yerel süresi/pozu ile tamamlar. 950 ms'yi rastgele 1700 ms'ye çevirmek veya yerel zarf süresini SceneCue haritasına zorla koymak çözüm değildir.
- Aynı revision ile resync dahil gerçek sıfırlama, normal boş kuyruktan ayrı açık bir reset nesli/epoch sinyaliyle iletilir. Oyunun/kimliğin değişimi, kesinti ve unmount da hareketi temizler. Kesintiden dönünce geçmiş olaylar yeniden oynatılmaz.
- Yeni authoritative görünüm eski hareketin özel verisini hemen geçersiz kılar. Yeni revision/grup önceki hareketleri belirlenen geçişle bırakır; eski timer yeni grubu silemez. Herkes aynı anda oy vermek için animasyonun bitmesini beklemez.
- Rol zarfı/özel inceleme gibi yerel hareketler ağ komutu veya ağ cue'su haline getirilmez. Mod değişimi sırasında çift el/kart modeli görünmez; özel yüzler yeni yetkili görünümden alınır.
- Sunum süreleri scene içinde tek kaynakta tutulur. Backend/core/contracts, yalnız sunum süresini bilmek için animasyon sabitlerine bağlanmaz. Ortak contracts'ta reset ve sunum girdilerinin gereken küçük ekleri Claude tarafından yapılır.
- Mevcut tüketiciler için geri uyum varsayımları tanımlanır ve test edilir. QA-R02 için yönsüz eski inspect_own_role niyeti açma anlamını korur (`open ?? true`); yeni açık/kapalı niyeti toggle tahminine dönüştürülmez.

## 4. Baş ve el hareketlerinin paylaşımı

- Claude geçici, odanın üyeliği ve gönderen koltuğun kimliği doğrulanmış bakış mesajlarını taşır. Odadaki herhangi bir oyuncunun başka koltuğun hareketini taklit etmesi kabul edilmez. Supabase kanalı seçimini güncel yetkilendirme olanaklarına göre doğrular; yalnız payload.playerId beyanına güvenmez.
- Codex uzak avatarın başını sınırlı yaw/pitch örnekleri arasında yumuşatır. Yön paylaşımı kapalı, kopmuş veya bayat ise nötr poza döner. Yerel kamera sürükleme veya pointer lock aynı bakış arayüzünü kullanır.
- Kullanıcıya açık el hareketleri kabul edilmiş oyun olaylarından türetilir; her el/parmak karesi ağdan gönderilmez. Kapalı kart/oy hareketinin yol, süre ve tutuşu gizli seçimi ele vermez. Hover, gizli seçenek sırası, rol yüzü, el içeriği ve özel inceleme hareketi dışarı gönderilmez.
- Bakış DB'de saklanmaz, game revision/command ledger'ı değiştirmez; her karede Function çağrısı yoktur. Geçici hareket kanalı arızası çalışabilen oyun API'sini gereksiz kilitlemez.
- Mesajlar değişiklik eşiği ve sınırlı hızla gönderilir; hareketsiz/arka plan istemci mesaj yağdırmaz. 7/10 kişi alıcı çoğalmasıyla birlikte mesaj bütçesi ölçülür; Free kullanım hedefi belgelenir. Gerektiğinde kalite/frekans düşer, ücretli yükseltme yapılmaz.

## 5. Dosya sahipliği ve teslim sırası

1. İki ajan mevcut QA düzeltmelerini ve çapraz R02 kontrollerini bitirir; kaynak ile MD arasındaki farkları giderir.
2. Claude ortak tip/adaptör değişimini yazar; Codex scene tarafındaki girdiler/reset/bakış callback ihtiyacını belirtir. Yaşam döngüsü yönü §3'tür; açık alan adları tek devirde kesinleşir. Taraflardan biri cevap vermiyorsa bağımsız iş sürer, sürekli bekleme döngüsü kurulmaz.
3. Codex üretim sahnesinin dışa açık girişinden isteğe bağlı koltuk modu, eller ve uzaktan baş hareketlerini sunar. Prototipin QA HTML/@fs adresi üretim rotası olarak kullanılmaz. Genel masa görünümü korunur.
4. Claude bu sunumu gerçek oyun rotasına, kullanıcı tercihlerine, Fullscreen/Pointer Lock ve geçici bakış aktarımına bağlar.
5. Codex aynı entegre sürüm üzerinde X04 performans/okunabilirlik cilasını yapar. İki ajan ilgili tip/test/build kontrolünü tamamlar; aktif aynı dosya çift yazılmaz.
6. Entegre test tamamlanınca bağımsız QA görevine yalnız değişen kapsam için yeniden test devri hazırlanır. Görev otomatik yaratılmaz/uyandırılmaz; kullanıcı tarafından yönlendirilir.

## 6. Son doğrulama matrisi

- QA-R01–R07 için tekrar adımları ve düzeltme kanıtları; doğrudan rematch, rol gizleme ve infaz açıklığı zorunlu.
- Ana gerçek oyun rotasında genel masa ve koltuk modu; 6/7 kişi tam oyun, 10 kişi görünüm/teknik yük. Otomatik bot oturumu ile gerçek insan testi ayrı kaydedilir.
- Tam ekran + pointer lock giriş/çıkış; Esc, menü, özel el, odak kaybı, mod geçişi, ret/destek yokluğu, reload ve yeniden bağlanma. Browser araçları kilidi tetikleyemiyorsa sentetik olay başarı sayılmaz; kullanıcının gerçek tarayıcıda yapacağı kısa adım listesi verilir.
- Hedef seçimi/onay: ilk kilit tıklaması, kamera hareketi ve hızlı çift tıklama izinsiz hamle üretemez.
- 1650 ms yerel hareket normal kuyruk temizliğinden sonra sürer; aynı-revision resync hemen keser; yeni batch'i eski timer silemez. Özel bilgi iptal anında kapanır.
- En az iki bağımsız tarayıcı oturumunda baş yönü ve kamuya açık el hareketi görülür; taklit kimlik, üye olmayan, geçersiz/bayat mesaj reddedilir. Fiziksel cihazlar yoksa bu ayrıca belirtilir.
- Gerçek küçük ekran/dokunmatik, gerçek ses, hidden sekme ve ağ toparlama; erişilemeyen cihaz veya doğal token expiry testi açık kalır, yapılmış sayılmaz.
- Aynı kamera/ayar/cihazda FPS/kare zamanı, renderer, bellek ve Realtime mesaj ölçümü. Ölçülemeyen FPS için tahmini başarı verilmez; mevcut QA bütçeleri esas alınır.
- Ana görünüm, eller ve tüm kaynaklar üretim build'inde yerel paketlenir; backend/secret içeriği tarayıcıda yoktur. Dev/QA ekranları üretim oyununa taşınmaz.

Teslimler: Claude `docs/qa/claude/FINAL-INTEGRATION.md`; Codex `docs/qa/codex/FINAL-SCENE.md`; her biri kendi durum dosyasında ortak devri günceller. Son yanıtta doğrulanan sonuçlar, kalan gerçek kullanıcı kontrolleri ve Vercel'e geçişi engelleyen sorunlar ayrı belirtilir. “Hiç sorun kalmadı” ifadesi ölçülmeyen alanlar için kullanılmaz.

## 7. Güncel yayın ve test yetkisi — COORD-005

Kullanıcı “bunları da yapalım vercele alıp test edelim” dedi. Önceki “Vercel açma” talimatı, entegrasyon sonrası test yayını için kaldırılmıştır. Şu anki eksik/aktif geliştirme ara sürümü yayınlanmaz; tamamlanan aday sürüm test edilir.

1. Claude/Codex kapsamındaki entegrasyon biter; ortak adayın typecheck, ilgili testleri ve build'i geçer. Final turunda 0006 ve varsa gerekli yeni migration'ların uygulama durumu doğrulanır; rematch/rol gizleme/komut yetkisi engelleri kapatılır.
2. Claude mevcut Vercel hesabı/projesini kontrol eder, uygunsa yeniden kullanır; yoksa bu kişisel oyun için ücretsiz Hobby projesini hazırlar. Gerçek giriş adımını kullanıcı tamamlar; ücretli plana geçilmez. Git deposunu internette yayımlamak veya kaynakları public yapmak deploy için varsayılan işlem değildir.
3. Doğru monorepo build/API/SPA ayarları, public/secret env ayrımı ve gereken origin/Auth ayarları doğrulanır. Yönetim access tokenı veya DB parolası ihtiyaç yoksa Function'a taşınmaz. Deploy paketinde .env, QA kayıtları veya geliştirme girişleri yayımlanmaz.
4. Sabitlenmiş aday Vercel'e test dağıtımı olarak çıkarılır. Test kullanıcılarının erişebilmesi doğrulanır; Vercel hesap girişi isteyen deployment protection varsa hedef projenin paylaşım ayarı ele alınır, hesap genelinde güvenlik kapatılmaz. Test Supabase projesi açıkça kaydedilir; ayrı production ortamı varmış gibi raporlanmaz ve veri sıfırlanmaz.
5. Bağımsız QA dahil yayın adresinde oda/davet, 6/7 kişi tam oyun, rematch, klavye/tam ekran/kilitli bakış, paylaşılan baş/eller, sır/kimlik gizleme, reload, ağ dönüşü, Realtime ve Function yeniden çalışması sınanır. Gerçek cihaz/insan testini kullanıcı yapar; ajan erişebildiği tarayıcı ve bot koşumunu ayrı raporlar.
6. Hatalar sahibine gider; düzeltilen aday yeniden yayımlanıp değişen kapsam kontrol edilir. URL ve test edilen deployment kimliği rapora yazılır. Kullanıcı/cihaz testi eksikse yayın test sürümüdür; tüm kabul bitti denmez.

Claude yayın sahibi; Codex sahne ve yayın ortamındaki görsel düzeltmeler sahibi. Mevcut bağımsız QA görevi final adayda yeniden kullanılabilir. Bu plan kaydı görevleri kendiliğinden başlatmaz; uygulama görevine kullanıcı ek talimatı ile aktarılır.
