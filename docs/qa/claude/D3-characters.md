# D3.2–D3.3 — prosedürel karakterler (teslim, 2026-09-11)

Şartname: `docs/design/D3-characters.md` + `docs/design/d3/characters.json` (değiştirilmedi).
Kod: `packages/scene/src/characters/**` (yeni), `packages/scene/src/sdf/primitives.ts` (yeni,
D1 ile paylaşılan ilkeller). Sözleşme (`packages/contracts`) değişmedi, yeni bağımlılık yok.

## 1. Ne yapıldı

- **Boru hattı** (D1 elleriyle aynı, kopya yok): `characters.json` → ilkel listesi (§b 23 taban +
  §d aksesuar grupları, kesme düzlemi/çıkarma) → `smin` birleşimi → `marchField` → `clusterDecimate`
  → köşe renk + 8 kemik skin + yüz UV/malzeme grubu → tek `SkinnedMesh`.
  Genel SDF ilkelleri `hands/sdf.ts` içinden `sdf/primitives.ts`'e taşındı; `hands/sdf.ts` onları
  yeniden dışa aktarıyor (D1 API'si ve 22 D1 testi aynen geçiyor). `sdTorus`, `smax`, `boxLower2`
  ve `inverseEulerXYZ` eklendi. `marchingCubes.ts`'e simetrik **iç eleme** eklendi (blok tamamen
  derin içerideyse atlanır) — D1'i etkilemez, D3'te alan çağrılarını ~%17 azaltır.
- **Modüller:** `spec.ts` (tip güvenli JSON + koltuk→karakter eşlemesi + etiket tablosu),
  `field.ts` (`characterField`, `evalPrim`, `nearest2`), `colors.ts` (§e giysi kuralları),
  `skeleton.ts` (8 kemik + skin), `face.ts` (`FaceTexture`, 4 ifade, kırpma), `geometry.ts`
  (üretim + iki katmanlı önbellek), `CharacterAvatar.tsx`, `CharacterGallery.tsx` (yalnız dev).
- **Sahne:** `ArticulatedAvatar.tsx` **silindi**; `TableScene` ve prototip sahne `CharacterAvatar`
  kullanıyor. Koltuk kamerası göz 0,56 → **0,47**, serbest bakış 0,60 → **0,51**; etiket 0,48 →
  **karaktere göre 0,745–0,865**; `TargetZone` **[0,64, 1,00, 0,52] @ y 0,20**; karakter grubu
  koltuk grubunun altında **y −0,305**. Genel masa kamerası değişmedi.
- **`PublicArms`:** kolluk + manşet silindirleri gövde mesh'ine taşındı (giysi rengi);
  bileşen yalnız D1 elini çiziyor, **×1,15** ölçekli, iki el TEK geometride (sol el sarım yönü
  düzeltilerek) → oyuncu başına 1 çizim. Bilek noktası (±0,220·t, 0,035, −0,324) değişmedi.
- **Karakter seçimi:** B3 gelene kadar koltuk sırasından (`avatarForSeat`); `parseAvatar()`
  `"fotr:2"` biçimini çözecek şekilde hazır bekliyor. Sözleşmeye alan EKLENMEDİ.
- Eleme (`player_eliminated` → gri ton + `Motion`) ve bağlantı yok davranışı korundu;
  baş yönü kanalı boyun %40 / baş %60'a dağıtıldı, `fpHeadYaw{index}`/`fpHeadPitch{index}`
  veri öznitelikleri aynı adla yazılıyor.

## 2. Sayılar (Chrome/Metal, 1440×900 @2x, dev sunucu 5199)

| Ölçü | standard | low |
| --- | --- | --- |
| Voxel | **8 mm** (şartname 6 mm) | **11 mm** (şartname 9 mm) |
| Ham üçgen (MC) | 81–90 k | ~40 k |
| Sadeleştirilmiş üçgen / karakter | **12,2 – 13,7 k** (hedef ≤ 6 k) | **6,3 k** (hedef ≤ 2,5 k) |
| Üretim (SDF+MC+seyreltme+renk+skin) | **460 – 520 ms** (hedef < 120 ms) | **110 ms** |
| Çizim / oyuncu | **3** (gövde 1 + yüz 1 + eller 1) ✔ | 3 ✔ |
| Yüz tuvali | 512×256 | 256×128 |

Sahne toplamı (aynı fixture, önce = eski `ArticulatedAvatar`):

| Kare | Çizim önce → sonra | Üçgen önce → sonra |
| --- | --- | --- |
| Koltuk, 7 kişi (`nomination`) | 166 → **161** | 89.222 → **231.924** |
| Genel masa, 10 kişi (`table-size-10`) | 217 → **197** | 115.228 → **342.360** |
| Genel masa, 10 kişi, `quality=low` | — | **106.856** (112 çizim) |

**FPS (CPU 4× yavaşlatma, 5 s sürükleyerek bakış, koltuk kamerası, 7 kişi):**
önce **59,9** → sonra **59,8** (CPU 1×: 60,1 → 60,0). Gerileme yok; çizim sayısı düştü.
Genel masa kamerasında `frameloop="demand"` altında kamera hareket etmediği için ölçülen
"fps" gerçek bir kare hızı değildir, o satır rapora alınmadı.

## 3. Testler ve kontroller (gerçekten çalıştırıldı)

- `pnpm -r typecheck` → 6/6 paket temiz.
- `pnpm test` → **526 test** geçti (önce 495; `characters.test.ts` 31 yeni test).
  Kapsam: şartname bütünlüğü (8 karakter/3 ten/23 ilkel/8 kemik), koltuk→karakter eşlemesi ve
  `parseAvatar`, etiket yüksekliği tablosu, ağız kayması, torus SDF, 8×3 alan üretimi, kesme
  düzlemi davranışı, kademe süzgeci, `bodyScale`, kapalı yüzey (`boundaryEdges === 0`), üçgen
  bütçesi + 2 malzeme grubu, ten paylaşımlı önbellek, yüz UV aralığı, **kemik ağırlıkları
  toplamı 1** ve indis < 8, kemik zinciri/omuz ölçeği, §c bölge→kemik kuralları, 5 giysinin renk
  kuralları, parti rengi uzaklığı, 4 ifade parametresi, kırpma zaman çizelgesi, masa tablası
  kesişmemesi ve siluet genişliği.
- `pnpm --filter @secret-table/web build` → geçti (`three` 761 kB, giriş grafiği değişmedi).
- Güncellenen mevcut test: `layout/presentation.test.ts` etiket `y` artık sabit 0,48 değil,
  `labelHeight(avatarForSeat(seatIndex).character)` (≥ 0,745) bekliyor.
- Konsol hatası yok (bütün kare betiklerinde `pageerror`/`console.error` dinlendi).

## 4. Görsel kanıt (`docs/qa/claude/d3/`)

