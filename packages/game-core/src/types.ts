/**
 * Saf oyun motoru iç durumu. Bu tipler sunucuya açıktır; istemciye HİÇBİR
 * kanaldan gönderilmez. İstemci görünümü `@secret-table/server` projeksiyonuyla
 * gizli alanlar çıkarılarak üretilir.
 *
 * `applyCommand` girdi durumunu değiştirmez: her çağrı `structuredClone` ile
 * kopya alıp onu döndürür. Alanlar bu yüzden düz (mutable) tiptedir.
 */

import type {
  BoardLayout,
  BoardVariant,
  ExecutivePower,
  GameEndReason,
  Party,
  PlayerCount,
  PolicyType,
  RoleSetup,
  SecretRole,
  VoteValue,
} from '@secret-table/contracts';

/** `Omit` birleşim tipleri üzerinde dağılmaz; log girdileri için dağıtıcı sürüm. */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export type PolicyCard = PolicyType;

/** Ele/masaya dağıtılan bir kart. `cardId` yalnız o aşamada geçerlidir. */
export type DealtCard = {
  cardId: string;
  policy: PolicyCard;
};

export type EnginePlayer = {
  playerId: string;
  /** Sabit koltuk sırası; elenme veya bağlantı kesilmesi değiştirmez. */
  seatIndex: number;
  role: SecretRole;
  alive: boolean;
};

export type Government = {
  presidentId: string;
  chancellorId: string;
};

/** Başkanın kullandığı yetkinin özel sonucu; yalnız başkana gider. */
export type InspectionResult =
  | { kind: 'party_membership'; targetId: string; party: Party }
  | { kind: 'policy_peek'; cards: PolicyCard[] };

/** Motor aşaması. `phaseSeq` her geçişte artar ve `phaseId` bundan türetilir. */
export type EnginePhase =
  | { kind: 'role_reveal'; ackedPlayerIds: string[] }
  | { kind: 'nomination'; presidentId: string }
  | { kind: 'voting'; presidentId: string; chancellorId: string; votes: Record<string, VoteValue> }
  | { kind: 'legislative_president'; government: Government; drawnCards: DealtCard[] }
  | {
      kind: 'legislative_chancellor';
      government: Government;
      handCards: DealtCard[];
      vetoRequested: boolean;
    }
  | { kind: 'veto_response'; government: Government; handCards: DealtCard[] }
  | {
      kind: 'executive_action';
      government: Government;
      power: ExecutivePower;
      /** Yetki kullanılıp sonuç üretildiyse dolu; başkanın onayı bekleniyor. */
      inspection: InspectionResult | null;
      /** Yetki bir hedef seçtiyse (special election / execution) burada tutulur. */
      targetId: string | null;
      resolved: boolean;
    }
  | { kind: 'game_over'; winner: Party; reason: GameEndReason };

export type PublicVoteRecord = {
  playerId: string;
  vote: VoteValue;
};

/** Herkese açık olabilen son seçim kaydı (devam eden seçimin oyları girmez). */
export type PublicElectionRecord = {
  electionId: string;
  presidentId: string;
  chancellorId: string;
  outcome: 'elected' | 'rejected';
  votes: PublicVoteRecord[];
};

/** Bir başkanın yaptığı sadakat incelemesi (kimin öğrendiği önemli). */
export type InvestigationRecord = {
  actorId: string;
  targetId: string;
  party: Party;
};

export type EnactedPolicyRecord = {
  board: 'liberal' | 'fascist';
  slotIndex: number;
  policy: PolicyType;
};

export type GameLogEntry =
  | { seq: number; kind: 'game_started'; playerCount: PlayerCount }
  | { seq: number; kind: 'nomination'; presidentId: string; chancellorId: string }
  | { seq: number; kind: 'election'; electionId: string; outcome: 'elected' | 'rejected' }
  | { seq: number; kind: 'policy_enacted'; board: 'liberal' | 'fascist'; policy: PolicyType }
  | { seq: number; kind: 'election_tracker'; tracker: number }
  | { seq: number; kind: 'chaos_policy'; policy: PolicyType }
  | {
      seq: number;
      kind: 'power_used';
      power: ExecutivePower;
      actorId: string;
      targetId: string | null;
    }
  | { seq: number; kind: 'player_executed'; targetId: string }
  | { seq: number; kind: 'veto_enacted' }
  | { seq: number; kind: 'game_over'; winner: Party; reason: GameEndReason };

export type GameState = {
  playerCount: PlayerCount;
  boardVariant: BoardVariant;
  layout: BoardLayout;
  roleSetup: RoleSetup;

  /** Koltuk sırası. */
  players: EnginePlayer[];

  /** Çekme destesi; üst kart index 0. */
  deck: PolicyCard[];
  discard: PolicyCard[];
  /** Deste tükenince yeniden karıştırma için belirlenimci tohum. */
  deckSeed: number;
  /** Kaç kez yeniden karıştırıldı (tohum türetmede kullanılır). */
  reshuffles: number;

  liberalPolicies: number;
  fascistPolicies: number;
  enactedPolicies: EnactedPolicyRecord[];
  electionTracker: number;

  /** Normal sırada bir sonraki başkan adayının koltuğu. */
  presidentSeat: number;
  /** Özel seçim bir sonraki adaylığı kaçırıyorsa. */
  specialElection: { presidentId: string; returnToSeat: number } | null;

  /** Son BAŞARIYLA seçilmiş hükümet (tur kısıtı için). Kaosta `null`'a döner. */
  lastGovernment: Government | null;
  lastElection: PublicElectionRecord | null;

  investigations: InvestigationRecord[];

  phase: EnginePhase;
  /** Her aşama geçişinde artar. */
  phaseSeq: number;
  /** Kabul edilen ve durumu değiştiren her komutta artar. */
  revision: number;

  winner: Party | null;
  endReason: GameEndReason | null;

  log: GameLogEntry[];
  /** Bir sonraki log/kimlik sıra numarası. */
  seq: number;
};
