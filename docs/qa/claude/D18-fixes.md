# D18 — oynanış öncesi düzeltmeler · 2026-09-12

Ajan: Claude (Opus 5, yan ajan). Kaynak bulgular: `docs/qa/claude/E2E-2026-09-12.md`
(önemli 1–5) ve `docs/qa/claude/RULES-AUDIT-2026-09-12.md` (B1, B2, B4).

Ortam: yerel dev sunucu `http://localhost:5199` (başka oturumun başlattığı Vite
süreci; kök `.env` `envDir` üzerinden yüklü, gerçek Supabase + `SECRET_TABLE_DEV_TOOLS=1`).
Canlı tekrar: **4 gerçek tarayıcı bağlamı** (A ev sahibi/atıcı, B kurban,
C seyirci, D gerçek dokunmatik telefon 390×844) + 1 bot = 5 kişilik masa.
Betik `scratchpad/e2e-d18.mjs`, kareler `docs/qa/claude/d18/`, ölçüm kaydı
`docs/qa/claude/d18/e2e-d18-log.txt`.

**Migration gerekmiyor** (§1'e bakın: `commit_move` imzası ve `0002_functions.sql`
DEĞİŞMEDİ, yeni dosya yazılmadı). Commit atılmadı.

---

## Özet

| # | Madde | Sonuç | Kanıt |
| --- | --- | --- | --- |
| 1 | Cue dağıtımı (`getView` her zaman `cues: []`) | **düzeltildi** | 7 sunucu + 3 web testi; canlı: B/C/D cue sayaçları arttı |
| 2 | Vurulan oyuncunun ekranı görünmüyor | **düzeltildi** | `b2-shot-layer.jpg`, `b3-…-persistent.jpg`, `b4-…-after-reload.jpg` |
| 3 | Kural B1: aynı oyuncu iki kez incelenemez | **düzeltildi** | 1 800 oyunlu simülasyon "çift inceleme 0"; 2 test güncellendi |
| 4 | Sunucu B2: `optionId` eksikse `INVALID_OPTION` | **düzeltildi** | 4 sunucu + 6 şema testi |
| 5 | Telefon: jest çarkı kapanışı + araç çubuğu | **düzeltildi** | `p1…p5-phone-*.jpg`; 5 kanca testi |

---

## 1. Cue dağıtımı (en önemli)

**Neden.** `submitCommand` cue'ları yalnız komut yanıtında üretiyordu
(`service.ts` eski satır 512); `getView` her zaman `cues: []` döndürüyordu
(eski satır 360). Sonuç: hamleyi yapmayan oyuncular infaz koreografisini, kapalı
kart hareketini ve oy açılışını **hiç** görmüyordu — sahneleri her şeyi görünüm
farkından türetmek zorundaydı. E2E bulgu 2 ("kurban infazı hiç görmüyor") ve
RULES-AUDIT B4 aynı kökten.

**Düzeltme.**

1. **Saklama.** `GameStateRecord.lastEvents` (`gateway.ts`) — son uygulanan
   komutun motor olayları. `CommitMoveInput.lastEvents` ile durum yazımıyla
   AYNI çağrıda gider, yani `revision` ile olaylar asla ayrışmaz.
   - `memory-gateway.ts`: satırda tutulur; `startGame`/`restartGame` `null` yazar
     (yeni oyun önceki oyunun olaylarını taşımaz).
   - `supabase-gateway.ts`: olaylar `game_states.state` JSONB **zarfının içinde**,
     ayrılmış `__lastEvents` yan alanında taşınır. Yazarken `withLastEvents`
     ekler, okurken `splitEnvelope` ayırır — `GameState` motora saf ulaşır.
   - **Migration YOK:** `commit_move(… p_next_state jsonb …)` durumu tek yazımda
     yazdığı için olayları aynı jsonb'ye koymak `0002_functions.sql` imzasına,
     `start_game`'e ve `0006`'nın `restart_finished_game`'ine dokunmadan
     atomikliği korur. Alanı bilmeyen eski satırlar `null` döner (cue yok,
     sahne durumdan türetir) — geriye uyumlu.