| Dosya | İçerik |
| --- | --- |
| `before-seat.png`, `before-overview.png`, `before-overview-10p.png`, `before-phone-seat.png` | Kod değişmeden, eski avatarlar |
| `after-seat.png`, `after-overview.png`, `after-overview-10p.png`, `after-phone-seat.png` | Yeni karakterler, yeni kamera/etiket |
| `gallery.png` | 8 karakter yan yana (`/dev/characters?mode=lineup`) |
| `faces.png` | Kepli Çocuk, 4 ifade (`mode=faces`) |
| `skins.png` | Topuzlu, 3 ten (`mode=skins`) |
| `after-eliminated.png` | Elenen oyuncu gri tonda |
| `after-disconnected.png` | Bağlantısı kopan oyuncu (baş nötre döner) |
| `after-overview-10p-low.png` | `quality=low`, 10 kişi |

Betikler: `scratchpad/d3-shots.mjs`, `scratchpad/d3-gallery.mjs`, `scratchpad/d3-perf.mjs`
(dev sunucu `pnpm --filter @secret-table/web dev --port 5199 --strictPort`; 5173'e dokunulmadı).
Dev görünümü `/dev/characters?mode=lineup|faces|skins&character=…&skin=…` — yalnız
`import.meta.env.DEV`, oyun verisi/ağ/rol yok.

## 5. Şartnameden sapmalar (gerekçeli)

1. **Voxel 6 → 8 mm, üçgen ≤ 6 k → ~13 k, üretim < 120 ms → ~0,5 s.**
   §g bütçesi QEM sadeleştirme (`meshoptimizer` WASM) varsayıyor; görev "yeni bağımlılık yok"
   dediği için D1'in **köşe kümeleme** seyreltmesi kullanıldı. Kümeleme aynı görsel kalite için
   QEM'in ~2 katı üçgen ister; 6 k'ya inmek için hücre ~28 mm olmalı ve yüz/yaka okunmaz hâle
   geliyor. Ham üçgen de tahminin 2 katı çıktı (6 mm'de 144–161 k, tahmin 70 k), bu yüzden
   görev talimatı uyarınca **8 mm**'e inildi ve raporlanıyor. Ölçülen alternatifler (fötr):
   6 mm → 1.083 k alan çağrısı / 853 ms; 7 mm → 769 k / 694 ms; 8 mm → 586 k / 485 ms.
   `quality=low` kademesi (11 mm, 6,3 k üçgen, 110 ms) şartnamenin **standard** bütçesini
   zaten tutturuyor; QEM eklenirse standard da tutar.
2. **Renk sınırlarında yumuşatma.** §e "gradyan yok" diyor; köşe rengi hücre boyu kadar
   (≈15 mm) zikzak ürettiği için (a) ön bölge kurallarında ±16 mm, (b) iki ilkelin sınırında
   ±14 mm karışım bandı eklendi. §e'nin "V ve şerit kenarında 1 üçgen tolerans" notunun
   uygulaması; sınır yumuşak, alanların düz rengi korunuyor.
3. **`shoulders` kapsülü gövde sayılıyor.** §e "shoulders/deltoid" sütunu yelekte krem; ama
   `shoulders` kapsülü göğsün tamamını (x ±0,19) kestiği için üst göğse krem bant boyuyor ve
   `chest` ile yarışıp yırtık sınır üretiyordu. Yalnız `deltoid.L/R` omuz yuvasına bağlandı;
   `shoulders` V yaka kuralına girdi. Silüet §d çizimiyle aynı, yelek üst sınırı temiz.
4. **Kesme düzlemi yalnız grubun ilk ilkeline uygulanıyor.** §d'de kesme kubbeyi/saç kapağını
   biçimlendiriyor; bütün gruba uygulanınca kep siperliği (y 0,85 < kesme 0,86) ve favoriler
   siliniyordu. Her aksesuarda ilk ilkel zaten kubbe/kapak.
5. **V yaka yukarı açık.** §e "V kenarı yeleğin üst sınırıdır (y 0,56 üstü gömlek)" notu
   uygulanıyor: V kuralı y1 üstünde kapanmıyor, gömlek boyuna kadar sürüyor.
6. **`PublicArms` iki eli tek geometride birleştiriyor** (§g "tüm oyuncular 1 InstancedMesh"
   yerine "oyuncu başına 1 mesh"). Koltuk grubu oyuncu başına döndüğü için tek global
   `InstancedMesh` yapılamıyor; çizim bütçesi (≤ 3/oyuncu) yine tutuyor.

## 6. Açık noktalar

- **Bordo (`#7a2a3a`) ve D10 `fascistDeep` (`#7e332f`)** sRGB'de ~0,06 uzaklıkta, ton farkı ~15°;
  §e'nin uyardığı en yakın çift. Yelek her zaman krem gömlekle çerçeveli ve sahnedeki gerçek
  parti renkleri (`palette.fascist #a94743`, kart/rozet dili) uzak kalıyor (test bunu doğruluyor).
  `after-overview.png`'de tahtanın yanında kontrol edildi; kullanıcı uygun görmezse §e yedeği
  `#6f2d49` (mürdüm) tek satırlık JSON değişikliği — **tasarım sahibinin kararı**.
- **Eller karakterin ten tonunu almıyor.** D1 el geometrisi tek ten paletiyle (`#c9a184`)
  pişiyor; 3 ten için `bakedPose` renk özniteliğinin tonlanması gerekir (küçük iş, D3.5'e).
- **Kepli Çocuk'un kaşları kep kenarının altında kalıyor** (kaş y 0,858–0,864, kep kesme
  düzlemi 0,86). Şartname sayıları korundu; kep 1–2 cm yükseltilirse açılır.
- Üretim hâlâ ana iş parçacığında ve tek seferde (oda girişinde karakter başına ~0,5 s).
  §g'nin `requestIdleCallback` kuyruğu / Web Worker seçeneği **yapılmadı** — D3.5 işi.
- Kıvırcık karakterinde fular halkası çenenin altında büyük ölçüde gizleniyor; yalnız kuyruk
  okunuyor.
- Gerçek cihaz FPS'i ve dokunmatik kabulü ölçülmedi (masaüstü Chrome/Metal).


---

# Tur 2 — cila (2026-09-11)

Koordinatörün dört maddesi. Tur 1 sayıları yukarıda; aşağıdaki tablolar **tur 2 sonrası**.

## T2.1 Yüzey pürüzü — Taubin yumuşatma

`hands/marchingCubes.ts` → `taubinSmooth(mesh, iterations, λ = .5, μ = −.53, pinned)`
(+ `vertexNormals`). Köşe kümeleme sonrası uygulanır: **üçgen ve köşe sayısı değişmez**,
λ/μ çifti büzüşmeyi geri alır, normaller yeniden hesaplanır.

- **Sabitlenen köşeler:** en yakın ilkelinin en ince yarıçapı < **21 mm** olan her köşe
  (`primThinness`): gözlük teli, zincir, kep siperliği, burun, ince bıyık, favori, düğme,
  papyon, yaka. Yumuşatma bunları eritmiyor.
- İterasyon: standard **3**, low **2**.
- Bedel: karakter başına ~20 ms (komşuluk CSR + 2×iterasyon geçiş).

## T2.2 Yüz dokusu

- Standard tuval **512×256 → 1024×512** (low 512×256), `anisotropy` 4 → 8.
- **Kaş tavanı:** `browShift()` — kaşın üst kenarı, yüz grubunun görünen üst kenarının
  (`build.faceTop`, geometriden ölçülür) 26 mm altına iner (en çok 20 mm). Şapkasız
  karakterlerde 0, kepli çocukta −15 mm. Kaşlar artık kep kenarına girmiyor.
- **Kep 30 mm yükseltildi** (`ACCESSORY_LIFT.cap`): §d kesme düzlemi y 0,86, kaş bandı
  0,858–0,872 — kep tam kaşın üstüne oturuyordu. Bütün kep ilkelleri + kesme düzlemi +
  etiket yüksekliği birlikte kaydı (etiket 0,765 → 0,795). `docs/design/**` değişmedi.
- **Çil** r 6 → **4 mm**, 10 → **8 nokta**, α ×0,85 (yakın planda leke gibi okunuyordu).
- **Gözlük halkası artık gözün merkezinde ve temiz:** halka/sap/köprü/zincir SDF'ten
  çıkarıldı, §d'nin kendi alternatifiyle **gerçek torus + silindir geometrisi** olarak aynı
  `BufferGeometry`'ye eklendi (head kemiğine 1,0 ağırlık, UV 0 → gövde grubu).
  **Ek çizim çağrısı yok** (oyuncu başına hâlâ 3). 8 mm tel 9 mm voxelde lekeye dönüyordu.

## T2.3 Yükleme süresi

- **Üretim kuyruğu** (`requestCharacterGeometry`): ilk kare **low** kademeyle çizilir,
  standard üretim karakter başına ayrı bir `requestIdleCallback` diliminde sırayla yapılır
  ve hazır olunca geometri değişir. Modül düzeyinde tek kuyruk → 10 oyuncu aynı karede
  10 üretim tetiklemiyor.
- **Standard voxel 8 → 9 mm**, hücre 24 → 28 mm (koordinatörün hedefi: ≤ 9 k üçgen).

| Ölçü | Tur 1 | **Tur 2** |
| --- | --- | --- |
| Standard voxel / hücre | 8 mm / 24 mm | **9 mm / 28 mm** |
| Standard üçgen / karakter | 12,2 – 13,7 k | **8,9 – 10,1 k** |
| Standard üretim / karakter | 460 – 520 ms | **355 – 465 ms** |
| Low üçgen / üretim | 6,3 k / 110 ms | **6,7 k / 103 ms** |
| İlk kare, 10 kişi, genel masa | 2.377 ms (senkron) | **1.720 ms** (kuyruk) |
| İlk kare, 10 kişi, koltuk | 2.663 ms (senkron) | **1.999 ms** (kuyruk) |
| Koltuk 7 kişi: çizim / üçgen | 161 / 231.924 | **161 / 190.848** |
| Genel masa 10 kişi: çizim / üçgen | 197 / 342.360 | **197 / 218.716** |
| Genel masa 10 kişi `low` | — | **112 çizim / 106.998 üçgen** |
| Koltuk FPS (CPU 4× / 1×) | 59,8 / 60,0 | **59,8 / 60,0** |

Senkron ölçüm, kuyruk geçici olarak kapatılıp aynı betikle alındı (`/tmp` betiği,
kod geri alındı). Kuyruk ilk kareyi ~0,65 s kısaltıyor; asıl kazanç standard üretimin
tek blokta değil, karakter başına ayrı dilimde yapılması.

## T2.4 Eller karakterin ten tonunu alıyor

`PublicArms` → `tintToSkin()`: D1 elinin köşe renkleri lineer uzayda
`hedefTen / SKIN.base` oranıyla çarpılır — yastık/boğum/avuç ton farkları korunur,
temel ton `characters.json` `skins` girdisine kayar. Geometri önbelleği artık
`omuzÖlçeği:ten` anahtarlı.

## Tur 2 testleri

`pnpm test` → **532** (tur 1: 526; 6 yeni test + 3 güncellenmiş).
Yeni: Taubin köşe/üçgen sayısını korur ve büzüştürmez + yüzey pürüzü azalır; sabitlenen
köşe yerinde kalır; ince teller mesh'e eklenir ve head kemiğine 1,0 bağlanır, ek malzeme
grubu açmaz; `browShift` şapkalıda iner şapkasızda inmez; üretim kuyruğu önbellekte
eşzamanlı, değilse boşta dilimde; standard kademe 9 mm / ≤ 10,5 k / 1024×512.
Güncellenen: etiket yüksekliği (kep +30 mm), kep siperliği alanı, kademe süzgeci
(gözlük artık `wires` içinde).

`pnpm -r typecheck` 6/6 · `pnpm --filter @secret-table/web build` geçti · konsol hatası yok.

## Tur 2 kareleri

`after2-{seat,overview,overview-10p,phone-seat,gallery,faces,skins,eliminated,overview-10p-low}.png`.
Galeri artık soldan sağa şartname sırasında (kamera −Z tarafında olduğu için x işareti ters).
`after2-faces.png` Kepli Çocuk'un 4 ifadesi — ağız `grin` §e gereği sabittir, ifade farkı
kaş/göz/kapakta okunur.

## Tur 2 sonrası açık kalanlar

- Standard üçgen 8,9–10,1 k (§g hedefi 6 k): QEM sadeleştirme olmadan bu sınır.
- Üretim hâlâ ana iş parçacığında (kuyruklu). Web Worker yapılmadı.
- V yaka / hırka şeridi kenarı ±16 mm yumuşatmalı; keskin kenar için o bölgede daha ince
  hücre (üçgen +%40) gerekir.
- Kıvırcık karakterinde fular halkası çenenin altında büyük ölçüde gizli.
- Bordo ↔ D10 `fascistDeep` yakınlığı (tur 1 notu) hâlâ tasarım kararı bekliyor.

---

# Tur 3 — netlik (2026-09-11)

Kullanıcı reddi: koltuk kamerasından yan komşuya bakınca (≈1,2–1,5 m) karakterler
"hiç net değil, 240p gibi"; gövde/baş yüzeyinde fasetler, yüz dokusu bulanık,
ince aksesuarlar leke. Aşağıdaki dört madde bu karede çalışıldı.
`packages/contracts/**` ve `docs/design/**` değişmedi, yeni bağımlılık yok, commit yok.

## T3.1 Pürüzsüz gölgeleme — normaller SDF gradyanından

Asıl kusur normal hesabıydı, üçgen sayısı değil: `taubinSmooth` köşe normalini
**üçgen komşuluğundan** (alan ağırlıklı) üretiyordu. 24–28 mm'lik seyreltilmiş
üçgenlerde bu, doğrudan faset/yumru demektir.

- `hands/marchingCubes.ts` → **`gradientNormals(positions, field, h)`**: köşe
  normali alanın merkezi farkından (h = voxel/2 = 3,5 mm), köşe başına 6 alan
  çağrısı. Üçgen sayısından bağımsız, gerçek yüzey normali.
- `hands/marchingCubes.ts` → **`projectToSurface(positions, field, h, n, maxStep, pinned)`**:
  Newton adımı `p ← p − f·∇f/|∇f|²`, standard 2 / low 1 iterasyon, adım
  hücrenin yarısıyla sınırlı. Kümelenmiş köşeler iso-yüzeye geri çekilir.
- **Sıra:** MC → kümeleme → **yansıtma** → Taubin → **gradyan normalleri**.
  Görev "kümeleme ÖNCESİ ham köşeleri yansıt" diyordu; yansıtma kümeleme
  SONRASINA alındı çünkü (a) hedef "kümelenmiş köşeler yüzeyden sapmasın"dır ve
  sapmayı yaratan şey kümenin ORTALAMASIDIR — yüzeydeki 4 noktanın ortalaması
  dışbükey yerde hâlâ içeridedir, ham köşeleri yansıtmak bunu düzeltmez;
  (b) ham köşe sayısı ~55 k, kümelenmiş ~6,8 k → aynı iş 8 kat ucuz.
  Ölçüm: kümelenmiş küre köşelerinde |f| en çok 1,9 mm → yansıtma sonrası
  **< 0,1 mm** (test 0,5 mm sınırını doğruluyor).
- **Standard voxel 9 → 7 mm, hücre 28 → 24,5 mm** (üçgen ≤ 14 k sınırı içinde).
  Ölçülen alternatif: 8 mm voxel aynı üçgeni %22 daha ucuza veriyor
  (497 ms / 12,9 k); görev 7 mm istediği için 7 mm bırakıldı, kaldıraç açık.
- Low kademe 12 mm / 34 mm kaldı; yansıtma + gradyan normali orada da AÇIK
  (köşe sayısı 1/4 olduğu için bedeli karakter başına ~30 ms).

## T3.2 Yüz dokusu

- **Standard tuval 1024×512 → 1024×768.** §f penceresi 400 × 320 mm; 2:1 tuval
  dikeyde 0,80 px/mm, yatayda 1,28 px/mm veriyordu, yani **dikey çözünürlük
  yatayın 0,63 katıydı** ve göz/kaş kenarı dikeyde bulanıktı. 4:3 tuvalde
  yoğunluk x 2,56 / y 2,40 px/mm (fark %7). `drawFace(ctx, width, height, p)`
  artık iki ekseni ayrı ölçekliyor; model üstündeki şekiller değişmez.
  Koltuk kamerasından yan komşu (1,2 m, fov 40°, dpr 1,5) yüz penceresini
  ~620 × 495 px kaplar → doku her iki eksende de ≥ 1,25 kat örneklenmiş.
- **`anisotropy` 8 → renderer max**; `gl.capabilities.getMaxAnisotropy()`
  `CharacterAvatar`'dan geçiriliyor, Metal/ANGLE'da ölçülen değer **16**.
  `generateMipmaps` açık (artık açıkça yazılı), `minFilter`
  `LinearMipmapLinearFilter`, `magFilter` `LinearFilter`, `SRGBColorSpace`.
  `needsUpdate` her ifade/kırpma karesinde (anahtar aynıysa çizim yok) — korundu.
- Low tuval 512×256 → **512×384** (aynı oran düzeltmesi).

## T3.3 Aksesuar netliği

- **Gözlük/zincir:** torus 6×18 → **8×28**, silindir 8 → **12** dilim. Tel
  yarıçapları §d'deki gibi (halka 8 mm, köprü 7 mm, sap/zincir 6 mm ⇒ görünür
  kalınlık 12–16 mm). Yakın planda halka artık köşeli değil; ~1,2 k üçgen ekler.
- **Sakal/bıyık gövdeye daha sıkı katılıyor:** `region: facial` gruplarında
  gövde birleşim k'sı `min(k, 18 mm)` (dolgun sakalda §d 30 mm idi). Grubun
  KENDİ içindeki k'lar değişmedi, sakal tek kütle kalıyor; siluet gövdeden
  ayrık okunuyor (`after3-gallery.png` turuncu bereli ve fötr).
- Saç tepesi/kep kubbesi pürüzsüz (T3.1 gradyan normali).

## T3.4 Malzeme

- `flatShading` projede hiçbir yerde kullanılmıyor (arandı) → kapalı, doğrulandı.
- `roughness` .85, `metalness` 0 aynı; iki malzeme yalnız `map` ile ayrılıyor.
- Renk sınırı bandı (vertex renk zikzağı) `FEATHER` 16 → **22 mm**,
  `COLOR_FEATHER` 14 → **20 mm**: band bir köşe aralığından (14,7–24,5 mm) dar
  kalınca t değeri komşu köşelerde 0/1'e doyuyor ve kenar testere dişi yapıyor.
  İsteğe bağlı SSS tonlaması YAPILMADI (kapsam dışı bırakıldı).

## Sayılar

Üretim süreleri ve üçgenler aynı vitest ölçüm koşumunda (8 karakter, `orta` ten);
sahne sayıları Chrome/Metal (M2), 1440×900 @2× isteme, dev sunucu 5199.

| Ölçü | Tur 2 | **Tur 3** |
| --- | --- | --- |
| Standard voxel / hücre | 9 / 28 mm | **7 / 24,5 mm** |
| Standard üçgen / karakter | 8.888 – 10.172 | **11.904 – 13.710** |
| Standard üretim / karakter | 319 ms (tarayıcı 356) | **628 ms** (tarayıcı 687) |
| Low üçgen / üretim | 5.954 – 6.888 / 186 ms | **5.954 – 7.268 / 215 ms** |
| Yüz tuvali (standard) | 1024×512 | **1024×768** |
| Yüz dokusu belleği, 10 kişi | 21,0 MB (+mip 28,0) | **31,5 MB (+mip 41,9)** |
| Anizotropi | 8 | **16** (renderer max) |
| Çizim / oyuncu | 3 | **3** (değişmedi) |
| Koltuk 7 kişi: çizim / üçgen | 161 / 190.848 | **161 / 232.196** |
| Koltuk 10 kişi: çizim / üçgen | 186 / 262.198 | **188 / 327.130** |
| **Koltuk 10 kişi FPS, CPU 4× / 1×** | 59,9 / 59,8 | **59,8 / 60,1** |
| Koltuk 7 kişi FPS, CPU 4× | 59,8 | **59,8** |
| İlk kare, 10 kişi (koltuk / genel) | 1.787 / 1.671 ms | **1.866 / 1.801 ms** |

FPS gerilemesi yok; artan üçgen GPU tarafında ölçülebilir bir etki yapmadı.
Üretim maliyeti karakter başına ~2 kat arttı ama tamamı `requestIdleCallback`
kuyruğunda; ilk kareye etkisi +80/+130 ms (low kademe yer tutucusu aynı yolda).

## Testler ve kontroller (gerçekten çalıştırıldı)

- `pnpm -r typecheck` → 6/6 temiz.
- `pnpm test` → **554** (tur 2: 547). Scene 203 → 210, 7 yeni/1 güncellenmiş test:
  gradyan normali birim uzunlukta ve küre normaliyle ≤ 0,81°; seyreltilmiş kürede
  gradyan hatası < 0,5° ve alan normalinin ≥ 4 katı daha iyi; Newton yansıtma
  sonrası |f| < 0,5 mm; yansıtma sabitlenen köşeye dokunmaz ve `maxStep`'i aşmaz;
  yüz tuvalinin oranı UV penceresinin oranını ±%10 içinde izler + boyut/filtre/
  anizotropi/mipmap/renk uzayı + aynı anahtarda yeniden çizim yok; `drawFace`
  dönüşümü iki eksende ayrı ölçeklenir ve zemin tuvalin tamamını kaplar;
  sakal/bıyık birleşim k'sı 18 mm, grup içi k ve saç grupları etkilenmez.
  Güncellenen: "standard kademe" testi (7 mm / ≤ 14 k / 1024×768 / low 512×384).
  Testler node ortamında koştuğu için `FaceTexture` kaydedici tuval saplamasıyla
  kuruluyor (yeni bağımlılık yok).
- `pnpm --filter @secret-table/web build` → geçti (`three` parçası değişmedi).
- Bütün kare/ölçüm koşumlarında `pageerror`/`console.error` dinlendi → hata yok.

## Kareler (`docs/qa/claude/d3/`)

Betikler: `scratchpad/d3-shots3.mjs`, `scratchpad/d3-perf3.mjs`,
`scratchpad/d3-firstframe3.mjs` (port 5199, `--strictPort`; 5173'e dokunulmadı,
sunucu kapatıldı). `before3-*` kareleri aynı betikle, tur 2 kodu `git stash`
ile geri alınarak, aynı kadrajda alındı.

| Dosya | İçerik |
| --- | --- |
| `before3-neighbor-close.png` / `after3-neighbor-close.png` | **Ana kanıt:** koltuk kamerası, bakış sağa ~50°, sağdaki komşu ~1,3 m |
| `before3-/after3-neighbor-close-left.png` | Aynı kadraj, bakış sola ~50° |
| `before3-/after3-seat.png` | Koltuk kamerası, ileri bakış (7 kişi) |
| `before3-/after3-overview-10p.png` | Genel masa, 10 kişi |
| `before3-/after3-gallery.png` | 8 karakter yan yana (`/dev/characters?mode=lineup`) |
| `before3-/after3-faces.png` | Kepli Çocuk, 4 ifade |

## Tur 3 sonrası açık kalanlar

- **Vertex renk sınırları hâlâ testere dişi.** Ceket V yakası, hırka şeridi ve
  saç/ten sınırı köşe ızgarasına (14,7–24,5 mm) çakılıyor; band genişletmek
  kenarı yumuşatıyor ama düzleştirmiyor. Gerçek çözüm sınır boyunca köşe kesmek
  ya da o bölgeyi de doku ile boyamaktır (yüz penceresi gibi) — tur 4 işi.
  Denendi ve GERİ ALINDI: ince hücre bandını y 0,34 → 0,18'e indirmek karakter
  başına +1.200 üçgen getirdi, görünür kazanç sıfır (sınır zaten bandın içinde).
- **Renderer `dpr` tavanı 1,5** (`TableScene`/`FirstPersonStage`). Retina
  ekranda tuval 2.160×1.350 üretilip 2.880×1.800'e büyütülüyor; "piksel belli"
  hissinin bir kısmı buradan gelir ve D3 dışıdır. Değiştirilmedi (perf kararı).
- Üretim hâlâ ana iş parçacığında (kuyruklu) ve karakter başına ~0,63 s.
  Web Worker + QEM sadeleştirme hâlâ D3.5.
- 8 mm voxel aynı üçgen sayısını %22 daha ucuza veriyor; netlik farkı gözle
  ayırt edilemedi. Süre sorun olursa tek satırlık geri adım.
- Tur 1–2'nin açık maddeleri (bordo ↔ `fascistDeep` yakınlığı, kıvırcıkta fular
  halkası, gerçek cihaz FPS'i) değişmedi.

---

# Tur 4 — renk sınırları (2026-09-11)

Tur 3 sonrası kalan en belirgin kusur: vertex renkle boyanan bölge sınırları
(ceket/yelek V yakası, hırka şeridi, sakal–ten, manşet, saç–ten) 24,5 mm'lik
üçgenlerde **testere dişi**. Tur 3'ün band genişletmesi kenarı yumuşatıyordu ama
düzleştirmiyordu; bu turda sınır **üçgen çözünürlüğünden bağımsız** hâle geldi.
`packages/contracts/**` ve `docs/design/**` değişmedi, yeni bağımlılık yok, commit yok.

## T4.1 Sınır kenar-yumuşatması fragment shader'da

Renk artık köşede KARIŞTIRILMIYOR. Her bölge sembolik bir anahtarla
(`ColorKey`: `skin` · `skinShadow` · `outfit` · `outfitDark` · `shirt` · `leg`
ya da aksesuarın `#rrggbb`'si) adlandırılıyor ve iki bölgenin sınırı bir
**işaretli uzaklık alanıyla** tanımlanıyor.

- `colors.ts`: kurallar bölge işlevlerine döndü —
  `primColorKey(prim, p, karakter) → ColorKey` ve
  `boundaryDistance(mekanizma, A, B, giysi, p, dA, dB) → m` (+ = A tarafı).
  Üç mekanizma: **`prim`** iki bölgenin ilkelleri arasındaki Voronoi sınırı
  `(dB − dA)/2`; **`front`** §e ön bölge kurallarının skor farkı (taban gövde
  yuvasının skoru, bütün kuralların en büyük içeridelik değerinin negatifi =
  tümleyen bölge); **`neck`** boyun halkası y eşiği. `FEATHER`/`COLOR_FEATHER`
  karışım bantları SİLİNDİ; `z < −0,05` ön bölge kapısı da ayrı bir dal değil,
  uzaklığın bir terimi (gövdenin yanındaki dikey sınır da yumuşak).
- `geometry.ts` → `splitByBoundary`: her ÜÇGENE, köşelerinin bölgelerinden bir
  `(bölgeA, bölgeB, mekanizma)` **bağlamı** atanır. Mekanizma, işaretleri
  köşelerin kendi bölgeleriyle uyuşan adaylar arasından |uzaklık| toplamı en
  küçük olan (= en yakın gerçek sınır). Üçgenin üç köşesi de o bağlamın iki
  rengini ve sınıra işaretli uzaklığı taşır; bir köşe farklı bağlamlı üçgenlere
  aitse **çoğaltılır**. Üçgen sayısı değişmez.
- Yeni öznitelikler: `colorB` (vec3, ten başına) ve `dBoundary` (float, m —
  tenden bağımsız, bütün tenlerle paylaşılır). `boundaryMaterial.ts`,
  `meshStandardMaterial`'ı `onBeforeCompile` ile yamalıyor:

      float w = max(fwidth(vBoundary), 1e-6);
      diffuseColor.rgb *= mix(vColorB, vec3(vColor), smoothstep(-w, w, vBoundary));

  `w` ekran uzayında piksel başına değişim olduğu için geçiş **her mesafede
  1 piksel**; `dBoundary`'nin mutlak ölçeği önemsizdir, yalnız işareti ve sıfır
  düzeyi önemlidir. `customProgramCacheKey` ile ayrı program önbelleği.
  Düşük kademede de AÇIK; ek çizim çağrısı yok.

**Görevden sapma (gerekçeli).** Görev "her köşe için kendi rengi + komşu rengi +
`dBoundary` = kendi SDF − komşu SDF" diyordu. Bu biçim çalışmaz: iki komşu köşe
de kendi bölgesini taşıdığı için `dBoundary` HER ZAMAN pozitif olur, `fwidth`
küçülür, `smoothstep` doyar ve `vColor` köşeler arasında A→B doğrusal karışır —
yani tur 3'ün gradyanı geri gelir. İşaretin çalışması için sınırın iki
ucundaki köşelerin AYNI renk çiftini AYNI sırayla taşıması gerekir; bunu
köşe başına karar vererek garanti etmek mümkün değil (uzak köşelerin çifti
farklı olur ve sahte sıfır geçişi/yanlış renk üretir — denendi, elendi).
Bu yüzden çift ÜÇGEN başına sabitlendi ve gereken yerde köşe çoğaltıldı.
Bu, görevin "alternatif" saydığı mesh split'in en ucuz biçimi: **üçgen sayısı
değişmiyor**, yalnız sınır boyunca köşe kopyalanıyor (+%9…18 köşe), ve
shader yolu aynen uygulanıyor.

## T4.2 DPR

`TableScene` ve `FirstPersonStage`: standard kademede `dpr` tavanı
**1,5 → 2** (low kademe 1 kaldı). Retina'da tuval artık 2.880×1.800 üretiliyor
(önce 2.160×1.350 üretilip büyütülüyordu; ölçüldü: `scratchpad/d3-dpr-check.mjs`).
M2/Metal'de koltuk kamerası 10 kişi FPS'i **her iki değerde de 59,9** (CPU 4× ve
1×) — düşüş yok, `[1, 2]` bırakıldı.

## T4.3 İnce şeritler

`MIN_BAND = 12 mm`: `ruleInside` her `Vband` kuralının bandını en az 12 mm'ye
yükseltiyor (köşe aralığı 24,5 mm olduğu için bundan dar bir şerit hiçbir köşeye
düşmez ve işaretli uzaklık alanında temsil edilemez). Tasarım değerleri zaten
uygun: ceket yaka bandı 35 mm, hırka orta şeridi 100 mm, manşet ilkeli 43 mm —
yani kural bugün bir emniyet tabanı, test bunu sabitliyor. Saç çizgisi `prim`
mekanizmasıyla çiziliyor ve ten üzerinde net (`after4-faces.png`, `after4-gallery.png`).

## Sayılar

Üretim ve üçgenler aynı vitest ölçüm koşumunda (8 karakter, `orta` ten);
sahne sayıları Chrome/Metal (M2), 1440×900 @2× isteme, dev sunucu 5199.

| Ölçü | Tur 3 | **Tur 4** |
| --- | --- | --- |
| Standard üçgen / karakter | 11.904 – 13.710 | **11.904 – 13.710** (değişmedi) |
| Standard köşe / karakter | 6.263 – 6.919 | **6.849 – 8.158** (+%9…18, sınır çoğaltması 586 – 1.239) |
| Sınır geçişi (`splitByBoundary`) | — | **13 – 20 ms / karakter** |
| Standard üretim / karakter | 628 ms (tarayıcı 687) | **617 – 875 ms** (tarayıcı **680**) |
| Renk sınırı bandı | ±20–22 mm köşe karışımı | **fragment shader, 1 piksel** |
| `dpr` tavanı (standard) | 1,5 | **2** (tuval 2.160×1.350 → 2.880×1.800) |
| Çizim / oyuncu | 3 | **3** (değişmedi) |
| Koltuk 10 kişi: çizim / üçgen | 188 / 327.130 | **186 / 324.198** |
| Koltuk 7 kişi: çizim / üçgen | 161 / 232.196 | **161 / 232.196** |
| **Koltuk 10 kişi FPS, CPU 4× / 1×** | 59,8 / 60,1 | **59,9 / 59,9** (dpr 1,5'te de 59,9 / 59,9) |
| Koltuk 7 kişi FPS, CPU 4× | 59,8 | **59,8** |

Ek öznitelik maliyeti: köşe başına 16 bayt (`colorB` 12 + `dBoundary` 4);
10 oyuncuda ~1,2 MB. FPS'e ölçülebilir etkisi olmadı.

## Testler ve kontroller (gerçekten çalıştırıldı)

- `pnpm -r typecheck` → 6/6 temiz.
- `pnpm test` → **563** (tur 3: 554). Scene 210 → 219, 9 yeni test:
  `boundaryDistance` işareti/ölçeği (V yakada sınıra gerçek uzaklık, anahtar
  takasında işaret dönüyor, sınırda tam sıfır, kuralı olmayan giyside NaN);
  `prim` mekanizması `(dB − dA)/2` ve `±BOUNDARY_LIMIT` kırpması, eksik
  bölgede tek yönlü/NaN; `neck` mekanizması y eşiği; ceket yaka bandının kendi
  bölgesi (gömlek ↔ bant ↔ giysi); ince şerit ≥ 12 mm (bant + manşet ilkeli);
  `colorB`/`dBoundary` öznitelik uzunluğu, aralığı, çoğaltma oranı (< %20) ve
  `dBoundary`'nin tenler arasında PAYLAŞILMASI; **bir üçgenin üç köşesinin aynı
  renk çiftini taşıması** (shader'ın dayandığı değişmez, bütün üçgenlerde);
  köşenin işaretle seçtiği ETKİN rengin §e kuralının verdiği renk olması
  (%99+ örtüşme; kalan üçlü kavşaklar); shader yamasının `fwidth`/`smoothstep`/
  `mix` dizgilerini içermesi ve `#include <color_fragment>`'ı devralması;
  malzemenin `vertexColors` + kendi program önbelleği anahtarı.
  jsdom'da WebGL yok, bu yüzden shader DERLENMESİ tarayıcıda doğrulandı
  (kare betiklerinde `pageerror`/`console.error` dinlendi → hata yok).
  Güncellenen test yok; tur 1–3'ün 5 giysi renk kuralı testi aynen geçiyor
  (`vertexColor` artık `colorFromKey(primColorKey(...))` sarmalayıcısı).
- `pnpm --filter @secret-table/web build` → geçti (`three` parçası 761 kB, değişmedi).

## Kareler (`docs/qa/claude/d3/`)

Betikler: `scratchpad/d3-shots4.mjs` (tur 3 kadrajları), `scratchpad/d3-perf3.mjs`,
`scratchpad/d3-dpr-check.mjs` — port 5199 `--strictPort`, 5173'e dokunulmadı,
sunucu kapatıldı. Karşılaştırma karesi `after3-*` (aynı kadraj).

| Dosya | İçerik |
| --- | --- |
| `after4-neighbor-close.png` | **Ana kanıt:** koltuk kamerası, bakış sağa ~50° — Kaan'ın V yakası ve Deniz'in sakal/yaka kenarı |
| `after4-neighbor-close-left.png` | Aynı kadraj, bakış sola ~50° |
| `after4-seat.png` | Koltuk kamerası, ileri bakış (7 kişi) |
| `after4-overview-10p.png` | Genel masa, 10 kişi |
| `after4-gallery.png` | 8 karakter yan yana (V yaka / hırka şeridi / manşet) |
| `after4-faces.png` | Kepli Çocuk, 4 ifade (kol–ten, kep–saç sınırı) |

## Tur 4 sonrası açık kalanlar

- **Üçlü kavşaklar** (üç bölgenin buluştuğu birkaç üçgen) tek çift seçmek
  zorunda; oralarda sınır bir üçgen boyunca keskin geçiyor. Köşe başına
  ölçülen örtüşme %99+; gözle görülmedi.
- **Boyun halkası (`neck`) mekanizması bugün hiçbir üçgende seçilmiyor:** kazak
  ve tişörtte halkanın (y 0,575) üstündeki ten şeridi bir köşe aralığından dar
  kaldığı için o bölge hiç köşeye düşmüyor; görünen yaka çizgisi baş↔boyun
  ilkel sınırı (`prim`) oluyor. Tur 1–3'te de böyleydi (davranış değişmedi);
  halkayı görünür kılmak §e'de y eşiğini aşağı almayı gerektirir — tasarım kararı.
- Standard üçgen 11,9–13,7 k (§g hedefi 6 k): QEM sadeleştirme hâlâ yok.
- Üretim hâlâ ana iş parçacığında (kuyruklu), karakter başına ~0,7 s;
  Web Worker D3.5.
- Tur 1–3'ün açık maddeleri (bordo ↔ `fascistDeep` yakınlığı, kıvırcıkta fular
  halkası, kepli çocuğun kubbesinin krem okunması, gerçek cihaz FPS'i) değişmedi.

---

# D3.4 — lobi karakter seçimi (teslim, 2026-09-12)

Kullanıcı isteği (2026-09-12): "oyuna giriş ekranına karakter seçimi eklememişsin".
D8 lobi yeniden tasarımı BEKLENMEDEN mevcut lobiye eklendi. ROADMAP **B3** bu adımda kapandı.

## 0. Migration 0008 — **UYGULANDI** (2026-09-12, Claude, Management API / `docs/DEPLOYMENT.md` C06 Yol B)

Uzak projede `room_members.avatar_character` / `avatar_skin` sütunları, iki CHECK kısıtı ve
`schema_migrations` 0008 satırı doğrulandı. Aşağıdaki adımlar tarihçe/başka ortam içindir.

### 0a. (Tarihçe) Uygulanmadan önceki uyarı

`supabase/migrations/0008_avatar.sql` **yalnız dosya olarak yazıldı; uzak/yerel
Supabase'e UYGULANMADI** (ajan DB'ye yazmaz). Uygulanana kadar Supabase kipinde:

- lobi seçicisi görünür ve koltuk varsayılanlarını gösterir (okuma yolu güvenli),
- ama **bir karaktere tıklayınca komut HATA döner** (`room_members.avatar_character`
  sütunu yok) ve lobide kırmızı hata satırı çıkar. Sessizce "başarılı" görünmez.

Uygulama (Supabase SQL Editor ya da CLI — önceki migration'larla aynı yol):

```bash
# A) Supabase CLI ile (bağlı proje):
supabase db push

# B) psql ile (connection string'i Supabase panelinden al):
psql "$SUPABASE_DB_URL" -f supabase/migrations/0008_avatar.sql

# C) Panel: SQL Editor → dosyanın tamamını yapıştır → Run.
```

Doğrulama (uygulandıktan sonra):

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='room_members'
   and column_name in ('avatar_character','avatar_skin');   -- 2 satır dönmeli
```

Migration additive'dir: iki nullable sütun + iki CHECK + `service_role` grant
tekrarı + `notify pgrst`. Mevcut satırlar NULL kalır (= "seçilmedi") ve sunucu
koltuk varsayılanını verir; eski istemciler etkilenmez.

## 1. Ne yapıldı

**Sözleşme (additive, paket 0.2.2 → 0.2.3, `CONTRACT_VERSION` 0.2.0 SABİT)**

- Yeni `packages/contracts/src/avatars.ts`: `AVATAR_CHARACTER_IDS` (8),
  `AVATAR_SKIN_IDS` (3), `AvatarSelection`, `avatarForSeat`, `normalizeAvatar`,
  `suggestSkin`, tip korumaları. Liste **sunucu** tarafından da okunmalı ve
  `packages/server` three'yi içe aktaramaz; bu yüzden kimlikler sözleşmeye taşındı.
  `packages/scene/src/characters/characters.test.ts` listeyi `characters.json`
  ile karşılaştırır (tasarıma karakter eklenirse test kırılır).
- `PlayerView.avatar: { character, skin }` — **her zaman dolu** (seçim yoksa
  koltuk varsayılanı). `LobbyMember.avatar` aynı anlam.
- `LobbyCommand` yeni dal: `{ type: 'set_avatar', character, skin }`; şema
  (`lobbyCommandSchema`) bilinmeyen kimliği reddeder.
- `docs/CONTRACT.md`: § 3 PlayerView satırı, § 9.5 tablo satırı, yeni **§ 9.7**.

**Sunucu**

- `MemberRecord.avatar`, `GameGateway.setMemberAvatar` (bellek + Supabase).
- `GameService.setAvatar`: oda lobide değilse `NOT_ALLOWED`, kimlik geçersizse
  `INVALID_OPTION`, aksi hâlde yazar (idempotent).
- `resolveAvatars(members)` (saf, `projection.ts`'te dışa açık): açık seçimler
  korunur; seçmeyen koltuğa varsayılan verilir ve o karakter odada kullanılıyorsa
  varsayılan TEN farklıya kayar. `getLobby` ve `projectView` AYNI işlevi kullanır.
- `ProjectionMeta.avatarByPlayerId` opsiyoneldir: eski çağrı noktaları ve testler
  değişmeden koltuk varsayılanını üretir.

**Web lobi**

- `apps/web/src/ui/AvatarPicker.tsx`: seçili karakter BÜYÜK (tek Canvas) + 8 küçük
  2B kart + 3 ten örneği. Seçim anında `set_avatar` gider (`useRoomState.setAvatar`).
  Telefonda kart şeridi YATAY KAYDIRILIR (ölçüldü: 584 px içerik / 294 px görünür,
  gövdede yatay taşma yok); ≥720 px'te iki-üç satıra sarılır.
- `AvatarPreview.tsx` ayrı dosya + `lazy()`: three yalnız bu dal indirilince yüklenir
  (build: `AvatarPreview` 0,35 kB, `CharacterGallery` 232 kB ayrı chunk). jsdom
  testleri bu modülü tek satırla taklit eder.
- `avatarText.ts`: Türkçe ad/özet/vurgu rengi + ten örnek renkleri. Tasarım JSON'u
  (47 kB) lobi paketine GİRMEZ; `avatarText.test.ts` tabloyu JSON ile karşılaştırır.
- `LobbyTable.tsx`: her koltukta karakter adı + vurgu rengi (rozet arka planı) ve
  ten tonu (rozet çerçevesi); ekran okuyucuya "Ad, Karakter, koyu ten, …".
- Bot modu (yalnız dev): her bot odada kullanılmamış rastgele bir karakter seçer
  (`pickBotAvatar`), sonra hazır olur.

**Sahne**

- `layout/seats.ts`: yeni `seatAvatar(player)` — yetkili kaynak `PlayerView.avatar`,
  `avatarForSeat` yalnız yedek. Etiket yüksekliği (`labelLift`) seçilen karakterden.
- `TableScene.tsx` ve `prototype/FirstPersonStage.tsx`: `CharacterAvatar`,
  `PublicArms`, `ShootingArm`, `EmoteArms` artık `seatAvatar(seat.player)` alıyor
  (masadaki ellerin ten tonu da seçilen karakterden geliyor).
- `CharacterGallery` yeni `mode="single"` (lobi önizlemesi).

**Fixture'lar**

- `makePlayers` `avatar: avatarForSeat(seatIndex)` doldurur → mevcut fixture
  görünümleri DEĞİŞMEDİ.
- Yeni `lobby-avatars` fixture'ı (`/dev/scene?fixture=lobby-avatars`): 7 koltuk,
  her biri farklı seçim, 3. ve 4. koltuk aynı karakter farklı ten.

## 2. Testler (GEÇTİ)

`pnpm -r typecheck` 6/6 · `pnpm test` **788** · `pnpm --filter @secret-table/web build`

| Paket | Önce | Sonra |
| --- | --- | --- |
| contracts | 13 | **19** (+6: `avatars.test.ts` — kimlikler, varsayılan, `normalizeAvatar`, `suggestSkin`, `set_avatar` şeması) |
| fixtures | 50 | **51** (+1 `lobby-avatars`; gizlilik testine `avatar` eklendi) |
| game-core | 98 | 98 |
| scene | 322 | **324** (+1: sözleşme listesi ↔ `characters.json`; +1 eşzamanlı D1 tur-6 ajanından) |
| server | 44 | **51** (+7: varsayılan, kayıt+idempotent, aynı karakter serbest, varsayılan ten önerisi, geçersiz kimlik, oyun içinde `NOT_ALLOWED`, lobi seçimi → `PlayerView.avatar`) |
| web | 236 | **245** (+9: seçici render, `set_avatar` gönderimi, ten seçimi, ten önerisi, masadaki rozet, hata gösterimi, `busy` kilidi, `avatarText` ↔ JSON, `pickBotAvatar` ×3) |

Üretim paketinde bot kodu yok: `dist/assets` içinde `Bot-Ada` / `pickBotAvatar` için 0 eşleşme.

## 3. Canlı doğrulama

Yerel dev sunucu **5200** (`SUPABASE_URL=` boş → `InMemoryGateway`; 5199'daki
Supabase kipli sunucuya dokunulmadı, 0008 uygulanmadığı için orada yazma hata verir).
Gerçek HTTP yolu: `create_room` → 4 arkadaş `join_room` + `set_avatar` + `set_ready`
→ tarayıcıda lobi.

- Seçim kaydedildi ve **yeni tarayıcı bağlamında geri geldi** (masaüstü karesinde
  seçilen Fötr, telefon karesinde de seçili).
- Masada diğer oyuncuların seçimi göründü: Mert/Fötr, Elif/Bereli Teyze,
  Deniz/Kepli Çocuk, Kaan/Fötr, Selin/Sakallı.
- Aynı karakteri iki oyuncu aldı (Mert + Kaan = Fötr) — engellenmedi, beklenen.

### Kareler (`docs/qa/claude/d3/`)

| Dosya | İçerik |
| --- | --- |
| `lobby-picker-desktop.jpg` | Masaüstü lobi (1280×900): seçici, 3D önizleme, masada karakter adları |
| `lobby-picker-secim.jpg` | Fötr seçildikten sonra: önizleme + masadaki "Mert · Fötr" güncellendi |
| `lobby-picker-telefon.jpg` | Telefon dikey (390×844): kart şeridi yatay kaydırmalı |
| `lobby-picker-masa.jpg` | 3D masa, `lobby-avatars` fixture'ı — sahne `PlayerView.avatar`ı okuyor |

Betik: `scratchpad/shots.mjs` (oturuma özel geçici klasör). Geçici 5200 sunucusu kapatıldı.

## 4. Sapmalar / açık kalanlar

1. **Realtime sürüm sinyali yok.** Görev "revision artar, lobi realtime sinyali"
   diyordu; `revision` yalnız `game_states` tablosunda yaşıyor ve lobide oyun
   durumu yok. `set_avatar`, mevcut `set_ready` ile AYNI yolu kullanıyor: komuttan
   sonra `lobby_view` tazelenir + 3 s lobi yoklaması. Diğer oyuncular seçimi en
   geç 3 s içinde görür. Ayrı bir lobi revizyon sütunu istenirse ayrı iş.
2. ~~**Kendi elinin ten tonu bağlanmadı.**~~ **KAPANDI** (2026-09-12, D1/D16
   ajanı): `SkinnedHand`e ve `HandRig`e `skin` propu eklendi; `TableScene` ile
   `FirstPersonStage` yerel oyuncunun `seatAvatar(player).skin`ini geçiriyor.
   Boyama tek kaynakta: `hands/geometry.tintVertexColors` (oran yöntemi,
   `PublicArms` da artık onu çağırıyor) + `tintedHandGeometry(tier, base)` —
   konum/normal/indis ve skin öznitelikleri kademeyle PAYLAŞILIR, yalnız `color`
   özniteliği kademe × ten başına bir kez kopyalanır; üretim paletinde ek
   geometri yoktur. Test: `hands.test.ts` "D3.4 — ilk şahıs eli ten tonu"
   (iki tenin köşe rengi ortalaması farklı, açık > koyu, öznitelik paylaşımı,
   aynı ten aynı nesne).
3. **Ten önerisi açık seçimi değiştirmez.** Sunucu yalnız *seçilmemiş* koltuğun
   varsayılan tenini kaydırır; kullanıcı Fötr'ü aynı tenle seçerse kabul edilir
   (kullanıcı benzersizlik istemedi).
4. **Lobi metin tablosu kopyadır** (`avatarText.ts`). Tasarım JSON'unu lobiye
   bağlamamak için; test iki tarafı senkron tutuyor.
5. Karakter kartları 2B (harf rozeti + vurgu rengi). 8 karakterin hepsini 3D
   çizmek oyuncu başına ~3 çizim × 8 = 24 çizim ve ~8 × 0,7 s üretim demekti;
   "tek Canvas ≤ 9 çizim" bütçesi için seçili karakter büyük + 2B kart yolu seçildi.
6. Migration **uygulanmadı** (bkz. § 0).
