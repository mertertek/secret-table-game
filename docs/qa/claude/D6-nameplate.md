# D6 — Baş üstü isim etiketi

Teslim: 2026-09-11, Claude (Opus yan ajan). **Kullanıcı görsel kabulü bekleniyor.**
İstek: "isim kartları gözüme kötü geliyor; masada yan durmaları çok bozuk."
Şartname `docs/design/D6-nameplate.md` (+ `docs/design/d6/`) birebir uygulandı;
`docs/design/**` değiştirilmedi.

## Ne değişti

### 1. Tek etiket (masa üstü plakalar kalktı)

- `packages/scene/src/objects/OfficePlacard.tsx` **silindi**;
  `packages/scene/src/objects/VoteBadge.tsx` **silindi** (oy çipi etiketin içine taşındı).
  `seats.plate` → `seats.label` (`[chair.x, .48, chair.z]`; baş tepesi ~0,43 + 0,05).
  Masa üstündeki `TargetZone [.65,.065,.25]` ve `VOTE_BADGE_Y` kalktı.
- `objects/Nameplate.tsx` yeniden yazıldı: 0,60 × 0,18 m pano (kompakt 0,60 × 0,11),
  köşe r 0,032 / 0,026, alt-merkez pivot (büyürken yukarı büyür, başa girmez),
  tam billboard, **unlit** `meshBasicMaterial` + `toneMapped={false}` +
  `depthTest/depthWrite` kapalı, `renderOrder` kamera uzaklığına göre
  (yakın etiket üste; lamba/avatar örtemez).
- Ölçek: `zoom = clamp(1, MIN_PX·perPixel / H, 2.4)`, `MIN_PX` 48 (kompakt 32).
- **Çizim bütçesi: oyuncu başına en çok 2 çizim** — pano `PrintedFace` benzeri tek
  tuval mesh'i + (varsa) oy çipi mesh'i. `TargetZone` görünmez (çizim yok).
- drei `Html` YOK: `data-scene-name` DOM düğmesi ve hover balonu kaldırıldı
  (karelerde `[data-scene-name]` sayısı **0**). Tam ad HUD oyuncu listesinde.
- Tıklama/hedefleme: etiket mesh'i pointer olaylarını alır; billboard grubunun içinde
  0,60 × 0,18 × 0,02 `TargetZone` (klavye `aimed` + `onSlotsVisible`). Avatar
  gövdesindeki mevcut `TargetZone [.42,.50,.42]` aynen duruyor.
- Yerel oyuncu koltuk kamerasında kendi etiketini görmez (`(!local || !seatMode)`);
  genel masada "SEN" pirinç rozetiyle görür.

### 2. Saf karar katmanı

Yeni `packages/scene/src/objects/nameplateState.ts` — `nameplateState(player, ctx)`
şartname §5'in birebir karşılığı: çerçeve önceliği (seçili > hedeflendi > hover >
elendi > bağlantı yok > hedef > sen > varsayılan), satır 2 kelime önceliği
(ELENDİ > BAĞLANTI YOK > SEÇİLDİ > HEDEF SEÇ > makam > HAZIR (lobi) > KOLTUK NN),
makam simgesi kelimeden bağımsız kalır, 15 karakter kırpma, çip varsa dolgu düşer.
R3F'e ve canvas ölçümüne bağlı değil. **`voteState.ts` değişmedi** (D5 gizlilik
testleri aynen geçiyor); çip yalnız `voteBadgeState` çıktısından beslenir.

### 3. Oy çipi (D5 gömülü)

Ayrı küçük unlit yüz; krem dolgu + D5 kenar rengi (`voteYes/voteNo/voteIdle`),
kelime ve tik/çarpı/halka **koyu tonlarda** (`palette.voteYesText/voteNoText/voteIdleText`,
krem üstünde ≥ 5,7:1). Giriş 240 ms (`VOTE_BADGE_ENTER_MS`, ölçek 0,6→1 easeOutCubic
+ alfa); `reducedMotion` iken anında. Sığmazsa yalnız simgeye iner
(ör. "ŞANSÖLYE ADAYI" + EVET → tik dairesi). Yerel oyuncuda ve elenende yok.

