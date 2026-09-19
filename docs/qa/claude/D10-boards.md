# D10 — Politika tahtaları: orijinal oyuna sadık yuvalar

Teslim: 2026-09-11, Claude (Opus yan ajan). **Kullanıcı görsel kabulü bekleniyor.**
İstek: "ortadaki faşist ve liberal ana tahtalar orijinal oyundaki gibi olsun: Hitler
bölgesi yazsın, yetki/mermi işaretleri olsun."
Şartname `docs/design/D10-boards.md` + `docs/design/d10/` uygulandı; `docs/design/**`
**değiştirilmedi**, contracts **değişmedi**, yeni bağımlılık yok.

## Ne değişti

### 1. `packages/scene/src/objects/boardArt.ts` (yeni)

- `BOARD_ICONS`: 5 ikon (`investigate_loyalty`, `call_special_election`, `policy_peek`,
  `execution`, `victory`) — path dizgileri `docs/design/d10/icons.json`'dan **birebir**
  kopya (betikle doğrulandı). `drawIcon(ctx, key, x, y, size, color)` → `Path2D` +
  `ctx.fill(path, 'evenodd')`; konum/ölçek `translate` + `scale(size/100)`.
- Sola yaslı `letteringLeft()` ve ortalı `letteringMid()`: ikisi de **taban çizgisi**
  hizalı (`lettering()` ortalı + orta hizalıdır, SVG koordinatlarıyla uyuşmuyordu),
  `ctx.letterSpacing` ile harf aralığı, `save/restore` içinde.
- Çizim parçaları: `drawSlot`, `drawBand` (ikon + 1–2 satır etiket + veto rozeti),
  `drawHitlerStrip`, `drawChaosStrip`, `drawTrackerColumn`.
- **Düzen sabit yazılmadı**: `boardSlotPlans(party, variant)` yuva → ikon/etiket/veto/zafer
  planını `BOARD_LAYOUTS[variant].fascistPowers` + `vetoUnlockAt` + `liberalSlots`'tan,
  `hitlerStripSlots()` ise `hitlerChancellorWinAt`'tan türetir. Türkçe büyük harf
  etiketler sabit dizgi ("İNFAZ", "İNCELEMESİ", "SEÇİM", "ZAFERİ").
- Ölçü uzayı şartnameyle birebir: 1940 × 450 px = 1,94 × 0,45 m (1 px = 1 mm).
  Yuva ızgarası ve **kart konum satırı değişmedi** (`(.358 + i·.109 − .5)·1.94`).

### 2. `PolicyBoard.tsx`

- `draw` tuvali `ctx.scale(w/1940, h/450)` ile tasarım uzayına alır; parti bandı /
  amblem / varyant etiketi aynen korunur, üstüne Hitler şeridi → yuvalar → bantlar →
  (liberalde) kaos şeridi + sayaç sütunu gelir.
- `PrintedFace resolution` **2048** (`quality === 'low'` → 1024). `TableScene` iki tahtaya
  `quality` geçiriyor. **Çizim çağrısı artmadı**: tahta hâlâ tek `PrintedFace` + tek `Block`.
- Yuva çerçevesi y'si `h*.14 / h*.69` → `72 / 262 px` (`.16 / .582`) oldu; kart 253 mm,
  yuva 262 mm → kart taşmıyor, bant kartın altında kalıyor.

### 3. `materials/palette.ts`

Yeni `board` sözlüğü: `fascistDeep #7e332f`, `liberalDeep #2f5f78`, `paper2 #e4d6b8`,
`ghost #dccfb2`, `line #c1b49a`, `num #9b9076`, `ink #252b2c`, `ink2 #6f6b58`.
Parti renkleri değişmedi; rol/el ima eden renk veya işaret yok.

### 4. `ElectionMarker`

**Değişmedi** (şartname §4 kararı: pul ayrı nesne kalır). Anlamı liberal tahtanın sağ
sütunundaki "SEÇİM SAYACI / 0-1-2-3 KAOS / ALTIN PUL MASADA…" açıklaması taşıyor.
Şartname §4'teki "3. halkayı kırmızı yap" önerisi zorunlu değildi, uygulanmadı.

### 5. `layout/cameraFraming.ts` — inceleme kamerası (SAPMA, aşağıda)

`1.18/(tan·aspect)` → `1.03/(tan·aspect) + .12`.

## Ölçüm (karelerden, piksel taraması — `scratchpad/d10-measure.mjs`)

deviceScaleFactor 2 ile çekilen PNG'ler Chromium'da çözülüp maskelendi; değerler **css px**.
"İkon kutusu" = 64 mm × ölçek; "ikon mürekkebi" = kırmızı siluetin ölçülen bbox'ı.

| Kamera (1440×900) | tahta eni | px/mm | bant ikonu (kutu / mürekkep) | bant etiketi 15 mm | Hitler şeridi |
| --- | --- | --- | --- | --- | --- |
| Tahtayı incele | 1350 px | 0,70 yatay · 0,59 dikey | **44,5 px** / 29–36,5 px | ~8,8 px em | bant **24,8 px**, metin **14,2 px** em |
| Koltuk | 808 px | 0,42 | **26,6 px** / **18–21 px** | ~1,9 px | bant ~3 px (metin okunmaz) |
| Genel masa | 321 px | 0,165 | 10,6 px / 6,5–8,5 px | — | bant ~1 px |
| Telefon inceleme (390×844) | 369 px | 0,19 | 12,2 px / 7,5–9,5 px | — | bant ~2,5 px |

Doğrulama: ölçülen ikon merkez aralıkları incelemede 143,8–149,3 px, koltukta 84–87 px,
genel masada 34–35,5 px = tasarım adımı 211,5 mm × ilgili ölçek (±%2).

