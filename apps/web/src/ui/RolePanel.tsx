import { useEffect, useRef } from 'react';
import type { PrivateView, SceneView } from '@secret-table/contracts';

import { useT, t as translate, type TextKey } from '../i18n';

/**
 * Özel görünüm (yalnız bu oyuncu): rol, bilinen oyuncular, el, özel inceleme.
 * Varsayılan kapalı (docs/CONTRACT.md § 3). Açılışta panele odaklanır,
 * kapanışta tetik düğmesine döner. Bu yerel görsel tercih sunucu gizlilik
 * filtresinin yerine geçmez.
 */

const roleLabel = (role: string): string => translate(`role.${role}` as TextKey);
const partyLabel = (party: string): string => translate(`party.${party}` as TextKey);
const sourceLabel = (source: string): string => translate(`role.source.${source}` as TextKey);
const policyLabel = (policy: string): string => translate(`policy.${policy}` as TextKey);

function nameOf(view: SceneView, playerId: string): string {
  return view.players.find((p) => p.playerId === playerId)?.displayName ?? translate('common.player');
}

function InspectionBlock({ inspection, view }: { inspection: PrivateView['inspection']; view: SceneView }) {
  if (!inspection) return null;
  if (inspection.kind === 'party_membership') {
    return (
      <p>
        {translate('role.inspection')}: <strong>{nameOf(view, inspection.targetId)}</strong> →{' '}
        {partyLabel(inspection.party)}
      </p>
    );
  }
  return (
    <p>
      {translate('role.deckTop')}:{' '}
      {inspection.upcoming.map((p, i) => (
        <strong key={i}>
          {policyLabel(p)}
          {i < inspection.upcoming.length - 1 ? ', ' : ''}
        </strong>
      ))}
    </p>
  );
}

export function RolePanel({
  view,
  open,
  onOpenChange,
}: {
  view: SceneView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const priv = view.privateView;
  const bodyRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open && !wasOpen.current) bodyRef.current?.focus();
    if (!open && wasOpen.current) toggleRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const hasContent =
    priv.role ||
    priv.knownPlayers.length > 0 ||
    priv.hand.length > 0 ||
    priv.inspection ||
    priv.submittedVote;

  return (
    <section className="panel" aria-labelledby="role-panel-title">
      <div className="row row--between">
        <h2 id="role-panel-title" className="panel__title">
          {t('role.panelTitle')}
        </h2>
        <button
          ref={toggleRef}
          type="button"
          className="btn-ghost"
          aria-expanded={open}
          aria-controls="role-panel-body"
          onClick={() => onOpenChange(!open)}
        >
          {open ? t('role.hide') : t('role.show')}
        </button>
      </div>

      {open ? (
        <div id="role-panel-body" ref={bodyRef} tabIndex={-1} className="role-panel__body">
          {!hasContent ? <p className="muted">{t('role.empty')}</p> : null}

          {priv.role ? (
            <p>
              {t('role.yourRole')}: <strong>{roleLabel(priv.role)}</strong>
            </p>
          ) : null}

          {priv.knownPlayers.length > 0 ? (
            <div>
              <h3 className="panel__subtitle">{t('role.known')}</h3>
              <ul className="list">
                {priv.knownPlayers.map((k) => (
                  <li key={k.playerId}>
                    <strong>{nameOf(view, k.playerId)}</strong> —{' '}
                    {k.knowledge.kind === 'role'
                      ? roleLabel(k.knowledge.role)
                      : partyLabel(k.knowledge.party)}
                    <span className="muted"> ({sourceLabel(k.source)})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {priv.hand.length > 0 ? (
            <p>
              {t('role.hand')}:{' '}
              {priv.hand.map((c, i) => (
                <strong key={c.cardId}>
                  {policyLabel(c.policy)}
                  {i < priv.hand.length - 1 ? ', ' : ''}
                </strong>
              ))}
            </p>
          ) : null}

          <InspectionBlock inspection={priv.inspection} view={view} />

          {priv.submittedVote ? (
            <p className="muted">
              {t('role.yourVote')}: {priv.submittedVote === 'yes' ? t('common.yes') : t('common.no')}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="muted">{t('role.hidden')}</p>
      )}
    </section>
  );
}
