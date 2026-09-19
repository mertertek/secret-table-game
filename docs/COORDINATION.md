# Ortak çalışma protokolü

> **2026-09-10 kullanıcı kararı:** Proje ana sorumluluğu ve koordinasyon **Claude**'da.
> Aşağıdaki sahiplik tablosu artık zorunlu sınır değildir; Claude gerektiğinde
> `packages/scene/**` dahil her dosyayı düzenleyebilir. **2026-09-11:** Codex/GPT tarafı
> tamamen kapatıldı; görsel tasarım ve model üretimi dahil her iş Claude'da. Aşağıdaki
> tablo ve mesaj protokolü tarihçedir; `docs/agents/CODEX.md` ve `docs/qa/codex/**`
> arşiv olarak kalır. Güncel sıra: `docs/ROADMAP.md`.

Durum: önerilen çalışma düzeni, 2026-09-09. Kullanıcı iki CLI oturumunu aynı proje klasöründe çalıştıracak. Bu dosya görev sınırlarında diskten tekrar okunur.

## 1. Tek dosya, tek yazar

| Yol / alan | Normal yazarı |
| --- | --- |
| `packages/scene/src/**`, `packages/scene/public/**` | Codex; C00 giriş taslağı devredildikten sonra |
| `docs/DESIGN.md`, `docs/ASSETS.md`, `docs/agents/CODEX.md` | Codex |
| `docs/archive/codex/**`, `docs/qa/codex/**` | Codex |
| `apps/web/**` (HTTP API dahil), `packages/server/**`, `packages/game-core/**`, `supabase/**` | Claude |
| `packages/contracts/**`, `packages/fixtures/**`, `tests/**` | Claude |
| Manifestler, bağımlılık kilidi, derleme ayarları, CI ve dağıtım dosyaları | Claude |
| `README.md`, `docs/PLAN.md`, `docs/CONTRACT.md`, `docs/QA.md`, `docs/DECISIONS.md`, `docs/DEPLOYMENT.md` | İlk plan devrinden sonra Claude |
| `docs/agents/CLAUDE.md`, `docs/archive/claude/**`, `docs/qa/claude/**` | Claude |
| `AGENTS.md`, `CLAUDE.md`, bu dosya | İlk kurulumdan sonra Claude; diğer ajan değişiklik önerir |

Yukarıdaki sahiplik varsayılandır. Kullanıcı Codex’i backend’e, Claude’u görsel işe veya başka bir ajanı herhangi bir göreve atayabilir. Kullanıcının yeni görevlendirmesi ilgili iş kapsamında tablodaki normal sahibin önüne geçer; yeniden izin veya rutin karşı-ajan onayı gerekmez.

Atanan ajan işe başlamadan kendi durum dosyasına görev, dosya kapsamı ve kullanıcı görevlendirmesini yazar; devir mesajıyla önceki sorumluyu haberdar eder. Aynı dosyada aktif çalışma varsa önce düzenlemeler devredilir veya işler çakışmayan yollara ayrılır. Görev sonunda geçici sahipliğin bittiği ya da kalıcı değiştiği yazılır. Mimari sınırlar korunur: örneğin Codex backend görevi aldığında kodu sahne paketine değil backend alanına yazar.

Kullanıcıdan yeni atama yokken diğer ajanın alanında ihtiyaç görürsen kendi durum dosyanda devir isteği bırak ve bağımsız görevini sürdür. Rutin işler için kullanıcıdan tekrar izin isteme. Yeni ajan yalnızca gerektiğinde eklenir; olası gelecek görevlendirme bugün ajan başlatma talimatı değildir.

## 2. Kısa ortak hafıza

Her ajan yalnızca kendi `docs/agents/*.md` dosyasını günceller. Başlangıçta CODEX ve CLAUDE dosyaları vardır. Kullanıcının eklediği başka ajan için benzersiz isimli bir durum dosyası oluşturulur; ilgili görevdeki ajanlar birbirlerinin notlarını okur. Bu dosyalar birlikte güncel durumu oluşturur; ortak bir `STATUS.md` dosyasına eşzamanlı yazılmaz.

Her durum dosyasında şu alanlar bulunur:

- Güncelleme zamanı: ISO 8601 ve saat dilimi.
- Oturum ve durum: `not_started`, `ready`, `working`, `waiting_for_peer`, `blocked`, `done`.
- Aktif görev ve alt adım.
- Aktif düzenleme yolları; iş bırakıldığında `yok`.
- Kullanılan sözleşme sürümü ve kabul durumu.
- Tamamlananlar ve doğrulama kanıtları.
- En fazla üç sonraki adım.
- Karşı ajana açık mesajlar; benzersiz kimlik ve istenen yanıt.
- Okunan son karşı mesaj kimliği ve verilen yanıtlar.

Görev durumları kendi ajan dosyasında tutulur. PLAN görev tablosu bağımlılık ve kabul ölçütleri içindir; her küçük ilerlemede ikinci bir durum tablosu güncellenmez.

## 3. Okuma ve yazma döngüsü

