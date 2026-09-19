# Karar kaydı

İlk plan: 2026-09-09, Codex. Aynı gün kullanıcı konum ve yayın tercihlerini düzeltti; P01 bu kararlara göre hazırlandı. Sonraki bütünleşik karar kayıtlarını Claude yönetir; Codex kendi durum dosyasından önerir. `Karar` mimari başlangıcı, `öneri` ise henüz karşı ajanla sabitlenmemiş ayrıntıyı belirtir.

| ID | Durum | Karar ve nedeni |
| --- | --- | --- |
| D001 | Kullanıcı kararı | Codex 3D nesneleri ve sahneyi tasarlar; Claude bağlantılar ve kalan uygulama işlerini yapar. İki CLI aynı proje klasörünü kullanır. |
| D002 | Kullanıcı kararı | İş sırasında Markdown dosyaları güncel tutulur; oturumlar arasındaki ortak hafıza dosyalarla sağlanır. |
| D003 | Değiştirildi → D016 | İlk konum mevcut backend altında seçilmişti; kullanıcı bunu düzeltti. |
| D004 | Başlangıç kararı | 5–10 oyuncu, ilk gerçek testler 6 ve 7 kişi. Oyuna başladıktan sonra oyuncu eklenmez. |
| D005 | Kısmen değiştirildi → D017 | TypeScript ve React/Vite/Three/R3F/Drei korunur; Node/Colyseus sürekli sunucu tercihi kaldırıldı. |
| D006 | Başlangıç kararı | Saf oyun motoru sunucudadır; web yalnızca yetkili görünüm ve hamle istekleriyle çalışır. |
| D007 | Güncellendi → D018 | Alıcı bazında tam görünüm korunur; HTTP'den alınır. Realtime yalnız sürüm değişikliği sinyali taşır. |
| D008 | Başlangıç kararı | 3D sahne ağdan bağımsız paket olur; geliştirmede sentetik görünüm verileriyle çalışır. |
| D009 | Değiştirildi → D019 | Bellekte oda ve özel geri dönüş kimliği yerine Supabase kalıcı durum ve anonim Auth oturumu kullanılacak. |
| D010 | Kısmen değiştirildi → D017 | Discord korunur; yayın sağlayıcısı Vercel olarak seçildi, ayrı sürekli oyun sunucusu kaldırıldı. |
| D011 | Tasarım önerisi | Ceviz, koyu yeşil keçe, krem kart ve pirinç detay. Kodla 3D geometri; gerekirse özgün dış model. |
| D012 | Başlangıç kararı | Masaüstü öncelikli; düşük kalite, temel küçük ekran kullanımı ve hareket azaltma ilk sürüme dahil. |
| D013 | Başlangıç kararı | Her ajan kendi durum dosyasını yazar; ortak manifestler ve sözleşme tipleri Claude'un tek yazarlığındadır. |
| D014 | Öneri | 10 dakikalık yeniden bağlanma penceresi; zorunlu katılımcı çevrimdışıyken duraklatma. C03 davranışı doğrulayıp kayıt altına alır. |
| D015 | Sabitlendi → D021 | Sahne veri sözleşmesi. `0.2.0-proposed` → C01 tipleri + CODEX-004 kabulüyle `0.2.0` olarak sabitlendi. |
| D016 | Kullanıcı kararı | Proje konumu `<proje-klasörü>`. Mevcut backend altında bırakılmayacak. |
| D017 | Kullanıcı tercihi + uygulama kararı | Web ve HTTP API Vercel'e dağıtılır. Veritabanı Supabase'tir; bağımsız Colyseus sunucusu yoktur. |
| D018 | Mimari karar | Vercel Functions hamleleri işler; Supabase DB atomik kayıt yapar; Realtime özel kanalda sürüm bildirir; HTTP API yetkili görünümü verir. |
| D019 | Mimari karar | Supabase Postgres ve Anonymous Auth ilk sürüme dahil. Kullanıcıya hesap açma ekranı gösterilmez. Deploy/Function değişimi DB'deki oyunu silmez. |

## 2026-09-09 — D020, kullanıcı kararı

Görsel ortam/harita, karakter/avatar, kart, masa ve taraf tasarımları varsayılan olarak Codex’e; arka plan işlemleri Claude’a aittir. Kullanıcı istediğinde herhangi bir işi Codex, Claude veya başka bir ajana yönlendirebilir. Bu iş bölümü yetki engeli değildir; yeni görev kapsamı ve dosya devri ortak Markdown düzenine işlenir.

