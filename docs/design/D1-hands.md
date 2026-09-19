# D1 — Eller: tasarım şartnamesi (kapsül SDF → marching cubes → SkinnedMesh)

Sahip: Claude (tasarım yan ajanı, 2026-09-11). Kod yazılmadı; bu belge, `d1/poses.json` ve `d1/hand-sheet.svg` aynı sayılardan üretildi (yan ajanın FK/temas kontrol betiği ile doğrulandı). Kapsam: `packages/scene/src/prototype/{HandModel,InstancedHandModel,HandRig,rig,grip}` ve `live/PublicArms.tsx` yerine geçecek tek parça kemikli el. Birim metre, açı radyan, sahne ekseni `docs/DESIGN.md` §3.

## 0. Çerçeve ve okuma kuralları

- **Şablon = sağ el.** Bilek orijin (0,0,0), parmaklar −Z, avuç içi −Y, baş parmak −X. Bu, koddaki `side=1` (`scale [1,1,1]`) ile aynıdır; **sol el = `scale [−1,1,1]`** (görev metnindeki "sol el için baş parmak −X" ifadesi şablon yönüyle çelişiyordu; kodla uyum için şablon sağ el alındı).
- Parmak eklem açıları: `flex > 0` avuca kapanır → `rotation.x = −flex`; `abd > 0` parmak ucu +X (serçe) yönüne → `rotation.y = −abd` (yalnız MCP). Baş parmak CMC: taban çerçevesi (§3) üzerine three.js `Euler XYZ (ex, ey, ez)`; MCP/IP `rotation.x = −flex`.
- Kart çerçevesi: `docs/DESIGN.md` gibi kartın eni X, boyu Z (üst kenar −Z), kalınlığı Y, **ön yüz +Y**. `PhysicalCard` bloğu 0.19 × **0.008** × 0.272 m (görev notundaki 0.003–0.005 değil; kod 0.008). Yarı en 0.095, yarı boy 0.136.
- Kart–el ilişkisi şablon uzayında verilir: kart merkezi `C` (el yerel) + `Euler XYZ`. Sol el için `C.x → −C.x`, Euler `(a,b,c) → (a,−b,−c)`, temas noktası `x_c → −x_c`. Dünya yerleşimi: `R_hand = R_card · R_cardInHandᵀ`, `p_hand = p_card − R_hand · C` (sol elde `C` ve `R` aynalanmış hâliyle).
- Yumuşak temas kuralı: deri yüzeyi ile kart yüzeyi arası hedef **0–2 mm**; hiçbir parmak gövdesi kart sınırı içinde kart düzlemini kesmez (aşağıdaki tüm tablolar bu kuralla sayısal olarak kontrol edildi).

## a. Anatomi ve ölçüler (m)

Stilize erişkin el: avuç gerçekten biraz geniş (0.088), parmaklar gerçeğe göre %8–12 kısa ve uçları yuvarlak, tırnak yok.

| Parça | Değer | Not |
| --- | --- | --- |
| Avuç genişliği (MCP hizası, deri dahil) | 0.088 | eski elipsoid 0.126 × 0.140 çapındaydı (fazla yassı ve geniş) |
| Avuç boyu (bilek → orta parmak MCP) | 0.094 | eski 0.090 (elipsoid merkez −0.042, z yarıçapı 0.070) |
| Avuç kalınlığı | 0.028 (y ±0.014), MCP hizasında 0.022 | eski 0.047 (0.063 × 0.37 × 2) |
| Bilek genişlik / kalınlık | 0.062 / 0.036 | manşet silindiri r 0.046 bunu 1 cm örter |
| Baş parmak tepesi (thenar) | elipsoid merkez (−0.030, −0.004, −0.045), yarıçaplar (0.022, 0.014, 0.032) | avuç içine hafif taşar |
| Serçe tepesi (hypothenar) | elipsoid merkez (+0.032, −0.002, −0.050), yarıçaplar (0.016, 0.012, 0.036) | |

**Parmak kökleri (MCP, el yerel; hafif yay):**

