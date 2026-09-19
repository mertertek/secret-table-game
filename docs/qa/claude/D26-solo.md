# D26 — "Tek başına dene": tarayıcıda çalışan solo kip (botlarla, sunucusuz)

Tarih: 2026-09-18 · Sahip: Claude (Opus yan ajan) · Commit YOK.

## Neden

Depo ve ön izleme linki herkese açık paylaşılıyor. Tek başına gelen ziyaretçi
oyunu göremezse link işe yaramıyor. Var olan DEV bot modu üretime açılamaz:
her bot GERÇEK bir anonim Supabase hesabı açıyor (ziyaretçi başına 6 hesap;
saatlik ~1500 sınırı ~250 ziyaretçide doluyor) ve sunucu yükünü 6'ya katlıyor.
Çözüm: oyunun TAMAMI tarayıcıda koşsun.

## Anahtar bulgu

`packages/server` saf: `service.ts`, `projection.ts`, `engine-map.ts` ve
`memory-gateway.ts` içinde `node:`/Supabase içe aktarımı yok; `game-core`
yalnız `contracts`a bağlı. Yani `GameService` + `InMemoryGateway` tarayıcıda
aynı kuralları uyguluyor. **Sunucu yolu (`apps/web/api/game.ts`,
`vite/apiPlugin.ts`), sözleşme, `packages/server`, `game-core` ve
migration'lar DEĞİŞMEDİ.**

## Ne yapıldı

### Yeni — `apps/web/src/solo/`

| Dosya | İş |
| --- | --- |
| `soloMode.ts` | Ana pakette duran KÜÇÜK köprü: solo bayrağı, sabit yerel kimlik + sahte token (`solo:<id>`), Realtime yerine yerel sürüm sinyali borusu, bakış kanalı yerine yalnız yerel jest kapısı. Ağır bağımlılık yok. |
| `soloService.ts` | Tembel `import('@secret-table/server')` → `new GameService(new InMemoryGateway())`, sekme ömrü boyunca TEK örnek. `localStorage`'a hiçbir şey yazmaz. `InMemoryGateway.onRevision` → `emitSoloRevision`. |
| `soloTransport.ts` | `apps/web/api/game.ts`'in yerel ikizi: aynı `action` + `payload`, aynı `ApiResult<T>`, aynı durum kodları (400/401/404/409/500), ağ yok. |
| `botBrain.ts` | `dev/botRunner.ts`'ten ÇIKARILAN saf karar mantığı (`chooseMove`, `chooseVote`, `actorPlayerId`, `pickBotAvatar`, `pick`, veto/evet oranları). |
| `soloBots.ts` | Solo bot döngüsü: yerel servise doğrudan komut, hamle öncesi 400–1200 ms rastgele gecikme, yalnız kendi sırasında oynama, `heartbeat` yok. |
| `startSolo.ts` | Tembel giriş noktası: servis → taşıma → oda → 5 bot (avatar + hazır) → `start_game` → bot döngüsü. `stopSolo()` botları durdurup solo kipi kapatır. |

### Değişen

- `multiplayer/apiClient.ts` — tek anahtar: `setSoloTransport(fn \| null)` +
  `soloTransportActive()`. `callGame` ilk satırda taşımaya düşer. **Dış yüzey
  (`createRoom`, `joinRoom`, `fetchView`, `sendCommand`, …) aynen duruyor.**
- `multiplayer/useRoomState.ts` — solo kipte: `ensureGuestSession` HİÇ
  çağrılmaz (sabit yerel oturum), `claim_control` gönderilmez, Realtime sürüm
  kanalı ve bakış kanalı AÇILMAZ (yerine yerel sinyal + yerel jest kapısı),
  heartbeat zamanlayıcısı kurulmaz, 401 oturum yenileme yolu kapalı. Gerçek
  çok oyunculu yol satır satır aynı.
