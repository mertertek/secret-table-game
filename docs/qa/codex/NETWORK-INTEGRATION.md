# NETWORK-001 — baş yönü ağı

9 Eylül 2026. Kullanıcı COORD-006 ile Claude'un dar ağ takip görevini Codex ajanına atadı. Scene/immersive/UI/deploy değiştirilmedi.

## Sonuç

Uzak `<PROJECT_REF>` üzerinde gerçek üyeler baş yönünü gönderip alabiliyor. Başka oda üyesinin başka koltuk kanalına yazması ve oyun sürüm kanalına istemci yayını reddedildi. İki izole gerçek Chrome context'inde uygulamanın transport modülü, token yenilemesi ve gerçek offline/online toparlama doğrulandı. Tam oyun/karakter animasyonu/Pointer Lock kabulü değildir.

## Yetkilendirme ve protokol

- Private topic: `room:<roomId>:viewpoint:<gameId>:<playerId>`.
- `0007_viewpoint_channels.sql`: `can_use_viewpoint_topic` SECURITY DEFINER, boş search_path; SELECT aktif oda üyesine, INSERT yalnız `auth.uid()` ile aynı `room_members.player_id` actor'üne. Güncel gameId ve in_game oda şartı vardır. İstemcilere gizli tablo GRANT eklenmedi.
- Oyun `room:<id>` topic'i yalnız önceki read politikasıyla kalır; yeni INSERT politikası bu adı eşlemez. Public/private aynı topic namespace'i birleştirilmez.
- Payload yalnız `epoch,seq,yaw,pitch`. Fazladan actor/private alan, NaN/Infinity, aralık dışı açı, güvenli tamsayı olmayan sıra ve tekrar/geriye giden paket reddedilir. Actor ve seat receiver'da yetkili topic + HTTP roster'dan türetilir.
- `HeadViewpoint` dış shape aynı. `t` artık alıcı yerel epoch-ms alım damgasıdır; sender clock bayatlık kaynağı değildir. Ağ epoch/seq sahne API'sine taşınmaz. Scene mevcut t→performance.now adaptörüyle uyumlu; scene dosyası değişmedi.
- Gönderim ancak joined private channel üzerinden; offline HTTP broadcast fallback kullanılmaz. Aynı roster/revision her seferinde rejoin etmez; oyun değişimi generation ile eski callback'leri iptal eder. Hidden/offline/stop kanalları kaldırır, dönüşte yeni epoch; kaçan baş örnekleri tekrar oynatılmaz. Token yenileme seri, boş token socket auth'unu silemez.
- Gönderim/eşik/throttle app'te; kanal da savunma olarak hız sınırı uygular. Hız sınırı içinde geri dönülen eski pozun pending timer'ı iptal edilir. Eski game/hidden/bağlantı/bayat pending gönderimi reddedilir.
- Hata sonucu/timed out görsel bağlantı açıklamasına dönüşür; HTTP oyunun bağlantı kapısına bağlanmaz. Baş kanalı sorunu temel oyunu durdurmaz.

