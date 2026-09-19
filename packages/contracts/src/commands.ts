/**
 * Ağ komutu ve görünüm gönderimi tipleri.
 * Sürüm 0.2.0 (sabit). Kaynak: docs/CONTRACT.md bölüm 6, docs/DEPLOYMENT.md bölüm 3.
 *
 * Kesin HTTP başlıkları, kimlik zarfı ve atomik kayıt protokolü C03'te sabitlenir.
 * Burada istemci ile Vercel Functions arasındaki mesaj gövdeleri tanımlanır.
 */

import type { ProtocolVersion, Revision, RoomId } from './ids';
import type { AvatarCharacterId, AvatarSkinId } from './avatars';
import type { LobbyStatus } from './lobby';
import type { SceneCue, SceneView } from './scene';

/** Minimum hamle zarfı. Oyuncu kimliği istekten değil, doğrulanmış oturumdan türetilir. */
export type GameCommand = {
  protocolVersion: ProtocolVersion;
  gameId: string;
  phaseId: string;
  /** Tekrarlanan istek aynı etkiyi ikinci kez oluşturmaz (kalıcı komut kaydı). */
  commandId: string;
  actionId: string;
  optionId?: string;
};

/**
 * YALNIZ GELİŞTİRME senaryo atlaması (D14, D19'da genişletildi). Sunucu bunu
 * **yalnız** `SECRET_TABLE_DEV_TOOLS=1` iken kabul eder; aksi hâlde
 * bilinmeyen/izinsiz komutla aynı `NOT_ALLOWED` yanıtını verir. Üretimde
 * (Vercel) bu değişken ASLA ayarlanmaz — bkz. docs/DEPLOYMENT.md.
 *
 * Bir senaryo o tahta düzeninde anlamsızsa (ör. `policy_peek` yalnız 5-6
 * kişide, `investigate_loyalty` yalnız 7+ kişide vardır) motor
 * `SCENARIO_NEEDS_PLAYERS` ile reddeder → ağ yanıtı `INVALID_OPTION`.
 */
export const DEV_SCENARIO_NAMES = [
  'execution_now',
  'execution_round',
  'investigate_now',
  'special_election_now',
  'policy_peek_now',
  'veto_round',
  'veto_round_president',
  'hitler_zone_round',
  'chaos_round',
] as const;
export type DevScenarioName = (typeof DEV_SCENARIO_NAMES)[number];

/** Lobi kontrolleri de aynı sunucu doğrulamasından geçer (uygulama katmanı). */
export type LobbyCommand =
  | { protocolVersion: ProtocolVersion; commandId: string; type: 'set_ready'; ready: boolean }
  | { protocolVersion: ProtocolVersion; commandId: string; type: 'start_game' }
  | { protocolVersion: ProtocolVersion; commandId: string; type: 'cancel_game' }
  | { protocolVersion: ProtocolVersion; commandId: string; type: 'play_again' }
  /**
   * D3.4 / B3 — karakter seçimi. **Yalnız lobide** kabul edilir; oyun
   * başladıktan sonra `NOT_ALLOWED`. Aynı `character`+`skin` ikinci kez
   * gönderilirse etkisi değişmez (idempotent). Aynı odada iki oyuncu aynı
   * karakteri seçebilir; sunucu yalnız farklı ten ÖNERİR, zorlamaz.
   */
  | {
      protocolVersion: ProtocolVersion;
      commandId: string;
      type: 'set_avatar';
      character: AvatarCharacterId;
      skin: AvatarSkinId;
    }
  | {
      protocolVersion: ProtocolVersion;
      commandId: string;
      type: 'dev_scenario';
      scenario: DevScenarioName;
    };

/** Önerilen hata kodları (docs/CONTRACT.md bölüm 6). Yanıt gizli durum dökümü içermez. */
export type CommandErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_ALREADY_STARTED'
  | 'SESSION_INVALID'
  | 'RECONNECT_EXPIRED'
  | 'STALE_ACTION'
  | 'NOT_ALLOWED'
  | 'INVALID_OPTION'
  | 'RATE_LIMITED'
  | 'VERSION_MISMATCH'
  | 'RETRYABLE_CONFLICT'
  | 'SERVICE_UNAVAILABLE';

