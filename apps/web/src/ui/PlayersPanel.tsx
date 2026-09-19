import type { SceneView } from '@secret-table/contracts';

import { useT } from '../i18n';

/**
 * Herkese açık oyuncu listesi (koltuk sırası). Rol/parti ima eden işaret yok.
 *
 * D5: oylamada "oy verdi / bekliyor", oylar açıldıktan sonra son seçimin
 * EVET/HAYIR sütunu. Kaynak yalnız kamu alanları (`hasVoted`,
 * `table.lastElection.votes`); kimsenin gizli tercihi erken görünmez.
 */
export function PlayersPanel({ view }: { view: SceneView }) {
  const t = useT();
  const officeLabel: Record<string, string> = {
    president: t('office.president'),
    chancellor: t('office.chancellor'),
    none: '',
  };
  const voting = view.phase === 'voting';
  const lastVotes = voting ? null : view.table.lastElection?.votes ?? null;
  return (
    <section className="panel" aria-labelledby="players-panel-title">
      <h2 id="players-panel-title" className="panel__title">
        {t('panel.players')}
      </h2>
      {lastVotes ? <p className="muted">{t('panel.lastVotesNote')}</p> : null}
      <ul className="players">
        {view.players.map((p) => {
          const badges: string[] = [];
          if (p.office !== 'none') badges.push(officeLabel[p.office] ?? p.office);
          if (p.isPresidentialCandidate) badges.push(t('office.presidentCandidate'));
          if (p.isChancellorCandidate) badges.push(t('office.chancellorCandidate'));
          if (p.isHost) badges.push(t('office.host'));
          return (
            <li
              key={p.playerId}
              className={`players__row${p.playerId === view.localPlayerId ? ' is-local' : ''}${
                p.alive ? '' : ' is-dead'
              }`}
            >
              <span
                className={`dot${p.connected ? ' dot--on' : ' dot--off'}`}
                aria-label={p.connected ? t('panel.connected') : t('panel.disconnected')}
                title={p.connected ? t('panel.connected') : t('panel.disconnected')}
              />
              <span className="players__seat">{p.seatIndex + 1}</span>
              <span className="players__name">{p.displayName}</span>
              <span className="players__badges">
                {badges.map((b) => (
                  <span key={b} className="tag">
                    {b}
                  </span>
                ))}
                {!p.alive ? <span className="tag tag--muted">{t('panel.eliminated')}</span> : null}
                {voting && p.alive ? (
                  p.hasVoted ? (
                    <span className="tag tag--yes">{t('panel.voted')}</span>
                  ) : (
                    <span className="tag tag--muted">{t('panel.waiting')}</span>
                  )
                ) : null}
                {(() => {
                  const vote = lastVotes?.find((v) => v.playerId === p.playerId);
                  if (!vote) return null;
                  return vote.vote === 'yes' ? (
                    <span className="tag tag--yes">{t('panel.voteYes')}</span>
                  ) : (
                    <span className="tag tag--no">{t('panel.voteNo')}</span>
                  );
                })()}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
