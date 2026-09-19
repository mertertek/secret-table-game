# D12 — İnfaz sahnesi: silah, ateş, çöken karakter (tasarım notu)

Yazar: Claude (Fable 5.1), 2026-09-11. Kodlayan ajan bu dosyayı değiştirmez; sapma gerekirse
`docs/qa/claude/D12-execution.md` §"Tasarımdan sapmalar"a yazar.

## 1. Amaç ve ton

Kullanıcı isteği (2026-09-11): infazda başkanın eline silah gelsin, karşıya ateş etsin; oyuncu nişan
almasın, hedef HUD'dan seçilir. Ton D3 ile aynı: tombul, yuvarlak, oyuncak gibi. Kan, kamera sarsıntısı,
gerçekçi silah **yok**. Sunucu ve sözleşme değişmez: motor zaten `player_eliminated` cue'su gönderiyor
(`packages/contracts/src/scene.ts`), atıcı `cueOfficePlayerId(view, 'president')` ile bulunur.

## 2. Silah (prop)

SDF → marching cubes hattı (`packages/scene/src/sdf/primitives.ts`, `hands/marchingCubes.ts`), tek
`BufferGeometry`, köşe rengi, paylaşımlı ve tembel (ilk infazda üretilir, önbellekte kalır). Bütçe ≤ 700 üçgen.
Birimler el şablonu (`docs/design/d1/poses.json` `frame`: bilek orijin, parmaklar −Z, avuç −Y, baş parmak −X, sağ el).

| Parça | İlkel | Ölçü (el birimi) | Renk (palette `prop.gun*`) |
|---|---|---|---|
| Namlu | kapsül, −Z ekseni | uzunluk .15, yarıçap .022; ucu .028 (hafif şişkin, oyuncak) | gövde `#3a3d44` |
| Tambur | tor + yuvarlak kutu | merkez namlu kökünün 0.02 gerisinde, dış yarıçap .036, kalınlık .04 | gövde; oluklar yok |
| Kabza | kapsül, geriye 68° eğik | uzunluk .11, yarıçap .028, alt ucu .032 (şişkin) | ceviz `#7a4a2e` |
| Tetik korkuluğu | tor | yarıçap .028, boru .006 | gövde |
| Namlu ağzı halkası | tor | namlu ucunda, yarıçap .026, boru .007 | pirinç `#c9a24a` |

Birleştirme: polinom smooth-min k=.012 (D1 ile aynı). Kabza avuç çizgisine oturur: `cards.holdGun`
çerçevesi `holdBallot` kart çerçevesinden türetilir; `C ≈ [0, −.050, −.150]`, namlu −Z'ye ve hafif yukarı (+6°).

## 3. Kavrama pozu `holdGun`

`docs/design/d1/poses.json` `poses.holdGun` (kodlayan ekler, `limits` içinde kalır). Başlangıç değerleri,
`holdBallot`tan türetilmiştir; D1 kare aracıyla ayar serbesttir:

- işaret: `index.mcp [.20, −.03]`, `pip .95`, `dip .35` (tetikte kıvrık)
- orta/yüzük/serçe: `mcp [1.25, 0]`, `pip 1.20`, `dip .80` (kabzayı sarar; serçe `mcp [1.30,.08]`)
- baş parmak: `thumb.cmc [−.95, −.30, 1.85]`, `mcp .35`, `ip .55` (kabza arkasına)
- bilek `[0, 0, 0]`; nişan bilekten değil koldan verilir (§4).

## 4. Koreografi (herkes aynı cue'dan başlar)

`durations.player_eliminated` 350 → **2600 ms**. Zaman çizgisi t (ms):

| t | Atıcı (kamu kolu / yerel ilk şahıs el) | Hedef | Ses / efekt |
|---|---|---|---|
| 0–600 | sağ el masa kenarının altından silahla yükselir (silah ölçeği 0→1 ilk 150 ms), kol hedef koltuğa döner (yaw, §5) | — | — |
| 600–1300 | nişan; küçük yerleşme (±2°, 1 sn periyot) | — | — |
| 1300 | **ateş**: namlu ağzında flaş (tek düzlem, ekleme karışım, 90 ms, 6 kollu yıldız), geri tepme: el 2 cm geri + 8° yukarı 120 ms, 200 ms'de döner | 1380'de tepki başlar | `shot` sesi (yeni `SoundKind`: 12 ms gürültü patlaması + 90 Hz vuruş, toplam ≤ .12 s, `end`den sessiz) |
| 1380–2000 | — | gövde yana çöker: kök grup `rotation.z` ±.32 rad (atıcıdan uzağa), `rotation.x` .10, `position.y` −.04; ifade `ko`; etiket gri (mevcut `dead`) | — |
| 2000–2600 | silah iner, ölçek 1→0 son 150 ms, el dinlenmeye | — | — |

Sonrası: `alive === false` olan her karakter **cue olmadan** çökük pozda ve `ko` ifadesinde kalır (yeniden
bağlanan istemci de aynı görür). Şapka düşmez (aksesuarlar aynı mesh'te pişmiş).

Duyuru: D9 "İNFAZ / X vuruldu" cue gelir gelmez değil, **t=1300**'de (ateşle) görünür. Vurulan Hitler ise
`game_ended` cue'su ve sonuç halesi infaz koreografisi bitene (2600) kadar bekler.

## 5. Nişan yönü

Koltuk düzeni `layout/seats.ts`: yaw = atan2(hedef − atıcı) koltuğun kendi eksenine göre. Kamu kolu için
sağ kol grubu koltuk dikey ekseninde bu yaw'a döner (sol el masada kalır). Yerel ilk şahıs elde silah dünya
uzayında hedefe bakar: el yaw = hedefYaw − bakış yaw, ±75° kırpılır; oyuncu başka yöne bakıyorsa silah kadraj
dışına çıkabilir, kabul.

## 6. Vurulan oyuncunun ekranı

İlk şahısta kendi karakterini görmez. t=1300'de HUD katmanı: 400 ms'de kenarlardan koyulaşan vinyet
(`--st-danger` tonu %35 → siyah %70), ortada "VURULDUN" (D9 başlık stili, `danger`), alt satır
"Oyun bitene kadar izleyebilirsin; konuşma ve oy yok". Vinyet 2 s sonra %25'e iner ve oyun bitene kadar kalır.
Kamera oynamaz (mide bulantısı yok). Elleri `rest`.

## 7. `ko` ifadesi (yüz dokusu 5. ifade)

`docs/design/d3/characters.json` `faces.expressions.ko` (kodlayan ekler): gözler **X** (iki 10 px kalın çizgi,
göz çapının %70'i, göz rengiyle), kaş `[[44,86],[80,80],[116,90]]` düz ve alçak, `eyeScale 1`,
`cheekAlpha .05`, ağız `type "o"` küçük `rx 12 ry 9` + dil `r 9` dışarı sarkık. Göz kırpma yok.

## 8. Azaltılmış hareket

Flaş tek kare, geri tepme yok; silah 0–1200 ms nişanda sabit görünür, 1300'de ses, hedef anında çökük poz;
vinyet animasyonsuz. Toplam süre aynı (2600).

## 9. Kapsam dışı (şimdilik)

Şapka düşmesi, kamera sarsıntısı, kan, hedefte kurşun deliği; soruşturmaya büyüteç ve özel seçime işaret
parmağı (aynı kalıpla sonraki maddeler).
