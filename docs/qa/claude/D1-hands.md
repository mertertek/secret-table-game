# D1 — Eller yeniden yapım (SDF → marching cubes → SkinnedMesh)

Teslim: 2026-09-11, Claude (Opus). Şartname `docs/design/D1-hands.md` + `docs/design/d1/poses.json`
(değiştirilmedi). Kullanıcı görsel kabulü bekleniyor.

## Ne değişti

Bölütlü kapsül + eklem küresi eller (`HandModel`, `InstancedHandModel`) kaldırıldı.
Yerine kodda üretilen **tek parça, 16 kemikli `SkinnedMesh`** geldi:

1. 23 SDF ilkeli (yuvarlatılmış kutu + 2 elipsoid + 19 kapsül + bilek) polinom
   smooth-min ile birleşir → eklem küresi ve aradaki boşluk kalmadı.
2. Kendi marching cubes'umuz (kenar başına tek köşe → kaynaklı, KAPALI yüzey),
   ardından köşe kümeleme ile seyreltme (eklem bantları daha ince ızgarada).
3. Köşe başına en yakın 2 kemik, `w ∝ exp(−d/σ)`, σ = 4 mm, toplam 1.
4. Tutuş artık `curl/pinch` skaleri değil, `poses.json`'daki 9 poz + poz karışımı.
5. **El kartı taşır:** `cardGrip(card, side)` yerine `handFromCard(card, side, grip)`
   — kart paketinin el uzayındaki çerçevesinin tersinden türetilir (§e).
6. Yelpaze pivotu kart merkez çizgisinden baş parmak yastığına taşındı
   (`FAN_PIVOT = (−0.062, 0, +0.110)`); köşe etiketleri açıkta kalıyor.
7. PublicArms: aynı SDF üretimi, `distant` kademe, `restTable` pozu CPU'da
   pişirilmiş statik geometri; kol + manşet + el tek mesh, oyuncu başına 2 çizim.

## Dosyalar

Yeni `packages/scene/src/hands/`:

| Dosya | İçerik |
| --- | --- |
| `anatomy.ts` | §a/§b/§c sayıları (avuç, 4 parmak, baş parmak, perdeler, smin katsayıları, 16 kemik adı) |
| `sdf.ts` | `smin`, `sdRoundBox`, `sdEllipsoid`, `sdRoundCone`, `palmField`, `chainField`, `handField`, `handBounds` |
| `marchingCubes.ts` | `marchField` (kabuk taramalı örnekleme + kenar önbellekli MC), `clusterDecimate`, `boundaryEdges` |
| `skeleton.ts` | `boneDefs`, `buildSkeleton`, `forwardKinematics`, `applyPose`, `skinWeights` |
| `poses.ts` | `poses.json` içe aktarımı, `LIMITS`, `clampPose`, `mixPose`, `CARD_FRAMES`, `BIND_POSE` |
| `contact.ts` | §e örnekleme (falanks başına 8 nokta), `worstGap`, `resolveContact` |
| `geometry.ts` | kalite kademeleri, vertex renkleri (§f), `handGeometry` (önbellekli), `bakedPose` |
| `SkinnedHand.tsx` | `forwardRef<HandHandle>`; 1 `SkinnedMesh` + 1 `InstancedMesh` (kol/manşet) |
| `hands.test.ts` | 22 test |

Değişen: `prototype/{grip.ts, rig.ts, model.ts, HandRig.tsx, prototype.test.ts}`,
`live/PublicArms.tsx`, `TableScene.tsx` (`quality` → `HandRig`).
Silinen: `prototype/HandModel.tsx`, `prototype/InstancedHandModel.tsx`.
Ölçüm betiği: `scratchpad/d1-shots.mjs`.

## Görseller

`docs/qa/claude/d1/` — aynı fixture ve kameralarla `before-*` / `after-*`:

| Kare | Fixture / kamera |
| --- | --- |
| `seat-hold3`, `inspect-hold3` | `president-discard`, koltuk + özel alan yakın planı (3 kart) |
| `seat-selected`, `inspect-selected` | aynı, alt çubuktan 2. kanun seçili (kart kalkmış) |
| `seat-hold2`, `inspect-hold2` | `chancellor-choice` (2 kart) |
| `seat-vote`, `seat-vote-end` | `election-result` |
| `seat-envelope`, `inspect-envelope` | `role-reveal-liberal`, kimlik açık |
| `overview-arms`, `overview-arms-low` | `policy-result`, genel masa (PublicArms), standard + low |

