# D20 — Realtime sürüm sinyali: teşhis, düzeltme, ölçüm

- Tarih: 2026-09-12, 19:52–20:50 (+03:00). Ajan: Opus yan ajan.
- Ortam: gerçek Supabase projesi (Postgres 17.6), yerel Vite dev sunucusu 5202
  (5199'u D19 ajanı HMR ile sürekli yeniden yüklüyordu — ölçüm için ayrı sunucu),
  Playwright + gerçek Chrome, 2 gerçek tarayıcı bağlamı + 3 bot.
- Commit YOK. `.env` değerleri hiçbir yere yazılmadı; uzak DB'ye **şema
  değişikliği uygulanmadı**.

## 1. Sonuç (özet)

**D18'in "realtime sürüm sinyali istemcilere ulaşmadı" saptaması YANLIŞTI.**
Sinyal ulaşıyor: DB tetikleyicisi → `realtime.send(private => true)` →
`realtime.messages` → Realtime → istemci `room:<roomId>` özel kanalı zinciri
uçtan uca **çalışıyor** ve yükü tam (`{id, roomId, revision}`).

Ölçüldü (probe 6, 5 tekrar): `public.notify_room_revision()` çağrısından
istemcinin `broadcast` geri çağrısına **ortalama 363 ms** (bu süre Management
API HTTPS turunu da içerir; saf DB→istemci payı daha küçük).

Görünen 1,2–12,4 s gecikmenin gerçek nedeni iki başka şeydi:

1. **Yedek yoklama aralığı 12 s.** Sinyalin kaçtığı ya da sinyalsiz değişen
   durumlarda (sunucu tarafı geçiş, bot hamlesi, lobi) tek toparlayıcı buydu.
2. **Sinyal başına İKİ ardışık HTTP turu.** `scheduleRefresh()` → `refresh()`
   her sinyalde önce `lobby_view`, sonra `view` çağırıyordu. Oyun içindeyken
   lobi turu hiçbir işe yaramıyor ama gecikmeyi ve istek sayısını iki katına
   çıkarıyordu.

D18'in ölçtüğü 1,2 / 5,2 / 12,4 s değerleri 12 s'lik yoklamanın rastgele fazına
da uyduğu için sinyal yokmuş gibi göründü; ayrıca teşhiste WebSocket
çerçeveleri **metin** olarak arandı — Supabase Realtime **ikili (binary)
Phoenix serileştiricisi** kullanıyor, bu yüzden `room_revision_changed`
çerçeveleri CDP metin aramasında görünmedi (bu tuzağa bu turda da düşüldü,
base64 çözülünce sinyaller ortaya çıktı).

## 2. Teşhis — ne bakıldı, ne bulundu

Uzak DB Management API ile sorgulandı (`POST /v1/projects/{ref}/database/query`,
`SUPABASE_ACCESS_TOKEN`; hiçbir gizli değer yazdırılmadı).

| Kontrol | Sonuç |
| --- | --- |
| `game_states_notify` tetikleyicisi | VAR, etkin (`O`), `AFTER INSERT OR UPDATE OF revision`, `public.notify_room_revision` çağırıyor |
| `notify_room_revision` yöntemi | `realtime.send(jsonb, 'room_revision_changed', 'room:'||room_id, true)` — `pg_notify`/`postgres_changes` DEĞİL |
| Kanal adı eşleşmesi | Eşleşiyor: DB `room:<uuid>`, istemci `client.channel('room:'+roomId, {private:true})` |
| Olay adı eşleşmesi | Eşleşiyor: `room_revision_changed` |
| `realtime.messages` RLS | `room_channel_read` (SELECT, `authenticated`) VAR; `viewpoint_channel_read/write` de VAR |
| Politika gerçekten geçiyor mu | EVET — `authenticated` rolü + gerçek üye `auth.uid()` + `realtime.topic()` ile `realtime.messages` okuması 15 satır döndü, `is_room_member()` = true |
| 0004/0005 grant'ları | Doğru: `is_room_member` yalnız `authenticated`+`service_role`; `game_states_notify`/`notify_room_revision` yalnız `service_role` |
| Yayın (publication) | `supabase_realtime_messages_publication` VAR ve bugünün `realtime.messages_2026_09_12` bölümünü içeriyor |
| Bölümleme (partition) | 2026-09-09…09-15 bölümleri VAR |
| Replikasyon yuvası | Abonelik açıkken `supabase_realtime_messages_replication_slot_…`, `active=true`, gecikme ~0 |
| DB gerçekten yazıyor mu | EVET — `realtime.messages` içinde 2 771 `room_revision_changed` satırı (2026-09-09 → 09-12); test odası için 21 satır |
| İstemci abone olabiliyor mu | EVET — `phx_reply {"status":"ok"}` (CDP çerçevesi), `realtime:room:<uuid>` |
| İstemciye teslim | EVET — yük `{"id":…,"roomId":…,"revision":N}`; ~363 ms |

Elenen hipotezler: kanal/olay adı uyuşmazlığı, RLS politikasının eksik/yanlış
olması, `private: true` yetkilendirmesi, grant eksiği, `supabase_realtime`
yayını, bölüm/yuva eksikliği, `realtime.send`'in hatayı `RAISE WARNING` ile
yutması (fonksiyon gerçekten yutuyor, ama insert başarılı olduğu için sorun
değil).

Yan bulgu (yanlış ara sonuç, kayda geçiyor): `private => false` mesajlar genel
(`private:false`) kanala geliyor, `private => true` mesajlar gelmiyor — bu
beklenen davranış, kanalın gizliliği mesajın gizliliğiyle eşleşmek zorunda.
İlk turda "özel yayın hiç teslim edilmiyor" sanıldı; neden CDP'de **metin**
çerçevesi arandı, oysa taşıma ikili.

### Ek bulgu — aynı topic'e ikinci kanal

Uygulamanın kanalı zaten bağlıyken aynı `room:<id>` topic'ine ikinci bir kanal
açmak `CHANNEL_ERROR Unauthorized: You do not have permissions to read from
this Channel topic` veriyor; buna rağmen mesajlar supabase-js tarafında topic'e
göre yönlendirildiği için ikinci kanalın geri çağrısına da düşüyor. Teşhiste
yanıltıcı; üretimde tek kanal kullanıldığı için etkisi yok.

### Ek bulgu — React StrictMode

DEV'de `useRoomState` iki kez kuruluyor, dolayısıyla oda başına **iki** izleyici
ve iki kanal oluşuyor; her sinyal iki kez işleniyor, yedek yoklama iki kat
istek üretiyor. Üretim derlemesinde yok (ölçüm sayıları bu yüzden dev'de
şişkin).

## 3. Değişiklik (istemci tarafı; migration GEREKMEDİ)

`apps/web/src/multiplayer/roomChannel.ts`

- `ROOM_CHANNEL_EVENT = 'room_revision_changed'` ve
  `roomChannelTopic(roomId) = 'room:'+roomId` sabitleri dışa açıldı; kanal ve
  olay adı artık tek yerde ve testle DB tarafına sabitlendi.
- `BACKUP_POLL_MS = 3_000` — yedek yoklama **12 s → 3 s**.
- Yedek yoklama `setInterval` yerine kendini yeniden kuran `setTimeout`;
  izleyici yeni `poke()` ile sayacı sıfırlıyor. Başka yoldan (sinyal, komut
  yanıtı) görünüm tazelendiğinde bir sonraki yoklama gereksiz gitmiyor.

`apps/web/src/multiplayer/useRoomState.ts`

- Yeni `fetchAndApplyView(token)` yardımcısı: `'ok' | 'network' | 'lobby'`.
  `applyLobbyOrGame` bunun üzerine taşındı (davranış aynı).
- Yeni **hızlı yol** `refreshView()`: oyun içindeyken sinyal/yoklama yalnız
  `view` turu yapar; `lobby_view` turu atlanır. Lobideyken ya da `view` "artık
  oyunda değil" derse tam `refresh()`'e düşer (401 oturum yenileme ve lobi
  görüntüsü yine oradan gelir).
