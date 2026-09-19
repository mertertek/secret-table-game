# D12 — İnfaz sahnesi (silah, ateş, çöken karakter) · uygulama raporu

Ajan: Claude (Opus 5, yan ajan) · 2026-09-12 00:05–01:00 (+03:00)
Tasarım: `docs/design/D12-execution.md` (DEĞİŞTİRİLMEDİ)
Kapsam kuralı: **sunucu, `packages/game-core` ve `packages/contracts` değişmedi.**

## 1. Yapılanlar

### Koreografi (§4) — saf katman

`packages/scene/src/animation/execution.ts` (yeni): `EXECUTION` zaman tablosu,
`executionPhase(now, startedAt, reduced)` → `raise|aim|fire|slump|lower`,
`executionFrame()` (ölçek / kalkış / nişan / geri tepme / flaş / çöküş oranları),
`aimSettle()`, `slumpAmount()`, `aimYaw()`, `localAimYaw()`, `slumpSideAway()`,
`executionActorId()`. Three/React bağımlılığı yok; testler bunu ölçer.

`animation/cues.ts`: `durations.player_eliminated` 350 → **2600**. Azaltılmış
hareketde diğer cue'lar 100 ms'ye inerken infaz **tam süre** oynar (§8).
`ActiveCue`ya `delay` eklendi: infazla aynı pakette gelen `game_ended` cue'su
2600 ms ölü zamanla başlar → sonuç halesi (`CueEffects` `ResultHalo`) ve oyun
sonu duyurusu koreografiden sonra görünür.

### Silah (§2) ve tutuş (§3)

- `packages/scene/src/props/gun.ts` (yeni): `sdf/primitives.ts` ilkelleri
  (round cone namlu, yuvarlak kutu + tor tambur, eğik kapsül kabza, tor tetik
  korkuluğu, pirinç namlu ağzı halkası) → `smin k = .012` → `hands/marchingCubes`.
  Tembel + paylaşımlı önbellek (D1 `geometry.ts` kalıbı), köşe rengi.
  **660 üçgen** (bütçe 700), üretim ~20 ms, ilk infazda bir kez.
  Ölçüm: canvas `data-d12-gun-triangles` (tarayıcıda 660 doğrulandı).
- `materials/palette.ts`: `prop.gunBody #3a3d44`, `prop.gunGrip #7a4a2e`,
  `prop.gunBrass #c9a24a`, `prop.muzzleFlash`.
- `docs/design/d1/poses.json`: `poses.holdGun` (§3 başlangıç değerleri, `limits`
  içinde) ve `cards.holdGun` çerçevesi (`C = [0, −.050, −.150]`, namlu −Z + 6°).
- `hands/poses.ts`: `GripName`e `holdGun`; çerçeve **`PROP_FRAMES`**e ayrıldı
  (`CARD_FRAMES` dışında) → `holdGun`da kart çizimi ve kart temas çözümü yok.
- `props/GunProp.tsx` (yeni): silah mesh'i + namlu flaşı (tek düzlem, tuval
  dokusu, 6 kollu yıldız, `AdditiveBlending`, 90 ms, kameraya dönük).

### Kamu kolu (§4/§5)

`live/ShootingArm.tsx` (yeni): pişmiş `holdGun` sağ el + silah; koltuğun dikey
ekseninde `aimYaw` kadar döner, 0–600 ms kalkar, 1300'de geri teper, 2000–2600
iner. **Yalnız cue etkinken mount edilir.** `live/PublicArms.tsx` aynı anda
`shooting` propu ile yalnız SOL eli çizer (dinlenmedeki iki-el geometrisi ve
boşta çizim sayısı değişmedi).

### Yerel ilk şahıs (§5)

`prototype/model.ts`: `Gesture` `shoot` (2600 ms), `PoseName` `aim`,
`RigMotion.aimYaw`. `prototype/rig.ts`: `aimedHand()` + `shoot` dalı, `RigPose`
içine `gunScale`/`gunFlash`; azaltılmış hareketde de tam süre oynar.
`prototype/grip.ts`: `propFromHand()` (elin taşıdığı nesnenin dünya dönüşümü).
`prototype/HandRig.tsx`: silah yalnız `shoot` hareketi boyunca mount edilir.
`live/LocalMotion.ts` `acceptExecution()` + `live/useLocalMotion.ts`: aktif
`player_eliminated` cue'su ve `cueOfficePlayerId(view,'president') === localPlayerId`
ise hareket bir kez kabul edilir (mevcut `acceptPublic` kalıbı).

### Hedef karakter (§4/§7)

`characters/CharacterAvatar.tsx`: `alive === false` → kök grup **kalıcı** çökük
(`rotation.z ±.32`, `rotation.x .10`, `position.y −.04`) ve `ko` ifadesi; cue
etkinse çöküş 1380–2000 ms arası easeOut, cue yoksa (yeniden bağlanma) anında.
Yeni `slumpSide` propu atıcıdan uzağa devirir (atıcı KAMU geçmişinden okunur,
bilinmiyorsa −1). Mevcut gri tint korundu; `ko`da göz kırpma kapalı.
`docs/design/d3/characters.json` `faces.expressions.ko` + `characters/face.ts`
X göz çizimi (`eyes: {type:'x'}`), `spec.ts` `ExpressionName` genişletildi.