**Şartname §okunurluk ölçütleri:**
- "Koltukta ikon ≥ 18 px yatay" → **geçti** (mürekkep 18–21 px, kutu 26,6 px).
- "İncelemede şerit ≥ 12 px" → **geçti** (şerit bandı 24,8 px, metin 14,2 px em).
- §10 "incelemede ikon ≥ 36 px" → kutu 44,5 px ile geçiyor, ama *mürekkep* 29–36,5 px:
  mermi ve sandık ikonları kutunun tamamını doldurmadığı için siluet ölçüsü sınırda.
- "Koltukta şerit metni okunur" → **geçmiyor** (şerit 3 px). Şartname §8/§11 bunu zaten
  fiziksel oyunun davranışı olarak kabul ediyordu; koltuktan şerit "yuva 3'ten sonrası
  kırmızı bölge" olarak okunuyor, metin inceleme kamerasında okunuyor.

## Sapmalar (gerekçeli)

1. **İnceleme kamerası %15 değil %5–11 yaklaştı.** Şartname §8, `1.18/(tan·aspect)` yerine
   `1.0` öneriyordu ("tahta genişliğine sığdır → %15 büyür"). Ölçtüm: `1.0` ile tahtanın
   gerçek köşeleri NDC |x| = 1,03–1,09'a çıkıyor, yani **tahta yanlardan kırpılıyor** —
   öneri tahtanın 0,45 m derinliğini ve kameranın `.28·d` ileri kaymasını hesaba katmıyor
   (ön kenar merkezden ~0,12 m daha yakın). Bunun yerine kapalı biçim kullanıldı:
   `1.03/(tan·aspect) + .12`. Sonuç: tahta her en/boy oranında ekran yarı-eninin
   **%94,2'sini** kaplıyor (eskiden ~%87), uzaklık 1440×900'de 2,026 → 1,889 m (**%6,8
   yakın**), 390×380'de %8,9, 390×844'te %11 yakın. Kırpılma yok.
2. `cameraFraming.test.ts`: tahta kipinde yatay eşik .95 → .96; ayrıca yeni bir test
   tahtanın gerçek köşelerinin (±0,97 / ±0,225) %88–95 arasında kaldığını 5 en/boy
   oranında doğruluyor (hem "yaklaştı" hem "kırpılmadı" regresyon koruması).
3. Yuva ızgarası tasarımda tam mm'ye yuvarlı (601 / 211,5 / 186); kod kesirleriyle
   (.31 / .109 / .096) fark ≤ 0,52 mm. Kart konum satırı değiştirilmedi, test bu farkı
   1 mm eşikle doğruluyor.
4. `ElectionMarker` şartname §4'teki isteğe bağlı öneri uygulanmadı (görev "görsel
   değişiklik varsa uygula" diyordu; şartname bunu "zorunlu değil / ayrı iş" diye
   işaretlemiş).

## Testler ve komutlar (gerçekten çalıştırıldı)

- `pnpm -r typecheck` → **6/6 Done**.
- `pnpm test` → **495 test** (önce 482). Artış: `packages/scene` 147 → 160
  (`objects/boardArt.test.ts` 8 test + `layout/cameraFraming.test.ts` yeni 5 en/boy vakası).
- `pnpm --filter @secret-table/web build` → geçti (`built in 3.18s`).
- Kareler: `pnpm --filter @secret-table/web dev --port 5199 --strictPort` (arka plan,
  iş bitince kapatıldı; 5173'e dokunulmadı) + `node scratchpad/d10-shots.mjs 5199`.
  **Konsol hatası yok.** Ölçüm: `node scratchpad/d10-measure.mjs`.

## Kareler (`docs/qa/claude/d10/`)

| Dosya | Ne gösteriyor |
| --- | --- |
| `inspect-board-medium.png` | 7–8 düzeni, 4 faşist + 2 liberal kart konmuş; bantlar kartların altında tam görünür |
| `inspect-board-small.png` | 5–6 düzeni: DESTE TEPESİ · İNFAZ · İNFAZ+VETO · ZAFER, 1–2 boş |
| `inspect-board-large.png` | 9–10 düzeni: SADAKAT İNCELEMESİ ×2 · ÖZEL SEÇİM · İNFAZ ×2 · ZAFER |
| `seat-board.png` | Koltuk kamerası: şeritler ve ikonlar siluet olarak seçiliyor, metin okunmuyor |
| `overview-board.png` | Genel masa: parti bantları + kırmızı Hitler bölgesi ayırt ediliyor |
| `phone-inspect.png` | 390×844 inceleme: iki tahta da kadrajda, şerit metni sınırda okunur |

Ek kontrol (kareler dosyaya alınmadı): `quality: 'low'` (doku 1024) incelemede bant
etiketleri hâlâ okunur, konsol hatası yok.

## Açık noktalar

- **Kullanıcı görsel kabulü** — özellikle koltuk kamerasından "Hitler bölgesi yazsın"
  beklentisi metin okunacak şekildeyse, tek çözüm inceleme kamerasına yönlendirme veya
  şerit metnini kısaltmak (ör. "HİTLER BÖLGESİ"); kadraj artık sınırda, daha fazla
  yaklaşmak tahtayı kırpar.
- FPS/GPU ölçümü yapılmadı: doku 1024 → 2048 (tahta başına ~3,9 MB GPU) yalnız iki nesnede;
  çizim çağrısı sayısı değişmedi ama `C3-perf` ile karşılaştırmalı ölçüm açık.
- Mermi (`execution`) ikonunun mağaza/hassasiyet değerlendirmesi kullanıcıda; şartname
  alternatif (hedef halkası) bırakmış.
- Commit/push yapılmadı.