### 4. Animasyon

| Olay | Uygulanan |
| --- | --- |
| Makam değişimi | 300 ms satır 2 çapraz solma (eski 100 ms söner, yeni 200 ms belirir + 0,006 m yukarı kayar) + tek altın çerçeve nabzı |
| Oy çipi girişi | 240 ms ölçek + alfa |
| Çerçeve/hedef rengi | 120 ms renk lerp |
| Seçili dolgu | 160 ms (zemin bg→gold, metin cream→ink) |
| Eleme | 300 ms (alfa .86→.55, çerçeve→lineDead) |

Hepsi aynı tuvale yeniden boyanır (ek mesh yok); `frameloop="demand"` korunur —
yalnız geçiş sürerken kare istenir, `reducedMotion` iken hiçbir geçiş oynamaz.

### 5. Çakışma ve telefon

- `NameplateLayer` bağlamı etiketlerin ekran dikdörtgenlerini toplar. İki etiket
  **%15**'ten çok kesişirse **uzaktaki** 300 ms histerezisle kompakt varyanta iner.
  Karar hep tam boy dikdörtgenle verilir; kompaktlık kendi kararını beslemediği için
  salınım olmaz.
- Telefon (`size.width < 700` ya da `height < 500`) doğrudan kompakt: tek satır
  isim + makam simgesi + çip simgesi, min 32 css px.
- 10 kişilik masada etiket çapaları en az 1,2 m ayrık (test) ve genel masa karesinde
  hiçbir etiket kesişmiyor.

### 6. Renk tokenleri

`materials/palette.ts`: `palette.voteYesText/voteNoText/voteIdleText` + yeni `label`
sözlüğü (`bg/bgDead/line/lineLocal/lineDead/target/gold/warn/ready/cream…/ink/chipFill/
selectedBg`). `packages/contracts` **değişmedi**.

## Dosyalar

| Dosya | Değişiklik |
| --- | --- |
| `packages/scene/src/objects/Nameplate.tsx` | yeniden yazıldı (billboard, çizim, ölçek, çakışma, geçişler, `VoteChip`, `NameplateLayer`) |
| `packages/scene/src/objects/nameplateState.ts` | yeni — saf durum matrisi |
| `packages/scene/src/objects/nameplateState.test.ts` | yeni — 16 test |
| `packages/scene/src/objects/OfficePlacard.tsx`, `VoteBadge.tsx` | **silindi** |
| `packages/scene/src/objects/Surface.tsx` | `PrintedFace`e `unlit` / `depthTest` / `meshRef` |
| `packages/scene/src/objects/voteState.ts` | **değişmedi** |
| `packages/scene/src/layout/seats.ts` | `plate` → `label` |
| `packages/scene/src/TableScene.tsx` | tek `<Nameplate>` `seat.label`de; plaka/placard/rozet grupları kalktı; `NameplateLayer` |
| `packages/scene/src/prototype/FirstPersonStage.tsx` | `seat.plate` → `seat.label` |
| `packages/scene/src/materials/palette.ts` | koyu oy tonları + `label.*` |
| `packages/scene/src/layout/presentation.test.ts` | plaka testleri → etiket çapası testleri (10 kişide ≥ 1,2 m) |
| `docs/ROADMAP.md`, `docs/ASSETS.md`, `docs/DESIGN.md`, `docs/agents/CLAUDE.md` | durum ve isimlik notları |

## Görseller

`docs/qa/claude/d6/` — Chrome + Playwright, dev sunucu **5199**
(`pnpm --filter @secret-table/web dev --port 5199 --strictPort`; 5173'e dokunulmadı,
iş bitince kapatıldı), **konsol hatası yok**, her karede `[data-scene-name]` = 0.
Betik `scratchpad/d6-shots.mjs`.

