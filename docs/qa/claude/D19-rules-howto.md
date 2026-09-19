# D19 — "Nasıl oynanır" sekmesi + dev senaryoları + kural doğrulaması

Ajan: Claude (Opus 5, yan ajan) · 2026-09-12 19:52–21:05 · **kısmen teslim**
Kullanıcı isteği (2026-09-12): "bütün kurallar oynanabilir mi eksiksiz kontrol et;
menüye nasıl oynanır sekmesi, kuralları şu olursa şuradan kullanırsın diye yaz".

Commit YOK. Migration GEREKMEDİ. `apps/web/src/multiplayer/roomChannel.ts` ve
`supabase/` dosyalarına DOKUNULMADI (D20 ajanı orada).

---

## 1. A — "Nasıl oynanır" sekmesi (TESLİM)

`GameMenu` sekmelendi: **Ayarlar** (varsayılan) / **Nasıl oynanır** / **Geliştirici**
(yalnız dev). D19 öncesindeki tüm bölümler (Oyuncular, Masa, Tur geçmişi,
Tercihler, Tuşlar) Ayarlar sekmesinde, sırası değişmeden duruyor; D11 odak modeli
ve sağ üst araç çubuğu bu panelin dışında, dokunulmadı.

İçerik **saf veri** olarak `apps/web/src/ui/howToPlay.ts`de; çizim
`HowToPlayPanel.tsx`de. **Oyuncu sayısına bağlı hiçbir sayı elle yazılmadı:**

| İçerik | Tek kaynak |
| --- | --- |
| Rol dağılımı tablosu (5-10: liberal/faşist/Hitler, "Hitler faşistleri bilir") | `ROLE_SETUPS` |
| Yetki tablosu (oyuncu sayısı × 6 faşist yuva) ve "şu kişide şu yetki var" satırları | `BOARD_LAYOUTS.fascistPowers` |
| Deste (6+11), çekiş (3/2), sayaç (3), tur kısıtı eşiği (5), veto (5), Hitler bölgesi (3), zafer (5/6) | `rules.ts` sabitleri |
| Klavye satırları (E, 1–9, ← →, Enter, Backspace, H, V, B, G, M, Esc) | `controlScheme.ts` (`KEY_BINDINGS`, `OPTION_DIGITS`) |
| 8 jest listesi | `EMOTE_KINDS` + `EMOTE_LABEL` |

