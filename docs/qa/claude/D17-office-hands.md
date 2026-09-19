# D17 — yasama sırasında kamu elinde kart sırtları

Ajan: Claude (Opus 5, yan ajan) · 2026-09-12 15:20–16:40 (+03:00)
Kareler: `docs/qa/claude/d17/` (9 jpeg) · Commit YOK.
Sunucu, `packages/game-core`, `packages/server`, `packages/contracts` DEĞİŞMEDİ
(oyun sözleşmesine hiç dokunulmadı); `apps/web/src/devTools.ts`, Lobby/GameMenu/
routes dosyalarına dokunulmadı.

## 1. İstek

Kullanıcı 2026-09-12: *"kart seçen başkanın önünde 3 kart görünse, diğer 2'sini
seçen şansölyenin elinde 2 kart görünse akış daha güzel olur"*. Daha önce diğer
oyuncular yasama sırasında ofis sahibinin elinde hiçbir şey görmüyordu: kartlar
yalnız o oyuncunun özel alanında vardı.

## 2. Gizlilik sınırı

Görünen her şey YALNIZ kamu bilgisinden türer: `view.phase` + `PlayerView.office`.
Kart yüzü, sırası, hangi kartın atıldığı, kimin ne seçtiği bu yola GİRMEZ —
çizilen şey "kaç kapalı SIRT, hangi koltukta, hangi tutuşla". `privateView`
okunmaz; sırt dokusu tek paylaşılan `drawCard(..., { kind: 'back' })` tuvalidir.

## 3. Uygulama

**Saf katman** `packages/scene/src/live/officeHands.ts`
- `officeHandState(view)` → `{ playerId, office, count: 2|3, grip }` ya da `null`.
  Faz eşlemesi (sözleşme adları): `president_discard` → başkan 3 (`holdFan3`),
  `chancellor_choice` → şansölye 2 (`holdFan2`), `veto_response` → şansölye 2
  (kartlar hâlâ şansölyededir). Diğer bütün fazlarda `null`.
  **Cue gerekmez**: yeniden bağlanmada da faz + ofisten türer (anında doğru durum).
- `officeHandFlow(view, cue, playerId)` → `{ direction: 'in'|'out', count, endpoint }`:
  `cards_moved` cue'sunun O KOLTUK için anlamı.
- `officeHandTransition(view, cue, playerId)` → `{ from, to }` tutuş geçişi
  (bitiş yetkili görünümden, başlangıç adet farkından).

**Çizim** `packages/scene/src/live/OfficeHand.tsx` (`ShootingArm`/`EmoteArms` kalıbı)
- Yalnız ilgili koltukta ve ilgili fazda MOUNT edilir → başka koltuklarda ek çizim 0.
- Sağ el: pişmiş `holdFan3`/`holdFan2` kavrama geometrisi (`sharedGripHand`,
  oyuncunun ten tonuyla). `PublicArms` o elde tek elli moda geçer (çift çizim yok).
- Kart sırtları: **tek `InstancedMesh`** (paylaşılan sırt dokusu, kutu geometri) —
  3 ya da 2 sırt bir çizimde. Paket `CARD_FRAMES[grip]` çerçevesinde el uzayına
  oturur; kart ölçüsü (`.19 × .272`) el ölçeğinden bağımsızdır.
- Bilek DİNLENME noktasında kalır (yalnız 2 cm kalkar): karakterin masadaki önkolu
  elle doğal birleşir, havada kopuk el olmaz. Paket yukarı bakan bilek dönüşünden
  (`HAND_TILT` 2,74 rad) doğar: el sırtı karşıya, SIRTLAR masanın ortasına döner.
- Cue: kol `PublicArms` diliyle hafifçe kalkar; gelen/giden kartlar karşı ucun
  DÜNYA noktası ile yelpaze yuvası arasında (`worldToLocal`) sırayla (14% gecikme
  adımıyla) uçar, hafif yay çizer. `reducedMotion`: uçuş yok, durum anında.
- Karşı uç noktaları: deste `[-1.28, .10, -.07]`, atık `[1.28, .10, -.07]`,
  öteki ofis = o koltuğun kart yeri (`seat.cards`, y .12).

**Kamera ayrımı**: koltuk kamerasında uçuşu OfficeHand çizer (`flight`);
genel bakışta `CueEffects` zaten uçan sırtları çiziyor, orada OfficeHand yalnız
adet geçişini gösterir — aynı kartlar iki kez çizilmez.

**Yerel oyuncu**: kendi koltuğunda OfficeHand MOUNT EDİLMEZ; kendi eli
(`HandRig`) gerçek kartlarla değişmeden kalır. Jest (D16) oynarken de ofis eli
çizilmez (el meşgul), jest bitince geri döner.

