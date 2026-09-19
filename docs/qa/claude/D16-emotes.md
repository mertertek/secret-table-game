# D16 — el jestleri (emote): uygulama raporu

Ajan: Claude (Opus 5, yan ajan) · 2026-09-12 12:40–14:10 (+03:00)
Tasarım: `docs/design/D16-emotes.md` (DEĞİŞMEDİ) · Kareler: `docs/qa/claude/d16/` (23 jpeg)
Bu ajan commit ATMADI. **Not:** kullanıcı 12:18'de kendi `3bc5101 silah geliştirildi`
commit'ini attı ve o sırada yarım olan D16 dosyalarının bir kısmını (sözleşme,
`viewpointProtocol/Channel`, `useRoomState`, `controlScheme`, `useTableControls`,
`poses.json`) süpürdü; geri kalanı çalışma ağacında duruyor. Sunucu,
`packages/game-core`, `packages/server`, `packages/scene/src/props/*` ve
`packages/scene/src/room/*` DEĞİŞMEDİ.

## 1. Ne yapıldı

İki tur tek oturumda tamamlandı.

**Tur 1 — çekirdek + 4 jest** (`point`, `hands_up`, `thumbs_up`, `middle`)
1. Sözleşme: `HeadViewpoint`e additive `emote?: { kind, seq, at }`, `EMOTE_KINDS`,
   `EMOTE_DURATION_MS`, `EMOTE_COOLDOWN_MS` (1200), `EMOTE_REPEAT_MS` ([250, 600]),
   `EMOTE_SYMBOL`/`EMOTE_LABEL`, `isEmoteKind`, `emoteExpired`. Paket sürümü
   **0.2.1 → 0.2.2** (`CONTRACT_VERSION` 0.2.0 SABİT). `docs/CONTRACT.md §5A.1`.
2. Protokol/kanal: bilinmeyen `kind` alanı düşürür (paket kabul), `seq` tam sayı,
   alıcı aynı `seq`i bir kez oynatır; gönderici jest anında **hemen** bir paket +
   **250/600 ms**'de aynı `seq` ile iki tekrar yollar, 1,2 s yerel hız sınırı kanaldadır.
3. Kavramalar: `docs/design/d1/poses.json`'a `point`, `openPalm`, `thumbUp`,
   `middleFinger` (limitler içinde; `clampPose` testi kırpmadığını doğrular),
   `GripName` genişledi, kamu için `bakedPose`/`sharedGripHand` ile pişiyor
   (sol el aynası + sarım düzeltmesi `sharedGripHand(skin, grip, -1)`).
4. İlk şahıs: saf `EmoteOverlay.emoteFrame(kind, since, reduced, look)` → sağ/sol el
   hedefi + kavrama + kart yaslama; `HandRig` katmanı `mixHand` ile uygular.
   Kart tutulurken tek elli jestte **sol el kartları tutmaya devam eder**; iki elli
   jestte paket 250 ms'de masaya yaslanır (`rig.cardsAside`) ve jest bitince döner.
   `ready`/`aim`/`shoot` pozunda jest **reddedilir** (`emoteAllowed`).
5. Kamu: `EmoteArms` (ShootingArm kalıbı) yalnız jest aktifken mount edilir.
   **Tasarımdan ileri sapma:** el havada tek başına durmuyor — jest KARAKTERİN
   KOLUNU kullanıyor. `emoteArmFrame` omuz/dirsek kemiklerini (D3 iskeleti) hedefe
   nişanlıyor (kol boyu korunur, esneme yok), el o kolun ucuna oturuyor;
   `PublicArms` jestteki el(ler)i gizliyor. `point` kolu **paylaşılan bakış yaw'ına**
   nişan alır, pitch ±20° kırpılır. `facepalm`te baş 10° öne eğilir
   (`CharacterAvatar.headPitchOffset`).
6. HUD: **kullanıcı kararıyla çip şeridi yerine dairesel çark** (bkz. §3).
7. Etiket: jest süresince isim etiketinin solunda küçük sembol madalyonu
   (`Nameplate` içinde `EmoteBadge`, yalnız kamu; yerel oyuncuda yok).

