import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import BarChartCard from '../components/BarChartCard';
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

export default function Analytics() {
  const { user, token } = useAuth();
  const [statusDist, setStatusDist] = useState([]);
  const [reasonDist, setReasonDist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await disputesAPI.list(token, user.id, { status: 'ALL' });
        setStatusDist(computeDistribution(list || [], 'status', STATUS_LABEL_FR));
        setReasonDist(computeDistribution(list || [], 'reason', REASON_LABEL));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardLayout breadcrumb="Home / Analytics" showMenuIcon>
      <h1>Analytics</h1>
      {loading && <p>Loading...</p>}
      <div className="two-col-grid">
        <BarChartCard title="Status Distribution" data={statusDist} colors={STATUS_COLORS} />
        <BarChartCard title="Reason Distribution" data={reasonDist} colors={REASON_COLORS} />
      </div>
    </DashboardLayout>
  );
}
