# Secret Table — bağımsız QA incelemesi

**Tarih:** 9 Eylül 2026, yaklaşık 17:15–17:52 (Europe/Istanbul). **Test sahibi:** QA_CODEX. **Karar:** İki tam canlı oyun tamamlandı; yeniden oynama ve gizleme davranışında düzeltme gerekli. Bu rapor F00'ın gerçek arkadaş grubu kabulünü kapatmaz.

## 1. Test edilen sürüm ve ortam

- Paylaşılan checkout: `<proje-klasörü>`, `main`, **commit yok**; dosyalar izlenmiyor. Başlangıçta 172 kaynak/test/manifest/yardımcı dosyanın SHA256'sı kaydedildi. Son karşılaştırma: [kaynak karşılaştırması](qa-review/source-comparison.json), [başlangıç manifesti](qa-review/source-baseline.json).
- Ana oyun: `http://localhost:5173`, gerçek uzak Supabase üzerinden, yeni sentetik QA odaları. Prototip: `http://127.0.0.1:5174/@fs<proje-klasörü>/docs/qa/codex/first-person.html`. İki giriş de gerçek tarayıcıda açıldı. Sunucular değiştirilmedi veya kapatılmadı.
- Tarayıcı: **Codex in-app Browser**, macOS/arm64 ortamı. Chrome kontrol yüzeyi mevcut değildi. İnceleme fare ve klavye üzerinden yapıldı; tarayıcıyı bir AI ajanı kullandı, gerçek insan oyun grubu yok.
- DOM ile doğrulanan ölçüler: canlı 6p ilk ekran 664×837, devamı 1440×1000; canlı 7p 1280×720. Sahne fixture 1280×720; prototip 1440×1000, 390×844 ve 844×390. Küçük ekranlar **viewport emülasyonu**, fiziksel telefon değildir.
- Başlangıçta viewport ayarı önceden açık sekmeyi değiştirmedi; kayıtlar istenen değerle değil gözlenen değerle etiketlendi. Büyük tam-sayfa prototip çekimindeki birleştirme bozukluğu teslim kanıtından çıkarıldı; mobil kanıtlar normal viewport görüntüleridir.
- Ürün kodu, ortak sözleşme **0.2.0**, paketler, kilit dosyası, Git indeksi ve dağıtım değişmedi. Yalnız bu rapor, kendi durum dosyası, QA ekranı ve kanıtlar yazıldı. Migration/deploy/DB temizliği/anahtar değişimi yapılmadı.
- `scratchpad/party.mjs` önce okundu, değiştirilmeden kullanıldı. Shell'in ilk DNS erişimi kısıtlıydı; yetkili ağ erişimiyle bot çalıştırıldı. `.env` sadece mevcut yardımcının girdisi oldu; değerleri kaydedilmedi.

## 2. Canlı oyun sonuçları

| Koşu | Oyuncular ve kontrol | Sonuç | Kanıt |
| --- | --- | --- | --- |
| 6 kişi | QA-İpek Şığ Öztürk gerçek tarayıcıda; 5 bağımsız anonim bot kendi koltuklarında | **Liberaller: 5 liberal politika**, L5/F1, revision 67 | [Sonuç metni](qa-review/live-6-result.txt), [görüntü](qa-review/live-6-result.png), [bot günlüğü](qa-review/live-6-bots.log) |
| 7 kişi | QA-Çağrı Şengül Uzun İsim Denemesi gerçek tarayıcıda; 6 bağımsız anonim bot | **Faşistler: 6 faşist politika**, L1/F6, revision 79 | [Sonuç metni](qa-review/live-7-result.txt), [görüntü](qa-review/live-7-result.png), [bot günlüğü](qa-review/live-7-bots.log) |

**6p** oda `31c767e1-bc7c-49b9-8b59-991ccccb51dd`, davet `7EXYYA`. Rol başlangıcı, oy, 3D kart tıklaması, seçim/vazgeçme, şansölye politika onayı, başkan aday gösterme/kart atma, reddedilen seçim, sayaç ve geçmiş, politika zaferi gerçek UI'da görüldü. Önceki J01'de açık kalan `liberal_policies_enacted` bu koşuda **canlıda doğrulandı**. İstemci çift tıklamada gönderim süresince seçenekleri kilitledi; bunu DB ledger denetimi olarak sunmuyoruz.

