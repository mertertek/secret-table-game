# D14 — Geliştirici senaryo atlaması (`dev_scenario`) · uygulama raporu

Ajan: Claude (Opus 5, yan ajan) · 2026-09-12 09:49–10:20 (+03:00)
Tasarım: `docs/ROADMAP.md` D14 satırı
Amaç: kullanıcı silah/infaz sahnesini (D12) ve diğer geç aşamaları oyunu baştan
oynamadan denesin. **Yalnız geliştirme**; üretim paketinde ve üretim sunucusunda yok.

---

## 1. Kullanım (kullanıcı için)

1. `pnpm --filter @secret-table/web dev --port 5199 --strictPort` ile yerel sunucuyu aç.
2. Lobide istersen **"5 bot ekle (dev)"** ile masayı doldur, **Oyunu başlat**.
3. Oyun ekranında **`M`** (ya da sağ üstteki **Menü**) → menünün altındaki
   **Geliştirici** bölümü.
4. İki düğme:
   - **İnfaza atla (şimdi)** — faşist tahta o düzenin ilk infaz yuvasına
     (4. yuva) gelir, **başkanlık sende** olur ve **infaz yetkisi hemen açılır**.
     Menüyü kapat, alt çubuktan hedefi seç → **İnfaz et**. D12 koreografisi
     (silah, ateş, çöken karakter, `player_eliminated`) oynar.
   - **İnfaz turu (kanunlar hazır)** — faşist tahta 3. yuvada, **aday belirleme**
     fazı, **başkan sensin** ve **destenin üstündeki 3 kart faşist**. Şansölye
     aday göster → oylama → kanun → infaz yetkisi sana gelir.
5. Hata olursa (örn. kapı kapalıysa `NOT_ALLOWED`) menüde kırmızı satırda görünür;
   başarıda "Senaryo uygulandı." yazar ve görünüm tazelenir.

**Uyarı (`İnfaz turu`):** o anda 3 faşist kanun vardır; `hitlerChancellorWinAt = 3`
olduğu için **Hitler'i şansölye gösterirsen oyun faşist zaferiyle biter**. İnfazı
görmek istiyorsan başka birini aday göster.

Botlarla uyum: yetki yerel oyuncuda olduğu için botlar hedef seçmez, yalnız oy
verir ve kendi sıraları gelince oynar (`botRunner.actorPlayerId` zaten
`currentPower.actorId`'yi okuyor; kod değişmedi, test eklendi).

---

## 2. Güvenlik kapısı

| Katman | Davranış |
| --- | --- |
| Sözleşme (`commands.ts`) | `LobbyCommand` birliğine **additive** `{ type: 'dev_scenario', scenario }`. `CONTRACT_VERSION` `0.2.0` sabit; npm paketi 0.2.1. |
| Şema (`schemas.ts`) | Komutu ayrıştırır (biçim doğrulaması), yetki vermez. |
| **Sunucu (`service.ts`)** | **Yalnız `process.env.SECRET_TABLE_DEV_TOOLS === '1'` iken uygular.** Aksi hâlde `{ ok: false, error: 'NOT_ALLOWED' }` — bilinmeyen/izinsiz komutla **aynı** yanıt, yani üretimde komutun varlığı ayırt edilemez. |
| Yerel dev (`vite/apiPlugin.ts`) | `configureServer` içinde `process.env.SECRET_TABLE_DEV_TOOLS = '1'`. Yalnız dev sürecinin belleğine yazılır; `.env` dosyasına **yazılmaz**. |
| Vercel | Bu değişken **ASLA ayarlanmaz** (docs/DEPLOYMENT.md § 6 tablosu). |
| İstemci (`GameMenu.tsx`) | Bölüm `import.meta.env.DEV ? lazy(() => import('../dev/devScenarioMenu')) : null`. Üretim derlemesinde dal ölür, chunk hiç üretilmez. |

Kayıt yolu normal hamleyle aynıdır: CAS'li `commitMove`, `revision` artışı,
Realtime sürüm sinyali, `processed_commands` ile **idempotentlik** (aynı
`commandId` ikinci kez uygulanmaz; aynı `commandId` farklı senaryoyla
`NOT_ALLOWED`).

---

## 3. Oyun kuralı etkisi (`packages/game-core/src/devScenario.ts`)

Saf işlev, `applyCommand` kalıbı: `structuredClone`, sonuç/hata birliği
(`{ ok: true, state, events } | { ok: false, code }`), `revision` +1, `phaseSeq` +1.

**Değişen:** faz, faşist tahta sayacı + `enactedPolicies`, seçim sayacı (0),
başkanlık koltuğu/ofisi, `specialElection` (null), deste **SIRASI**.
**Değişmeyen:** roller, oyuncu kimlikleri, deste **İÇERİĞİ** (6 liberal + 11 faşist
toplamı her senaryoda korunur — testle ölçüldü), incelemeler.

- `execution_now`: `fascistPolicies = layout.fascistPowers.indexOf('execution') + 1`
  (5-6 / 7-8 / 9-10 düzenlerinin hepsinde **4**), faz `executive_action`
  (`power: 'execution'`, `targetId: null`, `resolved: false`), hükümet
  `{ presidentId: actorId, chancellorId: <bir sonraki hayatta koltuk> }`,
  `office_moved` olayları üretilir.
- `execution_round`: `fascistPolicies = ilk infaz yuvası − 1` (**3**), faz
  `nomination` (başkan `actorId`), destenin ilk 3 kartı faşist olacak biçimde
  **mevcut kartlar yeniden dizilir** (deste yetmezse çöp yığını desteye katılır),
  `lastGovernment = null` (tur kısıtı kalkar).
- Tahtaya konan faşist kartlar deste/çöp havuzundan **çekilir**; sayaç düşürülürse
  kart desteye geri konur. Yasama/veto aşamasında çağrılırsa eldeki kartlar çöpe
  döner (gizli el yeni faza sızmaz).
- Ret: bitmiş oyun `GAME_OVER`, oyuncu olmayan aktör `NOT_A_PLAYER`, ölü aktör
  `PLAYER_DEAD`. Lobide (oyun durumu yok) sunucu `STALE_ACTION` verir.

**Sapma / not:** lobi komut yanıtı (`{ ok: true }`) cue taşımaz — `start_game` /
`play_again` ile aynı. `devScenario` `office_moved` olaylarını üretir ama bu yol
onları istemciye iletmez; istemci `refresh()` ile yeni görünümü alır. Asıl
`player_eliminated` cue'su normal `use_power` komut yanıtıyla gelir (canlı
denemede doğrulandı).

