# B6 — giriş, katıl ve lobi ekranları (2026-09-10)

Giriş / `/katil/:code` / lobi ekranları oyunun paletiyle (keçe, ceviz, krem,
pirinç/amber) yeniden tasarlandı. **Sahne paketi (three) bu yolda yüklenmez**;
tüm görsel dil CSS gradyanı + inline SVG. Türkçe, telefon öncelikli, koyu tek
görünüm.

## Değişen / yeni dosyalar

| Yol | Değişiklik |
| --- | --- |
| `apps/web/src/ui/Screen.tsx` | Ortak kabuk: keçe zemin + ceviz çerçeve + krem kart. `CenteredScreen` (yeni isteğe bağlı `wide`), `LoadingScreen` (pirinç halka), `ErrorScreen` aynı API. |
| `apps/web/src/ui/TableBackdrop.tsx` | YENİ. Dekoratif inline SVG: ışık huzmesi, masa arkasındaki koltuk sırtları, ceviz+keçe masa, üstünde 3 kart. `aria-hidden`, `focusable="false"`. |
| `apps/web/src/ui/LobbyTable.tsx` | YENİ. Yuvarlak masa çizimi: SVG yüzey (dekoratif) + üstüne konumlanmış HTML koltuk listesi (`<ul aria-label="Masadaki oyuncular">`). Baş harf, ad, host tacı, hazır amber halka + tik, "sen" rozeti, bağlı olmayan soluk, boş koltuk kesikli. Yerel oyuncu masanın altına döndürülür. |
| `apps/web/src/ui/Lobby.tsx` | Yeni kabuk; oda kodu rozeti, oyuncu sayacı, davet satırında `Kopyala` + (varsa) `Paylaş`, masa çizimi, "Karakter: yakında" yer tutucu, büyük hazır anahtarı, host "Oyunu başlat" + gerekçe. Geniş ekranda masa solda / eylemler sağda. **DEV bot düğmesi ve `preloadScene()` korundu.** |
| `apps/web/src/app/EntryPage.tsx` | Başlık + tek satır tanıtım, isim, "Oda aç", "Davet koduyla katıl" (6 karakter, otomatik büyük harf), 3 adımlık "Nasıl oynanır", sürüm/istemci altbilgisi korundu. `?code=` ön dolumu. `normalizeInviteCode` dışa açıldı. |
| `apps/web/src/app/JoinPage.tsx` | Aynı kabuk; "Davet: ABC234" rozeti, isim, "Katıl", ana sayfa bağlantısı. |
| `apps/web/src/app/NotFoundPage.tsx` | Kabuğa taşındı. |
| `apps/web/src/ui/styles.css` | `.shell*`, `.hero*`, `.btn*`, `.howto*`, `.code-badge*`, `.table*`, `.seat*`, `.lobby*`, `.placeholder`, `.sr-only` + palet token'ları (`--felt/--walnut/--cream/--brass/--amber…`). Eski `.screen*` ve artık kullanılmayan `.seats*` seçicileri kaldırıldı (`.players*` kuralları aynen kaldı). **Oyun ekranı (`.game*`, `.actionbar*`, `.players*`) bölümlerine dokunulmadı.** |
| `apps/web/index.html` | `theme-color: #234b40`, `description`, kart motifli inline SVG data-URI favicon. Başlık "Secret Table". |
| `apps/web/src/ui/Lobby.test.tsx` | Güncellendi: 1 → 11 test. |
| `apps/web/src/app/EntryPage.test.tsx` | YENİ, 6 test. |
| `apps/web/src/app/JoinPage.test.tsx` | YENİ, 3 test. |
| `scratchpad/b6-shots.mjs` | YENİ (depo dışı yardımcı): görüntü çekimi + gerçek lobi koşusu. |

`RootErrorBoundary.tsx` ve `ConnectionBanner.tsx` kod olarak değişmedi (kabuktan
stil alıyorlar). Sözleşme, sunucu, oyun kuralı, bağımlılık **değişmedi**; yeni
paket eklenmedi (tüm ikon/çizim inline SVG).

## Erişilebilirlik / davranış

- Tüm düğmeler ≥44 px (birincil 48 px, hazır anahtarı 56 px); odak halkası krem
  zeminde `3px #8a5a1f`.
- Koltuk durumu yalnız renkle anlatılmaz: ekran okuyucu için `sr-only`
  "…, oda sahibi, sen, hazır / bekliyor, bağlı değil"; boş koltuk "Boş koltuk n".
- `prefers-reduced-motion: reduce` → kabuktaki tüm animasyon/geçiş kapalı
  (panel yükselme ve yükleme halkası dahil).