**Tur 2 — animasyonlu 4 jest** (`thumbs_down`, `wave`, `clap`, `facepalm`)
- Salınımlar `frameloop="demand"` içinde her karede `invalidate` ile:
  `wave` bilek ±25° 3 salınım, `clap` 4 vuruş (eller en yakın 2 cm), `thumbs_up`
  2 küçük sıçrama, `thumbs_down` aşağı bastırma, `facepalm` avucun yüze yaklaşması.
- `SceneAudio` `SoundKind` **`clap`** (yumuşak çift vuruş, 0,26 s, ölçülen tepe
  **0,32** ≤ .35); yalnız YENİ başlayan jestte bir kez çalar (kamu + yerel),
  `soundEnabled` kapalıysa hiç çalmaz.
- `reducedMotion`: pozlar anında (ağırlık 1), salınım 0, kart yaslaması anında.

## 2. Değişen / yeni dosyalar

Yeni:
- `packages/scene/src/live/EmoteOverlay.ts` (saf katman + `EmoteRegistry`)
- `packages/scene/src/live/EmoteArms.tsx` (kamu el(ler)i)
- `packages/scene/src/live/emotes.test.ts`
- `apps/web/src/immersive/emoteWheel.ts` (saf çark geometrisi)
- `apps/web/src/immersive/useEmoteWheel.ts` (çark durumu + fare/tuş)
- `apps/web/src/immersive/emoteControls.test.tsx`
- `apps/web/src/ui/EmoteWheel.tsx`
- `packages/fixtures/src/scenes/emotes.ts`

Değişen:
- `packages/contracts/src/viewpoint.ts` (additive), `src/scene.ts`
  (`ImmersiveSceneProps.emote`), `src/viewpoint.test.ts`, `package.json` (0.2.2)
- `apps/web/src/multiplayer/{viewpointProtocol.ts,viewpointChannel.ts,useRoomState.ts}`
  + iki test dosyası
- `apps/web/src/immersive/{controlScheme.ts,useTableControls.ts}`
- `apps/web/src/ui/{GameScreen.tsx,styles.css}`
- `apps/web/src/dev/{DevScenePage.tsx,DevGamePage.tsx,useFrozenScene.ts}` (yalnız dev)
- `packages/scene/src/{TableScene.tsx,prototype/HandRig.tsx,prototype/rig.ts,
  live/PublicArms.tsx,characters/CharacterAvatar.tsx,objects/Nameplate.tsx,
  hands/poses.ts,audio/SceneAudio.ts,audio/SceneAudio.test.ts}`
- `docs/design/d1/poses.json` (yalnız 4 poz EKLENDİ; dosya biçimi korundu),
  `docs/CONTRACT.md`
- `packages/fixtures/src/{types.ts,index.ts,registry.ts}`
- Test yardımcıları: `apps/web/src/ui/{GameScreen,Announcer}.test.tsx` (`sendEmote` stub)

## 3. Tasarım notundan sapmalar

