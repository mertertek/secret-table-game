# D11 — Tam ekran deneyimi

Tarih: 2026-09-11 · Ajan: Claude (Opus) · Durum: **teslim, kullanıcı doğrulaması bekliyor**
Sözleşme (`packages/contracts`) ve `docs/design/**` değişmedi. Yeni bağımlılık yok. Commit yok.

## 1. Kullanıcı gözlemi ve teşhis

| # | Gözlem | Kök neden |
| --- | --- | --- |
| A | Kart seçip Enter ile onaylayınca tam ekrandan çıkıyor | "Oyuna odaklan" düğmesi FAREYLE tıklanınca DOM odağını tutuyordu ve etiketi "Odağı bırak" oluyordu. `useTableControls` "odak tıklanabilir hedefte" muafiyeti ile Enter'ı native bırakıyordu → Enter düğmeyi tıklıyor → `immersive.exit()` → Pointer Lock + tam ekran düşüyor. Aynı tuzak Menü ve kamera düğmeleri için de vardı. |
| B | Tam ekranda sağ üstteki düğmeler üst üste biniyor | Üç bağımsız katman aynı köşedeydi: sahne paketinin `.st-inspection-nav` (absolute top 10 right 10), HUD `game__top-actions` (`margin-top: 36px` sabit ofsetle altına itilmiş), `Özel bilgin` rol paneli (`top: 56px`). Sarmalar/daralmalarda üçü çakışıyordu — `docs/qa/claude/d11/before-topright.png`. |

Kanıt: `before-topright.png` — "Genel masa / Masaya dön / Tahtayı incele / Kimliği kapat" şeridi
üstte, "Oyuna odaklan / Menü" onun altında, `Özel bilgin` paneli ikisinin de üstünde.

## 2. Yapılanlar

### 2.1 Odak modeli (A'nın çözümü)

- `.game` kabı `tabIndex={-1}`; immersive'e girince (Pointer Lock **ya da** yalnız tam ekran)
  `focus({ preventScroll: true })` ile klavye odağı kaba taşınır. `.game:focus` halkası yok.
- Üst şerit ve alt çubuktaki düğmelerde `mousedown` varsayılanı engellenir (`keepGameFocus`) ve
  odak hemen kaba döner: **fareyle tıklanan HUD düğmesi DOM odağını hiç almaz**. `input/select/
  textarea` hariç tutulur (menü kaydırıcısı bozulmaz); `GameMenu` diyaloğuna dokunulmadı.
- `useTableControls`: "odak tıklanabilir hedefte → Enter/E native" muafiyeti artık yalnız
  **gerçek klavye odağında** geçerli (`:focus-visible` + son gezinmenin Tab olduğu izi;
  `keepsNativeActivation`). Fare odağında Enter/E oyun komutudur ve `preventDefault` edilir.
  → Enter ile onay tam ekranı **asla** düşürmez.
- `exit()` yolu değişmedi: yalnız Esc (tarayıcı), menü ve açık düğme. Kaza yolu kapandı.

### 2.2 Tek sağ üst araç çubuğu (B'nin çözümü)

- `packages/scene`: `TableScene` yeni (sözleşme dışı) `showInspectionNav` propu alır.
  Üretimde `GameScreen` `false` verir → sahne kendi `.st-inspection-nav` şeridini **çizmez**.
  Varsayılan `true`: `/dev/scene` ve prototip sayfaları aynen çalışır.
- Kamera/inceleme eylemleri HUD'a taşındı; tek satır:
  `[Genel masa | Kendi koltuğum | Özel alan | Tahta] · [Oyuna odaklan/Odağı bırak] · bağlantı · [Menü M]`.
  Kamera zaten `onIntent set_camera` / `prefs.cameraMode` ile uygulamadaydı; "Özel alan"
  `inspect_own_role` (H ile aynı yol); "Tahta" yeni `boardInspection` durumudur ve sahneye
  tek kaynak olarak iner (`resolveInspectionMode`). İkisi karşılıklı dışlar.
- `--hud-top`: `GameScreen` `.game__top` yüksekliğini ölçüp CSS değişkeni yazar
  (ResizeObserver + her render). Rol paneli, ipucu ve duyuru katmanı bu değişkenden iner;
  **hiçbir katman sabit piksel ofsetiyle başka katmanı varsaymaz**. Eski
  `margin-top: 36px`, `padding-top: 62px`, `top: 92px/76px/40px` kuralları kaldırıldı.
