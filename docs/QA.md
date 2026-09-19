# Doğrulama ve kabul planı

Sahip: Claude; görsel sonuçlar Codex tarafından kendi QA dizinine yazılır.

## Güncel durum ve kullanıcı kararı — 2026-10 (C06 → J01)

- Statik + entegrasyon: `pnpm typecheck` 6/6, `pnpm test` 163, `pnpm build` temiz.
- Uzak Supabase (proje ref'i yalnız yerel `.env`'de): migration 0001–0005 uygulandı ve
  izin/gizlilik SQL + REST ile doğrulandı; anonim giriş açıldı. Kanıt: `docs/qa/claude/C06.md`.
- Canlı kısmi doğrulama: 7 bağımsız gerçek anon oturumu ile lobi/hazır/başlat/**7
  eşzamanlı oy (CAS kaybı yok)** + bir yasama turu; Realtime kanal (üye/üye-değil/sinyal);
  `offline`/`online`, token yenileme, sayfa yenileme. **`game_over`'a kadar oynama YAPILMADI.**
- **Kullanıcı kararı:** Vercel kurulumu/deployu uygulama tamamlanana kadar ertelendi.
  Sıradaki iş: yerel uygulama + gerçek uzak Supabase ile **6 ve 7 bağımsız oturumda
  `game_over`'a kadar** tam oyun, yeniden bağlanma ve animasyon zamanlaması kontrolleri.
- **Raporlama ayrımı:** otomatik/script-bot testleri ile gerçek arkadaş grubu oyun gecesi
  AYRI raporlanır. Bot akışı bir kanıttır; §1 "Gerçek oyun gecesi" satırı (6 ve 7 kişilik
  iki tam insan oyunu) ayrıca zorunludur ve otomatik testle karşılanmış sayılmaz.

## 1. Kontrol katmanları

| Katman | Sorumlu | Kanıt |
| --- | --- | --- |
| Tip kontrolü ve derleme | Claude; Codex kendi değişikliğini doğrular | Gerçek komut ve sonuç |
| Oyun motoru birim testleri | Claude | Girdi → beklenen kural sonucu testleri |
| Oyuncuya özel veri filtresi | Claude | Farklı alıcılara gönderilen seri hale getirilmiş mesaj kontrolleri |
| Oda ve komut entegrasyonu | Claude | Çoklu istemci, tekrar komut, eski aşama ve geri dönüş |
| Supabase ve Vercel sınırı | Claude | RLS/RPC izinleri, atomik komut kaydı, kaçan bildirim, farklı Function örnekleri |
| Tarayıcı akışı | Claude | Birbirinden bağımsız tarayıcı oturumlarıyla oyun adımları |
| Görsel ve performans | Codex | Görüntü, cihaz/tarayıcı, çözünürlük ve ölçüm özeti |
| Gerçek oyun gecesi | Kullanıcı ve arkadaşları; ajanlar sorunları giderir | 6 ve 7 kişilik iki tam oyun |

Görsel kozmetik değişikliklere uygulamayı taklit eden birim testleri yazılmaz. Kurallar, gizlilik ve yeniden bağlanma gibi hata maliyeti olan davranışlar otomatik test edilir.

## 2. Kural kapsamı

Claude C02'de [resmî kitapçığın](https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf) ilgili bölümünü her davranış grubuyla eşler. Aşağıdaki başlıklar kapsam kontrolüdür; kural metninin yerine geçmez:

- [ ] 5–10 oyuncu için rol dağılımı, başlangıç bilgileri ve tahta varyantı.
- [ ] Aday uygunluğu, görev kısıtlamaları ve elenen oyuncularda sıra ilerlemesi.
- [ ] Oyların gizliliği, eşitlik, seçim sonucu ve seçim sayacı.
- [ ] Kart çekme, özel eller, atılan kartlar, yasalaşma ve destenin yenilenmesi.
- [ ] Bütün zafer yolları ve sonuç kontrolünün doğru aşamada yapılması.
- [ ] Özel seçim, parti inceleme, deste inceleme ve eleme yetkileri.
- [ ] Veto isteği, kabul/ret ve sonraki tur davranışı.
- [ ] Olağan dışı seçim sayacı sonucu ile normal yasama sonucunun ayrılması.

Test girdilerini sabitlemek için rastgelelik oyun motoruna enjekte edilir. Üretimde güvenli sunucu rastgeleliği kullanılır; test tohumu oyuncuya gönderilmez. Destede/elde/tahtada/atıkta bulunan kartların toplamı her geçişte korunur. Bitmiş oyunda yeni hamle durum değiştirmez.

## 3. Gizli bilgi testleri

Yalnızca ekranda görünmemesini kontrol etmek yeterli değildir. Bir liberal oyuncu, yetkili özel kart sahibi, başlangıç bilgisi olan oyuncu ve elenen oyuncu için sunucudan çıkan **gerçek mesaj içerikleri** incelenir.

- [ ] Diğer oyuncuların yetkisiz rol/parti bilgisi, el içeriği, deste sırası ve açıklanmamış oyları mesajda bulunmuyor.
- [ ] 6 ve 7 kişi başlangıç bilgi farkı için alıcı bazında regresyon testi var.
- [ ] İnceleme sonucu yalnızca doğru alıcıya gidiyor; parti bilgisi yanlışlıkla tam rol olmuyor.
- [ ] Elenen oyuncu yeni gizli bilgi almıyor. Oda sahibi olmak bilgi ayrıcalığı vermiyor.
- [ ] Açık geçmiş, özel olaylar, animasyon payload'ları ve hata mesajları aynı filtreyi koruyor.
- [ ] Tekrar bağlanma tam görünümü gizli alanları yanlış alıcıya açmıyor.
- [ ] Supabase access/refresh token'ı ve server secret anahtarı başka oyuncuların görünümünde, URL'de veya loglarda yok.
- [ ] Tarayıcıya açık anahtarla gizli tabloya veya sunucu commit RPC'sine erişilemiyor.
- [ ] Özel Realtime kanalına üyelik gerekli; kanal payload'ı yalnız oda kimliği ve sürüm içeriyor.
- [ ] Oyuncu görünümü API'si cache/CDN üzerinden başka kullanıcıya sızmıyor.
- [ ] Test/örnek veri araçları üretim yolundan erişilemiyor.

Salt bir rol kelimesini metinde aramak yerine şemanın izin verilen alanları ve değerlerinin hangi oyuncuya ait olduğu doğrulanır.

## 4. Oda ve komut dayanıklılığı

- [ ] Oda kodu, dolu oda, başlamış oyun ve geçersiz isim akışları.
- [ ] Hazır olmayan / yeterli oyuncusu olmayan lobide başlangıç engeli.
- [ ] Aynı komutun iki kez gönderilmesi tek hamle oluşturuyor.
- [ ] Eski oyun, eski aşama, başka oyuncunun aksiyon kimliği ve sahte seçenek reddediliyor.
- [ ] Aynı aşamada farklı oyuncuların eşzamanlı oyları kaybolmuyor.
- [ ] Oy kullandıktan sonra bağlantı kopması ikinci oy oluşturmuyor.
- [ ] Aynı tarayıcı yenilenince rol, koltuk ve mevcut aşama korunuyor.
- [ ] Başkasının kimliğiyle veya yalnız isimle koltuk devralınamıyor.
- [ ] Aynı Supabase kullanıcısıyla iki sekmede belirlenen tek etkin kumanda oturumu kuralı uygulanıyor.
- [ ] Oda sahibi kopması, bütün oyuncuların kopması ve boş oda temizliği.
- [ ] Süre dolması anlaşılır; kullanıcı yanlışlıkla başka bir koltuğa eklenmiyor.
- [ ] Function örneği değiştiğinde oyun Supabase'ten devam ediyor; oda gerçekten sona ermişse anlaşılır kapanış var.
- [ ] DB commit sonrası HTTP yanıtı kaybolup komut tekrarlandığında etki yinelenmiyor.
- [ ] Realtime bildirimi kaybolduğunda abonelik/HTTP yenilemesi doğru sürümü getiriyor.
- [ ] Eşzamanlı hamlelerin CAS çatışması yeni durumdan tekrar değerlendirilerek çözülüyor.
- [ ] Supabase token yenileme, DB erişim hatası ve geçici servis kesintisi doğru ele alınıyor.
- [ ] Mesaj boyutu/hız sınırları ve izin verilen origin yapılandırması doğrulanmış.

## 5. Görsel matris

Codex X01–X04 boyunca:

| Boyut / durum | Beklenen kontrol |
| --- | --- |
| 1920×1080 ve 1366×768 | 6/10 koltuk, isimlikler, tahta, alt kontrol alanı |
| 5/7/8/9 oyuncu | Koltuk aralıkları ve yerel koltuğun konumu |
| Küçük yatay ekran | Kart ve HTML panelinin kullanılabilirliği |
| Uzun isim / Türkçe karakterler | Taşma, kırpma, eksik glif |
| Kart yakın planı | Ön/arka, kenar, metin ve tıklama alanı |
| Oy açıklama / yasalaşma | Aynı olayın tekrarlanmaması, doğru son konum |
| Kesinti / arka sekmeden dönüş | Eski animasyon birikmemesi |
| Düşük kalite / azaltılmış hareket | Kurallar ve bilgi okunabilirliğinin korunması |
| WebGL / varlık yükleme hatası | Kullanılabilir hata görünümü |

Ölçümler gerçek donanım, tarayıcı, çözünürlük, grafik seviyesi ve FPS özetini içerir. Yalnız güçlü bir bilgisayarda akıcı olması düşük donanım kabulü değildir; test edilmeyen donanım açıkça kaydedilir.

## 6. Erişilebilirlik ve kullanılabilirlik

- [ ] Bütün oyun eylemleri HTML düğmeleriyle de kullanılabiliyor.
- [ ] Klavye odağı görünür; rol/kart paneli açılıp kapanınca odak uygun yere dönüyor.
- [ ] Oyun durumu ve sıra bilgisi yalnız ses veya renk ile anlatılmıyor.
- [ ] Bağlantı kesildiğinde kullanılamayan düğmeler yanlış başarı hissi vermiyor.
- [ ] Oy veya kart göndermeden önce kullanıcı neyi seçtiğini anlayabiliyor.
- [ ] Sessiz mod ve hareket azaltma yeniden girişte korunuyor.

## 7. Yayın kabulü

- [ ] Derleme ve sunucu başlatma talimatları temiz kurulumla doğrulandı.
- [ ] Vercel HTTPS API, Supabase özel Realtime ve doğrudan oda URL'sini açma/yenileme çalışıyor.
- [ ] Supabase migration, RLS/RPC izinleri, anonim giriş ayarı ve Vercel ortam değişkenleri hedef ortamda doğrulandı.
- [ ] Preview testleri production verisini değiştirmiyor; tarayıcı paketinde sunucu secret anahtarı yok.
- [ ] En az bir oyuncu farklı internet bağlantısından katıldı.
- [ ] 6 kişilik oyun tamamlandı; ardından 7 kişilik yeni oyun tamamlandı.
- [ ] Geri dönüş ve oyun sonundan lobiye dönme yayın ortamında denendi.
- [ ] Bilinen sınırlar, veri durumu/migration uyumluluğu ve son Vercel sürümü kayıtlı.

## 8. Hata ve rapor biçimi

Hata kaydı: kimlik, görev, tekrar adımları, beklenen/gerçek sonuç, önem, sorumlu, kanıt yolu. Gizli gerçek rol/anahtarlar paylaşılacak hata kaydına kopyalanmaz; sentetik örnekle yeniden üretim tercih edilir.

Teslim raporu en fazla bir kısa sayfa: geçen kontroller, yapılmayan kontroller, açık engeller ve görsel dosyalar. Yer: `docs/qa/codex/<görev>.md` veya `docs/qa/claude/<görev>.md`. Gerekmedikçe başarılı kontroller tekrar çalıştırılmaz; değişen davranış ve ilgili regresyonlara odaklanılır.