1. **Giriş modeli (kullanıcı kararı, 2026-09-12).** Tasarım §3'teki "alt şeritte 8 çip"
   yerine `G` ile açılan **dairesel jest çarkı**: 8 dilim (rakam + ikon + etiket),
   ortada seçili jestin adı, yarı saydam koyu zemin, sahne arkada görünür.
   Seçim: fare (Pointer Lock'ta **kilit bırakılmadan** göreli delta, kilitsizken imleç),
   ok tuşları/WASD, `1–8`, sol tık/Enter. `G` 250 ms'den uzun basılı tutulup
   bırakılırsa vurgulu dilim seçilir; kısa basış menüyü açık bırakır (`G`/`Esc` kapatır).
   Telefonda alt şeritteki **"Jest"** düğmesi aynı çarkı açar; çark ekranın kısa
   kenarına göre ölçeklenir (**min 260 px**; 390×844'te 304 px). Çark açıkken seçenek
   çubuğunun rakamları ve diğer sahne kısayolları devre dışıdır, kapanınca döner.
   Kısayol şeridinde `G Jest`.
2. **`emote-1..8` ayrı tuş bağlaması YOK.** Bir fiziksel tuş iki komuta bağlanamaz;
   `Digit1–8` çark açıkken jeste, kapalıyken seçeneğe gider (`emoteSlot()`).
   WASD de yalnız çark açıkken gezinir (`emoteStepFor`), global bağlanmaz.
3. **Kamu jesti kolu da hareket ettirir.** Tasarım yalnız "pişmiş kavrama eli"
   diyordu; havada duran kopuk el kabul edilemez göründüğü için omuz + dirsek
   kemikleri de jeste göre dönüyor (D3 iskeleti, kol boyu korunur). Maliyet
   ölçüldü (§4) ve hedefin altında kaldı.
4. **İlk şahıs `point` eli bakışın ~30° sağında durur ve bilek 0,52 rad içeri kırılır.**
   Parmak tam kamera ekseninde olduğunda yumruk gibi görünüyordu. Kamu kolunda
   böyle bir kayma YOK: karşıdaki oyuncular parmağı gerçek bakış yönünde görür.
5. **`ready` pozunda jest reddi SAHNEDE.** Çark yine açılıyor ve paket gidiyor; jest
   yalnız ilk şahıs elinde ve (silah elde olduğu için) oynamıyor. Uygulama tarafı
   infaz yetkisini bilmediği için gönderim kapatılmadı; istenirse `executionReadyActorId`
   sahneden dışa açılıp HUD'da da kapatılabilir.
6. **Nameplate sembolü tuval emojisidir** (`☝ 🙌 👍 👎 🖕 👋 👏 🤦`). SVG çizim
   yapılmadı; sistem emoji yazı tipi yoksa kutu görünebilir (macOS/iOS/Windows'ta sorun yok).
7. **`hands_up` "hafif titreme yok"** notuna uyuldu: bu jestte salınım hiç yok.

## 4. Ölçümler (1440×900, dpr 1,25, `standard` kalite, 9 kişilik masa)

| Durum | Çizim çağrısı | Üçgen |
|---|---|---|
| Koltukta boşta (jest yok) | **196** | 310 994 |
| Jest BİTTİKTEN sonra aynı sahne (`t=3600`) | **196** | 310 994 |
| Karşıdaki oyuncu jest yapıyor (tek el) | **199** (+3) | 310 996 |
| Karşıdaki oyuncu `clap`/`hands_up` (iki el) | **199** (+3) | 310 996 |
| Üç oyuncu aynı anda jest | **207** (+11) | 311 160 |
| YEREL ilk şahıs jesti (her 8 jest) | **196** (+0) | 310 994 |

- Boşta ek çizim **0** — jest bitince `EmoteArms` ve etiket sembolü unmount olur
  (`idle-after-emote` karesi taban değerle birebir aynı).
- Oyuncu başına jest maliyeti **+3 çizim**: el mesh'i + gölge geçişi + etiket sembolü.
  İki elli jestte `PublicArms` eli tümüyle gizlendiği için toplam artmıyor.
- İlk şahıs jesti **ek çizim üretmez** (mevcut iki elin pozu eziliyor).
- `clap` sesi: 0,26 s, tepe **0,32** (tasarım sınırı ≤ .35).

## 5. Testler

`pnpm -r typecheck` **6/6 geçti**. `pnpm test` geçti; D16 + D1 tur 5/6 testleri
dahil ölçülen son toplam **788** (contracts 19, fixtures 51, game-core 98,
scene **324**, server 51, web **245**). NOT: bu toplam aynı çalışma ağacında
paralel yürüyen başka bir işin (lobi/karakter) testlerini de içeriyor; D16'nın
kendi payı 40, D1 tur 5/6'nın payı 3 testtir.
`pnpm --filter @secret-table/web build` geçti.

Yeni testler (40):
- `contracts/viewpoint.test.ts` (2): jest tablosu/süreler/metinler, bilinmeyen ad reddi.
- `web/viewpointProtocol.test.ts` (2): jest şeması, bilinmeyen `kind`/bozuk alanın
  DÜŞMESİ ve paketin kabulü, aynı `seq`in bir kez oynaması, sonraki `seq`in oynaması.
- `web/viewpointChannel.test.ts` (2): hemen + 250/600 ms tekrar, aynı `emote.seq`,
  artan bakış `seq`i, 1,2 s hız sınırı, kanal yokken/durdurulunca gönderim yok.
- `scene/live/emotes.test.ts` (11): 8 jest tablosu, 4 kavramanın limit içinde olması,
  süre sonu, `point` yaw takibi + pitch kırpma, iki elli kart yaslama, `ready`de red,
  salınımlar + `reducedMotion`, kamu kolu kavrama/el sayısı/kol boyu, latch tekrarı.
- `scene/audio/SceneAudio.test.ts` (1): `clap` çift vuruş, tepe ≤ .35.
- `web/immersive/emoteControls.test.tsx` (11): dilim geometrisi, ölü bölge, ok/WASD,
  basılı tutma eşiği, çark ölçeği, `G` bağlanması, HUD `G Jest`, aç/kapat,
  Enter/sol tık seçimi, **çark açıkken rakamların seçeneklere gitmemesi**,
  Pointer Lock fare deltasıyla dilim seçimi, jest kapalıyken `G`nin çalışmaması.
- `fixtures.test.ts` otomatik olarak yeni 11 senaryoyu da doğruluyor (+6 test).

## 6. Kareler (`docs/qa/claude/d16/`, jpeg ≤ 125 KB)

| Dosya | İçerik |
|---|---|
| `local-<jest>.jpg` (8) | Yerel ilk şahıs, her jest dondurulmuş karede |
| `seat-<jest>.jpg` (8) | Koltuktan karşıdaki oyuncu (p5) aynı jesti yaparken |
| `local-point-cards.jpg` | Elde 3 kanun varken `point`: sol el kartları tutmaya devam eder |
| `local-hands-up-cards.jpg` | İki elli jest: kartlar masaya yaslanır |
| `seat-crowd.jpg` | Üç oyuncu aynı anda (alkış + onay + orta parmak), etiket sembolleri |
| `idle-baseline.jpg` / `idle-after-emote.jpg` | Çizim sayısı ölçümü (ikisi de 196) |
| `wheel-desktop.jpg` / `wheel-desktop-focus.jpg` | Çark açık (1920×1080, gerçek oyun ekranı) |
| `wheel-phone.jpg` | Telefon dikey (390×844) çark + "Jest" düğmesi |

Kareler D1 tur 6 (perdesiz + yapışıksız eller) SONRASINDA yeniden alındı.
Üretim: `node scratchpad/d16-shots.mjs 5199 [local|seat|extra]`
(dev sunucu `pnpm --filter @secret-table/web dev --port 5199 --strictPort`).

## 7. Canlı doğrulama adımları (kullanıcı)

1. `pnpm --filter @secret-table/web dev --port 5199 --strictPort` → `/dev/game?fixture=emote-local`
   → `Kendi koltuğum` → `G` ile çarkı aç, `1–8`/ok/fare ile jest seç; `G`yi basılı
   tutup bırakınca da seçilmeli. Seçenek çubuğu varken (`?fixture=nomination`) çark
   açıkken rakamların hedefe GİTMEDİĞİNİ doğrula.
2. Karşıdan görünüm: `/dev/scene?fixture=emote-point-seat&camera=seat&t=1500`
   (ve `emote-hands-up-seat`, `emote-peer-clap`, `emote-crowd`).
3. Gerçek çok oyunculu: iki tarayıcıda yerel Supabase env ile oda aç, birinde `G` ile
   jest gönder, diğerinde kolun ve etiket sembolünün belirdiğini gör.
   **Bu oturumda iki gerçek tarayıcıyla gönderen→alıcı gecikme ölçümü YAPILMADI**
   (yerel Supabase env / oda açma bu yan ajanda kurulmadı). Beklenen gecikme: jest
   paketi bakış hız sınırını atladığı için Realtime gidiş-dönüşü + alıcı flush'ı
   (`VIEWPOINT_SEND_INTERVAL_MS` 120 ms) kadar; kayıp olursa 250/600 ms'deki
   tekrarlar telafi eder. Ölçüm kullanıcıda ya da bir sonraki turda.

## 8. Bilinen sınırlar / sonraki tur adayları

- Jest sırasında karakterin GÖVDESİ hareketsiz; yalnız kol ve baş oynuyor.
- `point` jestinde ilk şahıs eli okunabilirlik için sabit açı kaydırıyor (§3.4).
- Dev kareleri dondurulmuş saatle alındığı için karşı oyuncunun baş yumuşatması
  hedefin ~%45'inde kalır (canlıda tam döner); kol nişanı bundan etkilenmez.
- Jest geçmişi/duyurusu, mobil jiroskop ve `clap` dışında ses yok (tasarım §6).

---

## 9. Tur 3 — bütün jestler bakış yönünü izler (2026-09-13, Opus 5 yan ajan)

Kullanıcı bulgusu: "işaret jesti atınca etrafa dönünce el de dönüyor, diğer
jestlerde bu çalışmıyor; onları da işaret gibi yap."

**Ne değişti** (tek dosya: `packages/scene/src/live/EmoteOverlay.ts`)

1. **İlk şahıs** — `emoteFrame` artık `point` dışındaki sekiz jestin de el(ler)ini
   `look.yaw` kadar KATI döndürüyor: konum `swing(EMOTE_POINT_PIVOT, …, yaw)` ile
   (göz altı gövde çıpası `[0, .36, 1.96]`, `point` ile aynı), dönüş ise dünya yaw
   quaternion'unun ÖN çarpımıyla (`turnHand`). Kamera aynı eksende döndüğü için el
   kadrajda yerinde kalıyor; `facepalm` ve `clap` da dönüyor.
2. **Kamu** — `emoteArmFrame` her jestin `target`ını koltuk yerel dikey eksende
   `look.yaw` kadar döndürüyor (`turnTarget`, yön kuralı `point` ile aynı:
   yaw > 0 → −X). Tek elli jestlerde çıpa **o kolun omzu** (point'le birebir aynı
   kural, kolun şekli korunur), iki elli jestlerde **gövde merkezi** (çift katı
   döner; `clap`te eller birbirinden ayrılmaz). İki elli jestlerde uygulanan yaw
   `EMOTE_TWO_HAND_YAW = ±60°`'ye kırpılır. `aimArm` IK'sı DEĞİŞMEDİ.
3. `point` çıktısı bire bir korundu (kendi okunabilirlik kaydırması + pitch takibi);
   `look.yaw = 0`'da sekiz jestin de konum/dönüşü tur 1/2 ile aynı.

**Kararlar / sapmalar**

- **Dönüş yolu:** tasarım notunda "`rotation[1]`'e yaw eklenir" deniyordu; bunun
  yerine dünya yaw'ı ÖN çarpıldı. `rotation[0]` ≈ ±90° olan jestlerde (hands_up,
  middle, wave, thumbs_*) XYZ Euler'inin Y bileşenine eklemek dünya ekseninde dönüş
  DEĞİL, elin kendi ekseninde bir burulma üretiyordu; ön çarpım gerçek katı dönüş.
  `point` bu yoldan geçmediği için tur 2 çıktısı değişmedi.
- **Pitch:** `point` dışındaki jestlerde bakış pitch'i KULLANILMIYOR (tasarımın izin
  verdiği "ya da hiç" seçeneği). Pitch'i ele eklemek kadrajı düzeltmiyor, yalnız eli
  eğiyordu; konumu pitch'le döndürmek ise `hands_up`/`facepalm`i masaya sokuyordu.
- **Bilek yaw'ı:** kamu tarafında `wrist[1]`'e yaw EKLENMEDİ. `aimArm` kolu zaten
  dönmüş hedefe nişanlıyor ve el o dönüşü taşıyor; ayrıca eklemek `point`te
  olmayan bir çift sayım (avucun kendi ekseninde fazladan burulması) yaratıyordu.
- **İki elli yaw sınırı ±60°:** karelerle seçildi. Pratikte `ViewpointAdapter`
  kamu bakışını zaten **±0,65 rad**'a kırpıyor (baş/boyun sınırı), yani bu sınır
  kamu yolunda devreye girmiyor — saf fonksiyonu daha büyük yaw'la çağıran biri
  için güvenlik ağı. Karakterin GÖVDESİ hâlâ dönmediği için 0,65 rad'da
  `hands_up`'ta bir el başa/şapkaya yaklaşıyor (kadraj kusuru değil, bilinen sınır).
- **İlk şahısta artık kayma:** çıpa gözün 7,5 cm arkasında olduğu için yaw 1,0'da
  eller kadrajda ~5–6 cm yana kayıyor (gövde başı takip ediyor hissi); `point` tur
  1'den beri aynı davranışta.
- **Dev sayfası hatası düzeltildi:** `DevScenePage`'de `sweep` parametresi yokken
  `Math.max(100, …)` yüzünden **her sahne tarama kipine** giriyordu; bu kip uzak
  oyuncuları fixture yerine sentetik üretiyor ve `emote` alanını düşürüyordu, yani
  kamu jesti kareleri hiç çıkmıyordu. Artık parametre yoksa `sweep = 0`. Ayrıca
  görsel kanıt için `&peerYaw=<rad>` eklendi (fixture bakış yaw'ını ezer, yalnız dev).

**Testler** — `packages/scene/src/live/emotes.test.ts` 11 → **16** test (5 yeni,
"D16 tur 3" bloğu): yaw 0 çıpa tablosu (8 jest, konum+dönüş), `point` formül
regresyonu (5 yaw × 4 pitch), yaw ±1,2'de katı dönüş (kol boyu korunur, el bakışın
önünde, bakış çerçevesindeki ileri/yan bileşenler yaw 0 ile aynı, dönüş yaw kadar
döndü), iki elli simetri (eller arası mesafe ve bakış eksenine göre aynalama),
kamu kolu (tek elli: bilek yaw yönüne gider ve bakışın önünde kalır; iki elli:
orta nokta yaw yönüne kayar, eller çapraz geçmez, ±60° kırpması).
Toplam paket testi 1012 → **1017**. `pnpm -r typecheck` 6/6 ✓,
`pnpm --filter @secret-table/web build` ✓. Çizim sayısı: boşta 196, jest sırasında
199 (oyuncu başına +3) — tur 1/2 ile aynı.

**Kareler** (`docs/qa/claude/d16/`, 1440×1200, jpeg ≤ 125 KB)

| Dosya | İçerik |
|---|---|
| `local-hands_up-t3.jpg` | İlk şahıs `hands_up`, yaw ≈ +1,0 rad (kamera sürüklendi): iki el kadrajda |
| `local-clap-t3.jpg` | İlk şahıs `clap`, yaw ≈ +1,0: avuçlar hâlâ karşı karşıya ve kadrajda |
| `local-facepalm-t3.jpg` | İlk şahıs `facepalm`, yaw ≈ +1,0: avuç yüzün önünde kalıyor |
| `seat-hands_up-t3.jpg` | Kamu `hands_up`, `&peerYaw=1.0` (etkin 0,65): çift gövdeyle dönüyor |
| `seat-wave-t3.jpg` | Kamu `wave`: kol bakış yönüne dönmüş selam |
| `seat-clap-t3.jpg` | Kamu `clap`: eller dönerken birbirinden ayrılmıyor |

Üretim: dev sunucu `SUPABASE_URL= VITE_SUPABASE_URL= pnpm --filter @secret-table/web dev --port 5205 --strictPort`,
URL kalıbı `/dev/scene?fixture=emote-local&camera=seat&emote=<jest>&t=1200` (ilk şahıs,
yaw fare sürüklemesiyle) ve `/dev/scene?fixture=<peer fixture>&camera=seat&t=1400&peerYaw=1.0` (kamu).

**Yapılmayanlar:** sözleşme, sunucu, `packages/game-core` ve tasarım notu
değişmedi; commit/push atılmadı; canlı iki tarayıcı ölçümü yine yapılmadı (§7/3).