2. **Sözleşme (additive).** `PlayerViewRequest.sinceRevision?: Revision`
   (`contracts/src/commands.ts`) + `playerViewRequestSchema`
   (`contracts/src/schemas.ts`, `sinceRevision` tam sayı ≥ 0) + `docs/CONTRACT.md §7.1`.
   `CONTRACT_VERSION` **0.2.0 SABİT**, paket sürümü 0.2.3 → **0.2.4**.
3. **Sunucu.** `GameService.getView(actor, { resync, sinceRevision })` →
   `cuesSince`: yalnız `revision === sinceRevision + 1` iken
   `eventsToCues(lastEvents, playerId, gameId, revision)`. Aksi hâlde `[]`
   (alan yok, atlanmış sürüm, olay yok ya da `resync`). Süzme `eventsToCues`
   içindedir, yani `cards_dealt` yalnız sahibine gider (gizlilik kalıbı
   `projection.privacy.test.ts` ile aynı).
4. **İstemci.** `apiClient.fetchView(..., sinceRevision?)`; `useRoomState`
   sürüm sinyaliyle görünümü `sinceRevision = lastRevision` ile ister
   (`resync` istenirken ve ilk alımda göndermez) ve gelen cue'ları mevcut
   `mergeCues` kuyruğuna verir.
5. **Tek oynatma.** `cueId` zaten deterministik (`gameId:revision:index`), bu
   yüzden hamleyi yapan oyuncu cue'ları hem komut yanıtından hem görünümden
   alsa bile `mergeCues.seen` + `CueLedger` aynı kimliği ikinci kez oynatmaz;
   `cueMatchesView` de `cue.revision === view.revision` istediği için geç gelen
   grup sahneye girmez.

**Kanıt — test.** `packages/server/src/service.cues.test.ts` (7):
ardışık sürümde cue döner ve hamleyi yapmayan oyuncu `votes_revealed`'i görür ·
atlanan sürümde/alan yokken/ileri sürümde boş · `resync`'te boş · alıcı süzmesi
(`cards_dealt` yalnız başkana, `cards_moved` herkese) · `cueId` komut yanıtıyla
birebir aynı ve idempotent · `startGame` sonrası `lastEvents = null` ·
`dev_scenario` infazından sonra `player_eliminated` cue'su **beş oyuncunun
hepsine** (kurban dahil) döner.
`apps/web/src/multiplayer/useRoomState.cues.test.tsx` (3): ilk alım
`sinceRevision` göndermez, sonraki alım son sürümü bildirir · sinyalle gelen cue
kuyruğa girer · aynı `cueId` ikinci kez kuyruğa girmez.

**Kanıt — canlı** (`e2e-d18-log.txt`, 16:42): A ateş etti (+0 ms), sonra
`data-scene-cues-played` sayaçları: **B (kurban) 0 → 2 (+1 219 ms)**,
**C (seyirci) 2 → 3 (+5 245 ms)**, **D (telefon) 2 → 3 (+12 430 ms)**. Kareler:
`b1-A-fire-at-victim.jpg` — kurbanın kendi ekranında **Mert'in kalkmış silahı**
(eskiden kurban hiçbir şey görmüyordu); `c1-collapse-at-fire.jpg` /
`c2-collapse-slumped.jpg` — üçüncü bağlamda Bahar'ın çökmesi ve
"Bahar · ELENDİ" etiketi.

**Sapma / uyarı.** Yerelde gecikmeler 1,2–12,4 s çıktı. Bu cue mantığından değil,
**görünüm tazeleme yolundan** geliyor: bu koşuda Realtime sürüm sinyali
istemcilere anlaşılan ulaşmadı ve `roomChannel`'ın 12 s'lik yedek HTTP kontrolü
devraldı (aynı gecikme D18 öncesinde de vardı; E2E bulgu 1'deki 2,3/4,3 s'lik
karelerin boş çıkmasının sebebi de bu). Sinyal çalıştığında istemci her sürümde
hemen tazelediği için `sinceRevision + 1` koşulu neredeyse her zaman tutar; iki
sürüm arada kalırsa (tasarım gereği) cue atlanır ve sahne son görünüme oturur.
**Realtime gecikmesi ölçülmedi/doğrulanmadı; kullanıcı doğrulamasında gerçek
iki cihazla bakılmalı.**

