// @refresh reset
import { useSceneCues } from './animation/useSceneCues';
import { RevealCard } from './animation/RevealCard';
import { CueEffects } from './animation/CueEffects';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { VIEWPOINT_STALE_MS, VIEWPOINT_YAW_LIMIT } from '@secret-table/contracts';
import type { HeadViewpoint, TableSceneProps } from '@secret-table/contracts';
import { SceneMaterials } from './materials/SceneMaterials';
import { room } from './materials/palette';
import { Table } from './objects/Table';
import { Chair } from './objects/Chair';
import { Nameplate, NameplateLayer } from './objects/Nameplate';
import { VOTE_REVEAL_MS, voteBadgeState } from './objects/voteState';
import type { VoteBadgeState } from './objects/voteState';
import { Room, ROOM_LIGHTS } from './room/Room';
import { CharacterAvatar } from './characters/CharacterAvatar';
import { PublicArms } from './live/PublicArms';
import { ShootingArm } from './live/ShootingArm';
import { EmoteArms } from './live/EmoteArms';
import { EMOTE_TWO_HANDED, EmoteRegistry } from './live/EmoteOverlay';
import { OfficeHand } from './live/OfficeHand';
import { officeHandState, pickOfficeHandCue } from './live/officeHands';
import { aimYaw, executionActorId, executionReadyActorId, executionShooterId, slumpSideAway } from './animation/execution';
import { HandRig } from './prototype/HandRig';
import { Targeting, TargetZone } from './live/Targeting';
import { useLocalMotion } from './live/useLocalMotion';
import { useSceneControls } from './live/useSceneControls';
import { sceneSlots } from './live/inputs';
import { PeerHeads, PeerHeadsBridge } from './live/PeerHeads';
import { cueOfficePlayerId, sceneIdentity } from './animation/cues';
import { PolicyBoard } from './objects/PolicyBoard';
import { ElectionMarker } from './objects/ElectionMarker';
import { CardStack } from './objects/CardStack';
import { RoleEnvelope } from './objects/RoleEnvelope';
import { PrivateArea } from './objects/PrivateArea';
import { layoutSeats, seatAvatar } from './layout/seats';
import './layout/inspection.css';
import type { InspectionMode } from './layout/cameraFraming';
import { SeatCamera } from './prototype/SeatCamera';
import { SceneDiagnostics } from './layout/SceneDiagnostics';
import { availableSceneActions, boardInspectionForMode, boardInspectionForToggle, inspectionNavVisible, pickOption, publicSeatCard, resolveInspectionMode, roleToggleIntent, selectedSceneOption } from './layout/presentation';
import type { BoardInspection } from './layout/presentation';
import { SceneLanguageContext, sceneText, type SceneLanguage } from './i18n/sceneText';

/** Boş akran listesi sabit kimlikte kalsın (gereksiz kare istemesin). */
const EMPTY_PEERS: readonly HeadViewpoint[] = [];

/**
 * Sözleşme DIŞI, yalnız paket sınırında yaşayan yerleşim propsları (D11).
 *
 * `packages/contracts` DEĞİŞMEZ: bunlar sahnenin kendi HTML kaplaması için;
 * oyun durumu, yetkili görünüm ya da ağ sözleşmesiyle ilgisi yok.
 */
export type TableSceneLayoutProps = {
  /**
   * Sahnenin kendi sağ üst kamera/inceleme şeridi (`.st-inspection-nav`).
   * Üretimde uygulama TEK sağ üst araç çubuğunu çizer → `false`.
   * Varsayılan `true`: `/dev/scene` ve prototip sayfaları bozulmaz.
   */
  showInspectionNav?: boolean;
  /** Verilirse tahta incelemesi UYGULAMA denetimlidir (tek kaynak). */
  boardInspection?: BoardInspection;
  /** Sahne içi düğme tahta incelemesini değiştirince uygulamaya bildirir. */
  onBoardInspectionChange?: (next: BoardInspection) => void;
  /**
   * D23 — oyuncunun dili. Additive ve İSTEĞE BAĞLI: varsayılan `tr`, bu yüzden
   * fixtures, prototip sayfaları ve mevcut testler değişmez. Sözleşme dil
   * bilmez; bu yalnız sahnenin çizdiği metinleri seçer.
   */
  language?: SceneLanguage;
};

