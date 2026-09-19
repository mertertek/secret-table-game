# A6 — geliştirme bot modu (2026-09-10)

Lobide tek düğmeyle 5 bot; kullanıcı 6. koltuktan oynar. Botlar yalnız kendi
sıralarında, kendi yetkili görünümlerindeki **rastgele geçerli** hamleyi oynar.
Kaynak mantık: `scratchpad/party.mjs` (tarayıcıya taşındı).

## Dosyalar

| Yol | Değişiklik |
| --- | --- |
| `apps/web/src/dev/botRunner.ts` | YENİ. Bot kimlikleri, katılım, hazır olma, oyun döngüsü, heartbeat, `stop()`. |
| `apps/web/src/dev/botRunner.test.ts` | YENİ. 11 test (apiClient mock'lu, sahte zamanlayıcı). |
| `apps/web/src/ui/Lobby.tsx` | `DevBotsButton` (yalnız `import.meta.env.DEV`), `botRunner` tembel `import()`. |
| `apps/web/src/ui/Lobby.test.tsx` | YENİ. DEV'de düğmenin render edildiği tek render testi. |
| `apps/web/src/multiplayer/supabaseClient.ts` | `getSupabaseConfig()` dışa açıldı (bot başına ayrı istemci kurmak için). |

Sunucu, sözleşme, oyun kuralı, Supabase şeması, bağımlılıklar **değişmedi**;
yeni HTTP ucu veya komut yok, yalnız mevcut `apiClient` çağrıları kullanıldı.

## Akış

1. **Düğme** — lobide host ve konuk için görünür; oda doluysa (üye ≥ `maxPlayers`)
   ve bot koşmuyorsa devre dışı. İkinci tıklama durdurur; etiket
   `5 bot ekle (dev)` ↔ `Botlar çalışıyor (n)`. Lobi yeniden mount olduğunda
   (oyundan lobiye dönüş) `runningBotCount(roomId)` ile durum geri okunur.
2. **Kimlik** — Supabase yapılandırılmışsa bot başına AYRI, kalıcı olmayan
   istemci: `createClient(url, key, { auth: { persistSession: false,
   autoRefreshToken: true, storageKey: 'st-bot-<i>' } })` + `signInAnonymously()`.
   Kullanıcının kendi `localStorage` oturumuna dokunulmaz. Supabase yoksa
   (yerel bellek kipi) `dev:bot-<rastgele>` token'ı. Her istekten önce
   `client.auth.getSession()` ile güncel token alınır.
3. **Katılım** — davet kodu lobiden (`snapshot.inviteCode`); hedef `target = 6`,
   eksik koltuk kadar bot: `join_room` → `lobby_view` (kendi `localPlayerId`) →
   `set_ready`. Adlar: Bot-Ada, Bot-Bora, Bot-Cem, Bot-Derya, Bot-Efe.
4. **Döngü** — oyun başlayana kadar 2,5 s'de bir `lobby_view`; sonra ~1,2 s'de bir
   lider botun `view`'ı:
   - `role_reveal`: hazır olmayan botlar kendi `ack_role` aksiyonunu gönderir.
   - `voting`: oy vermemiş, hayatta botlar %75 evet (seçenek yine kendi
     görünümünden).
   - diğer fazlar: sıradaki aktör (`nomination`/`president_discard`/
     `chancellor_choice`/`veto_response`/`executive_action`) bot ise o botun
     `view.actions` listesinden RASTGELE aksiyon + RASTGELE seçenek;
     `chancellor_choice`te veto yerine `enact_policy` tercih edilir; başarılı
     hamleden sonra `ack_private_result` varsa hemen gönderilir.
   - Kullanıcının koltuğuna asla hamle gitmez. Hata yanıtları (STALE_ACTION vb.)
     yutulur, döngü sürer. 30 s'de bir `heartbeat`.
   - `game_over`: beklenir; rematch ile yeni `gameId` gelirse aynı döngü devam
     eder. Lobiye dönülürse bot hazır kalır (hazır değilse yeniden `set_ready`)
     ve yeni oyunu bekler.
5. **Yaşam döngüsü** — `startBots()` → `{ roomId, count, stop() }`. Oda kimliğine
   göre modül düzeyinde tek koşucu (aynı odaya iki kez bot eklenmez). `pagehide`
   ile (sekme/sayfa kapanışı) durur. Konsolda yalnız kısa `[bots] …` satırları.

## Üretim paketi

`Lobby.tsx` içindeki `import.meta.env.DEV ? <DevBotsButton …/> : null` dalı
derlemede düşer; tembel `import('../dev/botRunner')` ile birlikte chunk hiç
üretilmez. `apps/web/dist/assets/*.js` içinde doğrulandı:

- `grep -rl "Bot-Ada" assets/*.js` → **0** dosya
- `grep -rl "botRunner" assets/*.js` → **0** dosya
- `grep -rl "5 bot ekle" assets/*.js` → **0** dosya
- Yalnız `index-*.js.map` içindeki `sourcesContent` (Lobby.tsx kaynağı) geçiyor;
  çalıştırılabilir çıktı temiz.

## Kontroller (gerçekten çalıştırıldı)

- `pnpm --filter @secret-table/web typecheck` — geçti.
- `pnpm --filter @secret-table/web test` — **115** test (yeni: botRunner 11 +
  Lobby 1). `pnpm test` (kök, tüm paketler): **342** test (11/28/70/83/35/115).
- `pnpm typecheck` (kök, 6 paket) — geçti.
- `pnpm build` (kök) — geçti; giriş paketi boyutu değişmedi.

Test kapsamı (`botRunner.test.ts`): 4 üyeli odaya hedefe kadar bot ekleme +
`set_ready`; dolu odada bot eklememe; `role_reveal`da yalnız botların onay
göndermesi (kullanıcı koltuğu dokunulmaz); `voting`de yalnız oy vermemiş botun
oy vermesi; aktör bot değilken hamle göndermeme; aktör bot iken yalnız kendi
görünümündeki geçerli `actionId`/`optionId` çifti; `stop()` sonrası hiç istek
gitmemesi (sahte zamanlayıcı, 60 s ileri); `chooseMove` (rastgele seçim geçerli
çift, `chancellor_choice`te enact tercihi, aksiyon yoksa `null`) ve
`actorPlayerId` faz eşlemesi.

## Gerçek deneme (yerel dev sunucu + canlı Supabase, ajan tarayıcı paneli)

Oda `ccc9425f`, host `Mert-QA`. "5 bot ekle (dev)" → 5 bot (Bot-Ada…Bot-Efe)
katıldı ve **hazır** oldu (6 oyuncu). "Hazırım" + "Oyunu başlat" sonrası:

- `role_reveal`: kullanıcı onayı + bot onayları → faz ilerledi.
- `nomination`: Bot-Ada aday gösterdi; `voting`: 6 evet / 0 hayır ile kabul.
- `president_discard` (Bot-Ada) → `chancellor_choice` (Bot-Bora) → **faşist kanun
  çıktı** (tahta 0/5 liberal, 1/6 faşist) → yeni `nomination` (Bot-Bora) ve yeni
  oylama. Üst şerit metni her fazda doğru değişti; menüdeki tur geçmişi ve
  "Son seçim: Bot-Ada / Bot-Bora — kabul (6 evet / 0 hayır)" tutarlıydı.
- Konsol: `[bots] 5 bot hazır`, `[bots] faz=… rev=…`, `[bots] Bot-Ada nominate`,
  `[bots] Bot-Ada discard_policy`, `[bots] Bot-Bora enact_policy`.
- `Menü → Lobiye dön` sonrası lobide botlar hazır kaldı, düğme
  "Botlar çalışıyor (5)" olarak geri geldi; ikinci tıklama `[bots] durdu (5)`.

Not: 3D canvas panelde boş göründü (bilinen ResizeObserver gecikmesi, uygulama
hatası sayılmadı); HTML üst şerit / alt çubuk / menü doğru çalıştı.

## Sınırlar

- Lobi bileşeni oyun başlarken unmount olduğu için botlar **Lobby unmount'ında
  durdurulmaz** (durdurulsaydı oyun başlar başlamaz düşerlerdi). Durdurma
  yolları: düğmeye ikinci tıklama ve `pagehide` (sekme/pencere kapanışı).
  Sekme kapanınca botlar susar ve oyun sunucu tarafında `paused` olur.
- Botlar Realtime'a abone olmaz; 1,2 s / 2,5 s yoklama yeterlidir (dev modu).
  Bu, 6 kişilik odada dakikada ~50-150 HTTP isteği demektir; yalnız geliştirme.
- Bot stratejisi yoktur: rastgele geçerli hamle (yalnız `chancellor_choice`te
  veto yerine enact). Oyun dengesi veya "akıllı" davranış hedeflenmedi.
- Odaya katılan bot koltukları oyun sonrası da odada kalır; test odası
  kullanıldıktan sonra yeni oda açmak en temizi.
- Anonim oturumlar Supabase'de gerçek kullanıcı yaratır (dev projesinde birikir).
