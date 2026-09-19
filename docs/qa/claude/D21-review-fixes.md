# D21 — kod inceleme düzeltmeleri (A–K)

- Tarih: 2026-09-12 21:30–23:10 (Opus yan ajan)
- Kaynak: kullanıcı/koordinatör kod inceleme turu + **canlı olay**: Vercel'de 7
  kişiyle oynanırken "sunucu kaldırmadı, kimse oynayamadı".
- Kareler: `docs/qa/claude/d21/` (11 jpeg). Ölçüm betiği `scratchpad/d21-shots.mjs`.
- **Ajan commit atmadı.** Ancak kullanıcı oturum sürerken kod değişikliklerini
  kendisi commit'ledi: **`dd5bc98` "performans"** (D21 kaynak + testler + sahne
  kareleri; aynı commit D19/E2E malzemesini de süpürdü). Bu rapor, `ROADMAP.md`,
  `docs/agents/CLAUDE.md` ve `lobby-return-*` / `play-*` kareleri commit sırasında
  henüz yoktu → çalışma ağacında duruyor. `.env` / anahtar yazılmadı.
  Migration **GEREKMEDİ**.
- GEÇTİ: `pnpm -r typecheck` 6/6, `pnpm test` **973** (27/56/147/335/95/313;
  D21 öncesi 941 → **+32 test**), `pnpm --filter @secret-table/web build`.
  Üretim paketinde dev izi yok (yalnız `.js.map` içinde).

Öncelik sırası koordinatör talimatıyla değişti: önce yük (yoklama + J), sonra
ENGELLEYİCİ (A) ve yarış (B), sonra kalanlar.

---

## 0. Yük düzeltmesi — yedek yoklama 3 s → 10 s

`apps/web/src/multiplayer/roomChannel.ts` `BACKUP_POLL_MS = 10_000`.

D20 yoklamayı 12 s → 3 s indirmişti; o değişiklik **yanlış bir varsayıma**
dayanıyordu (yorumda "DB→Realtime özel yayını hiç teslim edilmiyor" yazıyordu,
oysa D20'nin kendi ölçümü sinyalin ~363 ms'de ULAŞTIĞINI gösterdi). 7 gerçek
oyuncuyla 3 s'lik yoklama = 140 `view` isteği/dk ve o dönemde her istek 14–17
ardışık Supabase turu yapıyordu (bkz. §J) → **oda başına ~2 000 sorgu/dk**.

Yeni tavan: 10 oyuncu × 6 istek/dk = ~60 `view` isteği/dk. Ek olarak:

- **lobide yedek yoklama tamamen susuyor** (yeni `backupEnabled` kancası);
  lobi zaten kendi 3 s'lik turunu yapıyor, aynı işi iki yerden yapmak kotayı
  boşa harcıyordu,
- `poke()` (komut yanıtı / uygulanan görünüm) sayacı sıfırlamaya devam ediyor.

Ödün: bellek kipinde (Realtime YOK) oda durumu değişikliği en kötü 10 s'de
görülür (ölçüldü 6,6–8,1 s — bkz. §A canlı). Gerçek Supabase'de sinyal ~0,4 s.

## J. `view` / `lobby_view` isteğinin kalıcılık maliyeti

`packages/server/src/{service.ts,gateway.ts,memory-gateway.ts,supabase-gateway.ts}`

Eskiden her `view` isteği: `getRoom` + `getMembershipByUser` + `getGameState` +
`listMembers` (displayName) + `touchSession` YAZIMI + `projectionMeta` içinde
İKİNCİ `listMembers` + **üye başına `getSession`** + ÜÇÜNCÜ `getGameState`.

Yapılanlar:

1. `loadContext` üye listesini TEK kez okur; `member` o listeden bulunur
   (`getMembershipByUser` çağrısı kalktı), `displayNames` da ondan türer.
2. Yeni **additive** `GameGateway.listSessions(roomId)`: odanın tüm oturumları
   tek sorguda (`player_sessions` where room_id). Üye başına `getSession`
   döngüsü hem `projectionMeta`dan hem `getLobby`dan kalktı.
3. `projectionMeta` artık üyeleri/oturumları/durum satırını çağırandan
   `preload` ile alır → **hiç** sorgu yapmaz.
