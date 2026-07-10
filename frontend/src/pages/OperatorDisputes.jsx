import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import DisputesTable from '../components/DisputesTable';
import { useAuth } from '../context/AuthContext';
import { disputesAPI } from '../api';

const STATUS_OPTIONS = ['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'WAITING_FOR_INFORMATION', 'APPROVED', 'REJECTED', 'CHARGEBACK_INITIATED', 'REFUND_COMPLETED', 'CLOSED'];

export default function OperatorDisputes() {
  const { user, token } = useAuth();
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
    <DashboardLayout breadcrumb="Home / Disputes" showMenuIcon>
      <h1>Disputes</h1>

      <div className="filter-row">
        <label>Status:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {loading ? <p>Loading...</p> : <DisputesTable disputes={disputes} variant="operator" />}
      </div>
    </DashboardLayout>
  );
}
