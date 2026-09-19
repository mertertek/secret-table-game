# Network Codex
- Güncelleme: 2026-09-09T19:45:00+03:00
- Durum: done — NETWORK-001 (COORD-006 kullanıcı ataması).
- Aktif düzenleme yolları: yok; dar ağ sahipliği entegrasyon sahibine devredildi.
- Değişen kaynaklar: apps/web/src/multiplayer/{viewpointChannel.ts,viewpointProtocol.ts(YENİ),useRoomState.ts yalnız viewpoint,viewpointChannel.test.ts(YENİ),viewpointProtocol.test.ts(YENİ)}; contracts/src/viewpoint.ts dokümantasyonu; supabase/migrations/0007_viewpoint_channels.sql(YENİ).
- Scene/immersive/UI/scene.ts/manifest/lock/deploy değiştirilmedi. Genel status dosyalarını yazmadım.
- Kontrat shape 0.2.0 aynı; HeadViewpoint.t artık alıcı yerel alım zamanı. Wire epoch/seq ağ modülünde.

## NETWORK-001 devir
- Private `room:<roomId>:viewpoint:<gameId>:<playerId>`: INSERT auth.uid→actor bağı; SELECT aktif oda üyesi. Actor payload'dan değil yetkili topic/roster'dan. Revision kanalına client yazımı kapalı.
- Strict bounded wire, duplicate/old epoch red, hidden/offline/stop cleanup, serialized real-token reauth, generation guard, send failure açıklaması (HTTP oyunu kilitlemez).
- 7p min735 ms /10p min1500 ms; eski8Hz Free kapasitesini aşardı. Değişim-only, yaklaşık66.7 head outbound+teslim/sn sürekli teorik üst sınır; 7/10 ölçülmüş yük testi değil. Scene yumuşatma korunur ama 10p seyrek örnek görsel QA'de değerlendirilir.
- 0007 uzak hedef <PROJECT_REF> üzerinde uygulandı. History 0001–0005,0007; **0006 hâlâ açık**. Son yayın sahibi 0006'yı doğrulayıp uygulamalı; CLI db push için --include-all gerekebilir. Hiçbir rematch başarısı iddiası yok.
- Kanıt: docs/qa/codex/NETWORK-INTEGRATION.md ve network-integration/{migration.json,remote-results.json,browser-results.json,remote.mjs,browser.mjs}.

## Doğrulama
- Gerçek 3 anon Node socket: A↔B, outsider ret, üye diğer actor yazımı ret, revision yazımı ret, refresh/rejoin, ledger/state değişmeme geçti.
- Gerçek 2 izole Chrome context: uygulama viewpointChannel modülü ile çift yön, auth refresh, gerçek network offline/online, stop geçti. Fiziksel cihaz veya karakterin görsel kabulü değil.
- Web typecheck + 53 web testi + 5 contracts viewpoint testi + üretim Vite build geçti. 15 yeni ağ testi vardır. Chunk büyüklüğü uyarısı mevcut. Dependency install yapılmadı.
- Sonraki: entegrasyon sahibi canlı avatar/elleri ve 7/10 profili gözden geçirir; 0006/rematch; final yayın QA.