Supabase yetkileri join/token yenilemede hesaplayıp cache'ler; üyeliğin silinmesi açık socket'i anında fiziksel olarak iptal etmiş sayılmaz. Yeni game topic eski oyunu ayırır; alıcı yeni authoritative roster dışında actor kabul etmez. Bu genel Supabase sınırı belgelenmiştir; her örnekte Function/DB yazımı eklenmedi. [Resmî yetkilendirme belgesi](https://supabase.com/docs/guides/realtime/authorization), [private kanal kavramı](https://supabase.com/docs/guides/realtime/concepts).

## A — gerçek Node WebSocket oturumları

Kanıt: `network-integration/remote-results.json`; yeniden çalıştırılabilir `remote.mjs` (anahtarlar yalnız .env'den belleğe).

Üç ayrı gerçek Anonymous Auth hesabı: A/B üye, C dışarıda. Bu test için yalnız kendi yeni odası `12ff27fe-b695-4140-b7ba-a439a12cddc4` iki kişilik **transport fixture** olarak in_game/gameId aldı; core game state yaratılmadı. Gerçek oyun tamamlandı iddiası yok, mevcut kullanıcı odası değiştirilmedi.

Geçenler:
- A/B kendi ve karşı actor private topic'lerine joined; iki yönlü ack + teslim.
- C üye değil: CHANNEL_ERROR.
- B, A topic'ine yazamadı: ack `timed out`, teslim sıfır. Salt subscribe başarısı write yetkisi anlamına gelmez.
- A revision topic'ini okuyabildi, istemci gönderimi başarısız.
- Gerçek refreshSession + setAuth sonrası yayın teslimi.
- Sender channel kaldırma/rejoin sonrası yayın teslimi.
- Beş örnek gönderildi, beşi teslim edildi (4656 ms; bekleme/RTT dahil); tek JSON örneği 54 byte (WebSocket/TLS çerçevesi hariç).
- Odaya ait game_states ve processed_commands sayıları baş trafiğinden önce/sonra aynı (0/0); DB'ye bakış örneği kaydedilmedi.

## B — iki gerçek tarayıcı context'i

Kanıt: `network-integration/browser-results.json`; `browser.mjs`. Sistem Google Chrome, Playwright, headless; iki ayrı context/localStorage/anon kimlik. Gerçek Vite `/src/multiplayer/viewpointChannel.ts` ve gerçek Supabase private WebSocket kullanıldı. DOM sentetik olaylarla internet bağlantısı varmış gibi gösterilmedi.

- A→B / B→A actor kimliğiyle teslim geçti.
- Gerçek token yenileme + uygulama reauth sonrası teslim geçti.
- Chrome network emulation offline iken gönderim bastırıldı; online dönüşte rejoin ve teslim geçti.
- stop sonrası gönderim reddi geçti; final koşumda iki istemcide transport issue sayısı 0/0.
- İlk tarayıcı denemesi signup HTTP 0 ile durdu; ikinci teşhisli koşum geçti. İlk hata gizlenerek başarı sayılmadı.
- Fixture `c09462cf-52a5-4c82-a118-1d73f9cb3cc6`, iki kişilik transport odası. Fiziksel iki cihaz, gerçek başın görsel hareketi ve insan testi yapılmadı.

## C — yerel kontroller

- Web TypeScript kontrolü geçti.
- 15 yeni ağ regresyonu + 5 mevcut viewpoint sözleşme testi geçti.
- Tüm web suite: 7 dosya, **53 test** geçti (mevcut immersive/rol kontrolleri dahil).
- Vite üretim build geçti (731 module); mevcut >500 kB chunk uyarısı devam ediyor. Bu bir FPS ölçümü değil.
- Hidden sekme, eski scope callback, sequence/epoch, forged actor payload, aralık/sonluluk, no-send-before-join, geç token, send hatası ve aynı roster'da yeniden join etmeme hedefli testte kapsandı.
- Testler mevcut kurulu yerel tsc/vitest/vite ile çalıştırıldı. Bu host'un pnpm wrapper'ı install başlatmaya çalışıp TTY yok diye durdu; paket/lock kurulumu/değişimi yapılmadı.

## D — ölçüm ile hesap ayrımı

Ölçülen: 2 istemcide 5 outbound/5 inbound, 54 B JSON örneği; süre 4656 ms. Aşağıdaki 7/10 sayıları **yük testi değildir**, kod sınırından hesaplanan sürekli tüm oyuncular bakarken ortalama üst sınırdır. Kısa burst, ACK/join/token/game revision mesajları ayrıca vardır; hesap garanti edilen toplam proje bütçesi değildir.

| Oyuncu | Socket | Her socket head topic (+revision) | Min gönderim aralığı | Tüm oda outbound/sn | Head outbound+teslim/sn | Sürekli head/saat |
| --- | --- | --- | --- | --- | --- | --- |
| 7 | 7 | 7 (+1) | 735 ms (~1.36 Hz) | ~9.52 | ~66.67 | ~240,000 |
| 10 | 10 | 10 (+1) | 1500 ms (~0.67 Hz) | ~6.67 | ~66.67 | ~240,000 |

Eski 120 ms (~8.33 Hz) tüm oyuncularda 7p ~408, 10p ~833 head mesaj/sn üretebilirdi. Şimdi `max(500,N²×15)` ms; aynı pozda ağ sessiz, hidden/offline'da sıfır. Scene interpolate eder; özellikle 10 kişide yön güncellemesi daha seyrektir, görsel kabulde değerlendirilmelidir. Join'ler actor başına 150 ms arayla açılır, her frame yeni kanal veya Function çağrısı yoktur.

Free resmi sınırları 100 mesaj/sn, 200 bağlantı, 100 channel/socket; aylık 2M Realtime mesajı. Yukarıdaki sürekli-kötü-durum head trafiği tek başına ~8.3 saatte 2M'a ulaşır; gerçek değişim-only kullanım daha düşüktür. Ücretli yükseltme yapılmadı. [Realtime limits](https://supabase.com/docs/guides/realtime/limits), [Realtime pricing](https://supabase.com/docs/guides/realtime/pricing).

## E — migration/devir

- Uzak migration history: **0001–0005, 0007**. **0006 uygulanmadı**; rematch son test turuna bırakılmış kullanıcı kararını koruduk. 0007'nin 0006 RPC'sine bağımlılığı yok.
- 0007 SQL ve history satırı tek Management API transaction'ında uygulandı. `migration.json` önce/sonra listeleri var.
- Son yayın sahibi 0006'yı uygulayıp history boşluğunu kapatmalı. CLI ile yapılırsa mevcut remote 0007 nedeniyle `db push --include-all` gerekir; önce list/pending SQL kontrol edilir. 0006 geçmiş veya rematch kapanmış sayılmasın.
- Sunucu/head trafiği aynı socket auth'u kullanır; scene dış shape değişmedi. Claude'un eski `room:<id>:viewpoint` ve sender-clock MD açıklamaları artık eskidir; entegrasyon sahibi kendi belgelerini güncellemeli.
- Test odaları sentetiktir ve bırakıldı; toplu truncate/reset yok. Token/anahtar/parola çıktıya veya rapora alınmadı. Secret/token rotasyonu ve Vercel bu görevin kapsamı dışı.

## Açık kabul

Canlı oyun rotasında iki kullanıcının avatar başlarının görsel kontrolü, kamuya açık el hareketleri, 7/10 gerçek trafik profili, fiziksel cihaz/telefon/insan testi, doğal token expiry ve Vercel yayın kontrolleri final entegrasyon/QA sahibinde. Bu ağ görevi yalnız backend kanal erişimi ve gerçek uygulama transport'u için tamamdır.
