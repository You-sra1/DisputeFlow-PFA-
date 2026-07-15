// ============================================================================
// KPICard.jsx — Carte affichant un indicateur clé (icône, valeur, libellé).
// Réutilisée sur les dashboards client et opérateur.
// ============================================================================

export default function KPICard({ icon, iconBg, label, value, sublabel, trend }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: iconBg }}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-label-row">
          <span className="kpi-label">{label}</span>
          {trend != null && (
            <span className={`kpi-trend ${trend >= 0 ? 'up' : 'down'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-sublabel">{sublabel}</div>
      </div>
    </div>
  );
}
