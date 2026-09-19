# Bağımsız QA Codex durumu

- Güncelleme: 2026-09-09T17:52:17.692220+03:00
- Oturum / görev: QA-REVIEW-001 — kullanıcının bağımsız kapsamlı test ataması.
- Durum: **done** — test, kanıt ve sahip devri tamam; ürün kusurları düzeltilmedi.
- Aktif düzenleme yolları: **yok**.
- Teslim: `docs/qa/codex/QA-REVIEW.md`; kanıt ve ağsız QA ekranı `docs/qa/codex/qa-review/**`.
- Sözleşme: 0.2.0 korundu. Kaynak, manifest, lock, Git indeksi, deploy/migration/anahtar/DB temizliği yok.
- Sürüm: main commit yok. Başlangıçtaki 172 kaynak SHA256 son kontrolde aynı; `source-comparison.json`.
- Canlı 6p: 31c767e1… / 7EXYYA; tarayıcı +5 bot, L5/F1 rev67 liberal_policies_enacted. Önceki J01'in canlı liberal politika zaferi boşluğu bu koşuda kapandı.
- Canlı 7p: 8a8c80f2… / BNVUCH; tarayıcı +6 bot, L1/F6 rev79 fascist_policies_enacted. İnfazı tarayıcı yaptı; sonraki infazda yerel QA elendi ve eylemleri kalktı.
- 6p doğrudan rematch iki kez hata; Lobiye dön→Başlat yeni role_reveal açtı, bu ikinci oyun bitirilmedi (botlar sona erdi). 7p game_over. Yalnız kendi QA odaları, temizlenmedi.
- Görsel: mevcut sahne ve prototip 5–10 masaüstü; 390×844; prototip 844×390/10. koltuk. Kart, kamera, sürükleme, gizlilik, eller, hareket/ses sayaçları, resync/yeni-revision/tekrar olay kontrol edildi.
- Hedefli test: engine 16/16 + cue/prototype 32/32 = 48 geçti. Yeni build/typecheck veya bütün testler çalıştırılmadı.
- Sınır: çok insanlı grup/gerçek telefon/hoparlör/gerçek offline-background/token expiry/GPU-FPS yapılmadı. F00 kapanmadı. Prototip canlıya bağlı sayılmadı.

## Karşı ajana açık devirler

- **QA-002 / Claude — QA-R01, R04:** bitmiş canlı oyunda Yeniden oyna→SERVICE_UNAVAILABLE, reload sonrası da tekrar. Muhtemel neden: play_again→startGame; SQL start_game yalnız lobby kabul ediyor. Lobi üzerinden başlatma çalıştı. Ham hata kodu Türkçe sözlüğe çözülmüyor. Ayrıntı ve görüntüler raporda.
- **QA-003 / Codex + Claude — QA-R02:** Kimliği aç→HTML Gizle→Kimliği kapat, HTML rolünü yeniden açıyor. toggleRole iki yönde inspect_own_role yolluyor. Kendi sentetik koltuğunda doğrulandı; sunucu sızıntısı iddiası yok.
- **QA-004 / Claude — QA-R03:** infaz onayı yalnız Yetkiyi kullan + hedef + Gönder diyor; yetki türü aşağıdaki Masa panelinde. Eylemin sonucu onay yanında açık yazılmalı.
- **QA-005 / Codex, Claude — QA-R05–07:** küçük genel masada bilgi ölçeği, el kavrama doğallığı, oyun sonu bekleme metni/İngilizce rol değerleri. 10p yakın standard267/low136 çizim; FPS değil.
- CODEX-011/r2 ve CLAUDE-004 farklı yaşam döngüsü önerileri olarak ayrıldı; bu QA görevinde mutabakat/uygulama kararı verilmedi.
- Beklenen yanıt: sahipler rapordaki önceliklerle düzeltmeleri üstlensin; özellikle canlı rematch, gizleme ve infaz onayına regresyon kanıtı bıraksın.

## Sonraki üç adım

1. Claude rematch ve hata çözümlemesini düzeltir; uzak rotada tekrar test eder.
2. Codex/Claude gizleme niyetini, Claude yetki onayını düzeltir; görsel cila takip eder.
3. Gerçek arkadaş grubu, telefon/ses/ağ kabulü ve ayrı F01 kararı yapılır; F00 bu raporla tamamen kapanmaz.

- Son okunan karşı mesajlar: CODEX-011/r2, CLAUDE-004 ve COORD-001/002. Diğer ajan durum dosyaları değiştirilmedi.
