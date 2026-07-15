// ============================================================================
// constants.js — Valeurs métier figées par le cahier des charges.
//
// Centraliser ces listes ici garantit que le frontend n'accepte et n'affiche
// jamais une valeur de statut ou de motif qui ne serait pas reconnue par le
// backend (les mêmes 9 statuts et 9 motifs sont imposés côté base de données
// via des contraintes CHECK).
// ============================================================================

// Les 8 statuts possibles d'un litige, dans l'ordre logique du workflow.
export const DISPUTE_STATUSES = [
  'SOUMIS',
  'EN_COURS_D_ANALYSE',
  'EN_ATTENTE_D_INFORMATIONS',
  'APPROUVE',
  'REJETE',
  'CHARGEBACK_INITIE',
  'REMBOURSEMENT_EFFECTUE',
  'CLOTURE',
];

// Libellés humains lisibles pour chaque statut technique.
export const STATUS_LABELS = {
  SOUMIS: 'Soumis',
  EN_COURS_D_ANALYSE: 'En cours d\'analyse',
  EN_ATTENTE_D_INFORMATIONS: 'En attente d\'informations',
  APPROUVE: 'Approuvé',
  REJETE: 'Rejeté',
  CHARGEBACK_INITIE: 'Chargeback initié',
  REMBOURSEMENT_EFFECTUE: 'Remboursement effectué',
  CLOTURE: 'Clôturé',
};

// Couleur associée à chaque statut, utilisée par le composant StatusBadge
// et par les graphiques de répartition (Status Distribution).
export const STATUS_COLORS = {
  SOUMIS: '#e53e3e',
  EN_COURS_D_ANALYSE: '#38a169',
  EN_ATTENTE_D_INFORMATIONS: '#4299e1',
  APPROUVE: '#38a169',
  REJETE: '#e53e3e',
  CHARGEBACK_INITIE: '#4299e1',
  REMBOURSEMENT_EFFECTUE: '#718096',
  CLOTURE: '#718096',
};

// Les 9 motifs de contestation possibles, valeur technique -> libellé humain.
export const DISPUTE_REASONS = [
  { value: 'UNAUTHORIZED_TRANSACTION', label: 'Unauthorized Transaction' },
  { value: 'DOUBLE_CHARGE', label: 'Double Charge' },
  { value: 'GOODS_NOT_RECEIVED', label: 'Goods Not Received' },
  { value: 'SERVICE_NOT_PROVIDED', label: 'Service Not Provided' },
  { value: 'INCORRECT_AMOUNT', label: 'Incorrect Amount' },
  { value: 'CANCELLED_RECURRING_PAYMENT', label: 'Cancelled Recurring Payment' },
  { value: 'FRAUD', label: 'Fraud' },
  { value: 'ATM_CASH_NOT_DISPENSED', label: 'ATM Cash Not Dispensed' },
  { value: 'OTHER', label: 'Other' },
];

export const REASON_LABELS = Object.fromEntries(DISPUTE_REASONS.map((r) => [r.value, r.label]));

// Regroupement simplifié utilisé pour les compteurs des cartes KPI :
// un statut "En cours" englobe tout ce qui n'est ni terminal ni approuvé.
export const IN_PROGRESS_STATUSES = ['EN_COURS_D_ANALYSE', 'EN_ATTENTE_D_INFORMATIONS'];
export const APPROVED_LIKE_STATUSES = ['APPROUVE', 'CHARGEBACK_INITIE', 'REMBOURSEMENT_EFFECTUE'];
