import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

export default function DisputesTable({ disputes, variant = 'client' }) {
  if (!disputes || disputes.length === 0) {
    return <p className="empty-state">No disputes to display yet.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Dispute ID</th>
          {variant === 'operator' ? <th>Client Name</th> : <th>Transaction Details</th>}
          <th>Amount</th>
          {variant === 'operator' ? <th>Reason</th> : <th>Dispute Date</th>}
          <th>Status</th>
          {variant === 'operator' ? <th>Created Date</th> : <th>Last Updated</th>}
          <th>{variant === 'operator' ? 'Process' : 'Action'}</th>
        </tr>
      </thead>
      <tbody>
        {disputes.map((d) => {
          const isTerminal = ['REJECTED', 'CLOSED'].includes(d.status);
          return (
            <tr key={d.disputeId}>
              <td><Link to={`/disputes/${d.disputeId}`} className="link-cell">{d.disputeId}</Link></td>
              {variant === 'operator' ? (
                <td>{d.clientName || d.userID || '—'}</td>
              ) : (
                <td>{d.merchant || d.transactionId || '—'}</td>
              )}
              <td>{d.claimAmount ?? d.amount ?? '—'} {d.currency || ''}</td>
              {variant === 'operator' ? (
                <td>{(d.reason || '').replace(/_/g, ' ')}</td>
              ) : (
                <td>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}</td>
              )}
              <td><StatusBadge status={d.status} /></td>
              <td>{(d.updatedAt || d.createdAt) ? new Date(d.updatedAt || d.createdAt).toLocaleDateString() : '—'}</td>
              <td>
                <Link to={`/disputes/${d.disputeId}`} className="link-cell">
                  {variant === 'operator' ? (isTerminal ? '👁 View' : '👁 Review') : '👁 View Details'}
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
