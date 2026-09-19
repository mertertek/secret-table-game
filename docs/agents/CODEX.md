# Codex durumu

- Güncelleme: 2026-09-09T20:00:51+03:00
- Görev: **FINAL-SCENE** — kullanıcı son sahne entegrasyonu. Prototip sınırı bu görevde kaldırıldı; FINISH_PLAN §2A/3 + COORD-003/004 okundu.
- Durum: **done — sahne teslimi ve rapor tamam; CODEX-017 app işleri / gerçek cihaz kabulü açık**.
- Aktif düzenleme yolları: **yok**. Değişen sahipli yollar: `packages/scene/src/**`, `docs/qa/codex/FINAL-SCENE.md`, `docs/qa/codex/final-scene/**`, `docs/ASSETS.md`, kendi durum/arşivi.
- App/API/Supabase/contracts/fixtures/manifest/lock/Git indeksi değiştirilmedi. Bu oturum yayın açmaz. Gerçek arkadaş grubu kabulü açık.
- Önceki teklifler/çalışma kayıtları: `docs/archive/codex/2026-09-09-FINAL-SCENE-working.md`; QA düzeltmesi: `2026-09-09-QA-FIXES-handoff.md`.

- Teslim: [FINAL-SCENE](../qa/codex/FINAL-SCENE.md); üretim önizleme http://127.0.0.1:5174/dev/scene?fixture=president-discard ; “Kendi koltuğum”. Ayrıntılı kontrol kabuğu raporda.

## Tamamlanan sahne / kontrol

- Public `@secret-table/scene` → **TableScene**: varsayılan genel masa; isteğe bağlı koltuk/inceleme; güncel yetkili politika/oy/rol/inceleme kartı; el/bilek/önkol/zarf; kamu el/baş hareketleri. Üretim girişi QA HTML/@fs/fixtures/dev bileşeni içe aktarmaz.
- Yelpaze ortak alt kavrama etrafında .80 rad açıldı; tür + 1/2/3 köşe baskısı. Numara sırası opak yetkili el sırasıdır; seçili kart tamamen öne gelir. El önce kavrar, sonra kaldırır. 240 ms ID bazlı 3→2→1 sürekliliği; yeni seçim inceleme odağını taşır, oklar seçim değiştirmez.
- Controller göreli bakış/hassasiyet/merkez raycast/null slot; küçük reticle + kart/isimlik hedef vurgusu. Yalnız Canvas yerel drag; ikinci global tuş/komut dinleyicisi yok. Kilitli Canvas kendi seçim niyetini üretmez.
- **269 test** (11 contracts /28 fixtures /65 core /79 scene /33 server /53 web), workspace typecheck **6/6**, build geçti. Büyük JS chunk uyarısı sürüyor; final loglar raporda.
- Tarayıcı: 5–10 genel/koltuk portre; referans/390×844/844×390 önce-sonra; 1–3 seçim/inceleme/azaltılmış hareket; drag→0 seçim, görünmeyen slot→null; zarf/reset/özel veri/suspension/unmount. Gerçek app HTML Göster→scene kapat ve scene aç→HTML Gizle çaprazı geçti; yatay canvas yüksekliği **335 px**.
- Aynı 7p üretim kamera/DPR1/1440×1000: standard **280→199 draw**, **79.554→76.986 üçgen**; geometri **192→144**, doku **44→42**. Son idle 36,742 sn **79→79**. Bunlar FPS değildir. Standard yaklaşık120 draw hedefi hâlâ aşılır; gerçek FPS/GPU/telefon/Safari açık.
- Gerçek Pointer Lock: in-app browser `pointerlockerror` ile reddetti; Chrome kontrol yüzeyi yok. **Gerçek kilit giriş/çıkış veya kilitli tam oyun geçti denmiyor.** Sentetik `pointerLocked` girdisinde raycast/reticle/opak hedef ve göreli look doğrulandı.

## CODEX-016 — kesin arayüz ACK (CODEX-014/015 yerine)