4. `touchSession` yalnız son dokunuş ≥ **30 s** eskiyse yazılır
   (`TOUCH_SESSION_MIN_MS`). İstemcinin 20 s'lik heartbeat'i ayrı yoldan
   yazmaya devam ediyor; bağlantı penceresi 600 s olduğu için "bağlı"
   göstergesi etkilenmiyor (test var).

**Ölçüm** (bellek kipi, her gateway çağrısına 8 ms yapay tur gecikmesi = bir
Vercel→Supabase turu; istek başına ortalama, 5 tur; ESKİ = HEAD'deki service.ts
aynı gateway'e karşı):

| masa | ESKİ çağrı | ESKİ süre | YENİ çağrı | YENİ süre |
|---|---|---|---|---|
| 7 oyuncu | 14 | 128,2 ms | **4** | **37,3 ms** (−71%) |
| 10 oyuncu | 17 | 154,9 ms | **4** | **37,0 ms** (−76%) |

Gecikmesiz saf CPU (projeksiyon dahil), 10 oyuncu: 0,111 ms → 0,068 ms.

Eski dağılım (10 oyuncu, istek başına): `getRoom` 1 + `getMembershipByUser` 1 +
`getGameState` 2 + `listMembers` 2 + `touchSession` 1 + `getSession` 10.
Yeni: `getRoom` 1 + `listMembers` 1 + `getGameState` 1 + `listSessions` 1
(oturum bayatsa +1 `touchSession`).

Birleşik etki 7 kişilik odada: **~1 960 tur/dk → ~168 tur/dk (≈ %91 azalma)**
(3 s × 14 tur → 10 s × 4 tur).

Testler: `packages/server/src/service.view-cost.test.ts` — 10 üyeli `view` ≤ 4
gateway çağrısı, üye başına `getSession` = 0, bayat oturumda tek ek yazım,
`lobby_view` aynı, bağlantı göstergesi hâlâ doğru.

## A. ENGELLEYİCİ — oyun sonu/oyun içi "Lobiye dön"de diğerleri takılı kalıyordu

Kök neden: `cancel_game` yalnız `rooms.status = 'lobby'` yapıyordu. `game_states`
satırına dokunulmadığı için (a) 0003'teki sürüm tetikleyicisi hiç çalışmıyor,
(b) `getView` hâlâ geçerli bir oyun görünümü döndürüyordu (`loadContext` oda
durumuna bakmıyor). D20'nin hızlı yolu (yalnız `view`) lobi turunu atladığı için
host "Lobiye dön" dediğinde diğer oyuncular oyun-sonu ekranında **sonsuza kadar**
kalıyordu.

Sunucu (`service.ts`):

- `cancel_game` artık **durum satırına dokunmadan** sürüm sinyali yayınlıyor:
  yeni additive `gateway.notifyRevision(roomId, revision)` → Supabase'de mevcut
  `public.notify_room_revision` RPC'si (EXECUTE yetkisi 0004'te service_role'e
  ZATEN verilmiş → **yeni migration gerekmez**), bellek kipinde yerel dinleyici.
  Sinyalin sürümü kayıtlı oyunun SON sürümüdür (uydurma sürüm yazılmaz).
- `getView` yanıtına **additive `roomStatus`** (`lobby` / `in_game` / `ended`).
  Eski istemci alanı yok sayar, eski sunucu göndermez.

İstemci (`useRoomState.ts`):

- `roomStatus === 'lobby'` gelen yanıt `'lobby'` sonucu üretir → tam `refresh()`.
- Hızlı yol artık `view.phase === 'game_over'` iken hiç kullanılmaz (doğrudan
  tam tur): oyun-sonu ekranındayken host her an lobiye dönebilir.
- Yedek yoklama / yeniden abonelik / sekmeye dönüş (`revision: -1`) **tam tur**
  yapar (lobi durumu da görülür); gerçek sürüm sinyalinde hızlı yol korunur
  (D20 kazancı: sinyal başına tek HTTP turu).

Testler: `service.room-status.test.ts` (4), `useRoomState.d21.test.tsx` (A için 2).

**Canlı (bellek kipi 5205, 2 gerçek tarayıcı bağlamı + 3 bot, 3 tekrar):**
host menüden "Lobiye dön" → konuk bağlamı lobide: **6 613 / 7 681 / 8 143 ms**.
Kareler `lobby-return-01-guest-in-game.jpg`, `-02-guest-lobby.jpg`,
`-03-host-lobby.jpg`.

