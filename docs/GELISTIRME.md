# Geliştirme notları (Türkçe)

Bu dosya kök README'nin eski Türkçe geliştirici bölümüdür; public README kısaltılınca buraya taşındı. Güncel durum için `docs/ROADMAP.md` ve `docs/agents/CLAUDE.md`.

# Secret Table — 3D Secret Hitler projesi

Tarayıcıdan, davet bağlantısıyla katılan 5–10 arkadaş için 3D masa oyunu. İlk hedef 6 ve 7 kişilik gerçek oyunlar. `Secret Table` geçici proje adıdır.

**Durum:** 9 Eylül 2026 — C00–C05 tamam. pnpm/TypeScript workspace, ortak sözleşme
tipleri (`@secret-table/contracts` `0.2.0`), belirlenimci oyun motoru (`game-core`,
C02), sunucu + Supabase şeması/RLS/RPC (`server`, C03), giriş/lobi/oyun ekranları ve
HTML kontroller (C04), canlı veri ↔ 3D sahne entegrasyonu (`useRoomState`, C05) kuruldu
ve doğrulandı. Codex X01/X02 3D masa teslim etti; X03 (animasyon/ses) sürüyor. Kalan:
gerçek oyun geceleri (J01), görsel cila (X04), Vercel/Supabase üretim dağıtımı (C06).
Bu bağımsız kişisel proje `Development/bireysel/secret-table` altında çalışır.

**Yayın kararı:** React/Vite + 3D arayüz ve HTTP oyun API'si Vercel'de; oyun durumu Supabase Postgres'te; misafir kimliği Supabase Auth, anlık bildirimler Supabase Realtime ile. Bu mimaride Supabase ilk oynanabilir sürümden itibaren gereklidir. Kalıcı oda verisi ayrı bir sürekli çalışan sunucuya ihtiyaç bırakmaz. Önceki Colyseus/bellek planının yerini bu düzen alır.

## İş bölümü

| Sorumlu | Teslim edeceği alan |
| --- | --- |
| Codex | Ortam/harita, karakter/avatar, masa, kartlar ve tarafların görsel kimliği; malzemeler, ışık, kamera, animasyonlar ve arayüzün görsel dili |
| Claude Code | Proje kurulumu, ortak veri tipleri, oyun motoru, odalar, bağlantılar, ekranlar, 3D entegrasyonu, testler ve yayın hazırlığı |
| Kullanıcı | Görsel tercihleri yönlendirme, arkadaşlarla oyun testi, Supabase ve Vercel projelerini bağlama |

Bu dağılım varsayılandır. Kullanıcı istediği görevi Codex, Claude veya başka bir ajana verebilir; yeni görevlendirme dosya sahipliğini o iş kapsamında değiştirir. Görev, kapsam ve devir Markdown dosyalarına yazılır; aynı dosyada eşzamanlı düzenleme yapılmaz.

## Dosya haritası

- [Ayrıntılı plan](docs/PLAN.md): kapsam, mimari, bağımlılıklar, görevler ve kabul ölçütleri.
- [3D tasarım](docs/DESIGN.md): sanat yönü, nesneler, ölçüler, animasyon ve performans hedefleri.
- [Ortak sözleşme](docs/CONTRACT.md): 3D sahneye gelen bilgiler ve sahneden çıkan kullanıcı seçimleri.
- [Koordinasyon](docs/COORDINATION.md): dosya sahipliği, güncelleme ve devir kuralları.
- [Kalite kontrolü](docs/QA.md): gizli bilgiler, oyun akışı, yeniden bağlanma ve görsel kontroller.
- [Vercel + Supabase yayın planı](docs/DEPLOYMENT.md): veri modeli, eşzamanlı hamleler, ortam değişkenleri ve dağıtım sırası.
- [Kararlar](docs/DECISIONS.md): nedenleriyle kısa mimari kararlar.
- [Varlık listesi](docs/ASSETS.md): 3D nesnelerin teslim durumları.
- [Codex durumu](docs/agents/CODEX.md) / [Claude durumu](docs/agents/CLAUDE.md): yürüyen işler ve karşı tarafa notlar.

