import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EMOTE_MAX_DURATION_MS, type EmoteKind, type EmoteSignal, type SceneController, type SceneIntent, type SceneTargets } from '@secret-table/contracts';
import type { RoomState } from '../multiplayer/useRoomState';
import type { FocusTarget } from '../immersive/controlScheme';
import { useCoarsePointer, useImmersiveSession } from '../immersive/useImmersiveSession';
import { useEmoteWheel } from '../immersive/useEmoteWheel';
import { useTableControls } from '../immersive/useTableControls';
import { ActionBar } from './ActionBar';
import { EmoteWheel } from './EmoteWheel';
import { Announcer } from './Announcer';
import { EXECUTION_FIRE_MS } from './announcements';
import { ConnectionBanner } from './ConnectionBanner';
import { GameMenu } from './GameMenu';
import { RolePanel } from './RolePanel';
import { SceneFrame } from './SceneFrame';
import { statusLine, statusLineText } from './statusLine';
import { useT, t as translate } from '../i18n';
import { connectionText, endReasonName, roleName, winnerName } from './text';
import { usePrefs } from './usePrefs';

type GameRoom = Extract<RoomState, { phase: 'game' }>;

/** Pointer Lock'u açan ilk giriş sahne raycast tıklamasıyla hamle seçmesin. */
const LOCK_GRACE_MS = 300;

/** Pointer Lock etkinken bu kadar hareketsizlikten sonra HUD kenarları solar (D11). */
const HUD_IDLE_MS = 3000;

/** Tam ekrana ilk girişte tuş ipucu bu kadar görünür (D11). */
const FULLSCREEN_HINT_MS = 4000;

/**
 * D21/I — "VURULDUN" katmanının GİRİŞ süresi. `styles.css` içindeki en uzun
 * giriş animasyonuyla eşleşir (`shot-title` 3600 ms; `shot-vignette` 2400 ms).
 * Bu süre geçince katman `data-shot="persistent"` dalına düşer.
 */
const SHOT_ENTER_MS = 3600;

/**
 * Tahta incelemesi uygulamada tutulur; sahne bunu tek kaynak olarak alır (D11).
 * D15: koltuk kamerasında `lean` — tepeden kadraj yerine koltuktan tahtaların
 * üstüne eğilme. Genel masa kamerasında eski `fascist`/`liberal` tepeden inceleme.
 */
type BoardInspection = 'off' | 'liberal' | 'fascist' | 'lean';

/**
 * Tam ekran öncelikli oyun ekranı — ROADMAP A2.
 *
 * 3D sahne bütün görünümü kaplar. Üstte ince bilgi şeridi (aşama / kimin sırası
 * / ne yapması gerektiği), altta eylem ve tuş çubuğu; oyuncular, masa durumu,
 * geçmiş ve tercihler `M` menüsündedir. Sağ HTML yan paneli kaldırılmıştır.
 *
 * Kontrol tek kaynaktan yürür (`useTableControls` + `controlScheme`): klavye,
 * sahne nişangâhı ve alt çubuk tıklaması aynı `select_option` → onay →
 * `submitSelected` yolunu kullanır.
 */
