# C2 — Paket bölme ve telefon cilası

Görev: ROADMAP §C/2 (sahneyi ayrı chunk yap, oda ekranında geç yükle; font alt
kümesi) + telefon/dokunmatik düzeltmeleri. Oturum: Opus yan oturumu, 2026-09-10.
Git commit/push yapılmadı, yeni npm bağımlılığı eklenmedi (manifest ve lock
dosyaları değişmedi), `.env` değerine dokunulmadı.

## 1. Ölçüm — önce / sonra

`pnpm build` (vite 7.3.6, 731 modül, sourcemap açık). Boyutlar vite raporundan.

### Önce (tek chunk)

| Dosya | Ham | gzip | Ne zaman iner |
| --- | --- | --- | --- |
| `index-SUYfpZu0.js` | 1.568,49 kB | 443,37 kB | **ilk yükleme** |
| `index-CvHqLp2p.css` | 13,05 kB | 3,36 kB | ilk yükleme |
| `index.html` | 0,45 kB | 0,28 kB | ilk yükleme |
| `NotoSans.ttf` | 2.049,10 kB | — | sahne varlığı |
| `NotoSerif.ttf` | 1.887,19 kB | — | sahne varlığı |
| **İlk yükleme JS toplamı** | **1.568,49 kB** | **443,37 kB** | |

### Sonra (sahne tembel)

| Dosya | Ham | gzip | Ne zaman iner |
| --- | --- | --- | --- |
| `index-CM0GrDHG.js` (giriş) | 292,67 kB | 80,51 kB | **ilk yükleme** |
| `react-vendor-DGOVn_jG.js` | 284,72 kB | 91,41 kB | **ilk yükleme** (girişin statik bağımlılığı) |
| `index-R6w8Taz1.css` (uygulama) | 11,61 kB | 3,00 kB | ilk yükleme |
| `index.html` | 0,53 kB | 0,31 kB | ilk yükleme |
| `index-B8-kOYOL.js` (sahne) | 236,65 kB | 77,45 kB | oyun ekranı / lobi ön-yüklemesi |
| `three-Dfi2-ENM.js` | 751,30 kB | 193,48 kB | oyun ekranı / lobi ön-yüklemesi |
| `index-D51q-yKi.css` (sahne) | 2,36 kB | 0,88 kB | oyun ekranı / lobi ön-yüklemesi |
| `NotoSans.ttf` / `NotoSerif.ttf` | 2.049,10 / 1.887,19 kB | — | **yalnız sahne chunk'ıyla** |
| **İlk yükleme JS toplamı** | **577,39 kB** | **171,92 kB** | |
| **Ertelenen JS toplamı** | **987,95 kB** | **270,93 kB** | |

**Sonuç: ilk yükleme JS 1.568,49 → 577,39 kB (−63,2 %), gzip 443,37 → 171,92 kB
(−61,2 %).** Giriş (`/`), `/katil/:code` ve lobi ekranı three/R3F/drei indirmez.

Doğrulama — üretilen `dist/index.html` yalnız girişi ve `react-vendor`i çağırır;
`three` ve sahne chunk'ı orada yoktur (girişin `__vite__mapDeps` tablosunda,
yani `import()` anında yüklenir):

```
<script type="module" crossorigin src="/assets/index-CM0GrDHG.js"></script>
<link rel="modulepreload" crossorigin href="/assets/react-vendor-DGOVn_jG.js">
<link rel="stylesheet" crossorigin href="/assets/index-R6w8Taz1.css">
```

Fontlar da artık girişin varlık grafiğinde değil: `NotoSans-*.ttf` /
`NotoSerif-*.ttf` adları YALNIZ sahne chunk'ında (`index-B8-kOYOL.js`) geçiyor
(kaynak: `packages/scene/src/materials/SceneMaterials.tsx`). Yani 3,94 MB ham
font ilk açılışta hiç istenmiyor.

### Chunk içeriği (sourcemap `sourcesContent`, sıkıştırılmamış kaynak baytı)

