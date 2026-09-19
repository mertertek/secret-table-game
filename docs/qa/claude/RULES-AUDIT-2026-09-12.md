# Oyun mantığı denetimi — 2026-09-12

Denetçi: Claude (Opus 5), oyun mantığı denetçisi rolü. **Motor kodu değiştirilmedi**;
yalnız iki test dosyası eklendi.

Kapsam: `packages/contracts/src/rules.ts`, `packages/game-core/src/*`,
`packages/server/src/{service.ts,engine-map.ts,projection.ts}`,
`supabase/migrations/0002_functions.sql`.

Referans kural metni: **Secret Hitler resmî kural kitapçığı**
(`https://secrethitler.com/assets/Secret_Hitler_Rules.pdf`, PDF metin akışı
çıkarılarak birebir okundu; aşağıdaki alıntılar o metindendir).

## 0. Özet karar

| | |
| --- | --- |
| Engelleyici bulgu | **0** |
| Durum (2026-09-12 akşam) | **B1, B2, B4 düzeltildi (D18)** — bkz. `docs/qa/claude/D18-fixes.md`. B3, B5, B6 açık. |
| Önemli bulgu | **2** (B1 kural ihlali, B2 sunucu varsayılanı) |
| Küçük bulgu / not | **4** (B3–B6) |
| Yorum farkı | 3 (Y1–Y3) |
| Simülasyon | 5–10 oyuncu × 300 oyun = **1 800 oyun**, tüm değişmezler GEÇTİ |
| Gizlilik süpürmesi | 6 masa boyu × 12 oyun, her adımda her oyuncunun görünümü — **sızıntı yok** |

**Mantık oynamaya hazır** (B1 tek gerçek kural ihlali; yalnız 9–10 kişilik masada,
oyunu bozmayan bir bilgi fazlalığı üretir). Ayrıntı § 5.

Çalıştırılan komutlar ve sonuçları § 6.

## 1. Kural karşılaştırma tablosu

Sınıf: **✔ uyumlu** · **✗ kural ihlali** · **≈ yorum farkı** · **… eksik**

### 1.1 Kurulum ve roller

| Resmî kural | Motor davranışı | Sonuç |
| --- | --- | --- |
| Rol dağılımı 5:3L+1F+H, 6:4+1+H, 7:4+2+H, 8:5+2+H, 9:5+3+H, 10:6+3+H | `ROLE_SETUPS` (`contracts/src/rules.ts:109`) tam tablo; `createGame` torbayı bu sayılarla kurar, `overrides.roles` sayıları doğrular (`setup.ts:73-78`) | ✔ |
| Deste 17 kart (6 liberal + 11 faşist) | `POLICY_DECK_COMPOSITION` (`rules.ts:119`), `buildDeck` (`setup.ts:38`); simülasyonda 1 800 oyun boyunca her adımda toplam 17 ve bileşim 6L/11F doğrulandı | ✔ |
| Faşistler birbirini ve Hitler'i tanır | `knownPlayersFor` (`selectors.ts:101-118`) | ✔ |
| Hitler 5–6'da faşistleri bilir, **7+'da bilmez** | `roleSetup.hitlerKnowsFascists` (`rules.ts:110-115`) + `selectors.ts:120`; `projection.privacy.test.ts` altı masa boyu için ayrıca doğruladı | ✔ |
| Tahta düzeni: 5–6 `small`, 7–8 `medium`, 9–10 `large` | `boardVariantForPlayerCount` (`rules.ts:90`) | ✔ |
| Yetkiler 5–6: –,–,peek,exec,exec / 7–8: –,inv,special,exec,exec / 9–10: inv,inv,special,exec,exec | `BOARD_LAYOUTS[*].fascistPowers` (`rules.ts:52,61,77`), 6. yuva `'none'` (faşist zaferi) | ✔ |
| Koltuk sırası sabit; ilk başkan rastgele | `setup.ts:94-106`; simülasyonda koltuk ve rol değişmezliği her adımda kontrol edildi | ✔ |

### 1.2 Seçim