export function GameScreen({ room }: { room: GameRoom }) {
  const t = useT();
  const [prefs, setPrefs] = usePrefs();
  const { view } = room;

  const containerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const immersive = useImmersiveSession(containerRef);
  /** Dokunmatik cihazda Pointer Lock anlamsız; yalnız tam ekran sunulur (C2-b/5). */
  const coarsePointer = useCoarsePointer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [controller, setController] = useState<SceneController | null>(null);
  const [sceneTargets, setSceneTargets] = useState<SceneTargets | null>(null);
  /** Sağ üst araç çubuğundaki "Tahta" — sahne bunu tek kaynak olarak okur. */
  const [boardInspection, setBoardInspection] = useState<BoardInspection>('off');
  /** Pointer Lock'ta hareketsizlik: kenar HUD'ları solar (durum şeridi kalır). */
  const [hudIdle, setHudIdle] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  const localPlayer = useMemo(
    () => view.players.find((p) => p.playerId === view.localPlayerId) ?? null,
    [view.players, view.localPlayerId],
  );
  const isHost = Boolean(localPlayer?.isHost);
  const gameOver = view.phase === 'game_over';

  /**
   * D12 §6 / D18 madde 2 — vurulan oyuncunun ekranı.
   *
   * Katman GÖRÜNÜMDEN türer: `!alive` olduğu SÜRECE vinyet **ve** "VURULDUN"
   * başlığı durur (kamera oynamaz, `pointer-events: none`). Cue geldiyse giriş
   * ateş anına (`EXECUTION_FIRE_MS` = 1300 ms) gecikir; cue yoksa (yeniden
   * bağlanma, atlanan sürüm, ya da cue kuyruğu boşaldıktan sonraki render)
   * anında görünür.
   *
   * Eski hata (E2E bulgu 1): başlık yalnız `shotFresh` iken çiziliyordu, yani
   * cue'nun ULAŞTIĞI dalda görünüyordu. Kurbana cue hiç gitmediği için (B4)
   * ekranda sadece %25 yoğunluklu vinyet kalıyordu ve oyuncu elendiğini
   * anlamıyordu. Ayrıca cue kuyruğu ~950 ms sonra boşaldığında efekt yeniden
   * kurulup gecikmeyi sıfırdan başlatmasın diye cue'nun VARIŞ ANI latch'lenir.
   */
  const localDead = Boolean(localPlayer && !localPlayer.alive);
  const [shotVisible, setShotVisible] = useState(false);
  const [shotFresh, setShotFresh] = useState(false);
  /** Kendi ölüm cue'sunun yerel varış anı (ms). `null` = cue görülmedi. */
  const shotCueAt = useRef<number | null>(null);
  useEffect(() => {
    if (!localDead) {
      shotCueAt.current = null;
      setShotVisible(false);
      setShotFresh(false);
      return;
    }
    const fresh = room.cues.some(
      (cue) => cue.kind === 'player_eliminated' && cue.playerId === view.localPlayerId && cue.revision === view.revision,
    );
    if (fresh && shotCueAt.current === null) shotCueAt.current = performance.now();

    const at = shotCueAt.current;
    if (at === null) {
      // Cue'suz dal: katman ANINDA ve kalıcı (animasyonsuz giriş).
      setShotVisible(true);
      setShotFresh(false);
      return;
    }
    /**
     * D21/I — `shotFresh` yalnız GİRİŞ penceresinde true kalır.
     *
     * Eskiden cue bir kez latch'lendiğinde `shotFresh` sonsuza kadar true
     * kalıyordu: giriş animasyonu (en uzunu `shot-title`, 3600 ms) bittikten
     * sonra bile `data-shot="fired"` yazıyor ve `data-fresh="true"` CSS
     * animasyonu asılı duruyordu; kalıcı dal ile tanı çıktısı ayırt
     * edilemiyordu. Artık ateş anı + giriş süresi geçtiğinde kalıcı dala
     * düşer (görsel süreklilik için `.shot-layer__card` dinlenme opaklığı
     * animasyonun bitiş değeriyle aynı: 0,85).
     */
    const since = performance.now() - at;
    const untilVisible = EXECUTION_FIRE_MS - since;
    const untilPersistent = EXECUTION_FIRE_MS + SHOT_ENTER_MS - since;
    setShotFresh(untilPersistent > 0);
    const timers: number[] = [];
    if (untilVisible <= 0) setShotVisible(true);
    else timers.push(window.setTimeout(() => setShotVisible(true), untilVisible));
    if (untilPersistent > 0) {
      timers.push(window.setTimeout(() => setShotFresh(false), untilPersistent));
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [localDead, room.cues, view.localPlayerId, view.revision]);

  // Oyun sonu kontrolleri de aynı odak/onay modelinden yönetilir (§2A).
  const extraTargets = useMemo<FocusTarget[]>(() => {
    if (!gameOver || !isHost) return [];
    return [
      {
        kind: 'command',
        id: 'play_again',
        label: translate('game.playAgain'),
        requiresConfirmation: false,
        run: () => room.playAgain(),
      },
      {
        kind: 'command',
        id: 'return_lobby',
        label: translate('game.returnLobby'),
        requiresConfirmation: false,
        run: () => room.returnToLobby(),
      },
    ];
  }, [gameOver, isHost, room.playAgain, room.returnToLobby]);

  const lockedAt = immersive.locked ? immersive.lockedAt : null;

  /**
   * Kamera durumunun TEK yolu (CODEX-017/3). Sahnedeki "Kendi koltuğum"
   * düğmesi de `V` kısayolu da buraya gelir; tercih olarak saklanır.
   */
  const applyCamera = useCallback(
    (next: 'overview' | 'seat') => {
      setPrefs({ cameraMode: next });
      room.onIntent({ type: 'set_camera', target: next });
    },
    [setPrefs, room.onIntent],
  );

  const handleCamera = useCallback(() => {
    applyCamera(prefs.cameraMode === 'seat' ? 'overview' : 'seat');
  }, [applyCamera, prefs.cameraMode]);

  // Sahne niyetleri: kamera burada tüketilir, seçim kilitten hemen sonra yutulur.
  const guardedOnIntent = useCallback(
    (intent: SceneIntent) => {
      if (intent.type === 'set_camera') {
        applyCamera(intent.target);
        return;
      }
      if (
        intent.type === 'select_option' &&
        lockedAt != null &&
        performance.now() - lockedAt < LOCK_GRACE_MS
      ) {
        return;
      }
      room.onIntent(intent);
    },
    [room.onIntent, lockedAt, applyCamera],
  );

  // Pointer Lock etkinken göreli fare deltasını sahne denetleyicisine ilet
  // (hassasiyet + sınır + kamera sahnede; §2A).
  useEffect(() => {
    if (!immersive.locked || !controller) return;
    const onMove = (e: MouseEvent) => controller.lookBy(e.movementX, e.movementY);
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [immersive.locked, controller]);

  /**
   * Sahnenin kendi düğme şeridi (`.st-inspection-nav`) dar ekranda alt çubuğun
   * hemen üstüne iner (C2-b/6). Konumu CSS `--st-nav-bottom` ile verilir; alt
   * çubuğun yüksekliği seçenek sayısına ve sarmalara göre değiştiği için
   * ÖLÇÜLÜR. Değişkeni yalnız değer değişince yazarız.
   */
  const navOffsetRef = useRef(-1);
  const hudTopRef = useRef(-1);
  const syncHudMetrics = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const footer = footerRef.current;
    if (footer) {
      const next = Math.round(footer.offsetHeight) + 6;
      if (next !== navOffsetRef.current) {
        navOffsetRef.current = next;
        root.style.setProperty('--st-nav-bottom', `${next}px`);
      }
    }
    const header = headerRef.current;
    if (header) {
      // D11: HİÇBİR katman sabit piksel ofsetiyle araç çubuğunu varsaymaz.
      // Rol paneli, ipucu ve duyuru bu ölçülen yükseklikten iner.
      const next = Math.round(header.offsetHeight);
      if (next !== hudTopRef.current) {
        hudTopRef.current = next;
        root.style.setProperty('--hud-top', `${next}px`);
      }
    }
  }, []);

  // Her render sonrası eşitle (seçenekler/onay satırı değişince yükseklik değişir).
  useEffect(syncHudMetrics);
  // Ayrıca yazı tipi yüklenmesi / döndürme gibi React dışı değişimler için.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncHudMetrics);
    if (footerRef.current) observer.observe(footerRef.current);
    if (headerRef.current) observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [syncHudMetrics]);

  const openMenu = useCallback(() => {
    setMenuOpen(true);
    immersive.releaseLock();
  }, [immersive]);

  /**
   * D11 odak modeli — klavye odağı oyun kabındadır.
   *
   * Fareyle tıklanan HUD düğmesi DOM odağını ALMAZ (`mousedown` varsayılanı
   * engellenir) ve odak hemen kaba döner. Böylece Enter onayı asla "Odağı
   * bırak" düğmesini tıklayamaz; tam ekran + Pointer Lock kazayla düşmez.
   * Tab ile gezinen kullanıcı etkilenmez: `:focus-visible` yolu korunur ve
   * `useTableControls` o durumda Enter'ı native bırakır.
   */
  const focusGame = useCallback(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  const keepGameFocus = useCallback(
    (event: React.MouseEvent) => {
      const el = event.target instanceof HTMLElement ? event.target : null;
      if (!el || typeof el.closest !== 'function') return;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!el.closest('button, a, [role="button"]')) return;
      event.preventDefault();
      focusGame();
    },
    [focusGame],
  );

  // Immersive'e girince (kilit ya da yalnız tam ekran) odak oyun kabına taşınır.
  const immersiveActive = immersive.locked || immersive.fullscreen;
  useEffect(() => {
    if (!immersiveActive) return;
    focusGame();
  }, [immersiveActive, focusGame]);

  /**
   * D15 — "Tahta" düğmesi ve `B`. Koltuktayken tahtaların üstüne EĞİLİR
   * (birinci şahıstan çıkılmaz); genel masada eski tepeden inceleme açılır.
   */
  const seatCamera = prefs.cameraMode === 'seat';
  const toggleBoard = useCallback(() => {
    setBoardInspection((cur) => (cur !== 'off' ? 'off' : seatCamera ? 'lean' : 'fascist'));
    if (room.rolePanelOpen) room.onIntent({ type: 'inspect_own_role', open: false });
  }, [room.onIntent, room.rolePanelOpen, seatCamera]);

  /**
   * Eğilme koltuk kamerasına aittir: genel bakışa geçişte kapanır. Oyun sonunda
   * her türlü tahta incelemesi kapanır. Faz değişimi / yeniden bağlanma eğilmeyi
   * BOZMAZ (durum burada, sahnenin oturum sıfırlamasında değil).
   */
  useEffect(() => {
    if (gameOver) setBoardInspection('off');
    else if (!seatCamera) setBoardInspection((cur) => (cur === 'lean' ? 'off' : cur));
  }, [seatCamera, gameOver]);

  const lean = useMemo(
    () => ({ available: seatCamera && !gameOver, active: boardInspection === 'lean' }),
    [seatCamera, gameOver, boardInspection],
  );

  /**
   * D16 — yerel jest. Kanal (`room.sendEmote`) ile aynı anda ilk şahıs katmanına
   * verilir; sahne `seq` ile bir kez oynatır ve süresi dolunca kendi düşürür.
   * Durum burada tutulur ki sahne yeniden mount olsa bile eski jest oynamasın.
   */
  const [localEmote, setLocalEmote] = useState<EmoteSignal | null>(null);
  const emoteSeq = useRef(0);
  const emoteAvailable = !gameOver && room.connection === 'connected' && !view.paused;
  const handleEmote = useCallback(
    (kind: EmoteKind) => {
      // Hız sınırı kanaldadır: yutulan jest yerelde de oynatılmaz.
      if (!room.sendEmote(kind)) return;
      emoteSeq.current += 1;
      setLocalEmote({ kind, seq: emoteSeq.current, at: Date.now() });
    },
    [room.sendEmote],
  );
  useEffect(() => {
    if (!localEmote) return;
    const timer = window.setTimeout(() => setLocalEmote(null), EMOTE_MAX_DURATION_MS + 200);
    return () => window.clearTimeout(timer);
  }, [localEmote]);
  useEffect(() => { if (!emoteAvailable) setLocalEmote(null); }, [emoteAvailable]);

  const wheel = useEmoteWheel({
    onEmote: handleEmote,
    locked: immersive.locked,
    enabled: emoteAvailable && !menuOpen,
    // D18 madde 5: faz değişince çark kendiliğinden kapanır.
    phaseKey: view.phaseId,
  });
  const emoteControls = useMemo(
    () => ({
      open: wheel.open,
      available: emoteAvailable,
      press: wheel.press,
      release: wheel.release,
      close: wheel.close,
      step: wheel.step,
      commit: wheel.commit,
      pick: wheel.pick,
    }),
    [wheel.open, emoteAvailable, wheel.press, wheel.release, wheel.close, wheel.step, wheel.commit, wheel.pick],
  );

  const controls = useTableControls({
    enabled: !menuOpen,
    view,
    selection: room.selection,
    rolePanelOpen: room.rolePanelOpen,
    extraTargets,
    controller,
    sceneTargets,
    lockedAt,
    onIntent: room.onIntent,
    submitSelected: room.submitSelected,
    clearSelection: room.clearSelection,
    onCamera: handleCamera,
    lean,
    onLeanBoard: toggleBoard,
    onMenu: openMenu,
    emotes: emoteControls,
  });

  const status = useMemo(() => statusLine(view, room.cues), [view, room.cues]);
  const connectionLabel =
    room.connection === 'connected' ? null : (connectionText(room.connection)?.label ?? null);

  /** Sıra sendeyken HUD asla gizlenmez (D11). */
  const yourTurn = status.tone === 'you';

  useEffect(() => {
    if (!immersive.locked || menuOpen || yourTurn) {
      setHudIdle(false);
      return;
    }
    let timer = 0;
    const arm = () => {
      setHudIdle((idle) => (idle ? false : idle));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHudIdle(true), HUD_IDLE_MS);
    };
    arm();
    window.addEventListener('mousemove', arm);
    window.addEventListener('mousedown', arm);
    window.addEventListener('wheel', arm);
    window.addEventListener('keydown', arm);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', arm);
      window.removeEventListener('mousedown', arm);
      window.removeEventListener('wheel', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [immersive.locked, menuOpen, yourTurn]);

  /** Tam ekrana İLK girişte kısa tuş ipucu; `usePrefs` ile bir kez hatırlanır. */
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const hintShownRef = useRef(false);
  useEffect(() => {
    if (!immersive.fullscreen || hintShownRef.current) return;
    hintShownRef.current = true;
    if (prefsRef.current.fullscreenHintSeen) return;
    setPrefs({ fullscreenHintSeen: true });
    setHintVisible(true);
    const timer = window.setTimeout(() => setHintVisible(false), FULLSCREEN_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [immersive.fullscreen, setPrefs]);

  /** Sağ üst araç çubuğu: özel alan ve tahta incelemesi karşılıklı dışlar. */
  const hasPrivate =
    view.phase !== 'game_over' &&
    Boolean(
      view.privateView.role ||
        view.privateView.hand.length ||
        view.privateView.inspection ||
        view.phase === 'voting',
    );

  const togglePrivate = useCallback(() => {
    const next = !room.rolePanelOpen;
    if (next) setBoardInspection('off');
    room.onIntent({ type: 'inspect_own_role', open: next });
  }, [room.onIntent, room.rolePanelOpen]);


  return (
    <div
      className="game"
      ref={containerRef}
      // Klavye odağının immersive'deki evi (D11). Görsel bir odak halkası yok.
      tabIndex={-1}
      data-immersive={immersive.locked ? 'locked' : immersive.fullscreen ? 'fullscreen' : 'off'}
      data-hud-idle={hudIdle ? 'true' : 'false'}
    >
      <SceneFrame
        view={view}
        cues={room.cues}
        selection={room.selection}
        onIntent={guardedOnIntent}
        quality={prefs.quality}
        reducedMotion={prefs.reducedMotion}
        soundEnabled={prefs.soundEnabled}
        rolePanelOpen={room.rolePanelOpen}
        resetEpoch={room.resetEpoch}
        // D11: tek sağ üst araç çubuğu HUD'da; sahne kendi şeridini çizmez.
        showInspectionNav={false}
        language={prefs.language}
        boardInspection={boardInspection}
        onBoardInspectionChange={setBoardInspection}
        immersive={{
          active: immersive.locked,
          cameraMode: prefs.cameraMode,
          pointerLocked: immersive.locked,
          sensitivity: prefs.sensitivity,
          inspectOpen: room.rolePanelOpen,
          suspended: Boolean(view.paused) || room.connection !== 'connected',
          peers: room.peerViewpoints,
          emote: localEmote,
          onLocalViewpoint: room.sendViewpoint,
          onController: setController,
          onTargetsChange: setSceneTargets,
          needsResume: immersive.needsResume,
        }}
      />

      <header className="game__top" ref={headerRef} onMouseDown={keepGameFocus}>
        <p
          className={`statusbar statusbar--${status.tone}`}
          role="status"
          aria-live="polite"
          aria-label={statusLineText(status)}
        >
          <span className="statusbar__phase">{status.headline}</span>
          {status.detail ? <span className="statusbar__detail">{status.detail}</span> : null}
        </p>
        <div className="game__tools" role="toolbar" aria-label={t('game.tools')}>
          {/* Kamera + inceleme: eskiden sahne paketinin kendi sağ üst şeridiydi
              (`.st-inspection-nav`); artık TEK araç çubuğu burada (D11). */}
          <div className="game__tool-group" role="group" aria-label={t('game.cameraGroup')}>
            <button
              type="button"
              className="btn-tool"
              aria-pressed={prefs.cameraMode === 'overview'}
              onClick={() => applyCamera('overview')}
            >
              {t('game.overview')}
            </button>
            <button
              type="button"
              className="btn-tool"
              aria-pressed={prefs.cameraMode === 'seat'}
              onClick={() => applyCamera('seat')}
            >
              {t('game.seat')}
            </button>
            {hasPrivate ? (
              <button
                type="button"
                className="btn-tool"
                aria-pressed={room.rolePanelOpen}
                onClick={togglePrivate}
              >
                {t('game.privateArea')}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-tool"
              aria-pressed={boardInspection !== 'off'}
              onClick={toggleBoard}
            >
              {t('game.board')}
            </button>
          </div>
          {coarsePointer ? (
            // Dokunmatik: Pointer Lock yok. Fullscreen API varsa yalnız tam
            // ekran; iOS Safari gibi desteklemeyen tarayıcıda hiç düğme yok.
            immersive.fullscreenSupported ? (
              immersive.fullscreen ? (
                <button type="button" className="btn-ghost" onClick={immersive.exit}>
                  {t('game.exitFullscreen')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-focus"
                  onClick={immersive.enterFullscreenOnly}
                >
                  {t('game.fullscreen')}
                </button>
              )
            ) : null
          ) : immersive.supported ? (
            immersive.needsResume ? (
              <button type="button" className="btn-focus" onClick={immersive.resume}>
                {t('game.enableLook')}
              </button>
            ) : immersive.fullscreen || immersive.locked ? (
              <button type="button" className="btn-ghost" onClick={immersive.exit}>
                {t('game.releaseFocus')}
              </button>
            ) : (
              <button type="button" className="btn-focus" onClick={immersive.enter}>
                {t('game.focusGame')}
              </button>
            )
          ) : null}
          <span
            className={`dot ${
              room.connection === 'connected'
                ? 'dot--on'
                : room.connection === 'reconnecting'
                  ? 'dot--warn'
                  : 'dot--off'
            }`}
            title={connectionLabel ?? t('connection.connected')}
            aria-label={connectionLabel ?? t('connection.connected')}
          />
          <button type="button" className="btn-ghost" onClick={openMenu}>
            {t('game.menu')} <kbd>M</kbd>
          </button>
        </div>
      </header>

      {hintVisible ? (
        <p className="game__hint" role="status">
          {t('game.fullscreenHint', { enter: 'Enter', esc: 'Esc', m: 'M' })}
        </p>
      ) : null}

      {prefs.announcements ? (
        <Announcer view={view} cues={room.cues} reducedMotion={prefs.reducedMotion} />
      ) : null}

      {shotVisible ? (
        <div
          className="shot-layer"
          data-fresh={shotFresh && !prefs.reducedMotion ? 'true' : 'false'}
          // D18 — otomatik doğrulama için: cue'lu giriş mi, kalıcı durum mu.
          data-shot={shotFresh ? 'fired' : 'persistent'}
          aria-hidden="true"
        >
          <div className="shot-layer__vignette" />
          {/* D18 madde 2: başlık cue'ya bağlı DEĞİL; `!alive` sürdükçe kalır. */}
          <div className="shot-layer__card">
            <strong className="shot-layer__title">{t('game.shotTitle')}</strong>
            <span className="shot-layer__note">{t('game.shotNote')}</span>
          </div>
        </div>
      ) : null}

      {room.connection !== 'connected' ? (
        <div className="game__banner">
          <ConnectionBanner status={room.connection} />
        </div>
      ) : null}

      {room.rolePanelOpen ? (
        <div className="game__role-layer">
          <RolePanel view={view} open onOpenChange={room.setRolePanelOpen} />
        </div>
      ) : null}

      {immersive.needsResume ? (
        <div className="scene-frame__resume">
          <p>{t('game.lookLocked')}</p>
          <button type="button" onClick={immersive.resume}>
            {t('game.enableLook')}
          </button>
        </div>
      ) : null}

      {gameOver ? (
        <div className="game-over" role="dialog" aria-labelledby="game-over-title">
          <div className="game-over__card">
            <h2 id="game-over-title" className="panel__title">
              {t('game.overTitle')}
            </h2>
            {view.result ? (
              <>
                <p className="notice notice--result" role="status">
                  <strong>{winnerName(view.result.winner)}</strong>
                  <span> — {endReasonName(view.result.reason)}</span>
                </p>
                <ul className="list">
                  {view.result.revealedRoles.map((r) => (
                    <li key={r.playerId}>
                      {view.players.find((p) => p.playerId === r.playerId)?.displayName ??
                        t('common.player')}
                      : {roleName(r.role)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {isHost ? (
              <div className="row">
                <button type="button" onClick={() => room.playAgain()}>
                  {t('game.playAgain')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => room.returnToLobby()}>
                  {t('game.returnLobby')}
                </button>
              </div>
            ) : (
              <p className="muted">{t('game.hostRestart')}</p>
            )}
          </div>
        </div>
      ) : null}

      <EmoteWheel wheel={wheel} />

      <footer className="game__bottom" ref={footerRef} onMouseDown={keepGameFocus}>
        {coarsePointer && emoteAvailable ? (
          <div className="actionbar__touch">
            <button type="button" className="btn-tool" aria-pressed={wheel.open} onClick={wheel.toggle}>
              {t('game.emote')}
            </button>
          </div>
        ) : null}
        <ActionBar
          view={view}
          hud={controls.hud}
          targets={controls.targets}
          focusIndex={controls.focusIndex}
          stage={controls.stage}
          busy={room.busyActionId != null}
          blocked={room.connection === 'disconnected'}
          transient={room.transient}
          onActivate={controls.activateAt}
          onSubmit={controls.submit}
          onCancel={controls.cancel}
        />
      </footer>

      <GameMenu
        open={menuOpen}
        view={view}
        connectionLabel={connectionLabel}
        prefs={prefs}
        setPrefs={setPrefs}
        canResume={immersive.fullscreen && !coarsePointer}
        canExitFocus={immersive.fullscreen || immersive.locked}
        isHost={isHost}
        onClose={() => setMenuOpen(false)}
        onResume={() => {
          setMenuOpen(false);
          immersive.resume();
        }}
        onExitFocus={() => {
          setMenuOpen(false);
          immersive.exit();
        }}
        onReturnLobby={() => {
          setMenuOpen(false);
          room.returnToLobby();
        }}
        onRefresh={() => room.refresh()}
      />
    </div>
  );
}
