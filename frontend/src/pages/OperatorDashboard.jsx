// ============================================================================
// OperatorDashboard.jsx — Vue globale opérateur : KPI, répartitions
// (aperçu limité à 5 lignes, "View All" renvoie vers Analytics), et les
// litiges les plus récents tous clients confondus.
// ============================================================================

import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import KPICard from '../components/KPICard';
import BarChartCard from '../components/BarChartCard';
import DisputesTable from '../components/DisputesTable';
import { Loading, ErrorBanner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { STATUS_LABELS, STATUS_COLORS, REASON_LABELS } from '../constants';

export default function OperatorDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [statusData, setStatusData] = useState([]);
  const [reasonData, setReasonData] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [statsRes, statusRes, reasonRes, disputesRes] = await Promise.all([
          api.getDashboardStats(token),
          api.getStatusDistribution(token),
          api.getReasonDistribution(token),
          api.getDisputes(token, user.id, { status: 'ALL' }),
        ]);
        if (cancelled) return;
        setStats(statsRes);
        setStatusData(statusRes.map((s) => ({
          key: s.status, label: STATUS_LABELS[s.status] || s.status, count: s.count, color: STATUS_COLORS[s.status],
        })).sort((a, b) => b.count - a.count));
        setReasonData(reasonRes.map((r) => ({
          key: r.reason, label: REASON_LABELS[r.reason] || r.reason, count: r.count, color: '#4c6ef5',
        })).sort((a, b) => b.count - a.count));
        setDisputes(
          [...disputesRes].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 6)
        );
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, user.id]);

  if (loading) {
    return (
      <Layout role="OPERATOR" breadcrumb={[{ label: 'Home', to: '/operator/dashboard' }, { label: 'Dashboard' }]}>
        <Loading />
      </Layout>
    );
  }

  return (
    <Layout role="OPERATOR" breadcrumb={[{ label: 'Home', to: '/operator/dashboard' }, { label: 'Dashboard' }]}>
      <ErrorBanner message={error} />

      <div className="kpi-grid">
        <KPICard icon="📄" iconBg="#e6e9ff" label="Total Disputes" value={stats?.totalDisputes ?? '—'} sublabel="All time disputes" trend={stats?.totalDisputesTrend} />
        <KPICard icon="⏱" iconBg="#ffedd5" label="In Progress" value={stats?.inProgress ?? '—'} sublabel="Currently in review" trend={stats?.inProgressTrend} />
        <KPICard icon="✅" iconBg="#dcfce7" label="Approved" value={stats?.approved ?? '—'} sublabel="Successfully approved" trend={stats?.approvedTrend} />
        <KPICard icon="💲" iconBg="#dbeafe" label="Total Amount" value={stats ? `$${Number(stats.totalAmount).toFixed(2)}` : '—'} sublabel="Total dispute amount" trend={stats?.totalAmountTrend} />
      </div>

      <div className="two-col-grid">
        <BarChartCard title="Status Distribution" data={statusData} limit={5} viewAllTo="/operator/analytics" />
        <BarChartCard title="Reason Distribution" data={reasonData} limit={5} viewAllTo="/operator/analytics" />
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <h2>Recent Disputes</h2>
        </div>
        <DisputesTable disputes={disputes} mode="operator" />
      </div>
    </Layout>
  );
}
