import type { SceneView, SceneSelection } from '@secret-table/contracts';
import { handItems } from './handItems';
import { sceneIdentity } from '../animation/cues';
import { executionReadyActorId } from '../animation/execution';
import { INITIAL_RIG, gestureDuration, poseAfter } from '../prototype/model';
import type { Gesture, RigMotion, RigState } from '../prototype/model';
import { sampleRig } from '../prototype/rig';
import { availableSceneActions, selectedSceneOption } from '../layout/presentation';

/** Local accepted choreography, independent of the app's event delivery array.
 * Only the CURRENT view is ever handed to meshes; this retains opaque IDs, not faces. */
/** D27 — yetki fazı bitip cue gelene kadar geçen sürede silah "elde" sayılır. */
const GUN_HANDOFF_MS = 1500;

export class LocalMotion {
  state: RigState = { ...INITIAL_RIG };
  private scope = '';
  private epoch = -1;
  private revision = -1;
  private handIds: readonly string[] = [];
  private selectedId = '';
  private privateKey = '';
  private roleOpen = false;
  private interrupted = false;
  private voted = false;
  /** Elin BOŞALDIĞI sürüm ve o anki kart adedi (kamu bilgisi). Aynı sürümde gelen
   * kamu hareketi bu adedi "hayalet sırt" olarak oynatır; sürüm ilerleyince düşer. */
  private handoff = { count: 0, revision: -1 };
  private publicSeen = new Set<string>();
  /** D12 tur 3: silah hedef seçilirken zaten elimdeyse koreografi hazır pozdan başlar. */
  private gunHeld = false;
  private gunReleasedAt = -Infinity;
  private start(kind: Gesture, now: number, reduced: boolean, index = 0, ghostBacks = 0) {
    const from = sampleRig(this.state, now, reduced, this.handIds.length);
    this.state = poseAfter(this.state, kind, now, reduced, index, ghostBacks);
    if (this.state.motion && (kind === 'select' || kind === 'cancel')) this.state.motion.fromFrame = from;
  }
  update(view: SceneView, selection: SceneSelection | null, roleOpen: boolean, epoch: number, suspended: boolean, now: number, reduced: boolean): RigState {
    const scope = `${sceneIdentity(view)}/${view.phaseId}`;
    const ids = handItems(view).map((c) => c.id);
    const eligible = !suspended && !view.paused && view.connection === 'connected';
    const first = !this.scope;
    const privateKey = JSON.stringify([view.privateView.role, view.privateView.hand, view.privateView.inspection]);
    const reset = scope !== this.scope || epoch !== this.epoch || !eligible || this.interrupted;
    const changedHand = JSON.stringify(ids) !== JSON.stringify(this.handIds);
    const revisionChanged = view.revision !== this.revision;
    const selected = selectedSceneOption(availableSceneActions(view), selection);
    const index = selected?.cardId ? ids.indexOf(selected.cardId) : selected?.vote ? ids.indexOf(`local-ballot-${selected.vote}`) : -1;
    const selectedId = index >= 0 ? ids[index]! : '';
    const showRole = roleOpen && !!view.privateView.role && !ids.length && !view.privateView.inspection;
    // `hasVoted` kamu bilgisidir: kapalı oy kartı masada kalır (cue gerekmez).
    const hasVoted = view.players.find((p) => p.playerId === view.localPlayerId)?.hasVoted === true;
    const handedOff = eligible && changedHand && !ids.length && this.handIds.length > 0;
    const keepVoted = hasVoted && !ids.length && (view.phase === 'voting' ||
      (view.phase === 'election_result' && (this.state.pose === 'voted' || this.state.pose === 'vote')));
    if (reset || revisionChanged || changedHand || privateKey !== this.privateKey) {
      const previousSelected = this.state.selected;
      // D27: infaz koreografisi KAMU hareketidir; canlı oyunda 2,6 s içinde yeni sürüm
      // (sıradaki başkanın adaylığı, bot hamlesi) gelebilir. Oturum aynı ve bağlantı
      // sağlamken yarıda kesilmez; askı, kopma ve yeni oturum yine anında keser.
      const running = this.state.motion;
      const keepShot = eligible && !this.interrupted && epoch === this.epoch && running?.kind === 'shoot' &&
        now < running.startedAt + running.duration ? running : null;
      this.state = { ...INITIAL_RIG, pose: ids.length ? 'hold' : keepVoted ? 'voted' : 'rest', revision: this.state.revision + 1 };
      if (keepShot) this.state = { ...this.state, pose: 'aim', motion: keepShot };
      // Resync/reconnect never replay an old deal. A fresh authorized hand may animate.
      if (eligible && ids.length && (first || (!reset && changedHand && ids.some((id) => !this.handIds.includes(id))))) this.start('draw', now, reduced);
      // Oy onaylandı: ekranda duran kart masaya konur, yeni bir kart YARATILMAZ.
      if (handedOff && hasVoted && !this.voted && view.phase === 'voting') {
        this.start('ballot', now, reduced, Math.min(Math.max(previousSelected, 0), this.handIds.length - 1), this.handIds.length);
      }
      if (eligible && index >= 0) this.state = { ...this.state, pose: 'selected', selected: index, motion: null };
    }
    if (handedOff) this.handoff = { count: this.handIds.length, revision: view.revision };
    if (!eligible) this.handoff = { count: 0, revision: -1 };
    if (eligible && !reset && !changedHand && selectedId !== this.selectedId) {
      if (index >= 0) this.start('select', now, reduced, index);
      else if (this.selectedId && ids.length) this.start('cancel', now, reduced, this.state.selected);
    }
    // D12 tur 3: infaz yetkisi bendeyse silah hedef seçilirken de elde durur.
    const readyGun = eligible && !ids.length && executionReadyActorId(view) === view.localPlayerId;
    // D27: canlı oyunda cue, yetki fazı bittikten SONRAKİ sürümde gelir; silahın az önce
    // elde olduğu bilgisi koreografinin hazır pozdan başlaması için kısa süre saklanır.
    if (this.gunHeld && !readyGun) this.gunReleasedAt = now;
    if (readyGun) this.gunHeld = true;
    if (reset) this.gunHeld = readyGun;
    if (readyGun && !this.state.motion && this.state.pose !== 'aim') this.state = { ...this.state, pose: 'ready' };
    if (!readyGun && this.state.pose === 'ready') this.state = { ...INITIAL_RIG, pose: ids.length ? 'hold' : 'rest', revision: this.state.revision + 1 };
    if (eligible && showRole && !this.roleOpen && !reset) this.start('envelope', now, reduced);
    if (first && eligible && showRole) this.state = { ...this.state, pose: 'envelope', motion: null };
    if (!showRole && this.state.pose === 'envelope') this.state = { ...INITIAL_RIG, pose: ids.length ? 'hold' : 'rest', revision: this.state.revision + 1 };
    // D12 §8: infaz koreografisi azaltılmış hareketde de tam süre oynar.
    if (this.state.motion && ((reduced && this.state.motion.kind !== 'shoot') || now >= this.state.motion.startedAt + this.state.motion.duration)) this.state = { ...this.state, motion: null };
    // `aim` geçici pozdur: koreografi bitince el dinlenmeye döner.
    if (this.state.pose === 'aim' && !this.state.motion) this.state = { ...INITIAL_RIG, pose: ids.length ? 'hold' : 'rest', revision: this.state.revision + 1 };
    this.scope = scope; this.epoch = epoch; this.revision = view.revision; this.handIds = ids;
    this.selectedId = selectedId; this.roleOpen = roleOpen; this.privateKey = privateKey; this.interrupted = !eligible;
    this.voted = hasVoted;
    return this.state;
  }
  /**
   * D12 §4/§5 — infaz: yerel oyuncu ATICI ise (başkan) sağ el silahla kalkar.
   * Kamu cue'su bir kez tüketilir; kart, rol ya da özel oy bilgisi kullanılmaz.
   * Azaltılmış hareketde de tam süre oynar (§8), bu yüzden `poseAfter` değil
   * doğrudan hareket kurulur.
   */
  acceptExecution(id: string, aimYaw: number, now: number) {
    if (this.publicSeen.has(id) || this.interrupted || this.publicSeen.size >= 4096) return this.state;
    this.publicSeen.add(id);
    const motion: RigMotion = {
      // Silah hedef seçimi sırasında zaten eldeyse hareket HAZIR pozdan başlar.
      kind: 'shoot', from: this.gunHeld || now - this.gunReleasedAt < GUN_HANDOFF_MS ? 'ready' : this.state.pose,
      fromSelected: this.state.selected, selected: this.state.selected,
      duration: gestureDuration.shoot, startedAt: now, aimYaw,
    };
    this.state = { pose: 'aim', selected: this.state.selected, revision: this.state.revision + 1, motion };
    return this.state;
  }

  /** Public acceptance only. Uses no previous selected card or private vote. */
  acceptPublic(id: string, kind: 'place' | 'vote', now: number, reduced: boolean) {
    if (this.publicSeen.has(id) || this.interrupted || this.publicSeen.size >= 4096) return this.state;
    this.publicSeen.add(id);
    // Devir: el aynı sürümde boşaldıysa hareket o adet kapalı kartla oynanır.
    const ghosts = kind === 'place' && this.handoff.revision === this.revision ? this.handoff.count : 0;
    // Boş elden hayalet kart çıkmaz: adet bilinmiyorsa (resync/reconnect) hareket yok.
    if (kind === 'place' && !ghosts && !this.handIds.length) return this.state;
    // A canonical outer-edge pickup keeps the public flourish clear of the held
    // packet. It does not reuse or reveal the previously selected private card.
    this.start(kind, now, reduced, kind === 'place' ? Math.max(0, (ghosts || this.handIds.length) - 1) : 0, ghosts);
    return this.state;
  }
}
