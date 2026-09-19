/**
 * Oyun uygulaması -> 3D sahne sözleşmesi.
 * Sürüm 0.2.0 (sabit). Kaynak: docs/CONTRACT.md bölüm 1, 3, 5, 7.
 *
 * Bu dosya kesin alan adlarının kaynağıdır; Markdown davranış ve gizlilik
 * gerekçesini açıklar. İkisi tutarlı güncellenir (COORDINATION.md bölüm 5).
 *
 * Kural: burada `any`, keyfi JSON veya "tüm motor durumu" tipi kullanılmaz.
 * Alanlar dar tiplerle ve discriminated union'larla modellenir.
 */

import type {
  ActionId,
  CardId,
  CueId,
  ElectionId,
  GameId,
  OptionId,
  PhaseId,
  PlayerId,
  ProtocolVersion,
  Revision,
  RoomId,
} from './ids';
import type { EmoteSignal, HeadViewpoint, LocalViewpoint } from './viewpoint';
import type { AvatarSelection } from './avatars';

// ---------------------------------------------------------------------------
// Ortak en'ler
// ---------------------------------------------------------------------------

/** Başlangıç oyuncu sayısı; oyun başladıktan sonra sabittir. */
export type PlayerCount = 5 | 6 | 7 | 8 | 9 | 10;

/** Masa yerleşimi ve tahta kurulumu başlangıç oyuncu sayısına bağlıdır. */
export type BoardVariant = 'small' | 'medium' | 'large';

/** Etkileşim penceresinin türü. Aşama adı tekrarlansa da `phaseId` tekildir. */
export type ScenePhase =
  | 'lobby'
  | 'role_reveal'
  | 'nomination'
  | 'voting'
  | 'election_result'
  | 'president_discard'
  | 'chancellor_choice'
  | 'veto_response'
  | 'policy_result'
  | 'executive_action'
  | 'game_over';

/** İstemci adaptörünün eklediği bağlantı durumu (sunucu görünümünün parçası değil). */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

/** Politika kartı türü. Gizli el dışında yalnız açıklanmış kartlarda görünür. */
export type PolicyType = 'liberal' | 'fascist';

/** Bir oyuncunun kendi gördüğü gizli rolü. */
export type SecretRole = 'liberal' | 'fascist' | 'hitler';

/** Parti bilgisi kesin rol bilgisinden ayrıdır (Hitler partisi `fascist` görünür). */
export type Party = 'liberal' | 'fascist';

/** Oy değeri. Kullanıcı metinleri Türkçedir; protokol değeri dile bağlı değildir. */
export type VoteValue = 'yes' | 'no';

/** Seçilmiş görev. Adaylık ayrı alandır (isPresidentialCandidate / isChancellorCandidate). */
export type Office = 'none' | 'president' | 'chancellor';

/** Herkesçe bilinebilen yürütme yetkisi türleri. Özel inceleme sonucu buraya girmez. */
export type ExecutivePower =
  | 'investigate_loyalty'
  | 'call_special_election'
  | 'policy_peek'
  | 'execution';

/** Bir seçimin sonucu. */
export type ElectionOutcome = 'elected' | 'rejected';

/** Oyunun bitiş nedeni. */
export type GameEndReason =
  | 'liberal_policies_enacted'
  | 'fascist_policies_enacted'
  | 'hitler_elected_chancellor'
  | 'hitler_executed';

// ---------------------------------------------------------------------------
// Duraklama
// ---------------------------------------------------------------------------

/**
 * `paused` ile `connection` farklıdır: benim bağlantım açıkken başka oyuncu
 * nedeniyle oyun durmuş olabilir. Oyun aşamasını silmez.
 */
export type PauseState = {
  reason: 'player_offline' | 'host_review' | 'service_unavailable';
  waitingForPlayerIds: readonly PlayerId[];
};

// ---------------------------------------------------------------------------
// PlayerView — herkese açık
// ---------------------------------------------------------------------------

/**
 * Sabit koltuk sırasıyla verilir. Oyun sürerken rol, parti, el veya geri dönüş
 * anahtarı bu nesnede bulunmaz; rolü ima eden avatar/renk atanmaz.
 */