| Resmî kural | Motor davranışı | Sonuç |
| --- | --- | --- |
| "The last elected President and Chancellor are term-limited, and ineligible to be nominated as Chancellor Candidate." | `eligibleChancellorIds` (`selectors.ts:52-62`); `lastGovernment` yalnız BAŞARILI seçimde yazılır (`engine.ts:281`) | ✔ |
| "Term limits apply to the President and Chancellor who were **last elected**, not to the last pair nominated." | Reddedilen seçim `lastGovernment`'ı değiştirmez (`engine.ts:272-275`) | ✔ |
| "Term limits only affect nominations to the Chancellorship; anyone can be President." | Başkanlık sırası kısıttan bağımsız (`nextAliveSeatAfter`, `engine.ts:106`) | ✔ |
| "If there are only five players left, **only the last elected Chancellor** is ineligible; the last President may be nominated." | `aliveTotal > REDUCED_TERM_LIMIT_ALIVE_THRESHOLD(5)` → son başkan da yasak; 5 ve altında yalnız son şansölye (`selectors.ts:57`) | ✔ |
| Aday kendini şansölye seçemez | `engine.ts:343` `INVALID_TARGET`; ayrıca `banned.add(presidentId)` | ✔ |
| "Every player, including the Candidates, votes." | `handleVote` yalnız hayatta olma ve tekrar oyu kontrol eder (`engine.ts:362-366`) | ✔ |
| "If the vote is a tie, or if a majority votes no: the vote fails." | `elected = yes * 2 > aliveIds.length` (`engine.ts:258`) → eşitlik = ret | ✔ |
| Ret → sayaç +1, başkanlık bir sonraki oyuncuya | `failElection` (`engine.ts:227-236`) | ✔ |
| "If three or more Fascist Policies have been enacted: ask if the new Chancellor is Hitler. If so, the Fascists win." | Seçim başarılıysa hemen kontrol (`engine.ts:286-289`), `hitlerChancellorWinAt = 3` | ✔ |

### 1.3 Seçim sayacı / kaos