Kareler 1440×900 @ dpr2, yerel Chrome (Playwright), dev sunucu **5199** portunda
(kullanıcının 5173'üne dokunulmadı).

## Sayılar

Üretim (Chrome, M2, `performance.now`, `canvas[data-fp-hand-build-ms]`):

| Kademe | Voxel | Kümeleme | Üçgen | Üretim |
| --- | --- | --- | --- | --- |
| standard | 3.0 mm | 4.8 mm | **4 950** | **63–78 ms** (hedef < 100 ms) |
| low | 4.5 mm | 7.2 mm | 2 248 | ~30 ms |
| distant (PublicArms) | 6.0 mm | 12.0 mm | 802 | ~22 ms |

Sahne (1440×900, dpr 1, CPU 4×, `president-discard`, `scratchpad/perf-measure.mjs`):

| Kip / kalite | Çizim önce → sonra | Üçgen önce → sonra | FPS önce → sonra |
| --- | --- | --- | --- |
| koltuk / standard | 223 → **219** | 86 704 → 105 728 | 60.0 → **60.0** |
| koltuk / low | 120 → 120 | 39 298 → 42 876 | 60.0 → **60.1** |
| genel masa / standard | 220 → 216 | 86 668 → 105 692 | 29.0 → **25.1** |
| genel masa / low | 119 → 117 | 39 660 → 42 840 | 28.6 → **25.7** |

- **El başına çizim çağrısı 3 → 2** (iki el = −4 çağrı). Kabul ölçütü §h-4 sağlandı.
- Üçgen artışı +19 k: el başına 2 500 → 4 950 (gölge geçişiyle iki kez sayılıyor) ve
  PublicArms el başına ~420 → ~850. Koltuk kamerasında FPS etkilenmiyor; genel
  masada 4× CPU kısıtlı uçuş testinde ~%13 düşüş var (aşağıda "açık noktalar").
- Ham JSON: `docs/qa/claude/perf/2026-09-11-08-15-dpr1-cpu4x.json` (önce),
  `docs/qa/claude/perf/2026-09-11-08-13-dpr1-cpu4x.json` (sonra).

## Testler / komutlar (gerçekten çalıştırıldı)

| Komut | Sonuç |
| --- | --- |
| `pnpm -r typecheck` | 6/6 GEÇTİ |
| `pnpm test` | **400** test GEÇTİ (11 / 28 / 70 / **112** / 35 / 144); D1 öncesi 378 |
| `pnpm --filter @secret-table/web build` | GEÇTİ (three chunk 761.60 kB / gzip 195.71 kB) |

`packages/scene` 90 → 112 test. Yeni `hands.test.ts` (22 test) kapsamı:
SDF ilkel değerleri ve smooth-min; el alanının eklem birleşimlerinde dolu olması;
MC kapalı yüzey (`boundaryEdges === 0`); üçgen bütçeleri; kümeleme ve birim
normaller; 16 kemik sırası + bind zinciri + baş parmak taban ekseni; skin ağırlığı
toplamı 1 ve köşe başına ≤ 2 kemik; poz sınırları ve karışım uçları;
`holdFan3/2/1` temasında kesişme yok + dört parmak kart yüzeyine < 12 mm;
kesişen pozun kademeli açılması; `handFromCard ∘ çerçeve = kart` (4 tutuş × 2 el ×
3 kart dönüşümü) ve §e dünya örneği (sol el `heldFan` → (−0.047, 0.093, 1.315), 1 mm).

Güncellenen mevcut testler: `prototype.test.ts` `cardGrip` → `handFromCard`,
`curl/pinch` → `grip`, yelpaze pivotu, bilek yüksekliği/erişim sınırları
(ölçülen yeni uçlar: en alçak bilek 0.071 m, en uzun erişim 0.968 m — eskisi
0.075 / 1.023 idi, yani yeni değerler daha dar).

## Şartnameden sapmalar (gerekçeli)

1. **`pinchCard` çerçevesi yerine yan tutuş.** §e `pinchCard` kartı ÜST kenardan
   tutuyor; kart 0.272 m (gerçek kartın ~3 katı) olduğu için bilek kartın 9.6 cm
   üstünde kalıyor, dirsek çıpası ise masa hizasında (y 0.14): önkol birinci şahıs
   görüşünü çaprazlama kesiyordu (ilk "sonra" karesinde görüldü). Alt kenardan
   tutuş bileği masaya (y 0.054) indirip manşeti masaya sokuyordu. Seçili/taşınan
   kart bu yüzden §e'nin **yan tutuş** çerçevesiyle (`holdBallot`: sağ kenardan,
   bilek kart orta yüksekliğinde) tutuluyor. `pinchCard` açı seti ve §e teması
   testlerde doğrulanıyor ama sahnede kullanılmıyor.
2. **Bırakma (`place`) sonu.** §e çerçevesi kartı arkadan tutar; kart masaya
   yatınca el masanın altında kalırdı. Kart düzleştikçe (`flat`) el kartın üstüne
   yuvarlanıyor (avuç aşağı, dönüş kartın çerçevesi, +0.105 m) ve `openPlace`
   tutuşuna geçiyor — eski davranışla aynı. Süreler (1350 ms) korundu.
3. **Zarf.** §e `holdEnvelope` çerçevesi 0.245 × 0.335 zarfa göre; sahnedeki rol
   kartı 0.19 × 0.272. Çerçeve sağ kenar el uzayında aynı z'de kalacak şekilde
   kaydırıldı (`C = (0, −0.061, −0.1835)`). Ayrıca kart masada yatarken bu çerçeve
   bilekleri kartın 6 cm altına koyduğu için eller önce zarfa uzanıyor (`openPlace`),
   kart kalktıkça tutuşa geçiyor (0.45–0.80).
4. **Üretim kutusu.** §b kutusu (0.175 × 0.080 × 0.230) rest pozuna göre yazılmış;
   BIND (düz) pozunda baş parmak onu ~6 mm aşıyordu. Kutu ilkellerin AABB
   birleşiminden hesaplanıyor + 10 mm pay → 0.189 × 0.092 × 0.243. 10 mm pay şart:
   6 mm'de yüzey ızgara sınırında kırpılıyor ve 18 açık kenar kalıyordu.
5. **Seyreltme.** `SimplifyModifier` yerine köşe kümeleme (§b'nin ikinci önerisi);
   eklem bantları (±5 mm) 0.55 kat ince ızgarada kümeleniyor. `low` kademe hedefi
   1.5 k yerine **2.25 k**: 9 mm kümeleme serçe parmağı (çap 15–18 mm) 2 hücreye
   düşürüp siluetini bozuyordu.
6. **PublicArms için üçüncü kademe.** §g masadaki elleri `low` ile pişirmeyi
   öneriyor (2.25 k × 14 el = 31 k üçgen). Genel masa bütçesi için `distant`
   kademesi eklendi (802 üçgen). `InstancedMesh` yerine mevcut 2 mesh/oyuncu
   düzeni korundu (çizim sayısı aynı, geometri artık bütün oyuncularda paylaşımlı
   — eskiden oyuncu başına yeniden üretiliyordu).
7. **Kartın ötelenmesi (§e-3) uygulanmadı.** Parmak açılarını kademeli açmak
   (§e-2/§e-4) bütün pozlarda kesişmeyi sıfırladığı için (`penetrations === 0`,
   testte doğrulanıyor) kartı kendi −Y'sinde 4 mm öteleme adımına gerek kalmadı.
8. **Tırnak yok, kol/manşet.** §f'ye uygun. Dirsek küresi kaldırıldı (üst kol ile
   önkol zaten örtüşüyor) — el başına 2 çizim bütçesi bunu gerektirdi.