export type PlayerView = {
  playerId: PlayerId;
  seatIndex: number;
  /** İsim veri olarak çizilir; HTML veya varlık URL'si olarak yorumlanmaz. */
  displayName: string;
  connected: boolean;
  ready: boolean;
  alive: boolean;
  isHost: boolean;
  office: Office;
  isPresidentialCandidate: boolean;
  isChancellorCandidate: boolean;
  /** Yalnız oy gönderildiğini gösterir; oy tercihi içermez. */
  hasVoted: boolean;
  /**
   * D3.4 / B3 — oyuncunun görünen karakteri + ten tonu. **Her zaman doludur:**
   * oyuncu lobide seçim yapmadıysa sunucu koltuk sırasından türetilen
   * varsayılanı (`avatarForSeat`) verir. Rol ima etmez; gizli veri değildir.
   */
  avatar: AvatarSelection;
};

// ---------------------------------------------------------------------------
// PublicTableView — herkese açık
// ---------------------------------------------------------------------------

/** Tahtaya yerleşmiş bir politika. Gelecekteki deste bilgisi taşımaz. */
export type EnactedPolicy = {
  board: 'liberal' | 'fascist';
  slotIndex: number;
  policy: PolicyType;
};

/** Açıklanmış bir oy (yalnızca sonuç aşamasında herkese açık olur). */
export type PublicVote = {
  playerId: PlayerId;
  vote: VoteValue;
};

/** En son açıklanmış seçim. Devam eden seçimin gizli oyları buraya eklenmez. */
export type PublicElection = {
  electionId: ElectionId;
  presidentId: PlayerId;
  chancellorId: PlayerId;
  outcome: ElectionOutcome;
  votes: readonly PublicVote[];
};

/** Herkesçe bilinebilen yetki türü ve kullanan oyuncu; özel inceleme sonucu yok. */
export type CurrentPower = {
  power: ExecutivePower;
  actorId: PlayerId;
  /** Hedef seçilmeden önce `null`. Hedefi olmayan yetkilerde de `null`. */
  targetId: PlayerId | null;
};

/** Kısa, filtrelenmiş genel geçmiş olayı. Gizli kart seçimi / inceleme sonucu kaydedilmez. */
export type PublicHistoryEntry =
  | { entryId: string; kind: 'game_started'; playerCount: PlayerCount }
  | { entryId: string; kind: 'nomination'; presidentId: PlayerId; chancellorId: PlayerId }
  | { entryId: string; kind: 'election'; electionId: ElectionId; outcome: ElectionOutcome }
  | { entryId: string; kind: 'policy_enacted'; board: 'liberal' | 'fascist'; policy: PolicyType }
  | { entryId: string; kind: 'election_tracker'; tracker: number }
  | { entryId: string; kind: 'chaos_policy'; policy: PolicyType }
  | { entryId: string; kind: 'power_used'; power: ExecutivePower; actorId: PlayerId; targetId: PlayerId | null }
  | { entryId: string; kind: 'player_executed'; targetId: PlayerId };

export type PublicTableView = {
  liberalPolicies: number;
  fascistPolicies: number;
  electionTracker: number;
  drawCount: number;
  discardCount: number;
  enactedPolicies: readonly EnactedPolicy[];
  lastElection: PublicElection | null;
  currentPower: CurrentPower | null;
  publicHistory: readonly PublicHistoryEntry[];
};

// ---------------------------------------------------------------------------
// PrivateView — yalnızca bu oyuncu
// ---------------------------------------------------------------------------

/** Bir bilginin nasıl öğrenildiği. Parti bilgisi ile kesin rol bilgisi ayrıdır. */
export type KnowledgeSource =
  | 'fascists_know_each_other'
  | 'hitler_knows_fascists'
  | 'investigate_loyalty';

export type PlayerKnowledge =
  | { kind: 'party'; party: Party }
  | { kind: 'role'; role: SecretRole };

/** Başlangıç kuralı veya özel inceleme nedeniyle izin verilen kişi bilgisi. */
export type KnownPlayer = {
  playerId: PlayerId;
  knowledge: PlayerKnowledge;
  source: KnowledgeSource;
};

/** Sadece bu aşamada yetkili olunan bir el kartı. */
export type HandCard = {
  cardId: CardId;
  policy: PolicyType;
};

/** Özel inceleme / deste bakma sonucu. Doğru alıcı dışında oluşturulmaz. */
export type Inspection =
  | { kind: 'party_membership'; targetId: PlayerId; party: Party }
  | { kind: 'policy_peek'; upcoming: readonly PolicyType[] };