- `scheduleRefresh()` artık `refreshView()` çağırıyor.
- `applyView()` sonunda `r.watcher?.poke()` (kota).

Denenip **geri alınan** yol: hamle yapan oyuncunun eşlerine mevcut özel
bakış/jest kanalından "yeni sürüm var" ipucu göndermesi
(`viewpointChannel.sendRevision`). Çalıştı (ölçüm: A tık → B görünüm **328 ms**),
ama DB sinyalinin zaten ~0,3 s'de geldiği anlaşılınca gereksiz karmaşıklık ve
fazladan istek oldu; `viewpointProtocol.ts`, `viewpointChannel.ts` ve testleri
**dokunulmamış hâline** geri alındı.

### Kota hesabı (yedek yoklama 3 s)

- Oyuncu başına en kötü: 60/3 = **20 `view` isteği/dk**.
- 10 oyunculu oyun: **200 istek/dk**, saatlik 12 000; ayrıca heartbeat 20 s →
  10 oyuncu için 30 istek/dk.
- Hızlı yol sayesinde istek başına tur sayısı 2 → 1 düştü: aynı gecikme
  bütçesinde **HTTP turu yarıya indi** (12 s'lik eski düzende sinyal başına 2
  tur vardı).
- `poke()` etkin oyunda yoklamayı bastırdığı için gerçek sayı bu üst sınırın
  altında kalır.