/**
 * Komut yanıtı: kabul/ret, `commandId`, ilgili görünüm sürümü ve gönderenin
 * yetkili görünümü. Diğer oyuncular sürüm sinyalinden sonra kendi görünümlerini alır.
 */
export type CommandResponse =
  | {
      ok: true;
      commandId: string;
      revision: Revision;
      view: SceneView;
      cues: readonly SceneCue[];
    }
  | {
      ok: false;
      commandId: string;
      error: CommandErrorCode;
      /** İstemci aynı `commandId` ile güvenle tekrar deneyebilir mi? */
      retryable: boolean;
      /** Türkçe kullanıcı metnine çözülen anahtar. */
      messageKey: string;
    };

/**
 * `player_view` HTTP istek gövdesi (D18 — additive; D21'de `sinceGameId`).
 *
 * `sinceRevision` istemcinin ELİNDE olan son sürümdür. Sunucu kayıtlı durum bu
 * sürümün İLERİSİNDEyse (`sinceRevision < revision`) son komutun olaylarını
 * alıcıya göre süzüp cue'ya çevirir; `resync` istendiğinde cue listesi boştur.
 * Alan verilmezse davranış eskisi gibidir (cue yok) — eski istemciler kırılmaz.
 *
 * D21/C — eski koşul `revision === sinceRevision + 1` idi: iki sürüm atlandığında
 * (ör. yarışan iki yoklama ya da iki hızlı hamle) EN YENİ sürümün cue'ları da
 * düşüyordu ve kart/infaz koreografisi hiç oynamıyordu. Sahne yalnız güncel
 * sürümün cue'larını oynattığı için ileri sürümde cue vermek güvenlidir; atlanan
 * ARA sürümlerin olayları hiç saklanmadığı için geçmiş yeniden oynatılmaz.
 *
 * `sinceGameId` istemcinin elindeki görünümün oyun kimliğidir: "Yeniden oyna"
 * sonrası sürüm sayacı devam ettiği için eski oyunun sürümüyle yeni oyunun
 * cue'ları eşleşmesin diye gönderilir. Verilmezse kimlik kontrolü atlanır.
 */
export type PlayerViewRequest = {
  roomId: RoomId;
  resync?: boolean;
  sinceRevision?: Revision;
  sinceGameId?: string;
};

/**
 * `player_view` HTTP yanıtı. Her alıcı tek yanıtla tutarlı görünüm alır;
 * ortak/özel parçalar ayrı zamanlarda birleştirilmez. `Cache-Control: private, no-store`.
 */
export type PlayerViewResponse = {
  view: SceneView;
  cues: readonly SceneCue[];
  /** Yeniden bağlanmada `true`: eski animasyon kuyruğu temizlenir. */
  resync: boolean;
  /**
   * D21/A — **additive** oda durumu. Oyun bitip host "Lobiye dön" dediğinde
   * (`cancel_game`) oyun durumu satırı silinmez: `view` yine geçerli bir oyun
   * görünümü döndürür ve istemci oyun-sonu ekranında takılı kalırdı. Bu alan
   * `'lobby'` olduğunda istemci lobi yoluna döner. Eski istemci alanı yok sayar;
   * eski sunucu alanı göndermez (istemci `undefined`'ı "bilinmiyor" sayar).
   */
  roomStatus?: LobbyStatus;
};

/**
 * Supabase Realtime kanalının taşıdığı tek sinyal. Tam durum, rol, kart, oy veya
 * oturum anahtarı kanala gönderilmez. İstemci bu sinyalden sonra görünümünü tekrar alır.
 */
export type RoomRevisionSignal = {
  roomId: RoomId;
  revision: Revision;
};

/** Oda oluşturma / katılma istek gövdeleri (kesin alanlar C03). */
export type CreateRoomRequest = {
  protocolVersion: ProtocolVersion;
  displayName: string;
};

export type JoinRoomRequest = {
  protocolVersion: ProtocolVersion;
  inviteCode: string;
  displayName: string;
};