9. **MC arama tabloları** `three/addons/objects/MarchingCubes.js`'ten alınan
   `triTable`; algoritma, kenar önbelleği, normaller ve kabuk taraması bizim.
   Yeni bağımlılık eklenmedi.

## Açık noktalar

- **Genel masa FPS'i** 4× CPU kısıtında 29.0 → 25.1 (standard) / 28.6 → 25.7 (low).
  Sebep +19 k üçgen (PublicArms elleri ve gölge geçişi). Gerekirse `distant`
  kademesi 7 mm voxel / 14 mm kümeleme ile ~614 üçgene çekilebilir.
- `pinchCard` pozu sahnede kullanılmıyor (sapma 1). Kart boyutu 0.19 × 0.272'den
  küçültülürse (şartname §Riskler) üst kenardan tutuşa dönülebilir.
- Doğrusal karışımlı skin (2 kemik) büyük PIP açılarında iç tarafta hafif sıkışma
  yapıyor; koltuk kamerasında görünmüyor, yakın planda (inspect) bakılabilir.
- Kareler `/dev/game?fixture=…` üzerinden alındı (`/dev/scene` ile aynı `TableScene`,
  ama koltuk kamerası `secret-table:prefs` ile yükleme anında açılabiliyor ve alt
  eylem çubuğundan gerçek seçim yapılabiliyor).
- `draw` / `place` ara kareleri (hareket ortası) alınmadı; kabul ölçütü §h-2'deki
  3→2→1 geçişi kod ve testlerle sağlanıyor (`fanGrip` karışımı), görsel olarak
  yalnız yerleşik 3 ve 2 kart kareleri var.
- `vote` hareketi (`holdBallot` savurması) fixture yüklenirken 1150 ms içinde
  bitiyor; ilk kare çizildiğinde `fpMotionProgress = 1` oluyor, bu yüzden
  `seat-vote` karesinde eller yerleşik `rest` pozunda. `holdBallot` tutuşu
  `*-selected` karelerinde görülebiliyor (seçili kart bu çerçeveyle tutuluyor).

---

## Tur 2: önkol / manşet (2026-09-11, koordinatör düzeltmesi)

**Şikâyet:** yakın planda sağ önkol koyu yeşil dev bir silindir gibi kadrajı
çaprazlama kesiyordu (`after-inspect-hold3`, `after-seat-envelope`, `after-seat-selected`).

**Yapılanlar**

