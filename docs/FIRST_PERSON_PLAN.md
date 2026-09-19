# Koltuktan oyun deneyimi — sonraki geliştirme aşaması

## Güncel kullanıcı ataması — son geliştirme

[FINISH_PLAN.md](FINISH_PLAN.md) son uygulama sırası için esas alınır: mevcut kritik QA düzeltmelerinden sonra kamera/eller ve doğrulanmış baş yönü paylaşımı canlı oyuna bağlanacak; masaüstünde isteğe bağlı Fullscreen + Pointer Lock eklenecek. Gerçek arkadaş grubu kabulü açık kalır ancak bağımsız geliştirmeyi bekletmez. Son geliştirme ve yerel kontrollerden sonra Vercel test yayını yetkilidir; gerçek cihaz/arkadaş grubu kabulü yayın adresinde yapılır (FINISH_PLAN §7, COORD-005). Aşağıdaki önceki F00 bekleme ve zorunlu pointer lock olmayan başlangıç kapsamı, bu isteğe bağlı mod için güncellenmiştir.


Tarih: 2026-09-09. Kullanıcı isteği: önce mevcut oyunun çalıştığı doğrulansın; sonra birinci şahıs kamera, diğer oyuncuların baş hareketleri ve el animasyonları geliştirilsin.

Durum: **Plan hazır, uygulama başlamadı. Başlangıç koşulları henüz doğrulanmadı.** Bu belge mevcut C06/J01 çalışmasını değiştirmez ve ajanları kendiliğinden başlatmaz. Sözleşme 0.2.0 ve mevcut kod bu plan tesliminde değiştirilmez.

## 1. Başlama koşulu — F00

Claude mevcut entegrasyon testlerini tamamlar; Codex görsel hataları kendi alanında giderir. Aşağıdaki kanıtlar ilgili QA raporlarında ve ajan durumlarında bulunmadan F01–F05 uygulanmaz:

- Gerçek uzak Supabase kullanan uygulamada, birbirinden bağımsız kimlik/oturumlarla 6 ve 7 kişilik birer tam oyun tamamlanmış olmalı. Aynı kimliği paylaşan yedi sekme yeterli değildir. J01 gerçek arkadaş grubuyla kullanım kontrolünü de içerir; otomatik oyuncu testi bunun yerine geçmez.
- Katılma, hazır olma, rol tanışması, adaylık, eşzamanlı oy, yasama ve oyun sonu çalışmalı. Motorun diğer aşama ve yetki kontrolleri geçmeli.
- Yenileme, bağlantı kopup geri gelme, kaçan Realtime bildirimi ve token yenilemesi oyuncunun koltuğunu/rolünü korumalı; hamle veya olay tekrarlanmamalı.
- Yetkisiz oyuncuya gizli rol, el, oy veya inceleme bilgisi gitmediği doğrulanmalı.
- CODEX-009 animasyon temizleme sorunu kapanmalı; gerçek oyun rotasında animasyon gözle görünür şekilde tamamlanmalı, resync sırasında hemen iptal edilmeli.
- Oyunu engelleyen bilinen hata kalmamalı. Test ortamı, kullanılan sürüm/dosya durumu, tarih ve kalan küçük kusurlar raporda açık olmalı.

C06'nın uzak DB kurulum ve test kısmı J01'i hazırlamak için önce yapılabilir. Vercel yayını mevcut ayrı yayın adımıdır; bu plan yeni deploy veya ücretli hizmet talimatı vermez. F00 kanıtı olmadan tüm testler geçmiş varsayılmaz. Koşullar sağlandığında sonraki görevler bu plandan atanır; tekrar kapsam planı yazmak gerekmez.

## 2. Oyuncunun göreceği deneyim

### Kendi koltuğundan bakış