| Chunk | Başlıca içerik |
| --- | --- |
| giriş | `@supabase/*` ~707 kB, uygulama kaynağı 158 kB |
| `react-vendor` | react-dom 533 kB, react-router 400 kB, react 18 kB, scheduler 10 kB |
| sahne | `@react-three/fiber` 643 kB, `packages/scene` 135 kB, three-stdlib 22 kB, drei 17 kB |
| `three` | three 2.114 kB |

Kalan "500 kB üstü chunk" uyarısı yalnız `three` içindir; beklenen ve tembel.

## 2. Yapılan değişiklikler

### 2a. Kod bölme

- `apps/web/src/ui/SceneFrame.tsx` — `@secret-table/scene` statik import kaldırıldı;
  tek bir `importScene()` (`() => import('@secret-table/scene')`) üzerinden
  `React.lazy` kuruldu. `TableScene` adlandırılmış export olduğu için
  `.then((m) => ({ default: m.TableScene }))` ile eşlendi. **Mevcut Suspense ve
  `SceneErrorBoundary` aynen korundu**: chunk indirilemezse hata sınırı
  "3D masa yüklenemedi" görünümüne düşer, HTML kontroller çalışmaya devam eder.
- Aynı dosyadan `preloadScene()` export edildi (hata yutulur).
- `apps/web/src/ui/Lobby.tsx` — mount olunca `preloadScene()`; oyuna geçişte
  bekleme olmaz.
- `apps/web/vite.config.ts` — `build.rollupOptions.output.manualChunks`:
  `three` kendi chunk'ına; `react`/`react-dom`/`scheduler`/`react-router*`
  **açıkça** `react-vendor`a sabitlendi.

  Not / tuzak: yalnız `three` + `@react-three/*` işaretleyen ilk denemede Rollup,
  paylaşılan `react`/`react-dom`'u `react-three` manuel chunk'ına eritti ve
  **giriş sayfası 362 kB'lık o chunk'ı statik import etmeye başladı** (index.html'e
  `modulepreload` olarak da girdi). React'i açıkça kendi chunk'ına sabitlemek bunu
  çözüyor. `@react-three/*` ayrı chunk'a alınmadı — zaten yalnız tembel sahne
  grafiğinde ve tek başına ayırmanın kazancı yok.

### 2b. Telefon / dokunmatik

- `apps/web/src/ui/styles.css` — `@media (pointer: coarse)` altında klavye
  rozetleri gizlendi: `.actionbar__keys` (E/Enter/Backspace/H/V/M satırı),
  `.actionbar__digit` (1/2/3), `.actionbar__more` (← → gezin),
  `.actionbar__confirm-buttons kbd`, `.game__top-actions kbd`.
  **ActionBar düğmeleri ve tüm dokunma yolları aynen duruyor**; yalnız rozetler
  gizlendi.
- `apps/web/src/immersive/useImmersiveSession.ts`:
  - `fullscreenSupported` (yalnız Fullscreen API; Pointer Lock aranmaz),
  - `enterFullscreenOnly()` — yalnız tam ekran ister, Pointer Lock istemez ve
    `engagedRef`i kurmaz, böylece dokunmatikte "Bakışı etkinleştir" önerisi hiç
    çıkmaz,
  - `useCoarsePointer()` — `matchMedia('(pointer: coarse)')`, değişimi dinler,
    ortam desteklemezse güvenli `false`.
  Mevcut `supported`/`enter`/`resume`/`releaseLock`/`exit` davranışı ve testleri
  değişmedi.
