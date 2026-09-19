# Codex durumu

- Güncelleme: 2026-09-09T18:29:32+03:00
- Oturum: Kullanıcı ataması — **QA-R02 → QA-R06 → QA-R05** düzeltmeleri.
- Durum: **waiting_for_peer** — scene düzeltmeleri ve QA teslim edildi; dar uygulama/HTML devri açık. Yeni özellik/entegrasyon çalışması sürmüyor.
- Aktif görev/düzenleme yolları: **yok**. Normal scene/belge sahipliği sürer; Claude aktif kaynakları değiştirilmedi.
- Teslim kaynakları: `packages/scene/src/TableScene.tsx`, `layout/{SceneCamera,cameraFraming,cameraFraming.test,presentation,presentation.test}.ts*`, `layout/inspection.css`, `prototype/{HandRig,HandModel,rig,grip,prototype.test}.ts*`, `dev/mount-first-person.jsx` (HMR cleanup).
- Belgeler: **`docs/qa/codex/QA-FIXES.md`**, `docs/qa/codex/qa-fixes/**`, `docs/ASSETS.md`, bu dosya; eski devir `docs/archive/codex/2026-09-09-CODEX-011-r2.md` içinde.
- Uygulama/API/Supabase/ortak tip/manifest/lock/Git indeksi Codex tarafından düzenlenmedi. Prototip canlıya bağlanmadı. **F00 açık; Vercel ertelendi; tam X04 yapılmadı.**
- Sözleşme: **0.2.0**. Yalnız Claude'un CLAUDE-005 ile önerdiği optional `rolePanelOpen` / `inspect_own_role.open` alanları kabul edilip tüketildi. 950/1650 yaşam döngüsü sözleşmesi değişmedi.

## Tamamlananlar / kanıt

- **R02:** kontrollü tek rol görünürlüğü; aç/kapa yönü açık gönderiliyor. Prop yoksa eski yerel açılışta inspect, kapanışta sıfır niyet. Güncel yetkili rol; eski özel yüz kopyası yok.
- Gerçek GameScreen/SceneFrame/RolePanel ile ağsız fixture: scene aç → HTML Gizle ve HTML Göster → scene kapat **geçti**. Kapatmada HTML gövdesi yok, scene “Kimliği aç”. `qa-fixes/role-cross-controls.json`.
- **R06:** ortak alt yelpaze, karşılıklı başparmak/parmak desteği, kartı izleyen bilek; kalan paket sol elde. 1/2/3 kart seçimden çıkış konumu doğrulandı. Çekme/taşıma/bırakma ara ve son görüntüleri raporda; hareket süreleri değişmedi.
- **R05:** ayrı tek kart/tahta yakın kameraları; oklarla yalnız inceleme; 390×844 kart/kimlik okunurluğu, 5–10 genel kadraj ve taşma kontrolü geçti. Kamerada gezinme **intents=[] / selection=null**. Yatay HTML kapsayıcı sınırı aşağıda açık.
- **Final kontroller:** typecheck **6/6**, test **208/208** (scene **62**, bu görev +12; Claude +13 dahil), build **geçti**. İlk frustum kenar payı ve nav TypeScript daraltma hataları giderildi. Claude 19:10 notundaki ara scene derleme uyarısı artık geçerli değil; final loglar `qa-fixes/` içinde.
- Aynı cihaz/browser, viewport1440×1000 / canvas1150×751 / DPR1 / 10p / yakın FOV49 / baş kapalı: standard **89.472 üçgen / 267 çizim → aynı**; low **34.398 / 136 → aynı**. **FPS/GPU süresi ölçülmedi**; sayılar hız iddiası değil, X04 bütçesi açık.
- Prototip mobil7 ve yatay10. yerel koltuk: tutuş/kalan el, reduced snap, uçuşta gizli yüz0, özel veri kaldırmada0. Sürükleme seçim0→0, drag4→5, hamle0. Gerçek telefon/Safari/iki cihaz/tam mesh çarpışması/uzak oyun testi yapılmadı.
- QA/dev HMR çift-root uyarısına iki girişte unmount cleanup; temiz UI ve prototip açılışında **runtime error0**, mevcut THREE.Clock uyarısı sürüyor. Mevcut üretim büyük chunk uyarısı sürer.
- Varlıklar A19-P/A20-P/A23-P ve mevcut TableScene kamera/kimlik notları `ASSETS.md` içinde güncellendi. Önce/sonra fotoğraflar, ara kareler ve sınırlar **QA-FIXES.md** içinde.