**7p** oda `8a8c80f2-c587-4628-906d-79c9269ee672`, davet `BNVUCH`. Tarayıcı oyuncusu rol onayı, oy, politika seçimi, aday gösterme, üç karttan atma ve **infaz** yaptı. F2 sadakat incelemesi ve F3 özel seçim botlar tarafından gerçek akışta kullanıldı; tarayıcı özel seçimden sonra başkan oldu. F4'te QA oyuncusu Bot-Gul'ü infaz etti. F5'te bir bot QA oyuncusunu infaz etti; oy düğmeleri kaldırıldı, oyuncu listesinde `elendi` göründü. Kalan botlar oyunu tamamladı. [İnfaz öncesi](qa-review/live-7-execution-before.png), [onay](qa-review/live-7-execution-confirm.png), [sonrası](qa-review/live-7-execution-after.txt), [yerel elenme](qa-review/live-7-eliminated-local.txt).

Bot yardımcısı bittikten sonra 6p odasında yeniden oynama denendi: doğrudan düğme iki kez hata verdi; **Lobiye dön → Oyunu başlat** yeni rol tanışmasına geçti. Bu ikinci 6p oyunu bitirilmedi; botlar sona erdiği için bazı oyuncular çevrimdışı/duraklama durumunda. İlk tamamlanan oyunun sonuç kanıtı yukarıdadır. 7p oda tamamlanmış oyun olarak bırakıldı. Test odaları/anon kullanıcılar silinmedi. Botların zaman zaman kırmızı bağlantı işareti göstermesi, yardımcının bütün koltuklara sürekli heartbeat göndermemesiyle birlikte değerlendirilmelidir; bunu tek başına insan istemcisinde ağ kusuru saymadım.

## 3. Bulgular ve devir

### QA-R01 — Oyunu engelliyor: doğrudan “Yeniden oyna” başarısız

- **Sahip:** Claude. **Ekran:** bitmiş canlı 6p oyun.
- **Tekrar:** oyunu bitir → oda sahibi olarak `Yeniden oyna` → bekle. Gerçek sayfa reload sonrası aynı düğmeyi tekrar dene.
- **Beklenen:** mevcut oyuncularla yeni oyun kimliği/rol tanışması veya açık, uygulanabilir gerekçe.
- **Gerçek:** iki denemede de `SERVICE_UNAVAILABLE`; eski sonuç ekranı kalıyor. İlk oyunu engellemiyor, doğrudan yeniden oynama yolunu engelliyor.
- **Kanıt:** [ilk hata](qa-review/live-6-rematch-error.png), [metin](qa-review/live-6-rematch-error.txt), [reload sonrası tekrar](qa-review/live-6-rematch-repeat.txt), [lobi üzerinden başarılı alternatif](qa-review/live-6-restart-via-lobby.txt).
- **Kaynak çıkarımı:** `packages/server/src/service.ts:137–139` play_again'i doğrudan startGame'e gönderiyor. `supabase/migrations/0002_functions.sql:125–129` yalnız `status='lobby'` satırını kabul ediyor; biten oyun odası `in_game` kalıyor. Bu, UI'da gözlenen hatayla tutarlı; uzak SQL iç hata kaydı bu görevde alınmadı.
- **Düzeltme sırası:** bitmiş oyun için atomik ve yetkili yeniden başlatma geçişini düzelt; aktif oyunun yanlışlıkla yeniden başlamasını engelleyen sunucu kontrolünü koru. Aynı uzak akışta doğrudan rematch regresyon testi ekle. Sadece düğme metnini değiştirmek yeterli değil.

### QA-R02 — Önemli: “Kimliği kapat” gizlenen özel paneli yeniden açıyor

