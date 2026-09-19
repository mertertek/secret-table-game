# FINAL-INTEGRATION — uygulama tarafı (Claude)

Kaynak plan: `docs/FINISH_PLAN.md` (§2, §2A, §3, §4, §6). Karşı teslim: Codex
`docs/qa/codex/FINAL-SCENE.md`. Bu belge **yayın hazır demez**; açık/engelleyici
kontroller aşağıda ayrı işaretlidir.

Tarih: 2026-09-09. Görev: CLAUDE-006.

## 1. Bu turda değişen (uygulama + sözleşme)

| Alan | Dosya(lar) | Durum |
| --- | --- | --- |
| CODEX-012 geri uyum | `apps/web/src/multiplayer/{rolePanel.ts,useRoomState.ts}`, `packages/contracts/src/scene.ts`, `docs/CONTRACT.md` | Kod + test tamam |
| CODEX-013 yatay dış kapsayıcı | `apps/web/src/ui/styles.css` | Kod + ölçüm tamam (gerçek app görseli açık) |
| Tek kontrol yöneticisi (§2A) | `apps/web/src/immersive/{controlScheme.ts,useTableControls.ts,ControlHud.tsx,KeyHelpOverlay.tsx}`, `GameScreen.tsx` | Kod + 16 test tamam |
| Fullscreen + Pointer Lock (§2) | `apps/web/src/immersive/useImmersiveSession.ts`, `GameScreen.tsx`, `styles.css` | Kod tamam; gerçek kilit testi açık |
| Baş yönü paylaşımı (§4) | `packages/contracts/src/viewpoint.ts`, `apps/web/src/multiplayer/{viewpointChannel.ts,useRoomState.ts}`, `SceneFrame.tsx`, `GameScreen.tsx` | Kod + birim test; iki tarayıcı testi açık |
| Reset nesli (§3) | `packages/contracts/src/scene.ts` (`resetEpoch?`), `useRoomState.ts` | Kod tamam; sahne tüketimi Codex |

Sözleşme **0.2.0** sabit. Eklenenler additive/opsiyonel:
`SceneIntent.set_camera`, `TableSceneProps.resetEpoch?`,
`TableSceneProps.immersive?: ImmersiveSceneProps`, `viewpoint.ts`
(`HeadViewpoint`, `LocalViewpoint`, sınır/gönderim sabitleri + `clampViewpoint`,
`viewpointChanged`). Kırıcı değişiklik yok.

## 2. Yerel kontroller — GEÇTİ (2026-09-09 ~19:13)

- `pnpm typecheck` — **6/6** proje.
- `pnpm test` — tümü yeşil: contracts **11** (+5 `viewpoint.test.ts`), fixtures 28,
  game-core 65, scene **75** (Codex), server 33, web **36** (+16
  `immersive/controls.test.tsx`, +4 `ui/rolePanel.crosscontrol.test.tsx`, +2
  `immersive/immersiveSession.test.tsx`).
- `pnpm build` — `apps/web` tsc + vite build geçti (mevcut büyük-chunk uyarısı
  sürüyor; davranışsal değil).

### 2A. Kapsanan §2A / §6 davranışları (otomatik test)

- 1/2/3 görünür soldan-sağa sırayla seçer; gönderilen `optionId` görsel sıra ile
  eşleşir (`optionTargets` pozisyonel).
- Oklar yalnız odağı değiştirir; mevcut seçim/gönderim değişmez (`select_option`
  bir kez, `clear_selection` sıfır).
- Enter iki adımlı: aynı fiziksel basış onayı açıp gönderemez; `event.repeat` ve
  keyup'suz ikinci basış göndermez; ayrı basış gönderir.
- `requiresConfirmation === false` aksiyonda seç + ayrı Enter gönderir.
- Backspace gönderilmemiş seçimi iptal eder ve `preventDefault` ile tarayıcı
  gezinmesini engeller.
- `<input>` / metin odağında oyun kısayolları çalışmaz.
- Odak bir `<button>`'dayken Enter yöneticide çift hamle üretmez (native işler).
- Pointer Lock az önce açıldıysa (`LOCK_GRACE_MS = 300`) E/1-3/Enter seç/göndermez;
  H yine çalışır; grace geçince seçim çalışır.
- H yön vererek (`open: !current`) tek kaynaktan açar/kapatır — sahne "Kimliği
  kapat", HTML "Gizle" ve klavye birbirini geri almaz (`rolePanel.crosscontrol`).
- V/M enjekte edilen geri çağrıları tetikler; oyun sonu komut hedefleri
  (yeniden oyna / lobiye dön) Enter + oklarla yürür — **yeni draw komutu yok**.
- `clampViewpoint` sınırlara kırpar, sonlu olmayanı 0 yapar; `viewpointChanged`
  eşik altını yok sayar.
- `useImmersiveSession` API yoksa güvenli varsayılan döner; `enter/exit/releaseLock`
  hata fırlatmaz (desteklenmeyen cihaz → mevcut sürükle/klavye/touch korunur).