| Parmak | MCP konumu | Falanks boyu prox / mid / dist | Toplam | Yarıçap prox (baş→uç) | mid | dist (uç yastık) |
| --- | --- | --- | --- | --- | --- | --- |
| index | (-0.033, +0.000, -0.088) | 0.034 / 0.024 / 0.020 | 0.078 | 0.0105→0.0095 | 0.0095→0.0088 | 0.0088→0.0080 |
| middle | (-0.011, +0.001, -0.094) | 0.038 / 0.027 / 0.021 | 0.086 | 0.0110→0.0100 | 0.0100→0.0092 | 0.0092→0.0083 |
| ring | (+0.011, +0.001, -0.090) | 0.036 / 0.025 / 0.020 | 0.081 | 0.0105→0.0095 | 0.0095→0.0088 | 0.0088→0.0080 |
| pinky | (+0.033, -0.001, -0.080) | 0.028 / 0.020 / 0.016 | 0.064 | 0.0092→0.0084 | 0.0084→0.0077 | 0.0077→0.0070 |

**Baş parmak:** CMC (el yerel) (-0.036, -0.010, -0.026); metakarp 0.048, proksimal 0.036, distal 0.030 (toplam 0.114); yarıçaplar 0.0140→0.0125 / 0.0125→0.0110 / 0.0110→0.0095.

Falanks oranları ≈ 0.44 / 0.31 / 0.25 (eski 0.43 / 0.32 / 0.25; fark ihmal edilebilir, uzunluklar mm hassasiyetiyle yuvarlandı). Parmak uzunlukları [0.078, 0.086, 0.081, 0.064] (eski [0.083, 0.103, 0.096, 0.074]): eskiler %15–20 uzun ve ince göründüğü için ("top top" eklem küreleri buna ekleniyordu) kısaltıldı; orta parmak avuç boyunun ~0.92 katı (gerçek erişkin 0.85–0.95). Kök aralığı **0.022** (eski 0.027): parmak çapı ~0.021 olduğundan köklerde 1 mm boşluk kalır; açılma (abduction) uçlarda görünür.

**Yastık noktası tanımı (temas hesabında kullanılan):** distal falanksın DIP çerçevesinde `(0, −0.55·r_uç, −0.72·L_dist)`; baş parmak için `(0, −0.55·r_uç, −0.70·L_dist)`. Yastık normali = falanksın yerel −Y.

**Dinlenme açılma açıları (`rest`, abd):** işaret −0.10, orta −0.03, yüzük +0.05, serçe +0.14 (uçta ~2–3 mm ayrık; parmaklar birbirine değmez ama boşluk hissi de yok).

## b. SDF ilkel listesi

Tüm ilkeller el şablon uzayında; birleşim `smin(a, b, k)` (polinom smooth-min). Alan işaretli uzaklık; iso-değer **0**.

| # | İlkel | Parametre | smooth-min k |
| --- | --- | --- | --- |
| 1 | Avuç: yuvarlatılmış kutu | merkez (0, 0, −0.050), yarı boyutlar (0.042, 0.013, 0.046), köşe yarıçapı 0.012 | — |
| 2 | Thenar elipsoid | merkez (−0.030, −0.004, −0.045), yarıçaplar (0.022, 0.014, 0.032) | 0.014 (avuca) |
| 3 | Hypothenar elipsoid | merkez (+0.032, −0.002, −0.050), yarıçaplar (0.016, 0.012, 0.036) | 0.012 |
| 4 | Bilek: kapsül (y ölçeği 0.6) | (0, 0, +0.014) → (0, 0, −0.024), r 0.030 → 0.028 | 0.016 (avuca; manşet altında kalır) |
| 5–16 | 4 parmak × 3 falanks kapsülü | uçlar §a tablosundaki eklem noktaları, yarıçap doğrusal (baş→uç) | falanks–falanks 0.008; proksimal–avuç 0.012 |
| 17–19 | Baş parmak 3 kapsül | metakarp / proksimal / distal | 0.009; metakarp–thenar 0.014 |
| 20–22 | Parmak arası perde (web) 3 kapsül | z −0.084, y −0.002, r 0.007; komşu MCP x'leri arasında | 0.010 |
| 23 | Baş parmak perdesi kapsülü | (−0.034, −0.006, −0.040) → (−0.052, −0.014, −0.062), r 0.009 | 0.012 |

Toplam **23 ilkel**. Eklem küreleri **yok**: eklem yuvarlaklığı kapsül uçlarının k=0.008 ile kaynamasından gelir; bu "top top" görüntüyü ve arada boşluğu kaldırır. Uç yastığı için kapsülün uç yarıçapı 0.008 (serçe 0.007) yeterli; ayrıca tırnak elipsoidi eklenmez.