| Resmî kural | Motor davranışı | Sonuç |
| --- | --- | --- |
| "If the group rejects three governments in a row, … Immediately reveal the Policy on top of the Policy deck and enact it." | `ELECTION_TRACKER_MAX = 3`, `failElection` → `chaosPolicy` (`engine.ts:230-232,238-246`) | ✔ |
| "Any power granted by this Policy is **ignored**." | `chaosPolicy` `afterFascistPolicy`'yi ÇAĞIRMAZ; doğrudan `advanceRotation + startNomination` | ✔ (simülasyonda her kaos olayında ayrıca doğrulandı: 2 695 kaos olayı, hiçbirinde `executive_action`) |
| "…the Election Tracker resets, and existing term-limits are forgotten. All players become eligible…" | `enactPolicy(chaos=true)` → `electionTracker = 0` + `lastGovernment = null` (`engine.ts:206-210`) | ✔ |
| "Any time a new Policy tile is played face-up, the Election Tracker is reset." | `enactPolicy` her iki yolda sayacı sıfırlar (`engine.ts:206`) | ✔ |
| Sayaç 0–2 aralığında görünür (3'e ulaşınca hemen kaos + sıfırlama) | Simülasyonda her adımda `0 ≤ tracker < 3` doğrulandı | ✔ |
| "If there are fewer than three tiles remaining in the Policy deck **at this point**, shuffle them with the Discard pile." | Motor tembel karıştırır: `ensureDeck` yalnız çekim anında ve yalnız gereken sayı kadar (`engine.ts:135-141`); kaosta `ensureDeck(s, 1)` (`engine.ts:239`) | ≈ **B3** |

### 1.4 Yasama oturumu

| Resmî kural | Motor davranışı | Sonuç |
| --- | --- | --- |
| Başkan 3 çeker, 1 atar; şansölye 2'den 1'ini yürürlüğe koyar | `PRESIDENT_DRAW_COUNT = 3` (`engine.ts:291-298`), `handleDiscardPolicy` (`engine.ts:372`), `handleEnactPolicy` (`engine.ts:404`) | ✔ |
| Atılan kartlar çöpe | `engine.ts:386,419-423` | ✔ |
| 5 liberal → liberal zaferi; 6 faşist → faşist zaferi | `engine.ts:216-223` | ✔ |
| Faşist kanun yuvasındaki yetki başkana geçer; "Gameplay cannot continue until the President uses the power." | `afterFascistPolicy` (`engine.ts:302-317`) → `executive_action` fazı; başka komut kabul edilmez | ✔ |
| "Presidential Powers are used only once; they don't stack or roll over." | Yetki yalnız dolan yuvadan türer; `fascistPolicies` monoton arttığı için yuva bir kez tetiklenir — simülasyonda `powerSlots` kümesiyle doğrulandı | ✔ |
| Kart destesi <3 kalınca atıkla karıştır | `ensureDeck` (bkz. B3) | ≈ **B3** |

### 1.5 Veto (5 faşist kanundan sonra)

| Resmî kural | Motor davranışı | Sonuç |
| --- | --- | --- |
| "comes into effect after five Fascist Policies have been enacted" | `vetoUnlockAt = 5`; `handleRequestVeto` `fascistPolicies < 5` ise `VETO_NOT_AVAILABLE` (`engine.ts:441`) | ✔ |
| Şansölye veto ister | `request_veto` yalnız şansölyeden (`engine.ts:440`), aynı oturumda ikinci kez istenemez (`vetoRequested`) | ✔ |
| "If the President consents … both Policies are discarded and the President placard passes to the left" | `handleRespondVeto(accept=true)`: iki kart çöpe + `failElection` (`engine.ts:463-470`) | ✔ |
| "Each use of the Veto Power … advances the Election Tracker by one." | `failElection` → sayaç +1, 3'e ulaşırsa kaos | ✔ |
| "If the President does not consent, the Chancellor must enact a Policy as normal." | `accept=false` → `legislative_chancellor`, `vetoRequested = true` (yeniden veto yok) (`engine.ts:473-482`) | ✔ |

### 1.6 Başkanlık yetkileri

| Resmî kural | Motor davranışı | Sonuç |
| --- | --- | --- |
| **Investigate Loyalty**: parti bilgisi yalnız başkana; "No player may be investigated twice in the same game." | Motor kısıtı **(başkan, hedef) ÇİFTİ** üzerine: `investigations.some(i => i.actorId === presidentId && i.targetId === …)` (`engine.ts:510`, `selectors.ts:65-76`). Farklı başkan aynı oyuncuyu ikinci kez inceleyebiliyor | ✗ **B1** |
| İnceleme SONUCU yalnız başkana, hedefin kimliği herkese açık | `phase.inspection` yalnız başkana (`projection.ts:379-392`); `currentPower.targetId` herkese; `publicHistory` partiyi taşımaz | ✔ |
| **Call Special Election**: "chooses any **other** player at the table" | `requireTarget` kendini ve ölüyü reddeder (`engine.ts:498-505`) | ✔ |
| "Any player can become President—even players that are term-limited." | Özel seçim hedefi tur kısıtına bakılmadan başkan olur | ✔ |
| "The new President nominates an **eligible** player as Chancellor" | Aynı `eligibleChancellorIds` uygulanır | ✔ |
| "A Special Election does not skip any players. After a Special Election, the President placard returns to the **left of the President who enacted** the Special Election." | `returnToSeat = nextAliveSeatAfter(çağıran başkanın koltuğu)`, `advanceRotation` bu koltuğa döner (`engine.ts:163-171,539`) | ✔ |
| Özel seçim turu reddedilirse ne olur (kitapçıkta açık değil) | Reddedilen seçim de özel seçimi TÜKETİR (`failElection` → `advanceRotation`) | ≈ **Y1** |
| **Policy Peek**: "secretly looks at the top three tiles … and then returns them to the top **without changing the order**" | `deck.slice(0, 3)` — kart çıkarılmaz, sıra değişmez (`engine.ts:528-533`); hedef alırsa `POWER_HAS_NO_TARGET` | ✔ |
| **Execution**: "If that player is Hitler, the game ends in a Liberal victory." | `engine.ts:565-568` `hitler_executed` → liberal | ✔ |
| "the table should not learn whether a Fascist or a Liberal has been killed" | `player_eliminated` cue ve `publicHistory` yalnız `playerId` taşır; rol yok (`projection.ts:182-184,504-506`) | ✔ |
| "Executed players are removed from the game and may not speak, vote, or run for office." | Oy `PLAYER_DEAD` (`engine.ts:363`), adaylık `PLAYER_DEAD` (`engine.ts:344`), başkanlık sırası atlar (`nextAliveSeatAfter`), yetki hedefi olamaz (`engine.ts:503`) | ✔ |
| Başkan kendini infaz edemez / kendini inceleyemez | `requireTarget` `target === presidentId` → `INVALID_TARGET` | ✔ (kitapçık "one player at the table" der; motor daha katı — güvenli yorum) |

### 1.7 Oyun sonu kontrol sırası

| Resmî sıra | Motor | Sonuç |
| --- | --- | --- |
| Seçim başarılı → önce Hitler-şansölye kontrolü, sonra yasama | `resolveVote`: `lastGovernment` yaz → Hitler kontrolü → kart çekimi (`engine.ts:281-298`) | ✔ |
| Kanun yürürlüğe girdi → önce tahta zafer kontrolü, sonra yetki | `enactPolicy` `true` dönerse `handleEnactPolicy`/`chaosPolicy` hemen döner (`engine.ts:429`, `engine.ts:243`) | ✔ |
| İnfaz → Hitler ise oyun biter, tur kapanmaz | `endGame` + `return` (`engine.ts:565-568`) | ✔ |
| Bitiş nedeni ile durum tutarlı | Simülasyonda 1 800 oyunun hepsinde `endReason` ↔ (`winner`, kanun sayıları, Hitler durumu) tutarlılığı doğrulandı | ✔ |

### 1.8 Eksik bulunmadı

Kitapçıkta olup motorda **hiç karşılığı olmayan** bir kural bulunamadı. `ack_role`
ve `ack_private_result` kitapçıkta olmayan, uygulamanın eklediği onay adımlarıdır
(sözleşme § 4 gereği) — kural akışını değiştirmez (**Y2**).

## 2. Rastgele simülasyon sonuçları

Dosya: `packages/game-core/src/engine.simulation.test.ts` (yeni).
Sürücü: her adımda o aşamada izin verilen komutların tamamı üretilir, tohumlu
`mulberry32` ile biri seçilir. Tohum: `seed = playerCount * 1_000_003 + i`,
`i = 0..299`; sürücü RNG'si `createRng(seed ^ 0x5f3759df)`. Adım sınırı 2 000.

| Oyuncu | Oyun | Ort. adım | Kaos olayı | İnfaz | Bitiş nedeni dağılımı |
| --- | --- | --- | --- | --- | --- |
| 5 | 300 | 92,0 | 328 | 264 | hitler_elected_chancellor 155 · fascist_policies 68 · hitler_executed 58 · liberal_policies 19 |
| 6 | 300 | 121,1 | 590 | 274 | hitler_elected_chancellor 139 · fascist_policies 98 · hitler_executed 42 · liberal_policies 21 |
| 7 | 300 | 125,5 | 328 | 324 | hitler_elected_chancellor 130 · fascist_policies 108 · hitler_executed 44 · liberal_policies 18 |
| 8 | 300 | 153,1 | 544 | 341 | hitler_elected_chancellor 124 · fascist_policies 107 · hitler_executed 47 · liberal_policies 22 |
| 9 | 300 | 160,0 | 337 | 344 | fascist_policies 122 · hitler_elected_chancellor 113 · hitler_executed 40 · liberal_policies 25 |
| 10 | 300 | 194,4 | 568 | 359 | fascist_policies 141 · hitler_elected_chancellor 85 · hitler_executed 40 · liberal_policies 34 |

Not: dağılım **oyun dengesi hakkında bir şey söylemez** — oylar ve adaylıklar
tamamen rastgeledir, bu yüzden Hitler'in şansölye seçilmesi gerçek oyuna göre
aşırı sık çıkar. Anlamı: her bitiş yolu (dört neden de) gerçekten ulaşılabilir ve
hiçbir oyun kilitlenmiyor.

### Doğrulanan değişmezler (her adımda, 1 800 oyun)

| # | Değişmez | Sonuç |
| --- | --- | --- |
| 1 | Toplam kart = 17 (deste + çöp + tahta + elde tutulan) ve bileşim 6L/11F | GEÇTİ |
| 2 | Rol haritası ve koltuk sırası oyun boyunca sabit | GEÇTİ |
| 3 | Elenen oyuncu komut veremez / hedef olamaz / oyu kaydolmaz / başkan olmaz | GEÇTİ |
| 4 | Oyun her zaman biter (en uzun oyun 2 000 adım sınırının çok altında) | GEÇTİ |
| 5 | Bitiş nedeni ↔ kazanan + kanun sayıları + Hitler durumu tutarlı; `phase` ile `state` bitiş bilgisi aynı | GEÇTİ |
| 6 | Seçim sayacı 0–2; kanun konulduğunda sayaç sıfırlanmış | GEÇTİ |
| 7 | Tur kısıtı (son şansölye her zaman, >5 hayatta iken son başkan da) hiç ihlal edilmedi — motorun seçicisinden bağımsız kontrol | GEÇTİ |
| 8 | Yetki yalnız `fascistPowers[fascistPolicies-1]` yuvasında ve yuva başına bir kez | GEÇTİ |
| 9 | Kaos politikası yetki açmaz; kaos sonrası `lastGovernment === null` | GEÇTİ (2 695 kaos olayı) |
| 10 | `applyCommand` saf: girdi durumu değişmiyor; aynı durum + aynı komut aynı sonucu veriyor (sunucu `commandId` idempotentliğinin motor tarafı) | GEÇTİ |
| 11 | Geçersiz komutlar durumu HİÇ değiştirmiyor (JSON snapshot eşitliği) — oyun başına 3 rastgele adımda ~20–40 geçersiz komut süpürmesi: oyuncu olmayan kimlik, ölü oyuncu, yanlış aşama, yanlış sahip, bilinmeyen kart, tur kısıtlı aday, kilitli veto, hedefsiz hedefli yetki | GEÇTİ |

**Bulunan hata**: değişmez ihlali **yok**. Kural karşılaştırmasından çıkan B1 ise
simülasyonda ölçüldü: 9–10 kişilik masalarda **1 800 oyunun 41'inde** (9 kişi
24/300, 10 kişi 17/300) aynı oyuncu iki farklı başkan tarafından incelendi.
5–8 kişide 0 (o düzenlerde en fazla bir `investigate_loyalty` yuvası var).