### 2B. CODEX-013 ölçümü (statik CSS harness, gerçek built stylesheet)

- 844×390 (yatay + kısa): `.game__body` iki sütun (`~473px | ~371px`), sahne
  yüksekliği **335 px** (hedef 280–300 px karşılandı; öncesi ~176 px). Yan panel
  kendi içinde kayar. **Yatay taşma yok.** Landscape-short media query eşleşiyor.
- 390×844 portre: media query `(max-height: 520px) and (orientation: landscape)`
  yapısı gereği eşleşemez; `minmax(300px, 45vh)` uzun portrede `45vh` (= eski
  davranış) verir. Kısa portrede (≤ ~667px) sahneye 300 px taban — küçük iyileşme,
  regresyon değil. Tarayıcı aracı portre viewport genişliğini 980'e kelepçeledi;
  gerçek app portre görseli §3'te açık kontrol.

## 3. AÇIK — gerçek tarayıcı / cihaz / insan kontrolleri (yapılmadı)

Bunlar sentetik olayla "geçti" sayılamaz (FINISH_PLAN §6).

1. **0006 uzak migration + doğrudan rematch** (QA-R01, önceki turdan devam).
   `docs/qa/claude/QA-R-FIXES.md` "QA-R01 → BEKLEYEN" adımları: `0006_rematch.sql`
   uygula → tek geçici QA odası → `game_over` → "Aynı oyuncularla yeniden oyna" →
   yeni `role_reveal` / yeni `gameId` / `revision = biten + 1` / tüm istemciler
   sinyalle yenilenir. **DB toplu temizliği yok. Vercel açma.**
2. **Gerçek Pointer Lock giriş/çıkış** (§2, §6): "Oyuna odaklan" → tam ekran +
   kilit; Esc ile çıkış; `M` menü kilidi bırakır, "Bakışa dön" açık etkileşimle
   yeniden kilitler; sekme gizleme / pencere blur → `needsResume` + "Bakışı
   etkinleştir"; kendiliğinden yeniden kilit YOK. Tek düğme isteği reddedilirse
   tam ekran kalır + açık devam kontrolü.
3. **İlk kilit tıklaması** sahne raycast'ıyla hamle seçmemeli (grace canlı sahne
   ile doğrula); hızlı çift tık / kamera hareketi izinsiz hamle üretmemeli.
4. **Tam tarayıcı oyunu — klavye ile**: adaylık, oy, kart at/çıkar, veto
   kabul/ret, özel yetki (infazda "elenecek" onayı), sonuç ve rematch — HTML
   düğmeye fareyle tıklamadan. E ve Enter art arda/tekrarlı basış çift hamle
   üretmemeli.
5. **Baş yönü — iki bağımsız tarayıcı oturumu**: koltuktan bakışınca uzak
   avatarın başı yumuşak döner; taklit kimlik / üye olmayan / geçersiz-bayat
   mesaj reddedilir (alıcı doğrulaması `useRoomState.acceptPeerViewpoint`);
   özel inceleme kamerası yayınlanmaz. Free mesaj bütçesi ölçümü:
   `VIEWPOINT_SEND_INTERVAL_MS = 120` (≤ ~8 Hz), `VIEWPOINT_IDLE_STOP_MS = 1500`
   (hareketsizde sus), eşik `VIEWPOINT_MIN_DELTA = 0.015` rad; 7/10 alıcıyla
   ölçülüp buraya yazılacak.
6. **CODEX-013 gerçek app görseli**: 844×390 ve 390×844'te gerçek `GameScreen`
   (canlı oda) — politika sayacı / etkin yetki adı + sonucu / seçim-özel kart
   metni okunur, taşma yok, portre bozulmadı.
7. **Animasyon reset nesli (§3)**: 1650 ms yerel hareket normal kuyruk
   temizliğinden sonra sürer; aynı-revision resync `resetEpoch` artışıyla hemen
   keser; yeni batch'i eski timer silmez. (Sahne `resetEpoch` tüketimi Codex.)
8. **Cihaz/insan**: fiziksel telefon/Safari/dokunmatik; gerçek ses; doğal token
   expiry; F00 gerçek çok-insanlı oyun gecesi. Bunlar bu ortamda **yapılamaz**.

## 4. Codex'e bağımlı (sahne tarafı)

- `TableScene` `immersive.active` iken koltuk kamerası + nişangâh + göreli fare
  deltası → `onLocalViewpoint(yaw, pitch)`; `immersive.peers` ile uzak baş
  yumuşatma; `set_camera` niyeti; `resetEpoch` ile açık reset.
- Sahne kendi ikinci global keydown/komut dinleyicisini KURMAZ (§2A).
- Detaylar: `docs/agents/CLAUDE.md` → CLAUDE-006.

## 5. Yayın kararı

**Yayın hazır DEĞİL.** §3'teki 1–7 kapanmadan ve Codex sahne tarafı entegre
edilmeden Vercel adımına geçilmez. Ölçülmeyen alanlar için "hiç sorun kalmadı"
denmez.
