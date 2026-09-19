# Claude durumu

- Güncelleme: 2026-09-18T23:55:00+03:00
- Oturum: **CLAUDE-007** — kullanıcı devri: proje ana sorumluluğu ve koordinasyon
  Claude'da. 2026-09-11: GPT/Codex tarafı tamamen kapatıldı; görsel tasarım ve model üretimi
  dahil her iş Claude'da (isteğe bağlı GPT review, plana bağlı değil).
- Durum: **working** — A0/A1/A2/A3/A4/C2 commit 848a558'de. A6 dev bot modu TESLİM (botRunner.ts + Lobby düğmesi, 11 test, gerçek lobide denendi; üretim paketinde bot kodu yok). Tam test 342, build geçti; commit kullanıcıda. A0 canlıda KAPANDI (kullanıcı VITE değişkenlerini Config olarak ekledi, oda açılıyor; paket kontrolü geçti). A5 gerçek cihaz/arkadaş kabulü kullanıcıda.
- Önceki oturum kaydı: `docs/archive/claude/2026-09-10-CLAUDE-006-final.md`.

## 1. Aktif düzenleme yolları

- D29 "Nasıl oynanır" lobide görsel modal **TESLİM** (2026-09-18, Opus yan ajan). Rapor `docs/qa/claude/D29-howto-modal.md`, 8 kare `docs/qa/claude/d29/`. Yeni: `apps/web/src/ui/{howToPlayArt.tsx,HowToPlayModal.tsx,HowToPlayModal.test.tsx}`, `packages/scene/src/art.ts`. Değişen: `ui/{howToPlay.ts,HowToPlayPanel.tsx,GameMenu.tsx,Lobby.tsx,styles.css}`, `app/EntryPage.tsx`, `i18n/{tr,en}.ts` (45 yeni anahtar), `packages/scene/package.json` (`exports["./art"]`), ve testler `ui/{howToPlay.test.ts,Lobby.test.tsx,GameMenu.tabs.test.tsx}`, `app/EntryPage.test.tsx`. DEĞİŞMEYEN: sözleşme, `packages/server`, `game-core`, migration, `apps/web/api/*`, README ön izleme linki. Lobide (oda kurulduktan sonra) ve giriş ekranında düğme → modal; oyun içi menü sekmesi DURUYOR ve AYNI `HowToPlay` bileşenini çizer. Görseller yalnız satır içi SVG; `BOARD_ICONS` + palet + yuva planı `@secret-table/scene/art` (three İÇERMEZ) üzerinden tek kaynaktan, yuva→yetki `boardSlotArt()` ile `BOARD_LAYOUTS`tan türer. İçerik TEMBEL: giriş paketi 396 994 → 399 590 B (+2,6 kB), CSS 35,29 → 39,43 kB, ilk yükleme +1,75 kB gzip; sahne chunk'ı 172,19 → 163,11 kB. Modal `createPortal` ile `document.body`de (`.shell__card` `card-rise` `fill: both` yüzünden fixed kapsayan blok oluyordu). GEÇTİ: typecheck 6/6, **1066** test (önce 1046), build; canlı 5211 bellek kipi, Playwright, masaüstü 1280×720 + telefon 390×844 × tr/en, hata 0. Bilinen eksik: zeminin üstünde tekerlek arkadaki lobiyi kaydırıyor (kab `.shell`). Commit YOK.
- D26 tarayıcıda "tek başına dene" (solo demo) **TESLİM** (2026-09-18, Opus yan ajan). Rapor `docs/qa/claude/D26-solo.md`, 7 kare `docs/qa/claude/d26/`. Yeni: `apps/web/src/solo/{soloMode,soloService,soloTransport,botBrain,soloBots,startSolo}.ts` (+4 test dosyası). Değişen: `multiplayer/apiClient.ts` (tek anahtar `setSoloTransport`, dış yüzey aynı), `multiplayer/useRoomState.ts` (solo kipte `ensureGuestSession`/`claim_control`/Realtime/bakış kanalı/heartbeat YOK), `dev/botRunner.ts` (karar mantığı `solo/botBrain.ts`'e çıkarıldı, davranış aynı), `app/EntryPage.tsx`, `app/RoomPage.tsx`, `ui/styles.css`, `i18n/{tr,en}.ts`. DEĞİŞMEYEN: sözleşme, `packages/server`, `game-core`, migration, `apps/web/api/*`. Üretimde AÇIK ama TEMBEL (`startSolo` 7,6 kB + sunucu/motor 43,4 kB ayrı chunk; giriş paketi +2,8 kB / %0,7). GEÇTİ: typecheck 6/6, **1046** test (önce 1033), build; canlı 5210 bayraksız: `/api/game` 0, `supabase.co` 0, tam oyun + yetki. Sapma: `dev_scenario` dizgesi tembel sunucu chunk'ında var (motorun kendi `switch`'i, tarayıcıda daima `NOT_ALLOWED`); `botRunner`/`devScenarioMenu` izi 0. Commit YOK.
- D28 varsayılan dil İngilizce **TESLİM** (2026-09-18): `DEFAULT_LANGUAGE='en'`, `detectLanguage` kaldırıldı; `usePrefs` kayıt yoksa `currentLanguage()`; test kurulumu `setLanguage('tr')`. Türkçe TR/EN anahtarıyla seçilir, kalıcı. 1033 test, typecheck 6/6, build; canlı tr-TR/de-DE doğrulandı.
- D27 README tanıtım GIF'i **TESLİM** (2026-09-18, Opus 5 yan ajan) — kullanıcı görsel kabulü bekliyor. **Kod DEĞİŞMEDİ**; yalnız `README.md` + `docs/media/`. Yeni: `docs/media/demo.gif` (800×450, 12 fps, 10,75 s, 129 kare, 5,73 MB, tek ortak 256 renk paleti, dithering kapalı, `disposal=1`, kare farkı eşiği 6) ve `docs/media/demo-poster.jpg` (800×450, 71 KB — infaz hedefi seçili, silah elde). README: rozetlerin altındaki kapak `hero-table.jpg` → `demo.gif` (width 800), `hero-table.jpg` "Screenshots" bölümünün başına tam genişlik taşındı; başka içerik ve `PREVIEW_URL_HERE` aynen duruyor. Çekim: bellek kipi dev sunucu (5208), Playwright (headless shell 1217, ANGLE/Metal), `locale: en-US`, 1280×720, dpr 1; "Mert" + 6 bot = 7 oyuncu; CDP `Page.startScreencast` (jpeg q92, everyNthFrame 1) ile zaman damgalı kareler, segment başına ayrı kayıt, ölü zaman kırpımı, 12 fps'e en yakın kare ile yeniden örnekleme. Sahneler: bakış 3,04 s (fare sürükleme, ease-in-out, ±0,5 rad), jest çarkı → "Hands up" 2,60 s, `B` tahtaya eğilme 1,68 s, infaz 3,20 s. Betikler `scratchpad/d27-record.mjs` + `scratchpad/d27-gif.py` (mutlak yol yok, PW_PATH/CHROME_PATH/OUT_DIR/FRAMES_DIR ortamdan); ham kareler oturum scratchpad'inde (`d27-diag/01-look…04-execution`, ileride mp4 için duruyor); kalite kareleri `scratchpad/d27-check/` (gitignore). GEÇTİ: `pnpm --filter @secret-table/web build`. **TUR 3 (2026-09-18, aynı ajan) — ilk-atış donması DEPODA çözüldü, infaz sahnesi şeritsiz yeniden çekildi.** `packages/scene/src/props/GunProp.tsx` patlama malzemelerini (alev/duman/kıvılcım) silah ele geldiğinde iki kare boyunca opaklık 0 ile çizip derliyor (`warm` ref). **ÖLÇÜM (ısıtma atışı OLMADAN, taze sayfa, oyunun İLK atışı, aynı segment/aynı ayarlar): ÖNCE** ateş anında (2 606 ms) **533 ms** kare boşluğu, ateş±300 ms penceresinde yalnız **2 kare** → namlu alevi hiç yakalanamıyordu; **SONRA** ateş 2 629 ms, ateş±300 ms penceresinde en büyük boşluk **19 ms** ve **36 kare**. Kalan boşluklar (312/367/303 ms) yalnız komut ÖNCESİ ve koreografi BİTTİKTEN sonraki boştaki karelerde; 1 000–3 963 ms arası (kalkış, nişan, ateş, flaş, duman, çöküş) kesintisiz ~45 fps. Bu yüzden tur 2'nin kayıt dışı "ısıtma infazı" çözümü betikte VARSAYILAN KAPALI (`WARMUP=1` ile geri açılır, karşılaştırma için duruyor) → tek atış, daha temiz akış ve ikinci senaryonun açtığı ek duyuru şeritleri yok. Ayrıca `d27-record.mjs` infaz segmentinde duyuru katmanını `page.addStyleTag` ile gizliyor (`.announcer{visibility:hidden}`, `HIDE_BANNERS=0` ile kapatılır) ve ateşten hemen sonra geri açıyor: hedef seçimi ve ateş karesi ŞERİTSİZ, sonda yalnız "EXECUTION — Bot-Cem was shot" şeridi görünüyor. Tur 2'deki "PRESIDENTIAL POWER" ve "ELECTION" binmeleri KALKTI. Yeni GIF: 800×450, 12 fps, **10,67 s**, 128 kare, **5,51 MB** (bakış 2,86 s · jest 2,70 s · tahta 1,64 s · infaz 3,32 s; `EXEC_KEYS=2605,2690` ile alev karesi ızgaraya zorlandı). Poster 71 KB (silah elde, hedef seçili, "Execute"). GEÇTİ: `pnpm -r typecheck`, `pnpm test`, web build. Commit YOK. **TUR 2 (2026-09-18, aynı ajan) — tur 1'de bulunan üç kusur DEPODA düzeltildi (`animation/execution.ts` `executionShooterId`, `live/LocalMotion.ts` `GUN_HANDOFF_MS`, `viewpointChannel.ts` bellek kipi `sendEmote`, `controlScheme.ts` → `t('hint.confirm')`), GIF yamasız YENİDEN çekildi.** `d27-record.mjs`'deki geçici `page.route` yaması kaldırıldı. Canlı doğrulama GEÇTİ: bellek kipi bot masasında yerel başkan ateş edince birinci şahısta silah kalkıyor, nişan alıyor, ateş anında namlu alevi + kıvılcım + duman görünüyor, koreografi bot hamlesi gelmesine rağmen 2 600 ms boyunca KESİLMİYOR; ateş karesi `scratchpad/d27-check/fire-live.png` (segment içi 2 610 ms). Jest de yamasız oynuyor (eller havada karesi artık GIF'te). **Çekimde çıkan yeni bulgu:** D12 patlaması İLK kez çizilirken three.js malzeme derlemesi ~530 ms kare durduruyor ve screencast tam o pencerede hiç kare vermiyordu (namlu alevi GIF'e giremiyordu); çözüm olarak betik kayıt DIŞI bir "ısıtma infazı" yapıyor (listedeki SON oyuncu, böylece rakam sırası kaymıyor), ikinci infaz akıcı çiziliyor. Ayrıca 12 fps örneklemede 120 ms'lik flaşı kaçırmamak için `d27-gif.py`'ye `<SEGMENT>_KEYS` eklendi: verilen anlar ızgaraya ZORLA oturtulur (`EXEC_KEYS=2610,2700`). Yeni GIF: 800×450, 12 fps, **10,67 s**, 128 kare, **5,56 MB**, 256 renk, fark eşiği 8; sahneler bakış 2,86 s · jest 2,70 s · tahta 1,64 s · infaz 3,32 s. Poster: silah elde, hedef seçili, "Execute" istemi (72 KB). Alt ipucu şeridi artık tamamen İngilizce. **Kalan kozmetik kusur:** dev senaryosunun açtığı "PRESIDENTIAL POWER · Execution" duyurusu ateş anında hâlâ solmuş hâlde duruyor; bekleme 5 200 ms'e çıkarılınca duyuru YENİDEN belirdiği için daha da kötü oldu (görünüm tazelenmesi duyuruyu geri getiriyor), 2 600 ms bırakıldı. Ayrıca Hitler vurulan denemede oyun bitiyor ve "Game over" paneli koreografinin üstünü tamamen kapatıyor — o çekim kullanılmadı. **TUR 1'DE BULUNAN ÜÇ KUSUR (artık düzeltildi):** (1) `apps/web/src/multiplayer/viewpointChannel.ts:30` — Supabase istemcisi yokken `sendEmote: () => false`, `GameScreen.handleEmote` de bu yüzden yerel jesti hiç başlatmıyor: **bellek/bot kipinde jest çarkı seçiyor ama el kalkmıyor**; GIF için yalnız Vite'ın servis ettiği kopyada `page.route` ile `true` yapıldı (depo kodu dokunulmadı); (2) canlı infazda başkanlık AYNI sürümde sonraki oyuncuya geçtiği için `useLocalMotion`'ın `cueOfficePlayerId(view, 'president') === localPlayerId` koşulu tutmuyor → D12 birinci şahıs koreografisi (silah kalkışı, patlama, namlu alevi) HİÇ oynamıyor, silah tek karede kayboluyor; `player_eliminated` cue'su 2 600 ms aktif kalıyor ama görünen tek şey duyuru + "DEAD" etiketi; (3) `apps/web/src/immersive/controlScheme.ts:389` İngilizce arayüzde sabit Türkçe `'Onayla'` yazıyor (GIF'in son ~1,5 s'inde alt ipucu şeridinde görünüyor). Commit YOK.
- D25 depo yüzeyini İngilizceleştirme (public GitHub) **TESLİM** (2026-09-18, Opus yan ajan) — kullanıcı doğrulaması bekliyor. **Kod davranışı DEĞİŞMEDİ**; sözleşme, sunucu, game-core, scene, migration hiç dokunulmadı. Yeni: `docs/SETUP.md` (İngilizce kurulum: Supabase projesi + anonim giriş + 429 notu, migration 0001–0008 iki yol, ortam değişkeni tablosu, Vercel ayarları, `APP_ORIGIN`/CORS — **kodda okunmadığı açıkça yazıldı**, güvenlik modeli, Free katman kotası, sorun giderme; sonunda Türkçe `docs/DEPLOYMENT.md` göndermesi), `docs/ARCHITECTURE.md` (paket haritası + bağımlılık yönü, hamlenin uçtan uca yolu, belirlenimcilik ve 1 800 tohumlu simülasyon, projeksiyon/gizlilik, SDF → marching cubes → parça-farkında kümeleme → skinned mesh hattı, `frameloop="demand"`, canlı bakış kanalı `max(500, min(10,n)²·15)` ms + alıcı tarafı ara değer, i18n modeli, test sayıları), `docs/README.md` (İngilizce / Türkçe belge dizini), `CONTRIBUTING.md` (kök, İngilizce). Değişen: `.env.example` (tamamen İngilizce; en üste `cp .env.example .env` + bellek kipi notu), `docs/ASSETS.md` (**yerinde İngilizceye çevrildi**, başlık "Asset inventory"; tablolar, ölçüler ve font lisansı bölümü korundu, tarihçe özetlendi ama silinmedi; A16/A17'ye "D2/D3 ile aşıldı" notu eklendi), `README.md` (test rozeti 1017 → **1024**, "Deploy your own" → `docs/SETUP.md` (DEPLOYMENT "(Turkish)" ikincil), "How it works" sonuna ARCHITECTURE bağlantısı, Status cümlesi "Turkish working log" + `docs/README.md`, yeni "Contributing" bölümü; yapı/rozet/görsel/Türkçe özet/lisans bölümleri korundu), `apps/web/index.html` (`lang="tr"` → `lang="en"` statik varsayılan + açıklayıcı yorum, İngilizce `description`, `og:type/title/description/locale/locale:alternate`, `twitter:card`; **`og:image` YOK** — alan adı yok; favicon ve `<title>` aynı), kök `package.json` (`description`, `license: "CC-BY-NC-SA-4.0"`, `repository`, `keywords`; `private: true` ve scriptler aynı, alt paketlere dokunulmadı), `CLAUDE.md` + `AGENTS.md` (en üste tek satırlık İngilizce "bu dosya AI ajanları için, Türkçe yazıldı" notu; gövde aynen). **Kod içi Türkçe yorumlar bilinçli olarak KALDI** (kullanıcı kararı); Türkçe iç belgeler silinmedi. GEÇTİ: `pnpm -r typecheck` **6/6**, `pnpm test` **1024** (27/56/147/368/95/331 — düşmedi), `pnpm --filter @secret-table/web build`. Dil doğrulaması (bellek kipi 5207, Playwright headless shell 1217, iki bağlam): `locale: 'tr-TR'` → giriş ekranı Türkçe + `documentElement.lang = "tr"`; `locale: 'en-US'` → İngilizce + `lang = "en"`; sunulan statik HTML varsayılanı `en`. Dev sunucu kapatıldı. **Commit/push YOK.** Yeni metinlerde mutlak yerel yol ve Supabase proje kimliği yok (grep ile doğrulandı).
- D24 **tur 2 TESLİM** (2026-09-14, Opus yan ajan) — kullanıcı doğrulaması bekliyor. Kullanıcı: canlı Vercel + gerçek Supabase'te "eller akıcı ama kafalar hâlâ kasarak". Rapor `docs/qa/claude/D24-head-interpolation.md` §6–11, kareler `docs/qa/claude/d24/tur2-*.jpeg` (3), betikler oturum scratchpad'inde (depoya konmadı: yerel yol/ölçüm). **Gönderim tarafı, sözleşme, sunucu, game-core, migration DEĞİŞMEDİ** — düzeltme yalnız alıcıda. Değişen dosyalar: `packages/scene/src/live/headInterpolation.ts` (yeni: `percentile`/`jitterDelay`/`easeDelay`, `poseAt(keys,t,predict)` sınırlı ileri tahmin, `HeadBuffer`'da geliş aralığı + kayıp istatistiği, ızgaraya oturtma, ±%20 imleç hızı, yakalama hız sınırı, tampon açlığı geri beslemesi, taşıma payı; tavan 1200 → 1500 ms), `packages/scene/src/live/headInterpolation.test.ts` (**14 → 21 test**; 2 eski test tahmin davranışına göre güncellendi), `packages/scene/src/live/PeerHeads.tsx` (`push(..., now)` geliş anı), `apps/web/src/dev/DevScenePage.tsx` (yalnız dev `&jitter`/`&loss`, tarama periyodu 4320 → 4000 ms). Seçilen gecikme: son 12 geliş aralığının p90 + 60 ms (kayıp > %10 → 150 ms), alt sınır medyan × 1,1, tavan `min(1500, staleAfter/2)`; 500 ms akışta canlı ölçümde ≈570–650 ms. Ölçüm (sentetik 12 s): düzenli sıçrama 2 → 0, maks 0,0204 → 0,0145; ±300 ms sapma + %10 kayıp sıçrama 37 → 0, maks 0,600 → 0,0128, donuk %10,3 → %0,7. Ölçüm (**gerçek Supabase**, 5 oyuncu + 3 bot, 20 s): geliş p50 501 / p90 591 / maks 647 ms, kayıp 0; maks kare farkı 0,0445 → 0,0199, sıçrama 4 → 0. typecheck 6/6 · **1024 test** · web build geçti. Commit/push YOK. Sapma: kayıp geliş boşluğundan sezilir (tel `seq` sahneye taşınmıyor); ızgaraya oturtma + yakalama hız sınırı istenenin ötesinde eklendi; tahmin dinlenirken adımın %44'ü kadar ileride durabilir; hareketsizlikten ilk harekete tek seferlik yakalama. Canlı ölçüm için `apps/web/src/multiplayer/viewpointProtocol.ts` içine GEÇİCİ ölçüm satırı kondu ve geri alındı (depoda yok).
- D24 uzak kafa ara değeri (entity interpolation) **tur 1 TESLİM** (2026-09-13, Opus yan ajan) — kullanıcı doğrulaması bekliyor. Rapor `docs/qa/claude/D24-head-interpolation.md`, kareler `docs/qa/claude/d24/` (3 jpeg), betikler `scratchpad/d24-measure.mjs`, `scratchpad/d24-graph.mjs`. Kullanıcı: "kafalar online oynarken saniyede 2 kez kasılarak gidiyor". **Sözleşme/sunucu/game-core/migration DEĞİŞMEDİ; gönderim aralığı (`viewpointInterval`, kota) DEĞİŞMEDİ** — düzeltme yalnız alıcıda. Yeni: `packages/scene/src/live/headInterpolation.ts` (saf: `wrapAngle`/`lerpAngle`/`sampleInterval`/`renderDelay`/`smoothingRate`/`poseAt` + `HeadBuffer`), `packages/scene/src/live/headInterpolation.test.ts` (14 test). Değişen: `live/PeerHeads.tsx` (`get()` HAM örnek olarak KALDI; yeni `pose()/rate()/pending`, `accept(...,staleAfter)`, `PeerHeadsBridge` yalnız `pending` iken `invalidate`), `characters/CharacterAvatar.tsx` (hedef `pose`, katsayı `rate`, `reducedMotion` eski davranışta, yerel `sample` yolu değişmedi), `TableScene.tsx` (`seatLook` → `pose`), `apps/web/src/dev/DevScenePage.tsx` (yalnız dev `&sweep=<ms>` ölçüm akışı). Gecikme: medyan aralık × 1,2 + 40 ms (540 ms akışta 688 ms), tavan `min(1200 ms, staleAfter/2)`. Ölçüm (dev 5203, `/dev/scene&sweep=540`, ideal kare farkı 0,0077 rad): önce p50 0,0020 / p95 0,0417 / 52 sıçrama → sonra p50 0,0071 / p95 0,0083 / **0 sıçrama**. typecheck 6/6 · **1012 test** (+14) · web build geçti. Commit/push YOK. Sapma: 9–10 kişide gecikme tavanı aralığı tam kapatmaz (kalanı yavaş yumuşatma örter); gerçek Realtime odasında ölçüm yapılmadı.
- D23 iki dil (TR + EN) + public yayın hazırlığı **TESLİM** (2026-09-13, Opus yan ajan) — kullanıcı doğrulaması bekliyor. Rapor `docs/qa/claude/D23-i18n.md`, kareler `docs/qa/claude/d23/` (7 jpeg), betik `scratchpad/d23-shots.mjs`. Tasarım `docs/design/D23-i18n.md`. **Sözleşme DEĞİŞMEDİ:** `CONTRACT_VERSION` 0.2.0 sabit, `packages/contracts` 0.2.6'da kaldı, migration yok; `viewpoint.ts` Türkçe `EMOTE_LABELS` korundu. Dil ODAYA değil OYUNCUYA aittir; sunucu/game-core dil bilmez. Türkçe kaynak dildir, hiçbir metin silinmedi. Yeni: `apps/web/src/i18n/{index.ts,tr.ts,en.ts}` (397 anahtar, `en` `satisfies Record<TrKey,string>`), `apps/web/src/i18n/i18n.test.ts`, `apps/web/src/ui/{LanguageSwitch.tsx,emoteText.ts,usePrefs.language.test.ts}`, `apps/web/test/setup.ts` (jsdom dili `tr` sabitlenir), `packages/scene/src/i18n/{sceneText.ts,sceneText.test.ts}`, kök `LICENSE` + `NOTICE.md`. Değişen: `ui/text.ts` (sabit tablolar → `phaseName`/`powerName`/`powerNames`/`roleName`/`winnerName`/`endReasonName`/`actionTitle`/`connectionText`; `errorText`/`powerActionText`/`resolveOptionLabel` imzası aynı), `ui/{avatarText,howToPlay,statusLine,announcements,usePrefs}.ts` (+ `loadPrefs` dışa açık, `language` alanı geri-uyumlu), `ui/{ActionBar,ConnectionBanner,EmoteWheel,GameMenu,GameScreen,HistoryLog,HowToPlayPanel,Lobby,LobbyTable,PlayersPanel,RolePanel,SceneFrame,Screen,TableStatus,AvatarPicker}.tsx`, `app/{EntryPage,JoinPage,NotFoundPage,RoomPage,RootErrorBoundary}.tsx`, `main.tsx` (dil ilk boyamadan önce), `immersive/controlScheme.ts`, `ui/styles.css`, `vite.config.ts` (test setupFiles), `packages/scene/src/TableScene.tsx` (+ additive `language?: 'tr'|'en'`, varsayılan `tr`) ve tuvale çizen `objects/{PolicyBoard,CardBody,PrivateArea,RoleEnvelope,ElectionMarker,Nameplate,boardArt,nameplateState,voteState}`, `materials/cardArt.ts`, `prototype/HandRig.tsx`, `index.ts`; `README.md`/`docs/DECISIONS.md` + 6 dosyada Supabase proje kimliği → `<PROJECT_REF>`. Ölçüm: typecheck 6/6 · **test 998** (D23 öncesi 973, +25) · build geçti, dist'te dev kodu yok (6 chunk). Canlı (bellek kipi 5202, Playwright, 2 bağlam + 3 bot): TR ve EN oyuncu aynı odada aynı hamlede kendi dilinde HUD/duyuru/tahta dokusu gördü; çizim çağrısı eşit (masa 119, tahta 98), sayfa hatası yok; oyun içi TR↔EN geçişi yenilemesiz. Kalan: kullanıcı görsel kabulü; Vercel `VITE_ST_DEV_TOOLS`/`SECRET_TABLE_DEV_TOOLS` silinmesi (kullanıcı); `docs/qa/**` görsellerinin public'te kalıp kalmayacağı kararı; prototip/dev sayfaları (`FirstPersonPrototype`, `X03Preview`, `dev/*Page`) Türkçe bırakıldı (üretim paketinde yok).
- D21 inceleme düzeltmeleri **TESLİM** (2026-09-12 21:30–23:10, Opus yan ajan) — kullanıcı doğrulaması bekliyor. Rapor `docs/qa/claude/D21-review-fixes.md`, kareler `docs/qa/claude/d21/` (11 jpeg), ölçüm betiği `scratchpad/d21-shots.mjs`. **Migration GEREKMEDİ** (`notify_room_revision` EXECUTE yetkisi 0004'te zaten var). **Canlı yük olayı (Vercel, 7 kişi "sunucu kaldırmadı") kök nedeni ölçüldü ve kapatıldı:** yedek yoklama 3 s → **10 s** (+ lobide tamamen susar, yeni `backupEnabled`), `view` isteği **14–17 → 4 gateway çağrısı** (10 oyuncu: 154,9 ms → 37,0 ms; 8 ms/tur modeli), oda başına Supabase turu ≈ **%91 azaldı**. Yeni: `packages/server/src/{service.room-status.test.ts,service.view-cost.test.ts}`, `apps/web/src/multiplayer/useRoomState.d21.test.tsx`, fixture `legislative-chancellor-seat-two-cues`, `scratchpad/d21-shots.mjs`. Değişen: `packages/contracts/src/{commands.ts,schemas.ts,schemas.test.ts}` + paket **0.2.6** (`CONTRACT_VERSION` 0.2.0 SABİT; additive `PlayerViewResponse.roomStatus` ve `PlayerViewRequest.sinceGameId`; `ACTIONS_REQUIRING_OPTION` KALDIRILDI), `packages/server/src/{service.ts,gateway.ts,memory-gateway.ts,supabase-gateway.ts,engine-map.ts,service.cues.test.ts,service.dev-scenario.test.ts,engine-map.options.test.ts}` (yeni additive `gateway.listSessions`/`notifyRevision`, `TOUCH_SESSION_MIN_MS` 30 s, `cuesSince` ileri sürümde de cue, `cancel_game` sinyal, `dev_scenario` yalnız host), `packages/game-core/src/{devScenario.ts,errors.ts}` (yalnız yorum), `packages/scene/src/{TableScene.tsx,live/officeHands.ts,live/officeHands.test.ts}` (koltuk başına cue: `pickOfficeHandCue`), `packages/fixtures/src/{registry.ts,scenes/legislative.ts}`, `apps/web/api/game.ts`, `apps/web/src/multiplayer/{apiClient.ts,roomChannel.ts,roomChannel.test.ts,useRoomState.ts}`, `apps/web/src/ui/{GameMenu.tsx,GameMenu.tabs.test.tsx,GameMenu.dev.test.tsx,EmoteWheel.tsx,GameScreen.tsx,styles.css}`, `apps/web/src/immersive/{useEmoteWheel.ts,emoteControls.test.tsx}`, `apps/web/src/dev/{botRunner.ts,botRunner.test.ts,devScenarioMenu.tsx}` (bot oturumu `localStorage`'da yeniden kullanılır + 429'da durur), `docs/{CONTRACT.md §6/§7.1,ROADMAP.md}`. GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **973** (27/56/147/335/95/313), `pnpm --filter @secret-table/web build`; dist'te dev izi yok. Canlı (bellek kipi 5205, 2 bağlam + 3 bot): "Lobiye dön" → konuk lobide **6,6–8,1 s** (bellek kipinde Realtime yok, 10 s'lik yoklama sınırlıyor), ~110 s'lik oyun turunda 25 insan hamlesi hatasız, infaza kadar ilerledi. **Kalan:** üretime deploy (Vercel paketi hâlâ eski davranıyor), gerçek Supabase'de lobiye dönüş gecikmesi ölçümü (≤4 s hedefi), `view` için "sürüm değişmedi" kısa yanıtı. **Ajan commit atmadı; kullanıcı oturum sürerken kodu kendisi commit'ledi (`dd5bc98` "performans"); rapor/ROADMAP/agent satırı ve `lobby-return-*`/`play-*` kareleri çalışma ağacında.**
- D12 infaz sahnesi **TESLİM** (2026-09-12 00:05–01:00, Opus yan ajan) — kullanıcı görsel kabulü bekliyor. Rapor `docs/qa/claude/D12-execution.md`, kareler `docs/qa/claude/d12/` (6 jpeg). Yeni: `packages/scene/src/{props/{gun.ts,GunProp.tsx},animation/execution.ts,live/ShootingArm.tsx}`, `packages/fixtures/src/scenes/execution.ts` (`execution-shot`, `execution-shot-local`, `execution-shot-victim`), `apps/web/src/dev/{sceneClock.ts,useFrozenScene.ts}` (`&t=1300` cue zamanını dondurur, üretim paketinde yok). Değişen: `animation/{cues.ts,CueEffects.tsx,useSceneCues.ts}` (süre 2600, `game_ended` 2600 ms gecikmeli hale/duyuru), `hands/poses.ts` (`holdGun` + `PROP_FRAMES`), `live/PublicArms.tsx` (infazda sol el), `prototype/{model.ts,rig.ts,grip.ts,HandRig.tsx}` (`shoot`/`aim`, `propFromHand`), `characters/{CharacterAvatar.tsx,face.ts,spec.ts}` (kalıcı çökük poz + `ko`), `audio/SceneAudio.ts` (`shot`), `materials/palette.ts`, `TableScene.tsx`, `docs/design/d1/poses.json`, `docs/design/d3/characters.json`, `apps/web/src/ui/{announcements.ts,Announcer.tsx,GameScreen.tsx,styles.css}` (duyuru gecikmesi + vinyet/"VURULDUN"). Sunucu/game-core/contracts DEĞİŞMEDİ. Tur 2 (koordinatör geri bildirimi): silah ele göre yeniden oranlandı (1,31 el · tambur + 6 oluk · tetik korkuluğu · kabza avuç içinde · el bilekte −90° yuvarlanır · yeni 6 kollu flaş), yeni fixture `execution-shot-seat`, kareler `-t2` ekli. Ölçüm: silah 646 üçgen, boşta 217 çizim (değişmedi), ateş anında 221, infaz penceresi 52,6 fps. Tur 3 (kullanıcı canlı geri bildirimi): silah HEDEF SEÇİLİRKEN de elde (`executionReadyActorId` = `executive_action` + `execution` yetkisi → ilk şahısta `ready` pozu, kamu kolunda masada hazır silah; koreografi bu pozdan başlar, ölçek sıfırlanmaz; hazır pozun boşta maliyeti +4 çizim / +1 292 üçgen, yetki bitince sıfır) + HUD seçenek rakamları **1–9** (`OPTION_DIGITS`, `Digit/Numpad1–9`, ActionBar rozetleri, `1–N Seç` ipucu; `immersive/{controlScheme.ts,useTableControls.ts}`, `ui/ActionBar.tsx`). Yeni fixture `execution-choose`, `execution-choose-seat`; kareler `-t3`. Tur 4 (kullanıcı): silah **1,9 el** boyuna büyüdü (`BODY_SCALE 1.7`, kabza yumrukta sabit, üçgen 686 ≤ 700), **patlama** eklendi (`BLAST`/`blastFrame`: flaş 120 ms 0,35→1,6 ölçek, 4 duman sprite 400 ms, 8 kıvılcım 90 ms — ikisi de tek `InstancedMesh`, patlamada +3 geçici çizim, sonra 0; geri tepme 12°; hedefte 80 ms `flinchOffset`), yeni `shot` sesi (0,40 s: 8 ms transient + 110→70 Hz vuruş + süzülen kuyruk + 45/90 ms yankı, tepe 0,60) ve `usePrefs.soundEnabled` varsayılanı **açık** (kayıtlı tercih korunur). Kareler `-t4`. Tur 5 (kullanıcı "HD yapsaydık", yalnız `props/{gun.ts,GunProp.tsx}`): silah **2 790 üçgen** (voxel 6,5 mm · kümeleme 11,5 mm · Newton yansıtma · Taubin · SDF gradyan normalleri; HD üretim 62 ms, ilk kare 690 üçgenlik `low` kademe, HD `requestIdleCallback` kuyruğunda), horoz + ön nişangâh + tambur pimi + kabza vidası, NON-INDEXED köşe renk çifti ile D3 `patchBoundaryShader` kenar-yumuşatması, köşe başına metalness/roughness (gövde .75/.32 · kabza 0/.60 · pirinç .80/.28) ve silaha özel 256×128 prosedürel PMREM `envMap` (envMapIntensity .9, paylaşımlı + sayaçlı dispose) — **tek çizim**. Kareler `-t5`. GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **681** (11/39/98/280/44/209 — D2/D3 testleri dahil), `pnpm --filter @secret-table/web build`. Commit YOK.
- D1 **tur 5 — perdesiz eller** (2026-09-12, kullanıcı: "parmaklar arasındaki etleri silsek; balık adam gibi görünüyor"): `packages/scene/src/hands/{sdf.ts,anatomy.ts,skeleton.ts,geometry.ts}`. Dört parmak birbirine SERT `min` ile birleşir (aralarında smooth-min yok), avuca tek `smin(K.fingerToPalm 12→5 mm)`; `WEB` r 7→3,5 mm ve y −2→−8 mm (boğum altına indi), `THUMB_WEB` r 9→4,5 mm, `K.web` 10→4 / `K.thumbWeb` 12→6 mm; `PALM` distal yüzeyi −0,108→−0,096 (boğumların 2 cm ötesine taşan dilim kısaldı); MCP aralığı 22→24 mm, falanks yarıçapları ~%7 ince; `skinWeights` komşu PARMAĞA ağırlık vermez (`blendable`: aynı zincir ya da `wrist`); `standard` kümeleme 4,8→5,2 mm. Üçgen: standard 4 950→**4 644**, low 2 248→2 404, distant 802→882 (bütçeler korundu), `fpHandBuildMs` 48–53 ms. Kareler `docs/qa/claude/d1/webless-{before-after,open-palm,fan,public-rest,seat-view}.jpg`, rapor `docs/qa/claude/D1-hands.md` "Tur 5". D3/PublicArms aynı geometriyi kullandığı için koltuk görüşü de düzeldi; D16 kareleri bu geometriyle YENİDEN alındı. `docs/design/**` değişmedi.
- D1 **tur 6 — yapışık bölge taraması** (2026-09-12, kullanıcı: "elde yapışık çıkan yerler var"): yeni `/dev/hands?grip=&view=palm|back|tips` inceleme sayfası (`packages/scene/src/hands/HandGallery.tsx`, `apps/web/src/dev/DevHandsPage.tsx`, `routes.tsx`; `SkinnedHand` additive `arm` propu), 14 kavrama × 3 açı tarandı. İki kök neden: (1) köşe kümeleme 5,2 mm hücreyle parmak arası 4 mm boşluğun iki duvarını tek köşede birleştiriyordu → `clusterDecimate` artık `group` (avuç/parmak/baş parmak) anahtarı alıyor, farklı parçalar kaynaşmıyor; (2) parmak↔avuç `smin` şişmesi kökte köprü kuruyordu → `sdf.SPLIT`: komşu parmak eksenleri arasından ince dilim ÇIKARILIYOR (`smax`, yarı kalınlık 3 mm, k 2,2 mm; serbest falankslarda her yönden, boğum arası olukta yalnız EL SIRTI tarafında — avuç içi perdesi korunur). Üçgen 4 644→**4 728** (≤5 000), low 2 456, distant 932; `fpHandBuildMs` 66–77 ms; voxel değişmedi. Yeni test: bind + `rest`/`holdFan3`/`holdGun`/`openPalm` pozlarında komşu falanks yüzeyleri arasında boşluk > 0. Kareler `docs/qa/claude/d1/{fused-before-after,fused-grid-after}.jpg` + `webless-*` yenilendi; rapor `docs/qa/claude/D1-hands.md` "Tur 6". D16 kareleri de bu geometriyle yeniden alındı. NOT: `holdBallot`/`holdGun` sırtında parmak arasından görünen şerit kusur DEĞİL, baş parmağın ucu. **Ek (D3.4 devri):** ilk şahıs eli artık oyuncunun ten tonunu alıyor — `hands/geometry.{tintVertexColors,tintedHandGeometry}` (öznitelikler paylaşılır, yalnız `color` kopyalanır), `SkinnedHand`/`HandRig` `skin` propu, `TableScene`+`FirstPersonStage` `seatAvatar(player).skin`; `/dev/hands?skin=`; kare `docs/qa/claude/d1/skin-tones.jpg`; `docs/qa/claude/D3-characters.md` §4/2 KAPANDI.
- D13 koltuk yaw sınırı 1,4 rad (2026-09-12 00:35, prototype/model.ts; 60 sahne testi geçti). D2 oda tasarım taslağı TESLİM (2026-09-12, Fable): `docs/design/D2-room.md`, `docs/design/d2/` (plan/elevation/concept SVG + PNG, `gen_d2.py`); 1932 Berlin arka odası, sekizgen kabuk, ≈41 çizim (+22), ≈16 k üçgen, ≈8,6 MB doku; kullanıcı onayı bekliyor (3 soru). Kod yok.
- D2 oda **TESLİM** (2026-09-12 01:30–03:10, Opus yan ajan) — kullanıcı görsel kabulü bekliyor. Rapor `docs/qa/claude/D2-room.md`, kareler `docs/qa/claude/d2/` (12 jpeg). Yeni: `packages/scene/src/room/{Room.tsx,RoomShell.tsx,RoomFurniture.tsx,RoomDecorations.tsx,roomGeometry.ts,roomMeshes.ts,roomTextures.ts,roomGeometry.test.ts}`. Değişen: `materials/palette.ts` (`room.*`), `TableScene.tsx` (ışık planı + arka plan `room.fog`, sabit `<fog>` kalktı), `prototype/FirstPersonStage.tsx`. **Silinen:** `objects/RoomDecor.tsx`. Kullanıcı kararı: sekizgen, gece penceresi, yalnız sis. Ölçüldü: oda 18 çizim (eski 19 → **−1**), 12 836 üçgen, ≈11,55 MB doku, 3 nokta ışık; low 9/2 344/1. 10 kişilik koltuk CPU 4× 59,5 → 59,9 FPS. Sapma: genel bakış ve tahta incelemesinde avize+tavan göbeği gizlenir (bu kameralar kadrajı tümüyle kapatıyordu); duman tutamı yok (kullanıcı kararı); köşe eşyaları pah içine çekildi. GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **627** (11/37/70/**275**/35/199), `pnpm --filter @secret-table/web build`. Commit YOK.
- D14 dev senaryo modu **TESLİM** (2026-09-12 09:49–10:20, Opus yan ajan) — kullanıcı doğrulaması bekliyor. Rapor `docs/qa/claude/D14-dev-scenario.md`, kareler `docs/qa/claude/d14/` (9 jpeg). Yeni: `packages/game-core/src/{devScenario.ts,devScenario.test.ts}`, `packages/server/src/service.dev-scenario.test.ts`, `apps/web/src/dev/devScenarioMenu.tsx`, `apps/web/src/ui/GameMenu.dev.test.tsx`. Değişen: `packages/contracts/src/{commands.ts,schemas.ts}` (additive `dev_scenario`; `CONTRACT_VERSION` 0.2.0 SABİT, paket 0.2.1), `packages/game-core/src/index.ts`, `packages/server/src/service.ts` (`runDevScenario` + `SECRET_TABLE_DEV_TOOLS==='1'` kapısı; kapalıysa `NOT_ALLOWED`), `apps/web/vite/apiPlugin.ts` (yalnız dev sürecinde env; `.env`'e yazmaz), `apps/web/src/ui/GameMenu.tsx` (tembel "Geliştirici" bölümü), `apps/web/src/dev/botRunner.test.ts`, `docs/{CONTRACT.md §9.6,DEPLOYMENT.md §6,ROADMAP.md}`. Kullanım: oyun içinde `M` → Geliştirici → "İnfaza atla (şimdi)" / "İnfaz turu (kanunlar hazır)". botRunner DEĞİŞMEDİ (yetki insandayken bot oynamıyor; test eklendi). GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **669** (11/37/**98**/275/**44**/**204**), `pnpm --filter @secret-table/web build`; dist'te `dev_scenario`/`Geliştirici`/`devScenarioMenu` için 0 eşleşme. Canlı: yerel lobide bot modu + oyun + menüden infaza atlama + hedef seçme → `player_eliminated` doğrulandı. Commit YOK.

- D15 koltuktan tahtaya eğilme **TESLİM** (2026-09-12 11:20–12:05, Opus yan ajan) — kullanıcı görsel kabulü bekliyor. Rapor `docs/qa/claude/D15-lean.md`, kareler `docs/qa/claude/d15/` (9 jpeg). Değişen: `packages/scene/src/layout/{cameraFraming.ts (`lean` kipi + saf `leanFrame`/`LEAN_LOOK`/`LEAN_TARGET`/`BOARD_SPAN`),presentation.ts (`BoardInspection` + `lean`, `boardInspectionForToggle`)}`, `prototype/SeatCamera.tsx` (eğilme dalı + göz gezdirme, geçişe `duration`/`arc`), `live/useSceneControls.ts` (`lean`: bakış açık ama çapalı ±12°/±8°), `TableScene.tsx` (eğilmede el yok, avize yok, alt şerit yok), `room/Room.tsx` (yeni `overhead` propu), `apps/web/src/immersive/{controlScheme.ts (`B`=`lean-board`, `Esc`=`exit-lean`, `LeanState`, HUD),useTableControls.ts}`, `apps/web/src/ui/{GameScreen.tsx,SceneFrame.tsx}`. Kullanım: koltukta `B` / sağ üst **Tahta** → 500 ms yaylı geçişle göz (0, 1,375, 1,10) · eğim 48° · fov 43,9° (1920×1080); `B`/`Esc` geri. Genel bakışta **Tahta** eski tepeden inceleme (değişmedi). Eğilmede çizim 181→133. Sözleşme/sunucu/game-core DEĞİŞMEDİ. GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **717** (11/39/98/**308**/44/**217**), `pnpm --filter @secret-table/web build`. Commit YOK.
- D12 tur 5 silah HD (2026-09-12, Opus yan ajan, D12 ajanı): `packages/scene/src/props/{gun.ts,GunProp.tsx}`, `materials/palette.ts`; TableScene/kontrollere dokunmaz.
- D17 yasamada kamu elinde kart sırtları **TESLİM** (2026-09-12 15:20–16:40, Opus yan ajan) — kullanıcı görsel kabulü bekliyor. Rapor `docs/qa/claude/D17-office-hands.md`, kareler `docs/qa/claude/d17/` (9 jpeg). Yeni: `packages/scene/src/live/{officeHands.ts,OfficeHand.tsx,officeHands.test.ts}`, fixture `legislative-{president,chancellor,veto}-seat` + ölçüm tabanı `legislative-seat-idle`. Değişen: `TableScene.tsx` (ofis eli mount + `flowTarget` + `data-scene-office-hand`), `live/PublicArms.tsx` (ofis elinde tek-el moduna geçer). Kural: YALNIZ kamu bilgisi (`phase` + `office`) — `president_discard` başkan 3 `holdFan3`, `chancellor_choice`/`veto_response` şansölye 2 `holdFan2`, başka fazda yok; cue'suz yeniden bağlanmada durum fazdan türer; yerel oyuncunun kendi eli değişmez; jest oynarken ofis eli çizilmez. Kart sırtları TEK `InstancedMesh` + paylaşılan sırt dokusu. Ölçüm (aynı masa, faz farkı): 193 → **197 çizim (+4)**, 310 200 → 310 272 üçgen (+72); diğer koltuklarda 0. Koltuk kamerasında uçuşu OfficeHand, genel bakışta mevcut `CueEffects` çizer (çift çizim yok). GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` (19/55/98/332/51/245), `pnpm --filter @secret-table/web build`. Sözleşme/sunucu/game-core DEĞİŞMEDİ. Commit YOK.
- D16 el jestleri **TESLİM** (2026-09-12 12:40–14:10, Opus yan ajan) — kullanıcı görsel kabulü bekliyor. Rapor `docs/qa/claude/D16-emotes.md`, kareler `docs/qa/claude/d16/` (23 jpeg). İki tur tek oturumda. Yeni: `packages/scene/src/live/{EmoteOverlay.ts,EmoteArms.tsx,emotes.test.ts}`, `apps/web/src/immersive/{emoteWheel.ts,useEmoteWheel.ts,emoteControls.test.tsx}`, `apps/web/src/ui/EmoteWheel.tsx`, `packages/fixtures/src/scenes/emotes.ts` (11 senaryo: `emote-point-seat`, `emote-hands-up-seat`, `emote-peer-*`, `emote-crowd`, `emote-local`, `emote-local-hand`). Değişen: `packages/contracts/src/{viewpoint.ts (additive `emote` + `EMOTE_*`),scene.ts (`ImmersiveSceneProps.emote`)}` + paket **0.2.2** (`CONTRACT_VERSION` 0.2.0 SABİT), `apps/web/src/multiplayer/{viewpointProtocol,viewpointChannel,useRoomState}.ts` (bilinmeyen kind düşer; hemen + 250/600 ms aynı `seq`; 1,2 s hız sınırı), `apps/web/src/immersive/{controlScheme,useTableControls}.ts`, `apps/web/src/ui/{GameScreen.tsx,styles.css}`, `packages/scene/src/{TableScene.tsx,prototype/{HandRig.tsx,rig.ts},live/PublicArms.tsx,characters/CharacterAvatar.tsx,objects/Nameplate.tsx,hands/poses.ts,audio/SceneAudio.ts}`, `docs/design/d1/poses.json` (4 yeni kavrama EKLENDİ, biçim korundu), `docs/CONTRACT.md §5A.1`, dev sayfaları (`DevScenePage`/`DevGamePage`/`useFrozenScene`). **Kullanıcı kararı:** alt şerit çipi yerine `G` ile açılan dairesel **jest çarkı** (1–8 / ok / WASD / fare deltası / sol tık-Enter / basılı tut-bırak; telefonda "Jest" düğmesi, min 260 px). Kamu jesti karakterin omuz+dirsek kemiklerini de döndürür (kopuk el yok). Ölçüm: boşta 196 çizim, jest bitince yine **196** (ek 0), oyuncu başına jest **+3**, üç jest +11, yerel ilk şahıs **+0**; `clap` sesi tepe 0,32. GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **759** (13/50/98/322/44/232), `pnpm --filter @secret-table/web build`. Canlı iki tarayıcı gecikme ölçümü YAPILMADI (raporda §7). Ajan commit atmadı; kullanıcının 12:18'deki `3bc5101` commit'i D16'nın yarım hâlini kısmen süpürdü (sözleşme, viewpoint protokol/kanal, useRoomState, controlScheme, useTableControls, poses.json), geri kalanı çalışma ağacında. **Tur 3 (2026-09-13, Opus 5 yan ajan) — bütün jestler bakış yönünü izler** (kullanıcı: "işaret jestinde el dönüyor, diğerlerinde dönmüyor"): `packages/scene/src/live/EmoteOverlay.ts` ilk şahısta sekiz jestin de el(ler)ini göz altı gövde çıpası `EMOTE_POINT_PIVOT` etrafında `look.yaw` kadar KATI döndürüyor (konum `swing`, dönüş dünya yaw quaternion ÖN çarpımı — `rotation[1]`'e ekleme DEĞİL, çünkü `rotation[0]` ≈ ±90° olan jestlerde burulma üretiyordu); kamu tarafında her jestin `target`ı koltuk yerel dikey eksende dönüyor (tek elli: omuz çıpası = `point` kuralı; iki elli: gövde merkezi + yeni `EMOTE_TWO_HAND_YAW` ±60° kırpması, `clap`te eller ayrılmasın diye). `point` çıktısı ve `aimArm` IK'sı DEĞİŞMEDİ; yaw 0'da tur 1/2 karesi birebir. Kamu bakışı `ViewpointAdapter`'da zaten ±0,65 rad'a kırpılı olduğu için ±60° sınırı pratikte devreye girmiyor. Ayrıca `apps/web/src/dev/DevScenePage.tsx`: `sweep` parametresi yokken her sahneyi tarama kipine sokan hata düzeltildi (kamu jesti fixture'ları hiç görünmüyordu) + dev `&peerYaw=<rad>` ezmesi. Test 1012 → **1017** (`live/emotes.test.ts` 11 → 16). `pnpm -r typecheck` 6/6 ✓, `pnpm --filter @secret-table/web build` ✓, çizim 196/199 (değişmedi). Kareler `docs/qa/claude/d16/{local-hands_up,local-clap,local-facepalm,seat-hands_up,seat-wave,seat-clap}-t3.jpg`, rapor `docs/qa/claude/D16-emotes.md` §9. Sözleşme/sunucu/game-core/tasarım notu değişmedi; commit atılmadı.
- D3.4 lobi karakter seçimi **TESLİM** (2026-09-12 13:56–15:20, Opus yan ajan) — **⚠️ `supabase/migrations/0008_avatar.sql` UYGULANMADI; kullanıcı uygulayana kadar canlı (Supabase kipli) lobide karakter seçimi HATA verir, okuma yolu varsayılana düşer.** Rapor `docs/qa/claude/D3-characters.md` "D3.4 lobi karakter seçimi", kareler `docs/qa/claude/d3/lobby-picker-{desktop,secim,telefon,masa}.jpg`. Yeni: `supabase/migrations/0008_avatar.sql`, `packages/contracts/src/{avatars.ts,avatars.test.ts}`, `apps/web/src/ui/{AvatarPicker.tsx,AvatarPreview.tsx,avatarText.ts,avatarText.test.ts}`, fixture `lobby-avatars`. Değişen: `packages/contracts/src/{scene.ts (`PlayerView.avatar`),lobby.ts,commands.ts (`set_avatar`),schemas.ts,index.ts}` + paket **0.2.3** (`CONTRACT_VERSION` 0.2.0 SABİT), `packages/server/src/{gateway.ts,memory-gateway.ts,supabase-gateway.ts,service.ts,projection.ts (`resolveAvatars`)}`, `packages/scene/src/{layout/seats.ts (`seatAvatar`),TableScene.tsx,prototype/FirstPersonStage.tsx,characters/{spec.ts,CharacterGallery.tsx (`mode="single"`),index.ts}}`, `apps/web/src/{ui/{Lobby.tsx,LobbyTable.tsx,styles.css},multiplayer/useRoomState.ts,dev/botRunner.ts}`, `packages/fixtures/src/{builders.ts,scenes/lobby.ts,registry.ts}`, `docs/CONTRACT.md §3/§9.5/yeni §9.7`. Kararlar: kimlik listesi sözleşmede (`avatars.ts`) — sunucu three içe aktaramaz; benzersizlik YOK, sunucu yalnız seçilmemiş koltuğun varsayılan tenini kaydırır (`suggestSkin`). **Sapmalar:** lobi için Realtime sürüm sinyali yok (`set_ready` ile aynı yol, 3 s yoklama); kendi ilk-şahıs elinin ten tonu bağlanmadı (`hands/SkinnedHand.tsx` başka ajanda, dokunulmadı — kamu elleri seçilen tenle çiziliyor). GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **788** (19/51/98/324/51/245), `pnpm --filter @secret-table/web build`. Canlı: yerel 5200 bellek kipinde 5 kişilik lobide seçim → kayıt → masada görünüm doğrulandı. Commit YOK.
- D1 tur 6 el yapışıklıkları (2026-09-12, D16 ajanı): `packages/scene/src/hands/*`.
- **Oyun mantığı denetimi TESLİM** (2026-09-12, Opus yan ajan; rapor `docs/qa/claude/RULES-AUDIT-2026-09-12.md`) — motor kodu DEĞİŞMEDİ, yalnız test eklendi: `packages/game-core/src/engine.simulation.test.ts` (5–10 kişi × 300 tohumlu rastgele oyun = 1 800 oyun, 11 değişmez: 17 kart korunumu, roller sabit, ölü komut veremez, oyun her zaman biter, bitiş nedeni tutarlı, sayaç 0–2, tur kısıtı, yetki doğru yuvada bir kez, kaos yetki açmaz, saflık/belirlenimcilik, geçersiz komut durumu değiştirmez — **hepsi GEÇTİ**) ve `packages/server/src/projection.privacy.test.ts` (72 oyun × her adım × her oyuncu gizlilik süpürmesi + 6 noktasal kontrol — **sızıntı yok**: rol/el/oy/inceleme/deste tepesi sızmıyor, Hitler 7+'da faşistleri görmüyor, cue'lar alıcı bazında süzülü). Resmî kural kitapçığıyla madde madde karşılaştırma yapıldı; engelleyici bulgu 0. **Önemli: (B1)** `investigate_loyalty` tekliği (başkan,hedef) çifti üzerine kurulu — resmî kural "No player may be investigated twice in the same game", farklı başkan aynı kişiyi ikinci kez inceleyebiliyor (1 800 oyunun 41'i, yalnız 9–10 kişi); düzeltme `game-core/src/selectors.ts:65-76` + `engine.ts:510`. **(B2)** `optionId` atlanınca sunucu sessizce ilk seçeneği uyguluyor (`server/src/engine-map.ts:35-38`; ölçüldü: oy→"evet", adaylık→ilk uygun oyuncu, veto→kabul); `INVALID_OPTION` dönmeli. Küçük: B3 deste yeniden karıştırma zamanı (herkese açık `drawCount` fiziksel masadan farklı), B4 `cues` yalnız hamleyi YAPANA gidiyor (`service.ts:361` `getView` her zaman `cues: []`) — bu yüzden §2'deki "`cards_moved` üretilmiyor" saptaması motor katmanında ARTIK GEÇERSİZ (`engine.ts:297,397,399,425,466` üretiyor; eksik olan dağıtım), B5 `commandKey` CAS döngüsü dışında, B6 `veto_response`'ta el başkana da gidiyor (sızıntı değil, gerekçesiyle sabitlendi). GEÇTİ: `pnpm --filter @secret-table/game-core test` **107**, `pnpm --filter @secret-table/server test` **63**, `pnpm -r typecheck` 6/6. Commit YOK. Karar: **mantık oynamaya hazır**.
- 0008_avatar migration uzak Supabase'e UYGULANDI (2026-09-12, Management API; sütunlar + CHECK + schema_migrations doğrulandı).
- GEÇİCİ Vercel dev araçları kapısı (2026-09-12, Claude): `apps/web/src/devTools.ts` (`DEV_TOOLS = DEV || VITE_ST_DEV_TOOLS==='1'`), routes/GameMenu/Lobby bu sabiti kullanır; Vercel'de `VITE_ST_DEV_TOOLS=1` + `SECRET_TABLE_DEV_TOOLS=1` kullanıcı ekler, test bitince SİLİNİR (docs/DEPLOYMENT.md §6). Kanıt: bayraksız dist 0 eşleşme, bayraklı dist botRunner/DevScenePage chunk'ları.
- **E2E canlı uçtan uca QA raporu** (2026-09-12, Opus yan ajan, yalnız test): `docs/qa/claude/E2E-2026-09-12.md` — 96 kare `docs/qa/claude/e2e/`; karar "oynamaya hazır (masaüstü evet, telefon şartlı)", engelleyici 0; önemli: vurulan oyuncunun ekranı görünmüyor, kurban infazı görmüyor, CPU 4×'te ilk 10–20 s ısınma takılması, telefon HUD sarması + jest çarkı kapanmaması, lobi avatar senkronu ~3 s. Kod DEĞİŞMEDİ, commit yok.
- D18 oynanış öncesi düzeltmeler **TESLİM** (2026-09-12 17:05–19:50, Opus yan ajan) — kullanıcı doğrulaması bekliyor. Rapor `docs/qa/claude/D18-fixes.md`, kareler `docs/qa/claude/d18/` (15 jpeg + `e2e-d18-log.txt`). **Migration GEREKMEDİ.**
  (1) **Cue dağıtımı (B4):** son komutun olayları durum satırıyla saklanıyor — `GameStateRecord.lastEvents` + `CommitMoveInput.lastEvents` (`gateway.ts`), bellek kipinde alanda, Supabase'de `game_states.state` JSONB zarfının ayrılmış `__lastEvents` yan alanında (`withLastEvents`/`splitEnvelope`; `commit_move` imzası ve `0002_functions.sql` DEĞİŞMEDİ, eski satırlar `null` döner). Sözleşme additive `PlayerViewRequest.sinceRevision` + `playerViewRequestSchema` (paket **0.2.4**, `CONTRACT_VERSION` 0.2.0 SABİT), `docs/CONTRACT.md` yeni **§7.1**. `getView` → `cuesSince`: yalnız `revision === sinceRevision + 1` iken alıcıya süzülmüş `eventsToCues`, aksi hâlde/`resync`'te `[]`. İstemci: `apiClient.fetchView(…, sinceRevision)`, `useRoomState` sürüm sinyalinde `lastRevision` gönderir ve cue'ları `mergeCues` kuyruğuna verir; `cueId` (`gameId:revision:index`) deterministik olduğu için hamleyi yapan iki yoldan alsa bile bir kez oynar.
  (2) **Vurulan oyuncunun ekranı:** katman görünümden türüyor — `!alive` iken vinyet + "VURULDUN" KALICI (başlık artık `shotFresh` koşulunda değil), cue varsa giriş 1300 ms gecikir (varış anı `ref`'te latch'lenir; cue kuyruğu boşalınca katman kaybolmaz), cue yoksa anında. CSS: `shot-title` %85'te kalıyor, vinyet dinlenme 0,25 → 0,45. Tanı `data-shot="fired|persistent"`.
  (3) **Kural B1:** `i.actorId === presidentId &&` kaldırıldı (`selectors.ts`, `engine.ts`, `test-helpers.ts`) — teklik başkandan bağımsız. Simülasyonda "çift inceleme 0", `engine.powers.test.ts` koşullu dalı kalktı.
  (4) **Sunucu B2:** `engine-map.ts` seçenek sayısı > 1 iken `optionId` ZORUNLU (`INVALID_OPTION`); tek seçenekli onaylar/`policy_peek` etkilenmez, `respond_veto` açıkça şart koyar. Şemada `ACTIONS_REQUIRING_OPTION` (act_nominate/act_vote/act_discard/act_enact/act_respond_veto). botRunner + istemci zaten hep `optionId` gönderiyor (kontrol edildi).
  (5) **Telefon:** jest çarkı zeminine `pointerdown` (dokunma da kapatır), çark altında yeni **"Geri"** düğmesi, `useEmoteWheel` additive `phaseKey` ile faz değişince kapanır; `@media (max-width: 430px)` araç çubuğunu sıkıştırır (ölçüm: durum şeridi 22 px / çubuk 30 px → 8 px boşluk, çakışma yok, yatay taşma 0; D11 `--hud-top` JS ölçümü korundu).
  Değişen: `packages/contracts/src/{commands.ts,schemas.ts}` + package.json, `packages/server/src/{gateway.ts,memory-gateway.ts,supabase-gateway.ts,service.ts,engine-map.ts}`, `packages/game-core/src/{selectors.ts,engine.ts,test-helpers.ts}`, `apps/web/api/game.ts`, `apps/web/src/multiplayer/{apiClient.ts,useRoomState.ts}`, `apps/web/src/immersive/useEmoteWheel.ts`, `apps/web/src/ui/{GameScreen.tsx,EmoteWheel.tsx,styles.css}`. Yeni test: `server/src/{service.cues.test.ts,engine-map.options.test.ts}`, `apps/web/src/multiplayer/useRoomState.cues.test.tsx`.
  GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **849** (26/55/107/332/74/255; D18 öncesi 821), `pnpm --filter @secret-table/web build`. Canlı (5199, gerçek Supabase, 4 gerçek bağlam + 1 bot): A infaz → **kurban ve iki seyirci de cue aldı** (sayaç 0→2 / 2→3), kurbanda VURULDUN + vinyet + eller boş, yenilemeden sonra `persistent`, telefonda çark üç yoldan kapandı. **Sapma:** yerel koşuda Realtime sürüm sinyali gelmedi, 12 s'lik yedek HTTP kontrolü devraldı → görünüm tazeleme gecikmesi 1,2–12,4 s (cue mantığı değil; D18 öncesinde de vardı). Realtime gecikmesi ölçülmedi. Commit YOK.
- D19 nasıl oynanır + dev senaryoları + kural doğrulama **KISMEN TESLİM** (2026-09-12 19:52–21:05, Opus yan ajan) — rapor `docs/qa/claude/D19-rules-howto.md`, kareler `docs/qa/claude/d19/` (14 jpeg). Yeni: `apps/web/src/ui/{howToPlay.ts,howToPlay.test.ts,HowToPlayPanel.tsx,GameMenu.tabs.test.tsx}`. Değişen: `packages/contracts/src/{commands.ts,schemas.ts,index.ts}` (+paket **0.2.5**, `CONTRACT_VERSION` 0.2.0 SABİT; `DEV_SCENARIO_NAMES` 2→9), `packages/game-core/src/{errors.ts (`SCENARIO_NEEDS_PLAYERS`),devScenario.ts,devScenario.test.ts}`, `packages/server/src/{errors.ts,service.dev-scenario.test.ts}`, `apps/web/src/ui/{GameMenu.tsx (sekmeler: Ayarlar/Nasıl oynanır/(DEV) Geliştirici),GameMenu.dev.test.tsx,Lobby.tsx,Lobby.test.tsx,styles.css}`, `apps/web/src/dev/{devScenarioMenu.tsx,botRunner.ts (BOT_NAMES 9, veto %30/%50),botRunner.test.ts}`. Sapmalar: bileşen dosyası `HowToPlayPanel.tsx` (macOS harf duyarsızlığı `HowToPlay.tsx` ↔ `howToPlay.ts` çakışması); `veto_round*` seçim sayacını sıfırlamaz; canlı tur bellek kipinde (5200) yapıldı (Supabase 429 riski). Canlı: **7 kişilik odada 27 GEÇTİ / 2 KALDI** (ikisi betik kaynaklı yanlış negatif); 9 kişilik oda (`d19-9p.mjs` hazır, koşturulmadı), canlı Hitler bölgesi/Hitler infazı, 5-6 deste tepesi ve "5 liberal zafer" KALDI. GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **941** (26/55/147/332/84/297), `pnpm --filter @secret-table/web build`; dist'te dev izi 0 eşleşme. Commit YOK.
- D20 realtime sürüm sinyali **TESLİM** (2026-09-12 19:52–20:50, Opus yan ajan) — kullanıcı doğrulaması bekliyor. Rapor `docs/qa/claude/D20-realtime.md`. **Kök neden D18'in sandığı değil:** sinyal ULAŞIYOR — `game_states_notify` → `notify_room_revision` → `realtime.send(..., private=>true)` → `realtime.messages` → istemci `room:<roomId>` özel kanalı uçtan uca çalışıyor, yük tam (`{id,roomId,revision}`), ölçüldü **363 ms** (Management API turu dahil). D18 teşhisi yanlıştı çünkü Supabase Realtime **ikili Phoenix serileştiricisi** kullanıyor, CDP'de metin arayan filtre çerçeveleri görmedi. Gerçek gecikme kaynağı: (a) yedek yoklama 12 s, (b) her sinyalde ARDIŞIK `lobby_view`+`view` iki HTTP turu. Değişen: `apps/web/src/multiplayer/roomChannel.ts` (`ROOM_CHANNEL_EVENT`/`roomChannelTopic`/`BACKUP_POLL_MS=3000` sabitleri, kendini yeniden kuran yoklama + `poke()`), `apps/web/src/multiplayer/useRoomState.ts` (yeni `fetchAndApplyView` + hızlı yol `refreshView` — oyun içinde yalnız `view`; `applyView`'da `poke()`). Yeni `roomChannel.test.ts` (7), `useRoomState.cues.test.tsx` +1. Denenip GERİ ALINAN: bakış kanalından eş sürüm ipucu (`sendRevision`, 328 ms ölçüldü ama DB sinyali zaten hızlı → gereksiz); `viewpointProtocol.ts`/`viewpointChannel.ts` ve testleri DOKUNULMAMIŞ hâlde. **Migration GEREKMEDİ** (DB tarafı doğrulandı: tetikleyici, RLS `room_channel_read`, 0004/0005 grant'ları, `supabase_realtime_messages_publication`, bölümler, replikasyon yuvası). Ölçüm (5202 dev, gerçek Supabase, A+B+3 bot, 8 örnek): A tık → B görünüm ort. **2,5 s** / maks 2 967 ms / min 1 214 ms; sinyal → görünüm 1,6–1,9 s (yerel dev API köprüsü baskın, üretimde yeniden ölçülmeli); yedek yoklama devreye GİRMEDİ. GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **941** (26/55/147/332/84/297), `pnpm --filter @secret-table/web build`. Commit YOK. Kalan: üretim ölçümü, `view` için "sürüm değişmedi" kısa yanıtı (service.ts D19'da), kanal sağlığının `connection`'ı beslemesi.
- Teslim edilip kullanıcı kabulü bekleyenler: D1 eller (4 tur), D5 oy rozetleri, D6 etiketler, D9 duyurular, D10 tahtalar, D11 tam ekran (canlı doğrulama), D3 karakterler (4 tur + D3.4 lobi seçimi — 0008 migration kullanıcıda), D8 tasarım taslağı (4 onay sorusu). Commit kullanıcıda.

## 2. Bugün doğrulanan gerçekler

- Git temiz, HEAD be9f985; canlı paket bu commit'i içeriyor; `/api/health` 200.
- **Canlı tarayıcı paketinde Supabase URL/publishable anahtar YOK** (paket indirilip
  arandı; proje referansı 0 eşleşme). Üretim istemcisi `dev:` token üretiyor →
  sunucu 401 `SESSION_INVALID`. be9f985'teki oturum sıfırlama üretimde çalışmıyor
  (`mode === 'dev'`). Çözüm Vercel env + yeni build; kod tarafı A0.
- CODEX-017 uygulama maddeleri kaynakta yapılmamış (bkz. ROADMAP A3). Sahnedeki
  "Kendi koltuğum" düğmesi üretimde etkisiz.
- ~~`cards_moved` cue'su hiçbir yerde üretilmiyor (ROADMAP A4).~~ **Yanlış saptama:** motor üretiyor (`engine.ts`), `projection.eventsToCues` cue'ya çeviriyor; eksik olan DAĞITIM yoluydu (RULES-AUDIT B4) ve D18'de kapandı — `getView({ sinceRevision })`.
- 0006 uzak migration son kayda göre uygulanmadı; bu oturumda henüz doğrulanmadı.

## 3. Belge düzeltmeleri

- CONTRACT.md §5A eski (kanal adı, 120 ms, `t` anlamı) → kod ve NETWORK-INTEGRATION
  esas; A2/A3 turunda güncellenecek.
- PLAN.md "Vercel ertelendi", eski CLAUDE.md "Vercel açılmaz", QA/J01 "commit yok"
  notları tarihsel; ROADMAP.md günceldir.

## 4. Doğrulama (2026-09-10 19:45)

- A0 kod: `guestSession.ts` üretimde `CLIENT_NOT_CONFIGURED` fırlatır; `text.ts`
  Türkçe metin; Entry/Join `errorText` ile gösterir; giriş altbilgisinde
  "istemci: canlı/yerel". Yeni `guestSession.test.ts` (6 test).
- A1 YAPILDI: uzak history `0001–0007` tam; `restart_finished_game` var, EXECUTE
  yalnız postgres+service_role. Uygulama Management API ile tek transaction.
  Canlı rematch DOĞRULANDI (16:52 UTC): oda af9263f7, 6 bot, game_over rev 101 →
  play_again → yeni gameId, role_reveal, rev 102; host olmayan/devam eden oyun NOT_ALLOWED.
  `.claude/launch.json` dev sunucu artık kök `.env`i yükler (API köprüsü için).
  CONTRACT.md §5A koda göre güncellendi.
- GEÇTİ: `pnpm typecheck` 6/6; `pnpm test` **285** (contracts 11, fixtures 28,
  game-core 65, scene 79, server 33, web 69).
- Kullanıcı 19:45'te birkaç saat ayrıldı; Vercel env'i o dönünce ekleyecek.
  Talimat: Production + Preview'a `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  ekle, "Redeploy" değil yeni build (cache kapalı) al; girişte "istemci: canlı" görünmeli.
- A4 TESLİM (Opus): engine 5 üretim noktası, projeksiyon herkese, sahne `cueOfficePlayerId`
  (office boşsa `lastElection` elected). game-core 70, scene 83, server 35 test. Rapor
  `docs/qa/claude/A4-cards-moved.md`.
- A2+A3 TESLİM (Opus): GameScreen tam ekran; üst bilgi şeridi (`statusLine.ts`), alt
  `ActionBar`, `GameMenu` (M), RolePanel katmanı, oyun sonu katmanı; CODEX-017/2-5 tamam.
  Rapor `docs/qa/claude/A2-A3.md`, görseller `docs/qa/claude/a2-a3/`.
- **Karar (CODEX-017/1 sapması, Claude onayı):** sahne en az bir dolu yuva bildiriyorsa
  yalnız o liste yetkili (null = eylem yok); sahne hiç yuva sahiplenmiyorsa (genel masa
  kamerası, telefon) uygulamanın sunucudan gelen `view.actions` sırası kullanılır. Aksi
  hâlde kilit olmadan oyun oynanamıyordu. Codex teyidi gerekmiyor; sahne sahibi Claude.
- GEÇTİ (20:50): typecheck 6/6; `pnpm test` **330** (11/28/70/83/35/103); `pnpm build`.
- Açık: gerçek Pointer Lock ile E/sol tık → `target()` yalnız birim testli; sahnenin
  kendi sağ üst düğme şeridi uygulama kontrolleriyle yan yana (menüye taşınabilir).

## 4A. Yerel kabul koşusu (2026-09-10 20:35–20:50) — GEÇTİ

- Gerçek tarayıcı (ajan paneli) host + 5 gerçek anon bot (`scratchpad/party.mjs`,
  artık yeniden deneme + oturum kaydı ile), oda `6543fabf`/`HM6E5J`, yerel API + uzak
  Supabase. Rol onayı, oy, şansölye kanun seçimi yeni alt çubuk + klavye yolundan geçti.
- Panel kusurları (uygulama değil): otomasyon tuşları `code` boş gönderiyor (→ `key`
  yedeği eklendi), ResizeObserver panelde tetiklenmiyor (canvas gecikmeli/300×150),
  yan oturum aynı paneli kullanınca sekme yönlendiriliyor.
- Ara bulgu: dev sunucu `vite.config.ts` değişince yeniden başlıyor; bot yardımcısı
  ilk koşuda bu yüzden düştü, ikinci koşuda dayanıklı.
- SONUÇ: oyun `game_over` (faşist, rev 90); oyun sonu katmanı Türkçe rol/kazanan +
  host düğmeleri; tarayıcıdan "Aynı oyuncularla yeniden oyna" → yeni `role_reveal`.
  Yeni ekranla tam oyun + rematch yerelde GEÇTİ (botlarla; insan grubu değil).
- C2 TESLİM (Opus): `SceneFrame` sahneyi `React.lazy` + `import()` ile yükler,
  lobide `preloadScene()` ön-yükler; `three` ve `react-vendor` ayrı chunk.
  **İlk yükleme JS 1.568 → 577 kB (gzip 443 → 172 kB)**; 3,94 MB font artık yalnız
  sahne chunk'ıyla iniyor. Telefon: `(pointer: coarse)`ta klavye rozetleri gizli,
  "Oyuna odaklan" yerine yalnız "Tam ekran" (`enterFullscreenOnly`), sahne şeridi
  ≤767 px'te alt çubuğun üstünde tek satır kaydırılabilir. Font ALT KÜMESİ
  YAPILMADI (fontTools/pyftsubset makinede yok). typecheck 6/6, `pnpm test` 330,
  `pnpm build` geçti. Rapor `docs/qa/claude/C2-bundle-mobile.md`.

## 4B. 2026-09-11

- `pnpm dev` API köprüsü kök `.env`'i kendisi yüklüyor (apiPlugin `envDir`); kullanıcının
  yerel "sunucu yapılandırması eksik" hatası kapandı; launch.json düz `pnpm dev`.
- Kullanıcı yeni öncelik listesi verdi → ROADMAP §D (D1–D8). D4 kural kontrolü yapıldı: uygun.
- Kullanıcı: B6 lobi de beğenilmedi; eller "top top" ve iç içe geçiyor → D1 = kemikli tek parça el, D8 = önce tasarım taslağı. **Şimdilik kod yok, plan.**
- Kullanıcı 2026-09-11: GPT/Codex tarafı bırakıldı; tasarım/model işini de Claude yapar. Blender yok → el ve karakterler kodda prosedürel (SDF kapsül → marching cubes → SkinnedMesh). ROADMAP D1–D3, §D ve COORDINATION buna göre güncellendi.

## 5. Sonraki üç adım

1. Kullanıcı: canlı tur (D1/D5/D6/D9/D10), commit, D8 cevapları.
2. D3 karakterler: plan `docs/design/D3-characters-plan.md` onaylanınca D3.1 tasarım sayfası (Fable) → D3.2 taban gövde (Opus). Kullanıcı "hemen başlama" dedi.
3. D8 kod (cevaplar gelince), D2 oda, D7 cila.

## Karşı ajana

- Açık mesaj yok. Codex tarafı 2026-09-11'de kapatıldı; `docs/agents/CODEX.md` ve `docs/qa/codex/**` tarihçe olarak durur.

## 4C. D8 tasarım taslağı (2026-09-11, 09:43)

- Görev: D8 — giriş / katıl / lobi modern tasarım taslağı. **Kod entegrasyonu yok.**
- Yazılan yollar: `docs/design/D8-entry-lobby.md`, `docs/design/d8/{entry,join,lobby}.html`,
  `docs/design/d8/bg-*.{png,webp}`, `docs/design/d8/shot-*.png`. `apps/**`, `packages/**` dokunulmadı.
- D8 TESLİM (10:10): `docs/design/D8-entry-lobby.md` + `docs/design/d8/{entry,join,lobby}.html`,
  `bg-table.{png,webp}` (kaynak `docs/qa/codex/qa-review/effects-deal-mid.png`, y150–900 kırpıldı),
  `shot-*-{390x844,390x844-full,1440x900}.png` (Playwright + yerel Chrome; headless Chrome
  `--window-size=390` macOS'ta min pencere genişliğine takıldı, o yüzden Playwright).
  Yön: sinematik render + cam panel + Fraunces/Inter; lobi koltukları kart ızgarası.
  Kullanıcı onayı bekleniyor (4 soru dokümanın sonunda). Kod yok.

## 4D. D1 eller yeniden yapım (2026-09-11, başlangıç)

- Görev: D1 — bölütlü kapsül+küre eller → prosedürel SDF + marching cubes + `SkinnedMesh`.
- Şartname: `docs/design/D1-hands.md`, `docs/design/d1/poses.json` (değiştirilmez).
- Yazılacak yollar: `packages/scene/src/hands/**` (yeni), `packages/scene/src/prototype/{HandRig.tsx,rig.ts,grip.ts,model.ts,prototype.test.ts}`,
  `packages/scene/src/live/PublicArms.tsx`, `docs/qa/claude/D1-hands.md` + `docs/qa/claude/d1/*.png`,
  `docs/ROADMAP.md` (D1 satırı), `docs/ASSETS.md` (3 satır), bu dosya.
- Dev sunucu yalnız 5199 portunda (kullanıcının 5173'üne dokunulmadı).

### D1 TESLİM (2026-09-11, 11:20) — kullanıcı görsel kabulü bekliyor

- Yeni `packages/scene/src/hands/` (anatomy, sdf, marchingCubes, skeleton, poses,
  contact, geometry, SkinnedHand, hands.test). Eski `HandModel.tsx` ve
  `InstancedHandModel.tsx` SİLİNDİ; `prototype/{grip,rig,model,HandRig,prototype.test}`,
  `live/PublicArms.tsx`, `TableScene.tsx` güncellendi.
- `cardGrip` → `handFromCard(card, side, grip)`; yelpaze pivotu baş parmak yastığı
  (−0.062, 0, 0.110); `HandPose = {position, rotation, grip, blend?}`.
- Sayılar: el başına çizim 3 → **2**; standard 4 950 üçgen / **63–78 ms** üretim;
  koltuk FPS 60 → 60 (CPU 4×), genel masa 29.0 → 25.1 (üçgen +19 k).
- GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **400** (11/28/70/112/35/144),
  `pnpm --filter @secret-table/web build`.
- Sapmalar (rapora yazıldı): seçili kart §e `pinchCard` yerine yan tutuş
  (`holdBallot`) — üst kenar tutuşunda önkol birinci şahıs görüşünü kesiyordu;
  low kademe 1.5 k yerine 2.25 k üçgen; PublicArms için üçüncü (`distant`) kademe;
  üretim kutusu ilkellerden hesaplanıyor (bind pozunda baş parmak §b kutusunu aşıyor).
- Rapor `docs/qa/claude/D1-hands.md`, kareler `docs/qa/claude/d1/before-*|after-*`.
- Açık: genel masa FPS düşüşü (PublicArms üçgenleri), `pinchCard` pozu kullanılmıyor.

### D1 tur 2 — önkol/manşet (2026-09-11, 11:55)

- Koordinatör: yakın planda önkol dev tüp gibi. Düzeltildi: önkol yarıçapı
  .066 → .042/.030, manşet .046 → .040/.029, `elbow(side)` [±.49,.14,1.87] →
  [±.43,.035,1.985], üst kol parçası kaldırıldı (kol örneği 3 → 2, çizim yine 2),
  dinlenme elleri ±.44/.098/1.38.
- Kareler `docs/qa/claude/d1/after2-*.png`; rapora "Tur 2: önkol" bölümü eklendi.
- GEÇTİ: typecheck 6/6, `pnpm test` 400, `pnpm --filter @secret-table/web build`.
- Açık: `inspect` kipinde sağ el incelenen arka kartı tutarken gövdesi öndeki
  kartların arkasında kalıyor, iki parmak ucu kart yüzünde görünüyor.

### D1 tur 3 — manşet ucu + inspect okuma kipi (2026-09-11, 12:25)

- Manşet ters çevrildi (dar ucu kola, `.72·R = .0281` < önkol `.0304`): kol
  tarafındaki kapak önkolun içinde kalıyor, "içi boş tüp" halkası kalktı.
  Manşet boyu .046, bileğe uzaklık .050, silindir 12 → 18 kenar.
- `HandRig`: yeni `reading` bayrağı — `inspect` kipinde sağ el `rest`'te kalır,
  incelenen kart tek başına kalkar. `selected` tutuşu değişmedi.
  Kalan `'pinchCard'` çağrısı `'holdBallot'` ile hizalandı.
- Kareler `docs/qa/claude/d1/after3-*.png`; rapora "Tur 3" eklendi.
- GEÇTİ: typecheck 6/6, `pnpm test` 400, build. Commit yok.

### 4E. D1 tur 4 — el/kart geçiş hataları (2026-09-11, 15:10)

- Kullanıcı gözlemi doğrulandı. **Hata A:** el boşalırken gelen `cards_moved`
  cue'su `place` hareketini 0 kartla oynatıyor, sonra `settledRig('placed')` sol
  eli **boş yelpaze tutuşunda** bırakıyordu. **Hata B:** oy onayında kartlar
  animasyonsuz kayboluyor, `votes_revealed` yoktan kart çeviriyordu.
- Çözüm: `settledRig` kart sayısı 0 iken yelpaze/tutuş üretmiyor; `RigMotion`'a
  **`ghostBacks`** (yalnız kamu ADEDİ) eklendi — `LocalMotion` elin boşaldığı
  sürümü saklıyor, aynı sürümdeki cue hareketi N kapalı sırtla oynatıyor, cue
  yoksa (resync/epoch) hiç oynamıyor. Yeni `ballot` jesti + `voted` pozu: oy
  kartı masada KAPALI kalıyor, `votes_revealed` aynı karttan çeviriyor.
- Dosyalar: `packages/scene/src/prototype/{model,rig,HandRig,FirstPersonPrototype,prototype.test}`,
  `packages/scene/src/live/{LocalMotion,presentation.test}`, `TableScene.tsx`,
  `packages/fixtures/src/scenes/{legislative,election}.ts` + `registry.ts`
  (`president-discarded` additive; `voting` fixture'ında yerel oyuncu artık
  gerçekten oy vermemiş — elde oy kartı çıkmıyordu).
- GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **410** (400 → 410), web build.
  Kareler `docs/qa/claude/d1/after4-*.png` (9 kare, konsol hatası yok),
  betik `scratchpad/d1-shots4.mjs` (port 5199, kapatıldı). Commit yok.
- Canlı bot koşusu yapılmadı: `party.mjs` host'un odayı açıp oyunu başlatmasını
  gerektiriyor. Kanıt fixture geçişleri (gerçek cue + gerçek `LocalMotion`).

## 4F. D5 teslim — oy rozetleri + HUD (2026-09-11, Opus yan ajan)

- Baş üstü rozeti: yeni `packages/scene/src/objects/VoteBadge.tsx` (çizim,
  kameraya dönme, en az 24 px ölçek, 240 ms giriş) + saf `voteState.ts`
  (`voteBadgeState`, `VOTE_REVEAL_MS = 5000`). Oylamada OY VERDİ / BEKLİYOR,
  oylar açılınca EVET / HAYIR. Ölü ve yerel oyuncuda rozet yok. Yalnız kamu
  alanları; `submittedVote` kullanılmıyor. drei `Html` yok, gölge yok,
  `frameloop="demand"` korunuyor.
- **Bulgu:** motorda `election_result` aşaması YOK (`game-core/engine.ts`
  `resolveVote` doğrudan kanun aşamasına/yeni adaylığa geçer; `projection.ts`
  PHASE_MAP'te de yok). Bu yüzden görünürlük `votes_revealed` cue'sunun geldiği
  ana latch'lendi (TableScene) ve 5 sn sürüyor; sentetik `election_result`
  fixture'ı da destekleniyor. HUD de aynı cue'yu ölçü alıyor.
- HUD `statusLine.ts`: oylamada "Bekleyen: …" (≤4 ad + `+N`, yerel "(sen)"),
  oylar açılınca başlık "Hükümet kuruldu: A / B" + "Evet 4 · Hayır 3 · Evet: … ·
  Hayır: …"; kendi sırası olan oyuncuya kısa sayaç eklenir.
- `PlayersPanel.tsx` + `styles.css`: oy sütunu (`✓ oy verdi` / `bekliyor`,
  `✓ evet` / `✕ hayır`). Fixture additive: `voting-waiting`,
  `election-result-close`.
- GEÇTİ: `pnpm -r typecheck` 6/6; `pnpm test` **429** (410 → 429: scene 131,
  web 151, fixtures 31); `pnpm --filter @secret-table/web build`. Kareler
  `docs/qa/claude/d5/*.png` (6 kare, konsol hatası yok), betik
  `scratchpad/d5-shots.mjs` (port 5199, kapatıldı). Rapor
  `docs/qa/claude/D5-votes.md`. Commit yok; kullanıcı görsel kabulü bekleniyor.

## 4G. D9 teslim — ekran ortası faz/olay duyuruları (2026-09-11, Opus yan ajan)

- Saf katman `apps/web/src/ui/announcements.ts`:
  `announcementsFor(view, cues, previous?)`. Anahtar `phase:<phaseId>` /
  `cue:<cueId>` / `history:<entryId>` → duyuru bir kez çıkar; `previous`
  verilmezse (ilk yükleme / yeniden bağlanma) `[]` döner, geçmiş faz
  oynatılmaz. Süre 2600 ms (faz) / 3200 ms (sonuç·tehlike), kuyruk en çok 3.
  Kapsam: ADAY SEÇİMİ · OYLAMA · HÜKÜMET KURULDU/REDDEDİLDİ (+sayaç) · YASAMA ·
  VETO · LİBERAL/FAŞİST KANUN (+3. faşistte Hitler uyarısı, 5.'de veto açıldı) ·
  KAOS · BAŞKANLIK YETKİSİ · İNFAZ · ÖZEL SEÇİM · oyun sonu · ROLLER DAĞITILDI.
- **Bulgu:** sözleşme `veto_enacted` genel geçmiş girişi taşımıyor
  (`projection.ts` düşürüyor). Veto kabulü `cards_moved {chancellor→discard}` +
  aynı grupta `policy_enacted` YOKLUĞUNDAN türetildi.
- Bileşen `Announcer.tsx`: üst-orta `top: 22%` (telefon %24), HUD fontu 40/28 px
  harf aralıklı, yarı saydam koyu pano + pirinç çizgi, 200 ms giriş/çıkış
  (reduced motion'da anında), `pointer-events: none`, `role="status"`,
  `z-index: 25`. `result` tonu bilinçli NÖTR krem (rol ima etmesin).
- `usePrefs.announcements` (varsayılan açık) + `GameMenu` "Duyurular" anahtarı;
  kapalıyken katman hiç çizilmiyor. `GameScreen` bağlandı.
- Fixture additive: `policy-fascist-third`, `execution-result`.
- GEÇTİ: `pnpm -r typecheck` 6/6; `pnpm test` **466** (429 → 466: web 186,
  fixtures 33); `pnpm --filter @secret-table/web build`. Kareler
  `docs/qa/claude/d9/*.png` (4 kare, konsol hatası yok), betik
  `scratchpad/d9-shots.mjs` (port 5199, kapatıldı). Rapor
  `docs/qa/claude/D9-announcements.md`. Contracts / `packages/scene` /
  `docs/design/**` değişmedi. Commit yok; kullanıcı görsel kabulü bekleniyor.

## 4H. D6 teslim — baş üstü isim etiketi (2026-09-11, Opus yan ajan)

- Masa üstü isimlik + makam plakası KALKTI: `OfficePlacard.tsx` ve `VoteBadge.tsx`
  silindi, `seats.plate` → `seats.label` (`[chair.x, .48, chair.z]`). Her avatarın
  başının üstünde tek billboard etiket: isim + makam simgesi/kelimesi + durum +
  D5 oy çipi. Unlit, `depthTest` kapalı, `renderOrder` uzaklığa göre, alt-merkez
  pivot, min 48 css px (kompakt 32), zoom ≤ 2,4. Oyuncu başına ≤ 2 çizim.
- Saf katman `objects/nameplateState.ts` (şartname §5 matrisi; 16 test).
  **`voteState.ts` değişmedi** — D5 gizlilik kuralları aynen.
- drei `Html`, `data-scene-name` DOM düğmesi ve hover balonu kalktı; tıklama ve
  klavye hedeflemesi etiketin kendisinde (billboard içi `TargetZone .60×.18×.02`).
- Çakışma: ekran dikdörtgenleri %15'ten çok kesişirse uzaktaki 300 ms histerezisle
  kompakt olur (`NameplateLayer`); telefon doğrudan kompakt tek satır.
- `palette.ts`: `voteYesText/voteNoText/voteIdleText` + `label.*` tokenleri.
  Contracts ve `docs/design/**` değişmedi.
- GEÇTİ: `pnpm -r typecheck` 6/6; `pnpm test` **482** (466 → 482: scene 147);
  `pnpm --filter @secret-table/web build`. Kareler `docs/qa/claude/d6/*.png`
  (6 kare, konsol hatası yok, `[data-scene-name]` = 0), betik
  `scratchpad/d6-shots.mjs` (port 5199, kapatıldı). Rapor
  `docs/qa/claude/D6-nameplate.md` (sapmalar orada). Commit yok; kullanıcı görsel
  kabulü bekleniyor.

## 4I. D10 teslim — politika tahtaları (2026-09-11, Opus yan ajan)

- `objects/boardArt.ts` (yeni): `icons.json`'dan birebir 5 ikon (`Path2D` + `evenodd`),
  sola yaslı/ortalı **taban çizgisi** hizalı yazı yardımcıları, yuva/bant/şerit/sayaç
  sütunu çizimleri. Düzen sabit yazılmadı: `boardSlotPlans()` `BOARD_LAYOUTS`
  (`fascistPowers`, `vetoUnlockAt`, `liberalSlots`) ve `hitlerStripSlots()`
  `hitlerChancellorWinAt` üzerinden türetir. Türkçe büyük harf etiketler sabit dizgi.
- `PolicyBoard.draw` tuvali 1940×450 tasarım uzayına ölçekler; parti bandı korunur,
  üstüne Hitler şeridi (yuva 3→6) · yetki bantları · VETO AÇILDI (yuva 5) · zafer bandı
  (faşist 6 / liberal 5) · kaos şeridi · sayaç açıklama sütunu gelir. Kart konum satırı
  ve yuva ızgarası **değişmedi**; tahta hâlâ **tek `PrintedFace`** (çizim çağrısı artmadı).
  `resolution` 2048 (`quality === 'low'` → 1024; `TableScene` `quality` geçiriyor).
- `palette.ts`: yeni `board` sözlüğü (`fascistDeep`, `liberalDeep`, `paper2`, `ghost`,
  `line`, `num`, `ink`, `ink2`). `ElectionMarker` değişmedi (şartname §4 kararı).
- **SAPMA:** şartname §8'in "%15 yakınlaş (`1.0/(tan·aspect)`)" önerisi tahtayı yanlardan
  kırpıyor (ölçtüm: NDC |x| 1,03–1,09). Yerine `1.03/(tan·aspect) + .12` — tahta her
  en/boy oranında ekranın %94,2'sini kaplıyor, uzaklık %5–11 azaldı (1440×900: %6,8).
- GEÇTİ: `pnpm -r typecheck` 6/6; `pnpm test` **495** (482 → 495: scene 147 → 160);
  `pnpm --filter @secret-table/web build`. Kareler `docs/qa/claude/d10/*.png` (6 kare,
  konsol hatası yok), betikler `scratchpad/d10-shots.mjs` + `d10-measure.mjs` (port 5199,
  kapatıldı). Rapor `docs/qa/claude/D10-boards.md` (ölçümler ve sapmalar orada).
  Contracts ve `docs/design/**` değişmedi. Commit yok; kullanıcı görsel kabulü bekleniyor.

## 4J. D3.2–3 teslim — prosedürel karakterler (2026-09-11, Opus yan ajan)

- **Durum: teslim** (2026-09-11). Aktif düzenleme yolu: yok. Rapor `docs/qa/claude/D3-characters.md`,
  kareler `docs/qa/claude/d3/`. Sözleşme ve `docs/design/**` değişmedi; yeni bağımlılık yok; commit yok.
- Yeni: `packages/scene/src/characters/**` (spec/field/colors/skeleton/face/geometry/CharacterAvatar/
  CharacterGallery + 31 test), `packages/scene/src/sdf/primitives.ts` (D1 ile paylaşılan ilkeller),
  `apps/web/src/dev/DevCharactersPage.tsx` (`/dev/characters`, yalnız DEV).
  Değişen: `TableScene.tsx`, `layout/seats.ts` (etiket karaktere göre), `prototype/SeatCamera.tsx`
  (göz 0,47 / serbest 0,51), `live/PublicArms.tsx` (yalnız el ×1,15, tek geometri),
  `prototype/FirstPersonStage.tsx`, `hands/{sdf,marchingCubes}.ts` (paylaşım + iç eleme),
  `app/routes.tsx`. Silinen: `prototype/ArticulatedAvatar.tsx`.
- Doğrulama: `pnpm -r typecheck` 6/6, `pnpm test` **526** geçti (önce 495), `pnpm --filter
  @secret-table/web build` geçti. Koltuk FPS (CPU 4×) 59,9 → 59,8; çizim/oyuncu 4 → **3**.
- Sapmalar (raporda gerekçeli): voxel 8 mm, ~13 k üçgen ve ~0,5 s üretim (QEM/meshopt yok);
  renk sınırlarında yumuşatma; `shoulders` kapsülü gövde sayılıyor; kesme düzlemi yalnız kubbeye.
- **Tur 2 (cila, koordinatör isteği):** Taubin yumuşatma (λ .5 / μ −.53, ince ayrıntılar sabit),
  yüz tuvali 1024×512 + kaş tavanı + kep +30 mm + çil küçültme, gözlük/zincir gerçek torus-silindir
  olarak mesh'e (SDF'te lekeleniyordu, ek çizim yok), üretim kuyruğu (ilk kare low → standard idle),
  standard voxel 9 mm / hücre 28 mm, eller karakterin ten tonunda.
  Sayılar: üçgen 12–13,7 k → **8,9–10,1 k**, üretim 460–520 → **355–465 ms**, ilk kare (10 kişi)
  2.377 → **1.720 ms**, koltuk FPS (CPU 4×) 59,8 (değişmedi). `pnpm test` **532**, typecheck 6/6,
  build geçti. Kareler `docs/qa/claude/d3/after2-*`.
- Sonraki: D3.4 (B3 `room_members.avatar` + lobi seçici), D3.5 (Web Worker üretimi, QEM sadeleştirme).

## 4K. D11 teslim — tam ekran deneyimi (2026-09-11, Opus)

- **Durum: teslim, kullanıcı doğrulaması bekliyor.** Aktif düzenleme yolu: yok.
  Rapor `docs/qa/claude/D11-fullscreen.md`, kareler `docs/qa/claude/d11/` (5 kare, konsol hatası
  yok), betik `scratchpad/d11-shots.mjs` (port 5199, kapatıldı). Sözleşme ve `docs/design/**`
  değişmedi; yeni bağımlılık yok; commit yok.
- **(A) Enter tam ekranı düşürüyordu:** `useTableControls`'un "odak tıklanabilir hedefte → Enter/E
  native" muafiyeti artık YALNIZ gerçek klavye odağında (`:focus-visible` + Tab izi). Fare
  odağında Enter/E oyun komutu + `preventDefault`. `.game` `tabIndex={-1}`; immersive'e girince
  odak kaba taşınır, üst şerit/alt çubuk düğmelerinde `mousedown` varsayılanı engellenir
  (menü diyaloğu ve form alanları hariç).
- **(B) Tek sağ üst araç çubuğu:** `TableScene` yeni sözleşme DIŞI `showInspectionNav` propu alır
  (varsayılan `true` → `/dev/scene` bozulmaz); `GameScreen` `false` verir ve tek satırı kendisi
  çizer: Genel masa | Kendi koltuğum | Özel alan | Tahta · odak · bağlantı · Menü. Tahta
  incelemesi artık uygulamada (`boardInspection` → `resolveInspectionMode`, `layout/presentation.ts`).
  `--hud-top` `.game__top` ölçülerek yazılır; rol paneli/ipucu/duyuru oradan iner. Eski sabit
  ofsetler (`margin-top:36px`, `padding-top:62px`, `top:92/76/40px`) SİLİNDİ.
- **Cila:** `env(safe-area-inset-*)` değişkenleri; Pointer Lock + 3 s hareketsizlikte araç çubuğu
  ve tuş ipuçları solar (durum şeridi + ActionBar kalır, sıra sendeyken hiç gizlenmez); tam ekrana
  ilk girişte 4 s tuş ipucu (`usePrefs.fullscreenHintSeen`). `needsResume` akışı korundu.
- GEÇTİ: `pnpm -r typecheck` 6/6; `pnpm test` **547** (532 → 547: scene 197 → 203, web 187 → 195);
  `pnpm --filter @secret-table/web build`. Headless'ta gerçek fullscreen/pointer lock kurulamadığı
  için kareler `data-immersive`/`data-hud-idle` ile simüle edildi — raporda belirtildi, canlı
  doğrulama adımları orada.

## 4L. D3 tur 3 — karakter netliği (2026-09-11, Opus)

- **Durum: teslim, kullanıcı doğrulaması bekliyor.** Aktif düzenleme yolu: yok.
  Rapor `docs/qa/claude/D3-characters.md` → "Tur 3 — netlik"; kareler
  `docs/qa/claude/d3/{before3,after3}-*`; betikler `scratchpad/d3-shots3.mjs`,
  `d3-perf3.mjs`, `d3-firstframe3.mjs` (port 5199, kapatıldı). Contracts ve
  `docs/design/**` değişmedi; yeni bağımlılık yok; commit yok.
- **Asıl kusur normal hesabıydı:** `taubinSmooth` üçgen komşuluğundan alan normali üretiyordu,
  24 mm üçgende bu doğrudan faset demek. Yeni `gradientNormals` (SDF merkezi farkı, h = voxel/2)
  ve `projectToSurface` (Newton, iso-yüzeye geri çekme) `hands/marchingCubes.ts`'e eklendi.
  Sıra: MC → kümeleme → yansıtma → Taubin → gradyan normalleri. Yansıtma kümeleme SONRASINA
  alındı (sapmayı kümenin ortalaması yaratıyor, ham köşeleri yansıtmak düzeltmez; 8 kat da ucuz).
- Standard kademe 9 → **7 mm voxel**, hücre 28 → **24,5 mm**; yüz tuvali 1024×512 → **1024×768**
  (UV penceresi 400×320 mm olduğu için 2:1 tuval dikeyde 0,63 kat çözünürlük veriyordu),
  `anisotropy` 8 → **renderer max (16)**; gözlük torusu 6×18 → 8×28; sakal/bıyık gövdeye
  `min(k, 18 mm)` ile katılıyor; renk geçiş bandı 16 → 22 mm / 14 → 20 mm.
- Sayılar: üçgen/karakter 8,9–10,2 k → **11,9–13,7 k**, üretim 319 → **628 ms** (kuyrukta),
  koltuk 10 kişi FPS CPU 4× 59,9 → **59,8** (gerileme yok), çizim/oyuncu 3 (aynı),
  ilk kare 10 kişi 1.787 → **1.866 ms**, yüz dokusu belleği 28 → **42 MB**.
- GEÇTİ: `pnpm -r typecheck` 6/6; `pnpm test` **554** (547 → 554, scene 203 → 210);
  `pnpm --filter @secret-table/web build`. Konsol hatası yok.
- Açık: vertex renk sınırları (V yaka / hırka şeridi / saç kenarı) hâlâ köşe ızgarasına çakılıyor
  — çözüm sınır boyunca köşe kesmek ya da o bölgeyi de doku ile boyamak (tur 4). Ayrıca renderer
  `dpr` tavanı 1,5 "piksel belli" hissine katkı veriyor (D3 dışı, değiştirilmedi).

## 4M. D3 tur 4 — renk sınırları + DPR (2026-09-11, Opus)

- **Durum: teslim, kullanıcı doğrulaması bekliyor.** Aktif düzenleme yolu: yok.
  Rapor `docs/qa/claude/D3-characters.md` → "Tur 4 — renk sınırları"; kareler
  `docs/qa/claude/d3/after4-*`; betikler `scratchpad/d3-shots4.mjs`,
  `d3-perf3.mjs`, `d3-dpr-check.mjs` (port 5199, kapatıldı). Contracts ve
  `docs/design/**` değişmedi; yeni bağımlılık yok; commit yok.
- **Sınır artık köşede karıştırılmıyor.** `colors.ts` §e kuralları bölge
  işlevlerine döndü (`primColorKey` + `boundaryDistance`, mekanizmalar
  `prim`/`front`/`neck`); yeni `boundaryMaterial.ts` `meshStandardMaterial`'ı
  `onBeforeCompile` ile yamalayıp `mix(vColorB, vColor, smoothstep(-w, w, dBoundary))`,
  `w = fwidth(dBoundary)` uyguluyor → geçiş her mesafede 1 piksel, üçgen
  çözünürlüğünden bağımsız. `FEATHER`/`COLOR_FEATHER` silindi.
- **Sapma:** görevin "köşe başına kendi renk + komşu renk + pozitif uzaklık"
  biçimi çalışmıyor (iki uç da pozitif → `smoothstep` doyar → eski gradyan).
  Renk çifti ÜÇGEN başına sabitlendi (`geometry.ts` → `splitByBoundary`) ve
  gereken yerde köşe çoğaltıldı: **üçgen sayısı değişmedi**, köşe +%9…18.
- `dpr` tavanı standard kademede 1,5 → **2** (`TableScene`, `FirstPersonStage`;
  low 1). Tuval 2.160×1.350 → 2.880×1.800; FPS iki değerde de 59,9 → `[1, 2]`.
- `MIN_BAND = 12 mm` (ince yaka bandı emniyet tabanı; tasarım değerleri zaten
  35/100/43 mm). Saç çizgisi `prim` mekanizmasıyla net.
- Sayılar: üçgen/karakter **11,9–13,7 k (aynı)**, üretim 628 → **~700 ms**
  (sınır geçişi 13–20 ms), koltuk 10 kişi FPS CPU 4×/1× **59,9 / 59,9**,
  çizim/oyuncu **3** (aynı).
- GEÇTİ: `pnpm -r typecheck` 6/6; `pnpm test` **563** (554 → 563, scene 210 → 219);
  `pnpm --filter @secret-table/web build`. Konsol hatası yok.
- Açık: üçlü kavşaklarda tek çift seçiliyor (örtüşme %99+); `neck` mekanizması
  bugün hiç seçilmiyor (halka üstündeki ten şeridi bir köşe aralığından dar —
  tur 1'den beri böyle, §e y eşiği tasarım kararı); QEM ve Web Worker hâlâ D3.5.
