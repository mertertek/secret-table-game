# Koordinasyon oturumu

- Güncelleme: 2026-09-09T19:29:41+03:00
- Görev: Kullanıcının son atamasıyla QA düzeltmeleri + canlı kamera/eller/baş paylaşımı + Fullscreen/Pointer Lock bitiriş planı.
- Durum: done
- Aktif yollar: Yok; son geliştirme planı kaydedildi. Uygulama mevcut Claude/Codex görevlerinde.
- Sözleşme: 0.2.0; kod ve sözleşme değişmedi.

## COORD-001 — Claude için devir

- Project reference ve iki URL, publishable key, server secret key ve yönetim access token kullanıcı girdisiyle `.env` içine kaydedildi. Gizli değerler bu belgeye yazılmadı.
- Dosyanın Git dışında ve izlenmiyor olduğu doğrulandı; izinleri 0600. Kaydedilen altı alan yerelde doğrulandı; uzak kimlik doğrulaması yapılmadı.
- `SUPABASE_DB_PASSWORD` kullanıcı tarafından verilmedi, mevcut değer değiştirilmedi. CLI akışı bunu gerektirirse kullanıcı dosyaya ekleyebilir; alternatif olarak yetkili Management API akışını değerlendir. Parolayı kendiliğinden sıfırlama.
- Anonymous Sign-Ins panel ayarı henüz bu oturumda doğrulanmadı. Migration, canlı test veya deploy yapılmadı; C06 Claude’da devam ediyor.
- Kullanıcı yönetim tokenını ve secret key’i sohbette paylaştı; kurulum sonrası yenilenmeleri ve geçici tokenın iptali kullanıcıya öneriliyor.
- CODEX-008/X03 teslimi ve CODEX-009 drain zamanlaması açık notlarını da oku.

## COORD-002 — Codex ve Claude için sonraki aşama planı

- Kullanıcı isteğiyle `docs/FIRST_PERSON_PLAN.md` oluşturuldu; ana PLAN belgesine bağlandı. F00 çalışan oyun kabulünden önce uygulamaya başlanmayacak.
- F01 ortak sözleşme devri; F02 kamera + F03 el/kollar Codex; F04 geçici bakış bağlantısı/uygulama entegrasyonu Claude; F05 canlı kabul. Son X04 cilası F05 sonrasına alındı.
- C06 uzak DB hazırlığının J01 öncesi yapılabileceği ana planda netleştirildi; mevcut canlı test/deploy yetkisi ve işleri genişletilmedi.
- Özel kart seçimi/incelemesi paylaşılmıyor; bakış oyuncu kimliğiyle yetkilendirilmeli, ayrı geçici kanalda ve ölçülmüş Free mesaj bütçesiyle tasarlanmalı. Mevcut revision kanalı şimdilik değişmiyor.
- Kod, sözleşme, ajanların CODEX/CLAUDE durumları ve `.env` bu görevde değiştirilmedi. Yalnız belge ve yerel bağlantı doğrulaması yapıldı; uygulama testi gerekmedi.
- Sonraki adım: Claude C06/J01 ve CODEX-009'u tamamlasın. F00 kanıtından sonra görevler bu plandan atanır; bu not ajanları uyandırmaz.

## COORD-003 — son kapsam / önceki bekleme kararının güncellemesi

- Kullanıcı tam ekran + doğrudan fare bakışı dahil özelliklerin tamamlanmasını, sonra Vercel aşamasını istedi. `docs/FINISH_PLAN.md` son sıranın kaynağıdır.
- Mevcut QA düzeltmeleri doğrulandıktan sonra entegrasyon başlayabilir; gerçek arkadaş grubu kontrolü yapılmış sayılmaz, final kullanıcı kabulünde açık kalır. Önceki COORD-002 bekleme sırası bu kapsamda güncellenmiştir.
- Kodex sahne/eller/hedef işareti/baş yumuşatma; Claude app/Fullscreen-Pointer Lock yaşam döngüsü/contracts/yetkili geçici ağ. Aynı dosyada eşzamanlı düzenleme yok.
- Yaşam döngüsünde CODEX-011/r2 yönü: normal teslim kuyruğu temizliği kabul edilmiş hareketi kesmez; açık reset nesli/kesinti iptal eder. Kesin optional tipler Claude tarafından Codex devriyle yazılır; sunum süreleri sahnede kalır.
- QA-R02 eski yönsüz inspect niyeti açma anlamını korumalı. QA raporu canlı liberal politika zaferini doğruladı; eski J01 açık maddesi kaynakla güncellenmeli.
- Bu görev yalnız plan/bağlantı doğrulaması yaptı; aktif ajan kaynaklarına veya sırlarına dokunulmadı, test/deploy yapılmadı.

