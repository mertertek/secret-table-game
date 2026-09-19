/**
 * C05 canlı döngü: misafir oturumu → yetkili görünüm/lobi → sürüm sinyali →
 * yeniden al. Ayrıca heartbeat, tek etkin kumanda (`claim_control`), yerel seçim
 * yaşam döngüsü ve komut gönderimi.
 *
 * İstemci yalnız hamle isteği gönderir; tüm kurallar sunucuda uygulanır
 * (docs/CONTRACT.md § 5-6). Realtime kanalı yalnız `{roomId, revision}` taşır;
 * gizli görünüm HTTP `view` yanıtından gelir.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PROTOCOL_VERSION,
  VIEWPOINT_SEND_INTERVAL_MS,
  VIEWPOINT_STALE_MS,
  clampViewpoint,
  viewpointChanged,
  EMOTE_MAX_DURATION_MS,
  type AvatarSelection,
  type ConnectionStatus,
  type EmoteKind,
  type HeadViewpoint,
  type LobbyCommand,
  type LocalViewpoint,
  type SceneCue,
  type SceneIntent,
  type SceneSelection,
  type SceneView,
} from '@secret-table/contracts';

import {
  type CueQueueState,
  drainCues,
  emptyCueQueue,
  mergeCues,
  reconcileSelection,
} from '../adapters/sceneView';
import {
  isSoloActive,
  soloSession,
  soloViewpointChannel,
  watchSoloRevision,
} from '../solo/soloMode';
import * as api from './apiClient';
import type { LobbyView } from './apiClient';
import { currentAccessToken, ensureGuestSession, type GuestSession } from './guestSession';
import { nextRolePanelOpen } from './rolePanel';
import { type RealtimeConnState, type RoomWatcher, watchRoomRevision } from './roomChannel';
import { openViewpointChannel, type ViewpointChannel } from './viewpointChannel';
import { viewpointInterval } from './viewpointProtocol';

function newCommandId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  );
}

export type ConnMode = 'supabase' | 'dev';

export type RoomState =
  | { phase: 'connecting' }
  | { phase: 'error'; message: string; retry: () => void }
  | {
      phase: 'lobby';
      mode: ConnMode;
      connection: ConnectionStatus;
      snapshot: LobbyView;
      inviteUrl: string;
      busy: boolean;
      transient: string | null;
      setReady: (ready: boolean) => void;
      /** D3.4 — lobide karakter seçimi (`set_avatar`). */
      setAvatar: (avatar: AvatarSelection) => void;
      startGame: () => void;
      cancelGame: () => void;
      refresh: () => void;
    }
  | {
      phase: 'game';
      mode: ConnMode;
      connection: ConnectionStatus;
      view: SceneView;
      cues: readonly SceneCue[];
      selection: SceneSelection | null;
      busyActionId: string | null;
      transient: string | null;
      rolePanelOpen: boolean;
      /** Açık reset nesli (FINISH_PLAN §3); resync / oyun değişiminde artar. */
      resetEpoch: number;
      /** Doğrulanmış uzak baş yönleri (FINISH_PLAN §4). */
      peerViewpoints: readonly HeadViewpoint[];
      onIntent: (intent: SceneIntent) => void;
      submitSelected: () => void;
      clearSelection: () => void;
      setRolePanelOpen: (open: boolean) => void;
      /** Sahnenin bildirdiği yerel koltuk yönünü eşik + hız sınırıyla yayınlar. */
      sendViewpoint: (viewpoint: LocalViewpoint) => void;
      /**
       * D16 — el jesti yayını (bakış kanalı, additive alan). Hız sınırı kanaldadır;
       * `false` = gönderilmedi (bekleme süresi / kanal yok). Sunucuya gitmez.
       */
      sendEmote: (kind: EmoteKind) => boolean;
      playAgain: () => void;
      returnToLobby: () => void;
      refresh: () => void;
    };

const HEARTBEAT_MS = 20_000;
const LOBBY_POLL_MS = 3_000;

type Kind = 'connecting' | 'error' | 'lobby' | 'game';