## 2026-09-09 — D021, mimari karar (C02)

Saf oyun motoru (`@secret-table/game-core`) resmî Secret Hitler kurallarını 5–10 oyuncu için uygular. Belirlenimci: `createGame({players, seed})` + `applyCommand(state, command)` girdi durumunu değiştirmez (`structuredClone`), aynı tohum + komut dizisi → aynı sonuç. Deste yeniden karıştırma tohumdan türetilir (`deckSeed`, `reshuffles`), serileştirilebilir. Kurulum metaverisi (`BOARD_LAYOUTS`, `ROLE_SETUPS`) `@secret-table/contracts/rules` içinde tek kaynaktır. Etkilenen: C02, C03, C05, X03 (sahne yuva ikonları bu sabitten okur).

## 2026-09-09 — D022, mimari karar (C03)

Sunucu mantığı (`@secret-table/server`) `GameGateway` arayüzü arkasında çalışır: `InMemoryGateway` (test + Supabase erişimsiz yerel geliştirme), `SupabaseGateway` (Postgres/RPC). Atomik hamle `commitMove` RPC'sinde tek işlemde: tekrar-komut kontrolü + sürüm CAS + durum yazımı + `notify_room_revision` sinyali. Sürüm çatışmasında API sınırlı yeniden dener (varsayılan 12, tur bazlı oyunda tüm masanın aynı anda oy vermesini karşılar). Oyuncuya göre `SceneView` projeksiyonu gizli alanları (rol, el, oy, inceleme, oyun sonu rolleri) süzer. HTTP girişi tek eylem-tabanlı uç `POST /api/game`; kimlik `Authorization: Bearer` ile doğrulanır, istekteki `userId/playerId` yetki kaynağı değildir. Etkilenen: C03, C04, C05, C06.

## 2026-09-09 — D023, mimari/uygulama kararı (C06)

Uzak Supabase kurulumu, DB parolası verilmediği için `supabase link` + `db push` yerine
**Supabase Management API `POST /v1/projects/{ref}/database/query`** (personal access
token, `postgres` rolü) ile yapıldı; migration sürümleri `supabase_migrations.schema_migrations`
tablosuna elle işlendi (ileride `db push` uyumu). Anonymous sign-ins `PATCH /config/auth`
ile açıldı. `0004_explicit_grants.sql` + `0005_trigger_fn_grants.sql`: otomatik izinlere
güvenilmez — `service_role`'e açık GRANT verilir, gizli tablolar ve tüm RPC'ler
`anon`/`authenticated`'a tamamen kapatılır; `rooms`/`room_members` dahil istemci rolleri
doğrudan tablo erişimi almaz. Özel oda Realtime kanalı yetkisi `public.is_room_member()`
(SECURITY DEFINER) + `realtime.messages` RLS politikası ile sağlanır; istemci Broadcast
gönderemez. İstemci `connection` (`connected`/`reconnecting`/`disconnected`) HTTP ağ hatası
sayacı + Realtime kanal durumu + `online`/`offline`'dan türetilip `SceneView.connection`'a
işlenir. Cue kuyruğu son gruptan ~950 ms sonra (nesil korumalı) temizlenir; `resync`/oyun
değişiminde hemen boşaltılır (CODEX-009). Etkilenen: C06, J01, sonraki Vercel deploy.

## Değişiklik kaydı biçimi

Yeni karar için: tarih, kimlik, durum, somut karar, kısa gerekçe, etkilenen görevler ve gerekiyorsa önceki karar kimliği. Geçersiz karar silinmez, yerine gelen karar belirtilir. Uzun tartışma veya konuşma dökümü eklenmez.

## Sonradan netleşecekler

- Kullanıcının ilk 3D masa görüntüsüne ilişkin yönlendirmesi ve son proje adı.
- ~~C03'te SQL migration/RLS/RPC'nin canlı Supabase'e uygulanıp doğrulanması~~ — **C06'da
  yapıldı** (uzak proje `<PROJECT_REF>`; Management API; `docs/qa/claude/C06.md`).
- Supabase misafir oturumunun **gerçek 1 saatlik** token süresi dolmasıyla testi (C06'da
  `refreshSession()` ile mekanizma doğrulandı; doğal expiry J01).
- X04'te gerçek donanım performans ölçümleri.
- Vercel deploy: proje kökü/build/env değişkenleri, preview↔production veri ayrımı,
  Auth anon-signup rate-limit ayarı, güncel kota/maliyetler (C06 sonrası, kullanıcı ile).
