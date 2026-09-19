/** Ephemeral private per-actor channels. RLS binds topic actor to auth.uid(). */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { EMOTE_COOLDOWN_MS, EMOTE_REPEAT_MS, type EmoteKind, type EmoteSignal, type HeadViewpoint, type LocalViewpoint } from '@secret-table/contracts';
import { getSupabaseClient } from './supabaseClient';
import { acceptHeadWire, parseHeadWire, viewpointInterval, viewpointTopic,
  type HeadCursor, type ViewpointScope } from './viewpointProtocol';

export type ViewpointChannel = {
  sync: (scope: ViewpointScope | null) => void;
  /** False means nothing was queued; never falls back to unauthenticated HTTP broadcast. */
  send: (viewpoint: HeadViewpoint) => boolean;
  /**
   * D16 — el jesti: hız sınırı (1,2 s) içinde değilse HEMEN bir paket, sonra
   * 250/600 ms'de aynı `seq` ile iki tekrar (kayıp telafisi). Bakış hız sınırını
   * atlar; alıcı aynı `seq`i bir kez oynatır.
   */
  sendEmote: (kind: EmoteKind) => boolean;
  reauth: () => Promise<void>;
  stop: () => void;
};

export function openViewpointChannel(options: {
  roomId: string;
  onPeer: (viewpoint: HeadViewpoint) => void;
  getToken?: () => Promise<string | null>;
  /** Presentation transport status; MUST NOT feed the game/API connectivity gate. */
  onIssue?: (issue: 'unavailable' | null) => void;
}): ViewpointChannel {
  const client = getSupabaseClient();
  if (!client) {
    // Supabase'siz (bellek) kipte yayın yok; jest yine YERELDE oynar. Hız sınırı
    // canlı kanaldakiyle aynıdır ki iki kipte davranış ayrışmasın.
    let lastLocalEmoteAt = -Infinity;
    const sendEmote = () => {
      const now = Date.now();
      if (now - lastLocalEmoteAt < EMOTE_COOLDOWN_MS) return false;
      lastLocalEmoteAt = now;
      return true;
    };
    return { sync: () => {}, send: () => false, sendEmote, reauth: async () => {}, stop: () => {} };
  }
  let stopped = false;
  let scope: ViewpointScope | null = null;
  let scopeKey = '';
  let generation = 0;
  let epoch = Date.now();
  let seq = 0;
  let lastSentAt = -Infinity;
  /** D16 — son bilinen yerel bakış: jest paketi bunu taşır (yeni bakış üretmez). */
  let lastLook: LocalViewpoint = { yaw: 0, pitch: 0 };
  /** Sayfa oturumu boyunca ARTAN jest sırası; kanal yeniden kurulunca sıfırlanmaz. */
  let emoteSeq = 0;
  let lastEmoteAt = -Infinity;
  const emoteTimers = new Set<ReturnType<typeof setTimeout>>();
  let issue: 'unavailable' | null = null;
  let work: Promise<void> = Promise.resolve();
  let authWork: Promise<boolean> = Promise.resolve(false);
  const channels = new Map<string, { channel: RealtimeChannel; ready: boolean }>();
  const cursors = new Map<string, HeadCursor>();
  const active = () => !stopped && (typeof document === 'undefined' || document.visibilityState !== 'hidden') &&
    (typeof navigator === 'undefined' || navigator.onLine !== false);
  const report = (next: typeof issue) => {
    if (stopped || issue === next) return;
    issue = next;
    options.onIssue?.(next);
  };
  const authenticate = (): Promise<boolean> => {
    authWork = authWork.catch(() => false).then(async () => {
      if (stopped) return false;
      try {
        const token = options.getToken ? await options.getToken() : (await client.auth.getSession()).data.session?.access_token;
        if (!token || stopped) { report('unavailable'); return false; }
        await client.realtime.setAuth(token);
        return !stopped;
      } catch { report('unavailable'); return false; }
    });
    return authWork;
  };
  const rebuild = () => {
    const gen = ++generation;
    work = work.catch(() => {}).then(async () => {
      const old = [...channels.values()];
      channels.clear();
      cursors.clear();
      await Promise.all(old.map(({ channel }) => client.removeChannel(channel)));
      if (gen !== generation || !active() || !scope) return;
      if (!await authenticate() || gen !== generation || !active() || !scope) return;
      const snapshot = scope;
      epoch = Math.max(Date.now(), epoch + 1);
      seq = 0;
      lastSentAt = -Infinity;
      // Each client listens to at most ten actor topics; join pacing avoids a room-wide burst.
      for (const player of snapshot.players) {
        if (gen !== generation || !active()) return;
        const channel = client.channel(viewpointTopic(snapshot, player.playerId), {
          config: { private: true, broadcast: { self: false, ack: true } },
        });
        const entry = { channel, ready: false };
        channels.set(player.playerId, entry);
        channel.on('broadcast', { event: 'head' }, ({ payload }) => {
          if (gen !== generation || !active() || !scope) return;
          // Source is this authorized subscription. Payload cannot select a different actor.
          const accepted = acceptHeadWire(payload, player.playerId, scope, cursors.get(player.playerId), Date.now());
          if (!accepted) return;
          cursors.set(player.playerId, accepted.cursor);
          options.onPeer(accepted.head);
        });
        channel.subscribe((status) => {
          if (gen !== generation || stopped) return;
          entry.ready = status === 'SUBSCRIBED';
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') report('unavailable');
          else if (channels.size === snapshot.players.length && [...channels.values()].every((c) => c.ready)) report(null);
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }).catch(() => report('unavailable'));
  };
  const onVisibility = () => rebuild();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', onVisibility);
    window.addEventListener('online', onVisibility);
  }

  return {
    sync: (next) => {
      if (stopped) return;
      if (next && (next.roomId !== options.roomId || next.players.length > 10 || !next.players.some((p) => p.playerId === next?.localPlayerId))) next = null;
      const key = next ? JSON.stringify([next.gameId, next.localPlayerId, next.players.map((p) => [p.playerId, p.seatIndex])]) : '';
      scope = next;
      if (key === scopeKey) return;
      scopeKey = key;
      rebuild();
    },
    send: (head) => {
      if (!active() || !scope || head.roomId !== scope.roomId || head.playerId !== scope.localPlayerId) return false;
      lastLook = { yaw: head.yaw, pitch: head.pitch };
      const own = channels.get(scope.localPlayerId);
      const now = Date.now();
      if (!own?.ready || now - lastSentAt < viewpointInterval(scope.players.length)) return false;
      const payload = { epoch, seq: seq + 1, yaw: head.yaw, pitch: head.pitch };
      if (!parseHeadWire(payload)) return false;
      seq++;
      lastSentAt = now;
      const gen = generation;
      void own.channel.send({ type: 'broadcast', event: 'head', payload }).then((result) => {
        if (gen === generation && result !== 'ok') report('unavailable');
      }).catch(() => { if (gen === generation) report('unavailable'); });
      return true;
    },
    sendEmote: (kind) => {
      if (!active() || !scope) return false;
      const now = Date.now();
      if (now - lastEmoteAt < EMOTE_COOLDOWN_MS) return false;
      const emote: EmoteSignal = { kind, seq: emoteSeq + 1, at: now };
      const gen = generation;
      const push = (): boolean => {
        const current = scope;
        if (gen !== generation || !active() || !current) return false;
        const own = channels.get(current.localPlayerId);
        if (!own?.ready) return false;
        const payload = { epoch, seq: seq + 1, yaw: lastLook.yaw, pitch: lastLook.pitch, emote };
        if (!parseHeadWire(payload)) return false;
        seq++;
        lastSentAt = Date.now();
        void own.channel.send({ type: 'broadcast', event: 'head', payload }).then((result) => {
          if (gen === generation && result !== 'ok') report('unavailable');
        }).catch(() => { if (gen === generation) report('unavailable'); });
        return true;
      };
      if (!push()) return false;
      emoteSeq = emote.seq;
      lastEmoteAt = now;
      // Kayıp telafisi: aynı `seq`, yeni bakış sırası. Alıcı bir kez oynatır.
      for (const delay of EMOTE_REPEAT_MS) {
        const timer = setTimeout(() => { emoteTimers.delete(timer); push(); }, delay);
        emoteTimers.add(timer);
      }
      return true;
    },
    reauth: async () => { if (await authenticate() && scope && channels.size === 0 && active()) rebuild(); },
    stop: () => {
      stopped = true;
      scope = null;
      for (const timer of emoteTimers) clearTimeout(timer);
      emoteTimers.clear();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', onVisibility);
        window.removeEventListener('online', onVisibility);
      }
      rebuild();
    },
  };
}