type Internal = {
  disposed: boolean;
  session: GuestSession | null;
  needResync: boolean;
  kind: Kind;
  errorMessage: string;
  snapshot: LobbyView | null;
  view: SceneView | null;
  cueQ: CueQueueState;
  selection: SceneSelection | null;
  busy: boolean;
  busyActionId: string | null;
  transient: string | null;
  rolePanelOpen: boolean;
  lastRevision: number;
  /** İstemci-tarafı bağlantı durumu (HTTP + Realtime + ağ olaylarından türetilir). */
  connection: ConnectionStatus;
  /** Realtime kanalının bildirdiği son durum. */
  realtimeConn: RealtimeConnState;
  /** Ardışık HTTP ağ hatası sayısı. */
  httpFailures: number;
  watcher: RoomWatcher | null;
  /** Rutin cue kuyruğu temizleme zamanlayıcısı (son gruptan sonra). */
  cueTimer: ReturnType<typeof setTimeout> | null;
  /** Son cue grubunun nesli; eski timer yeni grubu silmesin diye. */
  cueBatchSeq: number;
  /**
   * D21/B — `view` istek nesli (in-flight token). Her istek başlarken artar;
   * yanıt geldiğinde sayaç değişmişse DAHA YENİ bir istek başlamış demektir ve
   * eski yanıt UYGULANMAZ. Yarışta eski yanıt görünümü geriye sarıyordu
   * (N+1 → N), cue'lar da "geçmiş" sayılıp düşüyordu.
   */
  viewSeq: number;
  /** Açık reset nesli (FINISH_PLAN §3): resync / gameId değişiminde artar. */
  resetEpoch: number;
  /** Geçici baş yönü kanalı (FINISH_PLAN §4). */
  viewpointCh: ViewpointChannel | null;
  /** playerId → son doğrulanmış uzak baş yönü. */
  peerViewpoints: Map<string, HeadViewpoint>;
  /** D16: playerId → jestin YEREL alım saati; süresi dolana kadar alan taşınır. */
  peerEmoteAt: Map<string, number>;
  /** Sahneye verilen bağışık anlık görüntü (düşük sıklıkta yenilenir). */
  peerSnapshot: readonly HeadViewpoint[];
  /** Son flush'tan beri yeni eş yönü geldi mi. */
  peerDirty: boolean;
  peerFlushTimer: ReturnType<typeof setTimeout> | null;
  /** Yerel gönderim eşiği/hız sınırı durumu. */
  lastSentViewpoint: LocalViewpoint | null;
  lastViewpointSendAt: number;
  lastViewpointChangeAt: number;
  pendingViewpoint: LocalViewpoint | null;
  viewpointSendTimer: ReturnType<typeof setTimeout> | null;
};

const DISCONNECT_AFTER_FAILURES = 3;
/**
 * Rutin cue temizleme gecikmesi. CODEX-008/009: sahne 350–850 ms hareketler
 * oynatır; kuyruğu teslimle aynı anda VEYA rAF'ta boşaltmak animasyonu keser.
 * Son gruptan ≥ ~900 ms sonra temizlenir; resync/kesinti/ilk snapshot'ta hemen boş.
 */
const CUE_CLEAR_MS = 950;

/** HTTP + Realtime durumlarının en kötüsü. */
function worstConn(http: ConnectionStatus, realtime: RealtimeConnState): ConnectionStatus {
  if (http === 'disconnected' || realtime === 'disconnected') return 'disconnected';
  if (http === 'reconnecting' || realtime === 'reconnecting') return 'reconnecting';
  return 'connected';
}