## 4. Ölçüm (1440×900, dpr 1,25, standard, 9 kişilik masa)

`legislative-seat-idle` fixture'ı `legislative-president-seat` ile AYNI oyuncular
ve masadır, yalnız faz `nomination` (kamu eli yok) — fark tam olarak D17'nin maliyeti:

| Sahne | Çizim | Üçgen |
| --- | --- | --- |
| Ölçüm tabanı (kamu eli yok) | **193** | 310 200 |
| Başkanın elinde 3 sırt | **197** (+4) | 310 272 (+72) |
| Şansölyenin elinde 2 sırt | 200 (fixture'ın atık yığını 1 kart fazla) | 311 042 |
| Genel bakış, başkan 3 sırt | 210 | 330 134 |
| Telefon (low kalite, gerçek oyun ekranı) | 74 | 77 656 |

+4 çizim = el mesh'i + gölgesi, kart `InstancedMesh`i + gölgesi. Üçgen artışı
yalnız kartlardan (+72 = 3 kutu × 12 üçgen × 2 geçiş); el, `PublicArms`ın iki-el
geometrisinden tek-ele düştüğü için nötr.

## 5. Testler

`packages/scene/src/live/officeHands.test.ts` (7 test):
faz → ofis/adet/tutuş eşlemesi; veto fazında kartların şansölyede kalması;
**cue'suz yeniden bağlanma** (fixture `legislative-veto-seat`, `cues: []`);
yasama dışı 8 fazda `null`; ofis sahibi yok/elenmiş → el yok; `gripForCount`;
cue'nun bu koltuk için yön/adet çözümü; cue → başlangıç/bitiş tutuşu eşlemesi
(deste→başkan: `null → holdFan3`, başkan→şansölye: başkan `holdFan2 → null`,
şansölye `null → holdFan2`, şansölye→atık + faz ilerlemesi: `null → null`).

GEÇTİ: `pnpm -r typecheck` 6/6 · `pnpm test` (contracts 19, fixtures **55**,
game-core 98, scene **332**, server 51, web 245) · `pnpm --filter @secret-table/web build`.

## 6. Fixture'lar (additive)

| Kimlik | İçerik |
| --- | --- |
| `legislative-president-seat` | Başkan p4 (yerel değil) 3 sırt tutar + deste→başkan cue'su |
| `legislative-chancellor-seat` | Şansölye p6 2 sırt tutar + başkan→şansölye cue'su |
| `legislative-veto-seat` | Veto kararı, kartlar şansölyede, **cue yok** |
| `legislative-seat-idle` | Ölçüm tabanı: aynı masa, faz `nomination`, kamu eli yok |

## 7. Kareler (`docs/qa/claude/d17/`)

| Dosya | İçerik |
| --- | --- |
| `president-3.jpg` | Koltuktan: karşı koltuktaki başkanın elinde 3 sırt |
| `president-3-mid.jpg` | Deste→başkan cue'sunun ortası (`&t=250`): 3 sırt sırayla uçarken |
| `chancellor-2.jpg` | Şansölyenin elinde 2 sırt |
| `chancellor-2-mid.jpg` | Başkan→şansölye cue'sunun ortası (`&t=250`) |
| `veto-2-no-cue.jpg` | Veto kararı, cue yok: durum fazdan türedi |
| `idle-baseline.jpg` | Ölçüm tabanı (kamu eli yok) |
| `overview-president.jpg` / `overview-chancellor.jpg` | Genel bakış kamerası |
| `phone-president.jpg` | Telefon dikey (390×844, low kalite, gerçek oyun ekranı) |

Üretim: `node scratchpad/d17-shots.mjs 5199 [seat|extra]`
(dev sunucu `pnpm --filter @secret-table/web dev --port 5199 --strictPort`).

## 8. Sapmalar / açık kalanlar

1. **Uçuş yolu iki koltuk arasında tek yönlüdür.** OfficeHand kendi kartlarını
   karşı ucun dünya noktasına/noktasından uçurur; veren ve alan koltuk aynı cue
   penceresinde oynadığı için göz devri tamamlar, ama tek bir kart nesnesi iki
   koltuk arasında "el değiştirmez" (iki ayrı yelpaze animasyonu).
2. **Şansölye→tahta kartı için ayrı uçuş yok**: tahtaya konan kart mevcut
   `policy_enacted` animasyonunun işidir (çakışmaması için OfficeHand yalnız
   `cards_moved`e bakar).
3. **Genel bakışta uçuşu `CueEffects` çizer** (mevcut davranış korunmuş);
   OfficeHand orada yalnız adet geçişini gösterir.
4. Ofis eli ile D16 jesti aynı anda çizilmez (jest önceliklidir, el tektir).
5. `policy_result`/`executive_action` fazlarında el yoktur: kartlar ya tahtada ya
   atıktadır.
