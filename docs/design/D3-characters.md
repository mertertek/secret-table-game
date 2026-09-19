# D3 — Karakterler: üretim şartnamesi (SDF → marching cubes → SkinnedMesh)

Sahip: Claude (tasarım yan ajanı, Fable, 2026-09-11). Kod yazılmadı; bu belge, `d3/characters.json`, `d3/lineup.svg` ve `d3/body-sheet.svg` aynı üretici betikten (scratchpad `gen_d3.py`) çıktı — buradaki her sayı JSON ile birebirdir. Stil `d3/concept-*.{svg,png}` ile onaylandı; plan `D3-characters-plan.md`. Üretim yolu D1 ellerle aynı (`D1-hands.md` §b–c): kapsül/elipsoid/yuvarlatılmış kutu/torus SDF ilkelleri → polinom smooth-min → marching cubes → tek `BufferGeometry` → kemik ağırlıkları → `SkinnedMesh`; yüz ayrı küçük tuval dokusu. Birim metre, açı radyan.

## 0. Çerçeve ve okuma kuralları

- **Karakter uzayı:** orijin **sandalye minderinin üstü**, koltuk ekseninde; +Y yukarı; karakter **−Z** yönüne (masa merkezi) bakar; +X karakterin sağı (koltuk grubundaki `PublicArms` `side = +1` tarafı). Koltuk grubu (`TableScene` `position [chair.x, 0, chair.z] rotation.y = angle`) masa yüksekliğindedir; sandalye grubu y −0,74 + minder üstü 0,435 → **minder üstü dünya y −0,305**. Karakter grubu koltuk grubunun altında `position [0, −0,305, 0]`; **dünya y = yerel y − 0,305**. Masa yüzeyi yerel y **0,305**; masa kenarı koltuk ekseninden 0,29 (x ucu) – 0,35 (z ucu) m önde (yerel z −0,29…−0,35).
- Oturmuş boy **1,00** (minder → baş tepesi); baş tepesi dünya **0,695** (masa yüzeyinin 0,695 üstünde; konseptteki 0,75 gerçek sandalye minderi ile 0,695 oldu, kabul edilir sapma).
- `smin(a, b, k)` polinom smooth-min; alan işaretli uzaklık, iso **0**. Sıra: taban gövde ilkelleri listedeki sırayla `k` ile birleşir; sonra aksesuar grupları (§d) eklenir. Kesme düzlemi: `max(alan, −dot(p − nokta, normal))` yumuşak kesişim (`k` verilen); çıkarma: `max(alan, −çıkarılan)` yumuşak (`k` verilen), yalnız hedef alt-alana uygulanır.
- Aynalı ilkeller `.L/.R` ile ayrı listelenir (x işareti ters; `rot` verilmişse y/z bileşenleri ters). `rot` = three.js Euler XYZ, ilkel merkezinde.
- Renk = **en yakın ilkel kuralı**: köşe için tüm ilkellerin tekil SDF'i hesaplanır, en küçük olanın bölge/rengi alınır; giysi kuralları (§e) bölge etiketine göre üstüne yazar. Gradyan yok (cel-shade düz renk); gölge tonu ışıktan gelir.
- Baş yönü kanalı (`PeerHeads`, `sanitize`: yaw ±0,65, pitch ±0,25) **neck 40 % + head 60 %** olarak iki kemiğe dağıtılır (§c).

## a. Oran ve ölçüler (m)

Chibi oran: baş oturmuş boyun %42'si, kısa boyun, yumuşak omuz, küt kollar, masa altı kısa bacak. Kaynak: `d3/concept-scale.svg` (1 px = 2 mm, baş r 100 px).

| Parça | Değer | Not |
| --- | --- | --- |
| Oturmuş boy (minder → baş tepesi) | **1,00** | eski `ArticulatedAvatar` ≈ 0,735 (minder → 0,43 dünya) |
| Baş elipsoidi | merkez (0, **0,79**, −0,01), yarıçap (**0,20**, **0,21**, **0,19**) | tepe 1,00, alt 0,58; ø 0,40 × 0,42 × 0,38 |
| Göz çizgisi | y **0,774** (merkez − 0,016) → dünya **0,469** | `SeatCamera` önerisi §a-kamera |
| Kulak | küre (±0,205, 0,78, 0), r 0,036 | küpe/gözlük sapı çapası |
| Burun | elipsoid (0, 0,765, −0,205), r (0,026, 0,020, 0,024) | gölge ten rengi; dokuda burun yok |
| Yanak | küre (±0,10, 0,72, −0,13), r 0,06 | alt yüz hafif geniş (tombul) |
| Boyun | kapsül (0, 0,53, −0,01) → (0, 0,64, −0,01), r 0,065 | görünen boyun ≈ 0,04; sakal/fular örter |
| Omuz hattı | y **0,545**, omuz eklemi S = (±0,215, 0,545, 0) | omuz genişliği (deltoid dahil) **0,53**; dirsekler dahil en geniş **0,61** |
| Göğüs | elipsoid (0, 0,44, 0), r (0,21, 0,13, 0,15) + üst göğüs (0, 0,50, −0,02), r (0,19, 0,08, 0,13) | |
| Karın | elipsoid (0, 0,30, 0,01), r (0,20, 0,17, 0,16) | göbek ölçeği karakter başına (§e) |
| Kalça (oturmuş) | elipsoid (0, 0,13, 0,02), r (0,21, 0,15, 0,17) + arka (0, 0,16, 0,10), r (0,20, 0,14, 0,12) | alt −0,02 (mindere 2 cm gömülü, boşluk yok); genişlik 0,42 |
| Üst kol | S → dirsek E = (±0,245, 0,40, −0,17); boy **0,225**; r 0,062 → 0,055 | |
| Ön kol | E → bilek W = (±**0,220**, **0,340**, **−0,324**); boy **0,167**; r 0,055 → **0,036** | alt yüzü bilekte masa seviyesinde (0,304) |
| Bilek / D1 el arayüzü | W, koltuk grubunda (±0,220, 0,035, −0,324) | bugünkü `PublicArms` bilek noktası (mesh x ±0,18, `rotation.y ∓0,13`, el z −0,312) ile **aynı nokta** |
| Manşet | kapsül (±0,221, 0,34, −0,275) → (±0,221, 0,34, −0,318), r 0,040 | `PublicArms` kolluk + manşet silindirleri **gövde mesh'ine taşınır** (renk giysiye bağlı); `PublicArms` yalnız el kalır |
| El | D1 `restTable` pozu, **×1,15** | chibi oranla 0,088 avuç küçük kalıyordu; bilek r 0,030·1,15 = 0,0345 ≈ ön kol ucu 0,036 |
| Uyluk (masa altı) | kapsül (±0,11, 0,08, −0,02) → (±0,12, 0,09, −0,20), r 0,070 → 0,065 | diz masa kenarına (−0,29) ulaşmaz, masa tablasıyla (dünya −0,235…−0,025) kesişmez; baldır/ayak yok |
| Bacak rengi | `#3b3833` | tüm giysilerde aynı |

