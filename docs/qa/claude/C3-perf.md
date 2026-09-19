# C3 — kare başına JS'i kaldırma (ölçümlü)

Tarih: 2026-09-10. Temel: `docs/qa/claude/PERF-C1.md` §4 kararları.
Ölçüm: sistem Chrome (headless, ANGLE Metal, Apple M2), dev sunucu
`http://localhost:5173`, `/dev/game?fixture=…` (ağ/oda yok).

Ham veri: `docs/qa/claude/perf/2026-09-10-20-03-dpr2-cpu4x.json` (önce) ve
`docs/qa/claude/perf/2026-09-10-20-13-dpr2-cpu4x.json` (sonra). Aynı komut:

```
CPU_THROTTLE=4 SETTLE_MS=3000 IDLE_MS=2000 node scratchpad/perf-measure.mjs president-discard,table-size-10 2
node scratchpad/perf-profile.mjs president-discard standard
node scratchpad/perf-renders.mjs president-discard standard seat    # React render sayacı
node scratchpad/perf-shots.mjs before|after                          # görsel kanıt
node scratchpad/perf-look-check.mjs                                  # işlevsel kontrol
```

## 1. Değişen dosyalar

| Yol | Değişiklik |
| --- | --- |
| `packages/scene/src/live/lookChannel.ts` (yeni) | `LookChannel`: bakış ref'i + `invalidate` köprüsü + rAF başına tek bildirim. |
| `packages/scene/src/live/useSceneControls.ts` | `useState<Look>` kaldırıldı; `pushLook` kanala yazıyor. Dönen `look` artık kanal. |
| `packages/scene/src/prototype/SeatCamera.tsx` | `look` prop'u `LookSource` (`Look` ya da `LookChannel`); serbest koltuk bakışı `useFrame`'de kameraya yazılıyor, kip/ölçü değişimi (uçuş) hâlâ layout effect'te. Bakış artık effect bağımlılığı değil. Kare başına `new Vector3` kalktı. |
| `packages/scene/src/live/PeerHeads.tsx` (yeni) | `PeerHeads` deposu (kare damgalı, tek hesap) + Canvas içi `PeerHeadsBridge` (kare, TTL uyandırma, `invalidate`). |
| `packages/scene/src/prototype/ArticulatedAvatar.tsx` | `heads`/`playerId` verilirse örnek her karede depodan okunuyor (prop değil). |
| `packages/scene/src/TableScene.tsx` | `ViewpointAdapter.update` render'dan çıktı; `shadow-mapSize` 2048 → 1024; ölçüm için `data-scene-renders`. |
| `apps/web/src/ui/usePrefs.ts` | `autoQuality()` — kayıtlı tercih yoksa zayıf/dokunmatik cihazda `low`. |
| Testler | `packages/scene/src/live/lookChannel.test.ts` (7), `apps/web/src/ui/usePrefs.test.ts` (10). |

Sözleşme (`packages/contracts`) değişmedi; `TableScene` props'ları ve
`SceneController` davranışı aynı.

## 2. Kare hızı — CPU 4× yavaşlatma, DPR 2 (2160×1350)

Koltuk = 5 s kesintisiz sürükleme, genel = 700 ms'de bir `V` ile kamera uçuşu.

| Fixture | Kalite | Kamera | Önce FPS | Sonra FPS | Uzun görev (önce → sonra) |
| --- | --- | --- | ---: | ---: | --- |
| president-discard (7) | standard | koltuk | 31,5 | **59,8** | 26 → 0 |
| president-discard (7) | low | koltuk | 39,4 | **60,1** | 29 → 0 |
| table-size-10 (10) | standard | koltuk | 33,4 | **59,9** | 26 → 0 |
| table-size-10 (10) | low | koltuk | 40,1 | **60,1** | 28 → 0 |
| president-discard (7) | standard | genel | 28,9 | 28,3 | 23 → 24 |
| president-discard (7) | low | genel | 30,2 | 28,6 | 22 → 22 |
| table-size-10 (10) | standard | genel | 35,7 | 36,8 | 12 → 12 |
| table-size-10 (10) | low | genel | 37,8 | 38,0 | 12 → 12 |

- Kabul hedefi (CPU 4× standard koltuk ≥ 50 FPS) **karşılandı**: 59,8 / 59,9 —
  vsync tavanı. Sürüklemede kare başına JS bütçesi artık boş (uzun görev yok).
- "Genel" satırı bilerek değişmedi: o test her 700 ms'de kamera kipini
  değiştirir, yani ölçtüğü şey React render + kamera uçuşu geçişidir. Bakış
  ref'i bu yolu ilgilendirmez.
- Boşta çizim: 8 koşunun hepsinde `idleFrames = 0` (2 s pencere) — talep
  döngüsü korunuyor.

## 3. Çizim bütçesi (değişmedi, beklendiği gibi)

| Fixture | Kalite | Çağrı önce → sonra | Üçgen önce → sonra | Geometri |
| --- | --- | --- | --- | ---: |
| president-discard | standard | 223 → 223 | 86 704 → 86 704 | 144 |
| president-discard | low | 120 → 122 | 39 298 → 39 696 | 127 |
| table-size-10 | standard | 235 → 235 | 100 686 → 100 686 | 149 |
| table-size-10 | low | 120 → 120 | 43 196 → 43 196 | 132 |