- "Sürüm değişmediyse kısa yanıt" (304 benzeri) **yok**: `view` her seferinde
  tam görünümü döndürüyor. `PlayerViewRequest.sinceRevision` (D18) yalnız cue
  süzmek için var. Bant genişliği için `sinceRevision === revision` iken
  `{notModified:true, revision}` dönmek anlamlı bir iyileştirme olur ama
  sözleşme + `packages/server/src/service.ts` değişikliği gerektiriyor ve
  `service.ts` şu an D19 ajanında — **yapılmadı, kalan iş**.

## 4. Ölçüm

Kurulum: 5202 dev sunucusu, gerçek Supabase, A (hamle yapan) + B (gözlemci,
CDP ile ikili WebSocket çerçeveleri çözülüyor) + 3 bot. Ölçüm yalnız A hamle
yaptığında alındı. Değerler A'nın tıklamasından B'nin yetkili `view` yanıtına.

| Örnek | A tık → B görünüm | DB sinyali B'ye | Sinyal → görünüm |
| --- | --- | --- | --- |
| 0 | 1 214 ms | (çerçeve yakalanmadı) | — |
| 1 | 2 908 ms | 1 043 ms | 1 865 ms |
| 2 | 2 804 ms | 1 085 ms | 1 719 ms |
| 3 | 2 967 ms | 1 129 ms | 1 838 ms |
| 4 | 2 849 ms | 1 122 ms | 1 727 ms |
| 5 | 2 689 ms | 1 048 ms | 1 641 ms |
| 6 | 2 761 ms | 1 026 ms | 1 735 ms |
| 7 | 2 122 ms | 189 ms | 1 933 ms |
| 8 | 2 440 ms | (çerçeve yakalanmadı) | — |

- A tık → B görünüm: **ortalama ≈ 2,5 s**, maks 2 967 ms, min 1 214 ms.
- DB sinyali B'ye: 189–1 129 ms (bu süre A'nın KENDİ komut turunu da içerir —
  yerel dev API köprüsü 3 bot + 2 tarayıcı altında yavaş).
- İzole ölçüm (probe 6, oyun yükü olmadan): `notify_room_revision` →
  istemci geri çağrısı **325–424 ms, ortalama 363 ms** (Management API turu
  dahil).
