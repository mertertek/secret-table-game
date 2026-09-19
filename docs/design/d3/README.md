# D3 karakter konsept görselleri (taslak, 2026-09)

- Bu klasördeki `concept-lineup`, `concept-scale`, `concept-faces` (SVG + PNG) 2D **konsept taslağıdır**; nihai 3D görünüm değil, oran/stil/renk hedefini gösterir. Vektör, harici font yok; PNG'ler headless Chrome ile 1800×900 alındı.
- 3D üretimde (D3.2+) aynı oranlar hedeflenir: oturmuş boy 1,00 m, baş r 0,20 m (boyun %40'ı), baş tepesi masa yüzeyinin ~0,75 m üstünde; gövde SDF kapsül/elipsoid **yumuşak birleşim** ile tek mesh, aksesuarlar aynı alana eklenir, yüz (kaş+göz+ağız) tek projeksiyon dokusu.
- Stil: düz renk + tek koyu ton gölge (cel-shade), kalın kontur yok; büyük gözler, küçük burun, varsayılan hafif gülümseme; 4 ifade (nötr, gülümseme, şaşkın, somurtkan) yalnız yüz dokusunda değişir.
- Renk tokenleri (`packages/scene/src/materials/palette.ts`): duvar `leather #233631`, lambri `walnut #583b2b` + `cream #eee1c7`, masa `felt #234b40`, kenar `walnut` + `gold #e3be73`, etiket `label.bg #17241f` / `label.line #59625a`; ten `#f1c9a3` / `#c98f62` / `#7d4b30`; vurgular: bordo `#7a2a3a`, pembe `#e6a0b8`, açık mavi `#8ec5df`, lacivert `#25355a` (parti renkleri `liberal`/`fascist` hiçbir karakterde kullanılmaz).
- Kaynak: görseller scratchpad'deki bir üretici betikle çizildi; değişiklik için SVG'ler doğrudan düzenlenebilir, uygulama kodunda karşılığı yoktur.

## D3.1 şartname çıktıları (2026-09-11)

- `characters.json`: makine okur karakter tanımı (taban 23 SDF ilkeli, 8 kemik, 22 aksesuar, 5 giysi kuralı, 8 karakter × 3 ten, 4 ifade, bütçe, kamera/etiket). Sayılar `../D3-characters.md` ile birebir (aynı üretici betikten).
- `lineup.svg/.png` (2400×1040): 8 karakterin önden dizilimi, şartname ölçüleriyle (1 birim = 2 mm), altında ad/aksesuar/oran/vurgu kartları.
- `body-sheet.svg/.png` (1980×1500): taban gövde önden/yandan ilkel şeması, kemik noktaları, ölçü okları (1 m = 1000 px).
- PNG'ler headless Chrome (`--headless=new --screenshot`) ile SVG'den 1:1 alındı.
- Üretici: `gen_d3.py` (`python3 gen_d3.py <çıktı-klasörü>` → characters.json, lineup.svg, body-sheet.svg, tables.md). Sayı değişikliği önce burada yapılır; MD tabloları `tables.md` parçalarından alınır.