- **Sahip:** Codex (scene niyeti), Claude (uygulama özel paneli). **İlgili dosyalar:** `packages/scene/src/TableScene.tsx`, `apps/web/src/multiplayer/useRoomState.ts`.
- **Tekrar:** rol tanışmasında `Kimliği aç` → HTML özel bilgi panelinde `Gizle` → sahnede `Kimliği kapat`.
- **Beklenen:** kapatma eylemi özel bilgiyi gizlemeli; daha önce gizlenen başka sunumu açmamalı.
- **Gerçek:** 3D kimlik kapanırken HTML paneli yeniden açılıyor; rol ve bilinen oyuncu bilgisi görünür oluyor. Daha kısa yolda da 3D kapatma, zaten açık olan HTML rolünü gizlemiyor.
- **Kanıt:** [görüntü](qa-review/live-role-close-reopens.png), [DOM metni](qa-review/live-role-close-reopens.txt). Yalnız kendi sentetik QA koltuğuyla tekrarlandı.
- **Neden:** `toggleRole` her iki yönde de `inspect_own_role` gönderiyor. Bu **sunucudan başka oyuncuya veri sızıntısı iddiası değildir**; aynı ekranda gizleme niyetinin tersine dönmesidir.
- **Öneri:** açma/kapama niyetini tutarlı yap; kapama sırasında HTML panelini yeniden açma. İki kontrolün çapraz kullanımını regresyona ekle.

### QA-R03 — Önemli: infaz onayı yapılacak işlemi söylemiyor

- **Sahip:** Claude. **Dosyalar:** `apps/web/src/ui/ActionPanel.tsx`, `apps/web/src/ui/text.ts`.
- **Tekrar:** 7p oyunda F4 sonrası başkanlık yetkisine gel → hedef seç.
- **Beklenen:** onaydan önce `İnfaz` ve hedefin oyundan çıkacağı açıkça görünmeli; sadakat incelemesi/özel seçimle karışmamalı.
- **Gerçek:** üst panelde yalnız `Başkanlık yetkisi`, `Yetkiyi kullan`, `Seçilen: Bot-Gul — onay gerekiyor`, `Gönder` var. Yetkinin adı aşağıdaki Masa panelinde; 1280×720 başlangıç kadrajında görünmüyor.
- **Kanıt:** [önce](qa-review/live-7-execution-before.png), [onay](qa-review/live-7-execution-confirm.png). İşlem gerçekten oyuncuyu eledi.
- **Öneri:** `currentPower.power` üzerinden özel başlık/ipucu/onay metni üret. Örneğin `Bot-Gul oyuncusunu infaz et — oyundan elenecek`.

### QA-R04 — Önemli: bazı sunucu hataları ham kodla gösteriliyor

- **Sahip:** Claude. **Dosya:** `apps/web/src/ui/text.ts`.
- **Tekrar:** QA-R01'i uygula; ağsız QA ekranındaki `Sentetik servis hatası` da aynı metin yolunu gösterir.
- **Beklenen:** Türkçe hata ve sonraki uygulanabilir adım.
- **Gerçek:** `SERVICE_UNAVAILABLE` aynen basılıyor. Sözlükte `error.service_unavailable` var, büyük harfli karşılığı yok. Geçersiz davetteki `ROOM_NOT_FOUND` ise doğru Türkçe mesaja çevrildi.
- **Kanıt:** [canlı hata](qa-review/live-6-rematch-error.png), [sentetik metin](qa-review/fixture-service-error.txt), [doğru davet hatası](qa-review/invalid-invite.txt).
- **Öneri:** bütün hata girişlerini ortak kod/messageKey çözümüne yönlendir; kullanıcıya ham kodu tek açıklama olarak verme.

### QA-R05 — Görsel cila: genel masada bilgi ölçeği küçük

- **Sahip:** Codex; HTML bilgi desteği için Claude.
- **Tekrar:** 390×844, 5–10 kişi masa geneli; ayrıca mevcut sahnenin özel alan yakınlaştırmasını aç.
- **Beklenen:** temel tahta/rol-görev bilgileri uygun yakınlaştırma veya kolay erişilen HTML karşılığıyla okunabilmeli.
- **Gerçek:** oyuncuların konumu ayırt ediliyor fakat politika yuvası yazıları, küçük görev alt metinleri ve kart yüzleri genel masada okunamayacak kadar küçük. Mevcut sahnedeki `Özel alanı incele` de kartları prototip kadar büyütmüyor. HTML politika düğmeleri ve sayaçlar kullanılabilir; bu nedenle oyunu engellemiyor.
- **Kanıt:** [10p mevcut UI](qa-review/fixture-ui-mobile-10.png), [mevcut yakın alan](qa-review/fixture-ui-mobile-private.png), [prototip yakın kart](qa-review/prototype-mobile-private.png).
- **Öneri:** gerçek telefon kontrolünde bilgi hiyerarşisini iyileştir; tahta ve kart inceleme yakınlığını ayrı ele al. Uzun isimlerde yatay taşma saptanmadı; HTML hedef adlarının ölçülen scrollWidth'i clientWidth'i aşmadı.

