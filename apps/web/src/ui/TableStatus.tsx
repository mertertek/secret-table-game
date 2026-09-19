import type { SceneView } from '@secret-table/contracts';

import { useT, t as translate } from '../i18n';
import { endReasonName, powerName, winnerName } from './text';

function nameOf(view: SceneView, id: string | null): string {
  if (!id) return '—';
  return view.players.find((p) => p.playerId === id)?.displayName ?? translate('common.player');
}

/** Herkese açık masa durumu + bağlantı/duraklama şeritleri + oyun sonucu. */
export function TableStatus({
  view,
  connectionLabel,
}: {
  view: SceneView;
  connectionLabel: string | null;
}) {
  const tr = useT();
  const t = view.table;
  return (
    <section className="panel" aria-labelledby="table-status-title">
      <h2 id="table-status-title" className="panel__title">
        {tr('panel.table')}
      </h2>

      {connectionLabel ? (
        <p className="notice notice--warn" role="status">
          {connectionLabel}
        </p>
      ) : null}

      {view.paused ? (
        <p className="notice notice--warn" role="status">
          {view.paused.reason === 'player_offline'
            ? tr('panel.pausedOffline')
            : tr('panel.paused', { reason: view.paused.reason })}
        </p>
      ) : null}

      <dl className="stat-grid">
        <div>
          <dt>{tr('panel.liberal')}</dt>
          <dd>{t.liberalPolicies} / 5</dd>
        </div>
        <div>
          <dt>{tr('panel.fascist')}</dt>
          <dd>{t.fascistPolicies} / 6</dd>
        </div>
        <div>
          <dt>{tr('panel.tracker')}</dt>
          <dd>{t.electionTracker} / 3</dd>
        </div>
        <div>
          <dt>{tr('panel.deckDiscard')}</dt>
          <dd>
            {t.drawCount} / {t.discardCount}
          </dd>
        </div>
      </dl>

      {t.currentPower ? (
        <p>
          {tr('panel.power')}: <strong>{powerName(t.currentPower.power)}</strong> —{' '}
          {nameOf(view, t.currentPower.actorId)}
          {t.currentPower.targetId ? ` → ${nameOf(view, t.currentPower.targetId)}` : ''}
        </p>
      ) : null}

      {t.lastElection ? (
        <p className="muted">
          {tr('panel.lastElection')}: {nameOf(view, t.lastElection.presidentId)} /{' '}
          {nameOf(view, t.lastElection.chancellorId)} —{' '}
          {t.lastElection.outcome === 'elected' ? tr('panel.accepted') : tr('panel.rejected')} (
          {tr('panel.voteCount', {
            yes: t.lastElection.votes.filter((v) => v.vote === 'yes').length,
            no: t.lastElection.votes.filter((v) => v.vote === 'no').length,
          })}
          )
        </p>
      ) : null}

      {view.result ? (
        <p className="notice notice--result" role="status">
          <strong>{winnerName(view.result.winner)}</strong>
          <span> — {endReasonName(view.result.reason)}</span>
        </p>
      ) : null}
    </section>
  );
}
