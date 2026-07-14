import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import KPICard from '../components/KPICard';
import BarChartCard from '../components/BarChartCard';
import DisputesTable from '../components/DisputesTable';
import { useAuth } from '../context/AuthContext';
import { disputesAPI } from '../api';
import { STATUS_LABEL_FR, REASON_LABEL } from '../constants/statusConfig';

const STATUS_COLORS = ['#1a56db', '#7ba9f4', '#22c55e', '#ef4444', '#f59e0b', '#9ca3af'];
const REASON_COLORS = ['#1a56db', '#7ba9f4', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#9ca3af'];

function computeDistribution(items, key, labelMap) {
  const counts = {};
  items.forEach((item) => {
    const val = item[key] || 'UNKNOWN';
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ label: labelMap[name] || name.replace(/_/g, ' '), count }))
    .sort((a, b) => b.count - a.count);
}

export default function OperatorDashboard() {
  const { user, token } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const list = await disputesAPI.list(token, user.id, { status: 'ALL' });
      setDisputes(list || []);
    } catch (err) {
      setError(err.errorDescription || 'Unable to load disputes.');
    } finally {
      setLoading(false);
    }
  }

  const total = disputes.length;
  const inProgress = disputes.filter((d) => d.status === 'UNDER_REVIEW').length;
  const approved = disputes.filter((d) => ['APPROVED', 'REFUND_COMPLETED'].includes(d.status)).length;
  const totalAmount = disputes.reduce((sum, d) => sum + (d.claimAmount || d.amount || 0), 0);

  const recent = [...disputes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  const topStatus = computeDistribution(disputes, 'status', STATUS_LABEL_FR).slice(0, 5);
  const topReason = computeDistribution(disputes, 'reason', REASON_LABEL).slice(0, 5);

  return (
    <DashboardLayout breadcrumb="Home / Dashboard" showMenuIcon>
      <h1>Dashboard</h1>

      {error && <p className="error-text">{error}</p>}

      <div className="kpi-grid">
        <KPICard icon="📄" iconBg="#e0e7ff" label="Total Disputes" value={total} subtext="All statuses" />
        <KPICard icon="⏱️" iconBg="#fff2e0" label="In Progress" value={inProgress} subtext="Under review" />
        <KPICard icon="✅" iconBg="#e2f8ec" label="Approved" value={approved} subtext="Approved disputes" />
        <KPICard icon="💲" iconBg="#e0f2ff" label="Total Amount" value={`$${totalAmount.toFixed(2)}`} subtext="All disputes" />
      </div>

      <div className="two-col-grid">
        <BarChartCard title="Status Distribution" data={topStatus} colors={STATUS_COLORS} viewAllLink="/analytics" />
        <BarChartCard title="Reason Distribution" data={topReason} colors={REASON_COLORS} viewAllLink="/analytics" />
      </div>

      <div className="card">
        <div className="card-header"><h3>Recent Disputes</h3></div>
        {loading ? <p>Loading...</p> : <DisputesTable disputes={recent} variant="operator" />}
      </div>
    </DashboardLayout>
  );
}
