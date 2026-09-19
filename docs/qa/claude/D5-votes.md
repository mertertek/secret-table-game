# D5 — Oy durumu ve oy sonuçları görünür

Teslim: 2026-09-11, Claude (Opus yan ajan). Kullanıcı görsel kabulü bekleniyor.
İstek: "oylamalarda milletin evet/hayır verdiğini görmüyoruz; isimleri ve oyları gösterelim."

## Ne değişti

### 1. Baş üstü rozeti (3D)

Yeni `packages/scene/src/objects/VoteBadge.tsx` + saf karar katmanı
`packages/scene/src/objects/voteState.ts`.

- Her avatarın başının ~18 cm üstünde (y = 0.62 m; baş tepesi ~0.43 m),
  **kameraya dönen** 0.30 × 0.12 m plaka. Çizim `PrintedFace` + `lettering`
  (drei `Html` YOK, DOM yok), gölge yok.
- `voting`: `hasVoted` → yeşil tik + "OY VERDİ"; vermedi → soluk gri halka +
  "BEKLİYOR". Ölü oyuncuda rozet yok; **yerel oyuncuda rozet yok** (koltuk
  kamerasında kendi avatarı zaten yok, durumu üst şerit söylüyor).
- Oylar açılınca: `lastElection.votes`'tan **EVET** (yeşil tik) / **HAYIR**
  (kırmızı çarpı). Şekil dili `cardArt.ts` oy pusulasıyla aynı (yuvarlak uçlu
  tik / çarpı); renkler partiden bağımsız: `palette.voteYes/voteNo/voteIdle`.
- Görünürlük penceresi: **`votes_revealed` cue'su görüldüğü andan itibaren en az
  5 sn** (`VOTE_REVEAL_MS`) + sentetik `election_result` aşaması boyunca.
  Gerekçe: **motorda `election_result` aşaması yok** — `game-core/engine.ts`
  `resolveVote` oyları açar açmaz `legislative_president`e (ya da reddedilirse
  yeni adaylığa) geçer, `projection.ts` PHASE_MAP'inde de bu ad bulunmaz. Bu
  yüzden rozet aşamaya değil cue'nun geldiği ana bağlandı; aşama ilerlese de
  rozetler 5 sn kalır. Yeni oylama başlarsa (faz `voting`) pencere iptal olur.
- Okunurluk: rozet **en az 24 px yüksek** kalacak şekilde ölçeklenir
  (kamera FOV + uzaklık + tuval yüksekliğinden hesap, 1× altına inmez, 2.4×
  üstüne çıkmaz). Genel masa kamerasında ve telefonda da okunuyor.
- Giriş animasyonu ölçek 0→1, 240 ms (`reducedMotion` iken yok; rozet yine
  görünür). `frameloop="demand"` korunur: yalnız giriş animasyonu kare ister,
  5 sn'lik pencerenin bitişi tek `setTimeout` ile yeniden çizdirir.
- Gizlilik: yalnız kamu alanları (`PlayerView.hasVoted`,
  `table.lastElection.votes`). `privateView.submittedVote` rozette kullanılmaz.
- Sahne kapsayıcısına `data-scene-vote-badges` sayacı eklendi (QA/otomasyon).

Koltuk önündeki mevcut küçük oy kartı çevirme (`RevealCard` ballot) **aynen
duruyor**; rozet ona ek.

### 2. HUD üst şeridi (`apps/web/src/ui/statusLine.ts`)

- `voting`: `… · Bekleyen: Deniz, Ada` (en fazla 4 ad + `+N`; yerel oyuncu
  "(sen)" ile işaretli; elenenler listede yok).
- Oylar açılınca başlık sonucu söyler: `Hükümet kuruldu: Elif / Selin` ya da
  `Hükümet reddedildi`; ayrıntı `Evet 4 · Hayır 3 · Evet: … · Hayır: …`.
  Kendi sıran varsa ayrıntı `Sıra sende: … · Evet 4 · Hayır 3` olur (iş kaybolmaz).
- Aynı `votes_revealed` cue'su ölçü alındığı için bu metin gerçek oyunda da
  (aşama çoktan kanun aşamasına geçmişken) çıkar; cue yoksa eski seçim şeride
  yapışmaz.

### 3. Oyuncular paneli (`apps/web/src/ui/PlayersPanel.tsx`)