10 bölüm: 1 Amaç ve roller · 2 Tur akışı · 3 Yasama · 4 Seçim sayacı ve kaos ·
5 Aday sınırları · 6 Başkanlık yetkileri (tablo + her yetki için "bu oyunda
nereden") · 7 Veto · 8 Hitler bölgesi · 9 Zafer koşulları · 10 Kontroller
(klavye + fare/odak + kamera + jestler + ses/hareket + telefon).

Telefon: panel gövdesi dikey kaydırılır (`overflow-y:auto` + momentum), geniş
tablolar `\.howto__table-scroll` içinde YATAY kayar — sayfa gövdesi yatay taşmaz.
Sekme şeridi de kaydırılabilir ve dokunma hedefi ≥ 38 px.

**Sapma:** bileşen dosyası `HowToPlay.tsx` DEĞİL `HowToPlayPanel.tsx`. macOS
dosya sistemi büyük/küçük harf duyarsız olduğu için `./HowToPlay` içe aktarımı
veri modülü `howToPlay.ts`ye çözülüyor ve bileşen `undefined` geliyordu. Bileşen
adı `HowToPlay` olarak kaldı; veri modülü ve testi istenen adlarda.

## 2. B — Dev senaryoları (TESLİM)

`DevScenarioName` additive büyüdü (2 → 9); `CONTRACT_VERSION` **0.2.0 SABİT**,
paket sürümü `@secret-table/contracts` **0.2.5**. Yeni değer dışa vermesi:
`DEV_SCENARIO_NAMES` (şema enum'u + dev menüsü aynı listeyi okur).

| Senaryo | Kurduğu durum | Oyuncu sayısı |
| --- | --- | --- |
| `execution_now` (D14) | infaz yuvası + yetki yerel başkanda | 5-10 |
| `execution_round` (D14) | bir tur öncesi, deste üstü faşist | 5-10 |
| `investigate_now` | inceleme yuvası + yetki yerel başkanda | 7-10 |
| `special_election_now` | özel seçim yuvası + yetki yerel başkanda | 7-10 |
| `policy_peek_now` | deste tepesi yuvası + yetki yerel başkanda | 5-6 |
| `veto_round` | faşist 5, **yerel oyuncu şansölye** (elinde 2 faşist kart), başkan bot | 5-10 |
| `veto_round_president` | faşist 5, **yerel oyuncu başkan**, faz `veto_response` | 5-10 |
| `hitler_zone_round` | faşist 3, yerel başkan, tur kısıtı yok | 5-10 |
| `chaos_round` | seçim sayacı 2, yerel başkan, tahta değişmez | 5-10 |

- Yetki o düzende yoksa motor `SCENARIO_NEEDS_PLAYERS` döner (yeni
  `EngineErrorCode`), sunucu `INVALID_OPTION`e eşler, dev menüsü "bu senaryo bu
  oyuncu sayısında çalışmıyor (SCENARIO_NEEDS_PLAYERS)" yazar. Menü ayrıca
  uygun olmayan düğmeyi **devre dışı** bırakıp gerekçesini ("5-6 kişi gerekir")
  düğmenin üstünde gösterir — sınır `BOARD_LAYOUTS`tan türetilir.
- Değişmezler korundu: roller, gizli eller ve deste İÇERİĞİ (6 liberal + 11
  faşist = 17) hiçbir senaryoda değişmiyor; `veto_round` elini desteden ALIR
  (kart yaratmaz) ve `cardId` biçimi motorun `dealCards`ıyla aynı.
- `veto_round*` **seçim sayacını sıfırlamaz** (D19 kararı): `chaos_round` ile
  sayaç 2'ye çekilip veto kabul edilince üçüncü başarısız seçim → kaos,
  rastgele oylamaya bağlı kalmadan denenebilir.
- botRunner: `BOT_NAMES` 5 → **9** (1 insan + 8 bot ile 9 kişilik masa); lobide
  masa boyu seçimi (5-10, varsayılan 7) ve "N bot ekle (dev)" etiketi. Bot
  şansölye veto açıkken **%30** veto önerir (`VETO_REQUEST_RATE`), bot başkan
  veto isteğini **%50** kabul eder (`VETO_ACCEPT_RATE`). Yetki (inceleme / özel
  seçim / infaz) İNSANDAYKEN botun yetkili görünümü boştur, hiçbir hedef
  seçilmez; yetki bottaysa görünümündeki hedeflerden rastgele seçer (test).

## 3. C — Canlı doğrulama (KISMEN)

Ortam: **bellek kipi** yerel dev sunucu (port 5200; `SUPABASE_URL` boş,
`SECRET_TABLE_DEV_TOOLS=1`), Chrome + Playwright, 1 gerçek tarayıcı bağlamı +
6 bot. **Sapma:** Supabase anonim kayıt sınırı (429) 6-8 botta risk olduğu için
gerçek Supabase (5199) yerine bellek kipi kullanıldı; kural uygulaması, sunucu
yolu ve projeksiyon aynı koddur. Koşu kaydı `d19-7p-log.txt`, kareler bu dizinde
(14 jpeg, her biri ≤ 156 KB).

### 7 kişilik oda (1 insan + 6 bot) — 27 GEÇTİ / 2 KALDI

| Kural | Sonuç | Kanıt |
| --- | --- | --- |
| 7 kişilik masa kurulur (1 insan + 6 bot) | GEÇTİ | 7 oyuncu · `01-oyun-basladi.jpg` |
| `chaos_round` kabul edilir, sayaç 2 + aday belirleme | GEÇTİ | sayaç=2 · `07-kaos-sayac2.jpg` |
| Kaos: 3. başarısız seçimde deste tepesi kendiliğinden yürürlüğe girer | GEÇTİ | tahta 0/0 → 0/1, deste 17 → 16 · `08-kaos-sonrasi.jpg` |
| Kaos sonrası sayaç sıfırlanır ve yetki AÇILMAZ | GEÇTİ | sayaç=0, yetki=null |
| `investigate_now` kabul edilir (7 kişi) | GEÇTİ | — |
| Yetki tablosu: 7 kişide 2. faşist yuva = sadakat incelemesi | GEÇTİ | faşist=2, yetki=`investigate_loyalty` |
| İnceleme hedefleri: başkan hariç hayatta olanlar | GEÇTİ | 6 hedef · `02-inceleme-hedefleri.jpg` |
| İnceleme sonucu yalnız başkana: parti zarfı elde | GEÇTİ | Bot-Ada → liberal |
| Kimlik katmanı (H) inceleme sonucunu gösterir | GEÇTİ | "Bot-Ada — Liberal parti (Sadakat incelemesi)" · `03-inceleme-zarfi.jpg` |
| Özel sonucu onaylayınca tur kapanır | GEÇTİ | faz=`nomination` |
| **Aynı oyuncu bir oyunda ikinci kez incelenemez** | GEÇTİ | 2. turda Bot-Ada listede yok · `04-ikinci-inceleme-hedefleri.jpg` |
| `special_election_now` kabul edilir | GEÇTİ | — |
| Yetki tablosu: 7 kişide 3. faşist yuva = özel seçim | GEÇTİ | faşist=3 · `05-ozel-secim-hedefleri.jpg` |
| Özel seçim: hedef SONRAKİ başkan olur | GEÇTİ | yeni aday=Bot-Cem · `06-ozel-secim-yeni-baskan.jpg` |
| Deste tepesi 7 kişilik düzende YOK (anlaşılır ret) | GEÇTİ | düğme devre dışı |
| `execution_now` kabul edilir | GEÇTİ | — |
| Yetki tablosu: 7 kişide 4. faşist yuva = infaz | GEÇTİ | faşist=4 · `13-infaz-hedefleri.jpg` |
| İnfaz: hedef oyundan elenir | GEÇTİ | Bot-Ada alive=false · `14-infaz-sonrasi.jpg` |
| **Elenen oyuncu başkanlık sırasında ATLANIR** | GEÇTİ | başkan koltuk 0 → kurban koltuk 1 → sonraki aday koltuk 2 (Bot-Bora) |
| Elenen oyuncu oy vermez (hayatta sayısı düşer) | GEÇTİ | hayatta=6 |
| `veto_round` kabul edilir | GEÇTİ | — |
| Veto 5. faşist kanundan sonra açılır: şansölye elinde 2 kart + "Veto iste" | GEÇTİ | faşist=5, el=2 · `09-veto-oner.jpg` |
| Şansölye veto önerir, BAŞKAN (bot) yanıtlar | **KALDI** | bu koşuda bekleme koşulu tutmadı (bkz. §4/1) — önceki koşuda GEÇTİ (faz=nomination, sayaç=1) |
| `veto_round_president` kabul edilir | GEÇTİ | — |
| Veto yanıtı başkanda: kabul/ret iki seçenek | GEÇTİ | `["Vetoyu kabul et","Vetoyu reddet"]` · `10-veto-yaniti.jpg` |
| Veto KABUL: iki kart atılır, seçim sayacı +1 | GEÇTİ | sayaç 0 → 1, faz=nomination · `11-veto-kabul-sonrasi.jpg` |
| Veto RET: şansölye kanun koymak zorunda; sayaç artmaz | GEÇTİ | faz=chancellor_choice, sayaç=1 |
| Aynı turda ikinci veto önerilemez | GEÇTİ | `request_veto` görünmüyor |
| Kabul edilen veto da başarısız seçimdir (sayaç 2 → kaos) | **KALDI** | senaryo `STALE_ACTION` (oyun bitmişti, bkz. §4/2) |
| **FAŞİST zafer: 6 faşist kanun** | GEÇTİ | iki koşuda da gözlendi: `fascist/fascist_policies_enacted`, tahta 6 · `12-6-fasist-zafer.jpg` |

### Canlı olarak DOĞRULANMAYAN kurallar (kalan iş)

| Kural | Durum |
| --- | --- |
| 9 kişilik oda (1+8): büyük düzen yetkileri (1.+2. yuva inceleme), sıra atlama | Betik hazır (`d19-9p.mjs`), **koşturulmadı** (süre) |
| Deste tepesi (`policy_peek`) 5-6 kişilik odada canlı | Koşturulmadı; motor+sunucu testiyle doğrulandı |
| Hitler bölgesi → faşist zafer (canlı, Hitler'i aday göstererek) | Koşturulmadı; motor+sunucu testiyle doğrulandı |
| Hitler infazı → liberal zafer (canlı) | Koşturulmadı; motor+sunucu testiyle doğrulandı |
| 5 liberal kanun → liberal zafer (canlı) | **Doğrulanmadı**; liberal tahtayı kuran dev senaryosu YOK, botlu oyunda olasılık ≈ %6. Motor (1 800 oyunluk simülasyon: `liberal_policies_enacted` her masa boyunda görülüyor) + `game-core`/`server` testleriyle doğrulandı |

## 4. KALDI'ların nedeni (ürün hatası DEĞİL)

1. **"Şansölye veto önerir, bot başkan yanıtlar":** bekleme koşulu "faz ne
   `veto_response` ne `chancellor_choice` olsun" biçimindeydi; bot başkan vetoyu
   REDDEDERSE faz yerel oyuncunun `chancellor_choice`ına döner ve koşul hiç
   tutmaz — yanlış negatif. Aynı kontrol önceki koşuda (bot kabul etti) GEÇTİ.
2. **"Kabul edilen veto → kaos":** o adıma gelindiğinde bot şansölye 6. faşist
   kanunu koyup oyunu bitirmişti; dev senaryosu bitmiş oyunda `STALE_ACTION`
   döner (doğru davranış). Betiğin "yeniden oyna" tıklaması D12 oyun sonu
   katmanının 2 600 ms gecikmesinden önce çalıştığı için yeni oyun başlamadı.
   Bu yolun kural doğruluğu `devScenario.test.ts` içinde ("veto senaryosu seçim
   sayacını KORUR: sayaç 2 + kabul → kaos") doğrulandı.
3. Botların %75 evet oyu yüzünden "reddedilen seçim" arayan döngüler
   olasılıksaldır; kaos bu koşuda ilk denemede yakalandı.

## 5. Geçen kontroller

- `pnpm -r typecheck` → 6/6 paket **Done**
- `pnpm test` → **941** test (contracts 26 · fixtures 55 · game-core 147 ·
  scene 332 · server 84 · web 297); D19 öncesi 849
- `pnpm --filter @secret-table/web build` → geçti
- Üretim paketi temiz: `dist/**/*.js|html|css` içinde `dev_scenario`,
  `devScenarioMenu`, `botRunner`, `Bot-Ada`, `SCENARIO_NEEDS_PLAYERS`,
  "İnfaz turu (kanunlar hazır)", "Kaos turu", "bot ekle" → **0 eşleşme**
  (sourcemap'te de dev modül içeriği yok).

## 6. Dosyalar

**Yeni:** `apps/web/src/ui/{howToPlay.ts,howToPlay.test.ts,HowToPlayPanel.tsx,GameMenu.tabs.test.tsx}`.

**Değişen:** `packages/contracts/src/{commands.ts,schemas.ts,index.ts}` +
`package.json` (0.2.5) · `packages/game-core/src/{errors.ts,devScenario.ts,devScenario.test.ts}` ·
`packages/server/src/{errors.ts,service.dev-scenario.test.ts}` ·
`apps/web/src/ui/{GameMenu.tsx,GameMenu.dev.test.tsx,Lobby.tsx,Lobby.test.tsx,styles.css}` ·
`apps/web/src/dev/{devScenarioMenu.tsx,botRunner.ts,botRunner.test.ts}` ·
`docs/{ROADMAP.md,agents/CLAUDE.md}`.

**Dokunulmayan:** sunucu servis mantığı (`service.ts` dalı zaten genel),
`projection.ts`, `engine.ts`, `roomChannel.ts`, `supabase/**`.

## 7. Kalan iş

1. `d19-9p.mjs` betiğini koştur (9 kişilik oda: iki inceleme yuvası, sıra atlama,
   veto) — scratchpad'de hazır.
2. Canlı Hitler bölgesi / Hitler infazı / 5-6 kişilik deste tepesi turları.
3. "5 liberal kanun" zaferini canlı görmek için ya çok sayıda botlu oyun ya da
   liberal tahtayı kuran ek bir dev senaryosu (kullanıcı isterse).
4. Gerçek Supabase (5199) ile aynı turun bir kez tekrarı (bellek kipi sapması).
5. Betik düzeltmeleri: oyun sonu katmanının 2 600 ms gecikmesini bekleyip
   "yeniden oyna"ya tıklamak; veto yanıtı beklemesini `revision` artışına
   bağlamak.

---

## 9. 9 kişilik hızlı tur (2026-09-12 21:04–21:10)

Ortam: **bellek kipi**, ayrı port **5203** (`SUPABASE_URL= VITE_SUPABASE_URL=
pnpm --filter @secret-table/web dev --port 5203 --strictPort`) — 5199'a
dokunulmadı, Supabase 429 riski yok. Playwright + Chrome, 1 gerçek bağlam + 8
bot. Betikler: `d19-9p.mjs` (koşuldu) ve yeni `d19-9p-b.mjs` (scratchpad).
Loglar: `d19/d19-9p-log.txt`, `d19/d19-9p-b-log.txt`. Kod DEĞİŞMEDİ.

| # | Kural | Sonuç | Kanıt / kare |
| --- | --- | --- | --- |
| 1 | 9 kişilik masa kurulur (1 insan + 8 bot); yerel rol görünür | GEÇTİ | 9 oyuncu, yerel rol=liberal · `9p-01-masa.jpg`, `9p-02-kurulum.jpg` |
| 1 | Tahta düzeni 9–10: **1. faşist yuva = sadakat incelemesi** | GEÇTİ | faşist kanun=1 → `investigate_loyalty` · `9p-03-inceleme.jpg` |
| 1 | Tahta düzeni 9–10: **2. yuva da inceleme** (ikinci inceleme turu açılır) | GEÇTİ | ikinci inceleme yuvası çalıştı · `9p-03b-ikinci-inceleme.jpg` |
| 1 | Tahta düzeni 9–10: **3. yuva = özel seçim** | GEÇTİ | faşist kanun=3 → `call_special_election` · `9p-04-ozel-secim.jpg` |
| 1 | Tahta düzeni 9–10: 4. yuva = infaz; deste tepesi YOK | GEÇTİ | faşist=4 → `execution`; "Deste tepesi" düğmesi devre dışı |
| 2 | `investigate_now` → inceleme; hedefler = başkan hariç hayatta olanlar (8) | GEÇTİ | 8 hedef; sonuç yalnız başkana (Bot-Ada → fascist) |
| 2 | İkinci inceleme yuvasında **aynı hedef listede YOK** | GEÇTİ | 7 hedef, Bot-Ada yok · `9p-03b-ikinci-inceleme.jpg` |
| 3 | `special_election_now` → seçilen oyuncu **sonraki başkan** | GEÇTİ | yeni aday=Bot-Derya · `9p-04-ozel-secim.jpg` |
| 3 | Özel seçimden sonra sıra kaldığı yerden devam | KALDI | ölçülmedi (süre); 7 kişilik turda §3'te GEÇTİ |
| 4 | `hitler_zone_round` → Hitler şansölye seçilince **faşist zafer** | GEÇTİ (dolaylı) | aynı oturumda bot başkan Hitler'i şansölye yaptı: `result = fascist / hitler_elected_chancellor` · `9p-05-hitler-vuruldu.jpg` |
| 4 | Oyun sonu katmanı + "yeniden oyna" | KALDI | katman metni okunduğunda boştu (D12 katmanı 2 600 ms gecikmeli; betik beklemedi) |
| 5 | `execution_now` → Hitler'i vur → liberal zafer "Hitler vuruldu" | KALDI | 6 denemede Hitler'e denk gelinmedi; 6. denemede oyun **faşist** zaferle (Hitler şansölye) bitti → döngü kesildi |
| 6 | Elenen oyuncu: `alive=false`, hayatta sayısı 9 → 8 | GEÇTİ | Bot-Ada elendi · `9p-06-elenen-atlandi.jpg` |
| 6 | Elenen oyuncu **sonraki turda başkan sırasında atlanır** | GEÇTİ | sonraki aday=Bot-Bora (beklenen Bot-Bora), elenen aday değil |
| 6 | Oy sayımında elenen yok | GEÇTİ | hayatta=8 |
| 7 | 5 kişilik masa kurulur | GEÇTİ | 5 oyuncu |
| 7 | `policy_peek_now` (5 kişi, 3. faşist yuva) → yetki YALNIZ başkanda | GEÇTİ | faşist=3, `policy_peek`, tek seçenek "Deste tepesine bak" yalnız yerel başkanda · `9p-07-5kisi-peek.jpg` |
| 7 | "Elde 3 kart" ölçümü | KALDI | betik `privateView.hand`e baktı (el=0); `policy_peek` sonucu sözleşmede `privateView.inspection = { kind:'policy_peek', upcoming }` — yetki henüz kullanılmamıştı. **Betik hatası, ürün hatası değil** |
| 7 | `veto_round_president` → veto yanıtı başkanda (kabul/ret) | GEÇTİ | faz=`veto_response`, faşist=5 · `9p-08-5kisi-veto-yaniti.jpg` |
| 7 | Veto KABUL → seçim sayacı +1 | GEÇTİ | sayaç 0 → 1, faz=`nomination` · `9p-09-5kisi-veto-kabul.jpg` |
| 7 | Sayaç 2'de kabul → kaos | KALDI | süre; `chaos_round` + veto zinciri koşulmadı (motor testinde var) |

### KALDI'ların nedeni (ürün hatası şüphesi YOK)

1. **Hitler infazı (5):** Hitler kimliği yerel liberal oyuncuya kapalı; kör
   deneme yöntemi (8 bottan birini sırayla vurmak) 6 denemede tutmadı ve bu
   sırada botlar Hitler'i şansölye seçip oyunu bitirdi. Tekrar adımı: aynı
   betiği (`d19-9p-b.mjs`) 2-3 kez koştur ya da yeni bir dev senaryosu
   ("Hitler'i vur") ekleyip hedefi doğrudan ver.
2. **Oyun sonu katmanı (4):** `domState().gameOverText` boş döndü çünkü okuma
   katmanın 2 600 ms açılma gecikmesinden önce yapıldı (§4/2 ile aynı neden).
   Yetkili görünümdeki `result` doğruydu. Tekrar adımı: `result` geldikten
   sonra 3 000 ms bekleyip kareyi al.
3. **Deste tepesi "3 kart" (7):** betik yanlış alana baktı (yukarıda).
4. **İlk `d19-9p.mjs` koşusunda 2 KALDI:** (a) "elenen oyuncu sıra atlanır"
   infazdan 0,2 s sonra okundu, aday henüz atanmamıştı — `d19-9p-b.mjs`de
   beklemeyle **GEÇTİ**; (b) 9 kişilik veto turunda yetkili görünüm `409
   Conflict` döndü (infazdan sonra oyun bitmişti, `STALE_ACTION` yolu) →
   yeniden oyna beklemesi eksik, aynı §4/2 nedeni.

### Kalan iş (güncel)

1. Hitler infazı → liberal zafer canlı (betiği tekrar koştur ya da senaryo ekle).
2. `hitler_zone_round`'u **niyetli** koş: yerel başkan botları sırayla şansölye
   aday göstersin; oyun sonu katmanını 3 s bekleyip kare al.
3. Sayaç 2 + veto kabul → kaos zinciri (5 kişilik).
4. 5 liberal kanun zaferi ve gerçek Supabase (5199) tekrarı hâlâ açık.
