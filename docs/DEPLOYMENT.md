# Vercel + Supabase mimarisi ve yayın planı

2026-09-09 kullanıcı tercihi: uygulama Vercel'e dağıtılacak; veritabanı Supabase olacak. Bu belge önceki sürekli çalışan, bellekte oda tutan sunucu planının yerini alır. Henüz uygulama, uzak Supabase projesi veya Vercel deployment'ı oluşturulmadı.

## 1. Çalışma düzeni

| Parça | Nerede / görevi |
| --- | --- |
| React/Vite + R3F | Vercel statik web uygulaması; 3D nesneler ve ekranlar |
| HTTP oyun API'si | Vercel Functions, Node.js; kimlik/hamle doğrulama, motor, yetkili görünüm |
| Oyun durumu | Supabase Postgres; tek kalıcı doğru durum |
| Misafir kimliği | Supabase Auth; isimle katılım ekranının arkasında anonim oturum |
| Anlık bildirim | Supabase Realtime; özel oda kanalında sadece sürüm değişikliği sinyali |
| Dosyalar | İlk sürümde 3D varlıklar web derlemesinde; Supabase Storage zorunlu değil |

Tur bazlı oyunda her hamle kısa HTTP işlemi olabilir. Supabase bu nedenle ilk sürümden itibaren gereklidir; yalnız sonradan skor kaydetmek için kullanılan isteğe bağlı ek değildir. Kullanıcı e-posta/şifre hesabı açmaz; arka planda kimliği doğrulanmış misafir oturumu vardır. [Supabase anonim girişler](https://supabase.com/docs/guides/auth/auth-anonymous).

Vercel'in güncel belgelerinde WebSocket desteği beta olarak bulunuyor; bağlantı süresi ve örnekler arası kalıcı durum yine ele alınmalı. Bu proje kalıcı oda sürecine bağlanmak yerine kısa HTTP işlemleri ve Supabase Realtime kullanacak. Bu bir proje tercihidir. [Vercel WebSocket yaşam döngüsü](https://vercel.com/docs/functions/websockets).

## 2. Planlanan veri modeli

Kesin tablo/işlev adlarını Claude C03'te migration olarak yazar. Şema en az şu sorumlulukları ayırır:

| Mantıksal kayıt | İçerik | İstemci erişimi |
| --- | --- | --- |
| `rooms` | Oda kimliği, davet kodu, durum, süreler | Varsayılan HTTP API üzerinden; herkese açık liste yok |
| `room_members` | Oda, doğrulanmış Auth kullanıcı kimliği, koltuk, üyelik durumu | RLS ile yalnız kendi üyeliğinin gerekli alanları; oyun bilgisi yok |
| `game_states` | Tam oyun durumu, gizli roller/deste/eller, `revision`, `stateVersion` | Yalnız sunucu; Data API istemci okuma/yazması ve Realtime yayınından çıkarılmış |
| `processed_commands` | Oda/oyun, kullanıcı, komut kimliği, istek özeti, sonuç sürümü | Yalnız sunucu; kalıcı tek uygulama kaydı |
| `player_sessions` | Etkin oturum nesli, son görülme, geri dönüş süresi | Yalnız sunucu; kimliği doğrulanmış API günceller |

Gizli tablolar ve sunucu kayıt işlevleri için istemci rollerinin erişimleri açıkça kaldırılır. RLS tek başına yeterli varsayılmaz; şema/tabloların GRANT ve RPC EXECUTE izinleri de kontrol edilir. Üyelik politikasının kendi kendini çağıran RLS döngüsü oluşturmadığı test edilir. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [DB işlevleri ve izinler](https://supabase.com/docs/guides/database/functions).

Vercel API'nin kullandığı yüksek yetkili Supabase anahtarı kullanıcı yetkisini otomatik uygulamaz. API doğrulanmış kullanıcı kimliğini elde eder, üyelik ve bütün oyun kurallarını ayrıca denetler. İstemcinin gönderdiği `userId/playerId` yetki kaynağı değildir.

## 3. Atomik hamle ve eşzamanlılık

1. İstemci Supabase access token'ını HTTPS Authorization başlığında ve benzersiz `commandId`yi hamle zarfında yollar. Token URL'ye yazılmaz.
2. API token'ı doğrular; üyelik, etkin oturum ve oda süresini kontrol eder. Aynı kimlikli işlenmiş komut varsa önceki güvenli sonucu döndürür.
3. API mevcut oyun durumunu ve sürümünü okur. Saf TypeScript motoruyla hamleyi doğrular, yeni durumu hesaplar.
4. Sunucuya özel DB RPC, ilgili oda/durum satırını kilitler. Komut tekrarını yeniden kontrol eder; beklenen sürüm aynıysa yeni durumu, oda/üyelikle ilgili değişiklikleri ve komut sonucunu tek transaction'da kaydeder. Çakışmada hiçbirini yazmaz.
5. Aynı transaction'daki tetikleyici gizli alan içermeyen `room_revision_changed` bildirimi üretir. Başarısız/geri alınmış transaction görünür yeni oyun durumu oluşturmaz.
6. Sürüm çatışmasında API yeni durumu okuyup aynı komutu yeniden doğrular; en fazla birkaç deneme yapar. Aynı oylama aşamasındaki başka kişinin oyu, tek başına kullanıcının oyunu geçersiz yapmaz.
7. API sonucu ve gönderenin yetkili görünümünü döndürür; diğer oyuncular sürüm sinyalinden sonra kendi görünümlerini alır.

`processed_commands` için oda/oyun + kullanıcı + komut kimliği üzerinde benzersizlik gerekir. Aynı kimlikle farklı içerik gelirse reddedilir. İşlem tamamlanıp HTTP yanıtı kaybolsa bile yeniden deneme ikinci hamle oluşturmaz. Deneme sınırı aşılırsa yeniden denenebilir bir hata dönülür; başarı uydurulmaz.

Bu CAS düzeni sunucunun DB'ye ayrı ayrı okuyup yazdığı iki korumasız işlem değildir. Kayıt, tekrar komut kontrolü ve bildirim tek atomik işlemdedir. Odaya katılma ve oyunu başlatma da doluluk/üyelik yarışı yaratmayacak transaction kullanır.

## 4. Realtime ve veri gizliliği

- Oda başına özel kanal: örneğin `room:<roomId>`. Abonelik hakkı doğrulanmış kullanıcının oda üyeliğinden gelir. Kanal adını bilmek erişim sağlamaz.
- İstemci yalnız bildirim alır; oyun kanalı için Broadcast gönderme yetkisi verilmez. Bildirimi sunucu/DB üretir.
- Bildirim sadece `{roomId, revision}` taşır. Tam durum, rol, kart, oy veya oturum anahtarı kanala gönderilmez.
- İstemci önce abone olur, sonra son görünümü alır; bu arada gelen daha yüksek revision varsa tekrar getirir. Üst üste bildirimler birleştirilir.
- Görünüm API'si her istekte üyelik ve kimliği yeniden doğrular; tek tutarlı durum sürümünden oyuncu görünümünü üretir. Yanıt `Cache-Control: private, no-store` kullanır; CDN/ISR'de tutulmaz.
- Bildirim kaybına karşı abonelik yenilenince, sekme tekrar etkinleşince ve aktif oyunda düşük sıklıklı yedek kontrolde görünüm yenilenir. Başlangıç yedek kontrol hedefi 10–15 saniye; bekleyen hamlede kısa sınırlı tekrar yapılabilir.
- Bildirimler kalıcı durumun yerine geçmez. Bağlantı geri geldiğinde eski animasyonlar çalıştırılmadan son görünüm çizilir.

Özel kanal yetkileri ile tablo okuma yetkileri ayrı kurulur. Üyeliği kaldırılan eski abonenin elde tutabileceği kanal oturumuna sır gönderilmediğinden güvenilmez; görünüm API'si güncel üyeliği her defasında denetler. [Realtime yetkilendirme](https://supabase.com/docs/guides/realtime/authorization), [Broadcast](https://supabase.com/docs/guides/realtime/broadcast).

## 5. Yeniden bağlanma ve süreler

- Aynı tarayıcıdaki Supabase oturumu korunur; yenileme yeni oyuncu oluşturmaz. Çıkış yapmak, tarayıcı verilerini silmek veya başka cihaza geçmek için otomatik koltuk kurtarma vaat edilmez.
- Access token süresi dolduğunda istemci SDK oturumu yeniler, kanalı tekrar yetkilendirir, görünümü tekrar alır. Oturum yenilenemiyorsa açık hata gösterilir.
- Aktif oyunda seyrek kimliği doğrulanmış heartbeat son görülme bilgisini kaydeder. Oyuncu bağlılığı istemcinin gönderdiği keyfi Presence içeriğinden türetilmez.
- Aynı kullanıcı için iki sekmede kontrol çakışmasını önlemek amacıyla etkin oturum nesli API'de denetlenir; önceki sekme oyun kumandası olarak geçersizleşir. C03 kesin protokolü ve testini yazar.
- Önerilen geri dönüş penceresi 10 dakika. Gerekli oyuncu süreye göre çevrimdışıysa işlem sırasında oyun duraklatılır; eksik oy rastgele tamamlanmaz.
- Süreler DB zamanıyla karşılaştırılır. Function içinde `setInterval` ile oda yaşatılmaz. Süre dolması erişim/hamle kontrolünde uygulanır; fiziksel kayıt temizliği ayrı bakım işidir.
- Oyun durumu deploy ve Function değişiminden bağımsız saklanır. Yeni sürümün eski oyun durumunu okuyabilmesi `stateVersion` ve geriye uyumlu migration ile korunur; DB kesintisinde oyun geçici olarak durabilir.

## 6. Vercel projesi ve ortam değişkenleri

Planlanan proje kökü `apps/web`, framework Vite. `api/` girişleri Node.js Vercel Functions olur; `packages/server` ve `packages/game-core` yalnız bu girişlerden kullanılır. C00 Vercel'in güncel paketleme düzeniyle bu monorepo girişini doğrular. Sahne tarayıcıda çalışır; bu hedef için Next.js'e geçmek zorunlu değildir. [Vercel Functions başlangıcı](https://vercel.com/docs/functions/quickstart), [Vite dağıtımı](https://vercel.com/docs/frameworks/frontend/vite).

| Örnek değişken adı | Erişim | Kullanım |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Tarayıcı | Proje URL'si |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Tarayıcı | Publishable API anahtarı; RLS/kimlik kontrolleriyle |
| `SUPABASE_URL` | Yalnız API | Sunucunun bağlandığı proje |
| `SUPABASE_SECRET_KEY` | Yalnız API | Sunucu DB işlemleri; tarayıcıya veya loga girmez |
| `APP_ORIGIN` | Yalnız API | Ortama ait web adresi / istek politikası |
| `ROOM_RECONNECT_SECONDS` | Yalnız API | Önerilen `600` |
| `SECRET_TABLE_ALLOW_DEV_AUTH` | Yalnız API | Normalde ayarlanmaz. Bkz. aşağı. |
| `SECRET_TABLE_DEV_TOOLS` | Yalnız API | D14 geliştirici senaryo atlaması (`dev_scenario`). Yerelde Vite API eklentisi belleğe `1` koyar. **Vercel'de normalde ayarlanmaz**; kullanıcı kararı 2026-09-12 ile GEÇİCİ test için `1` eklendi → test bitince `VITE_ST_DEV_TOOLS` ile birlikte SİL ve yeniden deploy et. |
| `VITE_ST_DEV_TOOLS` | Tarayıcı | Geçici: `1` iken bot modu, `/dev/*` sayfaları ve "Geliştirici" menüsü üretim paketine girer (`apps/web/src/devTools.ts`). Yokken bu kod derlemeye girmez. Test bitince SİL. |

Kesin adlar `.env.example` ve uygulamada birlikte sabitlenir. Secret anahtara `VITE_` öneki verilmez. Anahtar değerleri Markdown dosyasına yazılmaz. [Supabase anahtar türleri](https://supabase.com/docs/guides/getting-started/api-keys).

**Dev kimliği kapısı (C04, C06'da sertleştirildi):** API, `SUPABASE_URL`/
`SUPABASE_SECRET_KEY` tanımlı değilken `Authorization: Bearer dev:<id>` sahte kimliğini +
süreç-ömürlü `InMemoryGateway`'i kabul eden bir yerel geliştirme düşüşüne sahiptir.
Karar sırası (`devAuthAllowed`, `apps/web/api/_lib/context.ts`):

1. `VERCEL_ENV` `production` veya `preview` ise → **her zaman kapalı**;
   `SECRET_TABLE_ALLOW_DEV_AUTH=1` bu ortamlarda **yok sayılır**.
2. `SECRET_TABLE_ALLOW_DEV_AUTH=1` → açık (yalnız yerel + `vercel dev`
   `VERCEL_ENV=development` paritesi).
3. Bayrak yoksa ve `VERCEL` tanımlıysa → kapalı.
4. Yerel: `NODE_ENV !== 'production'` ise açık.

Yani Vercel preview/production'da Supabase eksikse istek `503 SUPABASE_NOT_CONFIGURED`
alır; sessizce kimliksiz/kalıcılıksız çalışma yoktur ve bayrakla açılamaz. Ayrıca boş
veya yer tutucu (`__FILL_ME__`, `YOUR-...`) env değeri "tanımsız" sayılır — yarı dolu
bir `.env` yanlışlıkla bozuk bir Supabase host'una bağlanmaz. Birim testi:
`apps/web/api/_lib/context.test.ts` (6 senaryo).

Claude şu ayarları doğrular: workspace paketlerinin build'e dahil olması; üretilen `dist` yolu; sahne varlıklarının doğru sunulması; oda URL'si yenilemesinde SPA dönüşü; `/api/*` ve varlık yollarının SPA catch-all altında ezilmemesi; gizli yanıtların cache edilmemesi. Preview ve production farklı Supabase projeleri veya açıkça ayrılmış veri ortamları kullanır; testler production tablolarını sıfırlamaz.

## 7. Geliştirmeden yayına sıra

1. **C00:** Workspace ve yerel Vercel API geliştirme yolu kurulur. Supabase yerel çalışma yapılandırması hazırlanır; yerel servis mümkün değilse ayrı geliştirme projesi kullanılır. Gerçekte çalışan komutlar README'ye yazılır.
2. **C01/C02:** Sahne sözleşmesi ve saf oyun motoru tamamlanır; bu testler Supabase hesabı olmadan çalışabilir.
3. **C03:** Migration, RLS/RPC izinleri, misafir oturumları, komut işlemleri ve Realtime geliştirme ortamında doğrulanır.
4. **C06:** Hedef Supabase projesinde migration uygulanır; anonim giriş ve özel Realtime ayarları açılır. Vercel'de kök/build/API ve ortam değişkenleri yapılandırılır.
5. **C06/J02:** Vercel preview'da sağlık/oda/katılım/geri dönüş testi yapılır. Sonra production deploy ve farklı ağdan 6/7 kişilik oyunlar doğrulanır.

Deploy hazırlığı sırasında alan adı şart değildir; Vercel proje URL'si yeterlidir. Vercel deployment'ı DB migration'ını kendiliğinden yapmış sayılmaz. Ortam/proje erişimleri sağlandığında aynı planla devam edilir; mevcut kullanıcı yetkisi varken yeniden onay akışı eklenmez.

### C06 — hedef Supabase'e migration uygulama (somut adımlar)

Ön koşul: depo kökünde `.env` (gitignore'da) doldurulmuş — `SUPABASE_PROJECT_REF`,
`SUPABASE_ACCESS_TOKEN` (`sbp_...`), `SUPABASE_DB_PASSWORD`, ayrıca uygulama için
`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_URL` /
`SUPABASE_SECRET_KEY`.

**Yol A — `supabase db push` (DB parolası varsa):**

```bash
set -a && source .env && set +a          # CLI değişkenlerini ortama al
pnpm supabase link --project-ref "$SUPABASE_PROJECT_REF"
pnpm supabase db push                     # 0001..0005 uygulanır
```

**Yol B — Management API (DB parolası YOKKEN; C06'da bu kullanıldı):**
`POST https://api.supabase.com/v1/projects/{ref}/database/query` ucu access token
(`sbp_...`) ile `postgres` rolünde SQL çalıştırır — parola gerektirmez. Her migration
dosyasının içeriği sırayla bu uca `{"query": "..."}` gövdesiyle POST edilir; ardından
`supabase_migrations.schema_migrations` tablosuna `version` satırları eklenir (ileride
`db push` uyumu). Auth ayarları da aynı token'la `PATCH /v1/projects/{ref}/config/auth`
ile yapılır (`{"external_anonymous_users_enabled": true}`).

Migration'lar (`supabase/migrations/`):
- `0001_schema.sql` — tablolar + RLS + istemci GRANT geri alma.
- `0002_functions.sql` — RPC'ler + `commit_move` atomik CAS; EXECUTE yalnız `service_role`.
- `0003_realtime.sql` — sürüm sinyali tetikleyicisi + ilk kanal RLS denemesi.
- `0004_explicit_grants.sql` — **otomatik izinlere güvenmez**: `service_role`'e açık
  GRANT (5 tablo + şema + default privileges); gizli tablolar `anon`/`authenticated`'a
  tamamen kapalı; `rooms`/`room_members` doğrudan tablo erişimi de kaldırılır. Özel
  Realtime kanalı yetkisi `public.is_room_member()` SECURITY DEFINER + `realtime.messages`
  RLS ile (istemci rollerine tablo erişimi gerekmez). `notify pgrst, 'reload schema'`.
- `0005_trigger_fn_grants.sql` — `game_states_notify` tetikleyici fn EXECUTE'unu
  `public`/`anon`/`authenticated`'tan geri alır (yalnız `service_role`).

`db push` çıktısında `room_channel_read politikasi atlandi` notice'i görülürse
`supabase/realtime_policy.sql` içeriğini Dashboard → SQL Editor'de çalıştır. (C06'da
Management API yolu politikayı sorunsuz oluşturdu; `pg_policies` ile doğrulandı.)

**Dashboard'da elle (migration ile yapılamaz):**
- Authentication → Providers/Sign In → **Anonymous sign-ins = ON**.
- API Keys → "Publishable" ve "Secret" anahtarlarını `.env`'e kopyala (Secret ASLA `VITE_`).
- Data API: "Automatically expose new tables" KAPALI kalabilir — istemci PostgREST
  kullanmaz; sunucu secret key ile erişir ve `0004` grant'ları bunu açıkça sağlar.
- Realtime: Free planda etkin gelir; ek ayar gerekmez.

**Doğrulama — C06'da yapıldı (bkz. `docs/qa/claude/C06.md`):** secret key ile `rooms`
okunur; `anon`/publishable key ile gizli tablolar (REST 401) + tüm RPC'ler (`42501`)
erişilemez; anonim giriş → özel `room:<id>` kanalına abonelik yalnız üye iken
(`SUBSCRIBED`), üye olmayan `CHANNEL_ERROR Unauthorized`; sinyal `{roomId,revision}`
teslim edildi; 7 bağımsız gerçek anon oturumuyla katıl/hazır/başlat/**7 eşzamanlı oy
(CAS kaybı yok)**; sayfa yenileme (koltuk/rol/aşama/oy korundu), `offline`/`online`
şeridi + toparlanma, `refreshSession()` token yenilemesi. Uzak DB üzerinden `game_over`'a
kadar oynama ve gerçek 1 saatlik token expiry J01'e bırakıldı.

## 8. C03/C06 ek kabul ölçütleri

- Eşzamanlı oylar ve çift komutlar DB'de tek, tutarlı sonucu üretiyor.
- İstemci anahtarıyla gizli tablolar veya commit RPC'si çağrılamıyor; başka odanın kanalına/görünümüne erişilemiyor.
- DB commit sonrası HTTP yanıtı/bildirim kaybolması, tekrar denemeyle güvenli toparlanıyor.
- Farklı Function örneklerinden hamleler aynı oda üzerinde devam edebiliyor.
- Token yenileme, sekme yenileme, Realtime yeniden abonelik ve süre dolması test edildi.
- Supabase migration ve Vercel deploy talimatları temiz kurulumdan uygulanabiliyor.
- Gerçek kota ve maliyetler seçilen hesaplarda kontrol edilip kaydedildi; “ücretsiz ve sınırsız” varsayımı yapılmadı.

## 9. Workspace paketlerinin Function çıktısı (DEPLOY-FIX-001)

Vercel kökü `apps/web`, build komutu `pnpm run build` olarak kalır. Web build önce
`node ../../scripts/build-runtime.mjs` çalıştırır; contracts/game-core/server için
`dist/*.js` üretir. Bu paketlerin Node exports girişleri derlenmiş JavaScript'i,
tarayıcı/geliştirme girişleri kaynakları kullanır. `dist` dosyalarını commit etmeyin;
manifestler, kilit dosyası ve build scriptleri aynı dağıtımda bulunmalıdır.

Yayın öncesi `pnpm test:runtime` kaynak klasörleri olmadan sağlık ve oda oluşturma/katılma
yollarını sınar. Yeni dağıtım sonrasında `/api/health` 200 ve tarayıcıdan gerçek oda
açma ayrıca kontrol edilir. `ERR_MODULE_NOT_FOUND ... contracts/src/*.ts` eski paketleme
hatasıdır; düzeltmenin bulunduğu commit dağıtılmalıdır. Ayrıntı: `docs/qa/codex/DEPLOY-FIX-001.md`.

Vercel API derleyicisi `extends` çözülmeden varsayılanlar ekleyebildiği için
`apps/web/tsconfig.json` içindeki açık `module`, `moduleResolution`, `strict`
alanlarını kaldırmayın. `pnpm test:api-config` bu sınırı ve API tiplerini doğrular.

## 10. Dil (D23)

Arayüz iki dillidir: Türkçe (kaynak) ve İngilizce. Dil **oyuncuya** aittir, odaya
değil — sunucuya gitmez, DB'de tutulmaz, sözleşmede alanı yoktur ve ortam değişkeni
gerektirmez. Seçim yalnız tarayıcıda `localStorage` (`secret-table:prefs.language`)
içinde durur; kayıt yoksa varsayılan İNGİLİZCEDİR (D28; tarayıcı diline bakılmaz). Aynı odadaki iki oyuncu
farklı dilde oynayabilir.

Dağıtım açısından sonucu: **yeni bir Vercel/Supabase ayarı yoktur**, migration
gerekmez ve `CONTRACT_VERSION` 0.2.0 sabittir. Sözlükler (`apps/web/src/i18n/`)
uygulama paketine gömülür; ayrı dil dosyası indirilmez, bu yüzden dil değişimi ağ
isteği yapmaz ve sayfa yenilemez.
