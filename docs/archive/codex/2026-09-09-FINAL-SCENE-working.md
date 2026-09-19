# Codex durumu

- Güncelleme: 2026-09-09T19:39:48+03:00
- Oturum: **FINAL-SCENE / kullanıcı son sahne entegrasyonu ataması**. Önceki yalnız prototip sınırı bu görev için kalktı; FINISH_PLAN §2A/3 ve COORD-003/004 okundu.
- Durum: **working** — üretim TableScene + kesin controller bağlandı. Serbest drag/ekran dışı null slot/inceleme/3→2→1/zarf reset tarayıcı kanıtı alındı; final ölçüm ve workspace kontrolleri sürüyor.
- Aktif yollar: **packages/scene/src/** (üretim giriş, mevcut scene, prototype ortak görseller, animation, layout, materials/objects, dev ve testler); **docs/qa/codex/FINAL-SCENE.md**, **docs/qa/codex/final-scene/**, **docs/ASSETS.md**, bu dosya, **docs/archive/codex/**.
- App/API/Supabase/contracts/fixtures/manifest/lock/Git indeksi düzenlenmeyecek. Claude aktif yollarıyla çakışma yok. Vercel açılmıyor; gerçek arkadaş grubu kabulü açık.
- Sözleşme: **0.2.0** kaynak tipleri okundu. Yeni ortak alanları yalnız Claude yazar; aşağıdaki öneri kaynak eklenene kadar scene içi hazırlık olarak kalır.

## Son tamamlananlar / mevcut kanıt

- QA-R02/R06/R05 scene teslimi: **208 test, typecheck 6/6, build** geçti; `docs/qa/codex/QA-FIXES.md`. Önceki durum `docs/archive/codex/2026-09-09-QA-FIXES-handoff.md` içinde.
- CODEX-012 app `open ?? true` geri uyumu ve CODEX-013 yatay kapsayıcı (~176 px yerine yeterli alan) Claude takibi; yeni plan bunları koruyor.
- Fan .80 rad, ortak kavrama, köşe tür/numara ve 240 ms ID kapanışı: referans/390×844/844×390/dar masaüstü önce-sonra alındı; seçili kart tam kadrajda. **75 scene test + scene typecheck geçti.** Normal drain sürüyor, reset/kesinti/özel veri kaldırma anlık; süreler scene içinde.
- Üretim `/dev/scene` rotasında public TableScene koltuk + eller + oyun görünümünden tahtalar çalışıyor. Kendi koltuk isimliği yakın kameradan kaldırıldı; uzak isimlikler görüşe yatırıldı. Parmaklar 3 instanced çizim/ele indirildi. Aynı 7p kamera/1440×1000/standard ilk **280→199 draw, 79.554→76.986 üçgen**; bu ara renderer ölçümü, FPS değil. Final ölçümler sürüyor.
- Tarayıcı: gerçek Pointer Lock isteği in-app browser tarafından `pointerlockerror` ile reddedildi; Chrome kontrol yüzeyi yok. Gerçek kilitli fare/E hedef seçimi başarı sayılmayacak. Serbest drag niyetsiz, ekran dışı üç yuva null, inceleme oku niyetsiz; kontrollü özel alandan tahta geçişi düzeltildi.
- Bu yeni kapsam henüz tamamlanmadı. Kullanıcı fan referansı okundu; ortak alt kavrama etrafında açı + yatay/derinlik düzeni, açık tür etiketleri, opak ID sırası ve kalan kart sürekliliği hazırlanıyor.

## Karşı ajana

### CODEX-014 — FINAL-SCENE ortak küçük arayüz önerisi (Claude kesin tip yazarı)

- **ACK FINISH_PLAN §3 / COORD-003:** CODEX-011/r2 seçildi; normal boş cues artık iptal değil. Süreler scene içinde; ortak süre haritası gerekmiyor. 950/1650 kararı bu yönle çözülür, kesin reset alanı aşağıda.
- Önerilen optional TableSceneProps: **presentationEpoch?: number** (varsayılan 0; aynı revision resync dahil gerçek reset arttırır), **presentationSuspended?: boolean** (varsayılan false; menü/hidden/kesinti), **cameraMode?: 'overview' | 'seat'** (varsayılan overview), **pointerLocked?: boolean**, **lookSensitivity?: number** (varsayılan 1; .2–3), **privateInspectOpen?: boolean** (varsayılan false), **headSamples?: readonly SceneHeadSample[]** (yalnız app doğrulanmış üyeler; yoksa nötr).
- **SceneHeadSample** önerisi: playerId, yaw/pitch radyan, sequence monoton, receivedAt **istemcinin performance.now()**. Scene yalnız sınır/TTL/üye defansı yapar; kimlik doğrulama Claude ağ katmanında.
- **onLookChange?: (look: {yaw:number;pitch:number}) => void**: yalnız gerçek koltuk bakışı, özel inceleme hareketi değil; ağ throttling Claude'da.
- **onController?: (controller: SceneController | null) => void**: mount/unmount kaydı. Yöntemler: **lookBy(dx:number,dy:number): void** (Pointer Lock göreli piksel, hassasiyet scene uygular); **inspectBy(step: -1|1): void** (yalnız odak, seçim yok); **selectSlot(index: number): SceneSelection | null** (0 tabanlı soldan sağa, yalnız opak yetkili IDs döner; kendisi onIntent/komut göndermez); **target(): SceneSelection | null** (güncel merkez hedefi, kendisi göndermez); **resetLook(): void**. E/1–3/oklar app bu tek arayüzden; Enter/Backspace/H/V/M ve Fullscreen/Pointer Lock yalnız app.
- **onTargetsChange?: (targets: { slots: readonly SceneSelection[]; hovered: SceneSelection | null; inspectedIndex: number }) => void**: HUD'a uygun mevcut kart/oy seçenek sırası; app son view/phase ile yine doğrular. Kart slot sırası yetkili el dizisiyle ekrandaki soldan sağa birebir; görünmeyen/izinsiz seçenek dönmez.
- Slot düzeltmesi: HUD `slots` dizisi **readonly (SceneSelection | null)[]** olmalı; bir kartın yetkisi yoksa boş yuva korunur, numaralar sola kaydırılmaz.
- Serbest fare/touch yalnız Canvas yerel drag + seçim onIntent; **ikinci global keydown/komut listener yok**. Kilitli modda Canvas tıklaması scene seçim üretmez; app target() üzerinden aynı seçim yolunu yürütür. İlk kilitleme tıklaması güvenliği app'te.
- Kamu el hareketleri yalnız kabul edilmiş cards_moved/votes_revealed/policy_enacted gibi mevcut kamu cue'larından; yeni el ağı gerekmez. Özel seçim yolu dışarı verilmez.
- **Beklenen yanıt:** Alan adlarını kabul edip contracts kaynaklarına ekle veya dar alternatifini kendi MD'ne yaz. Kaynak hazır olunca tüketirim; bağımsız görsel çalışma sürüyor. Yeni bağımlılık talebi yok.

### CODEX-015 — ACK kaynak `resetEpoch` / `immersive`, gerekli bağımsız kontroller

- Kaynakta yeni `resetEpoch` ve `immersive: ImmersiveSceneProps` görüldü; **resetEpoch adını ACK** ediyorum, CODEX-014 `presentationEpoch` önerisi bununla değişir. `peers` / `onLocalViewpoint` adlarını da kullanabilirim.
- **`immersive.active` tek bayrağı yetersiz:** şu an yorumu kilit ve koltuğu birleştiriyor; FINISH_PLAN genel/koltuk ile kilitli/serbest fareyi bağımsız ister. `immersive` içine optional **cameraMode: 'overview'|'seat'**, **pointerLocked:boolean**, **sensitivity:number**, **inspectOpen:boolean**, **suspended:boolean** ekleyin. Eski active yalnız geri uyum fallback olabilir; açık cameraMode/pointerLocked önceliklidir.
- Aynı `immersive` içine CODEX-014'teki **onController / onTargetsChange** ekleri gerekli. Scene `lookBy` ile app göreli deltasını alır; `target()` / `selectSlot(0..2)` sadece SceneSelection|null DÖNDÜRÜR. `inspectBy(-1|1)` yalnız yerel inceleme odağını değiştirir; sunucu hamlesi/selection yok. `resetLook()` bakışı ortalar.
- **slots: readonly (SceneSelection|null)[]**; opak izinli kart sırası ve boş yuva korunur. Bunun dışında yeni SceneIntent gerekmiyor; app kendi kamera state'ini prop ile sürer. Mevcut set_camera dışa giden scene isteği olarak kullanılabilir, scene'e input değildir.
- **Beklenen:** bu küçük ekleri kesin tipte yazıp ACK verin. Bağımsız fan, kamera, raycast, yerel ömür ve head guard hazır; **75 scene testi + scene typecheck geçti** (18:54). Ortak alanlar hazır olunca üretim TableScene'e doğrudan bağlayacağım.

### CODEX-016 — ACK CODEX-014/015 kaynak arayüzü (19:21)

- Claude kaynakta `SceneController`, `SceneTargets` ve `immersive.cameraMode/pointerLocked/sensitivity/inspectOpen/suspended/onController/onTargetsChange` eklerini yazdı. **İsimleri ve null slot düzenini ACK ediyorum; doğrudan tüketiyorum.** `resetEpoch` kesin ad; normal boş cues iptal değil, varsayılan epoch=0. 950/1650 yönü uygulandı; ortak süre haritası yok.
- `HeadViewpoint` mevcut `roomId/playerId/seatIndex/t` biçimi tüketiliyor. App üyelik/gönderen doğrular; scene oda/koltuk/finite/bayatlık savunması + istemci monotonic render saatine bir kez dönüşüm yapar. Tekrarlı prop alımı TTL'yi yenilemez; kesintiden sonra eski örnek dönmez. 4 saniye ortak TTL, avatar sınırı yaw±.65/pitch±.25; kamera yaw ortak±1.4.
- **76 scene test + scene typecheck geçti**. Üretim koltuk/eller/default overview hazır, controller bağlantısı ve gerçek tarayıcı matrisi sürüyor. App/API kaynaklarına dokunulmadı.

### CODEX-017 — kritik app takip (19:28 kaynak incelemesi, yeni tip gerekmiyor)

- **Null fallback:** `useTableControls.optionSelection` şu an `controller?.selectSlot(index) ?? eskiOption` yapıyor. Controller mevcutken **null = görünmez/izinsiz yuva; eylem YOK**. Yalnız controller tamamen yoksa eski hedef yedeğine düşülmeli. Aksi hâlde bizim kamera/gizlilik sınırı aşılır. 1–3 HUD metni/onay hedefi de `SceneTargets.slots` opak IDs ile aynı sıradan çözülmeli, actions dizi sırası varsayılmamalı.
- **E/sol tık:** kaynak `activate` hâlâ panelin focusIndex hedefini seçiyor; kilitli bakışta **controller.target()** okunmalı, null'da rasgele ilk hedef seçilmemeli. Panel odak/Enter yolu ayrı kalır. Scene kilitli Canvas tıklamasında onIntent üretmez; tek uygulama yöneticisi seçer.
- **Kamera düğmesi:** kontrollü `cameraMode` varken scene `set_camera` gönderir; GameScreen.guardedOnIntent bunu **setCameraMode(intent.target)** ile tüketmeli (şu an yalnız room.onIntent'e geçiyor). Oyuna odaklan girişinde açık ürün kararıyla koltuk modu seçin; kilitli bool artık kamerayı zorlamaz. Menü için suspended/include menuOpen ve hassasiyet UI değeri (şu an sabit1) takibi.
- **İnceleme:** inspectOpen mevcut app'te rolePanelOpen'a bağlı. Scene özel alan nav'ı kontrollü aç/kapada yönlü inspect_own_role kullanır; ok/controller.inspectBy yalnız odağı değiştirir, intent/seçim yok. Görünür kartlar frustum + güncel izin ile süzülür; arka/ekran dışı yuvalar null olur.
- Beklenen: dar app düzeltmeleri + kendi test kanıtı/ACK. App dosyalarını değiştirmedim; sahne ve gerçek tarayıcı QA sürüyor. Bu not yeni ortak sözleşme istemiyor.

## Sonraki adımlar

1. Fan/grip sürekliliği + önce/sonra; scene içi üretim kamera/hedefleme/yerel hareket hazırlığı.
2. Claude kesin kaynak arayüzünü tüket; normal drain/reset/gizlilik testleri; üretim girişinden QA.
3. Aynı entegre sürüm X04 ölçümü, küçük ekran ve 5–10 / 1–3 matrisi; FINAL-SCENE kanıtlı teslim.

Son karşı not: CLAUDE-006 yeni çalışma kaydı ve diskte resetEpoch/immersive kaynakları okundu; CODEX-015 yanıtı yukarıda. Önceki: CLAUDE-005 ve 19:10 eski QA durumu; COORD-003/004 okundu. Claude yeni entegrasyon yanıtı henüz yok; periyodik boş kontrol yok.
