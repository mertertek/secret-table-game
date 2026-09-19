# QA düzeltmeleri — Codex / R02, R06, R05

9 Eylül 2026. Kaynak rapor: [QA-REVIEW.md](<proje-klasörü>/docs/qa/codex/QA-REVIEW.md). Eski rapor/kanıtlar korunuyor. Yalnız scene kaynakları ve Codex belgeleri/QA yardımcıları değiştirildi. Uygulama/API/Supabase/ortak tip/bağımlılık dosyaları Codex tarafından düzenlenmedi.

| Bulgu | Teslim | Kalan |
| --- | --- | --- |
| QA-R02 | Kontrollü aç/kapa yönü ve ortak HTML/3D görünürlüğü; ağsız gerçek GameScreen ile iki çapraz yol geçti | Claude: yönsüz eski niyetin açma anlamını koruma; gerçek oda üzerinden çapraz tekrar |
| QA-R06 | Ortak alt kenarda yelpaze, başparmak karşı basıncı, arkadan parmak desteği, kartı izleyen bilek; kalan kartlar sol elde bağlı | Gerçek dokunmatik/uzun kullanım ve her karede bütün mesh temaslarının fiziksel denetimi yapılmadı |
| QA-R05 | Ayrı tek kart / tahta yakın görünümü; kartlar arasında yalnız kamera gezinmesi; 390×844 okunurluk ve 5–10 yerleşim | Claude: yatay küçük ekranda 45vh dış kapsayıcı yüksekliği ve HTML bilgi desteği |

Prototip canlı TableScene'e bağlanmadı. F00 arkadaş grubu kabulü hâlâ açık. Tam X04, 950/1650 ms yaşam döngüsü kararı ve Vercel bu teslimle kapanmıyor.

## Önizlemeler

