// Mapping statut backend -> badge affiché (couleur + libellé)
export const STATUS_BADGE = {
  COMPLETED:                     { label: 'Completed',               className: 'badge-green-light' },
  PENDING:                       { label: 'Pending',                 className: 'badge-orange' },
  SUBMITTED:                    { label: 'Soumis',                   className: 'badge-orange' },
  UNDER_REVIEW:                 { label: 'En cours d\'analyse',      className: 'badge-blue' },
  WAITING_FOR_INFORMATION:      { label: 'En attente d\'informations', className: 'badge-orange' },
  APPROVED:                     { label: 'Approuvé',                 className: 'badge-green' },
  REJECTED:                     { label: 'Rejeté',                   className: 'badge-red' },
  CHARGEBACK_INITIATED:         { label: 'Chargeback initié',        className: 'badge-blue-light' },
  MERCHANT_RESPONSE_RECEIVED:   { label: 'Réponse marchand reçue',   className: 'badge-purple' },
  REFUND_COMPLETED:             { label: 'Remboursement effectué',   className: 'badge-green-light' },
  CLOSED:                       { label: 'Clôturé',                  className: 'badge-gray' },
};

// Mapping statut backend -> libellé français pour graphiques
export const STATUS_LABEL_FR = {
  SUBMITTED:                    'Soumis',
  UNDER_REVIEW:                 'En cours d\'analyse',
  WAITING_FOR_INFORMATION:      'En attente d\'informations',
  APPROVED:                     'Approuvé',
  REJECTED:                     'Rejeté',
  CHARGEBACK_INITIATED:         'Chargeback initié',
  MERCHANT_RESPONSE_RECEIVED:   'Réponse marchand reçue',
  REFUND_COMPLETED:             'Remboursement effectué',
  CLOSED:                       'Clôturé',
};

// Mapping motif backend -> libellé humain lisible
export const REASON_LABEL = {
  UNAUTHORIZED_TRANSACTION:       'Transaction non autorisée',
  DOUBLE_CHARGE:                  'Double débit',
  GOODS_NOT_RECEIVED:             'Bien non reçu',
  SERVICE_NOT_PROVIDED:           'Service non fourni',
  INCORRECT_AMOUNT:               'Montant incorrect',
  CANCELLED_RECURRING_PAYMENT:    'Paiement récurrent annulé mais débité',
  FRAUD:                          'Fraude',
  ATM_CASH_NOT_DISPENSED:         'Distributeur automatique n\'ayant pas délivré les espèces',
  OTHER:                          'Autre',
};

export const DISPUTE_REASONS = Object.keys(REASON_LABEL);
