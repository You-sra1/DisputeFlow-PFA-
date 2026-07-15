// ============================================================================
// ClientTransactions.jsx — Liste des transactions du client (GET /transactions),
// avec pour chaque ligne un accès direct pour créer un litige, ou un badge
// indiquant qu'un litige est déjà en cours sur cette transaction.
// ============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Loading, ErrorBanner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

export default function ClientTransactions() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [disputedTxnIds, setDisputedTxnIds] = useState(new Map()); // transactionId -> disputeId actif
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [txns, disputes] = await Promise.all([
          api.getTransactions(token, user.id, {}),
          api.getDisputes(token, user.id, { status: 'ALL' }),
        ]);
        if (cancelled) return;
        setTransactions(txns);

        // Un litige "actif" bloque une nouvelle contestation sur la même
        // transaction (le backend refuse avec 40901 sinon) : on croise donc
        // les transactionId des litiges non REJETE/CLOTURE.
        const map = new Map();
        disputes
          .filter((d) => d.status !== 'REJETE' && d.status !== 'CLOTURE')
          .forEach((d) => map.set(d.transaction_id, d.dispute_id));
        setDisputedTxnIds(map);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, user.id]);

  return (
    <Layout role="CLIENT" breadcrumb={[{ label: 'Home', to: '/dashboard' }, { label: 'Transactions' }]}>
      <div className="page-header">
        <h1>Transactions</h1>
      </div>

      <ErrorBanner message={error} />

      <div className="content-card">
        {loading ? (
          <Loading />
        ) : transactions.length === 0 ? (
          <p className="empty-state">No transactions to display.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Merchant</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Dispute</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const activeDisputeId = disputedTxnIds.get(t.transaction_id);
                  return (
                    <tr key={t.transaction_id}>
                      <td>{t.transaction_id}</td>
                      <td>{t.merchant}</td>
                      <td>{t.amount} {t.currency}</td>
                      <td>{t.transaction_date}</td>
                      <td>{t.status}</td>
                      <td>
                        {activeDisputeId ? (
                          <button
                            type="button"
                            className="badge-link"
                            onClick={() => navigate(`/disputes/${activeDisputeId}`)}
                          >
                            Dispute in progress
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => navigate('/disputes/new', { state: { transactionId: t.transaction_id } })}
                          >
                            Dispute this transaction
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
