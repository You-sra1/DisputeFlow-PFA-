import { STATUS_BADGE } from '../constants/statusConfig';

export default function StatusBadge({ status }) {
  const config = STATUS_BADGE[status] || { label: status || 'Unknown', className: 'badge-gray' };
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}