**Kamera ve etiket önerileri (dünya y):**

| Öğe | Bugün | Öneri | Gerekçe |
| --- | --- | --- | --- |
| Koltuk kamerası göz (`SeatCamera` özel/yelpaze: `(chair.x, .56, chair.z − .08)`) | 0,56 | **0,47** | karakter göz çizgisi dünya 0,469; diğer oyuncuların baş kanalı size bakarken pitch düz kalır |
| Serbest bakış (`(chair.x, .60, chair.z + .035)`) | 0,60 | **0,51** | aynı +0,04 fark korunur |
| Etiket alt kenarı (`seats.ts` `label.y`) | 0,48 | **0,745** + şapka yükseltmesi (§e tablo) | baş tepesi 0,695 + 0,05; şapkalı karakterlerde karakter başına `labelLift` |
| Genel masa kamerası hedefi (`cameraFraming`) | — | **değişmez** | görev kuralı; genel karede baş 0,40 m çapıyla yeterince okunur |
| `TargetZone` (`TableScene`, boyut [.42, .50, .42] @ y .25) | — | [0,64, 1,00, 0,52] @ y 0,20 | yeni siluet (dünya −0,305…0,695) |

Kamera 0,47'de masa çok yassı okunursa 0,50 / 0,54 kabul edilir sınır; 0,52'nin üstü baş kanalını aşağı baktırır. D3.2'de önce/sonra kareleriyle karar.

## b. Taban gövde SDF ilkel listesi

Tüm ilkeller karakter uzayında; `k` bir önceki birleşime uygulanır (ilk ilkel `—`). `region` renk/skin bölgesi (§e, §c). **23 ilkel.**

| # | İlkel | Parametre (m) | k | Bölge |
| --- | --- | --- | --- | --- |
| 1 | `hip` | elipsoid m (0, 0,13, 0,02), r (0,21, 0,15, 0,17) | — | torso |
| 2 | `rump` | elipsoid m (0, 0,16, 0,1), r (0,2, 0,14, 0,12) | 0,05 | torso |
| 3 | `belly` | elipsoid m (0, 0,3, 0,01), r (0,2, 0,17, 0,16) | 0,06 | torso |
| 4 | `chest` | elipsoid m (0, 0,44, 0), r (0,21, 0,13, 0,15) | 0,06 | torso |
| 5 | `upperChest` | elipsoid m (0, 0,5, -0,02), r (0,19, 0,08, 0,13) | 0,05 | torso |
| 6 | `shoulders` | kapsül (-0,19, 0,535, 0) → (0,19, 0,535, 0), r 0,075→0,075 | 0,05 | torso |
| 7 | `neck` | kapsül (0, 0,53, -0,01) → (0, 0,64, -0,01), r 0,065→0,065 | 0,03 | neck |
| 8 | `head` | elipsoid m (0, 0,79, -0,01), r (0,2, 0,21, 0,19) | 0,025 | head |
| 9 | `nose` | elipsoid m (0, 0,765, -0,205), r (0,026, 0,02, 0,024) | 0,01 | nose |
| 10 | `deltoid.L` | küre m (-0,215, 0,545, 0), r 0,08 | 0,04 | torso |
| 11 | `deltoid.R` | küre m (0,215, 0,545, 0), r 0,08 | 0,04 | torso |
| 12 | `cheek.L` | küre m (-0,1, 0,72, -0,13), r 0,06 | 0,03 | head |
| 13 | `cheek.R` | küre m (0,1, 0,72, -0,13), r 0,06 | 0,03 | head |
| 14 | `ear.L` | küre m (-0,205, 0,78, 0), r 0,036 | 0,012 | ear |
| 15 | `ear.R` | küre m (0,205, 0,78, 0), r 0,036 | 0,012 | ear |
| 16 | `upperArm.L` | kapsül (-0,215, 0,545, 0) → (-0,245, 0,4, -0,17), r 0,062→0,055 | 0,035 | upperArm |
| 17 | `upperArm.R` | kapsül (0,215, 0,545, 0) → (0,245, 0,4, -0,17), r 0,062→0,055 | 0,035 | upperArm |
| 18 | `forearm.L` | kapsül (-0,245, 0,4, -0,17) → (-0,22, 0,34, -0,324), r 0,055→0,036 | 0,025 | forearm |
| 19 | `forearm.R` | kapsül (0,245, 0,4, -0,17) → (0,22, 0,34, -0,324), r 0,055→0,036 | 0,025 | forearm |
| 20 | `cuff.L` | kapsül (-0,221, 0,34, -0,275) → (-0,221, 0,34, -0,318), r 0,04→0,04 | 0,006 | cuff |
| 21 | `cuff.R` | kapsül (0,221, 0,34, -0,275) → (0,221, 0,34, -0,318), r 0,04→0,04 | 0,006 | cuff |
| 22 | `thigh.L` | kapsül (-0,11, 0,08, -0,02) → (-0,12, 0,09, -0,2), r 0,07→0,065 | 0,04 | leg |
| 23 | `thigh.R` | kapsül (0,11, 0,08, -0,02) → (0,12, 0,09, -0,2), r 0,07→0,065 | 0,04 | leg |

**Üretim kutusu ve çözünürlük.** Taban gövde kutusu x [−0,31, +0,31], y [−0,03, +1,02], z [−0,36, +0,23]; aksesuarlarla en geniş kutu x ±0,34, y [−0,03, 1,18], z [−0,36, 0,25]. Gerçek kutu = ilkellerin AABB birleşimi + max(k) + 2 voxel, voxel katına yuvarlanır (karakter başına farklı; fötr/kıvırcık en büyük).

| Kademe | Voxel | Izgara (taban) | Ham üçgen (tahmin) | Hedef | Yüz tuvali |
| --- | --- | --- | --- | --- | --- |
| standard | **6 mm** | 104 × 175 × 99 ≈ 1,8 M hücre | ~65–70 k | **≤ 6 k** | 512 × 256 |
| low | **9 mm** | 69 × 117 × 66 ≈ 0,53 M hücre | ~30 k | **≤ 2,5 k** | 256 × 128 |

