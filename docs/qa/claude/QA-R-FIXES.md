# QA-REVIEW bulguları — düzeltme kaydı (Claude)

Kaynak rapor: `docs/qa/codex/QA-REVIEW.md` (bağımsız QA_CODEX, 2026-09-09).
Bu dosya düzeltmeleri kaydeder; **rapor ve `docs/qa/codex/qa-review/` kanıtları
silinmedi/değiştirilmedi.** Tarih: 2026-09-09.

## Özet

| Bulgu | Durum | Alan |
| --- | --- | --- |
| QA-R01 doğrudan "Yeniden oyna" | Düzeltildi (kod + migration + yerel test) — **uzak Supabase doğrulaması BEKLİYOR (en son yapılacak)** | server + migration + istemci |
| QA-R04 ham hata kodu | Düzeltildi | istemci `text.ts` |
| QA-R03 infaz/yetki onayı belirsiz | Düzeltildi | istemci `ActionPanel` + `text.ts` |
| QA-R07 sonuç ekranı dili | Düzeltildi | istemci `GameScreen` + `TableStatus` + `text.ts` |
| QA-R02 rol aç/kapa çakışması | Uygulama tarafı düzeltildi; sahne tarafı Codex'e devredildi (CLAUDE-005) | contracts + istemci (+ scene = Codex) |

## QA-R01 — doğrudan "Yeniden oyna"

**Kök neden.** `start_game` RPC (`0002_functions.sql`) yalnız `status='lobby'` satırını
günceller. Oyun bitince oda `in_game` kalır → `play_again` → `start_game` 0 satır etkiler
→ `raise exception` → API `500 SERVICE_UNAVAILABLE` (rapordaki kanıt).

**Değişen.**
- `supabase/migrations/0006_rematch.sql` (YENİ; 0002 değiştirilmedi): `restart_finished_game`
  RPC — oda satırını `for update` kilitler; yalnız `status='lobby'` VEYA DB'de kayıtlı
  `state.phase.kind='game_over'` iken geçiş yapar. **Devam eden (bitmemiş) oyun asla
  sıfırlanmaz.** Oda + `game_id` + ilk durum tek transaction'da yazılır; eski oyunun
  `processed_commands` satırları silinir. EXECUTE yalnız `service_role`.
- `packages/server/src/gateway.ts` + `memory-gateway.ts` + `supabase-gateway.ts`: yeni
  `restartGame(input)` metodu; in-memory sürüm game_over kontrolünü de uygular (parite).
- `packages/server/src/service.ts`: `play_again` artık ayrı `restartGame` yolu — host +
  sayı + hazır kontrolü, `createGame` sonrası `state.revision = öncekiRevision + 1`
  (oda ömrü boyunca monoton; CONTRACT §2). `start_game` yolu değişmedi.
- `apps/web/src/multiplayer/useRoomState.ts`: `onRevision` oyun-sonu ekranındayken de
  yeniden alır (kaçan sinyal / eşit revision güvencesi).

**Yerel doğrulama (geçti).** `pnpm --filter @secret-table/server test` —
`src/service.rematch.test.ts` 5 test:
- host: bitmiş oyundan `role_reveal`'e; yeni `gameId`; `revision === bitenRevision + 1`;
  oda `in_game`; yeni oyunda `ack_role` çalışıyor.
- host olmayan `play_again` → `NOT_ALLOWED`; bitmiş oyun bozulmuyor.
- **devam eden oyun `play_again` ile sıfırlanamıyor** → `NOT_ALLOWED`, `gameId`/`revision`/
  `phase` değişmiyor.
- "Lobiye dön" (status=lobby) sonrası `play_again` → çalışıyor.
- `gateway.restartGame` doğrudan: `in_game` + game_over değil → `rejects.toThrow(/sürüyor/)`.
Mevcut server testleri (28) + tüm paketler yeşil; `pnpm typecheck` + `pnpm build` geçti.

**BEKLEYEN — uzak Supabase doğrulaması (en son yapılacak, kısa).** Kullanıcı kararı:
canlı doğrulama en sona bırakıldı. Adımlar (DEPLOYMENT.md §7 Yol A/B):
1. `0006_rematch.sql`'i hedef projeye uygula (`supabase db push` veya Management API);
   `supabase_migrations.schema_migrations`'a `0006` satırı ekle.
2. Tek geçici QA odası: oyunu `game_over`'a getir → sonuç ekranında **"Aynı oyuncularla
   yeniden oyna"** → yeni `role_reveal`, yeni `gameId`, `revision` bitenden +1; tüm
   istemciler sinyalle yenileniyor. Toplu DB temizliği yok.

## QA-R04 — ham hata kodu (ör. `SERVICE_UNAVAILABLE`)

**Kök neden.** `ERROR_MESSAGES` yalnız `error.service_unavailable` (küçük) anahtarını
içeriyordu; API 500'de `{ error: 'SERVICE_UNAVAILABLE' }` (büyük) döner ve `errorText`
bilinmeyen anahtarda ham kodu aynen basıyordu.

**Değişen — `apps/web/src/ui/text.ts`.**
- `errorText()` artık büyük harfli kodu `error.<küçük>` messageKey'ine düşürür; sözlükte
  yoksa **jenerik Türkçe + uygulanabilir adım** döner, ham kodu tek başına göstermez.
  Boşluk içeren (insan yazımı) mesajlar olduğu gibi geçer.
