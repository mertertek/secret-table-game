# D15 — Koltuktan tahtaya eğilme (birinci şahıs tahta bakışı)

Tarih: 2026-09-12 11:20–12:05 · Ajan: Claude (Opus yan ajan) · Durum: **teslim, kullanıcı doğrulaması bekliyor**
Sözleşme (`packages/contracts`), sunucu ve `packages/game-core` DEĞİŞMEDİ. Yeni bağımlılık yok. Commit yok.

## 1. İstek

Kullanıcı 2026-09-12: *"yukarıdan görmeye gerek yok; bir tuş ekleyelim, tuşa basınca kafamız
ortadaki kartları gösteren bir geçişle kartların üstüne gitsin, birinci açıdan çıkmadan
kartların durumunu görelim."*

Önceki davranış: koltuk kipinde "Tahta" düğmesi `cameraFrame('fascist')` ile neredeyse tepeden
(göz y ≈ 1,81 · eğim ≈ 74°) bir inceleme kamerasına atlıyordu — birinci şahıstan çıkıyordu.

## 2. Kullanım

| Giriş | Koltuk (birinci şahıs) | Genel masa |
| --- | --- | --- |
| Araç çubuğu **Tahta** | eğilmeyi aç/kapat (`aria-pressed`) | **değişmedi**: tepeden `fascist` incelemesi |
| `B` | eğilmeyi aç/kapat | iş yapmaz (rozet de gösterilmez) |
| `Esc` | eğilmedeyse masaya döner | dokunulmaz (tam ekran/kilit çıkışı aynen) |
| `V` (genel masaya geç) | eğilme kapanır | — |
| Oyun sonu | eğilme kapanır | tahta incelemesi de kapanır |

- Eğilmedeyken alt kısayol şeridi: `B Masaya dön` ve `1–N Seç · eller gizli`.
  Eller çizilmediği için kart seçimi alt seçenek çubuğundan (rakam / tıklama) yapılır;
  seçim–onay–gönder yolu değişmedi.
- Faz değişimi ve yeniden bağlanma eğilmeyi BOZMAZ (durum uygulamada: `GameScreen.boardInspection`).
- Duyurular, isim etiketleri, durum şeridi ve HUD eğilmede görünür kalır.

## 3. Kamera

`packages/scene/src/layout/cameraFraming.ts` → saf `leanFrame(chair, width, height)`
(`{ eye, target, fov }`):

- Bakılan nokta iki tahtanın ortası `LEAN_TARGET = (0, .02, −.12)` (liberal z −.4, faşist z .16).
- Göz **kendi koltuğunun tarafında** kalır: merkezden koltuğa doğru `offset` kadar geride,
  koltuktan merkeze olan yatay yönde ilerleyip ~48° eğimle yükselir. Yakın (faşist) tahta ekranda
  altta ve büyük, uzak (liberal) tahta üstte — tepeden dik bakış değil.
- Dikey fov, iki tahtanın **dört köşesinin** kamera uzayına izdüşümünden hesaplanır (%7 kenar payı),
  40°–90° arasında kırpılır. Kırpma tavana dayanırsa (telefon dikey) göz geriye değil
  **yukarı** kaçar ve kadraj oturana kadar bir tık daha yükselir.

Ölçülen değerler (yerel koltuk `chair = [0, −.74, 2]`, canlı `data-fp-camera-*`):

| Ekran | göz (x, y, z) | fov | eğim | koltuk gözü |
| --- | --- | --- | --- | --- |
| 1920×1080 | 0 · **1,375** · 1,100 | 43,9° | 48° | 0 · .51 · 2,035 |
| 1440×900 | 0 · 1,375 · 1,100 | 48,3° | 48° | aynı |
| 390×844 (telefon dikey) | 0 · 2,475 · 1,283 | 83,1° | 60° | aynı |
| *(eski tepeden inceleme, 1440×900)* | 0 · 1,813 · 0,689 | 40° | ~74° | — |

Geçiş: `SeatCamera` uçuşu eğilmede **500 ms** (diğer kamera geçişleri eskisi gibi 620 ms),
`smooth()` ease-in-out + **hafif yay** (`+.12·sin(π·t)`, önce yükselir sonra iner). Dönüş aynı yol.
`prefers-reduced-motion` (ve askıdayken) anında yerleşir — mevcut kural.

Göz gezdirme: eğilmede bakış **±12° yaw / ±8° pitch** ile sınırlı. Sınır iki yerde birden uygulanır:
`useSceneControls` eğilmeye girerken bakışı çapalar ve **kanalı** o pencerede tutar (eğilmeden
çıkınca koltuk yönü kaymaz), `SeatCamera` de kadrajı ayrıca kırpar.