## CLI ile başlama

İki CLI oturumunu da **bu klasörde** aç. Mevcut mutlak konum:

```text
<proje-klasörü>
```

Codex için giriş yönergeleri `AGENTS.md`, Claude Code için `CLAUDE.md` içinde. İkisi de ortak koordinasyon dosyasına yönlendirir. Bu dosyalar başka bir ajanı başlatmaz; kullanıcı iki oturumu kendisi çalıştırır.

Önce Claude'a şu görevi ver:

```text
Bu projenin altyapı ve entegrasyon sorumlususun. CLAUDE.md yönergelerini uygula.
docs/PLAN.md içindeki C00 ve C01'i tamamla: çalışma alanını kur, sahne sözleşmesini
TypeScript'e geçir, örnek veriler ve /dev/scene girişini hazırla. Vercel Functions +
Supabase Postgres/Auth/Realtime mimarisini kullan; docs/DEPLOYMENT.md'yi oku.
Colyseus veya bellekte tutulan kalıcı oyun odası kurma. 3D tasarım Codex'e ait.
docs/agents/CLAUDE.md içinde durumunu ve Codex'e devrini güncel tut.
Sözleşmeyi değiştirme ihtiyacı varsa önerini kaydet; mevcut sözleşmeye uyan işleri sürdür.
Sonunda doğruladığın çalıştırma komutlarını README'ye yaz. Bu görevde yayın yapma.
```

C00/C01 devrinden sonra Codex'e:

```text
Bu projenin 3D tasarım sorumlususun. AGENTS.md yönergelerini uygula.
docs/agents/CLAUDE.md içindeki devri kontrol et. docs/DESIGN.md doğrultusunda önce X01,
sonra X02'yi tamamla. Örnek verilerle çalışan gerçek 3D masa ve nesneler üret.
Sahne paketinde çalış; bağlantı, oyun motoru ve ortak yapılandırma Claude'a ait.
docs/agents/CODEX.md ve docs/ASSETS.md dosyalarını görev sınırlarında güncel tut.
Çalışan sahneyi görsel olarak kontrol et ve ekran görüntüsü konumlarını devre ekle.
```

Claude için sonraki görev:

```text
CLAUDE.md ve iki ajan durum dosyasını yeniden oku. C02 ve C03'ü tamamla:
oyun motoru, gizli veri filtreleme, Vercel HTTP API, Supabase işlemleri ve yeniden bağlanma.
CODEX-002 devir notunu ve docs/DEPLOYMENT.md'yi uygula. 3D tasarımı Codex sürdürüyor.
Mevcut sözleşmeye göre ilerle; değiştirdiğin alanları ve test sonuçlarını kendi durum
dosyana yaz. Devir notlarındaki mesajları kimlikleriyle yanıtla.
```

## Güncel çalışma komutları

Ön koşul: Node 22 (`.nvmrc`), pnpm 10 (`corepack enable`). Aşağıdaki komutlar
2026-09-09'da bu ortamda çalıştırılıp doğrulandı.

```bash
pnpm install            # workspace bağımlılıkları (tek kilit dosyası: pnpm-lock.yaml)
pnpm dev                # apps/web Vite dev sunucusu → http://localhost:5173
                        #   /              giriş (isim + oda aç / davet koduyla katıl)
                        #   /katil/:code   davet bağlantısı → isimle katılım
                        #   /oda/:roomId   canlı lobi + oyun ekranı (3D sahne + HTML kontroller)
                        #   /dev/scene     sentetik sahne önizleme (yalnız dev derlemesinde)
                        #   /api/health    sağlık kontrolü (JSON)
                        #   /api/game      oyun HTTP API'si (POST, eylem-tabanlı)
pnpm typecheck          # tüm paketlerde tsc --noEmit (strict)
pnpm test               # vitest — 163 test (contracts 6, fixtures 28, game-core 65,
                        #   scene 30, server 28, web 6)
pnpm build              # apps/web üretim derlemesi → apps/web/dist (dev girişleri hariç)
pnpm preview            # üretim derlemesini yerel sun
pnpm check              # typecheck + test
```

