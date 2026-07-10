// Mapping statut backend -> badge affiché (couleur + libellé)
export const STATUS_BADGE = {
  APPROVED: { label: 'Approved', className: 'badge-green' },
  REFUND_COMPLETED: { label: 'Approved', className: 'badge-green' },
  REJECTED: { label: 'Rejected', className: 'badge-red' },
  SUBMITTED: { label: 'Pending', className: 'badge-orange' },
  UNDER_REVIEW: { label: 'Under Review', className: 'badge-blue' },
  WAITING_FOR_INFORMATION: { label: 'Pending', className: 'badge-orange' },
  CHARGEBACK_INITIATED: { label: 'Pending', className: 'badge-orange' },
  CLOSED: { label: 'Closed', className: 'badge-gray' },
};

export const DISPUTE_REASONS = [
  'UNAUTHORIZED_TRANSACTION',
  'DOUBLE_CHARGE',
  'GOODS_NOT_RECEIVED',
  'SERVICE_NOT_PROVIDED',
  'INCORRECT_AMOUNT',
  'CANCELLED_RECURRING_PAYMENT',
  'FRAUD',
  'ATM_CASH_NOT_DISPENSED',
  'OTHER',
];