---

## 4. Değişen / yeni dosyalar

Yeni:
- `packages/game-core/src/devScenario.ts`, `packages/game-core/src/devScenario.test.ts`
- `packages/server/src/service.dev-scenario.test.ts`
- `apps/web/src/dev/devScenarioMenu.tsx`, `apps/web/src/ui/GameMenu.dev.test.tsx`
- `docs/qa/claude/D14-dev-scenario.md`, `docs/qa/claude/d14/` (9 jpeg)

Değişen:
- `packages/contracts/src/commands.ts` (additive `DevScenarioName` + `LobbyCommand` dalı)
- `packages/contracts/src/schemas.ts`, `packages/contracts/package.json` (0.2.0 → 0.2.1)
- `packages/game-core/src/index.ts` (dışa aktarım)
- `packages/server/src/service.ts` (`dev_scenario` dalı + `runDevScenario` + env kapısı)
- `apps/web/vite/apiPlugin.ts` (yerelde `SECRET_TABLE_DEV_TOOLS=1`)
- `apps/web/src/ui/GameMenu.tsx` (tembel "Geliştirici" bölümü)
- `apps/web/src/dev/botRunner.test.ts` (yetki insandayken bot oynamaz testi)
- `docs/CONTRACT.md` (§ 9.6), `docs/DEPLOYMENT.md` (§ 6 env tablosu), `docs/ROADMAP.md`, `docs/agents/CLAUDE.md`

D2/D12/D3 dosyalarına dokunulmadı. Commit YOK.

---

## 5. Testler (gerçekten çalıştırıldı)

```
pnpm -r typecheck                      # 6/6 Done
pnpm test                              # 669 test
pnpm --filter @secret-table/web build  # geçti
```

| Paket | Önce | Sonra |
| --- | --- | --- |
| contracts | 11 | 11 |
| fixtures | 37 | 37 |
| game-core | 70 | **98** (+28 `devScenario.test.ts`) |
| scene | 275 | 275 |
| server | 35 | **44** (+9 `service.dev-scenario.test.ts`) |
| web | 199 | **204** (+4 `GameMenu.dev.test.tsx`, +1 botRunner) |
| **Toplam** | 627 | **669** |