> **Sapma / açık nokta:** brief ≤4 s istiyordu. Bellek kipinde Realtime YOK, tek
> yol 10 s'lik yedek yoklama → ölçüm 6,6–8,1 s. Gerçek Supabase'de sinyal
> ölçülmüş 363 ms + bir `view` turu olduğundan hedef karşılanır, ama bu
> **canlıda doğrulanmadı** (bota anonim giriş kotası yüzünden gerçek Supabase'de
> tur yapılmadı). Sinyal kaçarsa üst sınır 10 s'dir; bu, §0'daki yük ödünüdür.

## B. Yarış — gecikmiş eski `view` yanıtı görünümü geriye sarıyordu

`useRoomState.ts`:

- `applyView`: AYNI oyunun `view.revision < lastRevision` yanıtı atılır
  (`resync` bunun dışında, her zaman uygulanır).
- **İstek nesli (in-flight token)**: `viewSeq` her istekte artar; yanıt
  geldiğinde sayaç değişmişse daha yeni bir istek başlamıştır ve eski yanıt
  uygulanmaz (`'stale'`).
- `scheduleRefresh` artık yalnız mikro-görevde değil **istek boyunca** birleştirir:
  süren bir tazeleme varken gelen tetikleme tek "tekrar" bayrağı bırakır ve
  bitince TEK istek daha gider (tam tur istendiyse tam tur baskındır).

Test: `useRoomState.d21.test.tsx` — (1) gecikmiş eski sürüm uygulanmaz, cue'lar
düşmez, (2) iki istek TERS sırada çözülür → görünüm N+1'de kalır ve o sürümün
cue'ları kuyrukta durur.

## C. Cue'lar yalnız tam bir sürüm gerideyse geliyordu

`service.ts` `cuesSince`: koşul `revision === sinceRevision + 1` →
`sinceRevision < revision`. Sahne zaten yalnız GÜNCEL sürümün cue'larını
oynattığı ve yalnız SON komutun olayları saklandığı için geçmiş yeniden
oynamaz. `resync`te yine boş.

Ek: **additive `PlayerViewRequest.sinceGameId`** (paket 0.2.6, `CONTRACT_VERSION`
0.2.0 SABİT) — "Yeniden oyna" sonrası sürüm sayacı devam ettiği için eski sürüm
yeni oyunun cue'larını açmasın. İstemci `apiClient.fetchView` ile gönderir.
`docs/CONTRACT.md §7.1` güncellendi.

Testler: `service.cues.test.ts` güncellendi + 1 yeni (`sinceGameId`).

## D. `resync` bayrağı tüketiliyordu

`fetchAndApplyView`: `noteHttp(true)` istek SÜRERKEN bağlantıyı toparlarsa
`needResync`'i açıyordu, hemen ardından gelen `applyView(..., resync=false)` ise
bayrağı siliyordu → tam yeniden eşitleme hiç yapılmıyor, birikmiş cue'lar
oynayabiliyordu. Artık bayrak yanıt geldikten SONRA okunur ve o yanıt resync
olarak uygulanır (cue kuyruğu boşalır, `resetEpoch` artar).

Test: `useRoomState.d21.test.tsx` — ağ hatası → toparlanma → o yanıt resync
(epoch arttı, kuyruk boş), sonraki istekte bayrak tüketilmiş.

## E. Şansölyeye kart geçişi animasyonu oynamıyordu

`packages/scene/src/TableScene.tsx` `active.find(cards_moved)` TEK cue alıyordu;
başkanın atma turunda aynı sürümde İKİ `cards_moved` var (başkan→atık 1,
başkan→şansölye 2) ve ilki seçildiği için şansölye koltuğunda
`officeHandFlow` her zaman `null` dönüyordu.

Yeni saf yardımcı `live/officeHands.pickOfficeHandCue(view, cues, playerId)`:
o koltuğu ilgilendiren İLK cue'yu seçer. Sahne her koltuk için bunu çağırır.

Yeni fixture (dev/fixtures, additive): **`legislative-chancellor-seat-two-cues`**
— gerçek atma turu (iki cue), koltuk kamerası.

Testler: `officeHands.test.ts` +3 (şansölye koltuğunda ikinci cue seçilir ve
akış null DEĞİL; başkan koltuğunda ilk ilgili cue; ilgisiz koltuk/cue null).