### QA-R06 — Görsel cila: el kavraması yeterince doğal görünmüyor

- **Sahip:** Codex. **Dosya:** `packages/scene/src/prototype/HandRig.tsx`.
- **Tekrar:** 10 kişi, kendi koltuğu → çek → seç → bırak; tutma/son pozu incele.
- **Beklenen:** başparmak ve diğer parmaklar kartın kenarına karşılıklı temas ederek desteklediğini göstermeli.
- **Gerçek:** parmaklar açık/yayvan kalıyor; özellikle bırakma sonrası kalan kartlar sol avuçtan bağımsız duruyormuş gibi görünüyor. Bu değerlendirme gözlenen pozların görsel doğallığına ait; mesh çarpışma çözümleyicisiyle ölçülmüş bir kesişme iddiası değil.
- **Kanıt:** [bırakma son pozu](qa-review/prototype-place-settled.png), [yakın mobil tutuş](qa-review/prototype-mobile-private.png), [bırakma ara pozu](qa-review/prototype-place-mid.png).
- **Öneri:** parmak kapanışı/başparmak karşı basıncı ve kart desteğini iyileştir. İncelenen karelerde büyük bir önkol-masa geçişi saptanmadı; her parmağın her karede çarpışmasız olduğu doğrulanmadı.

### QA-R07 — Görsel cila: sonuç ekranında eski bekleme metni ve İngilizce rol değerleri

- **Sahip:** Claude. **Dosyalar:** `ActionPanel.tsx`, `TableStatus.tsx`.
- **Tekrar:** herhangi bir canlı oyun sonu.
- **Beklenen:** kazanan/sonuç önde, artık beklenmediği açık, roller Türkçe.
- **Gerçek:** `Sıra: Oyun bitti` altında `Diğer oyuncular bekleniyor` kalıyor. Sonuç listesindeki roller `liberal`, `fascist`, `hitler`; kazanan metni aşağıdaki Masa panelinde.
- **Kanıt:** [6p sonuç](qa-review/live-6-result.txt), [7p sonuç](qa-review/live-7-result.txt).
- **Öneri:** game_over için ayrı boş eylem metni, yeniden oynama bölümünün yanında kazanan özeti ve rol çevirileri.

## 4. Görsel inceleme — çalışan taraflar

- **Karakter ve koltuklar:** mevcut sahne ve prototipte 5/6/7/8/9/10 masa genelini gerçek görüntüler üzerinden inceledim. Sandalye/karakter yerleşimi koltuk sayısıyla uyumlu; birbirinin üzerine yığılan isimlik veya kaybolan koltuk saptanmadı. Renk/gövde çeşitliliği rolleri ele veren ayrı bir stil olarak görünmüyor. Baş ve gövde ölçeği tutarlı, stilize bir masa oyunu görünümü var.
- **Masa/ortam:** keçe-ahşap ayrımı, kenar şeritleri, kart kalınlığı, sıcak lambalar ve gölgeler tutarlı. Sahne görsel olarak okunur; uzak üst duvar/karanlık boşluk geniş ve sinematik bir tercih. Kart/tahta okunabilirliği için yakın alanlarda alan daha verimli kullanılabilir (R05).
- **Kart ve zarf:** ortak arka yüz ile liberal/faşist yüzler farklı, yakın prototipte başlıklar okunuyor. Yerel seçim hem 3D hem HTML üzerinden çalıştı. Onay verilmeden politika kalıcı olarak tahtaya yerleşmedi; Vazgeç yerel seçimi temizledi. Canlıda yabancı oyuncunun el yüzü görülmedi; bu gözlem tam ağ paket güvenlik denetimi değildir.
- **Kamera ve özel yüzler:** prototipte genel görünüm/başlatılan uçuş/tersine çevrilen uçuş/özel veri kaldırılması örneklerinde özel yüz sayısı 0. Yerleşmiş yetkili elde 3. 10. yerel koltukta da masa/eller çizildi. Fare sürüklemesi seçim sayısını artırmadı (2→2, sürükleme 0→1). Klavye sınırı yaw −1.012, pitch −0.838; Home merkezledi.
- **Etkileşim ve klavye:** oy seçimini Enter ile yaptım; Gönder/iptal HTML alternatifi çalıştı. Rol paneli kapatıldığında odak Göster düğmesine döndü. Tam ekran okuyucu denetimi yapılmadı.
- **Küçük ekran:** 390×844'te mevcut UI bileşenleri ve prototipin 5–10 kişi örnekleri, uzun Türkçe isimler; 844×390'da prototip 10. koltuk/yakın kart/seçim incelendi. Sayfa yatay taşması saptanmadı. Yatay görünümde kenardaki komşular kısmen kadraj dışında; sınırlı bakışla çevreye bakılabiliyor. Gerçek dokunmatik hedef isabeti ölçülmedi.

