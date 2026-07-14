import { Link } from 'react-router-dom';

// Implémenté en CSS pur (pas de dépendance recharts/chart.js à installer).
// Si vous préférez recharts pour des graphiques plus riches, dites-le-moi et
// je le réécris avec <BarChart> — la structure de données (data) reste identique.
export default function BarChartCard({ title, data = [], colors = [], viewAllLink }) {
  const total = data.reduce((sum, d) => sum + (d.count || 0), 0) || 1;

  return (
    <div className="card bar-chart-card">
      <div className="card-header">
        <h3>{title}</h3>
        {viewAllLink && <Link to={viewAllLink} className="link-cell">View All</Link>}
      </div>
      {data.length === 0 ? (
        <p className="empty-state">No data available.</p>
      ) : (
        <div className="bar-list">
          {data.map((item, i) => (
            <div className="bar-row" key={item.label}>
              <div className="bar-label">{item.label}</div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${(item.count / total) * 100}%`,
                    background: colors[i % colors.length] || '#1a56db',
                  }}
                />
              </div>
              <div className="bar-value">
                {item.count} ({Math.round((item.count / total) * 100)}%)
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
