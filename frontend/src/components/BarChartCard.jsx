// ============================================================================
// BarChartCard.jsx — Carte affichant une répartition (statuts ou motifs)
// sous forme de barres horizontales colorées, avec un lien "View All"
// vers la page Analytics pour la vue complète.
// ============================================================================

import { Link } from 'react-router-dom';

export default function BarChartCard({ title, data, viewAllTo, limit }) {
  const total = data.reduce((sum, item) => sum + item.count, 0) || 1;
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const rows = limit ? data.slice(0, limit) : data;

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3>{title}</h3>
        {viewAllTo && <Link to={viewAllTo} className="view-all-link">View All</Link>}
      </div>
      <div className="chart-rows">
        {rows.map((item) => (
          <div className="chart-row" key={item.key}>
            <span className="chart-row-label">{item.label}</span>
            <div className="chart-row-bar-track">
              <div
                className="chart-row-bar-fill"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  background: item.color,
                }}
              />
            </div>
            <span className="chart-row-value">
              {item.count} ({((item.count / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