**Marching cubes.** Sınır kutusu x [−0.115, +0.060], y [−0.050, +0.030], z [−0.200, +0.030] (0.175 × 0.080 × 0.230 m). Düzgün olmayan ızgara (three `MarchingCubes` küp ızgara ister; kendi MC ya da alanı küpe ölçekleyip sonra geometriyi geri ölçeklemek). Öneri:

| Kademe | Voxel | Izgara | Ham üçgen | Hedef (decimate sonrası) |
| --- | --- | --- | --- | --- |
| standard | 3.0 mm | 59 × 27 × 77 ≈ 123k hücre | ~14–18k | **≤ 5k** (3–5k) |
| low | 4.5 mm | 39 × 18 × 52 ≈ 37k hücre | ~5–6k | **≤ 1.5k** |

SDF değerlendirme 23 ilkel × 123k ≈ 2.8M işlem; Float32Array ve ayrılmış (allocation'sız) döngüde ~35–50 ms; MC ~15 ms; decimate (`SimplifyModifier` ya da vertex-clustering 2 mm) ~20 ms → **< 100 ms** hedefi standard için mümkün; low kademe ~25 ms. Geometri bir kez üretilir, her el için ayrı `Skeleton`, aynı `BufferGeometry` paylaşılır. Voxel yüzey gürültüsü ±1 mm olduğu için temas payı 2 mm tutuldu.

## c. Kemik hiyerarşisi (16 kemik)

`wrist` → {`index`,`middle`,`ring`,`pinky`} × (`proximal`,`middle`,`distal`) = 12 → + `thumb.metacarpal` (CMC), `thumb.proximal` (MCP), `thumb.distal` (IP) = 3 → **16**. Parmak metakarpları avuçla birlikte `wrist` kemiğine bağlıdır (ayrı kemik yok).

| Kemik | Orijin (ebeveyn uzayı) | Dinlenme ekseni | Serbestlik | Sınır (rad) |
| --- | --- | --- | --- | --- |
| wrist | (0,0,0) | −Z | 6 DOF (rig verir) | — |
| *.proximal (MCP) | §a MCP konumu | −Z | flex (x), abd (y) | flex 0..1.6, abd ±0.35 |
| *.middle (PIP) | (0,0,−L_prox) | −Z | flex | 0..1.9 |
| *.distal (DIP) | (0,0,−L_mid) | −Z | flex; serbest değilse **dip = 0.70·pip** | 0..1.2 |
| thumb.metacarpal (CMC) | (-0.036, -0.010, -0.026); taban Euler XYZ (-0.4101, 0.7201, 0.8503) | yerel −Z = d0 = (-0.659, -0.300, -0.689); yerel −Y = yastık normali p0 = (+0.565, -0.803, -0.191) | Euler (ex, ey, ez) | ex −1.0..1.2, ey ±0.8, ez ±2.8 |
| thumb.proximal (MCP) | (0,0,−0.048) | −Z | flex | 0..1.15 |
| thumb.distal (IP) | (0,0,−0.036) | −Z | flex | 0..1.0 |

Baş parmak `ez` (kendi ekseni etrafında dönme) kapsülde görünmez; yalnız MCP/IP bükülme yönünü ve yastık normalini belirler. Bu yüzden karşı-tutuş (opposition) için 1.5–1.9 rad gibi büyük değerlere izin verilir; tırnak eklenirse bu değerler görünür olur (tırnak yok kararının nedeni, §f).

**Skin ağırlığı kuralı.** Her köşe için 16 kemiğin kapsül eksenine (segment) olan mesafesi `d_i = |p − seg_i| − r_i` hesaplanır; en yakın **2** kemik alınır; `w_i ∝ exp(−d_i / σ)`, **σ = 4 mm**, normalize. Avuç kutusu/elipsoidleri/perde ilkellerinin içindeki köşeler `wrist`e (thenar → `wrist` 0.7 + `thumb.metacarpal` 0.3). Eklem çevresinde ±5 mm geçiş bandı: bandın dışında tek kemik ağırlığı 1.0'a yuvarlanır (bükülmede şişme olmaz). Skinning `SkinnedMesh` + `Skeleton`, `bindMatrix` şablon pozu (tüm açılar 0).

## d. Poz seti

Sayılar `d1/poses.json` ile birebir aynı (oradan üretildi). Parmak sütunları `MCP flex / abd · PIP · DIP`; baş parmak `CMC (ex, ey, ez) · MCP · IP`.

| Poz | El | index | middle | ring | pinky | thumb |
| --- | --- | --- | --- | --- | --- | --- |
| `rest` | ikisi | 0.35 / -0.10 · 0.42 · 0.29 | 0.40 / -0.03 · 0.48 · 0.34 | 0.46 / +0.05 · 0.55 · 0.39 | 0.55 / +0.14 · 0.62 · 0.43 | (+0.05, -0.20, +0.15) · 0.20 · 0.15 |
| `holdFan3` | sol | 0.41 / -0.01 · 0.32 · 0.23 | 0.45 / +0.00 · 0.32 · 0.22 | 0.44 / -0.00 · 0.31 · 0.22 | 0.40 / -0.02 · 0.31 · 0.22 | (-1.00, +0.32, +1.65) · 1.15 · 0.14 |
| `holdFan2` | sol | 0.45 / +0.01 · 0.31 · 0.22 | 0.45 / +0.00 · 0.35 · 0.25 | 0.46 / +0.01 · 0.32 · 0.23 | 0.43 / +0.01 · 0.31 · 0.22 | (-1.00, +0.30, +1.67) · 1.15 · 0.16 |
| `holdFan1` | sol | 0.46 / -0.01 · 0.32 · 0.23 | 0.48 / -0.02 · 0.34 · 0.24 | 0.48 / +0.01 · 0.33 · 0.23 | 0.44 / +0.00 · 0.33 · 0.23 | (-1.00, +0.28, +1.68) · 1.15 · 0.16 |
| `pinchCard` | sağ | 0.36 / -0.03 · 0.33 · 0.23 | 0.33 / +0.00 · 0.30 · 0.21 | 0.35 / +0.03 · 0.33 · 0.23 | 0.46 / +0.08 · 0.43 · 0.30 | (-0.93, -0.25, +1.91) · 0.02 · 0.16 |
| `openPlace` | sağ | 0.12 / -0.16 · 0.14 · 0.10 | 0.15 / -0.05 · 0.16 · 0.11 | 0.18 / +0.07 · 0.18 · 0.13 | 0.22 / +0.20 · 0.20 · 0.14 | (+0.15, -0.35, +0.15) · 0.08 · 0.05 |
| `holdBallot` | sağ | 0.36 / -0.03 · 0.33 · 0.23 | 0.33 / +0.00 · 0.30 · 0.21 | 0.35 / +0.03 · 0.33 · 0.23 | 1.02 / +0.08 · 0.96 · 0.67 | (-1.00, -0.20, +1.93) · 0.00 · 0.45 |
| `holdEnvelope` | ikisi (ayna) | 0.36 / -0.03 · 0.33 · 0.23 | 0.33 / +0.00 · 0.30 · 0.21 | 0.35 / +0.03 · 0.33 · 0.23 | 0.98 / +0.08 · 0.93 · 0.65 | (-1.00, -0.13, +1.81) · 0.00 · 0.32 |
| `restTable` | ikisi (PublicArms) | 0.60 / -0.06 · 0.80 · 0.56 | 0.65 / -0.02 · 0.85 · 0.60 | 0.70 / +0.03 · 0.90 · 0.63 | 0.78 / +0.08 · 0.95 · 0.67 | (+0.10, -0.25, +0.25) · 0.35 · 0.25 |

Poz notları:

- `rest`: gevşek, hafif kıvrık; masa üstü dinlenme (`restLeft/restRight`) ile aynı.
- `holdFan3/2/1`: sol el; kart paketi §e'deki çerçevede. 4 parmak arka yüzde, baş parmak ön yüzde pivot noktasında. Kart sayısı azaldıkça paket incelir (yarı kalınlık 0.008 → 0.006 → 0.004); parmaklar 0.02–0.03 rad daha kapanır, baş parmak IP hafif değişir. 3→2→1 geçişi bu üç poz arasında `select` süresiyle (440 ms) karıştırılır.
- `pinchCard`: sağ el seçili kartı üst kenardan tutar; işaret+orta arkada, baş parmak önde. Yüzük/serçe hafif daha kıvrık, karta 2 mm mesafede.
- `openPlace`: bırakma anında açık el (parmaklar uzamış, açılmış). `place` hareketinin son %10'unda `pinchCard` → `openPlace` → `rest`.
- `holdBallot`: sağ el oy kartını sağ kenarından yan tutuşla; `holdEnvelope`: her iki el zarfı (0.245 × 0.018 × 0.335) yan kenarlarından, sol el aynalı aynı açılar. Serçe kenarı sarar.
- `restTable`: diğer oyuncuların masaya dayalı kapalı eli (PublicArms); avuç aşağı, parmaklar yarı kapalı, baş parmak işaret parmağının yanında.

**Geçişler** (`gestureDuration` korunur; oran = süre içindeki normalize zaman, mevcut `sampleRig` anahtar noktalarıyla aynı):

| Hareket | Süre | Anahtar pozlar (t) |
| --- | --- | --- |
| draw | 1450 ms | sol: rest → openPlace (t 0–0.34, uzanma) → holdFan3 (0.34–0.62, paket çekilirken kapanır); sağ: rest → rest (0.45–1.0 küçük hareket) |
| select | 440 ms | sağ: rest → pinchCard (0–0.35 uzanma, temas 0.35'te); sol: holdFanN sabit; kart kalkışı 0.35–1.0 (0.065 m) |
| cancel | 420 ms | sağ: pinchCard → rest (0.65–1.0); kart iner 0–0.65 |
| place | 1350 ms | sağ: pinchCard sabit (0–0.90), 0.90–0.97 openPlace, 0.97–1.0 rest; sol: holdFan3 → holdFan2 (kart ayrıldığında, 0.26–0.45) |
| vote | 1150 ms | sağ: rest → holdBallot (sin eğrisi, tepe 0.5) → rest; sol: rest → openPlace (0.3) → rest |
| envelope | 1650 ms | iki el: rest → holdEnvelope (0–0.45) → rest (0.45–1.0); kapak −2.85 rad 0.10–0.53 |

Karıştırma: eklem açıları doğrusal (`smooth` easing mevcut), baş parmak Euler bileşenleri ayrı ayrı karıştırılır (ez'de 2π sıçraması yok: tüm pozlarda ez ∈ [0.1, 1.95]).

## e. Kart–el temas kuralı

**Temas noktaları (kart yerel x_c, z_c; şablon sağ el, sol elde x_c işareti ters):**

| Poz | Nesne yarı kalınlık | index (arka) | middle (arka) | ring (arka) | pinky (arka) | thumb (ön) |
| --- | --- | --- | --- | --- | --- | --- |
| `holdFan3` | 0.008 | (+0.081, +0.072) 0.5 mm | (+0.058, +0.061) 0.7 mm | (+0.036, +0.068) 0.6 mm | (+0.015, +0.091) 0.3 mm | (+0.062, +0.110) 2.0 mm |
| `holdFan2` | 0.006 | (+0.080, +0.073) 0.6 mm | (+0.058, +0.062) 1.1 mm | (+0.035, +0.069) 0.8 mm | (+0.014, +0.091) 0.5 mm | (+0.062, +0.110) 2.0 mm |
| `holdFan1` | 0.004 | (+0.080, +0.073) 0.9 mm | (+0.059, +0.062) 1.3 mm | (+0.036, +0.070) 1.2 mm | (+0.014, +0.092) 0.8 mm | (+0.062, +0.110) 2.0 mm |
| `pinchCard` | 0.004 | (-0.010, -0.088) 3.7 mm | (+0.014, -0.074) 3.2 mm | (+0.038, -0.083) 3.7 mm | (+0.061, -0.114) 5.0 mm | (+0.009, -0.125) 1.3 mm |
| `holdBallot` | 0.004 | (+0.037, -0.035) 3.7 mm | (+0.023, -0.011) 3.2 mm | (+0.032, +0.013) 3.7 mm | (+0.106, +0.033) 0.8 mm | (+0.078, -0.012) 1.9 mm |
| `holdEnvelope` | 0.009 | (+0.068, -0.035) 3.7 mm | (+0.053, -0.011) 3.2 mm | (+0.063, +0.013) 3.7 mm | (+0.134, +0.033) -0.3 mm | (+0.114, -0.014) 0.2 mm |

(mm değeri = deri yüzeyi ile kart yüzeyi arasındaki boşluk; 0–2 mm temas sayılır. Tüm pozlarda parmak gövdesinin kart sınırı içindeki en küçük boşluğu ≥ +1.8 mm; kesişme yok.)

**Kart paketinin el uzayındaki çerçevesi (şablon):**

| Poz | C (el yerel) | Euler XYZ | Arka normal (avuca doğru) | Açıklama |
| --- | --- | --- | --- | --- |
| `holdFan3` | (+0.047, -0.093, -0.197) | (-0.500, +0.000, +3.142) | (+0.000, +0.878, -0.479) | paket alt-sol köşesi (x_c +0.095, z_c +0.136) baş parmak perdesinde: el uzayı (−0.048, −0.028, −0.078); kart düzlemi avuca göre −0.50 rad eğik (üst kenar avuç içi / izleyici yönüne) |
| `holdFan2` | (+0.047, -0.093, -0.197) | (-0.500, +0.000, +3.142) | (+0.000, +0.878, -0.479) | aynı köşe; paket incelir |
| `holdFan1` | (+0.047, -0.093, -0.197) | (-0.500, +0.000, +3.142) | (+0.000, +0.878, -0.479) | aynı köşe; tek kart |
| `pinchCard` | (-0.025, -0.057, -0.232) | (-3.142, +0.000, -0.000) | (+0.000, +1.000, +0.000) | üst kenar bilekten 0.096 ileride (z −0.096), el kart merkezinin 0.025 sağında; düzlem avuca paralel |
| `holdBallot` | (+0.000, -0.057, -0.181) | (-3.142, +1.571, +0.000) | (+0.000, +1.000, +0.000) | kart sağ kenarı el uzayında z −0.086, baş parmak sütunu (kenardan 0.018 içeride) z −0.104; kart X ekseni = el +Z (parmaklar kart merkezine doğru), kart üstü = el −X (baş parmak tarafı) |
| `holdEnvelope` | (+0.000, -0.062, -0.211) | (-3.142, +1.571, +0.000) | (+0.000, +1.000, +0.000) | zarf yarı boyutları 0.1225 × 0.1675, yarı kalınlık 0.009; sağ kenar z −0.089, baş parmak sütunu (kenardan 0.015 içeride) z −0.104; sol el aynalı |

**Dünya örneği (mevcut `heldFan` [0, 0.29, 1.22], rot [1.18, 0, 0], sol el):** aynalı çerçeve C_L = (-0.047, -0.093, -0.197), Euler_L (-0.50, +0.00, +3.14) → sol el grubu **pos (-0.047, +0.093, +1.315), Euler (+0.68, -0.00, -3.14)**, çocuk `scale [−1,1,1]`. Bu, `cardGrip(card, −1)` (`offset [−0.075, −0.035, 0.175]`, curl 0.7, pinch 1) yerine geçer; sağ el için `cardGrip(card, 1)` yerine `pinchCard` çerçevesi.

**Yelpaze pivotu.** Mevcut `fanCard` pivotu kart merkez çizgisinde (0, 0, +0.108); baş parmak ise sol-alt bölgeye basar. Öneri: pivot **P = (−0.062, 0, +0.110)** (dünya kart yerel; şablonda +0.062) = baş parmak yastığı. Kartlar bu nokta etrafında Y ekseninde döner, aynı slot açısı (−0.80 rad/slot) ve y katmanı (slot·0.004) korunur:

```
a = slot · (−0.80) · (1 − raised)
position = [ P.x − (P.x·cos a + P.z·sin a) + slot·(0.021·(1−raised) + 0.13·raised),
             slot·0.004 + lift·0.45,
             P.z − (−P.x·sin a + P.z·cos a) − lift·1.4 ]
rotation = [0, a, 0]
```

Bu değişiklikle köşe etiketleri (kartın üst şeridi ve sol dikey şerit, `PhysicalCard` v 0.065–0.225 h ve 0.37 h'den itibaren) örtülmez: baş parmak yastığı kart yüksekliğinin %90'ında (v ≈ 0.90), sol kenardan %17 içeride kalır.

**İç içe geçmeyi önleme (çalışma zamanı, IK sonrası):**

1. Kart düzlemi el çerçevesine göre sabittir (yukarıdaki tablo); el kartı taşır, kart eli değil.
2. Her parmak için kapsül örnekleri (falanks başına 8 nokta) kart dikdörtgeni içindeyse `|d| − r − h ≥ 0.002` şartı; ihlalde o parmağın MCP/PIP fleksiyonu 0.02 rad adımlarla azaltılır (en çok 0.25 rad), DIP bağlaşımı korunur.
3. Kart hâlâ parmak içinden geçiyorsa (örn. çok kalın paket) kart **kendi −Y (arka) yönünde** en fazla 0.004 m ötelenir; asla el ötelenmez.
4. Baş parmak için aynı kontrol ön yüzde; ihlalde IP fleksiyonu azaltılır, sonra CMC ex 0.05 adımla açılır.
5. Yelpaze kartları arasındaki 0.004 y katmanı ve 0.008 kalınlık (paket 0.016) hesaba katılır: `h = 0.004 + 0.002·(N−1)`.

## f. Malzeme

Paletten türetim (`materials/palette.ts`: cream `#eee1c7`, walnut `#583b2b`, brass `#b49359`): ten = cream ile walnut'un ~%38 karışımı, doygunluğu hafif artırılmış → **`#c9a184`** (mevcut `#c7a181`e çok yakın; PublicArms `#bd9c7d` bununla birleştirilir).

| Bölge | Renk (vertex color) | Kural |
| --- | --- | --- |
| Taban ten | `#c9a184` | tüm avuç ve falanks gövdeleri |
| Parmak uçları / yastıklar | `#d7a08a` | distal falanks; uç 12 mm içinde 0→1 karışım (subsurface hissi) |
| Eklem sırtları (MCP/PIP) | `#bd9276` | eklem merkezinden 6 mm yarıçapta, yalnız +Y (sırt) yarısı, %40 karışım |
| Avuç içi | `#d2a58b` | y < −0.006 bölgesinde %50 karışım (avuç biraz daha pembe) |
| Tırnak | **yok** | kapsülde ez dönmesi görünür olurdu; low kademede de gereksiz; ileride isteğe bağlı düz elips decal |

`MeshStandardMaterial { vertexColors: true, roughness: 0.72, metalness: 0 }`; gölge `castShadow` standard'da açık, low'da kapalı. Sırt tarafında hafif fresnel istenirse `envMapIntensity 0.35` yeter; SSS shader yok.

**Kol / manşet geçişi.** Kol ve manşet mevcut malzemelerle kalır: ceket `#354f49` roughness 0.91, manşet `#e1d4b8` roughness 0.86. Bilek kapsülü (ilkel #4) manşet silindirinin (r 0.046, boy 0.062) içinde 0.010 m örtüşür; manşet merkezi bilekten `−0.075·dir`, bilek silindiri (`#c9a184`, r 0.034–0.039) kaldırılır — yerini el mesh'inin bilek ucu alır. PublicArms'ta kol + manşet + el tek `mergeGeometries` ile birleşir (vertex color).

## g. Kalite kademeleri

| | standard | low |
| --- | --- | --- |
| Voxel | 3.0 mm | 4.5 mm |
| Üçgen (el başına, paylaşımlı geometri) | ≤ 5k | ≤ 1.5k |
| Kemik | 16 | 16 (aynı iskelet, aynı poz verisi) |
| Skin | 2 ağırlık/köşe | 2 ağırlık/köşe (aynı) |
| Gölge | castShadow açık | kapalı |
| Vertex color gradyanı | var | var (ucuz) |
| PublicArms (N−1 oyuncu × 2 el) | low geometri, `restTable` pozu statik → skin yerine pozlanmış geometri bir kez pişirilir, `InstancedMesh` (1 çizim) | aynı |
| Çizim çağrısı | el başına 1 (mesh) + kol/manşet 1 = **2** | 2 |

## h. Kabul ölçütleri (koltuk kamerası)

Kamera: `SeatCamera` koltuk göz noktası (chair.x, 0.60, chair.z + 0.035), yelpaze (0, 0.29, 1.22); eller ~0.85 m uzakta, ekranda ~%25 yükseklik.

1. **Eklem boşluğu yok:** dev sayfasında yakın plan (`inspect` modu) `holdFan3`, `pinchCard`, `holdBallot` karelerinde falanks birleşimlerinde görünür yarık/küre yok; siluet tek parça.
2. **3→2→1 kart:** `select`/`place` sonrası sol el `holdFan3 → holdFan2 → holdFan1` geçişi 440/1350 ms içinde; her ara karede kart parmak içinden geçmez (kural §e-2, konsolda `fpHandPenetration=0` veri özniteliği).
3. **Kart–parmak teması:** dört parmak yastığı arka yüzde, baş parmak ön yüzde; ölçülen boşluk 0–2 mm (§e tablosu); kartın alt-sol köşesi baş parmak perdesine 2 mm mesafede.
4. **Çizim çağrısı:** el başına ≤ 2 (`renderer.info.render.calls` farkı, eller açık/kapalı).
5. **Üretim süresi:** SDF + MC + decimate + skin ağırlığı toplamı standard'da < 100 ms (performance.now, dev sayfasına yazılır), low'da < 40 ms.
6. **Genel masa (overview):** low kademede 8 oyuncu × 2 PublicArms eli tek `InstancedMesh`; siluet aynı stil (avuç oranı, ten rengi).
7. **Önce/sonra:** `docs/qa/claude/d1/` altına koltuk kamerası yakın plan ekran görüntüleri (rest, holdFan3, selected/pinchCard, vote, envelope).

## Mevcut modelden başlıca farklar

1. Bölütlü kapsül + küre (14 kemik kapsülü, 6 küre, 4 silindir; instanced 3 çizim) → **tek SDF birleşimi mesh + 16 kemikli SkinnedMesh**; eklem küreleri ve aradaki boşluklar kalkar.
2. Parmak boyları kısaldı ([0.083, 0.103, 0.096, 0.074] → [0.078, 0.086, 0.081, 0.064]), kök aralığı 0.027 → 0.022, kökler yay üzerinde; avuç elipsoidi (0.126 × 0.047 × 0.140) → yuvarlatılmış kutu 0.084 × 0.026 × 0.092 + thenar/hypothenar.
3. Baş parmak 2 kemik (0.050 + 0.040, kökte sabit dönme) → **3 kemik + 3 DOF CMC** (0.048 + 0.036 + 0.030); karşı-tutuş (opposition) mümkün, yastık karta bakar.
4. Tutuş, `curl/pinch` skalerleri yerine **poz başına eklem açı tablosu**; kart eli değil, el kartı taşır: kart düzlemi el uzayında sabit çerçeve (§e). `cardGrip` ofsetleri (sol [−0.075, −0.035, 0.175], sağ [0.035, −0.035, 0.175]) kalkar.
5. Yelpaze pivotu kart merkezinden (0, 0, 0.108) baş parmak yastığına (−0.062, 0, 0.110); paket alt-sol köşesi baş parmak perdesinde, kart düzlemi avuca göre −0.50 rad eğik → kartlar parmak içinden geçmez, baş parmak önde / parmaklar arkada.

## Riskler

- Kart 0.19 × 0.272 × **0.008** m (gerçek oyun kartının ~3 katı boyut, 2.5 katı kalınlık); 3 kart paketi 0.016. Baş parmak erişimi bu kalınlıkla sınırda: yelpazede baş parmak MCP 1.15 (sınır), CMC ex −1.0 (sınır). Kart kalınlığı 0.005'e inerse açılar rahatlar.
- Yelpazede parmaklar orta kıvrımlı (MCP ~0.45, PIP ~0.32); RDR2'deki gibi daha kapalı parmaklar için kart düzlemini avuçtan uzaklaştırmak gerekir, o zaman baş parmak ulaşamaz. Stilize uzlaşma bu.
- `pinchCard` / `holdBallot` / `holdEnvelope` düz parmaklı (MCP ~0.35) "yassı" tutuşlar; parmak yastıkları 2–4 mm mesafede (yalnız orta parmak ve baş parmak tam temas). Gerekirse IK ile 2 mm'ye çekilir.
- MC yüzey gürültüsü ±1 mm; 2 mm pay bunun için. Decimate eklem çevresinde köşe kaybederse bükülmede köşe görünebilir → decimate'te eklem bandı (±5 mm) korunur.
- Baş parmak ez = 1.55–1.95 rad ile bükülme yönü doğru ama tırnak/deri kırışığı gibi asimetrik ayrıntı eklenirse burulma görünür.
- Skinning: baş parmak perdesi (ilkel #23) `wrist` ile `thumb.metacarpal` arasında; büyük CMC açılarında gerilme olur, ağırlık 0.7/0.3 ile sınırlı.
- Üretim süresi tarayıcıya bağlı; low kademede voxel 4.5 mm el siluetini yumuşatır (parmak arası perde kalınlaşır).