### Görsel kanıt dizini

| Grup | Dosyalar (`qa-review/` altında) |
| --- | --- |
| Mevcut sahne 5–10 masaüstü | `fixture-main-5.png` … `fixture-main-10.png` |
| Gerçek UI bileşenleri 5–10 küçük ekran | `fixture-ui-mobile-5.png` … `fixture-ui-mobile-10.png`, `fixture-ui-mobile-long.png` |
| Prototip 5–10 masaüstü | `prototype-desktop-5.png` … `prototype-desktop-10.png` |
| Prototip 5–10 küçük ekran/uzun ad | `prototype-mobile-5.png` … `prototype-mobile-10.png` |
| Yakın/yatay/eller | `prototype-mobile-private.png`, `prototype-landscape-seat10.png`, `prototype-landscape-selected.png`, `prototype-low-selected.png` |
| Hareket ara/son kareleri | `prototype-draw-0.png` … `prototype-draw-6.png`, `prototype-select.png`, `prototype-rejected.png`, `prototype-place-{mid,settled}.png`, `prototype-vote-{mid,settled}.png`, `prototype-envelope-*.png` |

## 5. Efekt, ses ve yaşam döngüsü

Canlı oyunlarda politika/oy/rol ve elenme son durumları göründü. 6p oyun sonunda uygulama içi Yenile arka arkaya uygulandı; sonuç bozulmadı. **Tam animasyon penceresi içinde canlı resync'in milisaniye ölçümü yapılmadı.** Zamanlanmış iptal/tekrar olay kontrolleri mevcut `X03Preview` üzerinden gerçek tarayıcıda ama **sentetik fixture** ile yapıldı.

| Kontrol | Bu oturumun sonucu |
| --- | --- |
| Dağıtım normal ömür | X03 ölçümünde 120 ms aktif=1; 1000 ms aktif=0. Ses 1→1, aktif ses 1→0 |
| Aynı olay yeniden sunuldu | played 1→1, sounds 1→1, aktif 0→0; tekrar başlamadı |
| 180 ms resync / kesinti / yeni revision | Üçünde de kesinti kontrolü aktif=0; 1000 ms'de kalıntı yok |
| Açık oy / politika / kapalı aktarım / görev / oyun sonu / elenme | Her kontrol gerçek tarayıcıdan tetiklendi, ara kareler ve ölçüm kayıtları alındı |
| Reduced motion, çoklu cue | `Oy + el + görev` reduced kontrolü; sahne kısa sürede son durum, 1000 ms aktif=0 |
| Ses aç/kapa | Kullanıcı tıklaması sonrası motor `running`; olay sesi sayaçları arttı. Ses kapatılıp aktarım çalıştırılınca ses sayacı artmadı, voices=0 |
| Prototip hareketleri | Çekme, seçme, vazgeçme/ret, bırakma, oy çevirme, zarf açma tetiklendi; ara/son kareler ayrıldı |
| Aktif prototip iptali | Zarf sürerken `Hareketi sıfırla`: envelope→settled, özel yüz=0 |
| Baş örneği | Yerel sentetik yaw değerleri değişti; kapatma sonrası bütün baş yaw/pitch değerleri 0 |
| Boşta çizim | Prototip düşük kalite/yakın görünümde, hareket bitmişken iki okumada sceneFrames **73→73** |