Kapsam: her düzen (5/6/7/8/9/10 kişi) için sayaç doğruluğu, kart sayısı (6L/11F/17)
ve rol korunumu; `execution_now` → `use_power` → `player_eliminated`; Hitler infazı
→ `hitler_executed`; `execution_round` → aday → oy → kanun → infaz yetkisi → infaz;
saf işlev (girdi değişmiyor); env kapısı açık/kapalı; idempotentlik; üye olmayan
reddi; DEV menüsünde bölümün görünmesi ve komutun `apiClient`'a gitmesi.

---

## 6. Üretim paketi kanıtı (`apps/web/dist`, temiz build)

```
$ grep -rIl --exclude='*.map' -e dev_scenario -e Geliştirici -e devScenarioMenu \
    -e execution_now -e execution_round -e SECRET_TABLE_DEV_TOOLS -e 'İnfaza atla' dist/
(0 eşleşme — her desen için 0 dosya)
```

Chunk listesi: `index`, `react-vendor`, `three` + 2 css + 2 ttf. Ayrı bir
`devScenarioMenu` chunk'ı **üretilmedi** (botRunner ile aynı sonuç). Kaynak
haritalarında yalnız `GameMenu.tsx`'in kendi metni geçtiği için `devScenarioMenu`
adı görünür; dev modülünün kodu (`İnfaz turu`, `DevScenarioSection` gövdesi)
pakette de haritada da **yok** (`map.sources` içinde `/dev/` yolu 0 adet).

---

## 7. Canlı deneme

**Tur 1 — gerçek Supabase (port 5199, `mode: supabase`):** tarayıcı panelinden
oda açıldı, 5 gerçek anonim bot katıldı, oyun başlatıldı, menü → Geliştirici →
"İnfaza atla (şimdi)" → görünüm `Başkanlık yetkisi` / `İnfaz · Bir oyuncu seç`,
tahta **Faşist 4/6**, **Deste 13/0** (17 − 4, kart sayısı korunuyor), başkan =
yerel oyuncu. Hedef Bot-Cem seçildi → **"İNFAZ · Bot-Cem vuruldu"** duyurusu,
Bot-Cem `ELENDİ` ve çökmüş poz, tur normal akışla `Aday belirleme`ye geçti.

**Tur 2 — kare almak için yerel bellek kipi (port 5198, Supabase env'i boş):**
aynı akış Playwright ile baştan sona koşturuldu ve kareler alındı. (Supabase
anonim kayıt sınırına takıldığı için kare turu bellek kipinde yapıldı; kural ve
komut yolu aynı sunucu kodudur.)

Kareler — `docs/qa/claude/d14/` (jpeg, her biri ≤ 110 KB):

| Dosya | İçerik |
| --- | --- |
| `d14-01-lobi-botlar.jpg` | Lobi, bot modu ile dolu masa |
| `d14-02-menu-gelistirici.jpg` | **Menü → Geliştirici bölümü, iki düğme** |
| `d14-03-senaryo-uygulandi.jpg` | "Senaryo uygulandı." |
| `d14-04-infaz-yetkisi.jpg` | Faşist 4/6, "İnfaz · Bir oyuncu seç", hedef düğmeleri |
| `d14-05-infaz-anindan-sonra-0ms.jpg`, `d14-05-infaz-1515ms.jpg` | Hedef elendi (çökmüş poz, `ELENDİ`) |
| `d14-06-sonrasi.jpg` | Tur normal akışla devam ediyor |
| `d14-07-silah-t1300.jpg`, `d14-08-silah-yerel-t1300.jpg` | **Silah + namlu flaşı** (D12 donmuş sahne aracı, `&t=1300`) |

**Dürüst sınır:** canlı akışın kendi karelerinde ateş anı yakalanamadı —
Playwright'ın yazılım GL'li başsız ekran görüntüsü 2600 ms'lik cue içinde
flaş karesine denk gelmedi; yakalanan kareler ateşten sonrasını gösteriyor.
Silah/flaş görseli için D12'nin kendi donmuş sahne aracıyla alınan
`d14-07/08` kareleri eklendi (aynı kod yolu, `execution-shot-seat` /
`execution-shot-local` fixture'ları). D12 raporundaki 6 kare de geçerlidir.

---

## 8. Açık / kullanıcıya

- Kullanıcı kabulü bekleniyor: menü akışı ve iki senaryonun beklentiyi karşılaması.
- İstenirse üçüncü bir senaryo (örn. "veto turu", "özel seçim") aynı kalıpla
  eklenebilir; `devScenario` tek dosyada ve additive.
