// ============================================================================
// ClientDashboard.jsx — Page d'accueil du client : cartes KPI calculées à
// partir de ses vrais litiges (GET /disputes) et aperçu des plus récents.
// ============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import KPICard from '../components/KPICard';
import DisputesTable from '../components/DisputesTable';
import { Loading } from '../components/Feedback';
import { ErrorBanner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { IN_PROGRESS_STATUSES, APPROVED_LIKE_STATUSES } from '../constants';

export default function ClientDashboard() {
  const { token, user } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.getDisputes(token, user.id, { status: 'ALL' });
        if (!cancelled) setDisputes(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, user.id]);

  const totalDisputes = disputes.length;
  const inProgress = disputes.filter((d) => IN_PROGRESS_STATUSES.includes(d.status)).length;
  const approved = disputes.filter((d) => APPROVED_LIKE_STATUSES.includes(d.status)).length;
  const totalAmount = disputes.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const recent = [...disputes]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  return (
    <Layout role="CLIENT" breadcrumb={[{ label: 'Home', to: '/dashboard' }, { label: 'Dashboard' }]}>
      <div className="page-header">
        <div>
          <h1>Welcome back, {(user.nom || '').split(' ')[0] || 'there'}!</h1>
          <p className="page-subtitle">Here's what's happening with your disputes.</p>
        </div>
        <Link to="/disputes/new" className="btn-primary">+ New Dispute</Link>
      </div>

      <ErrorBanner message={error} />

      <div className="kpi-grid">
        <KPICard icon="📄" iconBg="#e6e9ff" label="Total Disputes" value={totalDisputes} sublabel="All time disputes" />
        <KPICard icon="⏱" iconBg="#ffedd5" label="In Progress" value={inProgress} sublabel="Currently under review" />
        <KPICard icon="✅" iconBg="#dcfce7" label="Approved" value={approved} sublabel="Disputes approved" />
        <KPICard icon="💲" iconBg="#dbeafe" label="Total Amount" value={`$${totalAmount.toFixed(2)}`} sublabel="Across all disputes" />
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <h2>Recent Disputes</h2>
          <Link to="/disputes" className="view-all-link">View All Disputes &gt;</Link>
        </div>
        {loading ? <Loading /> : <DisputesTable disputes={recent} mode="client" />}
      </div>
    </Layout>
  );
}