- **Yedek yoklamanın devreye girmediğinin kanıtı:** her örnekte gecikme 3 s'lik
  yoklama aralığının ALTINDA ve sinyal çerçevesi görünüm tazelemesinden ÖNCE
  geliyor (sinyal → görünüm 1,6–1,9 s); örnek 7'de sinyal 189 ms'de geldi,
  yoklamanın bir sonraki turu 3 s sonraydı. Örnek başına B'nin `view` isteği
  1–4; StrictMode'un çift izleyicisi bunu dev'de ikiye katlıyor.

**Sapma / kalan belirsizlik:** kalan 1,6–1,9 s'lik "sinyal → görünüm" payı
Vite dev API köprüsünün tek iş parçacıklı olması ve aynı anda 3 botun da
yoklaması yüzündendir; Vercel'de `view` turu ~150–300 ms beklenir. **Üretimdeki
gerçek sayı kullanıcı tarafında yeniden ölçülmeli.**

## 5. Testler

Yeni: `apps/web/src/multiplayer/roomChannel.test.ts` (7 test) — kanal/olay adı
sabitleri DB tarafıyla eşleşiyor, `BACKUP_POLL_MS === 3000`, özel kanala
abonelik (`private: true`) ve tek olay dinleme, `SUBSCRIBED` → `connected` +
"-1 topla", `CHANNEL_ERROR`/`TIMED_OUT` → `reconnecting`, yayın yükü ve 1 s'lik
aynı-sürüm tekrarı, yedek yoklamanın 3 s'de tetiklenmesi + `poke()` ile
sıfırlanması, `stop()` sonrası sessizlik, Realtime yapılandırılmamışken yalnız
yoklama.

Genişletildi: `apps/web/src/multiplayer/useRoomState.cues.test.tsx` — D20 hızlı
yolu: oyun içindeyken sürüm sinyali **tek** `view` turu yapar, ek `lobby_view`
turu yoktur.

Sunucu tarafı SQL için `supabase/tests` kalıbı yok; tetikleyici/politika
doğrulaması Management API sorgularıyla yapıldı (§2 tablosu).

GEÇTİ: `pnpm -r typecheck` 6/6 · `pnpm test` **941** (26/55/147/332/84/297) ·
`pnpm --filter @secret-table/web build`.

## 6. Migration

**GEREKMEDİ.** `0009_realtime_fix.sql` yazılmadı; DB tarafı (tetikleyici,
fonksiyon, RLS, grant, yayın, bölüm) doğru ve çalışıyor.

## 7. Kalan iş

1. Üretimde (Vercel + gerçek cihazlar) A hamle → B görünüm gecikmesini yeniden
   ölçmek. Yerel dev köprüsü ölçümü aşağı çekmiyor, yukarı çekiyor.
2. `view` için "sürüm değişmedi" kısa yanıtı (`sinceRevision === revision` →
   `{notModified:true}`): sözleşme + `service.ts` işi, D19 ajanı `service.ts`'i
   bıraktıktan sonra yapılabilir. Bant genişliği kazancı, gecikme değil.
3. `roomChannel`'ın kanal sağlığı hâlâ `connection` durumunu besliyor
   (`noteRealtime` → `worstConn`). Kanal hiçbir oyun verisi taşımadığı ve
   yetkili yol HTTP olduğu için `CHANNEL_ERROR`/`TIMED_OUT`'un oyuncuyu
   `reconnecting` göstermesi gereksiz sert; `disconnected` (tarayıcı `offline`
   olayı) blokladığı için ActionBar'ı da kapatabilir. Bu turda **değiştirilmedi**
   (kapsam dışı); ayrı madde olarak değerlendirilmeli.
4. Teşhis betikleri scratchpad'de: `d20-probe2/3/5/6.mjs`, `e2e-d20-diag.mjs`,
   `e2e-d20-measure2.mjs`, `d20-measure2.log/json`, `d20-probe6.json`.