### Ses (§4)

`audio/SceneAudio.ts`: `SoundKind`e `shot` (12 ms gürültü patlaması + 90 Hz
vuruş, 0,12 s, tepe genliği `end`in altında). `useSceneCues`: infaz paketinde
ses **cue başında değil t = 1300'de** çalar; aynı pakette `game_ended` varsa
`end` sesi 2600'de gelir. Görünüm/epoch değişince zamanlayıcılar iptal edilir.

### Duyuru ve vurulan oyuncunun ekranı (§4/§6)

`ui/announcements.ts`: `Announcement.delayMs`; `player_eliminated` → 1300,
infazla aynı pakette gelen `game_ended` → 2600. `ui/Announcer.tsx` gecikmeyi
destekler (süre sayacı gecikme dolunca başlar).
`ui/GameScreen.tsx` + `styles.css`: `.shot-layer` — 400 ms'de koyulaşan
`--danger` tonlu vinyet, "VURULDUN" başlığı ve "Oyun bitene kadar
izleyebilirsin; konuşma ve oy yok" satırı; vinyet 2 s sonra %25'e iner ve oyun
bitene kadar kalır. `pointer-events: none`, kamera oynamaz, `--hud-top` ve D11
odak modeli değişmedi. Yeniden bağlanmada (cue yok) vinyet başlıksız ve anında.

### Fixture ve dev aracı

`packages/fixtures/src/scenes/execution.ts` (yeni, additive):
`execution-shot` (başkan p3, hedef p7, yerel p1), `execution-shot-local`
(başkan = yerel), `execution-shot-victim` (hedef = yerel, §6 kanıtı için).
Mevcut `execution-result` dahil hiçbir fixture değişmedi.
`apps/web/src/dev/sceneClock.ts` + `useFrozenScene.ts` (yeni): `/dev/scene` ve
`/dev/game`de `&t=1300` cue zamanını o ana **dondurur** (sayfa açılırken saat
durur, cue kabul edilince istenen ana atlanır). Yalnız dev yolu — üretim
paketinde `sceneClock` geçmiyor (`dist` taraması: 0 eşleşme).

## 2. Ölçümler

| Ölçüm | Değer |
|---|---|
| Silah geometrisi | **660 üçgen** / 334 köşe, üretim ~20 ms, tek paylaşımlı `BufferGeometry` |
| Boşta (9 koltuk, cue yok) | 217 çizim çağrısı · 318 926 üçgen · 146 geometri |
| Ateş anı (t ≈ 1300) | 221 çizim çağrısı · 320 246 üçgen (+4 çizim: atış eli, silah, flaş, ayrılan sol el) |
| Koreografi sonrası | 217 çizim · 318 926 üçgen — **boşta maliyet artışı yok** |
| FPS (infaz penceresi, 1440×900, dpr 2, headless Chrome/Metal) | **52,6** |

Ölçüm betikleri: `scratchpad/d12-perf.mjs`, kareler `scratchpad/d12-shots.mjs`
(dev sunucu: `pnpm --filter @secret-table/web dev --port 5199 --strictPort`).

## 3. Testler (gerçekten çalıştırıldı)

- `pnpm -r typecheck` → 6/6 paket **geçti**.
- `pnpm test` → **599 test geçti**: contracts 11 · fixtures 36 · game-core 70 ·
  scene 248 · server 35 · web 199. (Scene ve web sayıları bu oturumda paralel
  yürüyen D3 çalışmasının testlerini de içerir.)
- `pnpm --filter @secret-table/web build` → **geçti** (3,2 sn; sahne chunk'ı
  three ile ayrı, ilk yükleme değişmedi).

Yeni testler: `packages/scene/src/animation/execution.test.ts` (28 test —
aşama zaman çizgisi, azaltılmış hareket, ölçek/flaş/geri tepme/çöküş sınırları,
iki koltuk örneğiyle nişan yaw'ı, ±75° kırpma, çöküş yönü, `holdGun` limitleri,
`PROP_FRAMES`/`CARD_FRAMES` ayrımı, silah bütçesi, `propFromHand` ters dönüşümü,
ilk şahıs `shoot` hareketi, `game_ended` gecikmesi, `shot` sesi, `ko` ifadesi),
`apps/web` tarafında duyuru gecikmesi (announcements + Announcer) ve
`.shot-layer` render testleri. `prototype.test.ts`in "azaltılmış hareket son
poza atlar" iddiası `shoot` için §8'e göre güncellendi.

## 4. Görsel kanıt

`docs/qa/claude/d12/` (jpeg, ≤ 300 KB):