## 3. Gizlilik denetimi

Dosya: `packages/server/src/projection.privacy.test.ts` (yeni).
Sürücü **gerçek sunucu yolunu** kullanır: `projectActions` → `resolveEngineCommand`
→ `applyCommand`, yani istemcinin göremediği hiçbir seçenek üretilmez. Her adımda
**her oyuncu için** `projectView` üretilip denetlenir (6 masa boyu × 12 oyun).

| Kontrol | Yöntem | Sonuç |
| --- | --- | --- |
| Başkasının rolü | Görünümün TÜM anahtar yolları taranır; `role` yalnız `privateView.role`, `privateView.knownPlayers[].knowledge.role`, `result.revealedRoles[].role` yollarında olabilir | sızıntı yok |
| Başkasının partisi | `party` yalnız `privateView.knownPlayers[].knowledge.party` ve `privateView.inspection.party` | sızıntı yok |
| Herkese açık `players[]` | Alan adları beyaz listeyle karşılaştırılır (12 alan; rol/parti/el/oy yok) | sızıntı yok |
| Başkasının eli | `privateView.hand` uzunluğu, o aşamada yetkili taşıyıcı için beklenen uzunlukla birebir; başka herkeste 0 | sızıntı yok |
| Açılmamış oy | `submittedVote` her zaman yalnız kendi oyum; devam eden seçim `lastElection` ile açılmıyor; başkasının oyu yalnız `hasVoted` boolean'ı | sızıntı yok |
| Hitler 7+ oyuncuda faşistleri görmez | Rol/masa boyu kombinasyonları + `knownPlayers` kaynak doğrulaması (her kayıt kural gerekçesine bağlanır) | doğru |
| Liberal hiçbir takım bilgisi almaz | Aynı süpürme | doğru |
| İnceleme sonucu yalnız başkana | `inspection !== null` ⇔ (`executive_action` + ben başkanım + `phase.inspection` dolu) | doğru |
| Deste tepesi yalnız başkana | `policy_peek` sonrası diğer 4–9 oyuncunun görünümünde `"upcoming"` dizesi bile yok | doğru |
| `publicHistory` | `power_used` girdisi `party`/`cards` taşımıyor; `veto_enacted` ve `game_over` hiç yayınlanmıyor | doğru |
| `cues` | Her olay her oyuncu için ayrı süzülür: `cards_dealt` yalnız alıcıya; hiçbir cue anahtar yolunda `role`/`party` yok; `player_eliminated` rol taşımıyor | doğru |
| `result` | Oyun sürerken `null`, bitince dolu (roller yalnız o zaman) | doğru |
| `actions` | Verilen `cardId` seçenekleri her zaman kendi elimde; `phaseId` güncel | doğru |