Ham üçgen tahmini: yüzey alanı ≈ 1,7 m² (baş 0,53, gövde 0,8, kollar 0,25, aksesuar 0,1–0,2); MC hücre başına ~1,5 üçgen. 6 mm'de **11:1 sadeleştirme** gerekir. Süre planı (§g): dar-bant değerlendirme (24 mm kaba geçiş → |d| < 30 mm hücrelerde ince geçiş, hacmin %10–15'i) + ilkel AABB eleme → SDF ~25–35 ms; MC ~15 ms; sadeleştirme QEM (`meshoptimizer` `simplify`, WASM, ~10 ms; JS yedeği: yığın tabanlı QEM ~60 ms) → ≤ 6 k; skin ağırlığı + renk ~10 ms. `three/addons SimplifyModifier` 70 k üçgende saniyeler sürer, **kullanılmaz**. Sadeleştirmede yüz penceresi (§f) ve eklem bantları (±10 mm) korunur (`meshopt` `LockBorder` + köşe kilidi).

## c. Kemikler (8)

`hips` (kök) → `spine` → `neck` → `head`; `spine` → `shoulder.L/R` → `elbow.L/R`. Orijin/uç karakter uzayında (bindMatrix şablon pozu, tüm açılar 0). Uç noktalar yalnız skin mesafesi için (segment).

| Kemik | Ebeveyn | Orijin | Uç | Sınır x / y / z (rad) | Not |
| --- | --- | --- | --- | --- | --- |
| `hips` | — (kök) | (0, 0,1, 0) | (0, 0,3, 0) | ±0,05 / ±0,05 / ±0,03 | kök; boşta salınım isteğe bağlı |
| `spine` | hips | (0, 0,3, 0) | (0, 0,545, 0) | ±0,15 / ±0,2 / ±0,1 | öne eğilme / dönme; ilk sürümde sabit |
| `neck` | spine | (0, 0,545, -0,01) | (0, 0,62, -0,01) | ±0,1 / ±0,26 / ±0,05 | baş kanalı 40 % |
| `head` | neck | (0, 0,62, -0,01) | (0, 1, -0,01) | ±0,15 / ±0,39 / ±0,08 | baş kanalı 60 % |
| `shoulder.L` | spine | (-0,215, 0,545, 0) | (-0,245, 0,4, -0,17) | ±0,6 / ±0,3 / ±0,3 |  |
| `shoulder.R` | spine | (0,215, 0,545, 0) | (0,245, 0,4, -0,17) | ±0,6 / ±0,3 / ±0,3 |  |
| `elbow.L` | shoulder.L | (-0,245, 0,4, -0,17) | (-0,22, 0,34, -0,324) | 0..1,2 / ±0,1 / ±0 | PublicArms kaldırma: rotation.x = 0,46·lift |
| `elbow.R` | shoulder.R | (0,245, 0,4, -0,17) | (0,22, 0,34, -0,324) | 0..1,2 / ±0,1 / ±0 | PublicArms kaldırma: rotation.x = 0,46·lift |

- **Baş yönü kanalı:** `headTarget` yaw/pitch → `neck.rotation.y/x = 0,40·yaw / 0,40·pitch`, `head.rotation = 0,60·…` (toplam aynı; boyun kırılması yumuşar). Mevcut `ArticulatedAvatar` baş grubu (y 0,145, tek pivot) kalkar. Yumuşatma katsayısı (12/s üstel) korunur.
- **PublicArms kaldırma** (`lift` 0..1, 0,075 yükselme): `elbow.rotation.x = 0,46·lift` (ön kol ucu 0,167·sin 0,46 ≈ 0,074 yükselir); el grubu FK bilek noktasına taşınır (`W' = E + R_x(0,46·lift)·(W − E)`), el `rotation.x = 0,24·lift` bugünkü gibi. Omuz kemiği bu sürümde sabit.
- **Skin ağırlığı kuralı:** her köşe için 8 kemiğin segmentine mesafe `d_i`; en yakın **2** kemik, `w_i ∝ exp(−d_i / σ)`, **σ = 12 mm**, normalize. Bant dışında (ikinci kemik d > 36 mm) tek kemik 1,0. Bölge geçersiz kılmaları:
  - `head`, `ear`, `nose`, yanaklar ve tüm baş aksesuarları (saç, şapka, gözlük, bıyık, sakal, küpe, zincir) → **head 1,0**; yalnız y < 0,66 bandında neck ile σ karışımı (sakal alt ucu boynu örter, boyunla döner).
  - `neck` → neck/head σ kuralı; `torso` → hips/spine σ kuralı (y 0,30 civarı geçiş); `deltoid` → spine/shoulder.
  - `upperArm` → shoulder/elbow σ; `forearm`, `cuff` → **elbow 1,0**; `leg` → **hips 1,0**.
  - Papyon, fular, yaka, düğmeler → **spine 1,0** (fular kuyruğu dahil).