## 2. Vurulan oyuncunun ekranı

**Neden.** `GameScreen.tsx` içindeki katman iki yerde cue'ya bağlıydı:
"VURULDUN" kartı **yalnız** `shotFresh` (cue ulaştı) iken çiziliyordu ve vinyet
dinlenmede %25 saydamsızlıktaydı. Kurbana cue hiç gitmediği için (§1/B4) ekranda
yalnız belirsiz bir vinyet kalıyordu; oyuncu elendiğini ancak oyuncu
listesinden anlıyordu (E2E bulgu 1).

**Düzeltme.** Katman artık **görünümden** türüyor:

- `!alive` olduğu sürece vinyet **ve** "VURULDUN" başlığı durur (kart artık
  `shotFresh` koşulunda değil).
- Cue geldiyse giriş ateş anına (`EXECUTION_FIRE_MS` = 1300 ms) gecikir; cue
  yoksa (yeniden bağlanma, atlanan sürüm) **anında** görünür.
- Cue'nun VARIŞ ANI bir `ref`'te latch'lenir: cue kuyruğu ~950 ms sonra
  boşaldığında efekt yeniden kurulsa bile gecikme sıfırdan başlamaz ve katman
  kaybolmaz.
- CSS: `shot-title` animasyonu artık `opacity: 0`'a gitmiyor, **%85'te kalıyor**;
  vinyet dinlenme yoğunluğu 0,25 → **0,45**. Kamera oynamıyor,
  `pointer-events: none` korunuyor.
- Tanı için `data-shot="fired" | "persistent"`.