/** Public package entry. Only authorized view fields reach the scene. */
export function TableScene(props: TableSceneProps & TableSceneLayoutProps) {
  return <SceneLanguageContext.Provider value={props.language ?? 'tr'}>
    <SceneSession key={sceneIdentity(props.view)} {...props} />
  </SceneLanguageContext.Provider>;
}

/** One Canvas; readonly authorized view; no networking or game state transitions.
 * Cues decorate the current view; never drive or delay game transitions.
 */
function SceneSession({ view, cues, selection, onIntent, quality, reducedMotion, soundEnabled, rolePanelOpen, immersive, resetEpoch = 0, showInspectionNav, boardInspection, onBoardInspectionChange, language = 'tr' }: TableSceneProps & TableSceneLayoutProps) {
  const st = (key: Parameters<typeof sceneText>[1], params?: Readonly<Record<string, string | number>>) =>
    sceneText(language, key, params);
  const [localSeat, setLocalSeat] = useState(false);
  const [privateReady, setPrivateReady] = useState(false);
  const seatMode = immersive?.cameraMode !== undefined ? immersive.cameraMode === 'seat' : immersive?.active || localSeat;
  const pointerLocked = immersive?.pointerLocked ?? immersive?.active ?? false;
  const { active, played, audioStats, playLocal, visible } = useSceneCues(view, cues, reducedMotion, soundEnabled, resetEpoch, immersive?.suspended);
  const suspended = !!immersive?.suspended || !visible || !!view.paused || view.connection !== 'connected';
  const intent: typeof onIntent = (value) => { if (!controls.canPick()) return; if (value.type === 'select_option') playLocal('select'); onIntent(value); };
  const deal = active.find((a) => a.cue.kind === 'cards_dealt');
  const reveal = active.find((a) => a.cue.kind === 'votes_revealed');
  const ended = active.find((a) => a.cue.kind === 'game_ended');
  // D12/D27 — infaz: atıcı kamu geçmişinden (görev cue anında el değiştirmiş olur), hedef cue'nun kendisi.
  // D12 tur 3: hedef seçilirken de silah yetkili oyuncunun elindedir.
  const readyGunId = executionReadyActorId(view);
  const executionCue = active.find((a) => a.cue.kind === 'player_eliminated');
  const execution = executionCue && executionCue.cue.kind === 'player_eliminated'
    ? { motion: executionCue, targetId: executionCue.cue.playerId, shooterId: executionShooterId(view, executionCue.cue.playerId, cueOfficePlayerId(view, 'president')) }
    : undefined;
  // D5: motorda `election_result` aşaması yok — oylar açıldığı AN latch'lenir ve
  // rozetler faz ilerlese de en az VOTE_REVEAL_MS boyunca okunur kalır.
  const electionId = view.table.lastElection?.electionId ?? null;
  const revealLatch = useRef<{ electionId: string; at: number } | null>(null);
  if (reveal && electionId && revealLatch.current?.electionId !== electionId) revealLatch.current = { electionId, at: performance.now() };
  const revealedAt = revealLatch.current?.electionId === electionId ? (revealLatch.current?.at ?? null) : null;
  const [, setBadgeTick] = useState(0);
  useEffect(() => {
    if (revealedAt === null) return;
    const left = revealedAt + VOTE_REVEAL_MS - performance.now();
    if (left <= 0) return;
    const timer = setTimeout(() => setBadgeTick((t) => t + 1), left + 20);
    return () => clearTimeout(timer);
  }, [revealedAt]);
  const session = `${view.roomId}/${view.gameId}/${view.localPlayerId}/${view.phaseId}`;
  const [presentation, setPresentation] = useState({ session, mode: 'overview' as InspectionMode, index: 0, roleOpen: false });
  const previousEpoch = useRef(resetEpoch);
  // C3 ölçüm kancası: sürüklerken bu sayaç ARTMAMALIDIR (React render sayısı).
  const renders = useRef(0); renders.current += 1;
  // Tahta incelemesi uygulama denetimliyse (D11) tek kaynak odur; sahne kendi
  // `presentation.mode`unu yalnız denetimsiz (prototip / `/dev/scene`) kullanır.
  const controlledBoard = boardInspection !== undefined;
  const navVisible = inspectionNavVisible(showInspectionNav);
  const mode = resolveInspectionMode({
    inspectOpen: immersive?.inspectOpen,
    boardInspection,
    fallback: presentation.session === session ? presentation.mode : 'overview',
  });
  useLayoutEffect(() => { const reset = previousEpoch.current !== resetEpoch; previousEpoch.current = resetEpoch; setPresentation((p) => ({ ...p, session, mode: 'overview', roleOpen: !reset && p.session === session && p.roleOpen })); }, [immersive?.cameraMode, session, resetEpoch]);
  // Closing the app's private panel must not erase an explicit board inspection.
  useLayoutEffect(() => { if (immersive?.inspectOpen === false) setPresentation((p) => p.mode === 'private' ? { ...p, mode: 'overview' } : p); }, [immersive?.inspectOpen]);
  const count = view.privateView.hand.length || (view.privateView.inspection?.kind === 'policy_peek' ? view.privateView.inspection.upcoming.length : view.phase === 'voting' ? 2 : 1);
  const index = presentation.session === session ? Math.min(presentation.index, count - 1) : 0;
  const privateX = count > 1 ? (index - (count - 1) / 2) * (view.phase === 'voting' ? .37 : .34) : 0;
  const inspect = (next: InspectionMode, nextIndex = index) => {
    setPresentation({ session, mode: next, index: nextIndex, roleOpen });
    if (controlledBoard) onBoardInspectionChange?.(boardInspectionForMode(next));
    if (immersive?.inspectOpen !== undefined && next !== mode && (immersive.inspectOpen || next === 'private')) onIntent({ type: 'inspect_own_role', open: next === 'private' });
  };
  const roleOpen = Boolean(view.privateView.role) && (rolePanelOpen ?? (presentation.session === session && presentation.roleOpen));
  const seats = useMemo(() => layoutSeats(view), [view.players, view.localPlayerId, view.playerCountAtStart]);
  const targetSeat = execution ? seats.find((s) => s.player.playerId === execution.targetId) : undefined;
  // D17 — yasamada ofis sahibinin elinde kapalı sırtlar (yalnız faz + ofis).
  // Yerel oyuncunun KENDİ eli değişmez: gerçek kartlar zaten `HandRig`te.
  const officeHand = suspended || view.phase === 'lobby' ? null : officeHandState(view);
  /**
   * D21/E — kart hareketi cue'ları KOLTUK BAŞINA seçilir.
   *
   * Eski kod `active.find(cards_moved)` ile TEK cue alıyordu. Başkanın atma
   * turunda aynı sürümde İKİ `cards_moved` var (başkan→atık 1, başkan→şansölye
   * 2); ilki seçildiği için şansölye koltuğunda `officeHandFlow` her zaman
   * `null` dönüyor ve şansölyeye iki sırtın uçarak gelişi HİÇ oynamıyordu.
   * Artık her koltuk için O KOLTUĞU ilgilendiren ilk cue bulunur.
   */
  const cardsMovedFor = (playerId: string) => {
    if (suspended) return null;
    const picked = pickOfficeHandCue(view, active.map((a) => a.cue), playerId);
    return picked ? { entry: active[picked.index]!, flow: picked.flow } : null;
  };
  /** Akışın karşı ucunun DÜNYA noktası: deste / atık / öteki koltuğun kart yeri. */
  const flowTarget = (endpoint: 'deck' | 'discard' | 'president' | 'chancellor'): [number, number, number] | null => {
    if (endpoint === 'deck') return [-1.28, .10, -.07];
    if (endpoint === 'discard') return [1.28, .10, -.07];
    const seat = seats.find((s) => s.player.office === endpoint);
    return seat ? [seat.cards[0], .12, seat.cards[2]] : null;
  };
  const actions = availableSceneActions(view);
  const selected = selectedSceneOption(actions, selection);
  const controls = useSceneControls({ view, selection, seat: seatMode, pointerLocked, suspended, privateReady, inspectOpen: mode !== 'overview', lean: mode === 'lean', sensitivity: immersive?.sensitivity ?? 1, onLook: immersive?.onLocalViewpoint, onController: immersive?.onController, onTargetsChange: immersive?.onTargetsChange });
  const rig = useLocalMotion(view, selection, roleOpen, resetEpoch, suspended, reducedMotion, active);
  const peerHeads = useRef<PeerHeads | null>(null);
  const heads = (peerHeads.current ??= new PeerHeads());
  // D16 §4/§5 — jestler: uzak sinyaller ALICI saatinde latch'lenir (aynı `seq`
  // bir kez oynar), yerel jest ilk şahısta oynar. Sunucu/DB görmez.
  const emoteBox = useRef<EmoteRegistry | null>(null);
  const emotes = (emoteBox.current ??= new EmoteRegistry());
  const [, setEmoteTick] = useState(0);
  const emoteNow = performance.now();
  // D16 tur 2 — `clap` sesi: yalnız YENİ başlayan jestte, kamu ve yerel için bir kez.
  const clapPending = useRef(0);
  if (suspended) emotes.clear();
  else {
    for (const peer of immersive?.peers ?? EMPTY_PEERS) {
      if (peer.playerId !== view.localPlayerId && emotes.accept(peer.playerId, peer.emote, emoteNow) && peer.emote?.kind === 'clap') clapPending.current += 1;
    }
    const own = immersive?.emote ?? null;
    if (emotes.accept(view.localPlayerId, own, emoteNow) && own?.kind === 'clap') clapPending.current += 1;
  }
  const localEmote = suspended ? null : emotes.active(view.localPlayerId, emoteNow);
  const emoteEnd = emotes.nextEnd(emoteNow);
  useEffect(() => {
    if (emoteEnd === null) return;
    const timer = setTimeout(() => setEmoteTick((n) => n + 1), Math.max(0, emoteEnd - performance.now()) + 20);
    return () => clearTimeout(timer);
  }, [emoteEnd]);
  const clapCount = clapPending.current;
  useEffect(() => { if (clapCount > 0) playLocal('clap'); }, [clapCount]);
  const local = seats.find((seat) => seat.player.playerId === view.localPlayerId);
  const privateIndex = seatMode ? controls.index : index;
  const currentPrivateX = seatMode ? (privateIndex - (count - 1) / 2) * (view.phase === 'voting' ? .37 : .34) : privateX;
  const hasPrivate = Boolean(view.privateView.role || view.privateView.hand.length || view.privateView.inspection || view.phase === 'voting');
  // Baş üstü oy rozetleri (D5). Yalnız kamu alanları: `hasVoted` + `lastElection.votes`.
  const badgeNow = performance.now();
  const voteBadges: Record<string, VoteBadgeState | null> = {};
  let badgeCount = 0;
  for (const seat of seats) {
    const state = voteBadgeState({ view, player: seat.player, local: seat.player.playerId === view.localPlayerId, now: badgeNow, revealedAt });
    voteBadges[seat.player.playerId] = state;
    if (state) badgeCount += 1;
  }
  const toggleRole = () => {
    playLocal('turn'); setPresentation({ session, mode, index, roleOpen: !roleOpen });
    const request = roleToggleIntent(roleOpen, rolePanelOpen !== undefined); if (request) onIntent(request);
  };
  return <div {...controls.handlers} data-scene-camera={seatMode ? 'seat' : 'overview'} data-scene-nav={navVisible} data-scene-renders={renders.current} data-scene-locked={pointerLocked} data-scene-cues-played={played} data-scene-cues-active={active.length} data-scene-vote-badges={badgeCount} data-scene-office-hand={officeHand ? `${officeHand.office}:${officeHand.count}` : ''} data-scene-emotes={emotes.size} data-scene-emote-local={localEmote?.kind ?? ''} data-scene-audio-state={audioStats.state} data-scene-sounds-played={audioStats.played} data-scene-audio-voices={audioStats.voices} style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden', touchAction: seatMode ? 'none' : 'pan-y' }}>
    <Canvas style={{ position: 'absolute', inset: 0 }} frameloop="demand" dpr={quality === 'low' ? 1 : [1, 2]} shadows={quality === 'low' ? false : 'percentage'}
      camera={{ position: [0, 6, 6], fov: 40, near: .1, far: 100 }} gl={{ antialias: true, alpha: false }}>
      {/* D2: arka plan = sis rengi; sis uzaklığı odanın içinde kamera mesafesine göre (`room/Room.tsx`). */}
      <color attach="background" args={[room.fog]} />
      <SeatCamera mode={seatMode ? mode === 'private' ? 'inspect' : 'seat' : 'overview'} look={controls.look} chair={local?.chair ?? [0, -.74, 2]} yawLimit={VIEWPOINT_YAW_LIMIT} tableInspection={seatMode && mode === 'private' ? 'overview' : mode} privateX={currentPrivateX} reducedMotion={reducedMotion || suspended} onPrivateReady={setPrivateReady} /><SceneDiagnostics />
      <PeerHeadsBridge heads={heads} view={view} peers={immersive?.peers ?? EMPTY_PEERS} enabled={!suspended} staleAfter={VIEWPOINT_STALE_MS} />
      {/* D2 ışık planı: tek gölge kaynağı anahtar ışık; dolgu pencere yönünden "ay ışığı". */}
      <hemisphereLight args={[ROOM_LIGHTS.hemisphere.sky, ROOM_LIGHTS.hemisphere.ground, ROOM_LIGHTS.hemisphere.intensity]} />
      <directionalLight position={ROOM_LIGHTS.key.position} intensity={ROOM_LIGHTS.key.intensity} color={ROOM_LIGHTS.key.color} castShadow={quality !== 'low'}
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-4} shadow-camera-right={4}
        shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-.0003} shadow-normalBias={.018} />
      <directionalLight position={ROOM_LIGHTS.fill.position} intensity={ROOM_LIGHTS.fill.intensity} color={ROOM_LIGHTS.fill.color} />
      <Targeting enabled={seatMode && pointerLocked && privateReady && !suspended && mode === 'overview'} onTarget={controls.onTarget} onSlotsVisible={controls.onSlotsVisible}><SceneMaterials>
        <Room quality={quality === 'low' ? 'low' : 'standard'} seat={seatMode && mode !== 'liberal' && mode !== 'fascist'} overhead={seatMode && mode !== 'liberal' && mode !== 'fascist' && mode !== 'lean'} />
        <Table />
        <group position={[0, .01, -.4]}><PolicyBoard party="liberal" count={view.table.liberalPolicies} variant={view.boardVariant} enacted={view.table.enactedPolicies} quality={quality} active={active.find((a) => a.cue.kind === 'policy_enacted' && a.cue.board === 'liberal')} reducedMotion={reducedMotion} /></group>
        <group position={[0, .01, .16]}><PolicyBoard party="fascist" count={view.table.fascistPolicies} variant={view.boardVariant} enacted={view.table.enactedPolicies} quality={quality} active={active.find((a) => a.cue.kind === 'policy_enacted' && a.cue.board === 'fascist')} reducedMotion={reducedMotion} /></group>
        <group position={[0, .009, .57]}><ElectionMarker value={view.table.electionTracker} /></group>
        <group position={[-1.28, .009, -.07]}><CardStack count={view.table.drawCount} /></group>
        <group position={[1.28, .009, -.07]}><CardStack count={view.table.discardCount} discard /></group>
        <NameplateLayer>{seats.map((seat) => {
          const local = seat.player.playerId === view.localPlayerId;
          const pick = pickOption(actions, (option) => option.targetPlayerId === seat.player.playerId);
          const target = pick?.type === 'select_option' ? { actionId: pick.actionId, optionId: pick.optionId } : null;
          const aimed = target?.actionId === controls.hovered?.actionId && target?.optionId === controls.hovered?.optionId && !!target;
          const publicMove = active.find((a) => { const cue = a.cue; return cue.kind === 'votes_revealed' || (cue.kind === 'cards_moved' && (seat.player.playerId === cueOfficePlayerId(view, cue.from) || seat.player.playerId === cueOfficePlayerId(view, cue.to))) || (cue.kind === 'policy_enacted' && seat.player.office === 'chancellor'); });
          const badge = voteBadges[seat.player.playerId];
          // D16: yerel oyuncunun jesti kendi etiketinde/kolunda gösterilmez (ilk şahıstan görülür).
          const seatEmote = local ? null : emotes.active(seat.player.playerId, emoteNow);
          // D17: ofis eli yalnız o koltukta ve yerel olmayan oyuncuda çizilir.
          const seatOffice = !local && officeHand?.playerId === seat.player.playerId && !seatEmote ? officeHand : null;
          const seatMove = seatOffice ? cardsMovedFor(seat.player.playerId) : null;
          const seatFlow = seatMove?.flow ?? null;
          // D24: jest kolu da ara değerli pozu izler (kanal verisi aynı).
          const seatLook = () => { const head = heads.pose(seat.player.playerId); return { yaw: head?.yaw ?? 0, pitch: head?.pitch ?? 0 }; };
          const ballot = reveal && view.table.lastElection?.votes.find((v) => v.playerId === seat.player.playerId);
          const publicCard = ballot ? { kind: 'ballot' as const, vote: ballot.vote } : publicSeatCard(view, seat.player.playerId);
          return <group key={seat.player.playerId}>
            <group position={seat.chair} rotation={[0, seat.angle, 0]}>
              <Chair />
            </group>
            {(!local || !seatMode) && <group position={[seat.chair[0], 0, seat.chair[2]]} rotation={[0, seat.angle, 0]}>
              <CharacterAvatar {...seatAvatar(seat.player)} index={seat.player.seatIndex} heads={heads} playerId={seat.player.playerId} connected={seat.player.connected} alive={seat.player.alive}
                headPitchOffset={seatEmote?.kind === 'facepalm' ? -10 * Math.PI / 180 : 0}
                emote={seatEmote} lookOf={seatLook}
                slumpSide={slumpSideAway(seat, seats.find((s) => s.player.playerId === (executionActorId(view.table.publicHistory, seat.player.playerId) ?? (execution?.targetId === seat.player.playerId ? execution.shooterId : undefined))))}
                execution={execution?.targetId === seat.player.playerId ? execution.motion : undefined}
                reducedMotion={reducedMotion} quality={quality} staleAfter={VIEWPOINT_STALE_MS} />
              <PublicArms active={publicMove} reducedMotion={reducedMotion} {...seatAvatar(seat.player)} shooting={execution?.shooterId === seat.player.playerId || readyGunId === seat.player.playerId}
                emote={seatEmote ? (EMOTE_TWO_HANDED.has(seatEmote.kind) ? 'both' : 'right') : seatOffice ? 'right' : null} />
              {(readyGunId === seat.player.playerId || (execution?.shooterId === seat.player.playerId && targetSeat)) &&
                <ShootingArm active={execution?.shooterId === seat.player.playerId ? execution.motion : undefined} ready={readyGunId === seat.player.playerId}
                  yaw={targetSeat ? aimYaw(seat, targetSeat) : 0} {...seatAvatar(seat.player)} reducedMotion={reducedMotion} />}
              {seatOffice && <OfficeHand grip={seatOffice.grip} count={seatOffice.count} {...seatAvatar(seat.player)}
                flow={seatFlow} active={seatMove?.entry} target={seatFlow ? flowTarget(seatFlow.endpoint) : null}
                flight={seatMode}
                reducedMotion={reducedMotion} quality={quality === 'low' ? 'low' : 'standard'} />}
              {seatEmote && <EmoteArms emote={seatEmote} {...seatAvatar(seat.player)} reducedMotion={reducedMotion}
                lookOf={seatLook} onEnd={() => setEmoteTick((n) => n + 1)} />}
              <TargetZone selection={target} size={[.64, 1.00, .52]} position={[0, .20, 0]} />
            </group>}
            {(!local || !seatMode) && <group position={seat.label}>
              <Nameplate player={seat.player} local={local} aimed={aimed} lobby={view.phase === 'lobby'}
                vote={badge} emote={seatEmote?.kind ?? null} reducedMotion={reducedMotion}
                targetable={actions.some((action) => action.options.some((opt) => opt.targetPlayerId === seat.player.playerId))}
                selected={selected?.targetPlayerId === seat.player.playerId}
                onPick={() => intent(pickOption(actions, (option) => option.targetPlayerId === seat.player.playerId) ?? { type: 'focus_player', playerId: seat.player.playerId })}>
                <TargetZone selection={target} size={[.60, .18, .02]} />
              </Nameplate>
            </group>}
            {!(local && seatMode && (rig.pose === 'vote' || rig.pose === 'voted') && publicCard.kind === 'ballot') && (!local || !hasPrivate || publicCard.kind === 'role' || (publicCard.kind === 'ballot' && (view.phase === 'election_result' || !!ballot))) && view.phase !== 'lobby' && <group position={local && ballot && hasPrivate ? [-1.04, .07, .91] : seat.cards} scale={.8}>
              {publicCard.kind === 'role' ? <RevealCard art={{ kind: 'role', role: publicCard.role }} active={ended} reducedMotion={reducedMotion} /> : publicCard.kind === 'ballot' ? <RevealCard art={publicCard.vote ? { kind: 'ballot', vote: publicCard.vote } : { kind: 'back' }} active={reveal} reducedMotion={reducedMotion} /> : <RoleEnvelope />}
            </group>}
          </group>;
        })}</NameplateLayer>
        {view.phase !== 'game_over' && !seatMode && !suspended && <PrivateArea view={view} actions={actions} selection={selection} onIntent={intent} deal={deal}
          reducedMotion={reducedMotion} roleOpen={roleOpen} onToggleRole={toggleRole} />}
        {/* D15: eğilmede eller kadraj dışıdır; hiç çizilmez. */}
        {seatMode && mode !== 'lean' && view.phase !== 'game_over' && <HandRig state={rig} view={view} quality={quality} mode={privateReady && !suspended && (mode === 'overview' || mode === 'private') ? mode === 'private' ? 'inspect' : 'seat' : 'overview'} reducedMotion={reducedMotion} production
          emote={localEmote} look={controls.look} skin={local ? seatAvatar(local.player).skin : undefined}
          slots={suspended ? [] : sceneSlots(view)} aimed={controls.hovered} inspectedIndex={mode === 'private' ? controls.index : -1} onSelect={(i) => { const option = controls.controller.selectSlot(i); if (option) intent({ type: 'select_option', ...option }); }} />}
        <CueEffects active={seatMode ? active.filter((a) => a.cue.kind !== 'cards_moved') : active} view={view} reducedMotion={reducedMotion} />
      </SceneMaterials></Targeting>
    </Canvas>
    {seatMode && pointerLocked && privateReady && mode === 'overview' && !suspended && <div className="st-reticle" data-target={Boolean(controls.hovered)} aria-hidden="true" />}
    {navVisible && <nav className="st-inspection-nav" aria-label={st('nav.inspectBoard')}>
      <button type="button" aria-pressed={seatMode} onClick={() => { setLocalSeat(!seatMode); inspect('overview'); onIntent({ type: 'set_camera', target: seatMode ? 'overview' : 'seat' }); }}>{seatMode ? st('nav.overview') : st('nav.seat')}</button>
      {mode !== 'overview' && <button type="button" onClick={() => inspect('overview')}>{st('nav.backToTable')}</button>}
      {hasPrivate && mode !== 'private' && view.phase !== 'game_over' && <button type="button" onClick={() => inspect('private')}>{st('nav.inspectPrivate')}</button>}
      <button type="button" aria-pressed={mode === 'liberal' || mode === 'fascist' || mode === 'lean'} onClick={() => { const next = boardInspectionForToggle(boardInspectionForMode(mode), seatMode); inspect(next === 'off' ? 'overview' : next); }}>{seatMode ? st('nav.leanBoard') : st('nav.inspectBoard')}</button>
      {(mode === 'overview' || mode === 'private') && view.privateView.role && !view.privateView.hand.length && !view.privateView.inspection && view.phase !== 'voting' && view.phase !== 'game_over' && <button type="button" aria-pressed={roleOpen} onClick={toggleRole}>{roleOpen ? st('nav.identityClose') : st('nav.identityOpen')}</button>}
    </nav>}
    {mode !== 'overview' && mode !== 'lean' && <div className="st-inspection-detail" data-private={mode === 'private'}>
      {mode === 'private' ? <>
        {count > 1 && <button type="button" aria-label={st('nav.prevCard')} onClick={() => seatMode ? controls.controller.inspectBy(-1) : inspect('private', (index + count - 1) % count)}>←</button>}
        <div className="st-inspection-caption">{count > 1 ? st('nav.cardCount', { index: privateIndex + 1, total: count }) : st('nav.privateArea')}<small>{st('nav.inspectOnly')}</small></div>
        {count > 1 && <button type="button" aria-label={st('nav.nextCard')} onClick={() => seatMode ? controls.controller.inspectBy(1) : inspect('private', (index + 1) % count)}>→</button>}
      </> : <>
        <button type="button" aria-pressed={mode === 'liberal'} onClick={() => inspect('liberal')}>{st('nav.liberalCount', { count: view.table.liberalPolicies })}</button>
        <button type="button" aria-pressed={mode === 'fascist'} onClick={() => inspect('fascist')}>{st('nav.fascistCount', { count: view.table.fascistPolicies })}</button>
        <div className="st-inspection-caption">{mode === 'liberal' ? st('nav.liberalBoard') : st('nav.fascistBoard')}<small>{st('nav.boardNote')}</small></div>
      </>}
    </div>}
  </div>;
}