| Kare | Fixture / bağlam |
| --- | --- |
| `seat-result.png` | `election-result-close`, koltuk kamerası 1440×900@2 — EVET/HAYIR çipleri, "ŞANSÖLYE ADAYI" + kısa çip |
| `seat-nomination-target.png` | `nomination`, Kaan seçili — altın dolgu + **SEÇİLDİ**, diğer hedeflerde **HEDEF SEÇ** |
| `overview-result.png` | `election-result-close`, genel masa — SEN rozeti, BAŞKAN ADAYI, 6 çip |
| `overview-10p.png` | `table-size-10`, genel masa — 10 etiket, kesişme yok, hepsi okunur |
| `phone-overview.png` | 390×844 genel masa — kompakt tek satır |
| `phone-seat.png` | 390×844 koltuk — kompakt, simge + çip simgesi |

Mockup kıyası (`docs/design/d6/mockup-{seat,overview}.png`): yerleşim, tipografi,
çerçeve/çip dili ve SEN rozeti hedef görünümle örtüşüyor. Tek fark makam
kelimesidir — montaj "ŞANSÖLYE" gösteriyor, `election-result-close` fixture'ında
Selin **şansölye adayı** olduğu için etiket doğru biçimde "ŞANSÖLYE ADAYI" yazıp
çipi simgeye indiriyor.

## Doğrulama (gerçek çıktılar)

```
pnpm -r typecheck                        # 6/6 paket, hatasız
pnpm test                                # 482 test (466 → 482)
  contracts 11 · fixtures 33 · game-core 70 · scene 147 · server 35 · web 186
pnpm --filter @secret-table/web build    # ✓ built in 3.29s
node scratchpad/d6-shots.mjs 5199        # 6 kare, "konsol hatası yok"
```

`packages/scene` testleri 131 → 147 (+16 `nameplateState`); `presentation.test.ts`
plaka iddiaları etiket çapası iddialarına dönüştü, sayı değişmedi.

## Şartnameden sapmalar

1. **Tuval boyu 1092 × 375 px** (şartname 1024 × 307). Pano yine 0,60 × 0,18 m ve
   1024 px/0,60 m yoğunluğunda; çevreye 0,02 m pay eklendi çünkü köşe kancaları
   (−0,010) ve SEN rozeti (y = −0,012) panonun DIŞINA taşıyor ve tam boy tuvalde
   kırpılıyordu. Aynı pay §8'in istediği görünmez dokunma payını da veriyor.
2. **Oy çipi yüzü sabit 0,26 × 0,06 değil, ölçülen çip genişliğinde** (aynı ppm).
   "OY VERDİ" çipi 0,264 m ölçülüyor ve sabit yüzde kırpılıyordu.
3. **Çip çıkış solması (160 ms) uygulanmadı.** Çip, `voteBadgeState` null dönünce
   React tarafından sökülüyor; kalıcı bir "çıkış" kopyası tutmak tek-kaynak kuralını
   bozardı. Giriş (240 ms) ve `VOTE_REVEAL_MS` penceresi şartnamedeki gibi.
4. **HAZIR yalnız lobide**: `lobby` bağlamı `view.phase === 'lobby'` ile geliyor
   (şartname §5 "HAZIR (lobi)"); oyun içinde `ready` bayrağı kelimeyi değiştirmiyor.
5. Hover balonu (tam ad) kaldırıldı — kullanıcı görevinin açık isteği; şartname §10
   tablosunda "hover balonu kalır" yazıyordu. Tam ad HUD oyuncu listesinde.

## Açık noktalar

- **Kullanıcı görsel kabulü bekleniyor** (özellikle etiket yüksekliği/boyu ve
  10 kişide genel masa yoğunluğu).
- Klavye `aimed` köşe kancaları karelerde yok: koltuk kamerasında pointer-lock
  gerektiriyor, başsız tarayıcıda kurulamadı. Kod yolu `nameplateState` testleriyle
  (kalın çerçeve + `brackets`) doğrulandı.
- Çakışma → kompakt geçişi 7 ve 10 kişide tetiklenmedi (kesişme yok); kural yalnız
  sentetik olarak değil, dar/yatay telefon gibi uç ölçülerde canlı denenmeli.
- Genel masada çip kelimesi ~9 px kalıyor (şartname §12 riski). Kabul edilmezse
  `MIN_PX` 56'ya çıkarılabilir.
- Gerçek çok oyunculu koşuda denenmedi; kareler sentetik fixture'lardan.
- Commit/push yok.