**Kanıt.** Testler `GameScreen.test.tsx` (+3, toplam 33): cue'suz dalda vinyet +
başlık ANINDA · cue kuyruğu boşalınca katman kaybolmuyor ve gecikme
sıfırlanmıyor · oyuncu hayattayken katman kalkıyor.
Canlı: `b2-shot-layer.jpg` — "İNFAZ · Bahar vuruldu" duyurusu + vinyet +
**VURULDUN** + ilk şahıs elleri boş (`handCards: 0`);
ölçüm `{"fresh":"true","shot":"fired","cardOpacity":"1","vignetteOpacity":"1","pointerEvents":"none"}`.
5 s sonra `b3-shot-layer-persistent.jpg` → `cardOpacity: 0.85`, başlık duruyor.
Yenilemeden sonra `b4-shot-layer-after-reload.jpg` → `{"shot":"persistent","fresh":"false","title":true}`
(cue'suz dal).

**Sapma.** Kurbanın ilk şahıs **elleri masada durmaya devam ediyor** (kart
tutmuyorlar; `handCards: 0`). Görev metnindeki "eller boş" bu anlamda sağlandı;
ellerin tümüyle kaldırılması sahne paketi kararı olduğu için D18'de
yapılmadı.

## 3. Kural B1 — aynı oyuncu bir oyunda iki kez incelenemez

**Neden.** Motor kısıtı (başkan, hedef) ÇİFTİ üzerineydi; resmî kural
("No player may be investigated twice in the same game") başkandan bağımsızdır.
1 800 rastgele oyunun 41'inde (yalnız 9–10 kişi) farklı bir başkan aynı oyuncuyu
ikinci kez inceleyebiliyordu.

**Düzeltme.** `i.actorId === presidentId &&` koşulu kaldırıldı:
`game-core/src/selectors.ts` (`investigatableTargetIds`), `game-core/src/engine.ts`
(`investigate_loyalty` → `INVALID_TARGET`) ve tutarlılık için
`game-core/src/test-helpers.ts` hedef seçimi.

**Kanıt.** `engine.simulation.test.ts` B1 testi çevrildi: aynı hedef artık
`investigatableTargetIds`'te YOK, `use_power` `INVALID_TARGET` ile reddediliyor,
incelenmemiş oyuncu hâlâ seçilebiliyor (kilitlenme yok). Simülasyon özeti tüm
masa boylarında **"çift inceleme oyunu 0"** ve 11 değişmez GEÇTİ.
`engine.powers.test.ts` "9 kişide ikinci investigate" testindeki koşullu dal
(`if (president === investigations[0].actorId)`) kaldırıldı; beklenti artık
koşulsuz `INVALID_TARGET` + hedef listesinden düşme.

## 4. Sunucu B2 — `optionId` eksikse `INVALID_OPTION`

**Neden.** `engine-map.ts` `optionId` yoksa sessizce `action.options[0]`
uyguluyordu; ölçülen etki: oy → "evet", adaylık → ilk uygun oyuncu, veto → kabul.
Gövdesi kırpılmış bir istemci oyuncunun adına GERÇEK bir hamle üretiyordu.

**Düzeltme.**

- `packages/server/src/engine-map.ts`: `optionId` verilmişse eşleşmeyen kimlik
  `INVALID_OPTION` (eskisi gibi); **verilmemişse** seçenek sayısı > 1 ise
  `INVALID_OPTION`, tam 1 ise o seçenek (onaylar, `policy_peek`), 0 ise seçenek
  aranmaz (`request_veto`). `respond_veto` ayrıca açıkça `option` şartı koyar —
  "kabul mü ret mi" tahmine bırakılmaz.
- Şema sıkılaştırma (eylem türüne göre): `contracts/src/schemas.ts`
  `ACTIONS_REQUIRING_OPTION = [act_nominate, act_vote, act_discard, act_enact,
  act_respond_veto]` → `gameCommandSchema` bu kimlikler için `optionId` zorunlu
  kılar. `act_use_power` listeye alınmadı: `policy_peek` tek seçenekli, hedefli
  yetkiler çok seçeneklidir — oradaki karar seçenek sayısını gören sunucu
  katmanına ait.
- İstemci ve botlar zaten her zaman gerçek bir `optionId` gönderiyor
  (`controlScheme.optionTargets` seçenekleri `action.options`'tan üretir;
  `botRunner.chooseMove`/`chooseVote` seçenek listesinden seçer) — kontrol
  edildi, değişiklik gerekmedi.

**Kanıt.** `packages/server/src/engine-map.options.test.ts` (4, şemayı atlayan
`rawCommand` ile): adaylıkta `INVALID_OPTION` + faz ve sürüm değişmiyor ·
oyda `INVALID_OPTION` + sessiz "evet" yazılmıyor, oy aksiyonu açık kalıyor ·
tek seçenekli `act_ack_role` `optionId` olmadan çalışıyor · bilinmeyen `optionId`
hâlâ `INVALID_OPTION`. `contracts/src/schemas.test.ts` (+6): beş eylem kimliği
için `optionId` zorunlu, `act_use_power` için değil, `playerViewRequestSchema`
sınırları.

## 5. Telefon — jest çarkı ve araç çubuğu

**Neden.** (a) Çark zeminine yalnız `mousedown` bağlıydı; dokunmatikte dilim
seçilmezse çark ekranın ortasında kalıyordu ve telefonda `Esc` yok (E2E bulgu 5).
(b) Faz değişince de kapanmıyordu. (c) 390 px'te dört kamera düğmesi +
"Tam ekran" + "Menü" tek satıra sığmıyor, araç çubuğu sarıyor ve durum şeridiyle
sıkışıyordu (E2E bulgu 4, kare `e2e/g12-phone-game.jpg`).

**Düzeltme.**

- `EmoteWheel.tsx`: zemin kapanışı `onMouseDown` → **`onPointerDown`** (fare +
  dokunma + kalem); çark içine (dial) dokunmak kapatmaz.
- `EmoteWheel.tsx` + `styles.css`: çarkın altında **"Geri"** düğmesi (44 px
  dokunma hedefi, dilimlerin dışında; `stopPropagation` ile yanlışlıkla jest
  seçtirmez).
- `useEmoteWheel.ts`: additive `phaseKey` seçeneği — değişince çark kapanır.
  `GameScreen` `view.phaseId` verir.
- `styles.css` yeni `@media (max-width: 430px)`: `.game__top { row-gap: 8px }`,
  `.game__tools` satır/kolon aralığı, `.game__tool-group` sıkıştırma,
  `.btn-tool` 30 px/10,5 px, başlıktaki `.btn-ghost`/`.btn-focus` 32 px.
  **D11 `--hud-top` düzeni korundu:** değer yine `.game__top` ölçülerek JS'ten
  yazılıyor; yalnız o kutunun içi sıkıştırıldı.

**Kanıt.** `emoteControls.test.tsx` (+5, toplam 16): zemine `pointerdown` kapatır ·
dial'a dokunmak kapatmaz · "Geri" kapatır ve jest GÖNDERMEZ · faz değişince
kapanır · aynı faz kimliğinde açık kalır.
Canlı telefon (gerçek `hasTouch` bağlam, 390×844):
`Telefon çark: açıldı=true zeminle-kapandı=true Geri-görünür=true Geri-ile-kapandı=true`
(`p2-phone-wheel-open.jpg`, `p3-phone-wheel-closed-backdrop.jpg`,
`p4-phone-wheel-geri.jpg`, `p5-phone-wheel-closed-geri.jpg`).
Araç çubuğu ölçümü (`p1-phone-toolbar.jpg`):
`{"hudTop":"110px","topHeight":110,"statusBottom":22,"toolsTop":30,"overlapPx":-8,"docScrollX":0}`
→ durum şeridi ile araç çubuğu arasında **8 px boşluk (çakışma yok)**, yatay
taşma yok.

**Kalan (D18 kapsamı dışı).** Telefon dikey genel bakışta kadrajın alt kısmı
boş koyu alan (E2E bulgu 4'ün ikinci yarısı, kamera çerçeveleme işi) ve jest
çarkı çiplerindeki `1–8` tuş rozetleri dokunmatikte de görünüyor (kozmetik).

---

## 6. Çalıştırılan komutlar

| Komut | Sonuç |
| --- | --- |
| `pnpm -r typecheck` | **6/6 GEÇTİ** |
| `pnpm test` | **849 GEÇTİ** — contracts 26 · fixtures 55 · game-core 107 · scene 332 · server 74 · web 255 (D18 öncesi 821) |
| `pnpm --filter @secret-table/web build` | **GEÇTİ** (3,32 s) |
| `node scratchpad/e2e-d18.mjs` | GEÇTİ; 15 kare + log `docs/qa/claude/d18/` |

Yeni test dosyaları: `packages/server/src/service.cues.test.ts` (7),
`packages/server/src/engine-map.options.test.ts` (4),
`apps/web/src/multiplayer/useRoomState.cues.test.tsx` (3).
Güncellenen testler: `contracts/src/schemas.test.ts` (+7: 5 zorunlu-seçenek eylemi,
`act_use_power` muafiyeti, `playerViewRequestSchema`; 19 → 26),
`game-core/src/engine.simulation.test.ts` (B1 beklentisi çevrildi),
`game-core/src/engine.powers.test.ts` (koşullu dal kaldırıldı),
`apps/web/src/ui/GameScreen.test.tsx` (+3),
`apps/web/src/immersive/emoteControls.test.tsx` (+5).

## 7. Değişen dosyalar

Sözleşme: `packages/contracts/src/{commands.ts,schemas.ts}`, `package.json` (0.2.4).
Sunucu: `packages/server/src/{gateway.ts,memory-gateway.ts,supabase-gateway.ts,service.ts,engine-map.ts}`.
Motor: `packages/game-core/src/{selectors.ts,engine.ts,test-helpers.ts}`.
API: `apps/web/api/game.ts`.
İstemci: `apps/web/src/multiplayer/{apiClient.ts,useRoomState.ts}`,
`apps/web/src/immersive/useEmoteWheel.ts`,
`apps/web/src/ui/{GameScreen.tsx,EmoteWheel.tsx,styles.css}`.
Belge: `docs/CONTRACT.md §7.1`, `docs/ROADMAP.md` (D18),
`docs/qa/claude/E2E-2026-09-12.md` (ilgili satırlar), `docs/agents/CLAUDE.md §1`.

`supabase/migrations/` DEĞİŞMEDİ. `.env`/anahtar yazılmadı. Commit YOK.