- Claude kaynak `resetEpoch` + `immersive.cameraMode/pointerLocked/sensitivity/inspectOpen/suspended/onController/onTargetsChange` tüketiliyor. `active` sadece geri uyum fallback; açık kamera/kilit alanları birbirinden bağımsızdır.
- `SceneController`: lookBy(dx,dy), inspectBy(-1|1), selectSlot(0..2)→SceneSelection|null, target()→SceneSelection|null, resetLook(). Yöntemler sunucu komutu göndermez. `SceneTargets.slots` boş yuvaları korur; görünmeyen/izinsiz yuva null; unmount controller ve hedefleri temizler.
- **FINISH_PLAN §3 / CODEX-011 r2 kararı uygulandı:** normal boş cues iptal değil; kabul edilmiş hareket yerel süresini tamamlar. Açık resetEpoch, kesinti, yeni geçerli nesil/özel veri iptali eski sunumu keser; eski timer yenisini temizlemez. Oyun onayı animasyon tamamlanmasını beklemez. Ortak süre haritası gerekmez; CLAUDE-004 önerisine ihtiyaç yok.
- Süreler: çek1450, seç440, vazgeç420, bırak1350, oy1150, zarf1650, kamera620, fan kapanışı240 ms. Reduced-motion son poza doğrudan gider. Kamera değişimi yerel hareketi yeniden başlatmaz; uçuşta özel yüzler örtülür; mod dönüşünde eski cue tekrar oynatılmaz.

## CODEX-017 — AÇIK kritik app takip (yeni tip gerekmiyor)

1. `useTableControls.optionSelection` **controller varsa null = eylem yok**; `controller?.selectSlot(index) ?? eskiOption` kullanmayın. Fallback sadece controller bütünüyle yokken. HUD/onay aynı `SceneTargets.slots` opak IDs sırasını çözmeli; action.options sırasını varsaymamalı.
2. Kilitli **E/sol tık = controller.target()**; null'da rastgele panel focus/ilk hedefe düşmeyin. Scene kilitli Canvas tıklamasında onIntent üretmez. Panel odağı ve Enter onayı ayrı kalır. İlk kilit tıklaması grace app'te kalır.
3. `GameScreen.guardedOnIntent` **set_camera → setCameraMode(intent.target)** tüketmeli. Tarayıcıda scene “Kendi koltuğum” niyeti üretti fakat app kamera overview kaldı (`app-camera-handoff.json`). V kısayolu ayrı handleCamera kullanıyor; aynı yolu birleştirin.
4. Odaklan girişinde koltuk seçme ürün davranışı; menuOpen'u suspended'a dahil etme; gerçek hassasiyet UI değeri (şimdi sabit1). Tek global yönetici Claude/app'te kalır.
5. `inspectOpen=rolePanelOpen` tüketiliyor. Yönlü açık/kapalı niyet ve iki HTML/scene kontrolü geçti. Özel alandan tahta incelemeye giderken kontrollü panel kapanışı tahtayı geri sıfırlamaz. Oklar yalnız odağı değiştirir.

## CODEX-018 — FINAL-SCENE / ağ ve kalan kabul devri

- NETWORK-001 + contracts/viewpoint.ts son yorumu okundu: **HeadViewpoint.t alıcı yerel epoch alım saati**, wire sırası ağ epoch/seq ile doğrulanır. Scene mevcut adapter bu biçimle uyumlu; tekrar prop TTL yenilemez, 4000 ms sonra nötr, kesinti dönüşünde taze örnek gerekir. Oda/koltuk/finite/bayatlık sahne defansıdır, ağ kimlik doğrulaması değildir.
- 10p **1500 ms**, 7p **735 ms** sentetik baş örnekleme profili QA'da mevcut; ağdaki gerçek yük/çok oturum kanıtı NETWORK-INTEGRATION raporuna aittir. Sahne gerçek Realtime çağrısı yapmaz.
- Yerel bırakma yalnız kabul edilmiş **cards_moved** cue ile; önceki özel seçimi paylaşmaz, kapalı kanonik dış kenar hareketi. Bu cue motor/projeksiyonda hâlâ üretilmiyorsa app/motor sahibi yetkili olaydan sağlamalı; sahne hamle/tür uydurmaz. Kamu oyları yalnız lastElection + votes_revealed. Kalan güncel yetkili kartlar seçim için açık kalır.
- Gerçek Pointer Lock/Fullscreen, tek klavye yöneticisiyle tam oyun, gerçek arkadaş/telefon/Safari ve FPS kabulü açık. Uygulama null hedef/kamera düzeltmesi yapılmadan entegre son kabul verilmez. App dosyaları düzenlenmedi.
- Claude'un son notu 19:22; CODEX-017 yanıtı henüz yok. Açık MD devri bırakılacak; sürekli dosya kontrolü yok. COORD-005/006 okundu; yayın başka oturumun sorumluluğunda, bu kullanıcı görevinin “Vercel açma” sınırı korunur.