X03 ekranı son 20 ölçüm satırını tutar; ilk normal dağıtımın 120/1000 ms kaydı önce alınan resync/yeni-revision metinlerinde de korunur.

Kanıt: [tekilleştirme](qa-review/effects-dedup.json), [resync](qa-review/effects-resync.txt), [kesinti](qa-review/effects-interrupt.txt), [yeni revision](qa-review/effects-new-revision.txt), [reduced](qa-review/effects-reduced.txt), [ölçüm satırları](qa-review/effects-all-measurements.jsonl), [prototip gizlilik](qa-review/prototype-privacy.json), [sürükleme/sınır](qa-review/prototype-drag-limits.json), [aktif iptal](qa-review/prototype-reset-active.json), [baş aktif](qa-review/prototype-head-active.json), [baş nötr](qa-review/prototype-head-neutral.json).

**950 / 1650 ms ayrımı:** kaynakta bugün uygulama `CUE_CLEAR_MS=950` ile temizliyor; mevcut TableScene cue süreleri 350–850 ms (dağıtım 520, oy 480, politika 620, oyun sonu 850). Boş `cues` aktif hareketi iptal ediyor. Prototip kendi `rig.motion` saatini kullanıyor: çekme 1450, bırakma 1350, oy 1150, zarf 1650, seçme 440, vazgeçme 420 ms; +20 ms muhasebe payı. Prototip canlı kuyruktan beslenmediği için **bugünkü canlı oyunda 1650 ms hareketin 950'de kesildiğini gözlemlemedim**. Bu, entegrasyon öncesi bir risk ve açık tasarım kararıdır.

CODEX-011/r2'nin yerel ömür + epoch/suspended önerisi ile CLAUDE-004'ün ortak süre haritasından batch drain türetme önerisi farklıdır. Bu görevde ikisi de uygulanmış kabul edilmedi, sözleşme kararı verilmedi. Entegrasyon kabulünde özellikle aynı-revision resync, normal drain, yeni revision, eski timer'ın yeni batch'i silmemesi ve animasyonun sunucu işlemini bekletmemesi birlikte test edilmeli. Prototipte `busy` bazı demo düğmelerini hareket bitene kadar kilitliyor; bu davranış canlı HTML eylemlerinin kilitlendiği anlamına gelmez.

## 6. Dayanıklılık, test kapsamı ve sınırlar