- Sözlük tüm `CommandErrorCode` + HTTP katmanı kodları için Türkçe açıklama + sonraki
  adım içerir (ör. `SERVICE_UNAVAILABLE` → "Sunucuya şu an ulaşılamıyor. Birkaç saniye
  sonra tekrar dene; bağlantın varsa oyun kaybolmaz.").

**Yerel doğrulama (geçti).** `apps/web/src/ui/text.test.ts` — 6 test (kod→Türkçe,
messageKey eşitliği, bilinmeyen kodda ham kod yok, boş→jenerik, insan mesajı korunur).

## QA-R03 — infaz/başkanlık yetkisi onayı yapılacak işlemi söylemiyor

**Değişen.**
- `apps/web/src/ui/text.ts`: `powerActionText(power)` — her `ExecutivePower` için
  başlık, ipucu, buton etiketi ve **hedef sonuç metni**. İnfaz:
  `"<isim> infaz edilecek — oyundan elenecek."`, buton `"İnfaz et"`.
- `apps/web/src/ui/ActionPanel.tsx`: `use_power` aksiyonunda jenerik
  "Başkanlık yetkisi / Yetkiyi kullan / Gönder" yerine `view.table.currentPower.power`'a
  göre bu metinler; onay satırında hedef + sonuç ("Onaylıyor musun?"). `currentPower`
  yoksa jenerik metne düşer.

**Yerel doğrulama (geçti).** `text.test.ts` — `powerActionText` 2 test (infazda elenme
görünür; her yetkide ayrı başlık/etiket/sonuç).

## QA-R07 — sonuç ekranında eski bekleme metni ve İngilizce roller

**Değişen.**
- `apps/web/src/ui/ActionPanel.tsx`: `phase==='game_over'` ve eylem yokken
  "Diğer oyuncular bekleniyor" yerine "Oyun bitti. Kazanan ve roller aşağıda; oda sahibi
  yeni oyun başlatabilir."
- `apps/web/src/ui/GameScreen.tsx`: "Oyun bitti" bölümünde, yeniden oyna düğmelerinin
  yanında **kazanan özeti** — parti (`WINNER_NAMES`), neden (`END_REASON_NAMES`) ve
  açıklanan roller **Türkçe** (`ROLE_NAMES`). Düğme: "Aynı oyuncularla yeniden oyna".
- `apps/web/src/ui/TableStatus.tsx`: rol/yetki/neden adları paylaşılan Türkçe haritadan;
  tekrarlanan rol listesi kaldırıldı (artık özet bölümünde).
- `apps/web/src/ui/text.ts`: paylaşılan `ROLE_NAMES` / `POWER_NAMES` / `END_REASON_NAMES`
  / `WINNER_NAMES`.

**Yerel doğrulama.** `pnpm typecheck` + `pnpm build` geçti; render mantığı fixture'larla
tutarlı (`view.result` alanları). Görsel canlı kontrol uzak doğrulamayla birlikte.

## QA-R02 — "Kimliği kapat" gizlenen HTML panelini yeniden açıyor

**Kök neden.** Sahne `toggleRole` her iki yönde de `onIntent({ type: 'inspect_own_role' })`
gönderiyor; uygulama bunu her zaman `rolePanelOpen = true` yapıyordu. Sahne + HTML iki
ayrı boolean tutuyor.

**Değişen (uygulama + sözleşme; sahne = Codex).**
- `packages/contracts/src/scene.ts`: `SceneIntent` `inspect_own_role` → `{ open?: boolean }`
  (additive/opsiyonel); `TableSceneProps.rolePanelOpen?: boolean` (additive/opsiyonel).
  Sürüm `0.2.0` sabit.
- `apps/web/src/multiplayer/useRoomState.ts`: `inspect_own_role` yönü uygular —
  `r.rolePanelOpen = intent.open ?? !r.rolePanelOpen`.
- `apps/web/src/ui/{SceneFrame,GameScreen}.tsx`: `rolePanelOpen={room.rolePanelOpen}`
  sahneye iletiliyor (tek kaynak).
- `docs/CONTRACT.md` §2, §5 güncellendi. Devir: **CLAUDE-005** (`docs/agents/CLAUDE.md`) —
  Codex sahnede `toggleRole`'ü `open` yönüyle göndersin ve tercihen `roleOpen`'ı
  `rolePanelOpen` prop'undan sürsün.

**Yerel doğrulama.** `pnpm typecheck` + tüm paket testleri geşti; prototip/scene testleri
(52) etkilenmedi (prop opsiyonel). Çapraz kontrol (sahne "Kimliği kapat" sonrası HTML
kapalı kalıyor) sahne değişikliğiyle birlikte doğrulanacak.

## Çalıştırılan komutlar (bu tur, hepsi geçti)

- `pnpm typecheck` — 6/6 proje.
- `pnpm test` — contracts 6, fixtures 28, game-core 65, scene 52, server 33
  (5'i yeni rematch), web 14 (8'i yeni `text.test.ts`).
- `pnpm build` — `apps/web` tsc + vite build (mevcut büyük-chunk uyarısı sürüyor).