Oylamada `✓ oy verdi` / `bekliyor`, sonrasında son seçimin `✓ evet` / `✕ hayır`
rozetleri (yeni `.tag--yes` / `.tag--no` stilleri, 3D rozetle aynı renk dili).

### 4. Fixture (additive)

`packages/fixtures/src/scenes/election.ts` + `registry.ts`:
`voting-waiting` (kısmen oylanmış; bir koltuk elenmiş) ve
`election-result-close` (4 evet / 3 hayır). Mevcut fixture'lar değişmedi.

## Dosyalar

| Dosya | Değişiklik |
| --- | --- |
| `packages/scene/src/objects/VoteBadge.tsx` | yeni — rozet çizimi, kameraya dönme, ölçek, giriş animasyonu |
| `packages/scene/src/objects/voteState.ts` | yeni — `voteBadgeState/Label/Key`, `VOTE_REVEAL_MS` |
| `packages/scene/src/objects/voteState.test.ts` | yeni — 10 test |
| `packages/scene/src/TableScene.tsx` | rozet yerleşimi, `votes_revealed` latch'i, 5 sn zamanlayıcı, `data-scene-vote-badges` |
| `packages/scene/src/materials/palette.ts` | `voteYes` / `voteNo` / `voteIdle` |
| `apps/web/src/ui/statusLine.ts` | bekleyen adlar, sonuç başlığı + sayaç/isim listesi |
| `apps/web/src/ui/statusLine.test.ts` | +7 test (mevcut iki iddia yeni metne göre güncellendi) |
| `apps/web/src/ui/PlayersPanel.tsx`, `styles.css` | oy sütunu + `.tag--yes/--no` |
| `packages/fixtures/src/scenes/election.ts`, `registry.ts` | 2 yeni fixture |

Sözleşme (`packages/contracts`) **değişmedi**; yeni bağımlılık yok;
`docs/design/**` değişmedi.

## Görseller

`docs/qa/claude/d5/` — Chrome + Playwright, dev sunucu **5199** (5173'e
dokunulmadı, iş bitince kapatıldı), konsol hatası yok.

| Kare | Fixture / bağlam |
| --- | --- |
| `voting-seat.png` | `voting-waiting`, koltuk kamerası, 1440×900 @dpr2 |
| `voting-overview.png` | `voting-waiting`, genel masa (OY VERDİ / BEKLİYOR, elenen koltukta rozet yok) |
| `result-seat.png` | `election-result-close`, koltuk kamerası |
| `result-overview.png` | `election-result-close`, genel masa (4 EVET / 3 HAYIR) |
| `phone-result.png` | 390×844, sonuç — rozetler ve üst şerit |
| `phone-players.png` | 390×844, menü → Oyuncular paneli oy sütunu |

Ölçüm: rozet sayısı `voting-waiting` = 5 (7 koltuk − yerel − elenen),
`election-result-close` = 6 (7 − yerel).

## Doğrulama (gerçek çıktılar)

```
pnpm -r --workspace-concurrency=1 typecheck   # 6/6 paket, hatasız
pnpm test                                     # 429 test
  contracts 11 · fixtures 31 · game-core 70 · scene 131 · server 35 · web 151
pnpm --filter @secret-table/web build         # ✓ built in 3.23s
node scratchpad/d5-shots.mjs 5199             # 6 kare, "konsol hatası yok"
```

## Açık noktalar

- **Kullanıcı görsel kabulü bekleniyor** (özellikle rozet yüksekliği ve boyu).
- Gerçek çok oyunculu koşuda denenmedi; kareler sentetik fixture'lardan.
  Canlı doğrulama için oy açılışından sonra 5 sn'lik pencere izlenmeli.
- Yerel oyuncunun kendi rozeti bilinçli olarak çizilmiyor. Genel masa
  kamerasında kendi avatarı göründüğü için "benim oyum nerede?" denirse bu
  kural tek satırda (`voteState.ts` `if (local) return null`) gevşetilebilir.
- Rozet 5 sn sonra kaybolur; kalıcı kayıt menüdeki Oyuncular panelinde durur.
  İstenirse süre `VOTE_REVEAL_MS` ile artırılır.
- 10 kişilik masada rozetler yan yana geldiğinde üst üste binebilir; 7 kişide
  sorun görülmedi.