**Canlı kare:** `chancellor-two-cues-t250.jpg` (iki sırt havada, şansölyenin
eline uçuyor), `-t400.jpg` (elde birleşiyor), `-t700.jpg` / `-settled.jpg`
(yerleşti), karşılaştırma `chancellor-one-cue-t400.jpg`. Ölçüm: 200 çizim /
311 042 üçgen (tek cue'lu fixture ile AYNI → ek maliyet yok),
`data-scene-cues-active=2`.

## F. Menü sekmesi açılışta sıfırlanmıyordu

`GameMenu.tsx`: panel `open=false` iken unmount edilmediği için sekme durumu
yaşıyordu; bir kez "Nasıl oynanır"a bakan oyuncu sonraki `M` basışlarında
bağlantı/oyuncular/tercihler yerine onu buluyordu. `useEffect(open)` içinde
sekme `settings`e sıfırlanır. Test: `GameMenu.tabs.test.tsx` +1.

## G. Jest çarkı "Geri" ve arka plan / `Escape`

- `EmoteWheel.tsx`: zemin ve "Geri" düğmesi `pointerdown` YANINDA `click` de
  dinler (Pointer Events vermeyen / sentetik tıklama üreten yollar: eski
  WebView, yardımcı teknoloji, klavyeyle düğme etkinleştirme). Aynı jestin iki
  olayı `closeOnce` ile bir kez işlenir (300 ms penceresi).
- `useEmoteWheel.ts`: `Escape` artık kancanın KENDİ dinleyicisiyle de kapatır.
  D15 `exit-lean` ile çakışmaz: çark açıkken `useTableControls` aynı tuş
  olayında hâlâ "çark açık" durumunu okur ve eğilme dalına inmeden döner —
  yani **çark açıksa önce çark** kapanır. `Escape`'in tarayıcı varsayılanı
  (tam ekran / kilit çıkışı) engellenmez.

Testler: `emoteControls.test.tsx` +4 (zemine click, "Geri" click, aynı jestte
pointerdown+click tek kez, oyun kısayolları bağlı değilken Escape kapatır).

## H. Bot oturumları anonim giriş kotasını tüketiyordu

`apps/web/src/dev/botRunner.ts` (yalnız dev): her "bot ekle" tıklaması her bot
için YENİ anonim kullanıcı açıyordu (Supabase sınırı ~30 giriş/saat/IP) → iki-üç
turda gerçek oyuncu da giremiyordu.

- Bot oturumları **bot adına göre** `localStorage`'da saklanır
  (`secret-table:dev-bot-session:<ad>`, `guestSession.ts` kalıbı) ve sonraki
  koşularda `setSession` ile geri yüklenir (kota harcamaz). Yenilenen token da
  saklanır. Kullanıcının kendi oturumu ayrı anahtar + ayrı istemci: dokunulmaz.
- 429 / "rate limit" yanıtında anlaşılır mesaj (`BOT_QUOTA_MESSAGE`:
  "anonim giriş sınırı aşıldı … ~1 saat bekle ya da bellek kipinde dene") ve
  **denemeler durur** (sınırı zorlamak gerçek oyuncuyu da engelliyor).
  `createAuth` kancası additive üçüncü parametre (`report`) aldı; eski iki
  parametreli test kancaları aynen çalışır.

Testler: `botRunner.test.ts` +3 (yaz/oku/temizle + ayrı yuva + bozuk kayıt,
depo erişilemezse sessiz, 429 tanınır ve tek denemeden sonra durulur).

## I. Küçükler

- `roomChannel.ts` yorumu düzeltildi: D20 ölçümü sinyalin ULAŞTIĞINI gösterdi
  (~363 ms); eski yorumun andığı `viewpointChannel.sendRevision` denenip GERİ
  ALINDI, öyle bir işlev yok (sayacı `poke()` sıfırlar). Lobide yoklama durur
  (§0).
- `packages/contracts/src/schemas.ts`: `ACTIONS_REQUIRING_OPTION` listesi ve
  `refine`'ı **kaldırıldı**. Kural tek yerde, sunucuda (`engine-map.ts`) ve
  projeksiyondan türetilir: `optionId` **gerçek bir seçim varsa zorunlu** —
  birden çok seçenek VEYA seçenek bir oyuncuyu hedefliyorsa (`targetPlayerId`),
  yani tek uygun hedefi kalmış inceleme/infazda da açık seçim istenir. Onaylar
  (`act_ack_role`, `act_ack_private`, `act_request_veto`) ve `policy_peek` (tek,
  hedefsiz seçenek) etkilenmez. `docs/CONTRACT.md §6`'ya not eklendi
  ("optionId zorunlu, 2026-09-12, istemciler zaten gönderiyor").
  Testler: `schemas.test.ts` güncellendi, `engine-map.options.test.ts` +2.
- `game-core/src/devScenario.ts` ve `errors.ts` yorumları: yetki ↔ oyuncu sayısı
  eşlemesi artık açıkça yazılı (`policy_peek` YALNIZ 5-6, `investigate_loyalty`
  YALNIZ 7-10, `call_special_election` 7-10, `execution` her düzende; kaynak
  `contracts/rules.ts` `BOARD_LAYOUTS`).
- `devScenarioMenu.tsx` `errorLine`: `INVALID_OPTION` artık "oyuncu sayısı" diye
  YORUMLANMIYOR; ham kod her zaman yazılır, oyuncu sayısı yalnız olası neden
  olarak anılır (aynı kod geçersiz/eksik `optionId` için de gelir).
- `GameScreen.tsx` `shotFresh`: cue latch'lendikten sonra sonsuza kadar `true`
  kalıyordu (`data-shot="fired"` asılı duruyordu). Artık yalnız giriş
  penceresinde (ateş anı + `SHOT_ENTER_MS` 3600 ms, en uzun CSS girişi) `true`;
  sonra kalıcı dala düşer. `styles.css`: `.shot-layer__card` dinlenme opaklığı
  0,85 (animasyonun bitiş değeri) — geçişte parlama olmaz.

## K. `dev_scenario` yalnız oda sahibi

`service.ts`: env kapısı (`SECRET_TABLE_DEV_TOOLS=1`) açık olsa bile senaryo
yalnız **host**tan kabul edilir; senaryolar yetkiyi (ve `policy_peek_now` ile
deste tepesini) GÖNDERENE verdiği için host olmayan bir oyuncu masayı kendi
lehine kuramaz. UI: `devScenarioMenu` `isHost` propu — host değilse düğmeler
devre dışı, gerekçe yazılı ("oda sahibi gerekir").

Testler: `service.dev-scenario.test.ts` +1 (host olmayan `policy_peek_now`
reddedilir, durum değişmez, host aynı senaryoyu uygulayabilir) ve mevcut
senaryolar host'tan gönderilecek şekilde güncellendi; `GameMenu.dev.test.tsx` +1.

---

## Canlı oyun turu (regresyon kontrolü)

Bellek kipi 5205, 2 tarayıcı bağlamı + 3 bot, ~110 s otomatik oyun: **25 insan
hamlesi** karşılıksız hata almadan işlendi, oyun 4 faşist kanuna ve başkanlık
yetkisine (infaz) ilerledi, bir bot **elendi** (kare `play-01-guest.jpg`,
`play-02-host.jpg`). Vite sunucusu logunda hata/4xx satırı yok. Bu tur
`optionId` sıkılaştırmasını (istemci hep gönderiyor), cue dağıtımını ve yeni
`view` maliyetini birlikte doğrular.

## Kalan / açık

1. **Deploy gerekli:** tüm bu düzeltmeler yalnız çalışma ağacında. Vercel'deki
   paket hâlâ 3 s yoklama + istek başına 14–17 Supabase turu yapıyor.
2. Gerçek Supabase'de "Lobiye dön" gecikmesi (sinyal yolu) ÖLÇÜLMEDİ — bot
   kotası nedeniyle canlı tur yapılmadı; hedef ≤4 s oradan doğrulanmalı.
3. Sinyal kaçarsa oda durumu değişikliği en kötü 10 s'de görülür (yük ödünü).
4. `getView` için "sürüm değişmedi" kısa yanıtı (304 benzeri) hâlâ yapılmadı —
   yoklama başına tam görünüm gönderiliyor. Yükü bir kat daha düşürebilir.
5. `packages/contracts` paket sürümü 0.2.6 (`CONTRACT_VERSION` 0.2.0 SABİT).