- Mevcut masa geneli görünümü korunur; oyuncu bir düğmeyle kendi göz hizasına geçer ve tekrar masa geneline döner. İlk girişte mevcut görünüm kullanılır, kullanıcının tercihi cihazında saklanır.
- Kamera kendi koltuğuna bağlıdır; fareyle sürükleyerek, telefonda tek parmakla sürükleyerek sağa/sola ve sınırlı yukarı/aşağı bakılır. Kamera yer değiştirmez; serbest dolaşım yoktur.
- Masa, tahtalar ve yan koltuklara bakılabilir. Baş dönüş sınırları görsel prototipte belirlenir; boyun doğal olmayan açılara dönmez.
- Bakış sürüklemesi kart seçme veya oy gönderme sayılmaz. HTML paneli üzerindeki hareket kamera kontrolüne gitmez. Bakışı ortala ve masa geneline dön kontrolleri klavyeden de kullanılabilir.
- Zorunlu pointer lock, kamera sallantısı ve kafa salınımı yoktur. Azaltılmış hareket tercihinde kamera geçişi doğrudan veya kısa geçişle yapılır.
- Kart inceleme yakın planı özel alanda kalır; panel kapanınca önceki bakış geri gelir. Kendi kafa/gövde geometrisi kamerayı kapatmaz; diğer oyuncular için avatar korunur.

### Eller ve kollar

İlk varlık seti stilize iki el, bilek ve gerektiği kadar önkoldan oluşur. Yakın kamera için okunabilir başparmak/parmak silueti ve birkaç ortak tutuş pozu yeterlidir. Tam vücut, fizik motoru ve tek tek parmakların ağdan aktarılması bu aşamaya dahil değildir.

| Eylem | Yerel oyuncu | Diğer oyuncular |
| --- | --- | --- |
| Kart çekme | El desteye uzanır, yetkili kartları alıp özel alana getirir | Yalnız sunucunun açıkladığı alıcı/sayı kadar kapalı kart ve genel uzanma |
| Kart seçimi | Seçili kart tutulur/yükselir; vazgeçilirse yerine döner | Onay öncesi seçim, hover, seçenek kimliği ve eldeki konum paylaşılmaz |
| Kart bırakma / aktarma | Sunucu kabulünden sonra kart ilgili alana bırakılır | Yalnız izin verilen kapalı aktarım veya açık politika yerleştirme |
| Oy verme / açma | Özel seçim yapılır, kabul edilince kapalı oy kartı masaya konur | Açıklamaya kadar evet/hayır ayırt edilemez; sonuç olayıyla el kartı çevirir |
| Rol zarfı | İki el zarfı açar, rol kartını sahibine doğru tutar | İlk kapsamda yerel rol inceleme hareketi yayınlanmaz; nötr/kapalı temsil kalır |
| Görev / özel yetki | Gereken yerde işaret uzatma veya genel el hareketi | Yalnız zaten herkese açıklanmış eylem/hedef; özel inceleme sonucu gizli |

Eller masadan veya karttan geçmemeli; 5–10 koltukta erişme mesafesi hesaplanmalı. Kameraya yakın eller ve uzaktan görülen avatar kolları aynı oyuncuda çift görünmemeli. Bütün yüzeyler mevcut ceviz/keçe/krem ve stilize avatar tasarımına uymalı.

### Başkalarının nereye baktığı

- Diğer avatarların başı, oyuncunun bilinçli sağa/sola bakışına doğru yumuşakça döner. Bu gerçek göz takibi veya webcam kullanımı değildir.
- Sadece sınırlı baş yönü paylaşılır. Hangi kart/oyuncu/HTML öğesine bakıldığı, imleç konumu, özel kamera yakın planı, hover ve özel kart seçimi mesajda bulunmaz.
- Özel rol/el incelemesi sırasında dışarıya kart konumu izlenimi veren kamera hareketleri aktarılmaz; genel/nötr baş pozu kullanılır. Kasıtlı genel baş dönüşünün sosyal olarak görünmesi özelliğin amacıdır.
- Bakış paylaşımını kapat seçeneği bulunur; kapalı/bağlantısız/arka plandaki oyuncunun başı zaman aşımıyla nötre döner. Kamerayı oynatmak oyun kuralını veya oyuncu yetkisini etkilemez.

## 3. Uygulama sınırları ve sözleşme hazırlığı

F01'de Claude ve Codex, gereken ek tipleri ve davranışları MD üzerinden kararlaştırır. Buradaki alanlar taslak fikirdir; mevcut 0.2.0 sözleşmesine sessizce eklenmez.