export type PrivateView = {
  /** Bu oyuncunun kendi rolü; dağıtımdan önce `null`. */
  role: SecretRole | null;
  knownPlayers: readonly KnownPlayer[];
  /** Sadece bu aşamada yetkili olunan kartlar; yeni aşamada kaldırılır. */
  hand: readonly HandCard[];
  /** Oyuncunun kendi gönderdiği oy; yoksa `null`. */
  submittedVote: VoteValue | null;
  inspection: Inspection | null;
};

// ---------------------------------------------------------------------------
// Yapılabilir eylemler
// ---------------------------------------------------------------------------

/** Başlangıç aksiyon türleri (docs/CONTRACT.md bölüm 4). */
export type ActionKind =
  | 'ack_role'
  | 'nominate'
  | 'vote'
  | 'discard_policy'
  | 'enact_policy'
  | 'request_veto'
  | 'respond_veto'
  | 'use_power'
  | 'ack_private_result';

/** Tüm seçenekler mevcut oyuncunun görmesine izin verilen verilerdir. */
export type ActionOption = {
  optionId: OptionId;
  /** Türkçe metin sözlüğüne çözülen anahtar (C04'te belgelenir). */
  labelKey: string;
  targetPlayerId?: PlayerId;
  cardId?: CardId;
  vote?: VoteValue;
};

/**
 * `actions` bir güvenlik garantisi değildir; sunucu yine tüm yetki ve aşama
 * kontrollerini yapar. Oyuncu `actions` içinde yoksa sahne onu hedef yapmaz.
 */
export type AllowedAction = {
  actionId: ActionId;
  kind: ActionKind;
  phaseId: PhaseId;
  options: readonly ActionOption[];
  requiresConfirmation: boolean;
};

// ---------------------------------------------------------------------------
// Oyun sonucu
// ---------------------------------------------------------------------------

export type RevealedRole = {
  playerId: PlayerId;
  role: SecretRole;
};

/** Oyun sürerken `null`; bittiğinde kazanan, neden ve açıklanabilen roller. */
export type GameResult = {
  winner: Party;
  reason: GameEndReason;
  revealedRoles: readonly RevealedRole[];
};

// ---------------------------------------------------------------------------
// SceneView
// ---------------------------------------------------------------------------

/**
 * Sunucunun izin verdiği bilgilerden oluşturulmuş son yetkili görünüm.
 * Her görünüm `gameId`, `revision` ve `phaseId` taşır; eski görünüm uygulanmaz.
 */
export type SceneView = {
  protocolVersion: ProtocolVersion;
  roomId: RoomId;
  /** Lobide `null`. */
  gameId: GameId | null;
  revision: Revision;
  phaseId: PhaseId;
  phase: ScenePhase;
  /** İstemci adaptörü ekler; ham sunucu görünümünde bulunmayabilir. */
  connection: ConnectionStatus;
  /** `null` veya başka oyuncular nedeniyle duraklama. */
  paused: PauseState | null;
  /** Lobide `null`; oyunda sabit 5-10 sayısı. */
  playerCountAtStart: PlayerCount | null;
  boardVariant: BoardVariant;
  localPlayerId: PlayerId;
  /** Sabit koltuk sırası. */
  players: readonly PlayerView[];
  table: PublicTableView;
  /** Yalnızca mevcut oyuncuya izin verilen özel görünüm. */
  privateView: PrivateView;
  actions: readonly AllowedAction[];
  result: GameResult | null;
};

// ---------------------------------------------------------------------------
// Görsel olaylar (SceneCue)
// ---------------------------------------------------------------------------

/**
 * Yetkilendirilmiş dar payload. Sahne aynı `cueId`yi tekrar oynatmaz.
 * SceneCue'lar Realtime kanalına konmaz; yalnız izinli HTTP yanıtının parçasıdır.
 */
export type SceneCuePayload =
  | { kind: 'cards_dealt'; toPlayerId: PlayerId; cards: readonly HandCard[] }
  | {
      kind: 'cards_moved';
      count: number;
      from: 'deck' | 'president' | 'chancellor';
      to: 'president' | 'chancellor' | 'discard';
    }
  | { kind: 'votes_revealed'; electionId: ElectionId; outcome: ElectionOutcome; votes: readonly PublicVote[] }
  | { kind: 'policy_enacted'; board: 'liberal' | 'fascist'; slotIndex: number; policy: PolicyType }
  | { kind: 'office_moved'; office: 'president' | 'chancellor'; toPlayerId: PlayerId }
  | { kind: 'player_eliminated'; playerId: PlayerId }
  | { kind: 'game_ended'; winner: Party; reason: GameEndReason };