- Kod alanı: küçük harf/boşluk/geçersiz karakter temizlenir, 6 karakterde durur;
  düğme 6 karakterden önce devre dışı.
- `navigator.share` yoksa "Paylaş" hiç basılmaz (panel Chrome'unda yok,
  Playwright Chrome'unda var — ikisi de gözlendi).

## Testler (gerçekten çalıştırıldı)

- `pnpm --filter @secret-table/web typecheck` — geçti.
- `pnpm --filter @secret-table/web test` — **144** test (önce 115; +20 yeni,
  Lobby 1 → 11, Entry 6, Join 3; ayrıca oturumdaki diğer işlerden gelenler).
  Lobi testleri: 6 koltuk çizimi, boş koltukların `minPlayers`'a tamamlanması,
  hazır/oda sahibi/sen rozetleri, bağlı olmayan koltuk, `canStart:false` gerekçe
  metinleri ("En az 5 oyuncu gerekli (3 var).", "Herkesin hazır olması
  bekleniyor."), konuk için "Oda sahibi başlatacak.", `aria-pressed`, `Paylaş`
  yalnız `navigator.share` varken, DEV bot düğmesi hâlâ var.
- `pnpm typecheck` (kök) — geçti.
- `pnpm test` (kök) — **378** test (11/28/70/90/35/144).
- `pnpm build` (kök) — geçti.

## Paket boyutu

| Chunk | Önce | Sonra |
| --- | --- | --- |
| Giriş `index-*.js` | 293,02 kB (gzip ~83,2) | **301,68 kB** (gzip 83,31) |
| Uygulama CSS | 16,3 kB kaynak | 21,63 kB derlenmiş (gzip 5,42) |
| `three` | 751,30 kB | 751,30 kB (değişmedi) |

Giriş chunk'ı **statik olarak yalnız `react-vendor`** import ediyor; içinde
`THREE` geçmiyor (`node -e` ile doğrulandı). Sahne yalnız `SceneFrame`'in tembel
`import()`i ile iniyor. Üretim çıktısında `Bot-Ada` / `botRunner` / `5 bot ekle`
yok (A6 kuralı korundu).

## Gerçek görüntüler (`docs/qa/claude/b6/`)

Yerel dev sunucu (`.claude/launch.json` "web") + **canlı Supabase**. Lobi
görüntüsü gerçek oda: `Oda aç` → `5 bot ekle (dev)` → 6 oyuncu, hepsi hazır →
çekim → botlar durduruldu.

| Dosya | İçerik |
| --- | --- |
| `entry-desktop-1440x900.png` | Giriş, masaüstü |
| `entry-phone-390x844.png` | Giriş, telefon |
| `join-desktop-1440x900.png` | `/katil/ABC234`, masaüstü |
| `join-phone-390x844.png` | `/katil/ABC234`, telefon |
| `lobby-desktop-1440x900.png` | Gerçek lobi (6 oyuncu, 5 bot), masaüstü |
| `lobby-phone-390x844.png` | Aynı lobi, telefon |

Ajan tarayıcı panelinde ayrıca doğrulandı: `/olmayan-sayfa` (NotFound) ve
geçersiz oda kimliği (ErrorScreen) aynı kabukta; canlı odada 4 → 5 oyuncu
geçişinde boş koltuk "Boş" olarak çizildi, "Oyunu başlat" devre dışı + "En az 5
oyuncu gerekli (4 var)." metni göründü, 5. oyuncuda düğme etkinleşti. Panel
sekmesi lobide bırakıldı, botlar durduruldu.

## Kalan / karar bekleyen

- **Karakter seçimi (B3)**: lobide görünür ama pasif "Karakter — yakında" yer
  tutucu var; B3'te gerçek seçim buraya girecek (yer `.lobby__side` içinde).
- Yazı tipi: DESIGN'daki "statik etiketlerde serif hissi" uygulanmadı; görev
  "mevcut font yığını" dediği için tüm ekran sistem sans. Serif başlık istenirse
  yerel font paketlenmeli (bağımlılık/varlık kararı gerekir).
- Arka plan çizimi tek katman SVG; Codex gerçek 3D masa görselini isterse
  giriş chunk'ı hafif kalacak şekilde (statik görsel/`.webp`) devredilebilir.
- Lobi masası 2B yer tutucudur; 3D masa yalnız oyun ekranında.
- Dev botlarda bir koşuda 5 yerine 4 bot katıldı (panel koşusu); A6 alanı,
  B6 kapsamı dışında.