- **Gerçek reload:** oylama sırasında tam sayfa yenilendi; aynı oda/koltuk/aşama geri geldi, rol varsayılan kapalı oldu. [Kanıt](qa-review/live-6-after-reload.txt).
- **Davet:** lobi kodu kopyalandı (`Kopyalandı` durumu); botlar kendi kimlikleriyle katıldı. `------` geçersiz daveti Türkçe hata verdi. Geçerli 7p davet bağlantısından **aynı QA hesabıyla** katılmak, aynı bitmiş oyuna döndürdü; yeni bir tarayıcı kimliğiyle katılım UI'si olarak sayılmaz. [Geçersiz](qa-review/invalid-invite.txt), [yeniden katılım](qa-review/invite-rejoin-result.txt).
- **Yükleme:** `Oda açılıyor…`, `Odaya bağlanılıyor…`, `Gönderiliyor…` ve ilgili disabled durumları görüldü. Tek başına çift tıklama gözlemi ağın bütün idempotency garantisini kanıtlamaz.
- **Bağlantı:** araçta kontrollü offline veya gerçek background capability yok. Diğer QA sekmelerine geçmek document.visibilityState'i `hidden` yapmadı; hepsi `visible` döndü. Dolayısıyla gerçek arka plan testi geçmiş sayılmadı. Kullanıcının paylaşılan ağını/sunucusunu kesmedim.
- **Sentetik bağlantı:** kendi QA ekranında aynı mevcut GameScreen'e disconnected verildi; veto kabul/ret disabled oldu, bağlantı geri verildiğinde etkinleşti. [Kanıt](qa-review/fixture-disconnected.txt). Bu fiziksel ağ kopması/resubscription testi değildir.
- **Nadir aşamalar:** UI fixture üzerinden veto isteği/kabul/ret, parti inceleme ve deste bakma sonuçları kontrol edildi. Fixture Gönder yalnız yerel seçimi kaydeder; motor ilerletmez. Veto kabul/ret ve liberal politika zaferinin kural doğrulaması mevcut hedefli motor testlerinde ayrıca geçti. **Veto kabulü canlı iki oyunda görülmedi.**
- **Hedefli otomatik testler:** engine.guards + engine.legislative **16/16**; cue + prototype **32/32**, toplam **48 test geçti**. [Motor logu](qa-review/rare-engine-tests.log), [sahne logu](qa-review/scene-targeted-tests.log). Bu oturumda bütün 183 test, build veya typecheck tekrar çalıştırılmadı; ürün kaynak değişikliği yoktu.
- **Konsol:** 7p canlı, prototip ve X03 kayıtlarında runtime error yok. THREE.Clock deprecation uyarısı var; prototipte koltuk sayısı değişimlerinde tekrarlanıyor. [Canlı](qa-review/live7-console.json), [prototip](qa-review/prototype-console.json), [efekt](qa-review/effects-console.json). İlk QA paneli kurulumunda React preamble eksikti; yalnız kendi QA HTML'inde düzeltildi ve tekrar açıldı. Bu kurulum hatası ürün bulgusu değildir. Rematch hatasının UI kanıtı ayrı tutuldu.
- **Performans:** 10p prototip, 1440×1000, yakın kart, baş hareketi kapalı: standard **89.472 üçgen / 267 çizim**, low **34.398 / 136**. [Standard](qa-review/prototype-performance-standard.json), [low](qa-review/prototype-performance-low.json). Bunlar renderer tanılaması; GPU profili veya FPS ölçümü değildir. Görünür nesne/kamera farkı nedeniyle önceki rapor sayılarıyla doğrudan kıyaslanmamalı. Yaklaşık 120 çizim hedefi bu örnekte low'da da aşılmış; X04 optimizasyon girdisi.
- **Yapılmadı:** gerçek çok insanlı oyun gecesi, gerçek telefon/dokunmatik, iki fiziksel cihaz, Safari, işitilebilir ses dengesi/autoplay karşılaştırması, kontrollü fiziksel offline/online, gerçek gizli sekme, doğal token expiry, uzun süre bellek/GPU/FPS, tam ekran okuyucu denetimi, ağ paketlerinde kapsamlı gizlilik/DB ledger incelemesi, Vercel üretim testi. Önceki Claude/Codex raporlarındaki bu başlıklar bu oturumda yapılmış gibi aktarılmadı.

## 7. Tekrar çalıştırma ve sonraki düzeltme sırası

QA yardımcı ekranı: `http://localhost:5173/@fs<proje-klasörü>/docs/qa/codex/qa-review/ui-fixtures.html`. Mevcut GameScreen/scene bileşenlerini yetkili sentetik fixture ile çizer; oyun API'si/oturum/DB yazımı içermez. [HTML](qa-review/ui-fixtures.html), [kontrol kaynağı](qa-review/ui-fixtures.jsx). Seçim kaydı motor sonucu değildir.

1. **Claude:** QA-R01 doğrudan rematch geçişi; beraberinde QA-R04 hata çözümlemesi. Aynı uzak ortamda tamamlanmış oyundan doğrudan yeni oyuna dönüşü tekrar doğrula.
2. **Codex + Claude:** QA-R02 gizleme niyeti ve QA-R03 yetki/onay açıklığı. Özellikle `Kimliği kapat` sonrası DOM'da özel panelin kapalı kalmasını ve infaz düğmesinin sonucu söylemesini kontrol et.
3. **Codex:** QA-R05/R06 okunabilirlik ve el kavrama; renderer bütçesi. **Claude:** QA-R07 sonuç ekranı dili. Ardından gerçek arkadaş grubu/telefon/ses/bağlantı kabulü ve ayrı F01 yaşam döngüsü kararı.

**Teslim sınırı:** Bu görev bağımsız test ve devir olarak tamamlandı; bulgular düzeltilmedi. F00/F01/F04/F05 veya yayın onayı verilmedi. Prototipin henüz canlıya bağlı olmaması hata sayılmadı.