- `apps/web/src/ui/GameScreen.tsx` — üst şerit düğmesi ikiye ayrıldı:
  - ince işaretleyici: eskisi gibi "Oyuna odaklan" / "Bakışı etkinleştir" / "Odağı bırak",
  - kaba işaretleyici: `fullscreenSupported` ise yalnız **"Tam ekran"** /
    "Tam ekrandan çık"; desteklenmiyorsa (iOS Safari'de element tam ekranı yok)
    **hiç düğme yok**.
  - `GameMenu`'nün "Bakışa dön" seçeneği de dokunmatikte kapatıldı
    (`canResume={immersive.fullscreen && !coarsePointer}`).
- `packages/scene/src/layout/inspection.css` — ≤767 px'te `.st-inspection-nav`
  sağ üstten alınıp **alt çubuğun hemen üstüne**, tek satır yatay kaydırılabilir
  küçük düğmelere indirildi (`flex-wrap:nowrap; overflow-x:auto`, kaydırma çubuğu
  gizli, düğmeler 40 px). `.st-inspection-detail` de bu şeridin üstüne alındı ki
  alt çubuğun arkasına düşmesin. **Masaüstü konumu değişmedi** (sadece bir
  `@media(max-width:767px)` bloğu eklendi; mevcut kurallara dokunulmadı).
- Alt çubuğun yüksekliği seçenek sayısıyla değiştiği için konum CSS değişkeni
  `--st-nav-bottom` ile veriliyor; `GameScreen` bunu `footer.offsetHeight + 6`
  olarak ölçüp `.game` üstüne yazıyor (her render sonrası + `ResizeObserver`;
  ikisi de yoksa CSS'teki 96 px yedeği). Sahne paketinde TSX değişikliği yok.
- ≤767 px'te `.game__top`'un 62 px'lik üst boşluğu geri alındı (sahne şeridi artık
  orada değil) → 390×844'te üst şerit 129,5 px yerine ~101 px.

Sahiplik notu: `packages/scene/src/layout/inspection.css` varsayılan olarak
Codex'indir; `docs/COORDINATION.md` §1 uyarınca kullanıcı görevlendirmesiyle bu
turda Claude düzenledi. Değişiklik yalnız CSS'tir, sahne TSX'ine dokunulmadı.

## 3. Font alt kümesi — YAPILMADI

**Gerekçe: sistemde fontTools yok ve görev metni "fontTools YOKSA kurmaya
çalışma" diyor.** Kanıt:

```
$ python3 -c "import fontTools"      → ModuleNotFoundError: No module named 'fontTools'
$ which pyftsubset                   → pyftsubset not found
```

python3, python3.12, python3.13, `/opt/homebrew/bin/python3`, `/usr/bin/python3`
tek tek denendi; hiçbirinde `fontTools` yok. `pyftsubset` ikilisi
`/opt/homebrew/bin`, `/usr/local/bin`, `~/.local/bin` altında yok; `pipx` yok;
`node_modules/.bin` içinde alt küme aracı yok. Kurulum denenmedi.

Buna karşılık C2'nin font hedefinin pratik kısmı kod bölmeyle zaten alındı:
3,94 MB'lık iki TTF artık giriş/lobi varlık grafiğinde değil, yalnız sahne
chunk'ıyla iniyor (bkz. §1). Gerçek alt küme (Latin + Latin-1 Supplement +
Latin Extended-A + genel noktalama + para birimi; OFL dosyaları yanında kalacak)
fontTools kurulunca ayrı bir turda yapılmalı; `docs/ASSETS.md`'ye bu not düşüldü.
Alt küme üretilmediği için Türkçe metin doğrulaması da eski durumu ölçüyor:
`/dev/game?fixture=president-discard` görüntüsünde isim ("Barış", "Deniz") ve
düğme yazıları ("Özel alanı incele", "Tahtayı incele") doğru çiziliyor.

## 4. Kontroller

| Kontrol | Sonuç |
| --- | --- |
| `pnpm typecheck` | GEÇTİ, 6/6 paket |
| `pnpm test` | GEÇTİ, **330** test (contracts 11, fixtures 28, game-core 70, scene 83, server 35, web 103) |
| `pnpm build` | GEÇTİ, §1'deki chunk tablosu |

Test dosyası eklenmedi/silinmedi; mevcut `immersiveSession.test.tsx` ve
`GameScreen.test.tsx` ("Oyuna odaklan" düğmesi görünür) değiştirilmeden geçiyor —
jsdom'da `matchMedia('(pointer: coarse)')` `false` döndüğü için masaüstü kolu
çalışıyor.

## 5. Tarayıcı doğrulaması

`.claude/launch.json` "web" (preview_start, :5173), `/dev/game?fixture=president-discard`.
Ağ isteği/oda açma gerekmedi.

