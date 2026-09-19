# PERF-C1 — gerçek Chrome ölçümü (2026-09-10)

Araç: `scratchpad/perf-measure.mjs` ve `scratchpad/perf-profile.mjs` (Playwright + sistem
Chrome headless, ANGLE Metal, GPU: Apple M2). Dev sunucu `/dev/game?fixture=…`, ağ/oda yok.
Ham veriler: `docs/qa/claude/perf/*.json`. Bunlar M2 masaüstü sayılarıdır; telefon GPU'su
ölçülmedi, yalnız CPU 4× yavaşlatma ile JS payı kestirildi.

## 1. Çizim bütçesi (1440×900)

| Masa | Kalite | Çizim çağrısı | Üçgen | Doku / geometri |
| --- | --- | ---: | ---: | --- |
| 7 kişi (president-discard) | standard | 222–237 | 86.7k | 42 / 144 |
| 7 kişi | low | 119–122 | 39.7k | 40 / 127 |
| 10 kişi | standard | 235 | 100.7k | 35 / 149 |
| 10 kişi | low | 120 | 43.2k | 33 / 132 |

Standard yaklaşık 120 çağrı hedefinin iki katı; low hedefte.

## 2. Kare hızı (5 s sürekli çizim)

| Koşul | Standard koltuk (sürükleme) | Low koltuk | Standard genel (kamera uçuşu) |
| --- | ---: | ---: | ---: |
| DPR 1 | 59.7 (vsync tavanı) | 59.6 | 44.7 sahne / 54 rAF |
| DPR 2 (retina 2160×1350) | 59.6 | 59.6 | 47.9 / 57.3 |
| DPR 2 + CPU 4× yavaş | **33.4** | **40.2** | 28.1 / 37 |

- M2'de GPU sınır değil; retina standard bile 60'a takılıyor.
- CPU 4× yavaşlatınca kare hızı JS'ye bağlı düşüyor: **darboğaz kare başına JS/CPU işi.**
- Boşta çizim: 3 s pencerede 0 kare (talep döngüsü doğru; dağıtım animasyonu bitince duruyor).
- İlk sahne karesi: 0,8–2,2 s (dev sunucu, ilk shader derlemesi dahil; üretimde ayrı ölçülmeli).

## 3. CPU profili (standard koltuk, sürükleme, DPR 2, 60 FPS'te)

Self-time: boşta %52,6; **React eleman üretimi (`jsxDEV`/`ReactElement`) %14,6**;
**R3F uzlaştırıcı (`diffProps`, `commitUpdate`…) %12,8**; Three.js render %4,2; sahne kodu <%1.

Yorum: `useSceneControls` bakışı React state'i (`setLook`) olarak tutuyor; her sürükleme
karesinde `SceneSession` yeniden render oluyor, yüzlerce JSX düğümü yeniden üretiliyor ve
R3F her prop'u karşılaştırıyor. Three.js'in kendisi ucuz. Dev derlemede `jsxDEV` maliyeti
üretimden yüksektir ama desen aynıdır.

## 4. Karar → C3 (ölçümle)

1. Bakış (yaw/pitch) React state'inden çıkar: ref + `useFrame` içinde kamera/ el rig'i doğrudan
   güncellenir, `invalidate()` ile kare istenir; `onLocalViewpoint` rAF eşiği korunur.
2. Uzak baş örnekleri (`ViewpointAdapter.update`) render'da değil `useFrame`'de.
3. Gölge haritası 2048 → 1024 (standard); low'da gölge zaten kapalı.
4. Dokunmatik/zayıf cihazda ilk açılışta otomatik `low` (coarse pointer, `deviceMemory ≤ 4`,
   `hardwareConcurrency ≤ 4`); kullanıcı tercihi üstün.
5. Çizim çağrısı: sandalye/avatar/kart tekrarları için instancing (ikinci tur, ölçüm sonrası).

Kabul: aynı betikle CPU 4× standard koltuk ≥ 50 FPS hedefi; profilde React+R3F payı yarıya
insin; 330+ test, typecheck, build geçsin; görsel fark yok.

## 5. Yükleme (canlı Vercel, bu makineden, sıkıştırılmış)

Giriş JS 82 + 94 kB (React), sahne 80 kB + three 198 kB (geç), **fontlar 1,17 + 1,08 MB**.
Telefonda oyuna girişte en büyük indirme fontlar; alt küme (fontTools) hâlâ açık.