- Dar ekranda çubuk sarar, binmez (`phone-top.png`).
- `st-inspection-detail` (alt kamera açıklaması): sahne kökü `data-scene-nav="false"` olduğunda
  ölçülen `--st-nav-bottom` ile **ActionBar'ın hemen üstüne** oturur (`after-inspect-panel.png`).

### 2.3 Tam ekran cilası

- `:fullscreen` düzeni + `env(safe-area-inset-*)`: `.game` üzerinde `--safe-top/right/bottom/left`
  değişkenleri; üst şerit ve alt çubuk dolguları bunları ekler (çentikli telefon / yuvarlak köşe).
- Pointer Lock etkinken **3 s** hareketsizlikte üst araç çubuğu ve alt tuş ipuçları %0 opaklığa
  iner; fare hareketi / tıklama / tekerlek / tuş geri getirir. **Durum şeridi ve ActionBar
  seçenekleri görünür kalır**; **sıra sendeyken (statusLine tone `you`) asla gizlenmez**.
  Menü açıkken de gizlenmez. `prefers-reduced-motion` altında geçiş animasyonu yok.
- Tam ekrana **ilk** girişte 4 s "Enter onaylar · Esc odağı bırakır · M menü" ipucu; bir kez,
  `usePrefs.fullscreenHintSeen` ile hatırlanır.
- `needsResume` mantığı korundu: Esc ile kilit düşünce "Bakışı etkinleştir" akışı aynen çalışır;
  tam ekrandan tümüyle çıkınca `needsResume` temizlenir (değişmedi).

## 3. Testler (gerçekten geçen)

```
pnpm -r typecheck                     # 6/6 paket, hata yok
pnpm test                             # 547 test geçti (önce 532)
pnpm --filter @secret-table/web build # geçti
```

Test dağılımı: contracts 11 · fixtures 33 · game-core 70 · **scene 203** (önce 197) ·
server 35 · **web 195** (önce 187).

Yeni/değişen testler:

