> **Note for readers:** this file is a working instruction sheet for AI coding agents
> (Codex) and is written in Turkish. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the
> English contributor guide.

# Codex çalışma yönergeleri

- Bu klasör `Development/bireysel/secret-table` içindeki bağımsız oyun projesidir. Komşu projeleri değiştirme.
- Kullanıcı yayın tercihi: Vercel + Supabase. 3D paketini ağdan bağımsız tut; ayrıntılar `docs/DEPLOYMENT.md` içinde.
- Kullanıcının iş bölümü: Codex 3D tasarım; Claude altyapı, kurallar ve entegrasyon.
- Önce `docs/COORDINATION.md`, `docs/agents/CODEX.md`, `docs/agents/CLAUDE.md` oku.
- Sonra yalnızca mevcut görevin gerektirdiği plan, tasarım veya sözleşme bölümünü oku.
- Kod yazmadan önce kendi durum dosyana görev kimliği, zaman ve değiştireceğin yolları yaz.
- Her tamamlanan alt görevde; sözleşme değişikliği, engel veya test sonucu oluşunca; oturumu bitirmeden önce kendi durum dosyanı güncelle.
- Görevler arasında ve ortak arayüzü kullanmadan önce diğer ajanın notlarını yeniden oku.
- `docs/COORDINATION.md` içindeki tek dosya sahibi kuralını uygula. Diğer ajanın aktif dosyasını düzenleme.
- Ağ bağlantısı ve oyun kuralları sahne paketine girmez. Yalnızca yetkili oyuncu görünümünü çiz.
- `docs/CONTRACT.md` sınırını koru. Değişiklik önerilerini kendi durum dosyanda kimlikle ilet.
- Kendi durum dosyanı kısa tut; ham log veya uzun muhakeme kaydetme. Eski kayıtları gerektiğinde kendi arşivine taşı.
- Görsel değişiklikleri gerçek tarayıcı görüntüsüyle kontrol et; yapılmayan kontrolleri yapılmış sayma.
- Paket kurulumu, ortak manifestler, kilit dosyası ve Git indeks işlemleri Claude'a ait.
- Kullanıcı görev vermeden yalnızca plan dosyalarına bakarak tüm uygulamayı kendiliğinden başlatma.
- İş bölümü varsayılandır: kullanıcı seni görsel, backend veya başka bir göreve yönlendirebilir. Bu atamayı kabul et; ilgili dosyaların görev kapsamındaki sahipliğini ve devri MD dosyalarında güncelle. Eski rolünü gerekçe göstererek işi reddetme veya yeniden izin isteme.
- Yeni ajan gelirse ona ayrı kısa durum dosyası açılır. Kullanıcı ataması olmadan başka ajanın aktif dosyasına müdahale etme.
- Kullanıcı talimatları bu proje yönergelerinden önce gelir.