| Kare | İçerik |
|---|---|
| `aim-t900.jpg` | t = 900: kamu kolu silahla kalkmış, hedef koltuğa dönmüş |
| `fire-t1320.jpg` | t = 1320: ateş + namlu flaşı |
| `slumped-after.jpg` | cue bitti: hedef kalıcı çökük, `ko` yüzü (X göz + dil), gri tint, "ELENDİ" etiketi |
| `victim-screen.jpg` | vurulan oyuncunun ekranı: vinyet + "VURULDUN" + alt satır |
| `local-aim.jpg` | yerel atıcı, ilk şahıs sağ el silahla nişanda (t = 1000) |
| `local-fire.jpg` | yerel atıcı, ateş + flaş (t = 1320) |

## 5. Tasarımdan sapmalar (gerekçeli)

1. **§5 "el yaw = hedefYaw − bakış yaw"** — ilk şahıs el rig'i kameraya bağlı
   DEĞİL, koltuğun önünde dünya uzayında duruyor (`prototype/rig.ts`). Bu yüzden
   bakış yaw'ı çıkarılmadı: `localAimYaw` doğrudan dünya/koltuk yaw'ını verir,
   ±75° kırpma korundu. Sonuç tasarımın istediğiyle aynı (silah hedefi gösterir,
   oyuncu başka yöne bakarsa kadraj dışına çıkar).
2. **§2 kabza açısı** — "geriye 68°" namlu ekseniyle 68° (dikeyden 22°) olarak
   uygulandı; dikeyden 68° kabzayı neredeyse yatay yapıyordu.
3. **§2 tesselasyon** — 7 mm voxel + 16 mm kümeleme seçildi (660 üçgen). Daha
   ince kümelemede bütçe (700) aşılıyor; bu ayarda tetik korkuluğu ve namlu
   ağzı halkasında ~3 açık kenar kalıyor (yakın planda görünmüyor).
4. **§4 çöküş yönü kalıcılığı** — cue geçtikten sonra atıcı `office` alanından
   okunamayacağı için yön KAMU geçmişinden (`power_used`/`execution` `actorId`)
   türetiliyor; böylece yeniden bağlanan istemci aynı tarafı görür.
5. **Eski 350 ms'lik `Motion` sıçraması** (eleme cue'sunda karakterin hafif
   inip kalkması) kaldırıldı; yerini §4 çöküşü aldı.
6. **Oyun sonu beklemesi** — "hale ve duyuru bekler" isteği, `game_ended`
   cue'suna 2600 ms `delay` eklenerek yapıldı (cue kabul edilir, yalnız geç
   başlar). Cue süresini kısaltmak ya da cue'yu ertelemek sözleşmeyi
   bozmadan mümkün değildi.
7. **Yerel atıcı + `game_over`** — Hitler vurulduğunda aynı sürümde faz
   `game_over` olursa ilk şahıs el rig'i (`HandRig`, `phase !== 'game_over'`
   koşuluyla mount) kapanır; o durumda atıcı kendi elini değil yalnız kamu
   kolunu/koreografiyi görür. D7 cilasında ele alınabilir.

## 6. Kullanıcı canlı doğrulama adımları

1. `pnpm --filter @secret-table/web dev --port 5199 --strictPort` (`--` yok).
2. `http://localhost:5199/dev/scene?fixture=execution-shot` — 2,6 sn'lik
   koreografi: silah kalkar, hedefe döner, flaş, hedef yana çöker ve **öyle
   kalır**. Yeniden oynatmak için soldaki listeden başka bir sahneye geçip geri
   dön (yerel oyuncu değişen `execution-shot-victim` cue defterini sıfırlar).
3. `…/dev/scene?fixture=execution-shot&t=1320` — kare dondurulmuş ateş anı.
4. `http://localhost:5199/dev/game?fixture=execution-shot-local` — sağ üstten
   "Kendi koltuğum": silah kendi elinde kalkar, ateş eder, iner.
5. `…/dev/game?fixture=execution-shot-victim` — vurulan oyuncunun vinyeti ve
   "VURULDUN" başlığı; 2 s sonra vinyet soluklaşır, kamera oynamaz.
6. Menüden **hareket azaltma** açıp 2 ve 4'ü tekrarla: silah nişanda sabit
   durur, tek kare flaş, hedef ateşle birlikte anında çöker, süre aynı.
7. Ses için menüden sesi aç ve sayfaya bir kez tıkla: patlama cue başında değil
   **ateş anında** duyulmalı.


---

# Tur 2 (2026-09-12 00:45–01:10) — koordinatör geri bildirimi

> "Silah ilk şahısta tabanca gibi okunmuyor; uzun koyu çubuk + sarkan kabza.
> Tambur ve tetik korkuluğu görünmüyor, oran ele göre büyük."

## T2.1 Silah ele göre yeniden oranlandı (§2 sapması)

Tasarım §2 ölçüleri **el uzunluğuna göre yeniden ölçeklendi** (el şablonu
bilekten parmak ucuna 0,19). Yeni ölçüler (`packages/scene/src/props/gun.ts`
`GUN`, tek kaynak):