- **Üretim derlemesi (`npx vite preview`, :4173) — kesin kanıt:** giriş sayfası
  `/` çizildikten sonra `performance.getEntriesByType('resource')` içinde
  `three-*.js` veya sahne chunk'ı **hiç yok**. Konsoldan
  `await import('/assets/index-B8-kOYOL.js')` çağrılınca `index-B8-kOYOL.js` +
  `three-Dfi2-ENM.js` iniyor ve `{ TableScene: function }` dönüyor; `.ttf`
  dosyaları o anda bile inmiyor (sahne malzemeleri çalışınca iniyor). Konsolda
  hata yok. Yani manuel chunk grafiği üretimde sağlam ve giriş sayfası temiz.
  (Sunucu doğrulamadan sonra kapatıldı.)
- **Masaüstü (1280×720):** sahne tembel chunk'tan yükleniyor, görünüm A2'deki
  hâliyle aynı; sahne şeridi sağ üstte, klavye rozetleri ve "Oyuna odaklan"
  yerinde. Konsolda yeni hata yok.
- **Lobi ön-yüklemesi:** lobi ekranındayken (`.game` DOM'da yokken) ağ kaydında
  `packages/scene/src/**` modülleri indirilmiş görünüyor → `preloadScene()`
  çalışıyor.
- **390×844:** `--st-nav-bottom` 66 px; sahne şeridi 734→778, alt çubuk 784'te →
  **6 px boşluk, çakışma yok**. Yatay/dikey belge taşması 0. `.actionbar__keys`
  `display:none`, görünür `kbd` yok. Üst şerit düğmeleri: "Tam ekran", "Menü".
  4 düğmeli durumda ("Tahtayı incele" açıkken) şerit `scrollWidth` 399 >
  `clientWidth` 390 → kendi içinde kayıyor, belge taşması yine 0; inceleme
  başlığı 680→735 ile şeridin üstünde.
- **740×360 (dar yatay):** üst şerit 46 px, sahne şeridi 264→308, alt çubuk 314 →
  6 px boşluk; taşma yok.
- **844×390 (yatay telefon genişliği):** genişlik 767'nin üstünde olduğu için
  sahne şeridi üstte kalıyor (10→50) ve uygulama üst düğmeleri onun altından
  başlıyor (52→90); belge taşması X ve Y'de 0.
- Varsayılan kamera A2'deki `defaultCameraMode()` ile <768 px'te `overview`;
  değiştirilmedi.

Panel kusurları (uygulama değil, ölçümler bunlara rağmen geçerli):
- `resize_window` sırasında canvas 300×150 kalıyor — mobil ekran görüntülerinde
  3D alan boş; düzen DOM ölçümleriyle (`getBoundingClientRect`,
  `scrollWidth ≤ clientWidth`) doğrulandı.
- **`ResizeObserver` bu panelde hiç tetiklenmiyor** (sentetik testle doğrulandı:
  `observe()` ilk çağrısı bile geri çağırma üretmiyor). `--st-nav-bottom`
  bu yüzden ayrıca her render sonrası eşitleniyor; ölçümler o yolu doğruluyor.
- Konsoldaki `footerRef is not defined` hatası düzenleme sırasındaki HMR ara
  durumundan kalma; yeniden yüklemelerde tekrarlamıyor, sayfa hatasız çiziliyor.

## 6. Açık / yapılmayanlar

- Font alt kümesi (§3) — fontTools yok.
- `@react-three/*` ayrı chunk'a alınmadı (gerek yok, tembel grafikte).
- `three` için 500 kB uyarısı bilerek bırakıldı; `chunkSizeWarningLimit`
  değiştirilmedi.
- Sahne şeridinin dar ekranda menüye taşınması (kalıcı çözüm) yapılmadı; bu tur
  yalnız CSS ile konumlandırma.
- Gerçek telefon donanımında doğrulama yapılmadı (ROADMAP §C/1 ve A5 kapsamı);
  buradaki ölçümler masaüstü tarayıcı emülasyonundan.