- `apps/web/src/immersive/controls.test.tsx`
  - *KLAVYEYLE (Tab) odaklanmış düğmede Enter yöneticide çift hamle üretmez* — native kalır,
    `preventDefault` yok.
  - *FAREYLE odaklanmış düğmede Enter oyun komutudur ve varsayılanı engeller* — `submitSelected`
    bir kez, `preventDefault` çağrıldı (A'nın regresyon testi).
- `apps/web/src/ui/GameScreen.test.tsx` (+6)
  - tek araç çubuğu (`role="toolbar"`) dört kamera/inceleme düğmesi + odak + bağlantı + menü;
    üst şeritte ikinci düğme katmanı yok.
  - sahneye `showInspectionNav={false}` gider.
  - `--hud-top` `.game` üzerine yazılır; rol paneli üst şeritten sonra gelir.
  - "Tahta" düğmesi `boardInspection`ı sahneye tek kaynaktan verir (off → fascist → off).
  - HUD düğmesinde `mousedown` varsayılanı engellenir; odak `.game` kabında kalır.
  - kilitliyken 3 s'de HUD solar, fare hareketi geri getirir; **sıra sendeyken solmaz**.
  - tam ekran ipucu 4 s sonra kapanır ve yeniden girişte çıkmaz.
- `packages/scene/src/layout/presentation.test.ts` (+6) — `inspectionNavVisible` **varsayılanı
  `true`** (dev/prototip sayfaları bozulmaz), yalnız açık `false` şeridi kaldırır;
  `resolveInspectionMode` önceliği (özel alan > uygulama tahta denetimi > sahne yerel kipi);
  `boardInspectionForMode`.

## 4. Görsel kanıt — `docs/qa/claude/d11/`

Dev sunucu: `pnpm --filter @secret-table/web dev --port 5199 --strictPort` (arka planda, iş
bitince kapatıldı; 5173'e dokunulmadı). Playwright headless Chrome, 1440×900 @2x
(telefon 390×844 @2x), `/dev/game`. Konsol hatası yok.

> **Sınır (bilinçli):** headless tarayıcıda gerçek Fullscreen ve Pointer Lock kurulamaz
> (kullanıcı hareketi + gerçek pencere gerekir). Aynı düzeni almak için `.game` kabına
> `data-immersive="locked"` / `data-hud-idle="true"` elle yazıldı. `:fullscreen` kuralı zaten
> yalnız kabı 100dvw/dvh yapıyor, o da normal görünümde geçerli. **Gerçek tam ekran + kilit
> davranışı aşağıdaki canlı doğrulama adımlarıyla kullanıcıda kontrol edilmelidir.**

| Kare | Ne gösteriyor |
| --- | --- |
| `before-topright.png` | HATA: sahne şeridi + HUD şeridi + `Özel bilgin` paneli üst üste |
| `after-topright.png` | Tek satır araç çubuğu; rol paneli tam altına iner, binme yok |
| `after-inspect-panel.png` | "Tahta" incelemesi; alt açıklama şeridi ActionBar'ın üstünde |
| `after-hidden-hud.png` | Kilitli + hareketsiz: araç çubuğu ve tuş ipuçları soldu; durum şeridi ve "Hazırım" duruyor |
| `phone-top.png` | 390×844: çubuk iki satıra sarar, binmez |

Betik: `scratchpad/d11-shots.mjs` (`node scratchpad/d11-shots.mjs before|after 5199`).
`before-topright.png` için çalışma ağacı geçici olarak `git stash` ile HEAD'e alındı, kare
çekildi, `git stash pop` ile geri yüklendi (ağaç doğrulandı).

## 5. Kullanıcı canlı doğrulama adımları

Gerçek tarayıcıda (`pnpm dev`, oyun ekranı):

1. **Enter tam ekranı düşürmüyor:** "Oyuna odaklan"a **fareyle** bas → tam ekran + bakış kilidi.
   Bir kart/oyuncu seç (tıkla ya da `1`), **Enter** ile onay adımını aç, **Enter** ile gönder.
   Tam ekran ve kilit **düşmemeli**. Aynısını Menü ve kamera düğmelerine tıkladıktan sonra da dene.
   (Klavye kullanıcısı: Tab ile bir düğmeye gel → Enter o düğmeyi tıklamalı, eski davranış.)
2. **Sağ üst:** Tam ekranda sağ üstte **tek satır** olmalı:
   Genel masa | Kendi koltuğum | Özel alan | Tahta · Odağı bırak · bağlantı noktası · Menü.
   `H` ya da "Özel alan" ile kimlik panelini aç → panel çubuğun **altında** başlamalı, hiçbir
   düğmeyi kapatmamalı. Pencereyi daralt: çubuk sarmalı, binmemeli. "Tahta"ya bas → alt açıklama
   şeridi eylem çubuğunun üstünde durmalı.
3. **Gizlenme:** Kilit açıkken ve **sıra sende değilken** fareyi 3 s kıpırdatma → üst çubuk ve alt
   tuş ipuçları kaybolmalı; durum şeridi kalmalı. Fareyi oynat → geri gelmeli.
   Sıra sana gelince gizlenmemeli.
4. **İpucu:** İlk kez tam ekrana girişte 4 s "Enter onaylar · Esc odağı bırakır · M menü" çıkmalı,
   sonraki girişlerde çıkmamalı. (Tekrar görmek için tarayıcı deposundan
   `secret-table:prefs` → `fullscreenHintSeen` temizlenir.)
5. **Esc:** Tam ekranda Esc → kilit düşer, "Bakışı etkinleştir" kontrolü çıkar; tekrar Esc →
   tam ekrandan çıkılır ve HUD normal düzene döner.

## 6. Değişen dosyalar

```
apps/web/src/immersive/useTableControls.ts     odak izleyici + native muafiyeti daraltıldı
apps/web/src/immersive/controls.test.tsx       fare/klavye odağı testleri
apps/web/src/ui/GameScreen.tsx                 tek araç çubuğu, --hud-top, odak, idle, ipucu
apps/web/src/ui/GameScreen.test.tsx            +6 test
apps/web/src/ui/SceneFrame.tsx                 showInspectionNav / boardInspection geçişi
apps/web/src/ui/usePrefs.ts                    fullscreenHintSeen
apps/web/src/ui/styles.css                     araç çubuğu, --hud-top, safe-area, idle, ipucu
packages/scene/src/TableScene.tsx              showInspectionNav + denetimli tahta incelemesi
packages/scene/src/index.ts                    yeni yerleşim propları/yardımcıları dışa aktarımı
packages/scene/src/layout/presentation.ts      inspectionNavVisible / resolveInspectionMode
packages/scene/src/layout/presentation.test.ts +6 test
packages/scene/src/layout/inspection.css       nav yokken açıklama şeridi ActionBar üstünde
```