Küçük low farkı el yelpazesi animasyonunun anlık durumundan; instancing bu
görevin dışında (ayrı görev). Gölge haritası 2048 → 1024 çağrı sayısını
değiştirmez, gölge geçişinin dolgu maliyetini dörtte bire indirir.

## 4. CPU profili (standard, koltuk, sürükleme, DPR 2, yavaşlatmasız)

| Pay (self) | Önce | Sonra |
| --- | ---: | ---: |
| Boşta | 52,6–52,9 % | **87,7 %** |
| React eleman üretimi (`jsxDEV`/`ReactElement`) | 14,1 % | **0 %** (listede yok) |
| R3F uzlaştırıcı (`diffProps`, `commitUpdate`…) | 12,5 % | **0,3 %** |
| Three.js render | 4,2 % | 6,7 % (artık en büyük gerçek iş) |
| `sceneFps` | 59,7 | 60,0 |

React + R3F payı %26,6 → %0,3. Kalan tepe fonksiyonlar Three'nin kendi
render yolu (`updateMatrixWorld`, `renderBufferDirect`, `projectObject`).

## 5. React render sayısı (3 s sürükleme, standard koltuk)

`data-scene-renders` sayacı (SceneSession) ile:

| | Render | Kare |
| --- | ---: | ---: |
| Önce | **674** | 177 |
| Sonra | **0** | 180 |

(Önceki sayı, aynı sayaç yamasının HEAD sürümüne uygulanmasıyla ölçüldü;
StrictMode çift render dahil.) Sürüklerken artık tek bir React render yok;
kamera `useFrame` içinde kanaldan okuyor.

## 6. Görsel kabul

`docs/qa/claude/perf/before-seat.png` ↔ `after-seat.png` ve
`before-overview.png` ↔ `after-overview.png` (7 kişi, standard, 1280×800).
Fark gözle görülmüyor; gölgeler 1024 haritayla bir tık yumuşak, sınırlar aynı
yerde. Dosya boyutları %0,3 içinde.

İşlevsel kontrol (`scratchpad/perf-look-check.mjs`):

```
sürükleme sırasında görüntü değişti: true
koltuk:          {"mode":"seat","y":"0.600","fov":"64.00"}
genel:           {"mode":"overview","y":"5.928","fov":"40.00"}
koltuk (dönüş):  {"mode":"seat","y":"0.600","fov":"64.00"}
özel inceleme:   {"mode":"seat","y":"0.560","fov":"49.00"}
```

Kamera uçuşları, özel alan incelemesi ve `onPrivateReady` gizleme mantığı
korunuyor.

## 7. Otomatik kalite kademesi

`apps/web/src/ui/usePrefs.ts` → `autoQuality()`: kayıtlı tercih yoksa
`matchMedia('(pointer: coarse)')`, `navigator.deviceMemory <= 4` veya
`navigator.hardwareConcurrency <= 4` koşullarından biri sağlanırsa `low`.
Kullanıcının menüden seçtiği değer saklanır ve her zaman üstündür; kayıtta
`quality` alanı yoksa tahmin kullanılır. 10 test (jsdom, `matchMedia`/
`navigator`/`localStorage` taklidi).

## 8. Kontroller

- `pnpm typecheck` — 6/6 paket geçti.
- `pnpm test` — **359** test geçti (contracts 11, fixtures 28, game-core 70,
  scene 90, server 35, web 125). Önceki tur 342'ydi; +17 yeni test, davranış
  testlerinde değişiklik yok.
- `pnpm build` — geçti (bkz. §9 notu).

## 9. Yapılmayanlar / notlar

- **Instancing yok**: sandalye/avatar/kart tekrarları hâlâ ayrı çizim çağrısı
  (standard ~223–235). Ayrı görev; çizim çağrısı hedefi (~120) için gerekli.
- **`RoundedBox` (madde 5) incelendi, değişiklik gerekmedi**: drei
  `RoundedBox` şekli ve parametreleri `useMemo` ile tutuyor, `args` dizisi
  R3F'te sığ karşılaştırıldığı için yeniden render geometriyi YENİDEN
  ÜRETMİYOR. Profilde görünmesinin sebebi kare başına render'dı; render
  kalkınca profilden de kalktı (`geo` sayısı sürükleme boyunca sabit: 144).
  Örnek başına geometri (mount maliyeti) instancing göreviyle birlikte
  ele alınmalı.
- Genel masa kamerası uçuşu hâlâ React render'a bağlı (kip değişimi başına);
  ölçüm senaryosu bunu 700 ms'de bir tetikliyor. Gerçek oyunda kip değişimi
  seyrek olduğu için öncelik verilmedi.
- Uzak baş örnekleri gerçek çok oyunculu oturumda (peers dolu) el ile
  denenmedi; fixture'lar `peerViewpoints: []` veriyor. Birim testleri
  (`PeerHeads`) tazelik, askıya alma ve kare başına tek hesap kurallarını
  kapsıyor; görsel davranış (4000 ms TTL, nötre dönüş) aynı adaptör kodundan
  geliyor.
- Font indirme boyutu (PERF-C1 §5) bu turda ele alınmadı.
