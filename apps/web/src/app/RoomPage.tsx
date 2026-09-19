import { useNavigate, useParams } from 'react-router-dom';

import { useRoomState } from '../multiplayer/useRoomState';
import { isSoloActive } from '../solo/soloMode';
import { GameScreen } from '../ui/GameScreen';
import { Lobby } from '../ui/Lobby';
import { ErrorScreen, LoadingScreen } from '../ui/Screen';
import { t, useT } from '../i18n';
import { errorText } from '../ui/text';

/**
 * D26 — solo demoda göze batmayan köşe rozeti: ne oynadığını söyler ve gerçek
 * oyuna dönüşü tek tıkla verir. Oyun sonu ekranında da görünür (sabit konum).
 */
function SoloBadge() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <aside className="solo-badge" aria-label={t('solo.badge')}>
      <span className="solo-badge__text">{t('solo.badge')}</span>
      <button
        type="button"
        className="solo-badge__link"
        onClick={() => {
          void import('../solo/startSolo').then((m) => m.stopSolo());
          navigate('/');
        }}
      >
        {t('solo.playWithFriends')}
      </button>
    </aside>
  );
}

/** `/oda/:roomId` — canlı döngü; duruma göre lobi veya oyun ekranı. */
export function RoomPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const room = useRoomState(roomId);
  const solo = isSoloActive();

  if (room.phase === 'connecting') {
    return <LoadingScreen label={t('screen.roomLoading')} />;
  }
  if (room.phase === 'error') {
    return (
      <ErrorScreen
        message={errorText(room.message)}
        onRetry={room.retry}
        onHome={() => navigate('/')}
      />
    );
  }
  return (
    <>
      {room.phase === 'lobby' ? <Lobby room={room} /> : <GameScreen room={room} />}
      {solo ? <SoloBadge /> : null}
    </>
  );
}
