# D9 — Faz/olay duyuruları ekranın ortasında

Teslim: 2026-09-11, Claude (Opus yan ajan). Kullanıcı görsel kabulü bekleniyor.
İstek: "Eylül şansölye adayını seçiyor / kart seçiyor tarzı bildirimler; oylama
aşamasında herkeste ekranın ortasında OYLAMA yazsın; oyun takibi artar."

## Ne değişti

### 1. Saf karar katmanı — `apps/web/src/ui/announcements.ts`

`announcementsFor(view, cues, previous?) → Announcement[]`
(`{ key, title, subtitle, note?, tone, durationMs }`).

- **Tekillik:** anahtar `phase:<phaseId>` / `cue:<cueId>` / `history:<entryId>`.
  Aynı anahtar iki kez çıkmaz.
- **Yeniden bağlanma / ilk yükleme:** `previous` verilmezse `[]` döner —
  geçmiş fazlar yeniden oynatılmaz. `announcementCandidates()` yalnız
  tohumlamak (görülmüş saymak) için kullanılır.
- **Sıra:** önce biten adımın sonucu (cue / kaos), sonra yeni aşama.
- **Süre:** faz `PHASE_MS = 2600`, sonuç/tehlike `RESULT_MS = 3200`.
- **Kuyruk:** `enqueueAnnouncements` en fazla 3 tutar, taşarsa en eski düşer.

| Durum | Başlık | Alt satır | Ton |
| --- | --- | --- | --- |
| `role_reveal` | ROLLER DAĞITILDI | Kimliğine bak: H | phase |
| `nomination` | ADAY SEÇİMİ | `Başkan Mert şansölye adayını seçiyor` / yerelse `Şansölye adayını seç` | phase / you |
| `voting` | OYLAMA | `Mert / Deniz hükümeti için oy ver`; oy verdiyse `Oyunu verdin` | you / phase |
| `votes_revealed` cue | HÜKÜMET KURULDU / HÜKÜMET REDDEDİLDİ | `Evet 4 · Hayır 3` (+ `Seçim sayacı 2/3`) | result |
| `president_discard` | YASAMA | `Başkan Mert 3 karttan birini atıyor` / `Bir kart at` | phase / you |
| `chancellor_choice` | YASAMA | `Şansölye Deniz kanunu seçiyor` / `Kanunu seç` | phase / you |
| `veto_response` | VETO | `Başkan Mert veto önerisini yanıtlıyor` / `Şansölye veto istedi: yanıtla` | phase / you |
| veto kabulü (cue) | VETO | `Veto kabul edildi: kanunlar atıldı` (+ sayaç) | result |
| `policy_enacted` cue | LİBERAL KANUN / FAŞİST KANUN | `Tahta: 2 liberal · 3 faşist` | result |
| 3. faşist kanun | FAŞİST KANUN | + `Hitler artık şansölye seçilirse oyun biter` | **danger** |
| 5. faşist kanun | FAŞİST KANUN | + `Veto açıldı` | **danger** |
| `chaos_policy` (geçmiş) | KAOS | `Üç başarısız seçim: üstteki kanun uygulandı` | danger |
| `executive_action` | BAŞKANLIK YETKİSİ | `Sadakat incelemesi · Başkan Mert oyuncu seçiyor` / `… · Bir oyuncu seç` | phase / you |
| `player_eliminated` cue | İNFAZ | `Barış vuruldu` | danger |
| `office_moved` (özel seçim) | ÖZEL SEÇİM | `Mert sonraki başkanı seçti: Deniz` | result |
| `game_ended` cue | LİBERALLER / FAŞİSTLER KAZANDI | bitiş nedeni | result |

`cards_dealt` bilinçli olarak ekran ortasına çıkmaz; üst şeritteki mevcut
"Kartlar dağıtıldı" vurgusu yeterli.

Kural sabitleri sözleşmeden okunur: `BOARD_LAYOUTS[boardVariant]`
(`hitlerChancellorWinAt = 3`, `vetoUnlockAt = 5`) ve `ELECTION_TRACKER_MAX = 3`.
Metinler `text.ts` sözlüğünden (`POWER_NAMES`, `WINNER_NAMES`,
`END_REASON_NAMES`); ham anahtar sızmaz (test var).

**Bulgu:** sözleşme `veto_enacted` genel geçmiş girişi TAŞIMAZ
(`packages/server/src/projection.ts` onu düşürüyor). Veto kabulü bu yüzden
cue'dan türetiliyor: `cards_moved {from: 'chancellor', to: 'discard'}` **ve aynı
grupta `policy_enacted` cue'su yok** → veto. Normal yasama akışında hep bir
`policy_enacted` bulunur, dolayısıyla yanlış duyuru çıkmaz.

### 2. Bileşen — `apps/web/src/ui/Announcer.tsx`

- Üst-orta bölge: `top: 22%` (telefon %24, kısa yatay %20). Eller, kartlar ve
  alt tuş çubuğu kapanmıyor (kareler).
- Pano: yarı saydam koyu zemin + ince pirinç çizgi (`--brass`), mevcut HUD
  dili; başlık **mevcut HUD fontu** (`--font`, Fraunces yok) 40 px masaüstü /
  28 px telefon, `letter-spacing: 0.08em`; alt satır 16/14 px, ek not 13/12 px.
- Giriş/çıkış 200 ms (opacity + 10 px yukarı kayma);
  `prefers-reduced-motion` ve `prefs.reducedMotion` iken anında.
- `pointer-events: none` (tıklamayı engellemez), `role="status"
  aria-live="polite"` yalnız görünür metinle. `z-index: 25` — üst şerit/alt
  çubuğun (20) üstünde, kimlik katmanı (30) ve oyun sonu (40) altında.