export function useRoomState(roomId: string): RoomState {
  const [, bump] = useState(0);
  const rerender = useCallback(() => bump((n) => n + 1), []);

  const ref = useRef<Internal>({
    disposed: false,
    session: null,
    needResync: true,
    kind: 'connecting',
    errorMessage: '',
    snapshot: null,
    view: null,
    cueQ: emptyCueQueue,
    selection: null,
    busy: false,
    busyActionId: null,
    transient: null,
    rolePanelOpen: false,
    lastRevision: -1,
    connection: 'connected',
    realtimeConn: 'connected',
    httpFailures: 0,
    watcher: null,
    cueTimer: null,
    cueBatchSeq: 0,
    viewSeq: 0,
    resetEpoch: 0,
    viewpointCh: null,
    peerViewpoints: new Map(),
    peerEmoteAt: new Map(),
    peerSnapshot: [],
    peerDirty: false,
    peerFlushTimer: null,
    lastSentViewpoint: null,
    lastViewpointSendAt: 0,
    lastViewpointChangeAt: 0,
    pendingViewpoint: null,
    viewpointSendTimer: null,
  });

  /**
   * Her HTTP sonucundan sonra bağlantı durumunu günceller. `ok` bir ağ hatası
   * OLMADIĞINI belirtir (sunucu hata kodu da "bağlıyız" demektir).
   */
  const noteHttp = useCallback(
    (ok: boolean) => {
      const r = ref.current;
      const prev = r.connection;
      if (ok) {
        r.httpFailures = 0;
        r.connection = worstConn('connected', r.realtimeConn);
      } else {
        r.httpFailures += 1;
        const http: ConnectionStatus =
          r.httpFailures >= DISCONNECT_AFTER_FAILURES ? 'disconnected' : 'reconnecting';
        r.connection = worstConn(http, r.realtimeConn);
      }
      // Bağlantı yeniden kurulduysa: bir sonraki görünüm alımı tam (`resync`) olsun
      // ki birikmiş cue/animasyon tekrar oynatılmasın.
      if (prev !== 'connected' && r.connection === 'connected') r.needResync = true;
      if (prev !== r.connection && r.view) {
        r.view = { ...r.view, connection: r.connection };
      }
      if (prev !== r.connection) rerender();
    },
    [rerender],
  );

  const noteRealtime = useCallback(
    (state: RealtimeConnState) => {
      const r = ref.current;
      r.realtimeConn = state;
      const prev = r.connection;
      const httpPart: ConnectionStatus =
        r.httpFailures >= DISCONNECT_AFTER_FAILURES
          ? 'disconnected'
          : r.httpFailures > 0
            ? 'reconnecting'
            : 'connected';
      r.connection = worstConn(httpPart, state);
      if (prev !== 'connected' && r.connection === 'connected') r.needResync = true;
      if (prev !== r.connection && r.view) {
        r.view = { ...r.view, connection: r.connection };
      }
      if (prev !== r.connection) rerender();
    },
    [rerender],
  );

  const setError = useCallback(
    (message: string) => {
      const r = ref.current;
      if (r.disposed) return;
      r.kind = 'error';
      r.errorMessage = message;
      rerender();
    },
    [rerender],
  );

  const applyView = useCallback(
    (view: SceneView, cues: readonly SceneCue[], resync: boolean) => {
      const r = ref.current;
      if (r.disposed) return;
      /**
       * D21/B — GERİYE SARMA koruması. İki `view` isteği yarışırsa (sürüm
       * sinyali + yedek yoklama, ya da komut yanıtı + sinyal) yanıtlar ters
       * sırada gelebiliyordu: N+1 uygulandıktan sonra gecikmiş N yanıtı
       * görünümü geri alıyor, `lastRevision` düşüyor ve bir sonraki istek
       * cue'ları "geçmiş" sayıp atıyordu. AYNI oyunun ESKİ sürümü artık atılır.
       * `resync` bunun dışındadır: tam yeniden eşitleme her zaman uygulanır.
       */
      if (!resync && r.view && r.view.gameId === view.gameId && view.revision < r.lastRevision) {
        return;
      }
      const wipe = resync || r.cueQ.gameId !== view.gameId;
      r.kind = 'game';
      // Yetkili sunucu görünümüne istemci-tarafı bağlantı durumunu işle
      // (docs/CONTRACT.md § 3: connection alanını istemci adaptörü ekler).
      r.view = { ...view, connection: r.connection };
      r.viewpointCh?.sync(view.gameId ? { roomId: view.roomId, gameId: view.gameId, localPlayerId: view.localPlayerId, players: view.players } : null);
      r.cueQ = mergeCues(r.cueQ, cues, { resync, gameId: view.gameId });
      r.selection = reconcileSelection(r.selection, view);
      r.lastRevision = view.revision;
      r.needResync = false;
      // D20 — görünüm tazelendi: yedek yoklama sayacını sıfırla (kota).
      r.watcher?.poke();

      // Cue kuyruğu temizleme (CODEX-008/009):
      //  - resync / oyun değişimi: `mergeCues` zaten kuyruğu boşalttı; bekleyen
      //    rutin temizlik timer'ını iptal et.
      //  - yeni cue grubu: rAF ile DEĞİL, son gruptan ~950 ms sonra temizle
      //    (nesil koruması: araya yeni grup girerse eski timer onu silmez).
      if (wipe) {
        if (r.cueTimer) {
          clearTimeout(r.cueTimer);
          r.cueTimer = null;
        }
        // FINISH_PLAN §3: açık reset nesli. Normal boş kuyruk sahnenin kabul
        // ettiği hareketi kesmez; bu artış (resync / oyun değişimi) keser.
        r.resetEpoch += 1;
        // Yeni oyun / tam resync: eski baş yönleri artık geçerli değil.
        if (r.peerViewpoints.size > 0) {
          r.peerViewpoints.clear();
          r.peerSnapshot = [];
        }
        r.peerDirty = false;
        r.lastSentViewpoint = null;
        if (r.viewpointSendTimer) clearTimeout(r.viewpointSendTimer);
        r.viewpointSendTimer = null;
        r.pendingViewpoint = null;
      } else if (cues.length > 0) {
        r.cueBatchSeq += 1;
        const seq = r.cueBatchSeq;
        if (r.cueTimer) clearTimeout(r.cueTimer);
        r.cueTimer = setTimeout(() => {
          const rr = ref.current;
          rr.cueTimer = null;
          if (rr.disposed || rr.cueBatchSeq !== seq || rr.cueQ.queue.length === 0) return;
          rr.cueQ = drainCues(rr.cueQ);
          rerender();
        }, CUE_CLEAR_MS);
      }

      rerender();
    },
    [rerender],
  );

  /**
   * Yetkili görünümü al ve uygula. Sonuç:
   *  - `'ok'`      görünüm uygulandı,
   *  - `'stale'`   daha yeni bir istek başlamış: bu yanıt UYGULANMADI (D21/B),
   *  - `'network'` ağ hatası / bileşen kapandı: durumu KORU, yedek yoklama toparlar,
   *  - `'lobby'`   oda artık oyunda değil (iptal / oyun-sonu / 401): çağıran lobi
   *                yoluna düşsün.
   */
  const fetchAndApplyView = useCallback(
    async (accessToken: string): Promise<'ok' | 'stale' | 'network' | 'lobby'> => {
      const r = ref.current;
      const wantResync = r.needResync;
      // D18/B4 — cue dağıtımı: elimizdeki son sürümü bildir. Sunucu bu sürümün
      // İLERİSİNDEki her durumda son komutun cue'larını (alıcıya süzülmüş)
      // döndürür; resync'te boş gelir, böylece eski koreografi tekrar oynamaz.
      // D21/C — oyun kimliği de gider ("Yeniden oyna" sürüm sayacını sürdürür).
      const since = !wantResync && r.lastRevision >= 0 ? r.lastRevision : undefined;
      const sinceGameId = since === undefined ? undefined : (r.view?.gameId ?? undefined);
      // D21/B — istek nesli: yanıt geldiğinde sayaç değişmişse daha yeni bir
      // istek başlamıştır ve bu yanıt uygulanmaz.
      const generation = (r.viewSeq += 1);
      const viewRes = await api.fetchView(accessToken, roomId, wantResync, since, sinceGameId);
      if (r.disposed) return 'network';
      noteHttp(!(viewRes.ok === false && viewRes.status === 0));
      if (!viewRes.ok) return viewRes.status === 0 ? 'network' : 'lobby';
      if (r.viewSeq !== generation) return 'stale';
      // D21/A — oda lobiye döndü (host "Lobiye dön"): oyun durumu satırı
      // silinmediği için görünüm hâlâ geçerli görünür; additive `roomStatus`
      // olmasa istemci oyun-sonu ekranında kalırdı.
      if (viewRes.data.roomStatus === 'lobby') return 'lobby';
      /**
       * D21/D — `resync` bayrağı tüketilmesin. `noteHttp` bu istek SÜRERKEN
       * bağlantıyı yeniden "connected" yaptıysa `needResync`'i true'ya çeker;
       * eskiden hemen ardından gelen `applyView(..., resync=false)` bayrağı
       * siliyor ve tam yeniden eşitleme hiç yapılmıyordu (birikmiş cue'lar
       * oynayabiliyordu). Artık yanıt geldikten SONRA okunur ve bu yanıt
       * resync olarak uygulanır.
       */
      const resync = viewRes.data.resync || wantResync || r.needResync;
      applyView(viewRes.data.view, viewRes.data.cues, resync);
      return 'ok';
    },
    [roomId, applyView, noteHttp],
  );

  const applyLobbyOrGame = useCallback(
    async (snapshot: LobbyView, accessToken: string) => {
      const r = ref.current;
      if (r.disposed) return;

      if (snapshot.status === 'lobby') {
        r.kind = 'lobby';
        r.viewpointCh?.sync(null);
        r.snapshot = snapshot;
        rerender();
        return;
      }

      if ((await fetchAndApplyView(accessToken)) !== 'lobby') return;
      if (r.disposed) return;
      // İptal / oyun-sonu yarışı: lobiye düş.
      r.kind = 'lobby';
      r.viewpointCh?.sync(null);
      r.snapshot = snapshot;
      rerender();
    },
    [fetchAndApplyView, rerender],
  );

  const refresh = useCallback(async () => {
    const r = ref.current;
    if (r.disposed || !r.session) return;
    const accessToken = await currentAccessToken(r.session);
    if (r.disposed) return;

    let lobby = await api.fetchLobby(accessToken, roomId);
    if (r.disposed) return;

    // D26 — solo kipte oturum yenileme yoktur: `ensureGuestSession` çağrılmaz.
    if (!lobby.ok && lobby.status === 401 && !isSoloActive()) {
      try {
        r.session = await ensureGuestSession();
        const t2 = await currentAccessToken(r.session);
        await r.watcher?.reauth();
        await r.viewpointCh?.reauth();
        lobby = await api.fetchLobby(t2, roomId);
        if (r.disposed) return;
        if (lobby.ok) {
          noteHttp(true);
          await applyLobbyOrGame(lobby.data, t2);
          return;
        }
      } catch {
        /* düşer */
      }
    }

    noteHttp(!(lobby.ok === false && lobby.status === 0));
    if (!lobby.ok) {
      if (lobby.status === 0) return; // ağ hatası: hata ekranına geçme, toparlanmayı bekle
      setError(lobby.error);
      return;
    }
    await applyLobbyOrGame(lobby.data, accessToken);
  }, [roomId, applyLobbyOrGame, noteHttp, setError]);

  /**
   * D20 — sürüm sinyali / yedek yoklama hızlı yolu.
   *
   * Ölçüldü (docs/qa/claude/D20-realtime.md): Realtime sürüm sinyali ~0,3 s'de
   * geliyor; görünen gecikmenin büyük kısmı `lobby_view` + `view` ARDIŞIK iki
   * HTTP turuydu. Oyundayken lobi turu gerekmez: doğrudan `view` alınır. Bu hem
   * gecikmeyi hem oyuncu başına istek sayısını yarıya indirir (kota).
   *
   * Lobideyken ya da `view` "artık oyunda değil" derse tam `refresh()` çalışır;
   * oturum yenileme (401) ve lobi görüntüsü yine oradan gelir.
   */
  const refreshView = useCallback(async () => {
    const r = ref.current;
    if (r.disposed || !r.session) return;
    /**
     * D21/A — hızlı yol yalnız SÜREN oyun için. Oyun-sonu ekranındayken host
     * her an "Lobiye dön" (`cancel_game`) diyebilir; o yol yalnız
     * `rooms.status`'u değiştirdiği için lobi turunu atlayan hızlı yol lobiye
     * dönüşü göremiyordu. `game_over` fazında doğrudan tam `refresh()`.
     */
    if (r.kind !== 'game' || !r.view?.gameId || r.view.phase === 'game_over') {
      await refresh();
      return;
    }
    const accessToken = await currentAccessToken(r.session);
    if (r.disposed) return;
    // `'lobby'`: oda artık oyunda değil (`roomStatus`, 401 ya da sunucu hatası).
    if ((await fetchAndApplyView(accessToken)) === 'lobby') await refresh();
  }, [fetchAndApplyView, refresh]);

  // --- Baş yönü paylaşımı (FINISH_PLAN §4) ---
  // Fonksiyon bildirimleri (hoisted): yalnız kararlı `ref` + `rerender` üzerine
  // kapanır, kurulum efekti bunlara güvenle referans verebilir.

  /**
   * Sahneye verilen bağışık anlık görüntüyü DÜŞÜK SIKLIKTA yeniler + bayat siler.
   * `acceptPeerViewpoint` her mesajda rerender ETMEZ; render churn'ü burada
   * `VIEWPOINT_SEND_INTERVAL_MS`e (≈8 Hz) sınırlanır (7/10 alıcıda bile).
   */
  function flushPeers(): void {
    const r = ref.current;
    r.peerFlushTimer = null;
    if (r.disposed) return;
    const now = Date.now();
    const known = new Set(r.view?.players.map((p) => p.playerId) ?? []);
    let dirty = r.peerDirty;
    r.peerDirty = false;
    for (const [id, v] of r.peerViewpoints) {
      if (now - v.t > VIEWPOINT_STALE_MS || (known.size > 0 && !known.has(id))) {
        r.peerViewpoints.delete(id);
        r.peerEmoteAt.delete(id);
        dirty = true;
      }
    }
    r.peerSnapshot = [...r.peerViewpoints.values()];
    if (dirty) rerender();
    // Hâlâ eş varsa bir sonraki temizlik turunu planla (bayatları düşürmek için).
    if (r.peerViewpoints.size > 0) schedulePeerFlush();
  }

  function schedulePeerFlush(): void {
    const r = ref.current;
    if (r.peerFlushTimer || r.disposed) return;
    r.peerFlushTimer = setTimeout(flushPeers, VIEWPOINT_SEND_INTERVAL_MS);
  }

  /**
   * Alıcı doğrulaması (docs/CONTRACT.md §5A): yalnız yetkili görünümdeki başka
   * oyuncular; kendi başını dinleme; koltuk çapraz kontrolü; bayat örneği ele.
   * Rerender YOK — `flushPeers` toplu yapar.
   */
  function acceptPeerViewpoint(hv: HeadViewpoint): void {
    const r = ref.current;
    const v = r.view;
    if (r.disposed || r.connection !== 'connected' || !v || v.roomId !== hv.roomId) return;
    if (hv.playerId === v.localPlayerId) return;
    const player = v.players.find((p) => p.playerId === hv.playerId);
    if (!player || player.seatIndex !== hv.seatIndex) return;
    if (Math.abs(Date.now() - hv.t) > VIEWPOINT_STALE_MS) return;
    const clamped = clampViewpoint(hv);
    const next: HeadViewpoint = {
      ...clamped,
      roomId: hv.roomId,
      playerId: hv.playerId,
      seatIndex: hv.seatIndex,
      t: hv.t,
    };
    // D16 — jest alanı yalnız İLK pakette gelir (aynı `seq` tekrarları protokolde
    // düşer). Süresi dolana kadar taşınır ki iki flush arasında kaybolmasın;
    // sahne jesti kendi saatinde latch'ler ve `seq` ile bir kez oynatır.
    const now = Date.now();
    if (hv.emote) {
      next.emote = hv.emote;
      r.peerEmoteAt.set(hv.playerId, now);
    } else {
      const previous = r.peerViewpoints.get(hv.playerId)?.emote;
      const at = r.peerEmoteAt.get(hv.playerId);
      if (previous && at !== undefined && now - at < EMOTE_MAX_DURATION_MS) next.emote = previous;
      else r.peerEmoteAt.delete(hv.playerId);
    }
    r.peerViewpoints.set(hv.playerId, next);
    r.peerDirty = true;
    schedulePeerFlush();
  }

  /**
   * D16 — el jesti. Bakış kanalının additive alanıyla gider (sunucu/DB yok);
   * kanal hemen bir paket + 250/600 ms'de iki tekrar gönderir ve 1,2 s hız
   * sınırını uygular.
   */
  function sendEmote(kind: EmoteKind): boolean {
    const r = ref.current;
    if (r.disposed || r.kind !== 'game' || !r.view || r.connection !== 'connected' ||
        (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return false;
    return r.viewpointCh?.sendEmote(kind) ?? false;
  }

  function sendViewpoint(viewpoint: LocalViewpoint): void {
    const r = ref.current;
    if (r.disposed || r.kind !== 'game' || !r.view || r.connection !== 'connected' ||
        (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    const v = r.view;
    const clamped = clampViewpoint(viewpoint);
    const now = Date.now();

    const emit = (value: LocalViewpoint): void => {
      const current = ref.current;
      if (current.disposed || current.view?.gameId !== v.gameId || current.connection !== 'connected' ||
          (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      const seat = v.players.find((p) => p.playerId === v.localPlayerId)?.seatIndex ?? 0;
      const sent = r.viewpointCh?.send({
        ...value,
        roomId: v.roomId,
        playerId: v.localPlayerId,
        seatIndex: seat,
        t: Date.now(),
      });
      if (!sent) return;
      r.lastSentViewpoint = value;
      r.lastViewpointSendAt = Date.now();
    };

    if (r.lastSentViewpoint && !viewpointChanged(clamped, r.lastSentViewpoint)) {
      // Değişim yok: boşta gönderim yapma (idle susar).
      if (r.viewpointSendTimer) {
        clearTimeout(r.viewpointSendTimer);
        r.viewpointSendTimer = null;
        r.pendingViewpoint = null;
      }
      return;
    }

    r.lastViewpointChangeAt = now;
    if (!r.lastSentViewpoint || now - r.lastViewpointSendAt >= viewpointInterval(v.players.length)) {
      emit(clamped);
      return;
    }
    // Hız sınırı içinde: son pozu iz bırakan zamanlayıcıyla gönder.
    r.pendingViewpoint = clamped;
    if (!r.viewpointSendTimer) {
      const wait = Math.max(0, viewpointInterval(v.players.length) - (now - r.lastViewpointSendAt));
      r.viewpointSendTimer = setTimeout(() => {
        const rr = ref.current;
        rr.viewpointSendTimer = null;
        const pending = rr.pendingViewpoint;
        rr.pendingViewpoint = null;
        if (rr.disposed || !pending || rr.kind !== 'game' || Date.now() - rr.lastViewpointChangeAt > VIEWPOINT_STALE_MS) return;
        emit(pending);
      }, wait);
    }
  }

  // --- Kurulum ---
  useEffect(() => {
    const r = ref.current;
    Object.assign(r, {
      disposed: false,
      kind: 'connecting',
      needResync: true,
      view: null,
      snapshot: null,
      cueQ: emptyCueQueue,
      selection: null,
      transient: null,
      lastRevision: -1,
      connection: 'connected',
      realtimeConn: 'connected',
      httpFailures: 0,
      resetEpoch: 0,
      peerViewpoints: new Map(),
      peerEmoteAt: new Map(),
      peerSnapshot: [],
      peerDirty: false,
      lastSentViewpoint: null,
      lastViewpointSendAt: 0,
      lastViewpointChangeAt: 0,
      pendingViewpoint: null,
    } satisfies Partial<Internal>);
    rerender();

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let lobbyTimer: ReturnType<typeof setInterval> | null = null;
    /** Mikro-görev birleştirme: aynı tick'teki tetiklemeler tek isteğe iner. */
    let pending = false;
    /** Bekleyen tetikleme tam tur mu istiyor. */
    let pendingFull = false;
    /** Şu an bir tazeleme SÜRÜYOR mu (in-flight). */
    let running = false;
    /** Sürerken gelen tetikleme: bitince bir kez daha çek (`'full'` baskın). */
    let again: 'none' | 'view' | 'full' = 'none';

    const runRefresh = async (full: boolean): Promise<void> => {
      /**
       * D21/B — birleştirme yalnız mikro-görevde değil, İSTEK BOYUNCA. Eskiden
       * in-flight bir istek varken gelen her sinyal yeni bir istek başlatıyor,
       * yanıtlar ters sırada gelip görünümü geriye sarıyordu. Artık süren istek
       * varken yalnız bir "tekrar" bayrağı bırakılır ve bitince TEK istek daha
       * gider (tam tur istendiyse tam tur).
       */
      if (running) {
        again = full || again === 'full' ? 'full' : 'view';
        return;
      }
      running = true;
      try {
        // D20 — sürüm sinyalinde oyundayken yalnız `view` turu (lobi turu yok).
        if (full) await refresh();
        else await refreshView();
      } finally {
        running = false;
        const next = again;
        again = 'none';
        if (next !== 'none' && !ref.current.disposed) void runRefresh(next === 'full');
      }
    };

    const scheduleRefresh = (full = false) => {
      pendingFull = pendingFull || full;
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        const wantFull = pendingFull;
        pendingFull = false;
        void runRefresh(wantFull);
      });
    };

    void (async () => {
      /**
       * D26 — solo kipte Supabase YOK: kimlik sabit yerel kimliktir ve
       * `ensureGuestSession` HİÇ çağrılmaz (anonim hesap açılmaz, kota
       * harcanmaz). Gerçek çok oyunculu yol aynen eskisi gibi.
       */
      const solo = soloSession();
      try {
        r.session = solo ?? (await ensureGuestSession());
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Oturum açılamadı.');
        return;
      }
      if (r.disposed) return;

      // Tek etkin kumanda yalnız çok cihazlı gerçek oyun içindir.
      if (!solo) {
        try {
          const t = await currentAccessToken(r.session);
          await api.claimControl(t, roomId);
        } catch {
          /* kritik değil */
        }
      }
      if (r.disposed) return;

      await refresh();

      /**
       * D26 — solo kipte Realtime kanalı açılmaz; sürüm sinyali yerel
       * `InMemoryGateway`den doğrudan gelir ve yedek yoklama gerekmez.
       */
      r.watcher = solo
        ? watchSoloRevision({
            roomId,
            onRevision: (signal) => {
              const cur = ref.current;
              if (signal.revision > cur.lastRevision || cur.view?.phase === 'game_over') {
                scheduleRefresh(false);
              }
            },
          })
        : watchRoomRevision({
        roomId,
        onRevision: (signal) => {
          const cur = ref.current;
          // Normal ilerleme: daha yüksek revision veya "bilinmiyor" (-1).
          // QA-R01: "Yeniden oyna" sonrası yeni oyun revision'ı biten oyununkinden
          // devam eder; yine de sonuç ekranındayken gelen HER sinyalde yeniden al
          // (kaçan sinyal / eşit revision durumuna karşı güvence).
          if (
            signal.revision === -1 ||
            signal.revision > cur.lastRevision ||
            cur.view?.phase === 'game_over'
          ) {
            /**
             * D21/A — `revision === -1` yedek yoklama / yeniden abonelik /
             * sekme geri gelmesi demektir: burada TAM tur yapılır ki oda
             * durumu (host'un "Lobiye dön"ü) da görülsün. Gerçek sürüm
             * sinyalinde hızlı yol kalır (tek HTTP turu, D20 kazancı).
             */
            scheduleRefresh(signal.revision === -1);
          }
        },
        // D21/I — lobide yedek yoklama gereksiz: `lobbyTimer` zaten 3 s'de bir
        // tam tur yapıyor. Oradayken kanal yoklamasını sustur (kota).
        backupEnabled: () => ref.current.kind !== 'lobby',
        onConnState: noteRealtime,
        getToken: async () => {
          const cur = ref.current;
          return cur.session ? currentAccessToken(cur.session) : null;
        },
      });

      /**
       * Geçici baş yönü kanalı (sürüm kanalından ayrı; DB/ledger etkilemez).
       * D26 — solo kipte paylaşılacak kimse yok: kanal AÇILMAZ, yalnız jestin
       * yerelde oynamasına izin veren küçük bir yerel kapı kurulur.
       */
      r.viewpointCh = solo
        ? soloViewpointChannel()
        : openViewpointChannel({
            roomId,
            onPeer: acceptPeerViewpoint,
            onIssue: (issue) => {
              if (r.disposed) return;
              const message = 'Baş hareketleri bağlantısı kurulamadı; oyun devam edebilir.';
              if (issue) r.transient = message;
              else if (r.transient === message) r.transient = null;
              rerender();
            },
            getToken: async () => {
              const cur = ref.current;
              return cur.session ? currentAccessToken(cur.session) : null;
            },
          });

      if (r.kind === 'game' && r.view?.gameId) {
        r.viewpointCh.sync({ roomId, gameId: r.view.gameId, localPlayerId: r.view.localPlayerId, players: r.view.players });
      }

      // D26 — solo kipte heartbeat/oturum tazeleme yok (gidecek sunucu yok).
      if (!solo) {
        heartbeatTimer = setInterval(() => {
          void (async () => {
            const cur = ref.current;
            if (cur.disposed || !cur.session) return;
            try {
              const t = await currentAccessToken(cur.session);
              const res = await api.sendHeartbeat(t, roomId);
              noteHttp(!(res.ok === false && res.status === 0));
            } catch {
              /* yut */
            }
          })();
        }, HEARTBEAT_MS);
      }

      lobbyTimer = setInterval(() => {
        // Lobide yalnız bu zamanlayıcı çalışır (tam tur: lobi anlık görünümü).
        if (ref.current.kind === 'lobby') scheduleRefresh(true);
      }, LOBBY_POLL_MS);
    })();

    return () => {
      r.disposed = true;
      r.watcher?.stop();
      r.watcher = null;
      r.viewpointCh?.stop();
      r.viewpointCh = null;
      if (r.cueTimer) {
        clearTimeout(r.cueTimer);
        r.cueTimer = null;
      }
      if (r.peerFlushTimer) {
        clearTimeout(r.peerFlushTimer);
        r.peerFlushTimer = null;
      }
      if (r.viewpointSendTimer) {
        clearTimeout(r.viewpointSendTimer);
        r.viewpointSendTimer = null;
      }
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (lobbyTimer) clearInterval(lobbyTimer);
    };
  }, [roomId, refresh, refreshView, setError, rerender, noteRealtime, noteHttp]);

  // --- Lobi eylemleri ---
  const sendLobby = useCallback(
    async (command: LobbyCommand) => {
      const r = ref.current;
      if (r.disposed || !r.session || r.busy) return;
      r.busy = true;
      r.transient = null;
      rerender();
      try {
        const t = await currentAccessToken(r.session);
        const res = await api.sendLobbyCommand(t, roomId, command);
        noteHttp(!(res.ok === false && res.status === 0));
        if (!r.disposed && !res.ok) r.transient = res.error;
        else if (!r.disposed && res.ok && res.data.ok === false && res.data.error) {
          r.transient = res.data.error;
        }
      } finally {
        if (!r.disposed) {
          r.busy = false;
          rerender();
        }
      }
      await refresh();
    },
    [roomId, refresh, rerender, noteHttp],
  );

  const base = () => ({ protocolVersion: PROTOCOL_VERSION, commandId: newCommandId() }) as const;
  const setReady = useCallback(
    (ready: boolean) => void sendLobby({ ...base(), type: 'set_ready', ready }),
    [sendLobby],
  );
  const setAvatar = useCallback(
    (avatar: AvatarSelection) =>
      void sendLobby({ ...base(), type: 'set_avatar', character: avatar.character, skin: avatar.skin }),
    [sendLobby],
  );
  const startGame = useCallback(() => void sendLobby({ ...base(), type: 'start_game' }), [sendLobby]);
  const cancelGame = useCallback(() => void sendLobby({ ...base(), type: 'cancel_game' }), [sendLobby]);
  const playAgain = useCallback(() => void sendLobby({ ...base(), type: 'play_again' }), [sendLobby]);

  // --- Oyun eylemleri ---
  const onIntent = useCallback(
    (intent: SceneIntent) => {
      const r = ref.current;
      if (intent.type === 'select_option') {
        r.selection = { actionId: intent.actionId, optionId: intent.optionId };
        r.transient = null;
        rerender();
      } else if (intent.type === 'clear_selection') {
        r.selection = null;
        rerender();
      } else if (intent.type === 'inspect_own_role') {
        // QA-R02 / CODEX-012: yön verilirse ona uy (sahnedeki "Kimliği kapat"
        // paneli yeniden açmasın); yönsüz eski niyet her zaman "aç" demektir
        // (toggle tahminine dönüşmez).
        r.rolePanelOpen = nextRolePanelOpen(r.rolePanelOpen, intent);
        rerender();
      }
    },
    [rerender],
  );

  const clearSelection = useCallback(() => {
    ref.current.selection = null;
    rerender();
  }, [rerender]);

  const setRolePanelOpen = useCallback(
    (open: boolean) => {
      ref.current.rolePanelOpen = open;
      rerender();
    },
    [rerender],
  );

  const submitSelected = useCallback(async () => {
    const r = ref.current;
    if (r.disposed || !r.session || !r.view || !r.selection || r.busyActionId) return;
    const action = r.view.actions.find((a) => a.actionId === r.selection?.actionId);
    const gameId = r.view.gameId;
    if (!action || !gameId) {
      r.selection = null;
      rerender();
      return;
    }

    r.busyActionId = action.actionId;
    r.transient = null;
    rerender();

    try {
      const t = await currentAccessToken(r.session);
      const res = await api.sendCommand(t, roomId, {
        protocolVersion: PROTOCOL_VERSION,
        gameId,
        phaseId: r.view.phaseId,
        commandId: newCommandId(),
        actionId: action.actionId,
        optionId: r.selection?.optionId,
      });
      if (r.disposed) return;
      noteHttp(!(res.ok === false && res.status === 0));
      if (!res.ok) {
        r.transient = res.error;
      } else if (res.data.ok === false) {
        r.transient = res.data.messageKey || res.data.error;
      } else {
        r.selection = null;
        applyView(res.data.view, res.data.cues, false);
      }
    } catch (error) {
      if (!r.disposed) r.transient = error instanceof Error ? error.message : 'İstek başarısız.';
    } finally {
      if (!r.disposed) {
        r.busyActionId = null;
        rerender();
      }
    }
    await refresh();
  }, [roomId, applyView, refresh, rerender, noteHttp]);

  // --- Görünür durum ---
  const r = ref.current;
  const mode: ConnMode = r.session?.mode === 'supabase' ? 'supabase' : 'dev';

  if (r.kind === 'error') {
    return { phase: 'error', message: r.errorMessage, retry: () => void refresh() };
  }
  if (r.kind === 'lobby' && r.snapshot) {
    const origin = globalThis.location?.origin ?? '';
    return {
      phase: 'lobby',
      mode,
      connection: r.connection,
      snapshot: r.snapshot,
      inviteUrl: `${origin}/katil/${r.snapshot.inviteCode}`,
      busy: r.busy,
      transient: r.transient,
      setReady,
      setAvatar,
      startGame,
      cancelGame,
      refresh: () => void refresh(),
    };
  }
  if (r.kind === 'game' && r.view?.gameId) {
    return {
      phase: 'game',
      mode,
      connection: r.connection,
      view: r.view,
      cues: r.cueQ.queue,
      selection: r.selection,
      busyActionId: r.busyActionId,
      transient: r.transient,
      rolePanelOpen: r.rolePanelOpen,
      resetEpoch: r.resetEpoch,
      peerViewpoints: r.peerSnapshot,
      onIntent,
      submitSelected: () => void submitSelected(),
      clearSelection,
      setRolePanelOpen,
      sendViewpoint: (viewpoint) => sendViewpoint(viewpoint),
      sendEmote: (kind) => sendEmote(kind),
      playAgain,
      returnToLobby: cancelGame,
      refresh: () => void refresh(),
    };
  }
  return { phase: 'connecting' };
}
