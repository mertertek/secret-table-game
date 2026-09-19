# D3 — Karakterler: plan (2026-09-11, kod yok)

Durum: **plan, kullanıcı onayı bekliyor; uygulama başlamadı.** Kullanıcı yönü: "karakterler
ufak kaldı, daha büyük olmalı; daha yuvarlak hatlı, komik ve samimi; gerçekçi/profesyonel
çizim değil, eğlenceli; tek tasarım değil, oyuna girerken seçilebilen birkaç karakter (Secret
Hitler'deki gibi)."

## 1. Bugünkü durum (ölçüldü)

- `ArticulatedAvatar.tsx`: küre baş r 0,135 m, gövde silindir 0,36 m, iki silindir kol; sandalye
  grubunda oturmuş boy ≈ 0,70 m. Masa yarıçapı ~2,3 m, sandalyeler 2,64 m'de → karakter masaya
  göre küçük okunuyor; koltuk kamerasından karşıdaki baş ~28 px.
- 4 ten + 4 ceket rengi koltuk sırasına göre döner; seçim yok. Rol ima eden hiçbir şey yok
  (sözleşme kuralı, korunacak).
- Diğer oyuncuların elleri D1'den (`PublicArms`, SDF pişirilmiş). Baş yönü kanalı çalışıyor
  (`PeerHeads`), etiket başın üstünde y = 0,48 (D6).
- Sözleşmede avatar alanı yok (`PlayerView`), `room_members`'da sütun yok.

## 2. Stil yönü

- **Yuvarlak, "chibi" oran:** baş oturmuş boyun ~%40'ı (baş r ≈ 0,20 m), kısa boyun, yumuşak
  omuz, küt kollar, büyük gözler, küçük burun, ağız ifadesi. Sert kenar yok; her parça SDF
  kapsül/elipsoid yumuşak birleşimi (D1 ellerle aynı üretim yolu, tek parça mesh).
- **Boyut:** oturmuş boy 0,70 → **~1,00 m** (×1,4); baş tepesi masa yüzeyinden ~0,75 m yukarıda.
  Sandalye, koltuk kamerası göz yüksekliği (0,56) ve etiket yüksekliği (0,48) birlikte
  yeniden ayarlanır; masa/sandalye ölçüleri değişmez, kamera hedefi büyür.
- **Komik ve samimi:** kaşlar ve ağız ile 4 ifade (nötr, gülümseme, şaşkın, somurtkan) — ifadeler
  oyun durumundan değil, emote'tan gelir (B5); varsayılan hafif gülümseme. Göz kırpma idle.
- **Renk:** oyunun paleti (ceviz, keçe yeşili, krem, pirinç) + karakter başına 1 vurgu rengi.
  Parti renkleri (liberal mavi, faşist kırmızı) hiçbir karakterde kullanılmaz.

## 3. Karakter seti (ilk sürüm 8 karakter, hepsi parti-nötr)

| # | Çalışma adı | Ayırt edici | Vurgu |
| --- | --- | --- | --- |
| 1 | Bıyıklı Amca | kalın bıyık, kel, yelek | bordo |
| 2 | Gözlüklü | yuvarlak gözlük, düz saç, kazak | hardal |
| 3 | Topuzlu | topuz saç, küpe, ceket | zümrüt |
| 4 | Fötr | fötr şapka, ince bıyık, papyon | lacivert |
| 5 | Sakallı | dolgun sakal, bere | turuncu |
| 6 | Kıvırcık | kabarık kıvırcık saç, fular | mor |
| 7 | Bereli Teyze | bere, gözlük zinciri, hırka | pembe |
| 8 | Çocuk Kalpli | kepli, çilli, tişört | açık mavi |

Her karakterde 3 ten tonu seçeneği; 8 × 3 = 24 kombinasyon. Odada aynı karakter iki kişide
olabilir (ten/isim ayırır); ilk sürümde benzersizlik zorunlu değil.

## 4. Teknik yol (D1 ile aynı boru hattı)

1. **Taban gövde:** tek SDF alanı (baş, gövde, kollar, kısa bacaklar oturmuş) → marching cubes →
   tek `BufferGeometry` (standard ≤ 6k üçgen, low ≤ 2,5k) → 8 kemik (baş, boyun, omurga, 2 omuz,
   2 dirsek, kalça) `SkinnedMesh`. Baş yönü kanalı boyun kemiğine bağlanır.
2. **Aksesuar katmanı:** saç/şapka/gözlük/bıyık/sakal ayrı küçük SDF ilkelleri, taban alana
   eklenip aynı mesh'te pişer (ekstra çizim yok). Karakter tanımı = JSON (ilkel listesi + renk).
3. **Yüz:** göz, kaş, ağız tek küçük tuval dokusu (`PrintedFace` gibi) baş yüzeyine projeksiyon;
   ifade değişimi doku yeniden çizimi. Gölge yok, unlit değil (ten ışık alır).
4. **Bütçe:** oyuncu başına ≤ 3 çizim (gövde, yüz, eller PublicArms), 10 kişide ≤ 30 ek çizim;
   üretim karakter başına < 120 ms, önbellek (aynı karakter tekrar üretilmez).
5. **Seçim verisi (B3):** `room_members.avatar` (`text`, örn. `"bereli-teyze:2"`, additive
   migration 0008), `PlayerView.avatar` (sözleşme 0.3.0 additive), lobi seçici (D8 tasarımındaki
   "Karakterin" kartı zaten yer ayırdı), `set_avatar` HTTP eylemi, sadece lobi fazında.
6. **Yerel oyuncu:** koltuk kamerasında kendi gövdesi görünmez (bugünkü gibi), elleri D1.

## 5. Adımlar (her biri kullanıcı görsel kabulüyle kapanır)

| Adım | İş | Çıktı |
| --- | --- | --- |
| D3.1 | Tasarım sayfası: 8 karakter dizilimi, oran şeması, yüz ifadeleri, ten/vurgu renkleri (Fable) | `docs/design/d3/lineup.svg`, `D3-characters.md` |
| D3.2 | Taban gövde + 1 karakter + ölçek/kamera/etiket ayarı (Opus) | `/dev/scene` önce/sonra kareler |
| D3.3 | 8 karakter tanımı + yüz dokusu + ifade seti | karakter galerisi karesi |
| D3.4 | B3 seçim: migration, sözleşme, API, lobi seçici, sahne bağlantısı | canlı lobi seçim kanıtı |
| D3.5 | Perf ölçümü (10 kişi, CPU 4×) ve low kademe | `docs/qa/claude/D3-characters.md` |

Ön koşul: D8 lobi kodu (seçici arayüzü orada yaşayacak). D3.1–D3.3 D8'den bağımsız yapılabilir.

## 6. Riskler

- Chibi oranla baş büyürken el (D1) ve kart ölçüleri gerçekçi kaldı; uyumsuzluk görülürse eller
  ×1,15 ölçeklenir (SDF parametrik, kolay).
- Ölçek artınca sandalye ve masa kenarı oranı bozulabilir; sandalye modeli D2 (oda) turunda
  yenilenir.
- 8 karakter × 3 ten önbelleği bellek: ~24 × 6k üçgen ≈ 20 MB; yalnız odada seçilenler üretilir.
- Yüz dokusu 10 kişide 10 küçük tuval; 256² yeterli.