| Parça | Tur 1 | Tur 2 |
|---|---|---|
| Namlu | uzunluk .15 · r .022→.028 | **uzunluk .10 · r .020** |
| Tambur | dış r .036 · kalınlık .04 · oluk yok | **dış r .045 · kalınlık .045 · 6 sığ oluk** (6 kapsül yumuşak çıkarma) |
| Tetik korkuluğu | tor r .028/.006, kabza tepesine kaynıyordu | **tor r .026/.006, tamburun altında ayrık** (delik net görünür) |
| Kabza | namlu ekseniyle 68°, uzunluk .11 | **dikeyden 20° geri, uzunluk .085**, r .026→.030 |
| Namlu ağzı | tor r .026/.007 | pirinç tor r .024/.0055 |
| Toplam uzunluk | ~.30 (1,6 el) | **0,248 = 1,31 el uzunluğu** (`GUN_LENGTH`, testli) |

Geometri: 4,5 mm voxel + 15,5 mm kümeleme → **646 üçgen** (bütçe 700), üretim
~40 ms, tek paylaşımlı `BufferGeometry`.

## T2.2 Tutuş düzeltildi (kabza avuç içinde)

Tur 1'de kabza yumruğa DİKEY giriyordu (el avuç aşağı duruyor, yumruğun tüp
ekseni ise X'tir) — silah elin yanında duruyor gibi okunuyordu. Tur 2'de:

- Nesnenin orijini **kabza merkezi**; `cards.holdGun` çerçevesi yumruk tüpünün
  gerçek merkezine oturdu: `C = [0, −.024, −.080]` (orta parmak mcp/pip/dip
  eğrisinin çemberinden hesaplandı, yarıçap .029 ≈ kabza yarıçapı .026).
