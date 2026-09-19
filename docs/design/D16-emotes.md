# D16 — El jestleri (emote): tasarım notu

Yazar: Claude (Fable 5.1), 2026-09-12. Kodlayan ajan bu dosyayı değiştirmez; sapmaları
`docs/qa/claude/D16-emotes.md`e yazar.

## 1. Amaç

Kullanıcı 2026-09-12: "ellerimizle emote atma; diğer kullanıcılar görecek. İşaret parmağıyla işaret
edeyim, sağa sola döndüğümde elimde dönsün; iki elimi teslim olur gibi kaldırayım; orta parmak;
aklına gelenler". Sosyal blöf oyunu için sözsüz iletişim. Oyun kuralına dokunmaz; sunucu ve DB
görmez; bakış kanalıyla (Supabase Realtime `head` yayını) aynı yoldan gider.

## 2. Jest listesi

| # | Kimlik | Türkçe etiket | El(ler) | Süre | Hareket |
|---|---|---|---|---|---|
| 1 | `point` | İşaret | sağ | 3,0 s (tekrar basınca uzar) | işaret parmağı uzatılmış, kol öne; **bakış yaw'ını izler** (kamu kolu paylaşılan yaw'a döner, pitch ±20° kırpılır) |
| 2 | `hands_up` | Teslim | iki | 3,0 s | iki el açık avuç, omuz hizasının üstüne, avuçlar karşıya; hafif titreme yok |
| 3 | `thumbs_up` | Onay | sağ | 2,5 s | yumruk + başparmak yukarı, göğüs hizasında, 2 küçük sıçrama |
| 4 | `thumbs_down` | Ret | sağ | 2,5 s | aynı grip, bilek 180° dönük, aşağı bastırma hareketi |
| 5 | `middle` | Orta parmak | sağ | 2,5 s | orta parmak uzatılmış yumruk, kol öne-yukarı |
| 6 | `wave` | Selam | sağ | 2,0 s | açık avuç baş hizasında, bilek ±25° 3 salınım |
| 7 | `clap` | Alkış | iki | 2,5 s | açık avuçlar göğüs önünde 4 kez birbirine (bilek 2 cm), ses `clap` (yumuşak çift vuruş) |
| 8 | `facepalm` | Yüz avuçlama | sağ | 2,5 s | açık avuç yüze (kamu: baş önüne, ilk şahıs: kameraya doğru yaklaşıp kadrajın üstünde durur), baş 10° öne |

Yeni kavramalar `docs/design/d1/poses.json` `poses`: `point`, `openPalm`, `thumbUp`, `middleFinger`
(başlangıç değerleri `holdGun`/`rest`ten türetilir; `limits` içinde). `wave/clap/facepalm/hands_up` =
`openPalm`; `thumbs_down` = `thumbUp` + bilek dönüşü.

## 3. Giriş

- Klavye: **`G`** jest paletini açar/kapatır (HUD alt şeridin üstünde 8 çip: rakam + ikon + etiket);
  palet açıkken `1–8` seçer ve palet kapanır; `G` tekrar kapatır; seçenek çubuğu (kart/hedef seçimi)
  açıkken rakamlar seçeneklere gider → palet açılınca seçenek çubuğu geçici gizlenir, kapanınca döner.
- Fare/dokunmatik: alt şeritte "Jest" düğmesi (telefonda görünür), çipe dokunma.
- `point` basılı tutma yok; 3 s'lik tek atış, tekrar basınca süre yenilenir.
- Hız sınırı: 1 jest / 1,2 s (yerel); kanal payload ≤ 120 B.

## 4. Protokol (additive)

`HeadViewpoint`e isteğe bağlı `emote?: { kind: EmoteKind; seq: number; at: number }` (`at` gönderen
epoch ms; alıcı kendi saatine göre `receivedAt` kullanır, `at` yalnız sıralama). Aynı `seq` iki kez
oynatılmaz; `seq` gönderen başına artan. Şema doğrulaması (`viewpointProtocol.ts`) bilinmeyen `kind`ı
düşürür. Bakış paketi 120 ms aralıkla zaten gidiyor; jest anında hemen bir paket gönderilir, 2 tekrar
(250/600 ms) ile kayıp telafi edilir (aynı `seq`).

## 5. Görünüm

- **İlk şahıs**: `LocalMotion` üstünde `EmoteOverlay` katmanı: aktif jest boyunca ilgili elin poz/konumunu
  ezer (kart tutuluyorsa sol el kartları tutmaya devam eder; iki elli jestlerde kartlar 250 ms'de
  masaya "yaslanır" ve jest bitince geri gelir — `ghostBacks` kalıbı). Silah hazır pozundayken
  (`ready`) jestler devre dışı.
- **Kamu**: `ShootingArm` kalıbıyla `EmoteArms`: yalnız jest aktifken mount (pişmiş kavrama eli + bilek
  animasyonu), sonra kaldırılır → boşta ek çizim 0, jest sırasında oyuncu başına ≤ +2. `point` kolu
  paylaşılan bakış yaw'ına döner (bakış paketi ile aynı kaynak: `PeerHeads`). Karakter başı `point` ve
  `facepalm`te ilgili yöne/öne döner (mevcut baş hedefi API'si).
- İsim etiketi: jest süresince küçük ikon (♟ değil; jestin kendi sembolü) — kamera arkasındaki
  oyuncular için. `reducedMotion`: pozlar anında, salınım yok.

## 6. Kapsam dışı

Ses dışında (yalnız `clap`) efekt yok; jest geçmişi/duyurusu yok; sunucu kaydı yok; mobil jiroskop yok.
