# DEPLOY-FIX-001 — Vercel Function başlangıç hatası

Tarih: 9 Eylül 2026.

## Doğrulanan hata

Canlı /api/health ve /api/game HTTP 500 FUNCTION_INVOCATION_FAILED döndü.
Kullanıcı Runtime Logs kaydı: contracts/src/index.ts veya schemas.ts dosyası
bulunamıyor (ERR_MODULE_NOT_FOUND). Paket exports alanı TypeScript kaynağına
bağlanıyordu; normal web derlemesi Node için workspace çıktısı üretmiyordu.

## Düzeltme

- contracts (index/schemas), game-core ve server Node girişleri derlenmiş dist/*.js
  dosyalarına yönlendirildi. types/browser/development kaynak girişleri korundu.
- scripts/build-runtime.mjs esbuild ile göreli TypeScript modüllerini ESM çıktısına
  toplar; paket bağımlılıklarını Node çözümlemesine bırakır. Web build bu adımı önce çalıştırır.
- API context importu .js uzantısı içerir; TypeScript kaynak çözümlemesi çalışmaya devam eder.
- esbuild mevcut 0.28.2 sürümüyle doğrudan build bağımlılığı oldu; kilit dosyası güncellendi.
- Üretilen dist dosyaları Git dışında, dağıtım sırasında yeniden üretilir.

## Geçen kontroller

- pnpm 10.18.3 frozen-lockfile/offline kurulum.
- 6 workspace paketinde typecheck.
- 269 test: contracts 11, fixtures 28, game-core 65, scene 79, server 33, web 53.
- Üretim web/runtime build başarılı; mevcut büyük JS chunk uyarısı sürüyor.
- pnpm test:runtime: geçici pakete yalnız package.json ve dist kopyalandı; workspace
  src klasörleri yok. Sağlık 200/no-store, desteklenmeyen yöntem 405, kimliksiz çağrı 401,
  üretimde eksik Supabase 503 SUPABASE_NOT_CONFIGURED. Yerel bellek yolunda gerçek
  derlenmiş handler ile oda oluşturma ve başka oyuncuyla katılma başarılı.
- Test alt sürecine .env veya gizli değerler aktarılmadı; uzak DB'ye yazılmadı.

## Sınır / dağıtım devri

Bu test Vercel'in gerçek Function artifactini üretmez; kaynak dosyasız Node çalışma
sınırını doğrular. Yeni commit'in Vercel'de derlenmesi ardından /api/health 200 ve
gerçek Supabase oda açma/katılma ayrıca doğrulanmalı. Kullanıcı Git push/deploy yönetiyor;
bu ajan commit/push/deploy yapmadı. Kodun 9cab1b3 commitine alındığı gözlendi.
Build komutu apps/web kökünde pnpm run build olarak kalır. Eski commit'i yeniden
çalıştırmak düzeltmeyi içermez. Migration veya Supabase ayarı bu görevde değiştirilmedi.

## DEPLOY-FIX-002 — sonraki dağıtımın TypeScript tanıları

Canlı health 2026-09-09 17:20 UTC HTTP200: ilk runtime hatası çözülmüş.
Vercel build tamamlanmasına rağmen API TS2835/TS2339 tanıları verdi. Resmi
packages/node/src/typescript.ts içindeki readConfig → fixConfig, extends
çözülmeden önce leaf compilerOptions.module yoksa NodeNext ve strict:false
ekliyor. apps/web/tsconfig.json artık module ESNext, moduleResolution bundler
ve strict true değerlerini açıkça içeriyor; üst yapılandırmadaki değerlerle aynı.
API type importları .js uzantılı ve resolved.ok kontrolü açık false karşılaştırması.
Supabase getUser tipi herhangi bir cast/any ile örtülmedi.

Geçti: web typecheck, 53 web testi, kaynak dosyasız runtime testi ve yeni
pnpm test:api-config (leaf ayarlar ve API'nin tüm tip tanıları kontrolü).
Yeni test scripts/test-api-config.mjs; package.json'a test:api-config eklendi.
İkinci düzeltmenin temiz Vercel log doğrulaması yeni push/deploy sonrasında yapılmalı.

Canlı tarayıcı kontrolü: QA-Yayın adıyla Yeni oda aç tıklandı. Sonuç:
“Sunucu yapılandırması eksik. Oda sahibine / yöneticiye bildir.”
Oda açma kabulü geçmedi; Vercel Production SUPABASE_URL/SUPABASE_SECRET_KEY
yapılandırması kullanıcı tarafından tamamlanmalı. Anahtarlar okunmadı veya kaydedilmedi.

## DEPLOY-FIX-003 — kalan SupabaseAuthClient.getUser tanısı

Yeni Vercel logunda tek kalan TS2339 yerelde tekrar üretilemedi. API context'teki
SDK getUser çağrısı Supabase'in resmi GET /auth/v1/user ucuyla değiştirildi.
Kimlik sadece Auth yanıtındaki id'den alınır; istek gövdesindeki id kullanılmaz.
Bearer kullanıcı token'ı, apikey sunucu anahtarı; no-store, redirect:error, 10s timeout.
401/403 → SESSION_INVALID; diğer HTTP/ağ/geçersiz JSON veya kimlik → 503.
any, ts-ignore veya tip kontrolünü kapatma uygulanmadı. Yeni bağımlılık yok.
Kaynak: https://supabase.com/docs/guides/auth/jwts

Geçti: 63 web testi (16 context), API config/type kontrolü, kaynak dosyasız runtime,
web üretim derlemesi (tip kontrolü dahil). Testlerde sahte Auth yanıtları kullanıldı;
canlı Auth kabulü ve yeni Vercel build logu henüz doğrulanmadı.
