// ============================================================================
// ClientDisputes.jsx — Liste complète des litiges du client, filtrable par
// statut (GET /disputes?status=...). Le bouton "New Dispute" n'apparaît
// PAS ici : il n'est disponible que depuis la page Home, par choix produit.
// ============================================================================

import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import DisputesTable from '../components/DisputesTable';
import { Loading, ErrorBanner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { DISPUTE_STATUSES, STATUS_LABELS } from '../constants';

export default function ClientDisputes() {
  const { token, user } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.getDisputes(token, user.id, { status });
        if (!cancelled) setDisputes(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, user.id, status]);

  return (
    <Layout role="CLIENT" breadcrumb={[{ label: 'Home', to: '/dashboard' }, { label: 'My Disputes' }]}>
      <div className="page-header">
        <h1>My Disputes</h1>
      </div>

      <div className="filter-row">
        <label>
          Status:
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">ALL</option>
            {DISPUTE_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
      </div>

      <ErrorBanner message={error} />

      <div className="content-card">
        {loading ? <Loading /> : <DisputesTable disputes={disputes} mode="client" />}
      </div>
    </Layout>
  );
}
