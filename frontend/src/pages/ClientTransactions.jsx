import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { transactionsAPI } from '../api';

export default function ClientTransactions() {
  const { user, token } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await transactionsAPI.list(token, user.id, {});
        setTransactions(data || []);
      } catch (err) {
        setError(err.errorDescription || 'Unable to load transactions.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardLayout breadcrumb="Home > Transactions">
      <h1>Transactions</h1>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Merchant</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.transactionId}>
                  <td>{t.transactionId}</td>
                  <td>{t.merchant}</td>
                  <td>{t.amount} {t.currency}</td>
                  <td>{t.transactionDate}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && <p className="empty-state">No transactions to display.</p>}
        </div>
      )}
    </DashboardLayout>
  );
}
