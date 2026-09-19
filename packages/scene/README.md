# @secret-table/scene

X01/X02 + X03: ceviz/keçe 3D masa, avatarlar ve fiziksel kartlar; kısa olay hareketleri ve yerel sesler. Sahne ağ bağlantısı veya oyun motoru kullanmaz. Sözleşme **0.2.0**.

## Kullanım

Yalnız `@secret-table/scene` paketinden `TableScene` içe aktar. Boyutu belirlenmiş bir ebeveyn sağla; tek Canvas, kamera, ışık ve yerel inceleme düğmeleri sahnededir. Uygulama onayları ve HTML erişilebilir karşılıklar dışarıda kalır.

```tsx
<TableScene view={authorizedView} cues={cues} selection={selection}
  onIntent={handleSceneIntent} quality="standard"
  reducedMotion={prefs.reducedMotion} soundEnabled={prefs.soundEnabled} />
```

## Olay entegrasyonu

- İlk snapshot, remount ve **resync** sırasında `cues=[]`. Olayları animasyon tamamlanması koşuluna bağlama; sahne completion/ACK veya oyun komutu üretmez.
- Taze yanıtın aynı `gameId` ve `revision` olaylarını görünümle birlikte ilet. Tek seferlik/tekrarlanan/birikmiş array kabul edilir; yalnız güncel revision oynar, aynı cueId tekrar oynamaz. Başka oyun/oyuncu/oda kimliği önbelleği sıfırlar. Oyun başına 4096 ID üstünde hareket atlanır.
- Uygulama kuyruğunu sınırlı tut. Boş array aktif hareketi iptal eder: rutin temizlemeyi teslimle aynı anda yapma; bir sonraki görünümde veya en uzun süreden (850 ms) sonra temizleyebilirsin. Resync/kesintide hemen temizle.
- `connection`, `paused`, sekme gizlenmesi ve yeni revision son duruma geçirir. Azaltılmış harekette fiziksel uçuş/çevirme yok; durum anında yerleşir, olay ömrü 100 ms.
- Yetkili yüzler **güncel view** üzerinden gelir. `cards_dealt.cards` olay kimlikleri mevcut sunucu projeksiyonunda el kimliklerinden farklıdır; seçimde yalnız `privateView.hand[].cardId` kullanılır. Başkasının özel eli/rolü çizilmez.
- Oy açma, eşleşen `lastElection` ile yasama aşamasında da oynar; oyuncuya özel el aynı anda gelebilir. `cards_moved` deste/görev/atık arasında yalnız kapalı yüzler taşır; motor bunu çekme, atma, yürürlük ve veto kabulünde üretir (A4). Makam boşaldıysa `lastElection` (yalnız `elected`) ile koltuk çözülür.
- Oy gönderildi işareti ve seçim sayacı snapshot'tan anında çizilir; bunlar için ek cue türü icat edilmedi. Sunucu tarafından kaldırılan özel kart anında sahneden çıkar.

## Ses

5 özgün kısa Web Audio sesi; dosya indirmesi/CDN veya yeni bağımlılık yok. `soundEnabled` uygulama tercihi olarak kalır. Sahne güvenilir ilk pointer/klavye/tıklamada AudioContext'i açar; kilitli veya sessizdeki olaylar sonradan çalınmaz. Bir eşzamanlı grupta tek ses, en fazla 4 aktif kaynak; mute, kesinti, gizlenme ve unmount kaynakları durdurur. Web Audio yoksa görseller çalışır. Tercihin kalıcı kaydı ve HTML ses düğmesi Claude'un `usePrefs`/GameScreen katmanındadır.

## Önizleme ve kontroller

Kökten `pnpm dev`:

- Normal fixture rotası: `http://127.0.0.1:5173/dev/scene?fixture=president-discard`.
- X03 tekrar/kesinti/ses denemesi: `http://127.0.0.1:5173/@fs<proje-klasörü>/docs/qa/codex/x03.html`. Bu yol mevcut checkout için; başka checkout'ta `/@fs/` sonrası mutlak proje yolunu kullan.
- X03 ekranında örnek + kişi sayısı → **Yeni olay**. **Aynı olayı yinele** sayacı artırmaz; 180 ms düğmeleri hareket ortasında kesinti/eşitleme/yeni görünüm uygular. Ölçüm günlüğü 120 ve 1000 ms'de yalnız sayısal DOM tanı alanlarını kaydeder.
- Sahne testleri: `pnpm --filter @secret-table/scene test` (30). Tüm workspace tip kontrolü, 163 test ve üretim derlemesi geçti.

Fontlar yerel modül URL'leriyle üretim `dist/assets/` içine paketlenir; ek public/CDN kopyası gerekmez. Üretim gerçek sahneyi içerir, X03 QA ekranını içermez. Demand render; low DPR 1 ve gölgesiz; standard DPR en çok 1,5.

[QA ve sınırlar](../../docs/qa/codex/X03.md) · [Varlıklar](../../docs/ASSETS.md) · [Claude'a devir](../../docs/agents/CODEX.md)