Not (B6): `veto_response` aşamasında **başkan da** iki kartı görüyor
(`projection.ts:371-373`). Bu sızıntı DEĞİL — üç kartı çeken ve birini atan
kişi zaten o ikisini bilir ve resmî kural vetoyu bu bilgiyle onaylamasını ister.
Teste gerekçesiyle yazıldı.

## 4. Sunucu akışı

| Konu | Durum | Kanıt |
| --- | --- | --- |
| Idempotentlik (`processed_commands`) | ✔ | `commandKey = gameId:userId:commandId`; DB'de satır kilidi altında tekrar kontrolü, aynı işlemde yazım (`0002_functions.sql:165-198`). Aynı `commandId` → `DUPLICATE` → ikinci etki yok; farklı içerikle aynı `commandId` → `DUPLICATE_DIGEST_MISMATCH` → `NOT_ALLOWED`. Testler: `service.concurrency.test.ts:81,108`, `service.dev-scenario.test.ts:127,137` |
| CAS / revision çakışması | ✔ | `select … for update` + `revision <> p_expected_revision` → `version_conflict`; servis en çok 12 kez yeniden dener, sonra `RETRYABLE_CONFLICT` (`service.ts:464-529`). Sinyal aynı işlemde (`notify_room_revision`) → geri alınırsa gönderilmez |
| Eşzamanlı oylar | ✔ | `service.concurrency.test.ts:33,54` — tüm oylar sayılıyor, başkasının oyu benim kabulümü geçersizleştirmiyor |
| Eski aşama | ✔ | `resolveEngineCommand` `requestedPhaseId !== phaseIdOf(state)` → `STALE_ACTION` (`engine-map.ts:26-29`); `service.concurrency.test.ts:122` |
| Yeniden bağlanma (`resync`) | ≈ | `getView({resync:true})` tam görünümü `resync` bayrağıyla verir; istemci (`useRoomState.ts:351`) cue kuyruğunu bu bayrakla sıfırlar. Sunucu tarafında `resync` için ayrı test yok (küçük boşluk) |
| Bot komutlarının izin denetimi | ✔ | Botlar ayrı sunucu komutu KULLANMIYOR: `apps/web/src/dev/botRunner.ts` her bot için ayrı anonim oturum açar ve normal `submitCommand` yolundan gider. Yetki `resolveEngineCommand` + motor tarafından aynen uygulanır; bot kodu üretim paketine girmiyor (DEV ağaç sarsımı) |
| `dev_scenario` kapısı | ✔ | `SECRET_TABLE_DEV_TOOLS === '1'` değilse yanıt bilinmeyen komutla AYNI (`NOT_ALLOWED`) — varlığı ayırt edilemez (`service.ts:162-165`); normal CAS/idempotent `commitMove` yolunu kullanır; `devScenario` rolleri, gizli elleri ve deste bileşimini korur (kart yaratmaz — `devScenario.test.ts` + kart korunumu). Testler: `service.dev-scenario.test.ts:39,55` |
| Yetki kaynağı | ✔ | İstemcinin gönderdiği alan yetki kaynağı değil: `resolveEngineCommand` yalnız `projectActions`'ın ÜRETTİĞİ `actionId`/`optionId`'yi geri okur, sonra motor tüm kuralları yeniden uygular |
| `optionId` atlanması | ✗ | Bkz. **B2** |
| Oyun ortasında rematch | ✔ (dolaylı) | `commandKey` ve `gameId` kontrolü CAS döngüsünün DIŞINDA hesaplanıyor (`service.ts:449-453`), ama döngü içindeki `phaseId` kontrolü yarıştaki komutu `STALE_ACTION` ile durduruyor. Bkz. **B5** |