- Kamera modu, yerel bakış ve yerel el tutuşu mümkün olduğunca sahnede kalır. Uygulama tercih kontrollerini ve bağlantı yaşam döngüsünü sağlar.
- Bakış için oyun durumundan ayrı, geçici görsel iletişim tasarlanır. `yaw`, `pitch`, sıralama/oturum bilgisi gibi en küçük yük değerlendirilir. Oyuncu/koltuk kimliği payload beyanından güvenilir kabul edilmez.
- Claude uygulama anında Supabase'in güncel özel kanal yetkilendirmesini doğrular. Aynı odadaki bir oyuncunun başka koltuğun baş yönünü taklit etmesini önleyen bir yol seçilir; yalnız oda üyeliğini kontrol etmek yeterli değildir. Gerekirse oyuncuya özel yazma yetkili kanal tasarlanır. İstemciye server secret verilmez.
- Bu mesajlar Postgres oyun kayıtlarına, command ledger'a veya oyun revision akışına yazılmaz. Bakış başına Function çağrısı yapılmaz. Görsel bağlantı koparsa HTTP oyun akışı çalışabildiği sürece oyun sırf bakış yüzünden durmaz.
- Yeni geçici kanallar mevcut yalnız revision taşıyan oyun bildirim kanalından ayrılır. Mevcut mimarideki “Realtime yalnız sürüm taşır” sınırının bu özellik için kapsamlı istisnası F01'de CONTRACT/DEPLOYMENT/DECISIONS içine yazılır.
- Gönderim yalnız açı anlamlı değiştiğinde ve sınırlı hızda yapılır. Başlangıç denemesi oyuncu başına en fazla 5 güncelleme/s; gerçek ölçümle aşağı ayarlanır. Durgun ve gizli sekmeler sürekli mesaj göndermez. Alıcı yumuşatma yapar; eski, sıra dışı, yanlış oturumlu ve geçersiz açı değerlerini reddeder.
- 7/10 oyuncuda gönderim, alıcılara çoğaltılan teslim ve kanal sayısı birlikte ölçülür. Free planın uygulama tarihindeki kotalarıyla oyun gecesi için mesaj bütçesi hesaplanır. Bütçe aşılırsa frekans/abonelik azaltılır veya paylaşım kapatılabilir; otomatik ücretli yükseltme yoktur.
- El hareketleri mevcut yetkili oyun görünümü ve olaylarından türetilir; her animasyon karesi ağdan gönderilmez. Bir olay yetkisizse kapalı kart modelini hareket ettirmek için bile gizli veriden türetilmiş payload eklenmez.
- Kapalı oy/kart hareketinin süre, yol, tutuş, arka yüz ve atık konumu gizli karta/oya göre değişmez. Uzak el hareketi özel seçenek sırasını ele vermez.
- Animasyonun bitmesi sunucu hamlesi için ön koşul olmaz. Reddedilen hamle kesinleşmiş gibi gösterilmez. Yeni görünüm, resync, oyun/oturum değişimi ve kesinti eski hareketi temizler; geçmiş hareketler birikerek yeniden oynatılmaz.
- Yeni el koreografisi 900 ms sınırına varsayımla bağlanmaz: CODEX-009 çözümü temel alınır, gerçek maksimum süre/iptal davranışı birlikte belirlenir. Yeni grup geldikten sonra eski temizleme zamanlayıcısı yeni hareketi silemez.

## 4. Görevler ve iş bölümü

| ID | Sahip | Teslim | Ön koşul |
| --- | --- | --- | --- |
| F00 | Claude lider; Codex görsel düzeltmeler | Yukarıdaki çalışan oyun kanıtı ve açık engellerin kapanışı | C05, X03, uzak C06 doğrulaması, J01 |
| F01 | Claude ortak tipler; Codex tasarım girdisi | Kamera/girdi/el/bakış sınırları, kimlik doğrulama yolu ve ölçüm bütçesi; ortak sözleşme devri | F00 |
| F02 | Codex | Kendi koltuğundan kamera, masa geneli geçişi, dokunma/klavye davranışı, sentetik bakış fixture'larıyla görsel prototip | F01 |
| F03 | Codex | El/önkol modelleri, tutuşlar, kart/oy/zarf hareketleri, uzaktan avatar kolları | F02 |
| F04 | Claude | Geçici bakış taşıma/kimlik/yetki, tercih UI'si, olay ve animasyon yaşam döngüsü entegrasyonu | F01; son bağlama F02/F03 |
| F05 | Claude + Codex | Canlı 6/7 kişi yeni görünümle tam oyun; 10 kişi yük kontrolü; gizlilik/cihaz/yeniden bağlantı QA | F03, F04 |
| X04 | Codex | Yeni eller/başlar/kamera dahil son performans ve görsel cila | F05 |

