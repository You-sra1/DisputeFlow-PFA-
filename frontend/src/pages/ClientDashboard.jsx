import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import KPICard from '../components/KPICard';
import DisputesTable from '../components/DisputesTable';
import { useAuth } from '../context/AuthContext';
import { disputesAPI } from '../api';

export default function ClientDashboard() {
  const { user, token } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await disputesAPI.list(token, user.id, { status: 'ALL' });
      setDisputes(data || []);
    } catch (err) {
      setError(err.errorDescription || 'Unable to load disputes.');
    } finally {
      setLoading(false);
    }
  }

  const total = disputes.length;
  const inProgress = disputes.filter((d) => ['UNDER_REVIEW', 'WAITING_FOR_INFORMATION'].includes(d.status)).length;
  const approved = disputes.filter((d) => ['APPROVED', 'CHARGEBACK_INITIATED', 'REFUND_COMPLETED'].includes(d.status)).length;
  const totalAmount = disputes.reduce((sum, d) => sum + (d.claimAmount || 0), 0);

  const recent = [...disputes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <DashboardLayout breadcrumb="Home > Dashboard">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.name?.split(' ')[0]}!</h1>
          <p className="subtitle">Here's what's happening with your disputes.</p>
        </div>
        <Link to="/disputes/new" className="btn-primary">+ New Dispute</Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="kpi-grid">
        <KPICard icon="📄" iconBg="#e0e7ff" label="Total Disputes" value={total} subtext="All time disputes" />
        <KPICard icon="⏱️" iconBg="#fff2e0" label="In Progress" value={inProgress} subtext="Currently under review" />
        <KPICard icon="✅" iconBg="#e2f8ec" label="Approved" value={approved} subtext="Disputes approved" />
        <KPICard icon="💲" iconBg="#e0f2ff" label="Total Amount" value={`$${totalAmount.toFixed(2)}`} subtext="Across all disputes" />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Recent Disputes</h3>
          <Link to="/disputes" className="link-cell">View All Disputes &gt;</Link>
        </div>
        {loading ? <p>Loading...</p> : <DisputesTable disputes={recent} variant="client" />}
      </div>
    </DashboardLayout>
  );
}
