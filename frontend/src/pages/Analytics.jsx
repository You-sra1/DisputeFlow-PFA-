// ============================================================================
// Analytics.jsx — Vue complète des statistiques (les 9 statuts et 9 motifs
// en entier, pas seulement l'aperçu à 5 lignes du dashboard), plus le délai
// moyen de traitement.
// ============================================================================

import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import BarChartCard from '../components/BarChartCard';
import { Loading, ErrorBanner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { STATUS_LABELS, STATUS_COLORS, REASON_LABELS } from '../constants';

export default function Analytics() {
  const { token } = useAuth();
  const [statusData, setStatusData] = useState([]);
  const [reasonData, setReasonData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [statusRes, reasonRes] = await Promise.all([
          api.getStatusDistribution(token),
          api.getReasonDistribution(token),
        ]);
        if (cancelled) return;
        setStatusData(statusRes.map((s) => ({
          key: s.status, label: STATUS_LABELS[s.status] || s.status, count: s.count, color: STATUS_COLORS[s.status],
        })).sort((a, b) => b.count - a.count));
        setReasonData(reasonRes.map((r) => ({
          key: r.reason, label: REASON_LABELS[r.reason] || r.reason, count: r.count, color: '#4c6ef5',
        })).sort((a, b) => b.count - a.count));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <Layout role="OPERATOR" breadcrumb={[{ label: 'Home', to: '/operator/dashboard' }, { label: 'Analytics' }]}>
      <div className="page-header">
        <h1>Analytics</h1>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <Loading />
      ) : (
        <div className="two-col-grid">
          <BarChartCard title="Status Distribution (All)" data={statusData} />
          <BarChartCard title="Reason Distribution (All)" data={reasonData} />
        </div>
      )}
    </Layout>
  );
}