Doğrulama:
- **C00–C03 (2026-09-09):** `pnpm typecheck` 6/6 temiz; Supabase şeması + API entegrasyonu
  canlı yerel Supabase'e karşı doğrulandı. Ayrıntı: [C02/C03 QA](docs/qa/claude/C02-C03.md).
- **C04/C05 (2026-09-09):** `pnpm typecheck` 6/6 temiz; `pnpm test` → 142 test; `pnpm build`
  → `apps/web/dist` (698 modül; game-core / server / secret anahtar üretim tarayıcı paketine
  girmiyor — grep ile doğrulandı; sahne fontları `dist/assets/` içine paketlendi). Dev kipinde
  5 oyunculu tam oyun HTTP API üzerinden `game_over`'a kadar oynandı; tarayıcıda giriş → lobi →
  oyun (rol onayı, oylama, rol paneli) elle doğrulandı. Ayrıntı: [C04/C05 QA](docs/qa/claude/C04-C05.md).

### Oyun API'si (`POST /api/game`)

Tek eylem-tabanlı uç. Kimlik `Authorization: Bearer <token>` başlığından
doğrulanır. Gövde: `{ "action": "...", ... }`. Eylemler: `create_room`,
`join_room`, `lobby_view`, `view`, `command`, `lobby`, `heartbeat`, `claim_control`.
Yanıtlar `Cache-Control: private, no-store`.

- **Üretim / `SUPABASE_URL` + `SUPABASE_SECRET_KEY` tanımlı:** `SupabaseGateway` +
  Supabase Auth anonim oturum token doğrulaması.
- **Supabase yoksa (yalnız yerel geliştirme):** süreç ömürlü `InMemoryGateway` +
  `Bearer dev:<id>` sahte kimliği. Kapı (`devAuthAllowed`): `VERCEL_ENV` `production`/
  `preview` iken **her zaman kapalı** — `SECRET_TABLE_ALLOW_DEV_AUTH=1` bu ortamlarda
  yok sayılır. Bayrak yalnız yerel + `vercel dev` (`VERCEL_ENV=development`) için.
  Vercel preview/production'da Supabase eksikse istek `503 SUPABASE_NOT_CONFIGURED` alır.
  Boş / yer tutucu (`__FILL_ME__`, `YOUR-...`) env değeri "tanımsız" sayılır. UI'da
  `getSupabaseClient()` `null` olunca istemci de `dev:` kipine düşer.

`lobby_view` gövdesi `{ roomId }`; yanıt `LobbySnapshot` (koltuklar, hazır durumu,
davet kodu, `canStart`). Oyun başlamadan `view` `STALE_ACTION` verdiği için lobi
ekranı `lobby_view` kullanır; `status: 'in_game'` olunca istemci `view`'e geçer.

### Ortam değişkenleri

`.env` deposu kökten okunur (`cp .env.example .env`). `VITE_` önekliler tarayıcıya
girer; öneksizler yalnız Vercel Functions içindir. Anahtar değerleri Git'e yazılmaz
(`.env` gitignore'da). Uygulama Supabase olmadan da yerelde çalışır (yukarıdaki `dev:`
kipi). `SECRET_TABLE_ALLOW_DEV_AUTH=1` yalnız yerel / `vercel dev` içindir; Vercel
preview/production'da yok sayılır.

