// ============================================================================
// DisputesTable.jsx — Tableau de litiges réutilisable entre le dashboard
// client, le dashboard opérateur, et les pages de liste complète.
//
// Le mode "client" affiche les colonnes orientées client (Transaction
// Details), le mode "operator" affiche les colonnes orientées opérateur
// (Client Name, Reason), avec un bouton d'action adapté au statut.
// ============================================================================

import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { REASON_LABELS } from '../constants';

const TERMINAL_STATUSES = ['REJETE', 'CLOTURE'];

export default function DisputesTable({ disputes, mode = 'client' }) {
  if (!disputes || disputes.length === 0) {
    return <p className="empty-state">No disputes to display yet.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Dispute ID</th>
            {mode === 'client' ? <th>Transaction Details</th> : <th>Client Name</th>}
            <th>Amount</th>
            {mode === 'operator' && <th>Reason</th>}
            <th>Status</th>
            <th>{mode === 'client' ? 'Dispute Date' : 'Created Date'}</th>
            <th>{mode === 'client' ? 'Action' : 'Process'}</th>
          </tr>
        </thead>
        <tbody>
          {disputes.map((d) => {
            const detailPath = mode === 'operator' ? `/operator/disputes/${d.dispute_id}` : `/disputes/${d.dispute_id}`;
            const isActionable = !TERMINAL_STATUSES.includes(d.status);

            return (
              <tr key={d.dispute_id}>
                <td>
                  <Link to={detailPath} className="link-cell">{d.dispute_id}</Link>
                </td>
                {mode === 'client' ? (
                  <td>
                    <div className="cell-primary">{d.merchant || d.transaction_id}</div>
                    <div className="cell-secondary">{d.transaction_date || ''}</div>
                  </td>
                ) : (
                  <td>{d.client_name || d.client_id}</td>
                )}
                <td>{d.amount != null ? `${d.amount} ${d.currency || ''}` : '—'}</td>
                {mode === 'operator' && <td>{REASON_LABELS[d.reason] || d.reason}</td>}
                <td><StatusBadge status={d.status} /></td>
                <td>{d.created_at || '—'}</td>
                <td>
                  <Link to={detailPath} className="table-action-link">
                    {mode === 'operator' ? (isActionable ? '👁 Review' : '👁 View') : '👁 View Details'}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