1. Oturum başında iki durum dosyasını ve bu protokolü oku.
2. İlgili görev tanımını ve güncel sözleşmeyi oku; tüm depoyu tarama.
3. Aktif işi ve yolları kendi dosyana kaydet; sonra kod yaz.
4. Her anlamlı alt görev veya test turu sonunda 3–8 satırlık ilerleme kaydet.
5. Yeni alt göreve geçerken karşı tarafın durumunu yeniden oku. Uzun işlerde uygun bir araç/iş sınırında yaklaşık 10 dakika içinde ara kayıt bırak.
6. Arayüz değişikliği, engel ve iş devrini bekletmeden yaz. Devam edebilen işleri sürdür.
7. Teslimde gerçek kontrol sonuçlarını ve sonraki somut adımı yaz; aktif yolları bırak.

Bu, her araç çağrısını günlüğe yazma veya her dakika boş yere dosya okuma talimatı değildir. Amaç karar ve teslim bilgisini kaybetmemektir.

## 4. Ajanlar arası mesajlaşma

Mesajı kendi durum dosyanın **Karşı ajana** bölümüne yaz:

```text
ID: CODEX-004
Tür: proposal | handoff | question | issue
İlgili görev: X02 / C05
İstek: SceneView'e kart seçim vurgusu için seçili kart kimliği eklenmesi.
Gerekçe: Onay verilmeden seçilen kartı göstermek.
Etkilenen yollar: packages/contracts/src/scene.ts
Beklenen yanıt: Kabul, mevcut alanla çözüm veya alternatif.
```

Alıcı kendi dosyasında `ACK CODEX-004: ...` yazar. Gönderen sonraki okumada mesajını çözüldü olarak işaretler. Başkasının mesajını düzenleme. Mesaj kimliklerini yeniden kullanma.

Dosyalar canlı bildirim sağlamaz. Bekleyen ajan bağımsız görev bulamıyorsa durumu açıkça yazar ve oturumu kullanıcıya bırakır; sonsuz bekleme veya yoğun sorgulama yapmaz. Acil bir devirde kullanıcı ilgili CLI oturumuna “karşı ajanın durum dosyasını tekrar oku” diyebilir.

## 5. Sözleşme değişikliği

- Sürüm `0.2.0` (2026-09-09 sabitlendi). Claude C01'de tipleri yazdı; Codex CODEX-004 ile fark olmadan kabul etti; ağ protokolü sürümü ayrıca `1`.
- Bundan sonra alan eklemek/çıkarmak kırıcı değişiklik kurallarına tabidir (aşağı).
- Sabit sürümde kullanılan alanı sessizce silme, yeniden adlandırma veya anlamını değiştirme.
- Claude tip dosyasının tek yazarıdır. Codex öneriyi kendi durum dosyasına bırakır.
- Kırıcı değişiklikte iki ajan kendi notunda aynı öneri kimliğine kabul yazar; Claude sözleşmeyi ve geçiş planını günceller.
- Diğer ajan yanıtlamıyorsa uyumlu mevcut sözleşmeyle devam et. Gerekiyorsa ek bir sürümü yanına koy; çalışan sözleşmeyi kaldırma.
- TypeScript dosyaları üretildikten sonra kesin alan adlarında kaynak onlardır; Markdown davranış, gizlilik ve değişiklik gerekçesini açıklar. İkisini tutarlı güncelle.

## 6. Ortak klasörde çakışmayı önleme

- Aynı checkout'ta dosyalar görünür; Git dalı değiştirmek iki ajanı da etkiler. Aktif ortak çalışmada dal değiştirme, reset, stash veya rebase yapma.
- Git deposu henüz kurulmadı. C00'da Claude bu alt klasörü bağımsız depo olarak hazırlayabilir; üst klasörü depoya dönüştürmez.
- Claude Git indeksini yönetir. Dosyaları açık yollarla ekler; tamamlanmamış Codex dosyalarını topluca commitlemez.
- Bağımlılık ekleme ve kilit dosyası yazma Claude'a ait. Codex gerekli paketi gerekçesiyle not eder.
- Her ajan dar kapsamlı biçimlendirme yapar. Ortak çalışma sırasında tüm depoyu biçimlendirme.
- Üretim çıktısını kaynak gibi düzenleme. Görseller ve test çıktıları sahibinin `docs/qa/` altına gider.
- Aktif yol listeleri danışma kaydıdır, işletim sistemi kilidi değildir. Çakışma görülürse dosyanın normal sahibi düzenler; diğer ajan öneri bırakır.
- Ayrı worktree'lere geçilirse MD dosyaları otomatik paylaşılmaz. Bu planın ortak-klasör varsayımını koru veya ayrıca eşitleme düzeni belirle.

## 7. Token tasarrufu ve teslim

Durum dosyası hedefi en fazla 80 satırdır. Eski tamamlanmış mesajları kendi `docs/archive/<ajan>/YYYY-MM-DD.md` dosyana taşı; açık işleri ve son devri koru. Arşivler yalnızca gerektiğinde okunur. Tam planı her oturumda yeniden yazma; hata çıktısını kısa özetle, gerekirse yerel log yolunu ver. Diğer ajanın işini yeniden yapma.

Bir görevin teslimi: ne değişti, hangi dosyalar, nasıl çalıştırılır, geçen kontroller, kalan sorun, karşı tarafın sonraki adımı. “Hazır” ile “test edildi” ayrı belirtilir.