export type SceneCue = SceneCuePayload & {
  cueId: CueId;
  gameId: GameId;
  revision: Revision;
  /** İsteğe bağlı sunucu zamanı (epoch ms). */
  serverTime?: number;
};

// ---------------------------------------------------------------------------
// SceneIntent ve yerel seçim
// ---------------------------------------------------------------------------

/** Sahnedeki tıklama/incelenme isteğini uygulamaya bildirir. Oyun kuralı çalıştırmaz. */
export type SceneIntent =
  | { type: 'select_option'; actionId: ActionId; optionId: OptionId }
  | { type: 'clear_selection' }
  /**
   * Özel bilgi panelini aç/kapat isteği. `open` verilmezse **açma** isteği
   * sayılır (yönsüz eski/bağımsız sahne her zaman açmak ister — CODEX-012);
   * `!current` toggle tahminine dönüştürülmez. `open` verilirse yön kesindir:
   * sahnedeki "Kimliği kapat" HTML panelini yeniden AÇMAZ (QA-R02).
   */
  | { type: 'inspect_own_role'; open?: boolean }
  | { type: 'inspect_card'; cardId: CardId }
  | { type: 'focus_player'; playerId: PlayerId }
  /**
   * Genel masa / koltuk kamerası arasında geçiş isteği (FINISH_PLAN §2A, `V`
   * tuşu). Oyun kuralı çalıştırmaz; sahne kamera durumunun sahibidir. Additive/
   * opsiyonel — tüketmeyen sahnede sessizce yok sayılır.
   */
  | { type: 'set_camera'; target: 'overview' | 'seat' };

/** Uygulamanın tuttuğu yerel, henüz kesinleştirilmemiş seçim. */
export type SceneSelection = {
  actionId: ActionId;
  optionId: OptionId;
};

// ---------------------------------------------------------------------------
// TableScene props (paket sınırı)
// ---------------------------------------------------------------------------

export type SceneQuality = 'low' | 'standard';

/**
 * Sahnenin uygulamaya verdiği zorunlu (imperative) denetleyici (CODEX-014/015).
 * Uygulama E / 1–3 / oklar / Pointer Lock deltasını bu TEK arayüzden yürütür;
 * sahne kendi ikinci global keydown/komut dinleyicisini KURMAZ (FINISH_PLAN §2A).
 * Hiçbir yöntem `onIntent` / ağ komutu göndermez — yalnız opak yetkili kimlik
 * döndürür veya yerel kamera/odağı sürer.
 */
export type SceneController = {
  /** Pointer Lock göreli piksel deltası; hassasiyet + sınır + kamera sahnede. */
  lookBy: (dx: number, dy: number) => void;
  /** Yalnız yerel inceleme odağını kaydırır; seçim/gönderim yok. */
  inspectBy: (step: -1 | 1) => void;
  /** 0 tabanlı, soldan sağa yuva. Yetkili opak kimlik döner; kendisi göndermez. */
  selectSlot: (index: number) => SceneSelection | null;
  /** Nişangâhın o an üstünde olduğu hedef; kendisi göndermez. */
  target: () => SceneSelection | null;
  /** Bakışı koltuk nötrüne getirir. */
  resetLook: () => void;
};

/** Sahnenin bildirdiği, ekrandaki seçilebilir yuva sırası (HUD + klavye eşlemesi). */
export type SceneTargets = {
  /**
   * Ekranda soldan sağa yuva sırası. Bir yuvanın yetkisi yoksa `null` kalır;
   * numaralar sola kaydırılmaz (CODEX-014). Görünmeyen/izinsiz seçenek dönmez.
   */
  slots: readonly (SceneSelection | null)[];
  /** Nişangâhın üstündeki hedef (varsa). */
  hovered: SceneSelection | null;
  /** `inspectBy` ile gezilen yerel inceleme odağı dizini. */
  inspectedIndex: number;
};

/**
 * İlk-şahıs / koltuk kamerası bağlantısı (FINISH_PLAN §2, §4). Tümü
 * additive/opsiyonel; verilmezse sahne mevcut inceleme kamerası davranışını korur.
 * Uygulama Fullscreen + Pointer Lock yaşam döngüsünü ve tuş yönetimini üstlenir
 * (Claude); sahne göreli fare deltasını sınırlı yaw/pitch kameraya bağlar, kart
 * yuvalarını ve nişangâhı çizer (Codex).
 */