## 5. Bulgular

### Engelleyici

Yok.

### Önemli

**B1 — `investigate_loyalty` tekliği yanlış boyutta (kural ihlali).** — **düzeltildi (D18)**: kısıt yalnız hedef üzerine çekildi (`selectors.ts`, `engine.ts`); simülasyonda çift inceleme 0.
Resmî kural: *"No player may be investigated twice in the same game."* Motor kısıtı
ise (inceleyen başkan, hedef) çifti üzerinedir; **farklı** bir başkan aynı oyuncuyu
ikinci kez inceleyebiliyor. 9–10 kişilik düzende iki `investigate_loyalty` yuvası
olduğu için durum gerçek oyunda oluşur ve faşist takıma kural dışı fazladan bilgi
verir (ya da bir yuvayı boşa harcatır).

- Ölçüm: 1 800 rastgele oyunun 41'i (9 kişi 24/300, 10 kişi 17/300).
- En küçük tekrar örneği: `engine.simulation.test.ts` → `describe('RULES-AUDIT bulgu B1')`
  (9 kişi; `p1` `p3`'ü inceledikten sonra başkan `p2` yine `p3`'ü inceliyor —
  `investigatableTargetIds(state, 'p2')` `p3`'ü içeriyor ve `use_power` KABUL
  ediliyor. Aynı dosyadaki ikinci test, aynı başkanın tekrar incelemesinin doğru
  biçimde reddedildiğini gösteriyor).
- Simülasyon tohumları: `n=9 seed=9000034` (adım 67, `p8` sonra `p3` → `p6`),
  `n=10 seed=10000043` (adım 141, `p8` sonra `p1` → `p6`).
