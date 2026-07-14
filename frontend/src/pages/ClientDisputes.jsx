import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import DisputesTable from '../components/DisputesTable';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { disputesAPI } from '../api';

const STATUS_OPTIONS = ['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'WAITING_FOR_INFORMATION', 'APPROVED', 'REJECTED', 'CHARGEBACK_INITIATED', 'MERCHANT_RESPONSE_RECEIVED', 'REFUND_COMPLETED', 'CLOSED'];

export default function ClientDisputes() {
  const { user, token } = useAuth();
  const { rowsPerPage, compact } = usePreferences();
  const [disputes, setDisputes] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [status]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await disputesAPI.list(token, user.id, { status });
      setDisputes(data || []);
    } catch (err) {
      setError(err.errorDescription || 'Unable to load disputes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout breadcrumb="Home > My Disputes">
      <div className="page-header">
        <h1>My Disputes</h1>
      </div>

      <div className="filter-row">
        <div className="filter-group">
          <label>Status:</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {loading ? <p>Loading...</p> : <DisputesTable disputes={disputes} variant="client" rows={rowsPerPage} compact={compact} />}
      </div>
    </DashboardLayout>
  );
}
