# Oyun uygulaması ↔ 3D sahne sözleşmesi

Sürüm: **0.2.0** (sabit, 2026-09-09). Hazırlayan: Codex; TypeScript tiplerini Claude yazdı (C01); Codex CODEX-004 ile fark olmadan kabul etti. Kesin alan adlarının kaynağı `packages/contracts/src/` (`scene.ts`, `commands.ts`, `ids.ts`, `rules.ts`); bu Markdown davranış, gizlilik ve değişiklik gerekçesini açıklar. Kırıcı değişiklik iki ajanın MD üzerinden mutabakatını gerektirir.

## 1. Paket sınırı

Sahne paketi `TableScene` bileşenini dışa açar. Props:

| Prop | İçerik / görev |
| --- | --- |
| `view: SceneView` | Sunucunun izin verdiği bilgilerden oluşturulmuş son görünüm |
| `cues: readonly SceneCue[]` | Bu oyuncuya gönderilmesine izin verilen, kısa görsel olaylar |
| `selection: SceneSelection \| null` | Uygulamanın tuttuğu yerel, henüz kesinleştirilmemiş seçim |
| `onIntent: (intent: SceneIntent) => void` | Sahnedeki seçim veya yerel inceleme isteğini uygulamaya bildirir |
| `quality: 'low' \| 'standard'` | Grafik seviyesi |
| `reducedMotion: boolean` | Hareket azaltma tercihi |
| `soundEnabled: boolean` | Kullanıcı etkileşiminden sonra etkinleşebilen ses tercihi |

Canvas, kamera, sahne içi ışıklar, nesneler ve animasyonlar Codex'e ait. Dış kapsayıcının boyutu, yükleme/hata sınırı, ağ bağlantısı, HTML paneller ve onay düğmeleri Claude'a ait. Bileşen ebeveyninin genişlik/yüksekliğini kullanır; global stil yazmaz. İkinci bir Canvas oluşturup sahneyi iç içe kurma.

Sahne paketi Supabase istemcisi, server veya game-core içe aktarmaz. Props salt okunur kabul edilir. Kamera/hover gibi yerel durumlar oyun durumunu değiştirmez. Ağ tarafı Vercel HTTP API + Supabase Realtime'dır; bu seçim sahne geometrisini etkilemez.

## 2. Kimlikler ve sürümler

- `roomId`: sunucunun oda kimliği. Davet kodu ile eşlenebilir, kimlik doğrulama sırrı değildir.
- `gameId`: her yeni oyunda üretilen farklı kimlik; lobide `null` olabilir.
- `revision`: oda yaşamı boyunca monoton artan görünüm sürümü. Aynı oyunda eski görünüm uygulanmaz. "Yeniden oyna" (QA-R01) yeni oyunu **biten oyunun `revision`'ından +1** ile başlatır; sayaç sıfırlanmaz, böylece sürüm sinyali tüm istemcileri yeniler.
- `phaseId`: mevcut etkileşim penceresinin benzersiz kimliği. Aşama adı tekrar etse de kimlik tekrar kullanılmaz.
- `playerId`: koltuğa bağlı sunucu oyuncu kimliği; bağlantı oturumu kimliğinden bağımsız.
- `actionId`, `optionId`: sunucu tarafından verilen, yalnızca geçerli aksiyon penceresinde kullanılabilen opak kimlikler.
- `cueId`, `commandId`: tekrar işlemeyi engelleyen benzersiz kimlikler.
- `protocolVersion`: ağ uyumluluğu için sayı; ilk uygulama `1`. Uyumsuz istemci anlaşılır güncelleme mesajı alır.

Kimlik metinleri gizli rol veya kart türünü kodlamaz. Ağdaki protokol sürümü ile bu belgenin `0.2.0` revizyonu farklı kavramlardır. TypeScript: `PROTOCOL_VERSION` ve `CONTRACT_VERSION` (`'0.2.0'`) `@secret-table/contracts` girişinden verilir.

### Kurulum metaverisi — tek kaynak