- `dev/botRunner.ts` — karar mantığı `solo/botBrain.ts`'ten geliyor; eski
  dışa açık adlar yeniden dışa veriliyor, davranış değişmedi (25 test aynen
  geçiyor).
- `app/EntryPage.tsx` — ikincil **"Try it solo" / "Tek başına dene"** düğmesi;
  isim gerekmez (varsayılan "You" / "Sen"), solo kodu `import()` ile yüklenir.
- `app/RoomPage.tsx` + `ui/styles.css` — köşe rozeti: *"Solo demo — bots,
  nothing is saved"* + **"Play with friends"** düğmesi (üst şeridin altında,
  sol köşe; alt eylem çubuğunu kapatmıyor, oyun sonu ekranında da görünüyor).
- `i18n/tr.ts` + `i18n/en.ts` — `solo.*` anahtarları (ikisinde de).

### Kapsam dışı (solo kipte, bilerek)

Realtime/bakış kanalı, yedek yoklama, heartbeat/oturum tazeleme, `dev_scenario`
(senaryo atlama DEV kapısında kaldı), kalıcılık. Jestler yerelde oynuyor
(D27'deki bellek-kipi davranışıyla aynı hız sınırı). Sahne, kurallar, infaz
koreografisi ve "Nasıl oynanır" aynen çalışıyor.

## Testler

`pnpm -r typecheck` **6/6 geçti.** `pnpm test` **1046 test geçti** (önce 1033,
**+13**); mevcut testlerin hiçbiri bozulmadı.

Yeni dosyalar:

- `solo/soloTransport.test.ts` (7) — `ApiResult` şekli birebir (`create_room`
  gövdesi, 401 `MISSING_TOKEN`/`SESSION_INVALID`, 400 `UNKNOWN_ACTION` /
  `MISSING_ROOM_ID`, 404 `ROOM_NOT_FOUND`, başarısız lobi komutu 409);
  `setSoloTransport` ile tüm `apiClient` yüzeyi yerele düşüyor ve **`fetch`
  hiç çağrılmıyor**; `setSoloTransport(null)` sonrası normal yola dönüş.
- `solo/soloGame.test.ts` (2) — gerçek `startSolo` ile 6 koltuk, roller
  dağıtılmış, her koltuğun AYRI yetkili görünümü, 6 ayrı karakter; dört
  tohumda oyun MOTOR üzerinden sonuna kadar oynanıyor: hiçbir komut
  reddedilmiyor, hepsi `game_over` ile bitiyor, `role_reveal` / `nomination` /
  `voting` / `president_discard` / `chancellor_choice` **ve** en az bir
  `executive_action` geçiyor.
- `solo/soloBots.test.ts` (2) — 5 bot; her hamle öncesi bekleme 400–1200 ms
  aralığında; insanın sırasında hiçbir bot hamle göndermiyor (sürüm sabit
  kalıyor).
- `solo/soloRoomState.test.tsx` (2) — gerçek `useRoomState` solo masaya
  bağlanırken `fetch` **0**, `ensureGuestSession` **0**, `watchRoomRevision`
  **0**, `openViewpointChannel` **0**; görünüm geliyor, jest yerelde oynuyor
  (`sendEmote` → `true`), yerel sürüm sinyali görünümü tazeliyor.

## Paket boyutu (bayraksız üretim derlemesi)

| | önce | sonra | fark |
| --- | --- | --- | --- |
| Giriş paketi `index-*.js` | 394,153 B (gzip 110.11 kB) | 396,994 B (gzip 111.02 kB) | **+2,841 B (+%0,7)** |
| `startSolo-*.js` (tembel) | — | 7,580 B (gzip 2.88 kB) | yeni |
| Sunucu+motor chunk'ı (tembel) | — | 43,370 B (gzip 11.65 kB) | yeni |

Solo koduna düğmeye basılmadan dokunulmuyor: her iki chunk da yalnız
`import('../solo/startSolo')` ile çekiliyor. `@supabase/supabase-js` giriş
paketinde zaten vardı, sunucu chunk'ına KOPYALANMADI (o chunk'ta `supabase`
dizgesi 0 kez geçiyor).

