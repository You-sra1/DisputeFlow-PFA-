import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import BarChartCard from '../components/BarChartCard';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../api';

const STATUS_COLORS = ['#1a56db', '#7ba9f4', '#22c55e', '#ef4444', '#f59e0b', '#9ca3af'];
const REASON_COLORS = ['#1a56db', '#7ba9f4', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#9ca3af'];

export default function Analytics() {
  const { user, token } = useAuth();
  const [statusDist, setStatusDist] = useState([]);
  const [reasonDist, setReasonDist] = useState([]);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setStatusDist((await dashboardAPI.statusDistribution(token, user.id)) || []);
      } catch (err) {
        setWarning('Dashboard endpoints not available yet — see note below.');
      }
      try {
        setReasonDist((await dashboardAPI.reasonDistribution(token, user.id)) || []);
      } catch (err) {
        setWarning('Dashboard endpoints not available yet — see note below.');
      }
    })();
  }, []);

  return (
    <DashboardLayout breadcrumb="Home / Analytics" showMenuIcon>
      <h1>Analytics</h1>
      {warning && <p className="warning-text">{warning}</p>}
      <div className="two-col-grid">
        <BarChartCard title="Status Distribution" data={statusDist} colors={STATUS_COLORS} />
        <BarChartCard title="Reason Distribution" data={reasonDist} colors={REASON_COLORS} />
      </div>
    </DashboardLayout>
  );
}