## 4. Sahne tarafı

- Eğilmede `HandRig` **mount edilmez** (eller ve tutulan kartlar çizilmez); kamu kolları,
  karakterler, masa ve oda aynen durur. Ölçüm: 1920×1080'de çizim **181 → 133**, üçgen 248 878 → 214 564.
- Avize + tavan göbeği eğilmede gizlenir (`Room` yeni `overhead` propu). Telefon dikeyde göz avize
  halkasının (zeminden 2,76 m) hizasına çıkıyor ve avize tahtaları tümüyle kapatıyordu; D2'nin
  "genel bakış/tahta incelemesinde avize gizlenir" kuralının doğal uzantısı. **Sis koltuk kipinde
  kalır** (kamera oda içinde), avize ışığı da durur.
- Eğilmede nişangâh, sahne hedeflemesi ve `st-inspection-detail` şeridi çizilmez; `privateReady`
  eskisi gibi `false`.
- `/dev/scene` ve prototip şeridindeki düğme koltukta artık **"Tahtaya eğil"**, genel bakışta
  "Tahtayı incele".

## 5. Değişen / yeni dosyalar

Yeni fonksiyon ve testler dışında dosya eklenmedi.

| Dosya | Değişiklik |
| --- | --- |
| `packages/scene/src/layout/cameraFraming.ts` | `InspectionMode` + `'lean'`; `LEAN_LOOK`, `LEAN_TARGET`, `BOARD_SPAN`, `LeanFrame`, `leanFrame()` |
| `packages/scene/src/prototype/SeatCamera.tsx` | `tableInspection === 'lean'` dalı (kadraj + göz gezdirme), geçişe `duration` + `arc` |
| `packages/scene/src/layout/presentation.ts` | `BoardInspection` + `'lean'`, `boardInspectionForToggle()` |
| `packages/scene/src/live/useSceneControls.ts` | `lean` girdisi: eğilmede bakış açık ama çapalı pencerede |
| `packages/scene/src/TableScene.tsx` | eğilmede el yok, avize yok, alt inceleme şeridi yok; sahne düğmesi koltukta eğiliyor |
| `packages/scene/src/room/Room.tsx` | yeni `overhead` propu (varsayılan `seat`) |
| `apps/web/src/immersive/controlScheme.ts` | `lean-board` (`KeyB`/`b`), `exit-lean` (`Escape`), `LeanState`, HUD ipuçları |
| `apps/web/src/immersive/useTableControls.ts` | `lean` + `onLeanBoard`; `Esc` yalnız eğilmedeyken iş yapar, varsayılanı hiç engellemez |
| `apps/web/src/ui/GameScreen.tsx` | `boardInspection` + `'lean'`, koltuk/genel ayrımı, genel bakışa ve oyun sonuna geçişte kapanma |
| `apps/web/src/ui/SceneFrame.tsx` | prop tipi genişledi |
| Testler | `cameraFraming.test.ts` (+6 blok), `presentation.test.ts` (+1), `controls.test.tsx` (+5), `GameScreen.test.tsx` (+3, 1 güncellendi) |

D11 odak modeli ve araç çubuğu düzeni değişmedi (aynı düğme, yeni davranış).
Başka ajanın çalıştığı `packages/scene/src/props/*` dosyalarına dokunulmadı.

## 6. Testler (gerçekten geçen)

```
pnpm -r typecheck                     # 6/6 paket
pnpm test                             # 717 test (önce 681)
pnpm --filter @secret-table/web build # geçti
```

Dağılım: contracts 11 · fixtures 39 · game-core 98 · **scene 308** (önce 280) · server 44 ·
**web 217** (önce 209).

Yeni testler:

- `cameraFraming.test.ts` — 16:9, 16:10, 21:9, 9:16, 390×844, 768×1024 ve 390×380'de iki tahtanın
  dört köşesi de görüş piramidinde (`|ndc| < 1`) ve tahta genişliği ekranın ≥ %80'i; göz koltuk
  tarafında, merkezin karşısına geçmiyor ve koltuğun gerisine kaçmıyor; eğim 40–70° (yatayda 45–55°),
  göz .51 m'nin üstünde 2,6 m'nin altında, fov 40–90 (16:9 ve daha geniş: 40–44); telefon dikeyde
  yakın tahta ekranda daha aşağıda; yan koltukta kadraj koltuğa göre dönüyor.