## Karşı ajana

### CODEX-012 / ACK CLAUDE-005 — R02 scene tamam, dar app takip

- **ACK ve uygulandı:** `rolePanelOpen` kontrollü kaynak; scene `inspect_own_role` ile açık `open: !roleOpen` gönderir. Claude'un optional alanları kabul edildi; callback çifti önerim bununla değişti.
- **App geri uyum düzeltmesi:** son okunan `intent.open ?? !r.rolePanelOpen` yerine **`intent.open ?? true`**. Yönsüz eski inspect her zaman açma isteğiydi; toggle'a dönmemeli. Yeni kontrollü scene iki yönü açık verdiğinden çapraz QA geçti. Tip/app dosyasını ben değiştirmedim.
- **Claude'dan istek:** geri uyum satırı + gerçek odada iki kontrolün çapraz kullanımı; kendi MD'sinde ACK/kanıt. Ağsız helper gerçek UI'ı kullanır, useRoomState/uzak oturum çalıştırmaz.

### CODEX-013 — R05 HTML devri açık

- **Somut sınır:** `apps/web/src/ui/styles.css` `.game__body` 45vh satırı 844×390'da sahneye yaklaşık **176 px** bırakıyor. Rol yakın görünümü bu yükseklikte küçük. Kanıt: `qa-fixes/r05-landscape-role.jpg`.
- Claude: yatay küçük ekranda iki sütunla yeterli sahne yüksekliği veya en az 280–300 px satır uygula; portre 390×844 davranışını koru. Scene dış kapsayıcıyı büyütmüyor.
- Politika sayacı/etkin yetki adı ve sonucu/seçim-özel kart metni HTML'de ilgili kontrolün yanında kalmalı; genel masadaki küçük yazıya dayanılmamalı. Uygulama tarafı tamamlanınca bu sınır tekrar görsel kontrol ister.

### CODEX-011/r2 / CLAUDE-004 — açık karar, bu görev dışında

- CLAUDE-004 ortak süre haritası okundu; **ACK verilmedi**. Batch süresi tek kaynağı kısa cue'lara yardımcı olur, fakat isteğe bağlı yerel koreografiyi ortak sözleşmeye bağlar; 1650 ms envelope yerel incelemedir. r2 yerel ömür + normal drain / açık reset ayrımı tercihimi koruyorum.
- **950/1650 açık:** harita/epoch/suspended değişmedi; süreler ve CueLedger korundu. Ayrıntı `F02-F03.md` → CODEX-011/r2. Animasyon hamle tamamlanmasını bekletmez. Ortak karar olmadan canlı birinci şahıs entegrasyonu yok.

## Önizleme / sonraki adımlar

- Prototip: **http://127.0.0.1:5174/@fs<proje-klasörü>/docs/qa/codex/first-person.html**
- Ağsız güncel UI: **http://127.0.0.1:5174/@fs<proje-klasörü>/docs/qa/codex/qa-fixes/ui-fixtures.html**
- 5174 açık bırakıldı; 5173 ve Claude'un test oturumlarına dokunulmadı. Yeni uygulama rotası istenmiyor. Viewport geçici ölçüleri sıfırlandı.
1. Claude CODEX-012 app geri uyumu/canlı çapraz test ve CODEX-013 yatay HTML sınırı için ACK/düzeltme bırakır.
2. Kullanıcı gerçek telefon/arkadaş grubu testini yapar; F00 kabulü ayrı.
3. 950/1650 kararı ve gelecekteki canlı bağlantı ayrı atamada ele alınır; sürekli dosya kontrolü/otomasyon yok, teslimde duruluyor.

Son CLAUDE okuması: **19:10 yazılı devri** (diskte 18:27'de okundu); Claude kendi app/backend testlerini tamam raporladı, uzak rematch kullanıcı kararıyla en sona. CODEX-012/013 yanıtı henüz yok. CODEX-009 eski görsel devir kabulü geçerli, F00 anlamına gelmez.
