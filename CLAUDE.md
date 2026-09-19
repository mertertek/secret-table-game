> **Note for readers:** this file is a working instruction sheet for AI coding agents
> (Claude Code) and is written in Turkish. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for
> the English contributor guide.

# Claude Code çalışma yönergeleri

- Bu klasör `Development/bireysel/secret-table` içindeki bağımsız oyun projesidir. Komşu projeleri değiştirme.
- Kullanıcı tercihi: web ve HTTP API Vercel; veri Supabase Postgres; kimlik Supabase Auth; anlık bildirim Supabase Realtime. `docs/DEPLOYMENT.md` ve CODEX-002'yi oku.
- Colyseus/sürekli sunucu ve bellekte kalıcı oda planı yürürlükten kaldırıldı. Oyun hamlelerini işlemsel ve tekrar uygulanmayacak biçimde kaydet.
- İş bölümü (2026-09-11): altyapı, kurallar, ekranlar, 3D tasarım/model ve entegrasyon dahil her iş Claude'da. Codex/GPT tarafı kapatıldı; Codex maddeleri tarihçedir.
- Önce `docs/COORDINATION.md`, `docs/agents/CLAUDE.md`, `docs/agents/CODEX.md` oku.
- Sonra sadece mevcut görevin gerektirdiği `docs/PLAN.md`, `docs/CONTRACT.md` ve `docs/QA.md` bölümlerini oku.
- Kod yazmadan önce kendi durum dosyana görev kimliği, zaman ve değiştireceğin yolları yaz.
- Her tamamlanan alt görevde; sözleşme değişikliği, engel veya test sonucu oluşunca; oturumu bitirmeden önce kendi durum dosyanı güncelle.
- Güncel öncelik sırası `docs/ROADMAP.md`; kod yazmadan önce oradaki durumu ve kod yasağını kontrol et.
- Ortak sözleşme tiplerinin ve proje yapılandırmasının tek yazarı sensin.
- Roller, deste sırası ve gizli eller yalnız sunucuya açık DB durumunda kalır; Realtime kanalına yalnız sürüm değişikliği sinyali gider. Yetkili görünüm HTTP API'den alınır.
- Oyun kurallarını sunucuda uygula; istemci yalnızca hamle isteği gönderir.
- Kendi durum dosyanı kısa tut; ham log veya uzun muhakeme kaydetme.
- Gerçekten geçen testleri ve çalıştırma komutlarını kaydet; mevcut olmayan komutları çalışır gibi gösterme.
- Sahipliği dışındaki dosyaları topluca biçimlendirme, sıfırlama veya Git'e ekleme.
- Kullanıcı görev vermeden yalnızca plan dosyalarına bakarak tüm uygulamayı kendiliğinden başlatma.
- İş bölümü varsayılandır: kullanıcı seni görsel, backend veya başka bir göreve yönlendirebilir. Bu atamayı kabul et; ilgili dosyaların görev kapsamındaki sahipliğini ve devri MD dosyalarında güncelle. Eski rolünü gerekçe göstererek işi reddetme veya yeniden izin isteme.
- Yeni ajan gelirse ona ayrı kısa durum dosyası açılır. Kullanıcı ataması olmadan başka ajanın aktif dosyasına müdahale etme.
- Kullanıcı talimatları bu proje yönergelerinden önce gelir.