- Önerilen düzeltme yerleri:
  - `packages/game-core/src/selectors.ts:65-76` — `investigatableTargetIds`: `i.actorId === presidentId &&` koşulunu KALDIR (yalnız `i.targetId === p.playerId` kalsın).
  - `packages/game-core/src/engine.ts:510` — aynı koşulu kaldır (`INVALID_TARGET` ikinci savunma).
  - Düzeltme sonrası `engine.simulation.test.ts` içindeki B1 testinin beklentisi
    `expect(res.ok).toBe(true)` → `toBe(false)` olarak çevrilmeli (test bunu
    yorumunda söylüyor, düzeltilince kırmızıya döner).
- Kenar durum: kısıt hedef bazına çekilince 9–10 kişide ikinci inceleme yuvasında
  hedef listesi daralır; 10 kişide 2 infaz + 1 inceleme sonrası en kötü durumda
  bile hedef kalır (hayatta ≥ 8, yasak ≤ 2), yani kilitlenme riski yok. Yine de
  düzeltmeden sonra simülasyon tekrar koşturulmalı ("yasal komut yok" değişmezi
  bunu yakalar).

**B2 — `optionId` atlanırsa sunucu sessizce ilk seçeneği uyguluyor.** — **düzeltildi (D18)**: seçenek sayısı > 1 iken `INVALID_OPTION` (`engine-map.ts`) + şemada `ACTIONS_REQUIRING_OPTION`.
`engine-map.ts:35-38`: `optionId === undefined` ise `action.options[0]` seçilir.
`optionId` ağ şemasında isteğe bağlı (`contracts/src/schemas.ts:32`), yani bu yol
ağdan erişilebilir. Gerçek servis üzerinden ölçüldü:

| Gönderilen | Sonuç |
| --- | --- |
| `act_vote`, `optionId` yok | Kabul, oy **"evet"** kaydedildi |
| `act_nominate`, `optionId` yok | Kabul, **ilk uygun oyuncu** şansölye adayı oldu, faz `voting`'e geçti |
| `act_respond_veto`, `optionId` yok | (aynı mantık) `veto_accept` → veto kabul + sayaç +1 |

Bu bir kimlik/yetki açığı değil (oyuncu kendi adına hareket ediyor), ama gövdesi
kırpılmış/hatalı bir istemci ya da yeniden deneme, oyuncunun istemediği **gerçek**
bir oyun hamlesi üretir; doğru yanıt `INVALID_OPTION` olmalı.

- Önerilen düzeltme: `packages/server/src/engine-map.ts:35-39` — seçenek sayısı
  1'den fazlaysa `optionId` ZORUNLU olsun:
  `if (optionId === undefined && action.options.length !== 1) return { ok: false, error: 'INVALID_OPTION' };`
  Böylece tek seçenekli türler (`ack_role`, `policy_peek`, `request_veto`,
  `ack_private_result`) etkilenmez, `vote`/`nominate`/`discard`/`enact`/
  `respond_veto`/hedefli `use_power` korunur.
- İstenirse ikinci savunma: `contracts/src/schemas.ts` şemasında `optionId`
  zorunlu bir dal olarak modellenebilir (kırıcı olur, tercih edilmez).

### Küçük

**B3 — Deste yeniden karıştırma ZAMANI (yorum farkı, herkese açık sayaçları etkiliyor).**
Resmî kural desteyi *yasama oturumunun sonunda* (ve kaostan sonra) 3'ten az kart
kalınca karıştırır; motor tembel karıştırır (`engine.ts:135-141`, kaosta
`ensureDeck(s, 1)` — `engine.ts:239`). Çekilen kartlar ve kart havuzu aynı kalır,
ama `table.drawCount` / `discardCount` fiziksel masadan FARKLI görünür: motorda
çekme yığınında 0/1/2 kart gözükebilir. Kart sayan oyuncular için bu gerçek bir
bilgi farkıdır.
- Yer: `packages/game-core/src/engine.ts:135-141` (`ensureDeck`), çağrı noktaları
  `engine.ts:239,291,528`.
- Öneri: yasama oturumu bittikten ve kaos kartı konulduktan sonra
  `ensureDeck(s, PRESIDENT_DRAW_COUNT)` çağırarak erken karıştır (kart havuzu
  değişmez, yalnız sayaçlar masayla eşleşir). Kural ihlali değil, cila.