- Çerçeve dönüşü `euler = [0, 0, π/2]`: kabza ekseni yumruk tüpü eksenine
  (el X'i) oturur, namlu işaret parmağı hizasından −Z'ye çıkar.
- El bilek ekseninde **−90° yuvarlanır** (avuç gövdeye bakar) — hem ilk şahıs
  (`rig.ts` `aimedHand`) hem kamu kolu (`ShootingArm`) aynı yuvarlanmayı
  kullanır. Namlunun +6° yukarı açısı artık EL dönüşünde (`BARREL_LIFT`),
  çünkü çerçevedeki eğim yuvarlanmayla birlikte yaw'a dönüşüyordu.
- İlk şahısta el kamera eksenine yaklaştırıldı: `AIM_OFFSET [.205, .225, −.42]`
  (göz 0,51 · bakış −15°) — silah kadrajın merkez-sağında, kesilmeden durur.

## T2.3 Namlu flaşı yeniden çizildi (§4)

Dağınık yuvarlak uçlu çizgiler yerine: merkezde **parlak beyaz disk** + sıcak
sarı hâle, çevresinde **6 kollu sivrilen yıldız** (uzun/kısa kollar), ekleme
karışım, 90 ms, kameraya dönük tek düzlem (`props/GunProp.tsx`).

## T2.4 Çöküşün doğrulaması (§4)

`EXECUTION.slump = { roll: .32, pitch: .10, drop: .04 }` — yeni birim testi bu
üç sayıyı tasarım değerine karşı kilitler; `CharacterAvatar` bunları kök gruba
`rotation.z = slumpSide * .32`, `rotation.x = .10`, `position.y -= .04` olarak
uygular. Görsel kanıt artık koltuk görüşünden yakın planda:
`seat-slump-close-t2.jpg` (gövde yana devrik, kalıcı) ve `slump-face-close-t2.jpg`
(X gözler + sarkık dil, gri tint).

## T2.5 Yeni kareler (`-t2` son eki)

| Kare | İçerik |
|---|---|
| `aim-t900-t2.jpg` · `fire-t1320-t2.jpg` | genel masa: nişan ve ateş + flaş |
| `seat-aim-t900-t2.jpg` · `seat-fire-t1320-t2.jpg` | **koltuk görüşü**: başka oyuncu kendi koltuğundan atıcıya bakıyor (yeni `execution-shot-seat` fixture'ı: atıcı ve hedef karşıda yan yana) |
| `gun-profile-close-t2.jpg` | silahın YAN profili yakın plan: namlu, tambur, tetik korkuluğu, flaş |
| `seat-slump-close-t2.jpg` | çöküşün koltuk görüşünden yakın planı |
| `slump-face-close-t2.jpg` | `ko` yüzü (X göz + dil) yakın plan |
| `victim-screen-t2.jpg` | vinyet + "VURULDUN" |
| `local-aim-t2.jpg` · `local-fire-t2.jpg` | ilk şahıs: kabza yumrukta, tetik korkuluğu ve gövde okunur, flaş namlu ucunda |

Tur 1 kareleri (eksiz adlar) karşılaştırma için duruyor.

## T2.6 Ölçüm ve testler (tur 2)

| Ölçüm | Değer |
|---|---|
| Silah | **646 üçgen** / ~330 köşe · üretim ~40 ms · tek paylaşımlı geometri |
| Boşta (9 koltuk) | 217 çizim · 318 926 üçgen |
| Ateş anı | 221 çizim · 320 218 üçgen |
| Koreografi sonrası | 217 çizim · 318 926 üçgen (boşta artış yok) |
| FPS (infaz penceresi) | **52,5** |

`pnpm -r typecheck` 6/6 · `pnpm test` **602** (contracts 11 · fixtures 37 ·
game-core 70 · scene 250 · server 35 · web 199) ·
`pnpm --filter @secret-table/web build` geçti (3,2 sn).

## T2.7 Tur 2 sapmaları

1. **§2 ölçüleri değişti** (yukarıdaki tablo) — tasarım notunun mutlak sayıları
   yerine koordinatörün tur 2 talimatı ve el oranı (1,31 el) esas alındı.
2. **Kabza açısı** artık dikeyden 20° (tur 1'de namlu eksenine 68°).
3. **+6° namlu eğimi** çerçeveden ele taşındı (tur 2 tutuş dönüşü yüzünden).
4. **İlk şahısta namlu kameradan UZAĞA baktığı için yan profil görünmez**;
   tambur/oluklar en iyi kamu kolu (koltuk görüşü) karelerinde okunur. Silahı
   yapay olarak yana eğmek (FPS oyunlarındaki "cant") nişan yönünü hedeften
   kaydıracağı için yapılmadı.
5. Seyreltmede tambur oluklarında ve tetik korkuluğunda ~26 açık kenar kalıyor
   (646 üçgende); yakın planda görünmüyor.
6. Kamu kolunda el, gövdeye pişmiş önkol/manşetten ayrı bir mesh olduğu için
   kalkarken kolla arasında boşluk kalır (D1/D3 tasarımının bir sonucu, D12
   değil). Kalkış yüksekliği bu yüzden .105 ile sınırlandı.


---

# Tur 3 (2026-09-12 10:30–11:00) — kullanıcının canlı geri bildirimi

> "İnfaz edecek kişinin elinde silah yok; seçim ekranında ve vururken gözükmesi
> lazım." + "İnfazda 4 hedef var ama 4.'de rakam yok."

## T3.1 Silah hedef seçilirken de elde (§4 genişlemesi)

Yeni kural (`animation/execution.ts` `executionReadyActorId`): `phase === 'executive_action'`
**ve** `table.currentPower.power === 'execution'` iken yetki sahibi (`currentPower.actorId`)
silahı **hazır pozda** tutar. Yalnız KAMU alanları okunur → yeniden bağlanan
istemci de aynı pozu görür, cue gerekmez.

- **İlk şahıs** (`prototype/rig.ts`): yeni `PoseName 'ready'` + `readyHand()` —
  sağ el kadrajın sağ altında, namlu masaya doğru eğik (`rotation.x −.30`),
  kartları/tahtayı/HUD'u kapatmaz. `LocalMotion` bu pozu yetki işlerken kurar,
  yetki bitince `rest`e döner.
- **Kamu kolu** (`live/ShootingArm.tsx`): `active` artık İSTEĞE BAĞLI. Cue yokken
  kol masada dinlenir (`READY_X .10`), silah elde, hedefe DÖNMEZ (yaw 0).
- **Koreografi hazır pozdan başlar**: `RigMotion.from === 'ready'` ise el
  `readyHand()`tan kalkar ve **silah ölçeği 1'de kalır** (sıfırdan belirmez);
  `LocalMotion.gunHeld` bunu cue geldiğinde (faz artık `executive_action`
  değilken) hatırlar. Süreler değişmedi (0–600 kalkış · 1300 ateş · 2600 son).
- **Bitiş**: cue sonunda ya da yetki temizlenince silah son 150 ms'de ölçek 1→0
  ile iner; hazır poz sürüyorsa silah elde kalır.

Boşta maliyet (kabul edilen): hazır poz sırasında **+4 çizim çağrısı ve
+1 292 üçgen** (atış eli + silah, her biri renk ve gölge geçişinde); ölçüm
`execution-choose-seat` 216 çizim / 328 910 üçgen ↔ aynı masa cue'suz
`execution-shot-seat` 212 / 327 618. Yetki bitince fark sıfırlanır.

## T3.2 Seçenek rakamları 1–9

`immersive/controlScheme.ts`: `OPTION_DIGITS = 9`, `option-1 … option-9`
komutları ve `Digit1–9` + `Numpad1–9` bağlamaları üretiliyor; `optionSlot()`
komuttan yuva sırasını verir (`useTableControls` artık tek `default` dalında).
`ActionBar` rakam rozetini 9 yuvaya kadar basar; ipucu ve sabit kısayol şeridi
`1–N Seç` der (N = yuva sayısı, en çok 9). 9'dan fazla seçenek olursa kalanlar
rakamsız kalır, ok tuşlarıyla gezilir (10 kişilik masada en çok 9 hedef olur).
D11 odak modeli ve sağ üst araç çubuğu değişmedi.

Testler: `controls.test.tsx` (Digit4/Digit9/Numpad7 eşlemesi, `key` yedeği `6`,
5 hedefli görünümde 4. ve 5. seçeneğin rakamla seçilmesi, `1–6` / `1–9` ipucu),
`GameScreen.test.tsx` (5 rozet `1…5`, şeritte `1–5`, Digit4 ile 4. seçenek
`aria-pressed`).

## T3.3 Yeni fixture ve kareler (`-t3`)

Fixture (additive): `execution-choose` (yetki yerelde, 5 hedef seçeneği),
`execution-choose-seat` (yetki karşıdaki oyuncuda).

| Kare | İçerik |
|---|---|
| `local-ready-t3.jpg` | ilk şahıs hazır poz + alt çubukta **1…5 rakamlı** hedef listesi ve `1–5 Seç` ipucu |
| `seat-ready-t3.jpg` · `seat-ready-close-t3.jpg` | koltuktan bakış: karşıdaki başkanın elinde silah, masada hazır, hedefe dönmemiş |
| `overview-ready-t3.jpg` | genel masadan hazır poz (boşta çizim ölçümü bu kareyle alındı) |
| `local-aim-t3.jpg` · `local-fire-t3.jpg` | koreografi (nişan / ateş) tur 3 kodunda bozulmadı |

## T3.4 Ölçüm ve testler (tur 3)

`pnpm -r typecheck` 6/6 · `pnpm test` **677** (contracts 11 · fixtures 39 ·
game-core 98 · scene 277 · server 44 · web 208; game-core/server/scene sayıları
paralel yürüyen D2/D3 çalışmasını da içerir) ·
`pnpm --filter @secret-table/web build` geçti (3,6 sn). Konsol hatası yok.

## T3.5 Tur 3 sapmaları

1. Hazır poz **`currentPower.targetId` dolu olsa da** sürer (hedef seçildi ama
   cue gelmedi aralığı); silahın bir kare kaybolup geri gelmesini önler.
2. Hazır pozdan koreografiye geçiş fixture'larla kare olarak gösterilemez
   (fixture statiktir, faz geçişi yoktur); `from: 'ready'` yolunun silahı
   ölçeklemeden başlattığı **birim testle** doğrulandı
   (`sampleRig(fromReady, t0).gunScale === 1`).
3. Rakam üst sınırı 9: `option-10+` komutu yok. 10 kişilik masada infaz hedefi
   en çok 9 olduğu için pratikte sınıra çarpılmaz.
4. Sabit kısayol şeridine `1–N Seç` eklendi (eskiden yalnız dinamik ipuçlarında
   vardı); kullanıcı rakamların kaça kadar çalıştığını çubukta görüyor.


---

# Tur 4 (2026-09-12 11:15–12:05) — kullanıcı geri bildirimi

> "Silah el kadar kalmış, daha büyük; patlama animasyonu ekleyelim; ses ekleyelim."

## T4.1 Silah ölçeği 1,31 el → **1,90 el**

`props/gun.ts` içinde tek çarpan: `BODY_SCALE = 1.7` namlu, tambur, tetik
korkuluğu, namlu ağzı halkası ve birleşim yumuşaklığını büyütür; **kabza
yumruğa oturmaya devam etsin diye** yalnız uzunluğu 1,2 kat artar, YARIÇAP
(.026/.030) sabit kalır (yumruk tüpü yarıçapı .029). Toplam uzunluk
0,248 → **0,361 = 1,90 el** (`GUN_LENGTH`, testli).

Voxel ve kümeleme de aynı çarpanla büyüdüğü için **üçgen sayısı ölçekten
bağımsız**: 646 → **686** (bütçe 700). Ölçü kutusu (`BOUNDS`) yeni kabuğa
göre genişletildi; ham yüzey kapalı (0 açık kenar), seyreltilmişte 31.

İlk şahıs yerleşimi büyüyen silaha göre yeniden ayarlandı (kadraj/HUD
kapanmasın): hazır poz `[.475, .115, 1.52]`, nişan ofseti `[.255, .175, −.58]`
(el kameradan 0,5 → 0,76 m). Kamu kolunda aynı geometri ve ölçek kullanılır.

## T4.2 Patlama animasyonu (t = 1300'den itibaren)

Saf katman `animation/execution.ts` `BLAST` + `blastFrame(since, reduced)`:

| Öğe | Davranış |
|---|---|
| Namlu flaşı | 120 ms; yıldız ölçeği **0,35 → 1,6** büyürken opaklık `(1−p)^1.4` ile söner |
| Duman | 4 yuvarlak sprite, namlu ucundan **0,25–0,35 m** ileri/yukarı dağılır, ölçek **0,4 → 1,8**, opaklık **0,8 → 0**, 400 ms |
| Kıvılcım | 8 sıcak nokta, namlu yönünde 0,10–0,22 m, 90 ms, ekleme karışım |
| Geri tepme | 8° → **12°** (`EXECUTION.recoil.lift`) |
| Hedef tepkisi | çöküşten önce **80 ms sarsılma**, `position.x` ±0,015 (`flinchOffset`) |

Duman ve kıvılcımlar sprite başına çizim üretmez: her biri tek
`InstancedMesh` (4 ve 8 örnek, ortak opaklık, kameraya dönük). Patlama
boyunca **+3 geçici çizim** (flaş + duman + kıvılcım), bitince üçü de
`visible = false` → maliyet sıfır. `frameloop="demand"` altında kareler
`ShootingArm`/`HandRig`in mevcut `invalidate()` döngüsünden gelir.

Azaltılmış hareket (§8): yalnız tek kare flaş; duman, kıvılcım ve sarsılma yok.

## T4.3 Ses

`audio/SceneAudio.ts` `makeShot` yeniden yazıldı: **8 ms sert transient**
(beyaz gürültü) + **110 → 70 Hz düşen vuruş** (120 ms) + **alçak geçiren
süzgeci kapanan gürültü kuyruğu** (250 ms) + **iki gecikmeli kopya**
(45 ms −8 dB, 90 ms −14 dB) ile kısa yankı; toplam 0,40 s. Kırpma yerine son
normalizasyon: tepe tam **0,60** (`end` sesinin tepesi 0,6'nın altında kalır).
Çalma anı değişmedi: cue başında değil **t = 1300**'de (`useSceneCues`).

`apps/web/src/ui/usePrefs.ts`: varsayılan `soundEnabled` **false → true**.
Kayıtlı tercih her zaman üstündür (daha önce kapatan kullanıcı kapalı kalır):
`parsed.soundEnabled == null ? fallback : Boolean(...)`. Ses yine ilk gerçek
kullanıcı jestinde açılır (`SceneAudio.unlock`, mevcut kalıp).

## T4.4 Kareler (`-t4`)

| Kare | İçerik |
|---|---|
| `local-ready-t4.jpg` | ilk şahıs hazır poz, büyütülmüş silah, HUD ve tahta açık |
| `local-fire-t4.jpg` | ateş anı: flaş + kıvılcım |
| `local-smoke-t4.jpg` | t = 1470: duman namlu ucundan ileri/yukarı dağılıyor |
| `seat-fire-t4.jpg` · `seat-smoke-t4.jpg` | koltuktan kamu kolu: ateş ve duman |
| `gun-profile-close-t4.jpg` | silah yan profili yakın plan (namlu, tambur, korkuluk, flaş) |
| `fire-t1330-t4.jpg` | genel masadan ateş anı |

## T4.5 Ölçüm ve testler (tur 4)

| Ölçüm | Değer |
|---|---|
| Silah | **686 üçgen** (bütçe 700), üretim ~22 ms, tek paylaşımlı geometri |
| Boşta (9 koltuk, cue yok) | 212 çizim · 327 618 üçgen |
| Ateş anı | 216 çizim · 328 990 üçgen (+4: atış eli, silah ve gölge geçişleri) |
| Patlama tepe noktası | +3 geçici çizim (flaş, duman, kıvılcım); koreografi bitince 0 |
| Koreografi sonrası | 212 çizim · 327 618 üçgen |
| FPS (infaz penceresi) | **48,3** (D2 odası sahneye eklendikten sonraki taban) |

`pnpm -r typecheck` 6/6 · `pnpm test` **681** (contracts 11 · fixtures 39 ·
game-core 98 · scene 280 · server 44 · web 209) ·
`pnpm --filter @secret-table/web build` geçti (3,3 sn). Konsol hatası yok.

Yeni testler: `blastFrame` eğrileri ve sınırları, azaltılmış harekette tek kare
flaş, `flinchOffset` penceresi, silahın 1,9 el oranı, geri tepme 12°,
`makeShot` süresi/tepesi/yankısı, `usePrefs` ses varsayılanı ve kayıtlı
tercihin korunması.

## T4.6 Tur 4 sapmaları

1. **Duman opaklık eğrisi** tasarımdaki düz 0,7 → 0 yerine 0,8 → 0 ve
   `(1−p)^0.9`: koyu odada düz eğri ilk 100 ms dışında görünmüyordu.
2. Kıvılcımlar "çizgi" değil **nokta** (ekleme karışımlı sprite): çizgi
   formu bu ölçekte tek piksele düşüyordu.
3. Patlama sırasında ek çizim **3** (hedeflenen ≤4): flaş 1 + duman 1 +
   kıvılcım 1; duman/kıvılcım tek `InstancedMesh` olduğu için sprite sayısı
   çizimi artırmaz.
4. İlk şahısta namlu kameradan uzağa baktığı için duman, silahın ötesinde
   yukarı doğru okunur; yan profil yine kamu kolu karelerinde nettir.


---

# Tur 5 (2026-09-12 12:20–13:05) — kullanıcı: "silahı biraz HD yapsaydık"

Kapsam: yalnız `packages/scene/src/props/{gun.ts,GunProp.tsx}`. TableScene,
kontrol ve kamera dosyalarına dokunulmadı (paralel D15 ajanı orada).

## T5.1 Çözünürlük: 686 → **2 790 üçgen**

| | Tur 4 | Tur 5 |
|---|---|---|
| voxel | 7,65 mm | **6,5 mm** |
| kümeleme hücresi | 22,1 mm | **11,5 mm** |
| Newton yansıtma | yok | **2 iterasyon** (`projectToSurface`) |
| Taubin yumuşatma | yok | **1 tur** (λ .5 / μ −.53) |
| normaller | üçgen alanı | **SDF gradyanı** (`gradientNormals`) |
| üçgen | 686 | **2 790** (bütçe 3 000) |
| üretim | ~22 ms | **~62 ms** (tarayıcıda ölçüldü) |

Kümeleme köşeleri hücre ortalamasına çektiği için yüzey içe çöküyordu; Newton
yansıtma köşeleri iso-yüzeye geri koyar, gradyan normali seyrek ağdaki faseti
kaldırır — D3 karakterlerinde kullanılan kalıbın aynısı.

**İki kademeli üretim**: ilk kare `low` (690 üçgen, tur 4 ızgarası) ile çizilir,
HD sürüm `requestGunGeometry` ile **`requestIdleCallback` kuyruğunda** üretilip
hazır olunca yerine geçer (kare düşmez). İkisi de ayrı önbellekte.

## T5.2 Biçim keskinliği ve yeni ayrıntılar

- Birleşim yumuşaklığı `k` yarıya indi (.0204 → **.0102**); namlu–tambur
  birleşimi ayrıca **.004**'e çekildi (namlu tamburdan açılan huni gibi
  görünüyordu). Tambur oluklarının kenarı .004 → **.0022**.
- Yeni ilkeller: **horoz** (tamburun arkasında yuvarlatılmış blok), **ön
  nişangâh** (namlu ucunda), **tambur ekseni pimi**, **kabza vidası** (iki yanda,
  pirinç).
- **Renk sınırı kenar-yumuşatma**: geometri artık NON-INDEXED ve her köşe
  `color` + `colorB` + `dBoundary` taşır; fragment shader sınırı `fwidth` ile
  bir piksele yayar (D3 `patchBoundaryShader` yeniden kullanıldı). Kabza–gövde
  ve pirinç halka sınırları üçgen ızgarasına çakılmıyor.

## T5.3 Malzeme (tek çizim)

Tek `MeshStandardMaterial`; köşe başına **`gunMaterial` (vec2 = metalness,
roughness)** niteliği `onBeforeCompile`de `metalnessFactor`/`roughnessFactor`
yerine geçer:

| Bölge | metalness | roughness |
|---|---|---|
| gövde (namlu, tambur, korkuluk, horoz, pim) | .75 | .32 |
| kabza | 0 | .60 |
| pirinç halka + vida | .80 | .28 |

Yansıma için **sahne ortamı değiştirilmedi**: yalnız bu malzemeye özel
256×128 prosedürel equirect (koyu zemin + sıcak tavan lekesi + soğuk pencere
lekesi) `PMREMGenerator.fromEquirectangular` ile `envMap` olur,
`envMapIntensity .9`. Malzeme ve ortam **bir kez üretilir, paylaşılır**
(kamu kolu ve ilk şahıs aynı örneği kullanır) ve son kullanıcı ayrılınca
sayaçla bırakılır (`releaseGunMaterial` → material/texture/PMREM dispose).

## T5.4 Ölçüm

| Ölçüm | Değer |
|---|---|
| Silah | **2 790 üçgen** (bütçe 3 000) · HD üretim **62 ms** (tarayıcı) · ilk kare kabası 690 üçgen |
| Boşta (9 koltuk, cue yok) | 212 çizim · 327 618 üçgen |
| Ateş anı | 216 çizim · 333 198 üçgen (silah renk + gölge geçişi 2×2 790) |
| FPS (infaz penceresi) | **48,2** (tur 4: 48,3 — HD geometri ölçülebilir fark yaratmadı) |
| Çizim sayısı | değişmedi: silah tek çizim, patlama sırasında +3 geçici |

`pnpm -r typecheck` 6/6 · `pnpm test` **681** (contracts 11 · fixtures 39 ·
game-core 98 · scene 280 · server 44 · web 209) ·
`pnpm --filter @secret-table/web build` geçti (3,5 sn). Konsol hatası yok.

## T5.5 Kareler (`-t5`)

`gun-profile-close-t5.jpg` (yakın yan profil: parlak metal gövde, pirinç namlu
ağzı, oluklu tambur, tetik korkuluğu, ahşap kabza + pirinç vida),
`local-ready-t5.jpg`, `local-fire-t5.jpg`, `seat-fire-t5.jpg`.

## T5.6 Tur 5 sapmaları

1. Hedef 2 000–3 000 üçgen için kümeleme **11,5 mm**de kaldı (istenen 7–8 mm bu
   modelde ~4 000 üçgen veriyordu); çözünürlük artışı voxel (7,65 → 6,5 mm) ve
   Newton yansıtma + gradyan normalleriyle sağlandı.
2. HD üretim **62 ms** ölçüldü (bütçe 80) ama ilk kare yine de kaba sürümle
   çizilir: `requestIdleCallback` kuyruğu talimattaki güvenlik yolu olarak
   uygulandı ve `low` kademesi kalıcı (yeniden bağlanma/HMR'da da ilk kare ucuz).
3. Köşe başına metalness/roughness için ikinci alt-geometri grubu yerine tek
   malzeme + köşe niteliği seçildi: çizim sayısı **1**de kaldı.
4. `boundaryMaterial.ts` DEĞİŞTİRİLMEDİ; yalnız `patchBoundaryShader` içe
   aktarıldı (D3 dosyaları paralel ajanda).