Bayraksız derlemede dev izi: `botRunner` **0**, `devScenarioMenu` **0**.
`dev_scenario` giriş paketinde **0** — ama tembel sunucu chunk'ında **2 kez**
geçiyor; ayrıntı aşağıda "Sapmalar".

## Canlı doğrulama

Bayraksız üretim derlemesi + `pnpm --filter @secret-table/web preview --port
5210 --strictPort`. Derlemede gerçek `VITE_SUPABASE_*` yapılandırması gömülü
(yani ön izleme dağıtımının aynısı) — solo yolun Supabase'e hiç dokunmadığı bu
yüzden anlamlı bir ölçüm. Playwright (Chrome for Testing 1217), 1280×720,
`en-US`. Sunucu iş bitince kapatıldı.

| Ölçüm | Sonuç |
| --- | --- |
| `/api/game` isteği | **0** |
| `supabase.co` isteği (HTTP + WebSocket) | **0** |
| Konsol hatası | 0 |
| Sayfa hatası (`pageerror`) | 0 |
| Görülen fazlar | `Role reveal` → `Nomination` → `Election` → `Chancellor is choosing` → `Presidential power` → `Game over` |

Akış: giriş ekranında "Try it solo" → isim sorulmadan masaya oturma → rol
dağıtımı → tam tur (aday, oylama, kanun) → başkanlık yetkisi (`policy peek`)
→ oyun sonu ("The Liberals win — Hitler was executed", tüm roller açık).

Kareler (`docs/qa/claude/d26/`, 7 jpeg): `01-entry-try-solo`,
`02-seated-role-reveal`, `03-nomination`, `04-voting`, `05-policy`,
`06-power`, `07-final`. Ham ölçüm: `network.json`.

## Sapmalar / notlar

1. **`dev_scenario` izi giriş paketinde 0, tembel sunucu chunk'ında 2.**
   Kabul ölçütü "0" diyordu. Dizge dev ARACINDAN gelmiyor: `packages/server`
   (değiştirilmesi yasak) kendi komut `switch`'inde bu adı taşıyor ve solo kip
   o servisi olduğu gibi yüklüyor. Tarayıcıda kapalı: Vite `process.env`'i boş
   nesneye katladığı için derlenen `devToolsEnabled()` daima `false` döner
   (`function et(){return Je.SECRET_TABLE_DEV_TOOLS==="1"}`, `var Je={}`), yani
   konsoldan gönderilse bile `NOT_ALLOWED` alır. Kullanıcıya açık hiçbir yol
   yok: `devScenarioMenu` ve `botRunner` paketin hiçbir yerinde geçmiyor.
2. **Rozetin yeri bir kez taşındı.** İlk denemede sol ALT köşedeydi ve alt
   eylem çubuğundaki seçenek tuşlarını (`1 Ja` / `2 Nein`) kapatıyordu; canlı
   karede görülünce üst şeridin altına alındı ve doğrulama yeniden koşuldu.
3. **Solo oyun yenilemeye dayanmaz.** Durum yalnız bellekte; sayfa yenilenince
   `/oda/<id>` gerçek çok oyunculu yola düşer ve oda bulunamaz. Bilinçli
   karar: "hiçbir şey kaydedilmiyor" rozeti bunu söylüyor.
4. **Oyun sonunda "Play again with the same players" çalışıyor** (insan host,
   bot döngüsü sürüyor); "Back to lobby" de lobiye düşürüyor, botlar hazır
   kalıyor.
5. Commit/push yapılmadı; `.env` okunmadı ve yazdırılmadı.

## Çalıştırma komutları (gerçekten koşanlar)

```
pnpm -r typecheck
pnpm test
pnpm --filter @secret-table/web build
pnpm --filter @secret-table/web preview --port 5210 --strictPort
```