**B4 — `cues` yalnız hamleyi YAPAN oyuncuya gidiyor.** — **düzeltildi (D18)**: son komutun olayları durum satırıyla saklanıyor, `getView({ sinceRevision })` ardışık sürümde alıcıya süzülmüş cue döndürüyor (`docs/CONTRACT.md §7.1`).
`getView` her zaman `cues: []` döndürüyor (`service.ts:361`); cue'lar sadece
`submitCommand` yanıtında üretiliyor (`service.ts:512`). Sonuç: `votes_revealed`,
`policy_enacted`, `office_moved`, `player_eliminated`, `cards_moved` cue'ları diğer
oyunculara HİÇ ulaşmıyor; onların sahnesi her şeyi görünüm farkından türetmek
zorunda. Sözleşme § 7 bunu yasaklamıyor ("geç/eksik olayda sahne son görünümden
doğru konuma gelir"), ama animasyon yalnız hamleyi yapanda oynuyor.
- İlgili düzeltme: `docs/agents/CLAUDE.md` § 2'deki "`cards_moved` cue'su hiçbir
  yerde üretilmiyor (ROADMAP A4)" saptaması **motor katmanında artık geçersiz**:
  `engine.ts:297,397,399,425,466` bu olayı üretiyor ve `projection.ts:479-482`
  cue'ya çeviriyor. Eksik olan **dağıtım yolu** (yukarıdaki B4), motor değil.
- Yer: `packages/server/src/service.ts:356-363` (`getView`).

**B5 — `commandKey`/`gameId` CAS döngüsünün dışında hesaplanıyor.**
`service.ts:449-453`. Yeniden deneme sırasında araya "yeniden oyna" girerse eski
oyunun `commandKey`'i yeni oyun durumuna karşı kullanılabilir; pratikte
`resolveEngineCommand`'in `phaseId` kontrolü (`engine-map.ts:26-29`) komutu
`STALE_ACTION` ile durduruyor, bu yüzden sömürülebilir değil. Derinlemesine
savunma için `commandKey` ve `command.gameId !== current.gameId` kontrolü döngü
İÇİNDE yapılmalı.

**B6 — `veto_response`'ta el başkana da projekte ediliyor** (`projection.ts:371-373`).
Sızıntı değil (başkan o iki kartı kendi çekip ayırdı), fakat "el yalnız sahibine"
kuralının tek istisnası; teste gerekçesiyle sabitlendi.

### Yorum farkları (kural ihlali değil)

- **Y1** — Özel seçim turunun oylaması reddedilirse özel seçim TÜKENİR ve başkanlık,
  yetkiyi kullanan başkanın soluna döner (`engine.ts:227-236` + `163-171`).
  Kitapçık bu durumu açıkça yazmıyor; uygulanan yorum yaygın/resmî SSS okumasıyla
  uyumludur. Belgelenmesi yeterli.
- **Y2** — `ack_role` (rol onayı) ve `ack_private_result` (özel sonucu gördüm)
  kitapçıkta yoktur; sözleşme § 4 gereği eklenmiş onay adımlarıdır. Kural akışını
  değiştirmezler (yalnız faz kimliği üretirler).
- **Y3** — Yeniden karıştırma belirlenimci tohumla yapılır
  (`deckSeed ^ imul(0x9e3779b9, reshuffles+1)`, `engine.ts:137`). Fiziksel karıştırma
  değil; tekrar oynatılabilirlik (replay) ve sunucu saflığı için gerekli. Tohum
  istemciye hiç gitmiyor (`projection.ts` `deckSeed`'i yayınlamıyor) — doğrulandı.

## 6. Çalıştırılan komutlar

| Komut | Sonuç |
| --- | --- |
| `pnpm --filter @secret-table/game-core test` | **8 dosya / 107 test GEÇTİ** (98 mevcut + 9 yeni; 18,7 s) |
| `pnpm --filter @secret-table/server test` | **7 dosya / 63 test GEÇTİ** (51 mevcut + 12 yeni; 6,1 s) |
| `pnpm -r typecheck` | **6/6 proje GEÇTİ** (contracts, fixtures, game-core, scene, server, apps/web) |

Eklenen dosyalar (yalnız test):

- `packages/game-core/src/engine.simulation.test.ts` — 1 800 oyunluk tohumlu fuzz +
  11 değişmez + B1 için en küçük tekrar örneği. 5 s'lik varsayılan test sınırı
  aşıldığı için masa başına `timeout: 120_000`.
- `packages/server/src/projection.privacy.test.ts` — sistematik gizlilik süpürmesi
  (72 oyun, her adım, her oyuncu) + 6 noktasal kontrol.

Motor, sunucu, sözleşme ve sahne kodu DEĞİŞTİRİLMEDİ. Toplu biçimlendirme yok.
Commit yok.