### COORD-003 ek — son Claude teslimi

- Claude yerel QA düzeltmelerini teslim etti; kullanıcı devrinde 0006 uzak migration/rematch kontrolü en sona ertelenmiş. FINISH_PLAN bu sıraya uyarlandı; geliştirme ilerleyebilir, uzak R01 açık kalır.
- Kaynak kontrolünde `intent.open ?? !r.rolePanelOpen` hâlâ mevcut; CODEX-012 geri uyum düzeltmesi `intent.open ?? true` Claude tarafından yapılmalı.
- Codex durumuna göre ara TypeScript daraltma sorunu giderildi, workspace doğrulaması sürüyor. Eski Claude hata notu güncel başarısızlık kanıtı sayılmamalı; tamamlanan ortak sürümde kontroller yenilenir.

## COORD-004 — kart yelpazesi, klavye akışı, iki geliştirici

- Son Codex QA-FIXES raporu 208 test/typecheck/build geçti; geçici scene hatası kapandı. R02 app eski niyet geri uyumu ve CODEX-013 yatay dış kapsayıcı hâlâ Claude takibi.
- Kullanıcı arkadaki kartın kapandığını bildirdi; görsel `docs/references/card-fan-user-feedback.png` olarak korundu. Codex ortak kavramayı bozmadan yelpazeyi açacak, 1/2/3 sırasını okunur kılacak.
- FINISH_PLAN §2A tuş haritası ve tam klavye oyun akışını belirler. Claude tek input yöneticisi/HTML-HUD/komutlar; Codex kamera/raycast/kart sunumu. Kart çekme için sahte yeni motor eylemi yok.
- İki geliştiriciyle devam önerisi; mevcut üçüncü bağımsız QA görevi son entegre sürümü doğrulamak için kullanılabilir. Yeni görev bu oturumda açılmadı.
- Belgeler ve kullanıcı referans kopyası dışında kod değişmedi; uygulama testi yapılmadı.

## COORD-005 — Vercel test yayını artık yetkili

- Son kullanıcı talimatı: geliştirme ve yerel kontroller bitince Vercel'e alıp kalan testleri yayın adresinde yapalım. Önceki genel Vercel ertelemesi bu kapsamda kalktı; yeniden genel deploy izni beklenmez.
- FINISH_PLAN §7 sırası: entegre aday + gerekli migration/test → ücretsiz Hobby test dağıtımı → yayın adresinde bağımsız QA ve kullanıcı/cihaz/arkadaş testleri → kusur düzeltme/yeniden test.
- Gerçek arkadaş grubu testi deploy ön koşulu değil, son kabul maddesidir. Eksik testler tamam sayılmaz. Claude yayın sahibi, Codex görsel taraf; yeni görev oluşturulmadı.
- Bu koordinasyon oturumunda yalnız belge güncellendi; uygulama eksikleri nedeniyle henüz deploy başlatılmadı.

## COORD-006 — ağ düzeltmeleri Codex alt ajanına devredildi

- Kullanıcı Claude yerine Codex ajanı istedi. Bu oturumdaki `viewpoint_network` ajanı görevlendirildi; kendi durumu `docs/agents/NETWORK_CODEX.md`, raporu `docs/qa/codex/NETWORK-INTEGRATION.md`.
- Geçici dosya sahipliği: viewpointChannel.ts, useRoomState.ts içindeki yalnız viewpoint bölümleri, contracts/viewpoint.ts ve ilgili ağ testleri/yeni viewpoint migration. Claude bu dar alanlarda eşzamanlı düzenleme yapmamalı. Mevcut teslim üzerine çalışılır, önceki working kaydı yeni atamayı engellemez.
- Hedef: kanal SELECT/INSERT yetkileri, auth.uid ile oyuncu kaynak kimliği bağlama, aynı odadan koltuk taklidini önleme, canlı bağımsız oturum ve mesaj bütçesi doğrulaması. Oyun revision kanalı client yazımına açılmaz.
- Scene/eller/kamera mevcut Codex'te; fullscreen/klavye genel app işleri ve Vercel bu alt ajanın kapsamında değil. Son yayın yetkisi COORD-005 kapsamında duruyor, henüz yayın yapılmadı.
- Uzak viewpoint migration ve test bu göreve dahil; 0006 rematch final turda ayrı açık. Gizli değerler belgeye yazılmaz, DB reset/temizlik yok.