- Tonlar: `you` altın (`--accent`), `danger` kırmızımsı + kehribar not,
  `result` **nötr krem** (yeşil/kırmızı rol ima etmesin; kanun rengi zaten
  kartın kendi kamu rengi).
- Kuyruk ve zamanlayıcı burada; karar tamamen saf katmanda. `gameId` değişince
  kuyruk boşalır ve yeniden tohumlanır.

### 3. Tercih

`usePrefs.ts` → `announcements: boolean` (varsayılan **açık**; eski kayıtta alan
yoksa da açık). `GameMenu` → "Duyurular" anahtarı. Kapalıyken `GameScreen`
bileşeni hiç çizmez, üst şerit tek başına kalır.

### 4. Fixture (additive)

Duyuruyu gerçek tarayıcıda görebilmek için iki senaryo eklendi; mevcut
fixture'lar değişmedi:

- `policy-fascist-third` — 3. faşist kanun + `policy_enacted` cue (Hitler uyarısı).
- `execution-result` — `player_eliminated` cue, hedef koltuk ölü.

## Dosyalar

| Dosya | Değişiklik |
| --- | --- |
| `apps/web/src/ui/announcements.ts` | yeni — saf karar katmanı |
| `apps/web/src/ui/announcements.test.ts` | yeni — 29 test |
| `apps/web/src/ui/Announcer.tsx` | yeni — kuyruk + zamanlayıcı + çizim |
| `apps/web/src/ui/Announcer.test.tsx` | yeni — 6 render testi |
| `apps/web/src/ui/GameScreen.tsx` | `Announcer` bağlandı (tercihe bağlı) |
| `apps/web/src/ui/usePrefs.ts` | `announcements` tercihi |
| `apps/web/src/ui/GameMenu.tsx` | "Duyurular" anahtarı |
| `apps/web/src/ui/styles.css` | `.announcer*` blokları + telefon/kısa ekran/reduced-motion |
| `packages/fixtures/src/scenes/{legislative,executive}.ts`, `registry.ts` | 2 additive fixture |

`packages/contracts` **değişmedi**, `packages/scene` **değişmedi**,
`docs/design/**` **değişmedi**; yeni bağımlılık yok; gizli değer yok.

## Gizlilik

Duyurular yalnız `SceneView`in kamu alanlarını (`players`, `table`,
`publicHistory`, `currentPower`, `lastElection`, cue payload'ları) ve yerel
oyuncunun KENDİ `privateView` / `actions` alanlarını okur. Başka oyuncunun
rolü, eli ya da oy tercihi hiçbir duyuruya girmez; `announcements.test.ts`
içinde 11 fixture üzerinde ham anahtar / sızıntı taraması var.

## Görseller

`docs/qa/claude/d9/` — Chrome + Playwright, dev sunucu **5199**
(5173'e dokunulmadı, iş bitince kapatıldı), **konsol hatası yok**.
Duyuru tetikleme: `/dev/game` fixture seçicisiyle iki senaryo arasında geçiş
(gerçek faz/cue değişimi; dev sayfasına kod eklenmedi).

| Kare | İçerik |
| --- | --- |
| `voting-desktop.png` | 1440×900 @dpr2, `nomination → voting`: "OYLAMA / Mert · Deniz hükümeti için oy ver", altın ton |
| `voting-phone.png` | 390×844 @dpr2, aynı geçiş; 28 px başlık, masa ve alt çubuk açık |
| `policy-fascist3.png` | `president-discard → policy-fascist-third`: "FAŞİST KANUN / Tahta: 2 liberal · 3 faşist / Hitler artık şansölye seçilirse oyun biter" |
| `execution.png` | `executive-action → execution-result`: "İNFAZ / Barış vuruldu", tehlike tonu |

Betik: `scratchpad/d9-shots.mjs` (port argümanlı).

## Doğrulama (gerçek çıktılar)

```
pnpm -r --workspace-concurrency=1 typecheck   # 6/6 paket, hatasız
pnpm test                                     # 466 test (429 → 466)
  contracts 11 · fixtures 33 · game-core 70 · scene 131 · server 35 · web 186
pnpm --filter @secret-table/web build         # ✓ built in 3.23s
node scratchpad/d9-shots.mjs 5199             # 4 kare, "konsol hatası yok"
```

Commit / push yapılmadı.

## Açık noktalar

- **Kullanıcı görsel kabulü bekleniyor** (özellikle dikey konum %22 ve 40 px
  başlık boyu; istenirse tek CSS değeri).
- Gerçek çok oyunculu koşuda denenmedi; kareler sentetik fixture geçişlerinden.
  Canlı oyunda duyuru `room.cues` kuyruğu geldiği anda çıkar; cue kuyruğu
  ~950 ms sonra boşalsa da duyuru kendi süresini (2,6–3,2 sn) tamamlar.
- Veto **reddi** (başkan vetoyu reddedip şansölyeye geri verdiği durum) ayrı
  duyurulmuyor: sözleşmede bunu ayıran kamu sinyali yok, aşama yine
  `chancellor_choice` olarak geliyor.
- `office_moved` yalnız özel seçimde duyuruluyor; olağan başkanlık sırası her
  turda büyük pano açmasın diye sessiz.
- Üst şerit (`statusLine`) aynen duruyor; duyuru onun yerine geçmiyor, kısa
  süreli vurgu ekliyor. İkisinin metni bilinçli olarak birbirini tekrar
  edebilir (şerit kalıcı, duyuru anlık).