export type ImmersiveSceneProps = {
  /**
   * @deprecated Tek bayrak (kilit + koltuk birleşik). Geri uyum fallback; açık
   * `pointerLocked` + `cameraMode` verildiğinde onlar önceliklidir.
   */
  active: boolean;
  /**
   * Genel masa / koltuk kamerası. Verilmezse: `active` → `'seat'`, değilse
   * `'overview'`. `V` tuşu bunu uygulama tarafında değiştirir.
   */
  cameraMode?: 'overview' | 'seat';
  /** Pointer Lock etkin mi — göreli fare deltası `controller.lookBy`'a akıyor. */
  pointerLocked?: boolean;
  /** Fare bakış hassasiyeti çarpanı (varsayılan 1). */
  sensitivity?: number;
  /** Özel inceleme paneli açık — kamera/hareket buna göre. */
  inspectOpen?: boolean;
  /** Oyun duraklatıldı / bağlantı yok — kamera sallanmadan dursun. */
  suspended?: boolean;
  /**
   * Uzak oyuncuların doğrulanmış baş yönleri. Sahne `playerId`→koltuk eşler,
   * sınırlı yaw/pitch arasında yumuşatır; kendi `view.localPlayerId`sini yok
   * sayar. Kapalı/bayat/kopuk yön nötr poza döner.
   */
  peers: readonly HeadViewpoint[];
  /**
   * Sahne yerel koltuk bakışını (yaw/pitch) bildirir; uygulama eşik + hız
   * sınırıyla ağa verir (docs/CONTRACT.md §4, §5A). Özel inceleme kamerası
   * buradan GÖNDERİLMEZ.
   */
  onLocalViewpoint?: (viewpoint: LocalViewpoint) => void;
  /** Sahne mount/unmount'ta denetleyiciyi kaydeder (`null` ile geri alır). */
  onController?: (controller: SceneController | null) => void;
  /** Sahne, ekrandaki seçilebilir yuva sırasını bildirir (HUD tek kaynak). */
  onTargetsChange?: (targets: SceneTargets) => void;
  /**
   * D16 — YEREL oyuncunun kendi el jesti (ilk şahıs katmanı + `clap` sesi).
   * Uzak oyuncuların jesti `peers[].emote` ile gelir. `null`/verilmemiş = jest
   * yok. Additive/opsiyonel; sunucu ve DB bu alanı görmez.
   */
  emote?: EmoteSignal | null;
  /**
   * Tek düğmeden birlikte Fullscreen+Lock reddedilince uygulama açık bir
   * "Bakışı etkinleştir" kontrolü gösterir; sahne için opsiyonel bilgi.
   */
  needsResume?: boolean;
};

/**
 * Sahne paketinin dışa açtığı tek bileşenin props'u.
 * Canvas, kamera, ışık, nesne ve animasyonlar Codex'e; dış kapsayıcı, yükleme/
 * hata sınırı, HTML paneller ve onay düğmeleri Claude'a aittir.
 * Props salt okunur kabul edilir.
 */
export type TableSceneProps = {
  view: SceneView;
  cues: readonly SceneCue[];
  selection: SceneSelection | null;
  onIntent: (intent: SceneIntent) => void;
  quality: SceneQuality;
  reducedMotion: boolean;
  soundEnabled: boolean;
  /**
   * Uygulamanın tuttuğu özel bilgi paneli açık/kapalı durumu (tek kaynak). Sahne
   * bunu verildiğinde kendi iç durumu yerine kullanmalı; `undefined` ise mevcut
   * iç davranış korunur (prototip / bağımsız kullanım). QA-R02.
   */
  rolePanelOpen?: boolean;
  /**
   * Açık reset nesli (FINISH_PLAN §3). Normal boş `cues` kuyruğu kabul edilmiş
   * yerel hareketi KESMEZ; bu sayaç arttığında (resync / `gameId` değişimi /
   * yeniden bağlanma / yeniden mount) sahne kabul ettiği yerel hareketi hemen
   * bırakır. `undefined` → sahne mevcut davranışını korur. Additive/opsiyonel.
   */
  resetEpoch?: number;
  /**
   * İlk-şahıs / koltuk kamerası bağlantısı. Verilmezse sahne mevcut inceleme
   * kamerası davranışını korur. Additive/opsiyonel (FINISH_PLAN §2, §4).
   */
  immersive?: ImmersiveSceneProps;
};
