import type { PublicHistoryEntry, SceneView } from '@secret-table/contracts';

import { useT } from '../i18n';
import { t as translate } from '../i18n';

function nameOf(view: SceneView, id: string): string {
  return view.players.find((p) => p.playerId === id)?.displayName ?? translate('common.player');
}

function line(view: SceneView, entry: PublicHistoryEntry): string {
  switch (entry.kind) {
    case 'game_started':
      return translate('history.gameStarted', { count: entry.playerCount });
    case 'nomination':
      return translate('history.nomination', {
        president: nameOf(view, entry.presidentId),
        chancellor: nameOf(view, entry.chancellorId),
      });
    case 'election':
      return translate(
        entry.outcome === 'elected' ? 'history.electionAccepted' : 'history.electionRejected',
      );
    case 'policy_enacted':
      return translate(entry.board === 'liberal' ? 'history.policyLiberal' : 'history.policyFascist');
    case 'election_tracker':
      return translate('history.tracker', { tracker: entry.tracker });
    case 'chaos_policy':
      return translate(entry.policy === 'liberal' ? 'history.chaosLiberal' : 'history.chaosFascist');
    case 'power_used':
      return entry.targetId
        ? translate('history.powerUsedTarget', {
            actor: nameOf(view, entry.actorId),
            target: nameOf(view, entry.targetId),
          })
        : translate('history.powerUsed', { actor: nameOf(view, entry.actorId) });
    case 'player_executed':
      return translate('history.executed', { name: nameOf(view, entry.targetId) });
    default:
      return '';
  }
}

/** Herkese açık, filtrelenmiş tur geçmişi. Gizli kart/inceleme kaydı yok. */
export function HistoryLog({ view }: { view: SceneView }) {
  const t = useT();
  const entries = view.table.publicHistory;
  return (
    <section className="panel" aria-labelledby="history-title">
      <h2 id="history-title" className="panel__title">
        {t('panel.history')}
      </h2>
      {entries.length === 0 ? (
        <p className="muted">{t('panel.historyEmpty')}</p>
      ) : (
        <ol className="history">
          {entries.map((entry) => (
            <li key={entry.entryId}>{line(view, entry)}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