Uzak Supabase bağlama + migration adımları: `docs/DEPLOYMENT.md` § 7 ("C06 — hedef
Supabase'e migration uygulama"). CLI için `.env`'e ek olarak `SUPABASE_PROJECT_REF`,
`SUPABASE_ACCESS_TOKEN` (`sbp_...`), `SUPABASE_DB_PASSWORD` doldurulur; sonra
`supabase link` + `supabase db push`.

### Supabase (yerel) — doğrulandı

```bash
pnpm supabase start        # Docker; ilk çalıştırma imajları indirir (~birkaç dk)
pnpm supabase db reset     # migrations/ dosyalarını temiz uygula
pnpm supabase stop
```

`supabase/migrations/` — `0001_schema.sql` (tablolar + RLS + GRANT geri alma),
`0002_functions.sql` (`create_room`, `join_room`, `start_game`, `commit_move` atomik
CAS, oturum RPC'leri — EXECUTE yalnız `service_role`), `0003_realtime.sql`
(`room:<id>` özel kanalı, sürüm sinyali tetikleyicisi), `0004_explicit_grants.sql`
(açık `service_role` GRANT'ları + `public.is_room_member()` ile Realtime kanal
yetkisi; otomatik izinlere güvenmez), `0005_trigger_fn_grants.sql` (tetikleyici fn
EXECUTE temizliği). 2026-09-09'da yerel yığında `db reset` ile temiz uygulandı.

**C06 (2026-09-09):** `0001`–`0005` hedef projeye (`<PROJECT_REF>`) **Supabase
Management API `database/query`** ucuyla uygulandı (DB parolası verilmediğinden
`supabase link` + `db push` yerine). Doğrulandı: 5 tablo + RLS; gizli tablolar ve tüm
RPC'ler `anon`/`authenticated`'a kapalı (REST 401 / `42501`); yalnız `service_role`
erişebiliyor; Realtime özel kanal yalnız üyeye açık; anonim giriş açıldı. Ayrıntı:
`docs/qa/claude/C06.md`, adımlar `docs/DEPLOYMENT.md` § 7.

### Vercel

Proje kökü `apps/web`, framework Vite (`apps/web/vercel.json`). `api/*.ts` dosyaları
Node Function'dır; yerelde `vite/apiPlugin.ts` köprüsüyle, üretimde Vercel'in kendi
çalışma ortamıyla sunulur.

## Depo yapısı

```text
apps/web/              React/Vite uygulaması
  api/                 Vercel Functions: health.ts, game.ts (+ _lib/context.ts kimlik kapısı)
  src/app/             rotalar + ekranlar: EntryPage, JoinPage, RoomPage, hata sınırı
  src/ui/              HTML kontroller: Lobby, GameScreen, ActionPanel, RolePanel, SceneFrame, text.ts
  src/multiplayer/     apiClient, guestSession (anon), roomChannel, useRoomState (C05 canlı döngü)
  src/adapters/        sceneView — yetkili yanıt → TableScene props (cue kuyruğu, seçim yaşam döngüsü)
  vite/apiPlugin.ts    yerel Vercel Function köprüsü
packages/contracts/    Ortak tipler + kurulum metaverisi (rules.ts) + zod şemaları — tek yazar Claude
packages/fixtures/     Sentetik SceneView örnekleri (/dev/scene bunları listeler)
packages/scene/        TableScene — Codex sahibi (X01/X02 teslim edildi)
packages/game-core/    Saf oyun motoru (C02): setup, engine, selectors — belirlenimci
packages/server/       Sunucu (C03): GameService, projection, GameGateway (InMemory + Supabase)
supabase/migrations/   0001 şema+RLS, 0002 RPC/atomik CAS, 0003 Realtime
```

Paketler kaynak koddan bağlanır (`exports` doğrudan `src/*.ts` gösterir); iç
paketler için ayrı derleme adımı yoktur.

## Ortak hafızanın sınırı

Markdown dosyaları canlı bir mesaj servisi değildir. Ajanlar iş başında, görev değiştirirken, ortak sözleşmeye dokunmadan önce ve teslimde dosyaları yeniden okur. Çalışmayan bir oturum dosya değişti diye kendiliğinden uyanmaz. Kesintisiz dosya izleyen ek bir otomasyon bu aşamada kurulmadı.

CLI yönerge dosyalarının dayanağı: [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) ve [Claude Code proje hafızası](https://code.claude.com/docs/en/memory).