- `SkinnedMesh` + `Skeleton`, `skinIndex`/`skinWeight` 2 bileşen yeter (4'lü öznitelikte kalan ikisi 0). Karakter başına ayrı `Skeleton`, geometri önbellekten paylaşılır (§g).

## d. Aksesuar ilkelleri

Aynı SDF alanına eklenir, aynı mesh'te pişer, renk vertex color (en yakın ilkel kuralı). Konumlar baş merkezi (0, 0,79, −0,01) üzerinden türetildi; JSON'da mutlak verilir. `tier: standard` olanlar low kademede atlanır. `labelLift` etiket yükseltmesi, `mouthOffset` yüz dokusundaki ağız kayması (m). Torus SDF exact (`length(vec2(length(p.xz) − R, p.y)) − r`, eksen `axis`); torus uygulanmazsa 12 kısa kapsül halkası (r aynı) yedektir.

**`hair-side` — Kel + yan saç** · renk `#b9b1a3` · tepe çıplak (ten); yan tutamlar kulak arkasında (z +0,03)

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `hairSide.L` | elipsoid m (-0,19, 0,8, 0,03), r (0,05, 0,075, 0,075) | 0,01 |
| `hairSide.R` | elipsoid m (0,19, 0,8, 0,03), r (0,05, 0,075, 0,075) | 0,01 |
| `hairBack.1` | kapsül (-0,17, 0,79, 0,05) → (-0,08, 0,79, 0,15), r 0,035→0,035 | 0,012 |
| `hairBack.2` | kapsül (-0,08, 0,79, 0,15) → (0,08, 0,79, 0,15), r 0,035→0,035 | 0,012 |
| `hairBack.3` | kapsül (0,08, 0,79, 0,15) → (0,17, 0,79, 0,05), r 0,035→0,035 | 0,012 |

**`hair-side-curls` — Yan bukleler (beyaz)** · renk `#d9d2c6` · kulak arkasında; bere/beret ile birlikte

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `curl.L1` | küre m (-0,184, 0,834, 0,03), r 0,046 | 0,02 |
| `curl.R1` | küre m (0,184, 0,834, 0,03), r 0,046 | 0,02 |
| `curl.L2` | küre m (-0,204, 0,766, 0,03), r 0,046 | 0,02 |
| `curl.R2` | küre m (0,204, 0,766, 0,03), r 0,046 | 0,02 |
| `curl.L3` | küre m (-0,18, 0,706, 0,03), r 0,046 | 0,02 |
| `curl.R3` | küre m (0,18, 0,706, 0,03), r 0,046 | 0,02 |

**`hair-flat` — Düz saç** · renk `#3a2419` · kesme düzlemi: y > 0,85 − 0,42·(z + 0,19) olan kısım kalır (önde alın açık, arkada ense örtülü)

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `hairCap` | elipsoid m (0, 0,83, 0), r (0,215, 0,2, 0,205) | 0,01 |
| `sideburn.L` | kapsül (-0,195, 0,81, -0,02) → (-0,2, 0,74, -0,025), r 0,018→0,016 | 0,008 |
| `sideburn.R` | kapsül (0,195, 0,81, -0,02) → (0,2, 0,74, -0,025), r 0,018→0,016 | 0,008 |
| `fringe.1` | elipsoid m (-0,09, 0,865, -0,16), r (0,05, 0,03, 0,045) | 0,012 |
| `fringe.2` | elipsoid m (0, 0,86, -0,17), r (0,05, 0,03, 0,045) | 0,012 |
| `fringe.3` | elipsoid m (0,09, 0,865, -0,16), r (0,05, 0,03, 0,045) | 0,012 |
| *kesme düzlemi* | nokta (0, 0,85, -0,19), normal (0, 1, 0,42) → dot ≥ 0 kalır | 0,01 |

**`hair-bun` — Topuz** · renk `#2b2220` · arkaya toplanmış, perçemsiz; topuz arkada üstte (z +0,17), bağ halkası accent

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `bunCap` | elipsoid m (0, 0,83, 0), r (0,213, 0,2, 0,205) | 0,01 |
| `bun` | küre m (0, 0,93, 0,17), r 0,065 | 0,015 |
| `bunTie` | torus m (0, 0,93, 0,13), eksen z, R 0,04, r 0,008 | 0,004 |
| `sideburn.L` | kapsül (-0,195, 0,81, -0,02) → (-0,2, 0,76, -0,025), r 0,016→0,014 | 0,008 |
| `sideburn.R` | kapsül (0,195, 0,81, -0,02) → (0,2, 0,76, -0,025), r 0,016→0,014 | 0,008 |
| *kesme düzlemi* | nokta (0, 0,86, -0,19), normal (0, 1, 0,42) → dot ≥ 0 kalır | 0,01 |

**`hair-curly` — Kabarık kıvırcık** · renk `#2a1d18` · etiket +0,08 · 9 küre hâle; tepe 1,08; ön kesme y > 0,80 − 0,30·(z + 0,19)

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `curlyCap` | elipsoid m (0, 0,86, 0,02), r (0,25, 0,22, 0,24) | 0,03 |
| `curly.0` | küre m (0,221, 0,92, 0,097), r 0,06 | 0,03 |
| `curly.1` | küre m (0,118, 0,952, 0,215), r 0,06 | 0,03 |
| `curly.2` | küre m (-0,041, 0,959, 0,242), r 0,06 | 0,03 |
| `curly.3` | küre m (-0,18, 0,939, 0,165), r 0,06 | 0,03 |
| `curly.4` | küre m (-0,235, 0,9, 0,02), r 0,06 | 0,03 |
| `curly.5` | küre m (-0,18, 0,861, -0,125), r 0,06 | 0,03 |
| `curly.6` | küre m (-0,041, 0,841, -0,202), r 0,06 | 0,03 |
| `curly.7` | küre m (0,118, 0,848, -0,175), r 0,06 | 0,03 |
| `curly.8` | küre m (0,221, 0,879, -0,057), r 0,06 | 0,03 |
| *kesme düzlemi* | nokta (0, 0,8, -0,19), normal (0, 1, 0,3) → dot ≥ 0 kalır | 0,02 |

**`hair-sideburns` — Favori** · renk `#2b2220` · fötr altında yalnız favoriler

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `sideburn.L` | kapsül (-0,19, 0,81, -0,02) → (-0,2, 0,735, -0,025), r 0,016→0,014 | 0,008 |
| `sideburn.R` | kapsül (0,19, 0,81, -0,02) → (0,2, 0,735, -0,025), r 0,016→0,014 | 0,008 |

**`hair-tufts` — Kep altı tutam** · renk `#241c19` · kep/bere kenarı altından taşan tutamlar

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `tuft.L1` | küre m (-0,175, 0,86, 0), r 0,03 | 0,012 |
| `tuft.R1` | küre m (0,175, 0,86, 0), r 0,03 | 0,012 |
| `tuft.L2` | küre m (-0,196, 0,826, 0), r 0,028 | 0,012 |
| `tuft.R2` | küre m (0,196, 0,826, 0), r 0,028 | 0,012 |

**`beret` — Bere (fransız)** · renk `#a84f74` · etiket +0,06 · rotZ −0,12 rad (sola yatık); tepe 1,045

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `beretTop` | elipsoid m (-0,012, 0,958, 0), r (0,225, 0,08, 0,215) rot (0, 0, -0,12) | 0,015 |
| `beretRim` `#8a3f5f` | elipsoid m (0, 0,915, 0), r (0,205, 0,035, 0,2) | 0,015 |
| `beretStalk` | küre m (-0,02, 1,045, 0), r 0,014 | 0,006 |

**`beanie` — Örgü bere** · renk `#d97b2f` · etiket +0,09 · kubbe y > 0,80; bant torus; ponpon krem; tepe 1,13

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `beanieDome` | elipsoid m (0, 0,89, -0,005), r (0,215, 0,185, 0,205) | 0,012 |
| `beanieBand` | torus m (0, 0,815, -0,005), eksen y, R 0,205, r 0,03 | 0,01 |
| `pompom` `#eee1c7` | küre m (0, 1,09, -0,005), r 0,04 | 0,01 |
| *kesme düzlemi* | nokta (0, 0,8, 0), normal (0, 1, 0) → dot ≥ 0 kalır | 0,008 |

**`cap` — Kep (siperlik)** · renk `#eee1c7` · etiket +0,02 · kubbe y > 0,86; siperlik rotX −0,15 (ön kenar aşağı); tepe 1,03

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `capDome` | elipsoid m (0, 0,84, -0,01), r (0,212, 0,19, 0,2) | 0,012 |
| `capBand` `#6ea9c6` | torus m (0, 0,865, -0,01), eksen y, R 0,2, r 0,02 | 0,008 |
| `visor` `#8ec5df` | elipsoid m (0, 0,85, -0,3), r (0,2, 0,014, 0,13) rot (-0,15, 0, 0) | 0,01 |
| `capButton` `#8ec5df` | küre m (0, 1,025, -0,01), r 0,014 | 0,006 |
| *kesme düzlemi* | nokta (0, 0,86, 0), normal (0, 1, 0) → dot ≥ 0 kalır | 0,008 |

**`fedora` — Fötr** · renk `#25355a` · etiket +0,12 · brim rotX +0,06 (ön kenar hafif aşağı); tepe 1,115 (çukur 1,08); taç başı sarar (baş tepesi 1,00 taç içinde)

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `crown` | yuvarlatılmış kutu m (0, 1,015, -0,01), yarı (0,17, 0,1, 0,16), köşe 0,06 | 0,015 |
| `hatBand` `#b49359` | yuvarlatılmış kutu m (0, 0,945, -0,01), yarı (0,176, 0,024, 0,166), köşe 0,02 | 0,006 |
| `brim` | elipsoid m (0, 0,915, -0,01), r (0,275, 0,015, 0,245) rot (0,06, 0, 0) | 0,01 |
| *çıkarma* `crownDent` | elipsoid m (0, 1,15, -0,01), r (0,09, 0,05, 0,14) (hedef `crown`) | 0,02 |

**`glasses` — Yuvarlak gözlük** · renk `#b49359` · halka torus (kapsül halkası 12 parça yedek); yüz dokusunda cam parlaması son katman

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `lens.L` | torus m (-0,08, 0,774, -0,183), eksen z, R 0,056, r 0,008 rot (0, 0,22, 0) | 0,004 |
| `lens.R` | torus m (0,08, 0,774, -0,183), eksen z, R 0,056, r 0,008 rot (0, -0,22, 0) | 0,004 |
| `temple.L` | kapsül (-0,134, 0,776, -0,175) → (-0,205, 0,782, -0,02), r 0,006→0,006 | 0,004 |
| `temple.R` | kapsül (0,134, 0,776, -0,175) → (0,205, 0,782, -0,02), r 0,006→0,006 | 0,004 |
| `bridge` | kapsül (-0,026, 0,782, -0,19) → (0,026, 0,782, -0,19), r 0,007→0,007 | 0,004 |

**`glasses-chain` — Gözlük zinciri** · renk `#e3be73` · yalnız standard · low kademede yok

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `chain.L1` | kapsül (-0,14, 0,76, -0,175) → (-0,215, 0,72, -0,05), r 0,007→0,007 | 0,004 |
| `chain.R1` | kapsül (0,14, 0,76, -0,175) → (0,215, 0,72, -0,05), r 0,007→0,007 | 0,004 |
| `chain.L2` | kapsül (-0,215, 0,72, -0,05) → (-0,19, 0,66, 0,06), r 0,007→0,007 | 0,004 |
| `chain.R2` | kapsül (0,215, 0,72, -0,05) → (0,19, 0,66, 0,06), r 0,007→0,007 | 0,004 |

**`mustache-thick` — Kalın bıyık** · renk `#5a5049` · ağız -0,02 · ağız dokusu 20 mm aşağı kayar

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `must.L` | kapsül (0, 0,685, -0,19) → (-0,078, 0,7, -0,168), r 0,02→0,018 | 0,006 |
| `must.R` | kapsül (-0, 0,685, -0,19) → (0,078, 0,7, -0,168), r 0,02→0,018 | 0,006 |
| `mustEnd.L` | küre m (-0,085, 0,705, -0,163), r 0,022 | 0,006 |
| `mustEnd.R` | küre m (0,085, 0,705, -0,163), r 0,022 | 0,006 |

**`mustache-thin` — İnce bıyık** · renk `#2b2220` · ağız -0,008

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `must.L` | kapsül (-0,004, 0,69, -0,192) → (-0,062, 0,7, -0,17), r 0,007→0,007 | 0,004 |
| `must.R` | kapsül (0,004, 0,69, -0,192) → (0,062, 0,7, -0,17), r 0,007→0,007 | 0,004 |

**`beard-full` — Dolgun sakal** · renk `#4a3a30` · ağız -0,01 · sakal alanı önce kendi içinde birleşir, ağız cebi çıkarılır, sonra gövdeye eklenir; alt sınır 0,52 boynu örter

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `beardChin` | elipsoid m (0, 0,62, -0,1), r (0,16, 0,1, 0,12) | 0,03 |
| `beardCheek.L` | elipsoid m (-0,13, 0,69, -0,1), r (0,07, 0,1, 0,09) | 0,03 |
| `beardCheek.R` | elipsoid m (0,13, 0,69, -0,1), r (0,07, 0,1, 0,09) | 0,03 |
| `must.L` | kapsül (0, 0,685, -0,19) → (-0,078, 0,7, -0,168), r 0,02→0,018 | 0,01 |
| `must.R` | kapsül (-0, 0,685, -0,19) → (0,078, 0,7, -0,168), r 0,02→0,018 | 0,01 |
| *çıkarma* `mouthPocket` | elipsoid m (0, 0,645, -0,2), r (0,055, 0,03, 0,05) (hedef `beard-full`) | 0,012 |

**`bowtie` — Papyon** · renk `#b49359`

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `bow.L` | elipsoid m (-0,045, 0,545, -0,15), r (0,045, 0,028, 0,02) | 0,004 |
| `bow.R` | elipsoid m (0,045, 0,545, -0,15), r (0,045, 0,028, 0,02) | 0,004 |
| `bowKnot` | küre m (0, 0,545, -0,155), r 0,018 | 0,004 |

**`scarf` — Fular** · renk `#7a4f9e`

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `scarfRing` | torus m (0, 0,575, -0,01), eksen y, R 0,085, r 0,03 | 0,01 |
| `scarfTail` | kapsül (0,04, 0,56, -0,14) → (0,07, 0,42, -0,17), r 0,028→0,022 | 0,01 |

**`earrings` — Küpe** · renk `#e3be73` · yalnız standard

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `earring.L` | küre m (-0,207, 0,735, 0), r 0,012 | 0,003 |
| `earring.R` | küre m (0,207, 0,735, 0), r 0,012 | 0,003 |

**`collar` — Gömlek yakası** · renk `#eee1c7`

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `collar.L` | kapsül (-0,03, 0,585, -0,09) → (-0,1, 0,52, -0,14), r 0,014→0,012 | 0,006 |
| `collar.R` | kapsül (0,03, 0,585, -0,09) → (0,1, 0,52, -0,14), r 0,014→0,012 | 0,006 |

**`buttons-brass` — Pirinç düğmeler** · renk `#b49359` · yalnız standard

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `button.0` | küre m (0, 0,28, -0,158), r 0,012 | 0,003 |
| `button.1` | küre m (0, 0,34, -0,158), r 0,012 | 0,003 |
| `button.2` | küre m (0, 0,4, -0,158), r 0,012 | 0,003 |

**`buttons-cream` — Krem düğmeler (hırka, tek taraf)** · renk `#e4d6b8` · yalnız standard

| İlkel | Parametre (m) | k |
| --- | --- | --- |
| `button.0` | küre m (0,045, 0,24, -0,158), r 0,012 | 0,003 |
| `button.1` | küre m (0,045, 0,32, -0,158), r 0,012 | 0,003 |
| `button.2` | küre m (0,045, 0,4, -0,158), r 0,012 | 0,003 |

Uygulama notları: saç kapakları (`hairCap`, `bunCap`, `curlyCap`) baştan 5–15 mm büyük elipsoid + kesme düzlemi; kesme `k` 0,01–0,02 ile kenar yumuşar. Şapka kubbeleri kesme düzlemi `y` sabit. Fötr taç çukuru yalnız `crown` alt-alanından çıkarılır (brim etkilenmez). Sakal: `beardChin + beardCheek + must` kendi içinde `k` ile birleşir, `mouthPocket` çıkarılır, sonra gövdeye `k 0,03` ile eklenir. Gözlük halkaları `rot.y ±0,22` ile yüz eğriliğini izler; dış kenar baş yüzeyinin ~4 cm önünde (karikatür gözlük, kabul).

## e. 8 karakter tanımı

Plan tablosuyla aynı sıra. Vurgu renkleri parti renklerinden (`liberal #427e9e`, `fascist #a94743`) uzak: bordo `#7a2a3a` (kırmızıya en yakın olan; doygunluk/parlaklık faşist kırmızısından belirgin düşük, D10 `fascistDeep #7e332f` ile karışmaması için yelek hep krem gömlekle) ve lacivert `#25355a` (liberal mavisinden çok koyu). Ten: her karakterde 3 seçenek (`skins`), sıra `açık / orta / koyu` = concept hex'leri.

| # | id | Ad | Aksesuarlar | Giysi | Giysi rengi | Vurgu | Göbek × | Omuz × | Yüz notu |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `biyikli-amca` | Bıyıklı Amca | `hair-side`, `mustache-thick`, `collar`, `buttons-brass` | `vest` | `#7a2a3a` | `#7a2a3a` | 1,15 | 1,05 | kaş ×1,4, kaş `#8f877c` |
| 2 | `gozluklu` | Gözlüklü | `hair-flat`, `glasses` | `sweater` | `#c9973a` | `#c9973a` | 1 | 1 | kaş `#3a2419` |
| 3 | `topuzlu` | Topuzlu | `hair-bun`, `earrings`, `collar` | `jacket` | `#2e7a5a` | `#2e7a5a` | 0,95 | 0,95 | kaş ×0,9, kaş `#2b2220` |
| 4 | `fotr` | Fötr | `fedora`, `hair-sideburns`, `mustache-thin`, `bowtie`, `collar` | `jacket` | `#25355a` | `#25355a` | 1 | 1 | sol kaş +12 mm, kaş `#2b2220` |
| 5 | `sakalli` | Sakallı | `beanie`, `beard-full` | `sweater` | `#4f5a3c` | `#d97b2f` | 1,1 | 1,08 | kaş ×1,3, kaş `#4a3a30` |
| 6 | `kivircik` | Kıvırcık | `hair-curly`, `scarf` | `sweater` | `#c9b9a0` | `#7a4f9e` | 0,97 | 0,97 | kaş `#2a1d18` |
| 7 | `bereli-teyze` | Bereli Teyze | `beret`, `hair-side-curls`, `glasses`, `glasses-chain`, `buttons-cream` | `cardigan` | `#e6a0b8` | `#e6a0b8` | 1,05 | 0,95 | kaş `#9c948a` |
| 8 | `kepli-cocuk` | Kepli Çocuk Kalpli | `cap`, `hair-tufts` | `tshirt` | `#8ec5df` | `#8ec5df` | 0,95 | 0,9 | kaş ×0,9, çil, ağız `grin`, kaş `#241c19` |

**Ten tonları:**

| id | Ten | Gölge tonu (burun, kulak, boyun) |
| --- | --- | --- |
| `acik` | `#f1c9a3` | `#d8a074` |
| `orta` | `#c98f62` | `#a56f46` |
| `koyu` | `#7d4b30` | `#5c3521` |

**Gövde oran farkı (`bodyScale`):** `belly s` → `hip`, `rump`, `belly` yarıçapları x,z × s; `chest` x,z × (1 + (s−1)·0,5). `shoulders t` → `shoulders` kapsül uçları, `deltoid`, S/E/W x koordinatları × t; `PublicArms` el x = 0,18·t (bilek uyumu). Baş ölçeği hep 1,0 (etiket/kamera sabit kalsın).

**Giysi → gövde renk bölgeleri (vertex color kuralı):** bölge etiketi §b `region`. `outfit` = `outfitColor`; `outfitDark` = outfit −12 % L; `shirt` = `#eee1c7`; `skin` = ten. Ön koşulu: z < −0,05.

| Giysi | torso | shoulders/deltoid | upperArm | forearm | cuff | Ön bölge kuralları | Boyun halkası | Düğme |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `vest` yelek | outfit | shirt | shirt | shirt | shirt | V yaka shirt: \|x\| < 0,11·(y−0,38)/0,18, y ∈ [0,38, 0,56] | — | `buttons-brass` (0, 0,28/0,34/0,40, −0,158) |
| `sweater` kazak | outfit | outfit | outfit | outfit | outfitDark | — | neck y < 0,575 → outfit | — |
| `jacket` ceket | outfit | outfit | outfit | outfit | shirt | V shirt: \|x\| < 0,12·(y−0,36)/0,20, y ∈ [0,36, 0,56]; yaka bandı outfitDark: V kenarından 0,035 dışa | — | — |
| `cardigan` hırka | outfit | outfit | outfit | outfit | outfit | orta şerit shirt \|x\| < 0,05, y ∈ [0,20, 0,56]; V shirt \|x\| < 0,05 + 0,10·(y−0,40)/0,16, y ∈ [0,40, 0,56] | — | `buttons-cream` (0,045, 0,24/0,32/0,40, −0,158) |
| `tshirt` tişört | outfit | outfit | outfit | **skin** | **yok** (ilkel çıkarılır) | — | neck y < 0,575 → outfit | — |

Yelekte `shoulders`/`deltoid` krem gömlek olduğundan yelek yalnız gövde önü/arkasında; V kenarı yeleğin üst sınırıdır (y 0,56 üstü gömlek). Sadeleştirme sonrası renk sınırları köşe yoğunluğuna bağlı zikzak yapar; V ve şerit kenarında 1 üçgen (~6–12 mm) tolerans kabul.

**Etiket yüksekliği (dünya y, `seats.ts` `label`):**

| Karakter | Şapka/saç yükseltmesi | Etiket alt kenarı (dünya y) |
| --- | --- | --- |
| Bıyıklı Amca | 0 | **0,745** |
| Gözlüklü | 0 | **0,745** |
| Topuzlu | 0 | **0,745** |
| Fötr | +0,12 | **0,865** |
| Sakallı | +0,09 | **0,835** |
| Kıvırcık | +0,08 | **0,825** |
| Bereli Teyze | +0,06 | **0,805** |
| Kepli Çocuk Kalpli | +0,02 | **0,765** |

## f. Yüz dokusu

- **Tuval:** 512 × 256 (`CanvasTexture`, sRGB, `LinearMipmapLinearFilter`, `flipY` varsayılan); low kademede 256 × 128 (aynı çizim, `ctx.scale(0,5)`).
- **Pencere (planar Z projeksiyonu):** x ∈ [−0,20, +0,20] → u, y ∈ [0,62, 0,94] → v (`u = (x + 0,20)/0,40`, `v = (y − 0,62)/0,32`). Piksel/mm: x 1,28, y 0,80 (kare değil; çizim mm cinsinden `ctx.setTransform(1.28, 0, 0, −0.80, 256, 120)` ile — baş merkezi (0, 0,79) tuvalde (256, 120)). Özellik koordinatları aşağıda **mm, baş merkezine göre, +y yukarı, +x karakterin sağı**; yüzden bakan izleyici için ayna (simetrik özelliklerde fark etmez; fötr'ün kalkık kaşı karakterin **solu**).
- **Üyelik (ilkel tabanlı UV kuralı):** köşenin en yakın taban ilkeli ∈ {`head`, `cheek.L`, `cheek.R`} **ve** köşe normali z < −0,25 (öne bakan yarım küre) **ve** köşe pencere içinde → UV atanır. Üçgenin 3 köşesi de üyeyse **yüz grubu** (`geometry.addGroup`, material index 1), değilse gövde grubu (index 0). Burun, gözlük, bıyık, sakal kendi ilkellerinde kalır (3D, vertex color). Yüz malzemesi: `MeshStandardMaterial { map, vertexColors: false }`; gövde: `{ vertexColors: true }`; aynı roughness 0,85, metalness 0 → dikiş görünmez çünkü tuval zemini = ten hex'i. (Tek mesh, 2 malzeme → 2 çizim.)
- **Katman sırası (her yeniden çizimde tam tuval):** 1 ten zemini (tüm tuval) → 2 yanak → 3 çil → 4 göz akı → 5 göz bebeği + parlaklık → 6 göz kapağı (kırpma/somurtkan) → 7 kaş → 8 ağız (+ dişler / dil / alt dudak) → 9 gözlük cam parlaması (yalnız `glasses` varsa; 3D halka mesh'te olduğundan doku halka çizmez).
- **Sabit özellikler (mm):** göz akı elips (±80, −16) rx 42 ry 50 `#fbf7ee`; bebek r 24 (±80, −22) `#252b2c`; parlaklık r 9 (±80 − 10, −10), r 4 (±80 + 8, −30) `#fff`; kaş kalınlığı 16 × `weight` (karakter), renk karakterden; yanak (±128, −92) r 30 (rx ×0,9, projeksiyon gerilmesi telafisi) `#e07c7c`; ağız çizgi 12; çil r 6 `#3e2214` α 0,75, 10 nokta [(±140, −80), (±116, −104), (±96, −88), (±124, −124), (−28, −60), (32, −64)]; dişler dikdörtgen (−56…56, −122…−144) `#fbf7ee`, boşluk (−8…2); cam parlaması r 50 beyaz α 0,08.
- **Aksesuar etkileşimi:** `mustache-thick` ağız −20 mm, `mustache-thin` −8 mm, `beard-full` −10 mm (ağız cebi içinde). Kepli çocuk `mouthStyle: grin`: dolu yay (−68, −116) → (0, −200) → (68, −116) + dişler.

**4 ifade (`faces.expressions`; concept-faces ile aynı, 1 px = 2 mm ölçeği):**

| İfade | Kaş (mm; başlangıç → kontrol → uç, sağ taraf aynalı) | Göz | Yanak α / r | Ağız |
| --- | --- | --- | --- | --- |
| `neutral` | (44, 68) → (80, 74) → (116, 72) | ×1 | 0,14 / 30 | yay (-36, -132) → (0, -144) → (36, -132) |
| `smile` | (44, 60) → (80, 80) → (116, 76) | ×1 | 0,34 / 34 | yay (-56, -120) → (0, -172) → (56, -120) |
| `surprised` | (44, 104) → (80, 122) → (116, 100) | ×1,18 | 0,12 / 30 | dolu elips (0, -148) rx 26 ry 32 + dil |
| `grumpy` | (44, 56) → (80, 70) → (116, 84) | ×1, bebek dy -8, kapak 35 % | 0,2 / 30 | yay (-48, -152) → (0, -116) → (48, -152) + alt dudak (0, −168) 20×10 |

- Varsayılan ifade **`smile`**. İfade emote'tan (B5) gelir; geçiş anında 1 yeniden çizim (karışım yok; 2 kare ara "neutral" ile 120 ms'lik yumuşatma isteğe bağlı).
- **Göz kırpma (boşta):** kapak kapanma 120 ms, açılma 100 ms; kareler `open → half (60 ms) → closed (120 ms) → half (170 ms) → open (220 ms)` = 4 yeniden çizim; aralık her oyuncuda bağımsız **3–6 s** düzgün rastgele; `reducedMotion` açıkken kırpma yok; `surprised`'da kırpma yok, `grumpy`'de kapak zaten %35. Her çizimden sonra `texture.needsUpdate = true` + `invalidate()`.
- Doku anahtarı `karakter:ten:ifade:kırpmaKaresi`; oyuncu başına 1 tuval (10 kişide 10 × 512×256 RGBA ≈ 5 MB).

## g. Bütçe ve kademeler

| | standard | low |
| --- | --- | --- |
| Voxel | 6 mm | 9 mm |
| Üçgen (gövde + aksesuar, sadeleştirilmiş) | ≤ 6 k | ≤ 2,5 k |
| Kemik / skin | 8 / 2 ağırlık | 8 / 2 ağırlık |
| Aksesuar | tümü | `tier: standard` olanlar yok (zincir, küpe, düğmeler) |
| Gölge | castShadow açık | kapalı |
| Yüz tuvali | 512 × 256 | 256 × 128 |
| Çizim / oyuncu | gövde 1 + yüz 1 + eller (`PublicArms` tek `InstancedMesh`, tüm oyuncular 1) = **≤ 3** | aynı |
| Üretim (SDF + MC + sadeleştirme + skin + renk) | **< 120 ms** (hedef 80–90) | < 50 ms |
| Önbellek | geometri `karakter:kademe` (konum/normal/skin öznitelikleri paylaşılır); renk özniteliği `karakter:ten` (klon, yalnız `color`); yüz tuvali oyuncu başına | aynı |
| Bellek | 8 × 3 ten × 6 k üçgen ≈ 24 × 0,5 MB = 12 MB en kötü; yalnız odadaki seçimler üretilir | ~5 MB |

Üretim ana iş parçacığında, oda girişinde (lobi → masa geçişi) tek seferde; 10 farklı karakter ≈ 1 s → bir `requestIdleCallback` kuyruğuyla sırayla (kamera geçişi 700 ms'yi örter). Web Worker isteğe bağlı (SDF + MC saf sayı, `Float32Array` transfer).

## h. Kabul ölçütleri

1. **Concept örtüşmesi:** koltuk kamerasından (0,47) karşıdaki karakter ve genel masa karesi `d3/lineup.png` ile yan yana: baş/gövde oranı, omuz genişliği, aksesuar siluetleri okunur; baş ekranda ≥ 60 px (1080p, karşı koltuk ~4,2 m).
2. **Çakışma yok:** 10 oyuncu, en yakın iki koltuk (x ucunda 1,24 m) arasında dirsek dahil 0,61 m siluet → ≥ 0,6 m boşluk; şapka/saç komşu etiketi örtmez; hiçbir ilkel masa tablasıyla (dünya −0,235…−0,025, kenar z −0,29) kesişmez (`thigh` ucu −0,20 + r 0,065).
3. **Baş dönüşü:** `fpHeadYaw/Pitch` veri öznitelikleri yaw ±0,65 / pitch ±0,25'te boyun+baş birlikte döner, boyun dikişi/yırtılma yok (σ 12 mm bandı), sakal/gözlük/şapka başla birlikte.
4. **Etiket:** her karakterde etiket alt kenarı baş/şapka tepesinin **0,05 m** üstünde (§e tablo); fötr 0,865, kel 0,745.
5. **Ellerle ölçek:** D1 el ×1,15 ile bilek ucu ön kolla aynı yarıçap (0,0345 / 0,036), manşet krem/ten geçişi tek parça; yelpaze/pinch pozları D1 kabul kareleriyle yeniden kontrol (el büyüdüğü için kart–parmak temas tabloları ×1,15 ölçekle geçerli, `docs/design/D1-hands.md` §e, tolerans 2 mm → 2,3 mm).
6. **Bütçe:** `renderer.info.render.calls` farkı oyuncu başına ≤ 3; üretim süresi dev sayfasına yazılır (< 120 ms standard, < 50 ms low; CPU 4× yavaşlatmada < 480 ms).
7. **Yüz:** 4 ifade + kırpma dev galerisinde; yüz grubu ile gövde arasında renk dikişi yok (tuval zemini = ten hex'i); gözlüklü karakterde cam parlaması halka içinde.
8. **Parti rengi yok:** vurgu ve giysi hex'leri `palette.liberal/fascist` ve D10 `liberalDeep/fascistDeep` ile ΔE > 20 (bordo `#7a2a3a` vs `#7e332f`: fark kroma/ton; yelek her zaman krem gömlekle çerçevelenir — D3.2 karesinde tahta yanında kontrol).
9. **Önce/sonra:** `docs/qa/claude/d3/` altına koltuk kamerası (karşı koltuk yakın), genel masa (10 kişi) ve galeri (8 × 3 ten) kareleri.

## Mevcut modelden başlıca farklar

1. Küre baş r 0,135 + silindir gövde 0,36 + 2 silindir kol (merge, 2 çizim) → **23 ilkel SDF birleşimi + aksesuar alanı, tek `SkinnedMesh` (2 malzeme grubu)**; oturmuş boy 0,735 → 1,00, baş ø 0,27 → 0,40.
2. Baş grubu tek pivot (y 0,145) → **neck + head kemikleri (40/60)**; kanal sınırları aynı.
3. `PublicArms` kolluk + manşet silindirleri **gövde mesh'ine** taşınır (giysi rengi), `PublicArms` yalnız el (×1,15) + `InstancedMesh`; bilek noktası değişmez.
4. Koltuk sırasına göre dönen 4 ten × 4 ceket → **8 karakter × 3 ten**, seçim B3 (`room_members.avatar`), bu şartname dışı.
5. Karakter grubu **minder üstü orijinli** (koltuk grubunun altında y −0,305); kamera göz 0,56 → 0,47, etiket 0,48 → 0,745 + şapka; genel masa hedefi değişmez.

## Riskler

- **Sadeleştirme oranı 11:1** (6 mm ham ~70 k → 6 k): `meshoptimizer` WASM bağımlılığı (proje yapılandırması Claude ana ajanında; ~50 kB) ya da JS QEM; JS yolu 120 ms bütçesini zorlar. Yedek: standard 8 mm + 2:1 sadeleştirme (~9 k üçgen, bütçe aşımı %50) D3.2'de ölçülür.
- Dar-bant değerlendirme olmadan 6 mm tam ızgara (1,8 M hücre × ~45 ilkel) 200 ms+; kaba geçiş şart.
- Planar yüz projeksiyonu başın yanlarında gerilir (x ±0,15'te ×1,3); yanaklar buna göre daraltıldı, gözler ±0,08'de sorun yok. Baş yaw 0,65'te yüz penceresi hâlâ öne bakıyor (kural bind pozunda uygulanır).
- Yüz/gövde dikişi: iki malzeme aynı ışıkta aynı ten hex'ini verir; tone mapping / `envMapIntensity` farkı olursa dikiş görünür → iki malzeme aynı parametrelerle (yalnız `map` farkı).
- Gözlük teli r 8 mm, zincir r 7 mm: 6 mm voxelde 2,3–2,7 voxel; MC'de ince yerlerde kopma olabilir → low'da zincir yok, standard'da gözlük teli 8 mm'nin altına inmez. Alternatif: ince telleri `TorusGeometry`/`TubeGeometry` olarak aynı `BufferGeometry`'ye `mergeGeometries` ile eklemek (ek çizim yok, head 1,0 ağırlık).
- Vertex color ile giysi V/şerit kenarları sadeleştirme sonrası zikzaklı (±1 üçgen); rahatsız ederse V kenarı boyunca köşe kilidi (meshopt `LockBorder` benzeri, kenar üçgenleri işaretlenir).
- Bordo vurgu faşist kırmızısına en yakın renk; D3.2 karesinde tahta yanında okunma kontrolü; sorun olursa `#6f2d49` (mürdüm) yedek.
- Sakal karakterde boyun/yaka aksesuarları (fular, papyon) sakal altında kalır; sakallıya yaka aksesuarı verilmedi.
- Etiket yüksekliği karakter başına farklı olduğundan `seats.ts` `label` artık `avatar` bilgisine bağımlı (B3 sözleşmesi gelene kadar `labelLift 0` ile temel 0,745).
