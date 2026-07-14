import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { transactionsAPI, disputesAPI } from '../api';

export default function ClientTransactions() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
    loadDisputes();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await transactionsAPI.list(token, user.id);
      setTransactions(data || []);
    } catch (err) {
      setError(err.errorDescription || 'Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDisputes() {
    try {
      const data = await disputesAPI.list(token, user.id, { status: 'ALL' });
      setDisputes(data || []);
    } catch {
      // ignore
    }
  }

  function getActiveDispute(transactionId) {
    return disputes.find(
      (d) => d.transactionId === transactionId && !['REJECTED', 'CLOSED'].includes(d.status)
    );
  }

  return (
    <DashboardLayout breadcrumb="Home > Transactions">
      <h1>Transactions</h1>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : (
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
                const active = getActiveDispute(t.transactionId);
                return (
                  <tr key={t.transactionId}>
                    <td>{t.transactionId}</td>
                    <td>{t.merchant}</td>
                    <td>{t.amount} {t.currency}</td>
                    <td>{t.transactionDate}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>
                      {active ? (
                        <button
                          className="btn-link badge-dispute-active"
                          onClick={() => navigate(`/disputes/${active.disputeId}`)}
                        >
                          Dispute in progress
                        </button>
                      ) : (
                        <button
                          className="btn-link"
                          onClick={() => navigate('/disputes/new', { state: { transactionId: t.transactionId } })}
                        >
                          Dispute this transaction
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr><td colSpan="6" className="empty-state">No transactions found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}
