import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomState } from '../multiplayer/useRoomState';
import { AvatarPicker } from './AvatarPicker';
import { ConnectionBanner } from './ConnectionBanner';
import { HowToPlayButton } from './HowToPlayModal';
import { LobbyTable } from './LobbyTable';
import { CenteredScreen } from './Screen';
import { preloadScene } from './SceneFrame';
import { useT, t as translate } from '../i18n';
import { LanguageSwitch } from './LanguageSwitch';
import { usePrefs } from './usePrefs';
import { errorText } from './text';
import { DEV_TOOLS } from '../devTools';

type LobbyRoom = Extract<RoomState, { phase: 'lobby' }>;

/** `navigator.share` yalnız güvenli bağlamda ve çoğunlukla telefonda vardır. */
function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

function InviteBar({ url, code }: { url: string; code: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [url]);

  const share = useCallback(async () => {
    try {
      await navigator.share({
        title: 'Secret Table',
        text: translate('lobby.shareText', { code }),
        url,
      });
    } catch {
      /* kullanıcı iptal etti; sessiz geç */
    }
  }, [url, code]);

  return (
    <div className="invite">
      <label className="invite__label" htmlFor="invite-url">
        {t('lobby.inviteLabel')}
      </label>
      <div className="invite__row">
        <input
          id="invite-url"
          className="invite__input"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => void copy()}>
          {copied ? t('lobby.copied') : t('lobby.copy')}
        </button>
        {canShare() ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => void share()}>
            {t('lobby.share')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * ROADMAP A6 — yalnız `import.meta.env.DEV`. Bu bileşen ve `botRunner` chunk'ı
 * üretim paketine girmez: aşağıdaki `import.meta.env.DEV ? … : null` dalı
 * derlemede `false` olur, Rollup bileşeni ve tembel `import()`i düşürür.
 */
function DevBotsButton({
  roomId,
  inviteCode,
  memberCount,
  maxPlayers,
}: {
  roomId: string;
  inviteCode: string;
  memberCount: number;
  maxPlayers: number;
}) {
  const t = useT();
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  /**
   * D19 — hedef masa boyu. 7 ve 9 kişilik masalar (yetki tabloları farklı)
   * kullanıcı arayüzünden kurulabilsin diye seçilebilir; varsayılan 7.
   */
  const [target, setTarget] = useState(7);

  // Lobi yeniden mount olursa (oyun sonrası lobiye dönüş) koşan botları göster.
  useEffect(() => {
    alive.current = true;
    void import('../dev/botRunner').then((m) => {
      if (alive.current) setCount(m.runningBotCount(roomId));
    });
    // Botlar oyun boyunca yaşamalı; lobi oyun başlarken unmount olur, bu yüzden
    // burada durdurulmaz. Sekme kapanınca `botRunner` `pagehide` ile durur.
    return () => {
      alive.current = false;
    };
  }, [roomId]);

  const toggle = useCallback(async () => {
    setBusy(true);
    try {
      const m = await import('../dev/botRunner');
      const running = m.botRunnerFor(roomId);
      if (running) {
        running.stop();
        if (alive.current) setCount(0);
        return;
      }
      const runner = await m.startBots({
        roomId,
        inviteCode,
        currentMembers: memberCount,
        target: Math.min(maxPlayers, target),
      });
      if (alive.current) setCount(runner.count);
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [roomId, inviteCode, memberCount, maxPlayers, target]);

  const full = memberCount >= maxPlayers;
  const toAdd = Math.max(0, Math.min(maxPlayers, target) - memberCount);
  return (
    <span className="row">
      {count === 0 ? (
        <label className="muted dev-bots__target">
          {t('dev.botsTable')}
          <select
            aria-label={t('dev.botsTableLabel')}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            disabled={busy}
          >
            {[5, 6, 7, 8, 9, 10].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => void toggle()}
        disabled={busy || (count === 0 && (full || toAdd === 0))}
        title={t('dev.botsTitle')}
      >
        {count > 0 ? t('dev.botsRunning', { count }) : t('dev.botsAdd', { count: toAdd })}
      </button>
    </span>
  );
}

export function Lobby({ room }: { room: LobbyRoom }) {
  const t = useT();
  const [prefs, setPrefs] = usePrefs();
  // ROADMAP §C/2: sahne chunk'ı (three + R3F) lobide arka planda inmeye başlar;
  // oyun başlayınca ekran beklemez. Hata yutulur, kritik yol değil.
  useEffect(() => {
    preloadScene();
  }, []);

  const { snapshot } = room;
  const me = snapshot.members.find((m) => m.isLocal);
  const activeCount = snapshot.members.length;
  const notEnough = activeCount < snapshot.minPlayers;
  const someoneNotReady = snapshot.members.some((m) => !m.ready);
  const ready = me?.ready ?? false;

  let startHint = '';
  if (!snapshot.isHost) startHint = t('lobby.hintHost');
  else if (notEnough)
    startHint = t('lobby.hintNotEnough', { min: snapshot.minPlayers, count: activeCount });
  else if (someoneNotReady) startHint = t('lobby.hintNotReady');

  return (
    <CenteredScreen wide>
      <header className="lobby__head">
        <div className="lobby__id">
          <p className="hero__eyebrow">
            {room.mode === 'dev' ? t('lobby.eyebrowDev') : t('lobby.eyebrowLive')}
          </p>
          <p className="code-badge">
            <span className="code-badge__label">{t('lobby.room')}</span>
            <span className="code-badge__value">{snapshot.inviteCode}</span>
          </p>
        </div>
        <p className="lobby__count">
          {t('lobby.count', { count: activeCount, max: snapshot.maxPlayers })}
          <span className="lobby__count-min">{t('lobby.min', { min: snapshot.minPlayers })}</span>
        </p>
        <LanguageSwitch
          className="lang-switch--corner"
          value={prefs.language}
          onChange={(language) => setPrefs({ language })}
        />
      </header>

      <ConnectionBanner status={room.connection} />

      <InviteBar url={room.inviteUrl} code={snapshot.inviteCode} />

      {/* Geniş ekranda masa solda, eylemler sağda; telefonda alt alta. */}
      <div className="lobby__body">
        <LobbyTable
          members={snapshot.members}
          minPlayers={snapshot.minPlayers}
          maxPlayers={snapshot.maxPlayers}
        />

        <div className="lobby__side">
          {/* D3.4 / B3 — karakter seçimi. Seçim anında sunucuya gider. */}
          {me ? (
            <AvatarPicker
              value={me.avatar}
              taken={snapshot.members.filter((m) => !m.isLocal).map((m) => m.avatar)}
              busy={room.busy}
              onChange={(avatar) => room.setAvatar(avatar)}
            />
          ) : null}

          <div className="lobby__actions">
            <button
              type="button"
              className={`btn btn--toggle${ready ? ' is-on' : ''}`}
              onClick={() => room.setReady(!ready)}
              disabled={room.busy}
              aria-pressed={ready}
            >
              {ready ? t('lobby.notReady') : t('lobby.ready')}
            </button>

            {snapshot.isHost ? (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => room.startGame()}
                disabled={room.busy || !snapshot.canStart}
              >
                {t('lobby.start')}
              </button>
            ) : null}
          </div>

          {startHint ? (
            <p className="lobby__hint" role="status">
              {startHint}
            </p>
          ) : null}

          {/* D29 — kurallar oda kurulduktan SONRA, beklerken okunur. İçerik
              oyun içi menüdeki sekmeyle aynı bileşendir; burada modal açar.
              Tahta görseli masadaki oyuncu sayısının düzeniyle başlar. */}
          <div className="lobby__help">
            <HowToPlayButton className="btn btn--secondary btn--block" playerCount={activeCount} />
          </div>
        </div>
      </div>

      {room.transient ? (
        <p className="notice notice--error" role="alert">
          {errorText(room.transient)}
        </p>
      ) : null}

      {DEV_TOOLS ? (
        <p className="lobby__dev">
          <DevBotsButton
            roomId={snapshot.roomId}
            inviteCode={snapshot.inviteCode}
            memberCount={activeCount}
            maxPlayers={snapshot.maxPlayers}
          />
        </p>
      ) : null}
    </CenteredScreen>
  );
}
