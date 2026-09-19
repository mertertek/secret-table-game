# A4 — `cards_moved` cue üretimi

- Görev: ROADMAP A4 (yan oturum, Opus 5). Tarih: 2026-09-10.
- Durum: **done** (kod + testler geçti). ROADMAP A4 satırı ve `docs/agents/CLAUDE.md`
  ana oturumun sahipliğinde olduğu için bu oturumda güncellenmedi.

## 1. Değişen dosyalar

| Yol | Değişiklik |
| --- | --- |
| `packages/game-core/src/events.ts` | `cards_moved` motor olayı (count/from/to; gizli alan yok) |
| `packages/game-core/src/engine.ts` | 4 üretim noktası (aşağıda) |
| `packages/game-core/src/engine.legislative.test.ts` | 4 yeni test |
| `packages/game-core/src/engine.guards.test.ts` | 1 yeni test (veto) |
| `packages/server/src/projection.ts` | `eventsToCues` → `cards_moved` herkese, filtresiz |
| `packages/server/src/projection.test.ts` | 2 yeni test (herkese + office boşalması kanıtı) |
| `packages/scene/src/animation/cues.ts` | `cueOfficePlayerId()` + `cueMatchesView` dar gevşetme |
| `packages/scene/src/animation/cues.test.ts` | 4 yeni test |
| `packages/scene/src/animation/CueEffects.tsx` | uç çözümü `cueOfficePlayerId` ile (2 satır) |
| `packages/scene/src/live/useLocalMotion.ts` | aynı çözüm (1 satır) |
| `packages/scene/src/TableScene.tsx` | `publicMove` aynı çözüm (1 satır) |

`apps/web/**`, sözleşme (`packages/contracts`), manifest ve kilit dosyaları
değişmedi. Yeni bağımlılık yok.

## 2. Üretim noktaları (`engine.ts`)

| # | Yer | Olay | Sıra |
| --- | --- | --- | --- |
| 1 | `resolveVote` — hükümet kurulup 3 kart çekilince | `deck→president, 3` | `cards_dealt`'ten **önce** (kamu hareketi, sonra özel el) |
| 2 | `handleDiscardPolicy` | `president→discard, 1` + `president→chancellor, 2` | ikisi de `cards_dealt`'ten önce |
| 3 | `handleEnactPolicy` | `chancellor→discard, 1` (atılan kart sayısı) | `policy_enacted`'ten **önce**; yerleşen politika yalnız `policy_enacted`'te |
| 4 | `handleRespondVeto(accept)` | `chancellor→discard, 2` | `veto_enacted` log'u ve `failElection`'dan önce |
| — | `ensureDeck` yeniden karıştırma | **olay yok** | test: `reshuffles === 1` iken tek `deck→president, 3` |

Kaos politikası (`chaosPolicy`) ve `policy_peek` için hareket olayı üretilmez:
ilki hükümet eli değil, ikincisi kart taşımaz. Adet daima 1–3, sözleşmedeki 17
sınırının içinde.

## 3. Uyumluluk kararı (sahne makam çözümü)

**Doğrulanan sorun.** `projection.ts` `currentGovernment()` yalnız
`legislative_*`/`veto_response`/`executive_action` fazlarında dolu. Şansölye
kartı koyunca faz `nomination`'a geçer ve **aynı revizyonda** yayınlanan
`chancellor→discard` cue'su ile birlikte gelen görünümde `players[].office`
tamamen `none` olur. Kanıt: `packages/server/src/projection.test.ts` →
"şansölye kartı koyduktan sonra office boşalır..." testi; aynı testte cue'nun
üretildiği ve `lastElection`'ın hükümeti taşıdığı birlikte doğrulanır. Veto
kabulü de aynı duruma düşer (`failElection` → `nomination`).

**Seçilen yol:** `cues.ts` içinde tek bir çözümleyici:

```ts
cueOfficePlayerId(view, 'deck'|'discard'|'president'|'chancellor')
```

1. Önce güncel `players[].office` (özel seçim gibi durumlarda güncel makam
   kazanır),
2. yoksa `view.table.lastElection` — **yalnız** `outcome === 'elected'` ise,
3. ve çözülen oyuncu güncel görünümde hâlâ oturuyorsa.

`deck`/`discard` her zaman `undefined` döner (koltuk değiller).

**Neden bu yol:** Alternatif "her zaman yalnız `lastElection`" seçeneği özel
seçim (`call_special_election`) ve reddedilmiş seçim durumlarında yanlış
koltuğa animasyon çizerdi. Alternatif "hiç gevşetme" ise cue'yu 5 üretim
noktasının 2'sinde sahnede tamamen filtrelerdi. Seçilen yol dar: yeni bir ağ
alanı yok, gizli veri yok, koltuk uydurmaz, ve `cueMatchesView`'in "her yüz
güncel görünümden gelir" güvencesi korunur.

**Aynı hatayı yapan tüketiciler düzeltildi** (aksi hâlde cue kabul edilir ama
hiçbir şey çizilmezdi):

- `CueEffects.tsx` `endpoint()` — `seats.find(s => s.player.office === point)`
  artık `cueOfficePlayerId` ile playerId üzerinden eşleşiyor. (Aynı dosyadaki
  "yerel dağıtımı ikiye katlama" koruması da aynı çözümleyiciyi kullanıyor.)
- `TableScene.tsx` `publicMove` — `seat.player.office === cue.from/to` yerine
  playerId eşleşmesi. Görevde izin verilen en küçük düzeltme.
- `useLocalMotion.ts` — yerel oyuncu `from` makamındaysa `place` hareketi;
  artık nomination'a düşmüş şansölye de kendi kapalı bırakma hareketini alıyor.

`CueEffects.tsx` ve `useLocalMotion.ts` görevdeki yol listesinin dışındaydı;
tek satırlık, davranışı makam dolu iken **birebir aynı** bırakan düzeltmeler
olarak yapıldı (COORDINATION.md 2026-09-10 kararı: `packages/scene/**` Claude'a
açık). Sahne testlerinin tamamı geçiyor.

## 4. Test sonuçları (2026-09-10 19:52)

| Komut | Sonuç |
| --- | --- |
| `pnpm typecheck` | contracts, fixtures, game-core, scene, server **temiz**; `apps/web` **1 hata** — `src/immersive/controlScheme.ts(166,29)`, A2/A3 yan oturumunun aktif düzenlemesi, A4 ile ilgisiz |
| `pnpm test` | contracts 11, fixtures 28, **game-core 70** (65→70), **scene 83** (79→83), **server 35** (33→35), web 68/69 |
| `pnpm test:runtime` | PASS (source-free Node import, health, API guard, create/join) |

Toplam geçen: **295**; başarısız 1 (apps/web `controls.test.tsx` →
`useTableControls`/`controlScheme`, yan oturumun yarım kalan değişikliği;
`@secret-table/scene` veya `game-core` import etmiyor).

## 5. Sonraki adım

- ROADMAP A4 satırını `açık` → `bitti` yap (ana oturum sahibi).
- `docs/ASSETS.md` ve `packages/scene/README.md` içindeki "motor bu olayı henüz
  üretmiyor" notları artık eski; bir sonraki belge turunda güncellenmeli.
- Canlı doğrulama (J01/bot koşusu): iki istemcide yasama turunda kapalı kart
  hareketinin diğer oyuncuda göründüğü izlenmeli.
