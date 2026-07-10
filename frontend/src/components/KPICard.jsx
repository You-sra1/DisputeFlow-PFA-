export default function KPICard({ icon, iconBg, label, value, subtext, trend }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: iconBg }}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-subtext">
          {subtext}
          {trend && <span className="kpi-trend">▲ {trend} vs last month</span>}
        </div>
      </div>
    </div>
  );
}