F02/F03 görsel işi ile F04 bağlantı işi F01 devrinden sonra paralel yürüyebilir. Bu belge tek başına yeni ajan/oturum başlatma talimatı değildir. Kullanıcı daha sonra görev sahibini değiştirebilir; geçici dosya sahipliği ilgili ajan MD'sine yazılır.

Codex yolları: `packages/scene/**`, `docs/DESIGN.md`, `docs/ASSETS.md`, kendi durum ve görsel QA belgeleri. Claude yolları: `apps/web/**`, `packages/contracts/**`, `packages/fixtures/**`, gerektiğinde `packages/server/**`/`supabase/**`, kendi test/dağıtım belgeleri. Tip ve bağımlılık değişikliklerinde mevcut tek-yazar protokolü uygulanır.

## 5. Kabul kontrolleri

- 5–10 koltukta kamera kendi koltuğuna doğru yerleşir. Uzun isimler, tahtalar ve kartlar okunabilir; 390×844 ve yatay telefon düzeni kontrol edilir.
- Kamera sürüklemesi yanlışlıkla kart/oy seçmez. Kamera modu değişince seçim, rol ve sunucu durumu değişmez. HTML eylemleri ve klavye erişimi çalışır.
- Seçme/vazgeçme/reddedilen komut/sunucu kabulü ayrı doğrulanır. Eller çift görünmez, havada kalmaz veya kartın içinden geçmez.
- Uzak oyuncunun ağına ve sahnesine gizli kart yüzü, açıklanmamış oy veya özel seçim kimliği ulaşmaz. Hem payload kontrolleri hem farklı kameralardan görsel inceleme yapılır.
- Üye olmayan kanal erişemez; üye başka koltuğu taklit edemez. Eski oturum/sequence ve aşırı/geçersiz payload kontrol edilir. Bakış mesajı oyun durumunu değiştiremez.
- En az iki gerçek cihazda baş dönüşü tutarlı ve yumuşak görünür. Kopma, token yenileme, gizli sekme, tekrar bağlanma ve paylaşımı kapatma nötr/son geçerli görünümü doğru sağlar.
- Düşük grafik ve azaltılmış hareket modları kullanılabilir. Hareketsiz sahnenin çizim döngüsü tekrar durur; kaynaklar unmount sırasında temizlenir.
- Aynı cihaz/çözünürlükte önceki sahne ile yeni sürüm karşılaştırılır: FPS/kare süresi, çizim sayısı, üçgen, bellek ve Realtime mesaj sayısı kaydedilir. Mevcut QA performans hedefleri esas alınır; ölçülmeyen FPS geçer sayılmaz.
- Sesler el/kart temasına uyar, tekrar etmez; gerçek hoparlör ve telefon autoplay davranışı kontrol edilir.
- F05 sonunda 6/7 kişilik tam oyunlar, 10 kişilik teknik yük koşumu ve kalan sınırlamalar açıkça raporlanır. 10 kişilik yük testi, 10 kişiyle oynanmış tam oyun diye sunulmaz.

## 6. Teslim ve sonraki adım

Codex: `docs/qa/codex/F02-F03.md`, model/animasyon listesi ve CODEX durum devri. Claude: `docs/qa/claude/F04-F05.md`, yetki/bağlantı/mesaj bütçesi kanıtları ve CLAUDE durum devri. Ortak tip ve davranış kararları CONTRACT/DECISIONS'a uygulama sırasında yazılır.

Bugünkü sıradaki iş mevcut C06/J01'i tamamlamaktır. F00 geçince F01 ile yeni aşama açılır; X04 bu özelliklerden sonra son cila olarak uygulanır. Çalışmayı engelleyen performans hataları F00 sırasında giderilebilir, son cilayı beklemez.