- `presentation.test.ts` — `lean` çözümlemesi ve koltuk/genel ayrımı.
- `controls.test.tsx` — `KeyB`/`Escape` eşlemesi; B yalnız koltukta eğiliyor; Escape yalnız
  eğilmedeyken iş yapıyor ve `preventDefault` etmiyor; HUD şeridinde `B Tahta` / `B Masaya dön` /
  `Seç · eller gizli`; eğilmedeyken rakam + Enter ile gönderim çalışıyor.
- `GameScreen.test.tsx` — "Tahta" koltukta `lean`, genel masada `fascist`; `B`/`Esc` döngüsü;
  genel bakışa geçiş eğilmeyi kapatıyor.

## 7. Kareler — `docs/qa/claude/d15/`

| Dosya | Ne |
| --- | --- |
| `seat-normal.jpg` | 1920×1080 koltuk, eller ve kartlar; tahtalar okunmuyor (sorun) |
| `lean-mid-t250.jpg` | geçişin ortası (t ≈ 250 ms, `data-fp-camera-moving="true"`) |
| `lean-16x9.jpg` | 1920×1080 eğilme: iki tahta tam ve okunur, kendi tarafından perspektif |
| `lean-look-limit.jpg` | eğilmede 57°'lik fare sürüklemesi yalnız ±12°/±8° oynatıyor |
| `lean-back-to-seat.jpg` | `B` ile dönüş: eller ve avize geri, koltuk yönü korunmuş |
| `lean-hand-hud.jpg` | 1440×900, elinde 3 kart varken eğilme + alt HUD şeridi |
| `phone-seat-normal.jpg` | 390×844 koltuk |
| `lean-phone-portrait.jpg` | 390×844 eğilme: tahtalar arka arkaya, genişliğe oturuyor |
| `overview-board-unchanged.jpg` | genel bakış "Tahta" — eski tepeden inceleme aynen |

Üretim: `scratchpad/d15-shots.mjs` (Playwright + `/dev/game?fixture=president-discard`), konsol hatası yok.

## 8. Sapmalar

1. **fov 40–44 yalnız 16:9 ve daha geniş ekranda.** Kadraj eğilme POZUNU sabit tutup fov'u
   hesaplıyor (kod tabanındaki koltuk kamerası idiomu). 16:10'da 48,3°, kare ekranda ~70°,
   telefon dikeyde 83° olur. Alternatif (fov sabit, mesafe değişken) 16:9'da gözü 1,38 → 1,51 m'ye
   çıkarıyordu; daha alçak baş tercih edildi.
2. **Telefon dikeyde göz 2,48 m'ye çıkar ve eğim 60° olur.** 1,94 m genişliğindeki iki tahtayı
   9:16'da kadraja sığdırmanın başka yolu yok (eski tepeden inceleme aynı ekranda 5,7 m'ye
   çıkıyordu). Tahtalar arka arkaya ve genişliğe oturur ama yazılar küçüktür.
3. **Eller geçişin başında kaybolur** (HandRig mount edilmez), yolda solmaz. Kullanıcı isterse
   geçiş boyunca tutup sonunda gizleme eklenebilir.
4. **Avize eğilmede gizlenir** (yalnız geometri; ışık durur) — telefon dikeyde kadrajı kapattığı için.
5. `Esc` eğilmeyi kapatır ama tarayıcı aynı tuşta Pointer Lock'u da bırakır (engellenemez);
   "Bakışı etkinleştir" akışı eskisi gibi çalışır. `B` bu yüzden birincil yoldur.

## 9. Canlı doğrulama adımları (kullanıcı)

1. `pnpm --filter @secret-table/web dev --port 5199 --strictPort` → lobi → bot modu ile oyuna gir.
2. Koltuk kamerasındayken `B` (veya sağ üst **Tahta**): baş 500 ms'lik yay ile tahtaların üstüne
   eğilmeli, iki tahta da tam görünmeli, eller kaybolmalı.
3. Eğilmedeyken fareyi gezdir: görüş yalnız biraz oynamalı; `B` ya da `Esc` ile dönünce koltuk
   yönü kabaca aynı kalmalı ve eller geri gelmeli.
4. Elinde kart varken eğil (yasama fazı): alt çubuktan `1/2/3` ile kart seçip Enter ile gönder.
5. Faz değiştir (bot oynasın): eğilme korunmalı. `V` ile genel masaya geç: eğilme kapanmalı,
   oradaki **Tahta** eski tepeden incelemeyi açmalı.
6. Telefonda (dikey) aynı düğme: tahtalar arka arkaya ve genişliğe oturmuş olmalı.
