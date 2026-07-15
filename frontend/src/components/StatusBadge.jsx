// ============================================================================
// StatusBadge.jsx — Badge coloré affichant un statut de litige de façon
// lisible (mapping enum backend -> libellé + couleur), réutilisé partout.
// ============================================================================

import { STATUS_LABELS, STATUS_COLORS } from '../constants';

export default function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || '#718096';

  return (
    <span className="status-badge" style={{ '--badge-color': color }}>
      <span className="status-dot" />
      {label}
    </span>
  );
}