Tahta yuvaları, yürütme yetkileri, rol dağılımı ve deste sayısı `@secret-table/contracts` içindeki `rules.ts` sabitleridir: `BOARD_LAYOUTS` (boardVariant → 6 faşist yuva gücü + veto eşiği + Hitler-şansölye eşiği), `ROLE_SETUPS` (5-10 için liberal/faşist sayısı, Hitler'in faşistleri bilmesi), `POLICY_DECK_COMPOSITION`, `ELECTION_TRACKER_MAX`. Motor (kural), sunucu (projeksiyon) ve sahne (yuva/yetki ikonları) bu tek kaynaktan okur; sahne kendi kural tablosunu üretmez (CODEX-005 yanıtı).

## 3. SceneView

Claude aşağıdaki alanları discriminated union ve dar tiplerle uygular. Buradaki tablolar davranış sözleşmesidir; genel `any`, keyfi JSON veya tüm motor durumunu kapsayan bir tip kullanılmaz.

| Alan | İçerik |
| --- | --- |
| `protocolVersion`, `roomId`, `gameId`, `revision`, `phaseId` | Yukarıdaki kimlikler |
| `phase` | `lobby`, `role_reveal`, `nomination`, `voting`, `election_result`, `president_discard`, `chancellor_choice`, `veto_response`, `policy_result`, `executive_action`, `game_over` |
| `connection` | `connected`, `reconnecting`, `disconnected`; istemci adaptörü ekler |
| `paused` | `null` veya `{ reason, waitingForPlayerIds }`; oyun aşamasını silmez |
| `playerCountAtStart` | Lobide `null`; oyunda sabit 5–10 sayısı |
| `boardVariant` | `small` (5–6), `medium` (7–8), `large` (9–10); başlangıç kurulumuna bağlı |
| `localPlayerId` | Mevcut yerel oyuncu |
| `players` | Sabit koltuk sırasıyla `PlayerView[]` |
| `table` | `PublicTableView` |
| `privateView` | Yalnızca mevcut oyuncuya izin verilen `PrivateView` |
| `actions` | Mevcut oyuncunun yapabileceği `AllowedAction[]` |
| `result` | Oyun sürerken `null`; bittiğinde kazanan, neden ve açıklanabilen roller |

`paused` ile `connection` farklıdır: benim bağlantım açıkken başka oyuncu nedeniyle oyun durmuş olabilir. `boardVariant`, elenen oyuncu sayısıyla yeniden hesaplanmaz.

**`connection` — istemci adaptörü doldurur (C06).** Sunucu projeksiyonu her zaman
`connected` verir; `apps/web/src/multiplayer/useRoomState.ts` bunu gerçek istemci
durumuyla değiştirir: HTTP ağ hatası sayacı (`NETWORK_ERROR` ≥3 → `disconnected`) +
Realtime kanal durumu (`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`) + `navigator` `online`/
`offline` olaylarının en kötüsü. `disconnected` iken HTML eylem düğmeleri kapalıdır
(yanlış başarı hissi vermez). Bağlantı geri gelince bir sonraki görünüm `resync` ile
alınır; birikmiş `cues` kuyruğu boşaltılır (§ 7).

### PlayerView — herkese açık

`playerId`, `seatIndex`, `displayName`, `connected`, `ready`, `alive`, `isHost`, `office`, `isPresidentialCandidate`, `isChancellorCandidate`, `hasVoted`, `avatar`.

- `office`: `none`, `president` veya `chancellor`; adaylık seçilmiş görevle aynı alan değildir.
- `hasVoted` yalnızca oy gönderildiğini gösterir. Açıklanmamış oy tercihi bulunmaz.
- Bilinen açık oyun bilgileri gerekirse ayrı alan olarak eklenir; rolü ima eden görsel avatar veya renk atanmaz.
- İsimler veri olarak çizilir; HTML veya varlık URL'si olarak değerlendirilmez.
  **Uzunluk/karakter sınırı (C04):** sunucu adı `trim` + iç boşlukları teke indirir ve
  ilk **40** koda (`String.slice(0, 40)`) kırpar; boşsa `"Oyuncu"` olur (`sanitizeName`,
  `packages/server/src/service.ts`). Karakter kümesi kısıtlanmaz (Türkçe/emoji serbest);
  istemci girişi `maxLength=40` ile eşlenir. HTML katmanı adı metin düğümü olarak basar.
- `avatar` (D3.4, additive): `{ character, skin }`. Oyuncunun lobide seçtiği karakter
  ve ten tonu; **her zaman doludur**. Oyuncu seçim yapmadıysa sunucu koltuk
  sırasından türetilen varsayılanı verir (`avatarForSeat`,
  `packages/contracts/src/avatars.ts` — sahne ve sunucu AYNI işlevi kullanır).
  Kimlik listesi tasarım kaynağından gelir (`docs/design/d3/characters.json`:
  8 karakter × 3 ten) ve üç yerde birden doğrulanır: DB CHECK (0008), HTTP şeması
  (`lobbyCommandSchema`), sunucu komut işleyicisi. **Rol ima etmez**; herkese
  açıktır ve gizli veri taşımaz (§ 3 gizlilik kuralı korunur).
- Oyun sürerken genel oyuncu nesnesinde rol, parti, el veya geri dönüş anahtarı bulunmaz.

### PublicTableView

`liberalPolicies`, `fascistPolicies`, `electionTracker`, `drawCount`, `discardCount`, `enactedPolicies`, `lastElection`, `currentPower`, `publicHistory`.

- `enactedPolicies`: tahta türü, yuva ve açıklanmış politika türü; gelecekteki deste bilgisi yok.
- `lastElection`: en son açıklanmış seçim kimliği, adaylar, sonuç ve kişi başı oylar. Devam eden seçimin gizli oyları eklenmez.
- `currentPower`: herkesçe bilinebilen yetki türü ve kullanan oyuncu; özel inceleme sonucu yok.
- `publicHistory`: kısa, filtrelenmiş olaylar; gizli kart seçimi veya inceleme sonucu kaydedilmez.
- Sayaç/sıra alanlarının değerleri sunucudan gelir. Sahne kural hesaplayarak değiştirmez.

### PrivateView — yalnızca bu oyuncu

| Alan | İçerik |
| --- | --- |
| `role` | Bu oyuncunun kendi rolü; dağıtımdan önce `null` |
| `knownPlayers` | Başlangıç kuralı veya özel inceleme nedeniyle izin verilen kişi bilgileri; kaynak ve bilginin türü açık |
| `hand` | `{cardId, policy}` dizisi; sadece bu aşamada yetkili olunan kartlar |
| `submittedVote` | Oyuncunun kendi gönderdiği oy; yoksa `null` |
| `inspection` | `null` veya parti inceleme / deste bakma sonucunun dar tipli birleşimi |

`knownPlayers` her oyuncunun tam rol haritası değildir. Parti bilgisi ile kesin rol bilgisi birbirinden ayrılır. `inspection` doğru alıcı dışında oluşturulmaz. Önceki aşamada görülen bir özel elin kartları yeni aşamada kaldırılır; istemci geçmişine veya kalıcı tarayıcı deposuna yazılmaz. İnsan oyuncunun zaten gördüğü bilgiyi unutması teknik olarak sağlanamaz; vaat edilen şey yetkisiz yeni bilginin gönderilmemesidir.

Kendi rolünü tekrar inceleme ve kart yakınlaştırma yerel UI eylemleridir. Rol paneli varsayılan kapalıdır; pencere odağı kaybolunca kapatılabilir. Bu görsel tercih sunucu tarafındaki gizlilik filtresinin yerine geçmez.

## 4. Yapılabilir eylemler

`AllowedAction` şu bilgileri taşır: `actionId`, `kind`, `phaseId`, `options`, `requiresConfirmation`. Her seçenek `optionId`, `labelKey` ve gerektiğinde `targetPlayerId`, `cardId` veya `vote` taşır. Tüm seçenekler mevcut oyuncunun görmesine izin verilen verilerdir.

Başlangıç aksiyon türleri:

| Tür | Seçim / kullanım |
| --- | --- |
| `ack_role` | Rol başlangıcında hazır olduğunu bildir |
| `nominate` | Uygun şansölye adayını seç |
| `vote` | Evet veya hayır |
| `discard_policy` | Başkanın elinden bir kartı at |
| `enact_policy` | Şansölyenin elinden yürürlüğe girecek kartı seç; diğer kartı motor ele alır |
| `request_veto` | Uygun aşamada veto isteği |
| `respond_veto` | Başkanın kabul / ret yanıtı |
| `use_power` | Yetkiye uygun oyuncu seçimi veya bilgiyi açma |
| `ack_private_result` | Özel inceleme görüntülendiğini bildir |

Lobi hazır olma, oda başlatma, oyunu iptal etme ve yeniden oynama kontrolleri Claude'un uygulama katmanındadır. Yetkiler aynı sunucu doğrulamasından geçer; 3D sahne bunları kendisi üretmez.

Oyuncu `actions` içinde yoksa sahne onu hedef olarak etkinleştirmez. Sunucu yine bütün yetki ve aşama kontrollerini yapar; `actions` bir güvenlik garantisi veya istemciden güvenilecek kanıt değildir.

### `labelKey` sözlüğü — tek kaynak (C04)

`ActionOption.labelKey` değerleri `apps/web/src/ui/text.ts` içinde Türkçeye çözülür.
Sabit anahtarlar: `role.ready`, `vote.yes`, `vote.no`, `policy.liberal`, `policy.fascist`,
`veto.request`, `veto.accept`, `veto.reject`, `power.peek`, `inspection.ack`. Veriye bağlı
tek anahtar `player.name`: `option.targetPlayerId` → `view.players` üzerinden görünen ad.
Aksiyon türü başlıkları (`ActionKind` → başlık + ipucu) ve `ScenePhase` → Türkçe ad da
aynı dosyadadır. Sahne kendi metnini bu sözlükten türetmez; sözlük HTML kontrollere aittir.

## 5. SceneIntent ve onay akışı

```ts
type SceneIntent =
  | { type: 'select_option'; actionId: string; optionId: string }
  | { type: 'clear_selection' }
  | { type: 'inspect_own_role'; open?: boolean }
  | { type: 'inspect_card'; cardId: string }
  | { type: 'focus_player'; playerId: string }
  | { type: 'set_camera'; target: 'overview' | 'seat' }; // additive (FINISH_PLAN §2A, V)

type SceneSelection = {
  actionId: string;
  optionId: string;
};
```

Bu küçük taslak dış arayüz niyetini sabitler; uygulama C01'de oluşturulur.

**`set_camera` (additive, opsiyonel — 2026-09-09, FINISH_PLAN §2A).** `V` tuşu
genel masa ↔ koltuk kamerası geçişini ister. Sahne kamera durumunun sahibidir;
oyun kuralı çalıştırmaz. Tüketmeyen sahnede sessizce yok sayılır (kırıcı değil).

**`inspect_own_role.open` (additive, opsiyonel — 2026-09-09, QA-R02).** Özel bilgi
panelinin açık/kapalı durumunun tek kaynağı uygulamadır (`useRoomState.rolePanelOpen`,
`RolePanel`'e ve — verildiğinde — `TableScene`'e `rolePanelOpen` prop'u olarak geçer).
Sahne aç/kapat isteğinde `open` **yönünü** vermeli (`onIntent({ type: 'inspect_own_role',
open: !roleOpen })`); `open` verilmezse niyet **açma** sayılır — yönsüz eski/bağımsız
sahne için geriye uyumlu, ama `!current` toggle tahminine dönüştürülmez (CODEX-012,
tek kaynak: `useRoomState` → `nextRolePanelOpen`). Amaç: sahnedeki "Kimliği kapat"
ile HTML "Gizle" ve klavye `H` birbirini tersine çevirmesin.
`TableSceneProps.rolePanelOpen?: boolean` de additive: verilirse sahne kendi iç
durumu yerine bunu kullanır, `undefined` ise mevcut iç davranış korunur (prototip).
İkisi de kırıcı değil; sürüm `0.2.0` sabit kalır.

**`TableSceneProps.resetEpoch?: number` (additive — 2026-09-09, FINISH_PLAN §3).**
Açık reset nesli. Normal boş `cues` kuyruğu sahnenin kabul ettiği yerel hareketi
KESMEZ. Bu sayaç arttığında (resync, `gameId` değişimi, yeniden bağlanma, yeniden
mount) sahne kabul ettiği yerel hareketi hemen bırakır. Sunum süreleri sahnede tek
kaynakta kalır; bu alan yalnız "sıfırla" sinyalidir. `undefined` → sahne mevcut
davranışını korur.

**`TableSceneProps.immersive?: ImmersiveSceneProps` (additive — 2026-09-09,
FINISH_PLAN §2, §4; alan seti CODEX-014/015 ile kesinleşti).** İlk-şahıs / koltuk
kamerası bağlantısı. Uygulama Fullscreen + Pointer Lock yaşam döngüsünü ve TÜM tuş
yönetimini üstlenir (Claude); sahne göreli fare deltasını sınırlı yaw/pitch
kameraya bağlar, kart yuvalarını ve nişangâhı çizer (Codex).

```ts
type ImmersiveSceneProps = {
  active: boolean;                       // @deprecated geri uyum tek bayrak
  cameraMode?: 'overview' | 'seat';      // V tuşu; verilmezse active → 'seat'
  pointerLocked?: boolean;               // göreli fare deltası akıyor mu
  sensitivity?: number;                  // fare bakış çarpanı (varsayılan 1)
  inspectOpen?: boolean;                 // özel inceleme paneli açık
  suspended?: boolean;                   // duraklama / bağlantı yok → kamera dursun
  peers: readonly HeadViewpoint[];       // uzak oyuncuların doğrulanmış baş yönleri
  onLocalViewpoint?: (v: { yaw: number; pitch: number }) => void;
  onController?: (c: SceneController | null) => void;  // sahne → uygulama (imperative)
  onTargetsChange?: (t: SceneTargets) => void;         // ekran yuva sırası → HUD
  needsResume?: boolean;
};

type SceneController = {
  lookBy: (dx: number, dy: number) => void;   // Pointer Lock göreli piksel
  inspectBy: (step: -1 | 1) => void;          // yalnız yerel inceleme odağı
  selectSlot: (index: number) => SceneSelection | null; // yalnız DÖNDÜRÜR
  target: () => SceneSelection | null;        // yalnız DÖNDÜRÜR
  resetLook: () => void;
};

type SceneTargets = {
  slots: readonly (SceneSelection | null)[]; // soldan sağa; yetkisiz yuva null, kaymaz
  hovered: SceneSelection | null;
  inspectedIndex: number;
};
```

Verilmezse sahne mevcut inceleme kamerası davranışını korur. `SceneController`
yöntemlerinin hiçbiri `onIntent` / ağ komutu göndermez; gönderim yalnız uygulama
`onIntent` → `submitSelected` yolundadır. Sahne kendi ikinci global keydown/komut
dinleyicisini KURMAZ (FINISH_PLAN §2A). Sahne yoksa (WebGL hatası / prototip)
uygulama `view.actions`'tan türetilen yedek yolu kullanır.

### 5A. Baş yönü paylaşımı — `HeadViewpoint` (additive, FINISH_PLAN §4; NETWORK-001 ile güncellendi 2026-09-10)

`@secret-table/contracts` içinde `viewpoint.ts`: `HeadViewpoint`, `LocalViewpoint`
tipleri + sınır sabitleri (`VIEWPOINT_YAW_LIMIT` 1.4, `VIEWPOINT_PITCH_LIMIT` 0.6,
`VIEWPOINT_MIN_DELTA` 0.015, `VIEWPOINT_IDLE_STOP_MS` 1500, `VIEWPOINT_STALE_MS` 4000)
ve saf yardımcılar (`clampViewpoint`, `viewpointChanged`). Kesin ağ davranışı
`apps/web/src/multiplayer/{viewpointProtocol.ts,viewpointChannel.ts}` ve
`supabase/migrations/0007_viewpoint_channels.sql` içindedir; kanıt
`docs/qa/codex/NETWORK-INTEGRATION.md`.

- Oyuncu başına özel Realtime kanalı **`room:<roomId>:viewpoint:<gameId>:<playerId>`**
  (`private: true`). SELECT aktif oda üyesine; INSERT yalnız `auth.uid()` o
  `playerId`nin sahibiyse (`can_use_viewpoint_topic`). Gönderen kimliği payload'dan
  değil yetkili topic'ten türetilir. Oyun `room:<id>` revision kanalına istemci yazımı
  kapalıdır. DB'ye yazılmaz, komut defteri etkilenmez.
- Wire payload yalnız `{epoch, seq, yaw, pitch}`; alıcı tekrar/geriye giden sıra,
  sonlu olmayan veya aralık dışı değeri reddeder. `HeadViewpoint.t` **alıcının yerel
  alım zamanıdır** (epoch ms); gönderen saati bayatlık kaynağı değildir.
- Gönderim aralığı oyuncu sayısına bağlı: `viewpointInterval(n) = max(500, n²×15)` ms
  (7 kişide 735 ms, 10 kişide 1500 ms). `VIEWPOINT_SEND_INTERVAL_MS` (120) yalnız
  alıcı tarafındaki sahne tazeleme sıklığıdır, ağ hızı değildir. Eşik altı değişim ve
  hareketsizlik gönderim üretmez; gizli sekme/çevrimdışı susar; özel inceleme kamerası
  GÖNDERİLMEZ. Free bütçe hesabı NETWORK-INTEGRATION §D.
- Alıcı ayrıca `SceneView.players` ile `playerId`/`seatIndex` çapraz kontrolü yapar,
  kendi başını dinlemez, `VIEWPOINT_STALE_MS` sonrası nötr poza düşer.

#### 5A.1 El jestleri — `HeadViewpoint.emote` (additive, D16, 2026-09-12)

Aynı kanalın isteğe bağlı alanı: `emote?: { kind: EmoteKind; seq: number; at: number }`.
Sözleşme paketi **0.2.2** (additive; `CONTRACT_VERSION` yine `0.2.0`). Sunucu, DB ve
komut defteri bu alanı GÖRMEZ; oyun kuralına etkisi yoktur.

- `EMOTE_KINDS` (8): `point, hands_up, thumbs_up, thumbs_down, middle, wave, clap,
  facepalm`; süreler `EMOTE_DURATION_MS` (2000–3000 ms), yerel hız sınırı
  `EMOTE_COOLDOWN_MS` 1200 ms, kayıp telafisi `EMOTE_REPEAT_MS` [250, 600].
- Wire payload jestle birlikte `{epoch, seq, yaw, pitch, emote}`; **bilinmeyen `kind`
  ya da bozuk `emote` alanı DÜŞER, bakış paketi yine kabul edilir**. `emote.seq`
  gönderen başına artan tam sayıdır; alıcı aynı `seq`i bir kez oynatır (250/600 ms
  tekrarları yalnız kaybı telafi eder). `at` gönderen saatidir ve yalnız sıralama/
  teşhis içindir; oynatma süresi ALICI saatiyle ölçülür.
- Jest anında bakış hız sınırı atlanır (tek paket + iki tekrar); bakış sırası (`seq`)
  her pakette artmaya devam eder.

1. Sahne tıklamayı `onIntent` ile bildirir.
2. Claude uygulaması mevcut aksiyonu kontrol eder, yerel seçimi ve anlaşılır eylem metnini gösterir.
3. Gerekli onaydan sonra ağ komutunu gönderir. Aynı komut beklerken tekrar gönderim kullanıcı tarafında engellenir.
4. Sunucu isteği doğrular ve yeni yetkili görünümü yollar; hata varsa önceki doğru durum korunur.
5. Sahne yeni görünümü çizer. Kartın yasalaşması veya oy sonucunun açılması gibi kesin sonuçlar sunucu onayından önce canlandırılmaz.

`phaseId` veya geçerli aksiyon değiştiğinde artık geçersiz yerel seçim temizlenir. Klavye ve HTML düğmeleri de aynı uygulama işlevini kullanır; sahne tıklaması ayrı bir oyun kural yolu oluşturmaz.

## 6. Ağ komutu ve görünüm gönderimi

Claude kesin mesaj şemalarını C01/C03'te yazar. Minimum hamle zarfı:

```ts
type GameCommand = {
  protocolVersion: 1;
  gameId: string;
  phaseId: string;
  commandId: string;
  actionId: string;
  optionId?: string;
};
```

Oyuncu kimliği doğrulanmış Supabase Auth token'ı ve oda üyeliğinden türetilir; istek içindeki rastgele `playerId` ile başkası adına işlem yapılamaz. Doğrulama sırası: geçerli oturum → oyun → aşama/aksiyon → seçenek → yetki/kurallar → atomik DB kaydı → yeni görünüm. Etkin tarayıcı oturumu nesli de ayrıca doğrulanır; kesin başlık/zarf alanını Claude C03'te tanımlar.

Sonuç aşamaları oyun motorunda kalıcı bekleme noktaları olmak zorunda değildir. `election_result` / `policy_result` sunum durumları veya olayları güncel kuralla tutarlı üretilir; bir istemcinin animasyon bitiş mesajı oyunun ilerleme koşulu yapılmaz. Rol başlangıcındaki hazır bildirimi ve yetkili özel incelemenin tamamlanması gibi gerçek oyuncu eylemleri ayrı doğrulanır.

Sadece tüm oda `revision` değerinin birebir eşitliğini istemek yanlış olur: aynı aşamada başka birinin oyu görünümü değiştirebilir. Güncellik ilgili `phaseId/actionId` ve sunucunun o oyuncu için beklediği aksiyonla doğrulanır.

İlk sürümde her alıcı HTTP API'den tek `player_view` yanıtıyla tutarlı görünüm alır. Supabase Realtime kanalı sadece `{roomId, revision}` sinyali taşır; gizli veya tam oyun görünümü taşımaz. İstemci sinyalden sonra kendi görünümünü tekrar alır. Ortak/özel veri parçaları ayrı zamanlarda birleştirilip yanlış elde kart gösterilmez. Yanıtlar `private, no-store` kullanır. Yeniden bağlanmada `resync=true` olan tam görünüm kullanılır; eski animasyon kuyruğu temizlenir.

İstemci kanal aboneliği kurulduktan sonra son görünümü alır; araya giren daha yüksek revision için tekrar ister. Kaçan bildirimler odağa dönüş, yeniden abonelik ve düşük sıklıklı HTTP kontrolüyle toparlanır. Atomik kayıt ve eşzamanlı hamle protokolü [DEPLOYMENT.md](DEPLOYMENT.md) içindedir.

Komut yanıtı kabul/ret, `commandId`, hata kodu, ilgili görünüm sürümü ve gönderenin yetkili görünümünü içerir. Görsel bekleme, karşılık gelen güncel görünüm uygulanınca sonlandırılır. Aynı komut tekrar geldiğinde etkisi DB'deki kalıcı komut kaydı sayesinde yinelenmez; bu güvence Function belleğine bağlı değildir.

**`optionId` zorunluluğu (2026-09-12, D21/I).** Sunucu `optionId` atlanan bir
komutta ARTIK sessizce ilk seçeneği uygulamaz (ölçülen eski etki: oy → "evet",
adaylık → ilk uygun oyuncu, veto → kabul). Kural tek yerde, sunucudadır
(`server/engine-map.ts`) ve projeksiyondan türetilir — sözleşmedeki sabit eylem
kimliği listesi (`ACTIONS_REQUIRING_OPTION`) KALDIRILDI, çünkü projeksiyonla
uyumsuzlaşabiliyordu. `optionId` **gerçek bir seçim varsa zorunludur**:

- eylemin birden çok seçeneği varsa (aday, oy, atma, koyma, veto yanıtı), ya da
- seçenek bir oyuncuyu hedefliyorsa (`targetPlayerId`) — tek uygun hedefi kalmış
  inceleme/infaz DAHİL: sunucu "kimi vurduğunu" varsaymaz.

Gerçek seçim içermeyen onaylarda (`act_ack_role`, `act_ack_private`,
`act_request_veto`) ve `policy_peek`te (tek, hedefsiz "bak" seçeneği) alan
atlanabilir. Eksik/geçersiz `optionId` → `INVALID_OPTION`, durum değişmez.
İstemciler (ve dev bot koşucusu) zaten her zaman `optionId` gönderiyor
(kontrol edildi 2026-09-12), bu yüzden bu sıkılaştırma kırıcı değildir.

**`roomStatus` (2026-09-12, D21/A, additive).** `PlayerViewResponse.roomStatus`
odanın o anki durumunu (`lobby` / `in_game` / `ended`) taşır. `cancel_game`
yalnız oda durumunu değiştirip oyun durumu satırını bıraktığı için `view` hâlâ
geçerli bir oyun görünümü döndürüyor ve host "Lobiye dön" dediğinde diğer
istemciler oyun-sonu ekranında takılı kalıyordu. Alan `'lobby'` ise istemci lobi
yoluna döner. Eski istemci alanı yok sayar, eski sunucu göndermez (istemci
`undefined`'ı "bilinmiyor" sayar). Ayrıca `cancel_game` artık oyun durumu
satırına dokunmadan sürüm sinyali yayınlar (`notify_room_revision`; yeni
migration gerekmez).

Önerilen hata kodları: `ROOM_NOT_FOUND`, `ROOM_FULL`, `GAME_ALREADY_STARTED`, `SESSION_INVALID`, `RECONNECT_EXPIRED`, `STALE_ACTION`, `NOT_ALLOWED`, `INVALID_OPTION`, `RATE_LIMITED`, `VERSION_MISMATCH`, `RETRYABLE_CONFLICT`, `SERVICE_UNAVAILABLE`. Kullanıcı metinleri Türkçedir; hata yanıtı gizli durum dökümü içermez.

## 7. Görsel olaylar

`SceneCue`: `cueId`, `gameId`, `revision`, `kind`, yetkilendirilmiş dar bir `payload` ve isteğe bağlı sunucu zamanı. Tür örnekleri:

- `cards_dealt`: sadece alıcının görebileceği kartlar veya gizli yüz içermeyen genel hareket.
- `votes_revealed`: artık herkese açık olan seçim sonucu.
- `policy_enacted`: açıklanan politika ve hedef tahta yuvası.
- `office_moved`: görev ve hedef oyuncu.
- `player_eliminated`: oyuncu kimliği; açıklanmaması gereken rol/parti yok.
- `game_ended`: açıklanmasına izin verilen oyun sonu bilgisi.

Sunucu olayları görsel süreye göre beklemez. Sahne aynı `cueId`yi tekrar oynatmaz. Oyun kimliği değişince tüm yerel animasyon/kimlik önbelleği sıfırlanır. Geç/eksik olayda sahne son görünümden doğru konuma gelir; animasyon zorunlu değildir. Arka plandan dönüşte eski birikmiş olaylar hızlıca bitirilir veya atlanır.

Oy açılışı istemcilerde aynı açıklanmış seçim kimliğine ait yetkili HTTP görünümü/olayı alındığında başlatılır; cihazlar arasında kare düzeyinde eşzamanlılık garantisi verilmez. Oylama sonuçları sunucuda açıklama aşamasından önce gönderilmez. `SceneCue`lar Realtime kanalına konmaz; sadece izinli HTTP yanıtının parçası olarak gelir.

### 7.1 Cue dağıtımı — `sinceRevision` (D18, additive)

Sürüm `0.2.0` korunur; `player_view` isteğine **isteğe bağlı** bir alan eklendi
(`PlayerViewRequest.sinceRevision`), yanıt biçimi değişmedi.

Sorun (RULES-AUDIT B4): cue'lar yalnız `submitCommand` yanıtında üretildiği için
hamleyi YAPMAYAN oyunculara hiç ulaşmıyordu; onların sahnesi infaz koreografisini,
kart hareketini ve oy açılışını göremiyordu.

Kural:

- Sunucu **son uygulanan komutun** motor olaylarını oyun durumu satırıyla AYNI
  yazımda saklar (sürüm ile olaylar asla ayrışmaz).
- İstemci `view` isteğinde elindeki son sürümü `sinceRevision` ile bildirir.
  **D21/C (2026-09-12):** koşul gevşetildi — kayıtlı durum bu sürümün
  İLERİSİNDEki her durumda (`sinceRevision < revision`) sunucu son komutun
  olaylarını **alıcıya göre süzerek** cue'ya çevirir; aksi hâlde `cues: []`.
  Eski koşul `revision === sinceRevision + 1` idi ve iki sürüm atlandığında
  (yarışan yoklama / hızlı iki hamle) EN YENİ sürümün cue'ları da düşüyordu.
  Yalnız SON komutun olayları saklandığı ve sahne yalnız güncel sürümü oynattığı
  için geçmiş yine yeniden oynatılmaz.
- **D21/C, additive:** `PlayerViewRequest.sinceGameId` — istemcinin elindeki
  görünümün oyun kimliği. Verilirse kayıtlı oyunla eşleşmelidir; "Yeniden oyna"
  sonrası sürüm sayacı devam ettiği için eski sürüm yeni oyunun cue'larını
  açmasın. Verilmezse kimlik kontrolü atlanır (eski istemci kırılmaz).
- `resync=true` isteğinde cue gitmez. Alan gönderilmezse davranış eski hâliyle
  aynıdır (cue yok).
- `cueId` deterministiktir (`gameId:revision:index`), bu yüzden hamleyi yapan
  oyuncu cue'ları hem komut yanıtından hem görünümden alsa bile sahne aynı
  `cueId`yi bir kez oynatır.

## 8. Varlık ve yükleme sınırı

- Sahne paketinin tek dışa açık girişi ve gerekli tipleri vardır; uygulama `objects/` iç yollarına bağımlı olmaz.
- Codex varlıkları `packages/scene/public/` altında sahiplenir. Claude C00'da geliştirme/yayın sırasında bu dizinin nasıl servis edileceğini yapılandırır ve README'ye yazar.
- Varlık URL'leri dağıtımın taban yoluna uyumlu çözülür; rastgele mutlak `/assets/...` varsayımı yapılmaz.
- Eksik varlık veya WebGL hatası uygulamanın anlaşılır hata sınırına ulaşır. Sonsuz yükleme ekranı olmaz.
- 3D paket yüklenmeden lobi temel kontrolleri kullanılabilir; büyük varlıklar oyun masasına girişte yüklenebilir.

## 9.5. Lobi anlık görünümü — `LobbySnapshot` (C04, additive)

Sürüm `0.2.0` korunur; bu **yeni** bir tiptir, mevcut alan değişmedi (kırıcı değil).
Kaynak: `packages/contracts/src/lobby.ts`. Sahne bu tipi kullanmaz.

Gerekçe: oyun durumu yokken `getView` `STALE_ACTION` verir. Lobi ekranı (isim listesi,
koltuklar, hazır durumu, davet kodu) tamamen HTML uygulama katmanındadır (§ 4); sahneye
`phase === 'lobby'` görünümü gönderilmez. HTTP eylemi: `lobby_view` (gövde `{ roomId }`).

| Alan | İçerik |
| --- | --- |
| `roomId`, `inviteCode` | Oda kimliği + paylaşılabilir davet kodu (kimlik sırrı değil) |
| `status` | `lobby` \| `in_game` \| `ended`; `in_game` → istemci `view`'e geçer |
| `localPlayerId`, `isHost` | İsteği yapan oyuncunun opak kimliği + oda sahibi mi |
| `members[]` | Sabit koltuk sırasıyla: `playerId`, `seatIndex`, `displayName`, `connected`, `ready`, `isHost`, `isLocal`, `avatar` (D3.4) |
| `minPlayers`, `maxPlayers` | 5 / 10 |
| `canStart` | Host + sayı aralıkta + **tüm aktif üyeler hazır**. Sunucu ayrıca doğrular. |

Gizlilik: lobide gizli rol/kart yoktur; `userId` (auth kimliği) yanıta girmez.
Sunucu `start_game`'i de tüm üyeler hazır değilken `NOT_ALLOWED` ile reddeder (ikinci savunma).

## 9.6. `dev_scenario` lobi komutu — D14 (additive, YALNIZ GELİŞTİRME)

Sözleşme revizyonu `0.2.0` korunur (`CONTRACT_VERSION` değişmedi); `LobbyCommand`
birliğine **yeni** bir dal eklendi, mevcut hiçbir alan değişmedi — kırıcı değil.
npm paket sürümü `@secret-table/contracts` 0.2.1 (additive yama).

```ts
{ protocolVersion, commandId, type: 'dev_scenario', scenario: 'execution_now' | 'execution_round' }
```

- Amaç: geç aşamaları (D12 infaz sahnesi) oyunu baştan oynamadan denemek.
- **Güvenlik kapısı:** sunucu bu komutu yalnız `SECRET_TABLE_DEV_TOOLS === '1'`
  iken uygular. Değişken yoksa yanıt bilinmeyen/izinsiz komutla aynıdır
  (`NOT_ALLOWED`), yani üretimde varlığı ayırt edilemez. Vercel'de bu değişken
  ASLA ayarlanmaz (docs/DEPLOYMENT.md).
- Etki: `packages/game-core/src/devScenario.ts` saf işlevi faz, faşist sayaç,
  seçim sayacı, başkanlık ofisi ve deste SIRASINI değiştirir. Roller, gizli
  eller ve deste İÇERİĞİ (6 liberal + 11 faşist) korunur; kart yaratılmaz.
- Kayıt yolu normal işlemsel/idempotent `commitMove` yoludur: `revision` artar,
  Realtime sürüm sinyali gider, tekrar gönderilen aynı `commandId` ikinci kez
  uygulanmaz.

## 9.7. `set_avatar` lobi komutu — D3.4 / B3 (additive)

Sözleşme revizyonu `0.2.0` korunur (`CONTRACT_VERSION` değişmedi); `LobbyCommand`
birliğine **yeni** bir dal, `PlayerView` ve `LobbyMember`'a **yeni** bir alan
eklendi. Mevcut hiçbir alan değişmedi — kırıcı değil. npm paket sürümü
`@secret-table/contracts` **0.2.3** (additive yama).

```ts
{ protocolVersion, commandId, type: 'set_avatar', character: AvatarCharacterId, skin: AvatarSkinId }
```

- **Yalnız lobide.** Oda `in_game`/`ended` ise `NOT_ALLOWED`; bilinmeyen kimlik
  `INVALID_OPTION` (şema zaten reddeder, sunucu ikinci savunma yapar).
- **Idempotent.** Aynı seçim ikinci kez yazılınca sonuç aynıdır. Oyun durumu
  değişmediği için `commitMove`/`revision` yolu kullanılmaz; yayılım `set_ready`
  ile aynıdır (komuttan sonra `lobby_view` tazelenir + 3 s lobi yoklaması).
  **Sapma:** lobi değişiklikleri için Realtime sürüm sinyali YOKTUR (mevcut
  `set_ready` davranışı; `revision` yalnız `game_states` tablosunda yaşar).
- **Benzersizlik yok.** Aynı odada iki oyuncu aynı karakter+teni seçebilir
  (`docs/design/D3-characters-plan.md` §3). Sunucu yalnız ÖNERİR:
  - seçim yapmamış koltuğun varsayılan karakteri odada zaten kullanılıyorsa
    varsayılan TEN farklıya kayar (`resolveAvatars` + `suggestSkin`);
  - kullanıcının açık seçimi ASLA değiştirilmez.
  İstemci de kart değiştirirken aynı `suggestSkin` yardımcısıyla farklı ten
  önerir; kullanıcı yine aynı teni seçebilir.
- **Kalıcılık:** `room_members.avatar_character` / `avatar_skin`
  (`supabase/migrations/0008_avatar.sql`, nullable + CHECK). NULL = seçilmedi.
  Migration uygulanmadan `set_avatar` Supabase kipinde HATA verir (sessizce
  başarılı görünmez); okuma yolu ise varsayılana düşer.

## 9. C01 devir kontrolü — tamamlandı (2026-09-09)

- [x] Sözleşme tipleri derleniyor ve uygulama/scene aynı paketten alıyor (`@secret-table/contracts`).
- [x] 5–10 masa, oy sonucu, özel el, yetki, veto, bağlantı kesilmesi ve oyun sonu örnekleri mevcut (`@secret-table/fixtures`, 25 senaryo).
- [x] Örnekler sadece uydurma veri kullanıyor; hiçbir gerçek oturum/rol kaydı yok.
- [x] `TableScene` taslağının sahipliği Codex'e devredildi; Codex X01/X02'yi teslim etti.
- [x] `/dev/scene` çalışıyor; üretimde geliştirme girişleri kapalı (`import.meta.env.DEV` ile ağaç sarsımı).
- [x] Codex (CODEX-004) ve Claude aynı sözleşme sürümünü (`0.2.0`) kabul etti.
- [x] Fark yok; sürüm sabitlendi.