- [Bağımsız el/kamera prototipi](http://127.0.0.1:5174/@fs<proje-klasörü>/docs/qa/codex/first-person.html)
- [Güncel TableScene + gerçek HTML bileşenleri, ağsız QA](http://127.0.0.1:5174/@fs<proje-klasörü>/docs/qa/codex/qa-fixes/ui-fixtures.html)

İkinci sayfanın room nesnesi sentetiktir; GameScreen/SceneFrame/RolePanel/TableScene gerçek ürün bileşenleridir. Hook/API/oturum/DB çalıştırmaz. İnceleme seçenekleri fixture seçicisinden değişir. Seçim kaydı motor kabulü değildir. İki sayfa da mevcut 5174 sunucusunu kullanır; uygulama rotası eklenmedi.

## QA-R02 — kapatmanın yönü

**Önce:** TableScene.toggleRole her iki yönde yönsüz `inspect_own_role` gönderiyordu. Uygulama bu niyeti açma olarak alıyordu; HTML Gizle'den sonra 3D kapatma paneli tekrar açıyordu.

**Sonra:** CODEX-012 ile tek görünürlük kaynağı önerildi. Claude'un CLAUDE-005 alternatifine Codex ACK verdi: Claude'un eklediği isteğe bağlı `rolePanelOpen` prop'u sahnede okunuyor; kontrollü sahne açıkça `{type:'inspect_own_role', open: !roleOpen}` gönderiyor. HTML Gizle dış değeri kapatınca 3D yüz de aynı render'da kapanıyor. Sahne güncel yetkili rolü kullanıyor; eski rol kopyası saklamıyor.

Prop verilmezse bağımsız sahne yerel aç/kapa davranışını koruyor: yalnız açılışta eski inspect isteği, kapanışta **hiç niyet yok**. Kamera veya kimlik görünürlüğü bir oyun hamlesi/rol onayı üretmiyor.

| Önce: kimlik kapalı, HTML özel bilgi yeniden açık | Sonra: iki sunum da kapalı |
| --- | --- |
| ![R02 önce](<proje-klasörü>/docs/qa/codex/qa-fixes/r02-before.jpg) | ![R02 sonra](<proje-klasörü>/docs/qa/codex/qa-fixes/r02-after.jpg) |

Ağsız gerçek UI doğrulaması: scene aç → HTML Gizle → HTML gövdesi yok, scene “Kimliği aç”; HTML Göster → scene kapat → HTML gövdesi yok, “Göster”. [Yönlü niyet kayıtları](<proje-klasörü>/docs/qa/codex/qa-fixes/role-cross-controls.json), [birinci yol](<proje-klasörü>/docs/qa/codex/qa-fixes/r02-scene-open-html-hide.txt), [ikinci yol](<proje-klasörü>/docs/qa/codex/qa-fixes/r02-html-open-scene-close.txt). İlk yol yalnız `inspect_own_role:true`; ikinci yol sonunda `inspect_own_role:false`. Gizleme başka sunumu açmadı.

**Claude'a açık geri uyum notu:** son okunan app kodu `intent.open ?? !r.rolePanelOpen` kullanıyor. Yönsüz eski inspect'in açma anlamını korumak için **`intent.open ?? true`** olmalı. Yeni scene iki yönü açık verdiğinden gözlenen çapraz yollar bu eksikten etkilenmiyor. QA helper eski açma anlamını koruyor. Ürün hook'unu bu oturumda değiştirmedim; uzak gerçek oturum testi de yapmadım.

## QA-R06 — kart desteği

Kartlar artık ayrı yatay aralıklarla havada sıralanmıyor: her kart ortak alt kenar çevresinde açılıyor. Alt tutuş noktaları üç kartta 5 cm'den az bir alanda kalıyor; seçilen kart ayrılınca diğerleri aynı sol el desteğini koruyor. Sol avuç arkasındaki parmak pedleri paketi destekliyor, başparmak ön yüzden karşılık veriyor. Sağ el dinleniyor, seçimde kartı alıp taşıyor ve tepside bırakıyor.

Yeni `grip.ts` kart düzlemindeki bilek/tutuş noktalarını aynı dönüşümle hesaplıyor. Çekmenin kaldırma bölümünde bilek kart paketini izliyor. Seçimden bırakmaya geçiş, 1/2/3 kart için ekrandaki seçili kart konumundan başlıyor. Son pozda sağ el masaya dönüyor; kalan elin başlangıç/bitiş arasında yer değiştirmesi yok. Hareket süreleri değişmedi.

| Önce: kalan kartlar arasında boşluk, yayvan kavrama | Sonra: ortak tutuş ve ön başparmak desteği |
| --- | --- |
| ![R06 önce](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-before-place-settled.jpg) | ![R06 sonra](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-after-place-settled.jpg) |

[Tutma önce](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-before-hold.jpg), [tutma sonra](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-after-hold.jpg), [seçilen kart](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-after-selected.jpg), [mobil tutuş](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-mobile-hold.jpg), [844×390 / 10. yerel koltuk](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-landscape-seat10.jpg).

### Ara pozların gerçek tarayıcı kontrolü

| An | Görüntü |
| --- | --- |
| Kart verme alanına erişme | [Koltuktan alma](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-source-draw-3.jpg) |
| Paket kaldırılırken destek | [Koltuktan kaldırma](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-source-draw-9.jpg) |
| Yakın görünümde ele dönüş | [Çekme ara pozu](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-after-draw-11.jpg) |
| Seçili kartı taşıma | [Bırakma ortası](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-after-place-4.jpg) |
| Tepsiye yaklaşma ve bırakma | [Bırakma sonuna yakın](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-after-place-8.jpg) |
| Kalan elde son poz | [Yerleşmiş kalan el](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-after-place-settled.jpg) |

Kareler gerçek oynatma sırasında alındı. [Çekme kayıtları](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-after-draw-frames.json), [bırakma kayıtları](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-after-place-frames.json), [kaynak alanı kayıtları](<proje-klasörü>/docs/qa/codex/qa-fixes/r06-source-draw-frames.json). DOM ilerleme değeri screenshot çağrısının hemen ardından okunur; görüntüyle birebir aynı frame zamanı iddia edilmez. Yakın kart kamerasında verme/tepsi uçları kadraj kenarına taşabildiği için kaynak alanı ayrıca koltuktan bakışla kontrol edildi. Görsel destek iyileşti; tam IK/çarpışma çözücüsü eklenmedi.

## QA-R05 — küçük ekran incelemesi

Genel kamera aynı yerleşim formülünü kullanır. Masa geneli oyuncuları/oyun durumunu gösterir; kartı okumak için “Özel alanı incele”, tahta için “Tahtayı incele” kullanılır. Özel alanda bir karta odaklanılır; ok düğmeleri yalnız kamerayı gezdirir. Kartın kendisine tıklamak mevcut seçim davranışını korur. İnceleme bir hamle onayı değildir.

Tahta görünümünde liberal/faşist tahta ayrı hedeflenir; HTML sayaçları yakın kontrolün yanında kalır. Sahne yeni yetki/oyun kuralı hesaplamaz. Düğmeler telefonda 44 px; mobil kimlik görünümünde gereksiz tekrar eden yakınlık düğmesi kaldırılarak kartın üstünü örten ikinci satır giderildi. Azaltılmış harekette kamera anında hedefe gider.

| Önce: özel alan hâlâ masanın küçük parçası | Sonra: tek kart odağı |
| --- | --- |
| ![R05 önce](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-before-private.jpg) | ![R05 sonra](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-after-private.jpg) |

[Tahta yakın görünümü](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-after-board.jpg), [kimlik yakın görünümü](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-after-role.jpg). 390×844 browser viewport, standart kalite. Kart metni ve simge belirgin büyüdü; küçük marka/yardımcı yazıların genel kadrajda okunması amaçlanmadı.

5–10 kişi genel kadrajı görüntüden incelendi: [5](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-overview-5.jpg), [6](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-overview-6.jpg), [7](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-overview-7.jpg), [8](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-overview-8.jpg), [9](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-overview-9.jpg), [10](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-overview-10.jpg). İsimliklerde yeni örtüşme/koltuk kaybı yok. [Yerleşim kayıtları](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-layout-checks.json): viewport 390, scrollbar nedeniyle içerik 375 px; yatay taşma yok.

[İnceleme niyet kaydı](<proje-klasörü>/docs/qa/codex/qa-fixes/camera-no-intent.json): özel alana gir → sonraki/sonraki/önceki → tahta → liberal; **intents=[]**, seçim **null**. Oyun eylemi tetiklenmedi.

**Claude'a kalan somut HTML işi (CODEX-013):** 844×390 yatay ekranda uygulamanın `.game__body {grid-template-rows:45vh auto}` kuralı sahneye yaklaşık **176 px** veriyor; yakın rol kartı yine küçük kalıyor. [Sınırın görüntüsü](<proje-klasörü>/docs/qa/codex/qa-fixes/r05-landscape-role.jpg). Yatay küçük ekran için iki sütunla sahneye yeterli yükseklik veya en az 280–300 px sahne satırı gerekli. Dış kapsayıcıyı scene paketinden değiştirmedim. Ayrıca politika/etkin yetki adı ve sonucu ilgili HTML kontrolün yanında kalmalı; minik görev alt yazısına dayanılmamalı. Portre yakın görünümü doğrulandı; bu yatay HTML sınırı kapalı sayılmıyor.

## Performans — aynı koşulda renderer karşılaştırması

Aynı in-app browser ve bilgisayar; viewport **1440×1000**, canvas **1150×751**, DPR **1**, **10 oyuncu / 1. yerel koltuk**, yakın kart kamerası **(0,0.56,1.92), FOV49**, üç kart tutuşu, sentetik başlar kapalı, hareket azaltma kapalı, yerleşmiş hareket. Kalite dışındaki koşullar aynı.

| Kalite | Önce üçgen / çizim | Sonra üçgen / çizim |
| --- | --- | --- |
| Standard | 89.472 / 267 | 89.472 / 267 |
| Low | 34.398 / 136 | 34.398 / 136 |

[Önce standard](<proje-klasörü>/docs/qa/codex/qa-fixes/performance-before-standard.json), [sonra standard](<proje-klasörü>/docs/qa/codex/qa-fixes/performance-after-standard.json), [önce low](<proje-klasörü>/docs/qa/codex/qa-fixes/performance-before-low.json), [sonra low](<proje-klasörü>/docs/qa/codex/qa-fixes/performance-after-low.json). Geometri/draw sayısı artmadı; bu **FPS, GPU süresi veya performansın değişmediği iddiası değildir**. Kamerası farklı R05 yakın görüntülerinin sayılarını eski genel görünümle hız karşılaştırmasına dönüştürmedim. Yaklaşık 120 draw hedefi low'da da aşılmaya devam ediyor; X04 bu göreve genişletilmedi.

## Otomatik ve etkileşim doğrulaması

- `pnpm typecheck`: **6/6** geçti. [Log](<proje-klasörü>/docs/qa/codex/qa-fixes/typecheck.log).
- `pnpm test`: **208/208** geçti — contracts 6, fixtures 28, game-core 65, scene 62, server 33, web 14. Claude'un aynı turdaki +13 testi toplamda dahil; bu değişikliğin scene test artışı **+12**. [Log](<proje-klasörü>/docs/qa/codex/qa-fixes/tests.log).
- `pnpm build`: geçti; mevcut >500 kB chunk uyarısı sürüyor. [Log](<proje-klasörü>/docs/qa/codex/qa-fixes/build.log).
- Kamera testi kart/tahta köşelerinin mobil/yatay/masaüstü kadrajında pay bırakmasını doğruluyor. İlk testte dar tahta kenarı yakalandı; pay artırıldı. Menü sadeleştirmesindeki TypeScript daraltma hatası giderildi; final kontroller yeşil.
- Prototip sürükleme: seçim **0→0**, sürükleme **4→5**; gönderilen hamle 0. [Kayıt](<proje-klasörü>/docs/qa/codex/qa-fixes/prototype-drag.json).
- Genel görünüm/kamera uçuşunda özel yüz **0**; özel veri kaldırılınca **0**; reduced-motion çekme son pozda. [Uçuş](<proje-klasörü>/docs/qa/codex/qa-fixes/prototype-privacy-transition.json), [özel veri temizliği](<proje-klasörü>/docs/qa/codex/qa-fixes/prototype-private-removed.json), [reduced](<proje-klasörü>/docs/qa/codex/qa-fixes/prototype-reduced.json).
- Geliştirme sırasında QA HTML'nin HMR ile ikinci root açma uyarısı görüldü; yalnız iki dev/QA girişine unmount temizliği eklendi. İki önizlemenin temiz açılışında **runtime error 0**, yalnız mevcut THREE.Clock deprecation uyarısı var. [Prototip temiz açılış](qa-fixes/prototype-fresh-console.json), [UI temiz açılış](qa-fixes/ui-fresh-console.json). Önceki uyarılı loglar silinmedi.

**Yapılmadı:** gerçek telefon/dokunmatik, Safari/iki fiziksel cihaz, FPS/GPU profili, uzun süre bellek, gerçek arkadaş grubu ve uzak oda çapraz rol testi; her parmak/mesh için her karede çarpışma doğrulaması. Bu rapor bu kontrolleri geçmiş saymaz.

## Claude entegrasyon devri

1. **CLAUDE-005 kabul edildi ve scene uygulandı.** `rolePanelOpen` prop'u tek kaynak; iki yönde açık `open` niyeti. App'te yönsüz `inspect_own_role` için `?? true` geri uyumu koru; gerçek odada çapraz iki kontrolü tekrar doğrula.
2. **CODEX-013:** yatay küçük ekran dış sahne yüksekliği + okunur HTML yetki/özel bilgi hiyerarşisi. Önizleme rotası istemiyorum; QA HTML mevcut Vite üzerinden çalışıyor.
3. **CODEX-011/r2 / CLAUDE-004 açık.** 950 ms drain / 1650 ms yerel hareket ömrü için ortak karar verilmedi. Süreler, CueLedger ve ortak yaşam döngüsü değiştirilmedi; animasyon oyun hamlesini bekletmez. Canlı birinci şahıs bağlantısı, F00 kabulü ve Vercel ayrı kullanıcı ataması gerektirir.