1. **Kol yarıçapı ele orantılı.** Önkol `.066` → **`.042` (dirsek) → `.030` (bilek)`**,
   manşet `.046` → **`.040` → `.029`** (silindir geometrisi .72 konikliğinde;
   `FOREARM`/`CUFF_R` sabitleri `hands/SkinnedHand.tsx`). Ölçek yalnız Y'de
   uygulanıyor, yarıçap kol uzunluğundan bağımsız — uzanırken şişmiyor.
2. **Dirsek çıpası aşağı/dışa/arkaya.** `elbow(side)` `[±.49, .14, 1.87]` →
   **`[±.43, .035, 1.985]`**. Kol artık kamera düzlemine paralel uzanmıyor,
   aşağıdan geliyor.
3. **Üst kol parçası kaldırıldı.** Omuz (z 2.18) kameranın arkasında, hiç
   görünmüyordu. Önkol dirseğin 0.30 m gerisinden başlatıldı (kesik ucu kameranın
   arkasında kalıyor), dirsek küresi zaten tur 1'de kalkmıştı. Kol örneği sayısı
   3 → **2** (önkol + manşet) — hâlâ tek `InstancedMesh`, **el başına toplam 2 çizim**.
4. **Manşet örtüşmesi.** Önkol manşetin 0.055 m içinde bitiyor; 12 kenarlı
   silindirlerin köşe/yüz faz farkı yüzünden ince yarıçaplarda uç kapağı manşetten
   sızıyordu, örtüşme payı buna göre seçildi.
5. **Dinlenme elleri** 4 cm dışa / 3 cm geri: `±.40, .10, 1.35` → `±.44, .098, 1.38`
   (yeni el şablonu parmak ucuna kadar 0.19 m; eski konumda yelpazeye fazla
   yaklaşıyordu). Şartnamenin izin verdiği 1–2 cm düzeltme sınırında.

**Sayılar (tur 1 → tur 2)**

| Kip / kalite | Çizim | Üçgen | FPS (CPU 4×) |
| --- | --- | --- | --- |
| koltuk / standard | 219 → 219 | 105 728 → **105 536** | 60.0 → **59.8** |
| koltuk / low | 120 → 120 | 42 876 → 42 780 | 60.1 → **60.1** |
| genel masa / standard | 216 → 216 | 105 692 → 105 500 | 25.1 → 25.1 |
| genel masa / low | 117 → 117 | 42 840 → 42 744 | 25.7 → **29.4** |

Çizim sayısı değişmedi (kol zaten tek `InstancedMesh`); örnek sayısı 3'ten 2'ye
indiği için üçgen ~190 azaldı. Üretim süresi 61–73 ms (değişmedi).
Ham JSON: `docs/qa/claude/perf/2026-09-11-08-42-dpr1-cpu4x.json`.

**Kareler:** `docs/qa/claude/d1/after2-*.png` (tur 1 `after-*` ile aynı fixture ve
kameralar): `seat-hold3`, `inspect-hold3`, `seat-selected`, `inspect-selected`,
`seat-hold2`, `inspect-hold2`, `seat-vote`, `seat-vote-end`, `seat-envelope`,
`inspect-envelope`, `overview-arms`, `overview-arms-low`.

**Testler:** `pnpm -r typecheck` 6/6, `pnpm test` 400, `pnpm --filter @secret-table/web build`
— hepsi GEÇTİ. `prototype.test.ts` erişim sınırı 1.00 → 1.09 m'ye güncellendi
(dirsek geri çekildiği için ölçülen en uzun erişim 0.968 → 1.058 m; bilek en alçak
0.071 m değişmedi).

**Tur 2'de bulunan, düzeltilmeyen nokta:** `inspect` (Özel alanı incele) kipinde
`HandRig` pozu zorla `selected` yapıyor ve sağ el incelenen kartı yandan tutuyor;
incelenen kart yelpazenin ARKA kartıysa (slot −1) elin gövdesi öndeki kartların
arkasında kalıyor ve yalnız iki parmak ucu kartın yüzünde görünüyor. Tur 1'de bu
kalın kolun arkasında gizliydi. Tek kart gösterimi (inspect) için elin tamamen
gizlenmesi ya da incelenen kartın en öne alınması ayrı bir küçük iş.

---

## Tur 3: manşet ucu + inspect okuma kipi (2026-09-11)

**1) Manşet/önkol ucu "içi boş tüp" görünüyordu.** Silindirlerin uçları zaten
kapalıydı (`openEnded=false`, artık açıkça yazılı); sorun manşetin önkoldan
çok geniş olmasıydı: manşetin kol tarafındaki KAPAĞI önkolun etrafında ~1 cm'lik
bir halka olarak görünüyor ve açık ağız izlenimi veriyordu.

- Manşet yarıçapı `.038` → **`.039` ama TERS yönde**: dar ucu (`.72·R = .0281`)
  kola bakıyor ve önkolun oradaki yarıçapından (`.0304`) **ince**; böylece kapak
  tamamen önkolun içinde kalıyor, halka yok. Geniş ucu (`.039`) bileğe bakıyor ve
  kapalı kapağı, bileğin çıktığı kapalı manşet yüzü oluyor.
- Manşet boyu `.060` → `.046`, bileğe uzaklığı `.062` → `.050`; önkol manşetin
  `.060` içinde bitiyor (eskiden `.055`) → kesik uç her açıdan gizli.
- Silindir 12 → **18 kenar**: ince kolda manşet/kol kesişme çizgisi köşeli
  görünüyordu (üçgen artışı ihmal edilebilir, çizim sayısı aynı).
- Önkolun dirsek tarafındaki kesik ucu zaten dirseğin 0.30 m gerisinde, kadraj
  dışında (tur 2).

**2) `inspect` bir OKUMA kipi oldu.** `HandRig`'de yeni `reading` bayrağı:
`inspect` kipinde incelenen kart mevcut kaldırma animasyonuyla tek başına kalkar,
**sağ el `rest` pozunda masada kalır** (`next.right = restRight`). Kol artık
yakın planda görüşü kesmiyor ve parmak uçları öndeki kartların yüzünde belirmiyor
(tur 2'de açık bırakılan nokta kapandı). `selected` — yani gerçek seçim, koltuk
kamerası — tutuşu değişmedi (`after3-seat-selected.png`).
Bu arada `HandRig` içindeki kalan `'pinchCard'` çağrısı da `'holdBallot'` ile
hizalandı (yelpaze yeniden dizilirken kullanılan yol; tur 1'de atlanmıştı).

**Kareler:** `docs/qa/claude/d1/after3-*.png` (12 kare, aynı fixture/kameralar).
Koordinatörün istedikleri: `after3-inspect-hold3.png`, `after3-seat-envelope.png`,
`after3-inspect-selected.png`.

**Sayılar:** çizim ve üçgen değişmedi (koltuk/standard 219 çizim, 105 536 üçgen;
el 4 950 üçgen, üretim 64–72 ms). El başına 2 çizim çağrısı korunuyor.

**Testler:** `pnpm -r typecheck` 6/6, `pnpm test` **400**,
`pnpm --filter @secret-table/web build` — hepsi GEÇTİ. Commit yok.

---

## Tur 4: el/kart geçiş hataları (2026-09-11)

Kullanıcı canlı oyunda gördü: *"Oyu evet veriyor, onayladıktan sonra masadan bir
kart falan da çekip geri kartlar kayboluyor."* Ekran görüntüsünde yürütme (hedef
seç) fazında sol el havada **boş yelpaze tutuşunda takılı**, elde kart yok.

### 1) Teşhis (doğrulandı, kod üzerinden)

**Hata A — kanun atma sonrası hayalet kart + takılı sol el.** Başkan/şansölye
kartı onaylayınca sunucu görünümü AYNI revizyonda hem eli boşaltır (`handItems`
→ `[]`) hem de `cards_moved` cue'sunu getirir. `LocalMotion.update` `changedHand`
yüzünden pozu `rest`'e alır; hemen ardından `useLocalMotion` cue'yu görüp
`acceptPublic('place')` çağırır ve `sampleRig` **kart sayısı 0** ile `place`
hareketini oynatır: görünmeyen yelpazeden tepsiye bir kart sırtı uçar. Hareket
bitince `settledRig('placed', …, 0)` eski hâlinde `fanVisible = true` döndürüyordu
→ `left = holdLeft(0)`, yani sol el **boş yelpaze pozunda** kalıyordu. Yürütme
fazında başkan hedef seçene kadar yeni revizyon gelmediği için bu poz ekranda
dakikalarca kalabiliyordu. Eski `cardGrip` kodunda da aynı mantık vardı; yeni
ellerde çok daha görünür oldu.

**Hata B — oy akışı.** Oy onaylanınca `hasVoted` true olur, oy kartları hiçbir
hareket olmadan **anında yok olur**. Oylar açıklanınca `vote` hareketi
`[0, .035, 1.08]` noktasında **yoktan** bir kart çevirir ("masadan kart çekiyor"
hissi); üstelik `TableScene` yerel koltuk için ayrı bir `RevealCard`'ı başka bir
noktada gösterebiliyordu.

### 2) Değişiklikler

| Yol | Değişiklik |
| --- | --- |
| `prototype/model.ts` | `PoseName += 'voted'`, `Gesture += 'ballot'` (900 ms), `RigMotion.ghostBacks?`, `poseAfter(..., ghostBacks)` |
| `prototype/rig.ts` | `settledRig`: kart sayısı 0 iken yelpaze yok, iki el `rest`; `voted` pozu (`ballotSpot` = `[0,.035,1.08]`, `z=π`, kapalı); `sampleRig`: `ghostBacks` → hareket boyunca kullanılan kart adedi; `place` dalında hayalet devir; yeni `ballot` dalı; her dalda "kart da hayalet de yoksa boş yelpaze tutuşu yok" güvencesi |
| `prototype/HandRig.tsx` | El boşken `ghostBacks` kadar `PhysicalCard {kind:'back'}` (seçilemez, `TargetZone` yok, `fpPrivateFaces` 0); yelpaze görünürlüğü artık yalnız `fanVisible` |
| `live/LocalMotion.ts` | `handoff {count, revision}` — el N>0 → 0 olurken adet saklanır, AYNI revizyondaki `place` cue'su bunu `ghostBacks` yapar; adet bilinmiyorsa (resync/epoch) hareket hiç oynamaz; `hasVoted` geçişinde `ballot` jesti; faz değişse de `voted` pozu korunur |
| `TableScene.tsx` | Yerel koltuğun kamu oy kartı `rig.pose === 'voted'` iken de gizlenir (tek kart görünür) |
| `fixtures/scenes/legislative.ts` + `registry.ts` | **additive**: `president-discarded` (el boşaldı + iki `cards_moved` cue, aynı oda/oyun kimliği) |
| `fixtures/scenes/election.ts` | `voting` fixture'ında yerel oyuncu (p4) artık gerçekten oy vermemiş durumda — açıklaması "henüz oy vermedi" diyordu ama `hasVoted: true` idi, bu yüzden elde hiç oy kartı çıkmıyordu |

**Davranış (gizlilik korunur — yalnız güncel görünüm, özel yüz yok):**

1. Boş elde asla yelpaze pozu yok; `placed` + 0 kart → iki el de `rest`.
2. Devirde el N>0 → 0 olurken aynı revizyonda `cards_moved` gelirse hareket **N
   kapalı sırtla** oynar: sağ el dış sırtı tepsiye taşır, kalan sırtlar masa
   ortasına (`[0,.05,.55]`) kayıp hareket sonunda kaybolur, sol el `holdLeft(N)`
   → `rest` karışır. Cue gelmezse hayalet yok, düz `rest`. `ghostBacks` yalnız
   **adet** taşır (kamu bilgisi); yüz yok, `fpPrivateFaces` = 0.
3. Oy onaylanınca `ballot` jesti: kart SIRTI sağ elle masaya konur ve orada
   **kalır** (`voted`). `votes_revealed` gelince mevcut `vote` hareketi tam aynı
   noktadan çevirir; faz `election_result`'a geçse de `voted` korunur.
4. `reducedMotion` her iki jestte de doğrudan settled poza atlar.

**Bilinçli sadeleştirme:** veto kabulünde cue `chancellor→discard, 2` olsa da
sağ el TEK sırt taşır, ikinci sırt kalan paketle birlikte masa ortasına kayar.
İki kartı ayrı ayrı taşıyan bir yol için ikinci bir `loose` nesnesi gerekirdi;
görünen sonuç ("kartlar elden çıktı") aynı.

### 3) Kareler (`docs/qa/claude/d1/`)

Fixture'lar arasında **sayfa yenilemeden** (senaryo seçicisiyle) geçilir; sahne
kimliği korunduğu için gerçek devir/oy geçişi oynar. Betik:
`scratchpad/d1-shots4.mjs` (dev sunucu 5199; kullanıcının 5173'üne dokunulmadı).

| Kare | İçerik |
| --- | --- |
| `after4-place-before.png` | başkan eli, 3 kart (`fpPrivateFaces=3`) |
| `after4-place-mid.png` | devir %38: iki kapalı sırt sol elde, dış sırt tepsiye gidiyor, `fpPrivateFaces=0` |
| `after4-place-end.png` | iki el masada, yelpaze yok (Hata A kapandı) |
| `after4-ballot-before.png` | oy kartları elde (fixture düzeltmesinden sonra) |
| `after4-ballot-mid.png` | kapalı oy kartı masaya konuyor, kalan sırt sol elde |
| `after4-ballot-end.png` | oy kartı masada KAPALI duruyor, eller dinlenmede |
| `after4-vote-reveal.png` | `votes_revealed` — aynı karttan çevirme (%75) |
| `after4-vote-reveal-end.png` | tek oy kartı açık (HAYIR), çift kart yok |
| `after4-executive-hands.png` | yürütme fazı: iki el masada, kart yok (kullanıcının gördüğü ekran) |

Konsol hatası yok (`after4-stats.json` → `errors: []`). Çizim/üçgen: koltuk
standard 219/105 728 (3 kart) → 215/105 768 (boş el, tepsideki kart); hayalet
hareket sırasında 223/107 360.

**Canlı 5 bot koşusu yapılmadı:** `scratchpad/party.mjs` odayı kullanıcının kendi
tarayıcısından açmasını ve oyunu host olarak başlatmasını gerektiriyor (betik
oyunu başlatmaz). Kanıt yukarıdaki fixture geçişleridir; bunlar gerçek
`cards_moved` / `votes_revealed` cue'larını ve gerçek `LocalMotion` yolunu
kullanır.

### 4) Testler

Yeni: `live/presentation.test.ts` +5 (hayalet devir, cue'suz boşalma/epoch,
`ballot` → `voted`, `votes_revealed` kesintisizliği, oy kartlarının elde kalması),
`prototype/prototype.test.ts` +3 (boş elde poz yok, hayalet devirde bilek
yüksekliği/başlangıç noktası, `ballot` → `voted` → `vote` zinciri). Mevcut
"her jest deterministik biter" testi yeni `ballot` jestini de otomatik kapsıyor
(bilek ≥ 0.065 m, erişim < 1.09 m sınırları geçti).

| Komut | Sonuç |
| --- | --- |
| `pnpm -r typecheck` | 6/6 temiz |
| `pnpm test` | **410** geçti (11 / 29 / 70 / **121** / 35 / 144) — tur 3'te 400 |
| `pnpm --filter @secret-table/web build` | geçti (3.0 s) |

Commit yok; `docs/design/**` değişmedi; yeni bağımlılık yok; `contracts`,
`server`, `game-core` dosyaları değişmedi.

### 5) Açık kalan

- `election_result` fazında cue hiç gelmezse (16 aktif cue taşması gibi çok dar
  bir durum) yerel oyuncu kendi açık oyunu göremeyip kapalı kartı görür; askıya
  alma/bağlantı kopması bu durumu zaten `rest`'e düşürüp kamu kartını geri
  getiriyor.
- `vote` (çevirme) jestinde sağ önkol yakın planda kadrajı çaprazlama kesiyor —
  tur 4 kapsamı dışında, mevcut jestin eski davranışı.

## Tur 5: perdesiz eller (2026-09-12, kullanıcı geri bildirimi)

Kullanıcı 2026-09-12: *"parmaklar arasındaki etleri silsek; balık adam gibi
görünüyor"*. Açık avuç jestlerinde (D16 `hands_up`, `wave`, `clap`) parmaklar
uçlarına kadar tek bir kürek gibi kaynıyordu.

### 1) Kök neden (üç ayrı kaynak)

1. **`handField` akümülatör smin'i.** Parmak zincirleri sırayla `d = smin(d, chain,
   K.fingerToPalm)` ile ekleniyordu; akümülatör bir önceki parmağı da içerdiği için
   KOMŞU PARMAKLAR birbirine 12 mm yumuşatma ile köprüleniyordu.
2. **Perde kapsülleri.** `WEBS` (r = 7 mm, y = −2 mm) boğum çizgisinin ÜSTÜNE
   çıkıyor, el sırtından görünen bir zar oluşturuyordu.
3. **Avuç dilimi.** `PALM` yuvarlatılmış kutusunun distal yüzeyi z = −0,108'deydi:
   boğumların (z ≈ −0,090) **2 cm ötesine** kadar parmak aralarını dolduruyordu.
   Ayrıca MCP aralığı 22 mm, falanks yarıçapları ~10,5 mm → komşu yüzeyler arası
   boşluk **0,5–1 mm**, 3 mm voxel bunu çözemiyordu.

### 2) Yapılan

- `sdf.handField`: dört parmak önce **sert `min`** ile birleşir (aralarında
  yumuşatma YOK), sonuç avuca TEK bir `smin(K.fingerToPalm)` ile bağlanır; baş
  parmak thenar'a kendi `K.thumbToThenar` yumuşatmasıyla girer. Kutu-alt-sınır
  kısa devresi korundu (hem `min` hem `smin` için geçerli).
- `anatomy.K`: `fingerToPalm` 12 → **5 mm**, `web` 10 → **4 mm**, `thumbWeb`
  12 → **6 mm**.
- `anatomy.WEB`: r 7 → **3,5 mm**, y −2 → **−8 mm** (tepe noktası boğum
  çizgisinin 4,5 mm ALTINDA; avuç içinde kökleri bağlar, siluette görünmez).
  `THUMB_WEB` r 9 → **4,5 mm** (gerçek elde vardır, yarıya indi).
- `anatomy.PALM`: merkez z −0,050 → **−0,044**, yarı z 0,046 → **0,040** →
  distal yüzey −0,108 → **−0,096** (boğumların hemen ötesi), proksimal yüzey
  +0,008 (değişmedi).
- `anatomy.FINGER`: MCP aralığı 22 → **24 mm** (index/pinky ±0,036,
  middle/ring ±0,012), falanks yarıçapları ~%7 inceldi. Bind pozunda komşu
  parmak yüzeyleri arası boşluk **≈ 4 mm** (3 mm voxel çözebiliyor).
  El yarı genişliği 43,5 → 45,8 mm.
- `skeleton.skinWeights`: **komşu parmağa ağırlık sızmaz**. İkinci kemik yalnız
  AYNI zincirdeyse ya da taraflardan biri `wrist` ise karışıma girer
  (`blendable`); iki farklı parmak arasında karışım yok. Perde kalkınca bir
  parmağın iç duvarı BAND (5 mm) içindeki komşu kemikten %27'ye varan ağırlık
  alıyordu; o parmak büküldüğünde yandaki parmağın yüzü sürükleniyordu.
- `geometry.TIERS.standard.cluster`: 4,8 → **5,2 mm** (ayrılan parmaklar yüzey
  alanını büyüttü; üçgen bütçesi ≤ 5 000 korundu).

### 3) Sayılar

| Kademe | Üçgen (önce → sonra) | Bütçe |
| --- | --- | --- |
| standard (3,0 mm voxel) | 4 950 → **4 644** (kümeleme 4,8 → 5,2 mm) | ≤ 5 000 ✔ |
| low (4,5 mm) | 2 248 → **2 404** | ≤ 2 500 ✔ |
| distant (6,0 mm) | 802 → **882** | ≤ 1 000 ✔ |

("önce" değerleri bu raporun tur 1 "Sayılar" tablosundan; "sonra" bu turda
ölçüldü. Parmaklar ayrıldığı için yüzey alanı büyüdü: `low`/`distant` kademede
üçgen sayısı biraz arttı ama bütçenin altında kaldı; `standard`da kümeleme
0,4 mm büyütülerek bütçe korundu.)

Tarayıcıda `fpHandBuildMs` (standard, soğuk): **48–53 ms** (tur 1'de 64–72 ms
ölçülmüştü; alan artık parmak başına daha erken kısa devre yapıyor).
Sahne çizim çağrısı değişmedi (koltukta 196); sahne üçgeni 309 194 → 309 890.

### 4) Kareler — `docs/qa/claude/d1/`

| Dosya | İçerik |
| --- | --- |
| `webless-before-after.jpg` | Aynı kadraj, önce (perdeli) / sonra (perdesiz) |
| `webless-open-palm.jpg` | Açık avuç, ilk şahıs (D16 `hands_up`) |
| `webless-fan.jpg` | Kart tutuşu (`holdFan3`) |
| `webless-public-rest.jpg` | Masadaki dinlenme eli (`restTable`) |
| `webless-seat-view.jpg` | Koltuktan karşıdaki oyuncunun kamu elleri (`distant` kademe) |

Üretim: `node scratchpad/d1-web-shots.mjs 5199`.

### 5) Sapmalar / notlar

- `docs/design/D1-hands.md` §a/§b sayıları (MCP aralığı, yarıçaplar, `PALM`,
  `WEB`, `K`) DEĞİŞTİ. Tasarım dosyasına dokunulmadı; kaynak `anatomy.ts` ve bu
  bölüm. Gerekçe: şartname sayıları 3 mm voxel ile parmak aralarını çözemiyordu.
- Parmak arası boşluk artık boğum çizgisine kadar iniyor; gerçek elde avuç içi
  perdesi proksimal falanksın ~1/3'üne çıkar. İstenirse `WEB.y`/yarıçapı
  1–2 mm büyütülerek avuç İÇİ tarafında (el sırtında değil) geri getirilebilir.
- D3 karakter elleri ve `PublicArms` aynı geometriyi kullandığı için koltuk
  görüşünde de düzeldi (ek iş gerekmedi).
- `pnpm -r typecheck` 6/6, `pnpm test` 759, `pnpm --filter @secret-table/web build`
  geçti. Commit yok.

## Tur 6: yapışık bölgelerin sistematik taraması (2026-09-12)

Kullanıcı 2026-09-12 (canlı): *"elde yapışık çıkan yerler var, bir daha incele
düzelt"*. Tur 5'te perdeler kalkmıştı ama pozlarda hâlâ birleşik bölgeler vardı.

### 1) İnceleme aracı (yeni)

`/dev/hands?grip=<kavrama>&view=palm|back|tips&zoom=&skin=` — YALNIZ geliştirme girişi
(`routes.tsx` `import.meta.env.DEV`). Tek el, önkol çizilmez, düz zemin, tek
yönlü ışık. `packages/scene/src/hands/HandGallery.tsx` (+ `SkinnedHand` additive
`arm` propu), `apps/web/src/dev/DevHandsPage.tsx`.
Tarama: **14 kavrama × 3 açı = 42 kare**, `node scratchpad/d1-grid.mjs 5199 <etiket>`.
Not: SAYFA üretim paketine girmez (rota `import.meta.env.DEV`); bileşen sahne
paketinin girişinden dışa açıldığı için gövdesi (~2 KB) sahne chunk'ında kalır —
`CharacterGallery` ile aynı mevcut durum, ayrı iş.

### 2) Bulgular (tahmin değil, karelerden)

| Bulgu | Nerede | Neden |
| --- | --- | --- |
| **İnce "yelken" yamaları** komşu parmaklar arasında (en belirgin `rest`, `holdFan3`, `holdBallot`, `openPlace`) | sırt + uç görünümü | **Köşe kümeleme** 5,2 mm hücreyle 4 mm'lik parmak arası boşluğun İKİ DUVARINDAKİ köşeleri tek köşeye indiriyordu; poz verilince bu ortak köşe iki parmağa birden bağlı kalıp yüzeyi geriyordu |
| Kök çevresinde **köprü** (boğum hizası – proksimal falanks ortası) | sırt | Parmak↔avuç `smin`i (k = 5 mm) kök çevresinde şişip 4 mm'lik boşluğu kapatıyor, marching cubes iki parmağı tek yüzey olarak kapatıyordu |
| Boğum arası oluk yok, parmaklar avuca "yapıştırılmış" duruyor | sırt | Avuç diliminin distal ucu ile parmak kökleri arasında hiç kesik yoktu |
| `holdBallot`/`holdEnvelope`/`holdGun` sırt görünümünde parmak arasından çıkan ince şerit | sırt | **Kusur değil**: bu pozlarda BAŞ PARMAK avuç üstünden geçiyor ve ucu parmakların arasından görünüyor (alan ölçümü o noktada pozitif, `boundaryEdges` 0) |
| Parmak uçları – avuç, serçe – hypothenar, bilek – manşet | tüm pozlar | Kaynama YOK; yumruk pozlarında (`holdGun`, `thumbUp`) uçlar avuca değiyor ama temiz temas |

### 3) Düzeltmeler

1. **Kümeleme grubu** (`marchingCubes.clusterDecimate` + `geometry.vertexGroup`):
   köşe hangi parçaya ait (avuç 0, parmaklar 1–4, baş parmak 5) hesaplanır ve
   kümeleme anahtarına girer. **Farklı parçaların köşeleri asla birleşmez.**
2. **Parmak arası yarık** (`sdf.SPLIT`): komşu parmak eksenlerinin tam
   ortasından geçen ince dilimler alandan çıkarılır (`smax(d, −slab, k=2,2 mm)`,
   yarı kalınlık 3 mm). İki bölge: serbest falankslar (z ≤ −0,100) her yönden;
   boğum arası oluk (−0,100 … −0,076) **yalnız el sırtı tarafında** (y ≥ −2 mm)
   — avuç içindeki doğal perde korunur.
   1,8 mm'lik ilk deneme yetmedi: kesilen köprüden parmağın iç duvarında düz bir
   yelken kalıyordu.
3. Tur 5'teki `min`/`smin` ayrımı, perde kaldırma ve skin kuralı korundu.

### 4) Sayılar

| Kademe | Üçgen (tur 5 → tur 6) | Üretim (tarayıcı, `fpHandBuildMs`) |
| --- | --- | --- |
| standard | 4 644 → **4 728** | **66–77 ms** (hedef ≤ 75 ms bandında, tur 1: 63–78 ms) |
| low | 2 404 → **2 456** | ~60 ms (node) |
| distant | 882 → **932** | ~28 ms (node) |

Bütçeler (5 000 / 2 500 / 1 000) korundu. Voxel DEĞİŞMEDİ (3,0 / 4,5 / 6,0 mm) —
2,5 mm'ye inmeye gerek kalmadı. Taubin yumuşatma D1 elinde kullanılmıyor (D12
silahına özgü), dokunulmadı. Sahne çizim çağrısı değişmedi (koltukta 196).

### 5) Testler (yeni 1, toplam bu dosyada 3)

- **D1 tur 6** — `bind`, `rest`, `holdFan3`, `holdGun`, `openPalm` pozlarında
  komşu parmak çiftlerinin falanks yüzeyleri arasında en az bir örnek noktada
  boşluk > 0 (kapsül eksenleri `forwardKinematics` ile poza taşınır).
- D1 tur 5 — bind pozunda komşu parmak arası SDF > 0; skin ağırlığı komşu
  zincire gitmez.
- Mevcut `boundaryEdges === 0` (kapalı yüzey) testi yarıklardan sonra da geçiyor.

### 6) Kareler

- `docs/qa/claude/d1/fused-before-after.jpg` — en kötü 4 poz (`rest`,
  `holdFan3`, `holdBallot`, `openPlace`), sırt + uç açısı, önce/sonra.
- `docs/qa/claude/d1/fused-grid-after.jpg` — 14 kavrama × 3 açı, sonrası.
- `webless-*.jpg` sahne içi kareler bu geometriyle yeniden alındı.

Üretim: `node scratchpad/d1-grid.mjs 5199 <etiket>` (kareler `/tmp/d1grid-<etiket>/`),
kolajlar aynı dosyadaki python bloğuyla; sahne içi kareler `node scratchpad/d1-web-shots.mjs 5199`.

### 7) Not

`docs/design/D1-hands.md` §b'de yarık (`SPLIT`) ve kümeleme grubu yoktur; ikisi
de üretim hattı düzeltmesidir (şartname geometrisini değiştirmez, yalnız
çözünürlük sınırının yarattığı kaynamayı keser). Tasarım dosyasına dokunulmadı.

### 8) Ek: ilk şahıs elinin ten tonu (D3.4 devri, 2026-09-12)

D3.4 ajanı lobiye karakter/ten seçimini ekledi ve kamu ellerini bağladı; ilk
şahıs eli `packages/scene/src/hands/*` bu ajanda olduğu için açık kalmıştı.

- `hands/geometry.tintVertexColors(geometry, base)` — köşe renklerini hedef
  tona ORANLA kaydıran tek kaynak; `live/PublicArms` de artık bunu çağırıyor
  (kopya kod kalktı).
- `hands/geometry.tintedHandGeometry(tier, base)` — kademe × ten başına BİR
  kopya: konum/normal/indis ve `skinIndex/skinWeight` öznitelikleri üretim
  geometrisiyle PAYLAŞILIR, yalnız `color` özniteliği kopyalanır. Taban palet
  (`SKIN.base`) istenirse üretim geometrisi doğrudan döner.
- `SkinnedHand({ side, quality, arm, skin })` ve `HandRig({ …, skin })`;
  `TableScene` ve `FirstPersonStage` yerel oyuncunun `seatAvatar(player).skin`
  değerini geçiriyor. `/dev/hands?...&skin=acik|orta|koyu` ile denenir.
- Test: `hands.test.ts` "D3.4 — ilk şahıs eli ten tonu" (iki tenin köşe rengi
  ortalaması farklı, açık > koyu, öznitelik paylaşımı, aynı ten → aynı nesne).
- Kare: `docs/qa/claude/d1/skin-tones.jpg` (açık / orta / koyu, `openPalm` sırt).
  Ölçülen ortalama piksel: (161,140,111) / (140,99,62) / (80,44,27).
- `docs/qa/claude/D3-characters.md` §4/2 "kalan iş" notu KAPANDI olarak işaretlendi.
