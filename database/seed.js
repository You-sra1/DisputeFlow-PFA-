// Script d'initialisation (seed) de la base de données SQLite.
// Insère des données de démonstration cohérentes pour le développement.
// Exécution : node database/seed.js (depuis la racine du projet)
//             (doit être lancé APRÈS database/migrate.js)
//
// Le script est idempotent : il supprime toutes les données existantes
// avant de réinsérer, pour garantir un état propre et reproductible.
//
// ══════════════════════════════════════════════════════════════════════════════
// COMPTES DE TEST (mot de passe en clair pour tous : Password123)
// ══════════════════════════════════════════════════════════════════════════════
//   ID          | Nom            | Email                     | Rôle
//   ------------|----------------|---------------------------|----------
//   CLIENT001   | Alice Martin   | client001@example.com     | CLIENT
//   CLIENT002   | Bruno Durand   | client002@example.com     | CLIENT
//   OPERATOR001 | Bob Dupont     | operator@example.com      | OPERATOR
//
// ══════════════════════════════════════════════════════════════════════════════
// CARTES BANCAIRES
// ══════════════════════════════════════════════════════════════════════════════
//   ID      | Utilisateur | Numéro             | Type       | Expiration
//   --------|-------------|--------------------|------------|----------
//   CARD001 | CLIENT001   | 5426679999889039   | MASTERCARD | 12/28
//   CARD002 | CLIENT002   | 4539123456789012   | VISA       | 09/27
//
// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS (5 minimum, réparties entre les clients)
// ══════════════════════════════════════════════════════════════════════════════
//   ID     | Client     | Marchand       | Montant  | Date       | Statut
//   -------|------------|----------------|----------|------------|----------
//   TXN001 | CLIENT001  | Amazon         | 250.75   | 2026-06-15 | COMPLETED
//   TXN002 | CLIENT001  | Netflix        | 14.99    | 2026-07-01 | COMPLETED
//   TXN003 | CLIENT002  | Uber Eats      | 67.50    | 2026-06-20 | COMPLETED
//   TXN004 | CLIENT002  | Booking.com    | 320.00   | 2026-06-25 | COMPLETED
//   TXN005 | CLIENT001  | Steam          | 89.99    | 2026-07-05 | COMPLETED
//
// ══════════════════════════════════════════════════════════════════════════════
// LITIGES (10 disputes – 1 par statut + 1 CLOSED supplémentaire)
// ══════════════════════════════════════════════════════════════════════════════
//   ID     | Statut                     | Motif                          | Client
//   --------|----------------------------|--------------------------------|----------
//   DSP001  | SUBMITTED                  | UNAUTHORIZED_TRANSACTION       | CLIENT001
//   DSP002  | UNDER_REVIEW               | DOUBLE_CHARGE                  | CLIENT002
//   DSP003  | WAITING_FOR_INFORMATION    | GOODS_NOT_RECEIVED             | CLIENT001
//   DSP004  | APPROVED                   | SERVICE_NOT_PROVIDED           | CLIENT002
//   DSP005  | REJECTED (pas clôturé)     | INCORRECT_AMOUNT               | CLIENT001
//   DSP006  | CHARGEBACK_INITIATED       | CANCELLED_RECURRING_PAYMENT    | CLIENT002
//   DSP007  | MERCHANT_RESPONSE_RECEIVED | FRAUD                          | CLIENT001
//   DSP008  | REFUND_COMPLETED           | ATM_CASH_NOT_DISPENSED         | CLIENT002
//   DSP009  | CLOSED (issu d'un rejet)   | OTHER                          | CLIENT001
//   DSP010  | CLOSED (issu d'un rembours)| UNAUTHORIZED_TRANSACTION       | CLIENT002
// ══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const sqlite3 = require(path.join(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();
const bcrypt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'bcryptjs'));

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.run('PRAGMA foreign_keys = ON');

const SALT_ROUNDS = 10;
const PLAIN_PASSWORD = 'Password123';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

// ─── Nettoyage (ordre respectant les clés étrangères) ───────────────────────
async function cleanAll() {
  console.log('Nettoyage des données existantes...');
  await run('DELETE FROM dispute_documents');
  await run('DELETE FROM dispute_comments');
  await run('DELETE FROM dispute_status_history');
  await run('DELETE FROM disputes');
  await run('DELETE FROM transactions');
  await run('DELETE FROM cards');
  await run('DELETE FROM users');
  console.log('  ✓ Toutes les données supprimées.\n');
}

// ─── Seed : utilisateurs ────────────────────────────────────────────────────
async function seedUsers() {
  console.log('Insertion des utilisateurs...');
  const hash = await bcrypt.hash(PLAIN_PASSWORD, SALT_ROUNDS);

  const users = [
    { id: 'CLIENT001',  name: 'Alice Martin',  email: 'client001@example.com',  role: 'CLIENT' },
    { id: 'CLIENT002',  name: 'Bruno Durand',   email: 'client002@example.com',  role: 'CLIENT' },
    { id: 'OPERATOR001', name: 'Bob Dupont',    email: 'operator@example.com',   role: 'OPERATOR' },
  ];

  for (const u of users) {
    await run(
      `INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`,
      [u.id, u.name, u.email, hash, u.role]
    );
    console.log(`  ✓ ${u.id} – ${u.name} (${u.email}) [${u.role}]`);
  }
}

// ─── Seed : cartes bancaires ────────────────────────────────────────────────
async function seedCards() {
  console.log('Insertion des cartes bancaires...');
  const cards = [
    {
      id: 'CARD001', userId: 'CLIENT001', cardNumber: '5426679999889039',
      cardType: 'MASTERCARD', expiryDate: '12/28', cardholderName: 'Alice Martin',
    },
    {
      id: 'CARD002', userId: 'CLIENT002', cardNumber: '4539123456789012',
      cardType: 'VISA', expiryDate: '09/27', cardholderName: 'Bruno Durand',
    },
  ];

  for (const c of cards) {
    await run(
      `INSERT INTO cards (id, userId, cardNumber, cardType, expiryDate, cardholderName)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.userId, c.cardNumber, c.cardType, c.expiryDate, c.cardholderName]
    );
    console.log(`  ✓ ${c.id} – ${c.cardNumber} (${c.cardType}) → ${c.userId}`);
  }
}

// ─── Seed : transactions ────────────────────────────────────────────────────
async function seedTransactions() {
  console.log('Insertion des transactions...');
  const transactions = [
    { id: 'TXN001', userId: 'CLIENT001', cardId: 'CARD001', amount: 250.75, currency: 'USD', merchant: 'Amazon', merchantCategory: '5311', status: 'COMPLETED', transactionDate: '2026-06-15', description: 'Achat en ligne Amazon' },
    { id: 'TXN002', userId: 'CLIENT001', cardId: 'CARD001', amount: 14.99,  currency: 'USD', merchant: 'Netflix', merchantCategory: '5812', status: 'COMPLETED', transactionDate: '2026-07-01', description: 'Abonnement mensuel Netflix' },
    { id: 'TXN003', userId: 'CLIENT002', cardId: 'CARD002', amount: 67.50,  currency: 'USD', merchant: 'Uber Eats', merchantCategory: '5814', status: 'COMPLETED', transactionDate: '2026-06-20', description: 'Commande repas Uber Eats' },
    { id: 'TXN004', userId: 'CLIENT002', cardId: 'CARD002', amount: 320.00, currency: 'USD', merchant: 'Booking.com', merchantCategory: '7011', status: 'COMPLETED', transactionDate: '2026-06-25', description: 'Réservation hôtel Booking' },
    { id: 'TXN005', userId: 'CLIENT001', cardId: 'CARD001', amount: 89.99,  currency: 'USD', merchant: 'Steam', merchantCategory: '5732', status: 'COMPLETED', transactionDate: '2026-07-05', description: 'Achats jeux Steam' },
    { id: 'TXN006', userId: 'CLIENT001', cardId: 'CARD001', amount: 199.99, currency: 'USD', merchant: 'Apple Store', merchantCategory: '5732', status: 'COMPLETED', transactionDate: '2026-07-10', description: 'Achat Apple Store (sans litige)' },
  ];

  for (const t of transactions) {
    await run(
      `INSERT INTO transactions (id, userId, cardId, amount, currency, merchant, merchantCategory, status, transactionDate, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.userId, t.cardId, t.amount, t.currency, t.merchant, t.merchantCategory, t.status, t.transactionDate, t.description]
    );
    console.log(`  ✓ ${t.id} – ${t.merchant} ${t.amount} ${t.currency} [${t.status}]`);
  }
}

// ─── Seed : litiges ─────────────────────────────────────────────────────────
async function seedDisputes() {
  console.log('Insertion des litiges...');
  const disputes = [
    { id: 'DSP001', transactionId: 'TXN001', userId: 'CLIENT001', reason: 'UNAUTHORIZED_TRANSACTION', description: 'Transaction que je n\'ai pas autorisée sur mon compte.', amount: 250.75, currency: 'USD', status: 'SUBMITTED', priority: 'HIGH', assignedTo: 'OPERATOR001', createdAt: '2026-07-10 10:00:00', updatedAt: '2026-07-10 10:00:00' },
    { id: 'DSP002', transactionId: 'TXN003', userId: 'CLIENT002', reason: 'DOUBLE_CHARGE', description: 'J\'ai été facturé deux fois pour la même commande Uber Eats.', amount: 67.50, currency: 'USD', status: 'UNDER_REVIEW', priority: 'NORMAL', assignedTo: 'OPERATOR001', createdAt: '2026-07-08 09:00:00', updatedAt: '2026-07-09 11:00:00' },
    { id: 'DSP003', transactionId: 'TXN002', userId: 'CLIENT001', reason: 'GOODS_NOT_RECEIVED', description: 'Les marchandises commandées n\'ont jamais été livrées.', amount: 14.99, currency: 'USD', status: 'WAITING_FOR_INFORMATION', priority: 'NORMAL', assignedTo: 'OPERATOR001', createdAt: '2026-07-05 08:30:00', updatedAt: '2026-07-07 10:00:00' },
    { id: 'DSP004', transactionId: 'TXN004', userId: 'CLIENT002', reason: 'SERVICE_NOT_PROVIDED', description: 'Le service réservé sur Booking.com n\'a pas été rendu.', amount: 320.00, currency: 'USD', status: 'APPROVED', priority: 'HIGH', assignedTo: 'OPERATOR001', createdAt: '2026-07-01 09:00:00', updatedAt: '2026-07-03 15:00:00' },
    { id: 'DSP005', transactionId: 'TXN005', userId: 'CLIENT001', reason: 'INCORRECT_AMOUNT', description: 'Le montant débité (89.99) ne correspond pas au prix affiché (49.99).', amount: 89.99, currency: 'USD', status: 'REJECTED', priority: 'LOW', assignedTo: 'OPERATOR001', createdAt: '2026-06-28 11:00:00', updatedAt: '2026-06-30 16:00:00' },
    { id: 'DSP006', transactionId: 'TXN003', userId: 'CLIENT002', reason: 'CANCELLED_RECURRING_PAYMENT', description: 'Abonnement résilié mais les prélèvements continuent.', amount: 67.50, currency: 'USD', status: 'CHARGEBACK_INITIATED', priority: 'HIGH', assignedTo: 'OPERATOR001', createdAt: '2026-06-20 08:00:00', updatedAt: '2026-06-23 09:00:00' },
    { id: 'DSP007', transactionId: 'TXN001', userId: 'CLIENT001', reason: 'FRAUD', description: 'Transaction frauduleuse détectée sur mon compte.', amount: 250.75, currency: 'USD', status: 'MERCHANT_RESPONSE_RECEIVED', priority: 'URGENT', assignedTo: 'OPERATOR001', createdAt: '2026-06-15 09:00:00', updatedAt: '2026-06-19 16:00:00' },
    { id: 'DSP008', transactionId: 'TXN004', userId: 'CLIENT002', reason: 'ATM_CASH_NOT_DISPENSED', description: 'Le distributeur n\'a pas remis les billets mais le compte a été débité.', amount: 320.00, currency: 'USD', status: 'REFUND_COMPLETED', priority: 'HIGH', assignedTo: 'OPERATOR001', createdAt: '2026-06-10 08:00:00', updatedAt: '2026-06-15 15:00:00' },
    { id: 'DSP009', transactionId: 'TXN002', userId: 'CLIENT001', reason: 'OTHER', description: 'Je conteste cette transaction pour motif divers non listé.', amount: 14.99, currency: 'USD', status: 'CLOSED', priority: 'LOW', assignedTo: 'OPERATOR001', createdAt: '2026-06-05 09:00:00', updatedAt: '2026-06-08 09:00:00' },
    { id: 'DSP010', transactionId: 'TXN005', userId: 'CLIENT002', reason: 'UNAUTHORIZED_TRANSACTION', description: 'Transaction non autorisée détectée après vérification du relevé.', amount: 89.99, currency: 'USD', status: 'CLOSED', priority: 'NORMAL', assignedTo: 'OPERATOR001', createdAt: '2026-06-01 08:00:00', updatedAt: '2026-06-07 09:00:00' },
  ];

  for (const d of disputes) {
    await run(
      `INSERT INTO disputes (id, transactionId, userId, reason, description, amount, currency, status, priority, assignedTo, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.id, d.transactionId, d.userId, d.reason, d.description, d.amount, d.currency, d.status, d.priority, d.assignedTo, d.createdAt, d.updatedAt]
    );
    console.log(`  ✓ ${d.id} – ${d.status} – ${d.reason}`);
  }
}

// ─── Seed : historique des statuts ──────────────────────────────────────────
// Pour chaque litige, on génère TOUT l'historique cohérent depuis SUBMITTED
// jusqu'au statut final, avec fromStatus, toStatus, changedBy, date, reason.
async function seedStatusHistory() {
  console.log('Insertion de l\'historique des statuts...');
  const entries = [
    // ── DSP001 : SUBMITTED ──────────────────────────────────────────────
    { id: 'HIST001', disputeId: 'DSP001', fromStatus: null,           toStatus: 'SUBMITTED',  changedBy: 'CLIENT001',  reason: 'Client a soumis le litige',                                  createdAt: '2026-07-10 10:00:00' },

    // ── DSP002 : SUBMITTED → UNDER_REVIEW ───────────────────────────────
    { id: 'HIST002', disputeId: 'DSP002', fromStatus: null,           toStatus: 'SUBMITTED',  changedBy: 'CLIENT002',  reason: 'Client a soumis le litige',                                  createdAt: '2026-07-08 09:00:00' },
    { id: 'HIST003', disputeId: 'DSP002', fromStatus: 'SUBMITTED',    toStatus: 'UNDER_REVIEW', changedBy: 'OPERATOR001', reason: 'Litige pris en charge par l\'opérateur',                    createdAt: '2026-07-09 11:00:00' },

    // ── DSP003 : SUBMITTED → UNDER_REVIEW → WAITING_FOR_INFORMATION ────
    { id: 'HIST004', disputeId: 'DSP003', fromStatus: null,           toStatus: 'SUBMITTED',  changedBy: 'CLIENT001',  reason: 'Client a soumis le litige',                                  createdAt: '2026-07-05 08:30:00' },
    { id: 'HIST005', disputeId: 'DSP003', fromStatus: 'SUBMITTED',    toStatus: 'UNDER_REVIEW', changedBy: 'OPERATOR001', reason: 'Analyse du litige en cours',                                 createdAt: '2026-07-06 14:00:00' },
    { id: 'HIST006', disputeId: 'DSP003', fromStatus: 'UNDER_REVIEW', toStatus: 'WAITING_FOR_INFORMATION', changedBy: 'OPERATOR001', reason: 'Documents complémentaires demandés au client',        createdAt: '2026-07-07 10:00:00' },

    // ── DSP004 : SUBMITTED → UNDER_REVIEW → APPROVED ────────────────────
    { id: 'HIST007', disputeId: 'DSP004', fromStatus: null,           toStatus: 'SUBMITTED',  changedBy: 'CLIENT002',  reason: 'Client a soumis le litige',                                  createdAt: '2026-07-01 09:00:00' },
    { id: 'HIST008', disputeId: 'DSP004', fromStatus: 'SUBMITTED',    toStatus: 'UNDER_REVIEW', changedBy: 'OPERATOR001', reason: 'Examen du dossier en cours',                                 createdAt: '2026-07-02 10:00:00' },
    { id: 'HIST009', disputeId: 'DSP004', fromStatus: 'UNDER_REVIEW', toStatus: 'APPROVED',   changedBy: 'OPERATOR001', reason: 'Litige validé, preuves suffisantes',                          createdAt: '2026-07-03 15:00:00' },

    // ── DSP005 : SUBMITTED → UNDER_REVIEW → REJECTED ────────────────────
    { id: 'HIST010', disputeId: 'DSP005', fromStatus: null,           toStatus: 'SUBMITTED',  changedBy: 'CLIENT001',  reason: 'Client a soumis le litige',                                  createdAt: '2026-06-28 11:00:00' },
    { id: 'HIST011', disputeId: 'DSP005', fromStatus: 'SUBMITTED',    toStatus: 'UNDER_REVIEW', changedBy: 'OPERATOR001', reason: 'Vérification du montant avec le marchand',                  createdAt: '2026-06-29 09:30:00' },
    { id: 'HIST012', disputeId: 'DSP005', fromStatus: 'UNDER_REVIEW', toStatus: 'REJECTED',   changedBy: 'OPERATOR001', reason: 'Preuves insuffisantes, montant conforme au prix affiché',    createdAt: '2026-06-30 16:00:00' },

    // ── DSP006 : SUBMITTED → UNDER_REVIEW → APPROVED → CHARGEBACK_INITIATED ─
    { id: 'HIST013', disputeId: 'DSP006', fromStatus: null,           toStatus: 'SUBMITTED',  changedBy: 'CLIENT002',  reason: 'Client a soumis le litige',                                  createdAt: '2026-06-20 08:00:00' },
    { id: 'HIST014', disputeId: 'DSP006', fromStatus: 'SUBMITTED',    toStatus: 'UNDER_REVIEW', changedBy: 'OPERATOR001', reason: 'Analyse approfondie de la demande',                          createdAt: '2026-06-21 10:00:00' },
    { id: 'HIST015', disputeId: 'DSP006', fromStatus: 'UNDER_REVIEW', toStatus: 'APPROVED',   changedBy: 'OPERATOR001', reason: 'Litige fondé, résiliation confirmée',                        createdAt: '2026-06-22 14:00:00' },
    { id: 'HIST016', disputeId: 'DSP006', fromStatus: 'APPROVED',     toStatus: 'CHARGEBACK_INITIATED', changedBy: 'OPERATOR001', reason: 'Procédure de chargeback lancée auprès de l\'émetteur', createdAt: '2026-06-23 09:00:00' },

    // ── DSP007 : SUBMITTED → UNDER_REVIEW → APPROVED → CHARGEBACK_INITIATED → MERCHANT_RESPONSE_RECEIVED ──
    { id: 'HIST017', disputeId: 'DSP007', fromStatus: null,           toStatus: 'SUBMITTED',  changedBy: 'CLIENT001',  reason: 'Client a soumis le litige',                                  createdAt: '2026-06-15 09:00:00' },
    { id: 'HIST018', disputeId: 'DSP007', fromStatus: 'SUBMITTED',    toStatus: 'UNDER_REVIEW', changedBy: 'OPERATOR001', reason: 'Enquête de fraude en cours',                                 createdAt: '2026-06-16 11:00:00' },
    { id: 'HIST019', disputeId: 'DSP007', fromStatus: 'UNDER_REVIEW', toStatus: 'APPROVED',   changedBy: 'OPERATOR001', reason: 'Fraude confirmée, litige approuvé',                          createdAt: '2026-06-17 14:00:00' },
    { id: 'HIST020', disputeId: 'DSP007', fromStatus: 'APPROVED',     toStatus: 'CHARGEBACK_INITIATED', changedBy: 'OPERATOR001', reason: 'Chargeback initié auprès de l\'organisme émetteur',  createdAt: '2026-06-18 10:00:00' },
    { id: 'HIST021', disputeId: 'DSP007', fromStatus: 'CHARGEBACK_INITIATED', toStatus: 'MERCHANT_RESPONSE_RECEIVED', changedBy: 'OPERATOR001', reason: 'Réponse du marchand reçue, analyse en cours', createdAt: '2026-06-19 16:00:00' },

    // ── DSP008 : SUBMITTED → ... → REFUND_COMPLETED ─────────────────────
    { id: 'HIST022', disputeId: 'DSP008', fromStatus: null,           toStatus: 'SUBMITTED',  changedBy: 'CLIENT002',  reason: 'Client a soumis le litige',                                  createdAt: '2026-06-10 08:00:00' },
    { id: 'HIST023', disputeId: 'DSP008', fromStatus: 'SUBMITTED',    toStatus: 'UNDER_REVIEW', changedBy: 'OPERATOR001', reason: 'Analyse du litige ATM en cours',                              createdAt: '2026-06-11 10:00:00' },
    { id: 'HIST024', disputeId: 'DSP008', fromStatus: 'UNDER_REVIEW', toStatus: 'APPROVED',   changedBy: 'OPERATOR001', reason: 'Litige justifié, preuves concordantes',                      createdAt: '2026-06-12 13:00:00' },
    { id: 'HIST025', disputeId: 'DSP008', fromStatus: 'APPROVED',     toStatus: 'CHARGEBACK_INITIATED', changedBy: 'OPERATOR001', reason: 'Chargeback lancé pour transaction ATM',              createdAt: '2026-06-13 09:00:00' },
    { id: 'HIST026', disputeId: 'DSP008', fromStatus: 'CHARGEBACK_INITIATED', toStatus: 'MERCHANT_RESPONSE_RECEIVED', changedBy: 'OPERATOR001', reason: 'Réponse du marchand traitée',       createdAt: '2026-06-14 11:00:00' },
    { id: 'HIST027', disputeId: 'DSP008', fromStatus: 'MERCHANT_RESPONSE_RECEIVED', toStatus: 'REFUND_COMPLETED', changedBy: 'OPERATOR001', reason: 'Remboursement effectué sur le compte du client', createdAt: '2026-06-15 15:00:00' },

    // ── DSP009 : SUBMITTED → UNDER_REVIEW → REJECTED → CLOSED (issu d'un rejet) ──
    { id: 'HIST028', disputeId: 'DSP009', fromStatus: null,           toStatus: 'SUBMITTED',  changedBy: 'CLIENT001',  reason: 'Client a soumis le litige',                                  createdAt: '2026-06-05 09:00:00' },
    { id: 'HIST029', disputeId: 'DSP009', fromStatus: 'SUBMITTED',    toStatus: 'UNDER_REVIEW', changedBy: 'OPERATOR001', reason: 'Examen du dossier',                                          createdAt: '2026-06-06 10:00:00' },
    { id: 'HIST030', disputeId: 'DSP009', fromStatus: 'UNDER_REVIEW', toStatus: 'REJECTED',   changedBy: 'OPERATOR001', reason: 'Motif non justifié, preuves insuffisantes',                   createdAt: '2026-06-07 14:00:00' },
    { id: 'HIST031', disputeId: 'DSP009', fromStatus: 'REJECTED',     toStatus: 'CLOSED',     changedBy: 'OPERATOR001', reason: 'Litige clôturé après notification du rejet au client',       createdAt: '2026-06-08 09:00:00' },

    // ── DSP010 : SUBMITTED → ... → REFUND_COMPLETED → CLOSED (issu d'un remboursement) ──
    { id: 'HIST032', disputeId: 'DSP010', fromStatus: null,           toStatus: 'SUBMITTED',  changedBy: 'CLIENT002',  reason: 'Client a soumis le litige',                                  createdAt: '2026-06-01 08:00:00' },
    { id: 'HIST033', disputeId: 'DSP010', fromStatus: 'SUBMITTED',    toStatus: 'UNDER_REVIEW', changedBy: 'OPERATOR001', reason: 'Analyse du litige',                                           createdAt: '2026-06-02 10:00:00' },
    { id: 'HIST034', disputeId: 'DSP010', fromStatus: 'UNDER_REVIEW', toStatus: 'APPROVED',   changedBy: 'OPERATOR001', reason: 'Litige approuvé, transaction frauduleuse confirmée',          createdAt: '2026-06-03 14:00:00' },
    { id: 'HIST035', disputeId: 'DSP010', fromStatus: 'APPROVED',     toStatus: 'CHARGEBACK_INITIATED', changedBy: 'OPERATOR001', reason: 'Chargeback en cours de traitement',                   createdAt: '2026-06-04 09:00:00' },
    { id: 'HIST036', disputeId: 'DSP010', fromStatus: 'CHARGEBACK_INITIATED', toStatus: 'MERCHANT_RESPONSE_RECEIVED', changedBy: 'OPERATOR001', reason: 'Réponse du marchand reçue, pas d\'objection',  createdAt: '2026-06-05 11:00:00' },
    { id: 'HIST037', disputeId: 'DSP010', fromStatus: 'MERCHANT_RESPONSE_RECEIVED', toStatus: 'REFUND_COMPLETED', changedBy: 'OPERATOR001', reason: 'Remboursement validé',                       createdAt: '2026-06-06 15:00:00' },
    { id: 'HIST038', disputeId: 'DSP010', fromStatus: 'REFUND_COMPLETED', toStatus: 'CLOSED', changedBy: 'OPERATOR001', reason: 'Litige clôturé avec succès',                          createdAt: '2026-06-07 09:00:00' },
  ];

  for (const h of entries) {
    await run(
      `INSERT INTO dispute_status_history (id, disputeId, fromStatus, toStatus, changedBy, reason, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [h.id, h.disputeId, h.fromStatus, h.toStatus, h.changedBy, h.reason, h.createdAt]
    );
  }
  console.log(`  ✓ ${entries.length} entrées d'historique insérées (HIST001–HIST0${entries.length})`);
}

// ─── Seed : commentaires ────────────────────────────────────────────────────
// Un commentaire pour chaque étape qui en génère un normalement.
async function seedComments() {
  console.log('Insertion des commentaires...');
  const comments = [
    // ── DSP001 (SUBMITTED) ──────────────────────────────────────────────
    { id: 'CMT001', disputeId: 'DSP001', userId: 'CLIENT001', comment: 'Je conteste cette transaction de 250.75 USD que je n\'ai jamais autorisée.', createdAt: '2026-07-10 10:00:00' },

    // ── DSP002 (UNDER_REVIEW) ───────────────────────────────────────────
    { id: 'CMT002', disputeId: 'DSP002', userId: 'CLIENT002', comment: 'J\'ai été facturé deux fois pour la même commande Uber Eats.', createdAt: '2026-07-08 09:00:00' },
    { id: 'CMT003', disputeId: 'DSP002', userId: 'OPERATOR001', comment: 'Litige pris en charge. Analyse de la double transaction en cours.', createdAt: '2026-07-09 11:00:00' },

    // ── DSP003 (WAITING_FOR_INFORMATION) ────────────────────────────────
    { id: 'CMT004', disputeId: 'DSP003', userId: 'CLIENT001', comment: 'Les marchandises commandées n\'ont jamais été livrées malgré le paiement.', createdAt: '2026-07-05 08:30:00' },
    { id: 'CMT005', disputeId: 'DSP003', userId: 'OPERATOR001', comment: 'Vérification en cours auprès du transporteur.', createdAt: '2026-07-06 14:00:00' },
    { id: 'CMT006', disputeId: 'DSP003', userId: 'OPERATOR001', comment: 'Merci de fournir le bon de livraison ou une preuve de non-réception.', createdAt: '2026-07-07 10:00:00' },

    // ── DSP004 (APPROVED) ───────────────────────────────────────────────
    { id: 'CMT007', disputeId: 'DSP004', userId: 'CLIENT002', comment: 'Le service réservé sur Booking.com n\'a pas été rendu par le prestataire.', createdAt: '2026-07-01 09:00:00' },
    { id: 'CMT008', disputeId: 'DSP004', userId: 'OPERATOR001', comment: 'Dossier en cours d\'analyse.', createdAt: '2026-07-02 10:00:00' },
    { id: 'CMT009', disputeId: 'DSP004', userId: 'OPERATOR001', comment: 'Litige approuvé. Le service n\'a effectivement pas été fourni.', createdAt: '2026-07-03 15:00:00' },

    // ── DSP005 (REJECTED) ───────────────────────────────────────────────
    { id: 'CMT010', disputeId: 'DSP005', userId: 'CLIENT001', comment: 'Le montant débité ne correspond pas au prix affiché lors de l\'achat.', createdAt: '2026-06-28 11:00:00' },
    { id: 'CMT011', disputeId: 'DSP005', userId: 'OPERATOR001', comment: 'Vérification du montant auprès du marchand en cours.', createdAt: '2026-06-29 09:30:00' },
    { id: 'CMT012', disputeId: 'DSP005', userId: 'OPERATOR001', comment: 'Rejeté : le montant débité correspond bien au prix affiché lors de l\'achat.', createdAt: '2026-06-30 16:00:00' },

    // ── DSP006 (CHARGEBACK_INITIATED) ───────────────────────────────────
    { id: 'CMT013', disputeId: 'DSP006', userId: 'CLIENT002', comment: 'L\'abonnement résilié continue d\'être prélevé chaque mois.', createdAt: '2026-06-20 08:00:00' },
    { id: 'CMT014', disputeId: 'DSP006', userId: 'OPERATOR001', comment: 'Examen de la demande de résiliation en cours.', createdAt: '2026-06-21 10:00:00' },
    { id: 'CMT015', disputeId: 'DSP006', userId: 'OPERATOR001', comment: 'Litige validé. La résiliation était bien effective avant le prélèvement.', createdAt: '2026-06-22 14:00:00' },
    { id: 'CMT016', disputeId: 'DSP006', userId: 'OPERATOR001', comment: 'Procédure de chargeback initiée auprès de l\'émetteur.', createdAt: '2026-06-23 09:00:00' },

    // ── DSP007 (MERCHANT_RESPONSE_RECEIVED) ─────────────────────────────
    { id: 'CMT017', disputeId: 'DSP007', userId: 'CLIENT001', comment: 'Transaction frauduleuse détectée sur mon compte, je n\'ai jamais effectué cet achat.', createdAt: '2026-06-15 09:00:00' },
    { id: 'CMT018', disputeId: 'DSP007', userId: 'OPERATOR001', comment: 'Enquête de fraude en cours.', createdAt: '2026-06-16 11:00:00' },
    { id: 'CMT019', disputeId: 'DSP007', userId: 'OPERATOR001', comment: 'Fraude confirmée. Litige approuvé.', createdAt: '2026-06-17 14:00:00' },
    { id: 'CMT020', disputeId: 'DSP007', userId: 'OPERATOR001', comment: 'Chargeback lancé auprès de l\'organisme émetteur.', createdAt: '2026-06-18 10:00:00' },
    { id: 'CMT021', disputeId: 'DSP007', userId: 'OPERATOR001', comment: 'Le marchand a fourni sa réponse. Analyse en cours.', createdAt: '2026-06-19 16:00:00' },

    // ── DSP008 (REFUND_COMPLETED) ───────────────────────────────────────
    { id: 'CMT022', disputeId: 'DSP008', userId: 'CLIENT002', comment: 'Le distributeur n\'a pas remis les billets mais mon compte a été débité de 320 USD.', createdAt: '2026-06-10 08:00:00' },
    { id: 'CMT023', disputeId: 'DSP008', userId: 'OPERATOR001', comment: 'Analyse du litige ATM en cours.', createdAt: '2026-06-11 10:00:00' },
    { id: 'CMT024', disputeId: 'DSP008', userId: 'OPERATOR001', comment: 'Litige justifié. Les logs ATM confirment l\'absence de distribution.', createdAt: '2026-06-12 13:00:00' },
    { id: 'CMT025', disputeId: 'DSP008', userId: 'OPERATOR001', comment: 'Chargeback en cours de traitement.', createdAt: '2026-06-13 09:00:00' },
    { id: 'CMT026', disputeId: 'DSP008', userId: 'OPERATOR001', comment: 'Réponse du marchand reçue et traitée.', createdAt: '2026-06-14 11:00:00' },
    { id: 'CMT027', disputeId: 'DSP008', userId: 'OPERATOR001', comment: 'Remboursement de 320.00 USD effectué sur le compte du client.', createdAt: '2026-06-15 15:00:00' },

    // ── DSP009 (CLOSED – issu d'un rejet) ───────────────────────────────
    { id: 'CMT028', disputeId: 'DSP009', userId: 'CLIENT001', comment: 'Je souhaite contester cette transaction pour un motif non listé.', createdAt: '2026-06-05 09:00:00' },
    { id: 'CMT029', disputeId: 'DSP009', userId: 'OPERATOR001', comment: 'Examen du dossier en cours.', createdAt: '2026-06-06 10:00:00' },
    { id: 'CMT030', disputeId: 'DSP009', userId: 'OPERATOR001', comment: 'Rejet du litige : motif non fondé, aucune anomalie détectée.', createdAt: '2026-06-07 14:00:00' },
    { id: 'CMT031', disputeId: 'DSP009', userId: 'OPERATOR001', comment: 'Litige clôturé après notification du rejet au client.', createdAt: '2026-06-08 09:00:00' },

    // ── DSP010 (CLOSED – issu d'un remboursement) ───────────────────────
    { id: 'CMT032', disputeId: 'DSP010', userId: 'CLIENT002', comment: 'Transaction non autorisée détectée sur mon compte.', createdAt: '2026-06-01 08:00:00' },
    { id: 'CMT033', disputeId: 'DSP010', userId: 'OPERATOR001', comment: 'Analyse du litige en cours.', createdAt: '2026-06-02 10:00:00' },
    { id: 'CMT034', disputeId: 'DSP010', userId: 'OPERATOR001', comment: 'Litige approuvé, transaction frauduleuse confirmée.', createdAt: '2026-06-03 14:00:00' },
    { id: 'CMT035', disputeId: 'DSP010', userId: 'OPERATOR001', comment: 'Chargeback lancé.', createdAt: '2026-06-04 09:00:00' },
    { id: 'CMT036', disputeId: 'DSP010', userId: 'OPERATOR001', comment: 'Réponse du marchand reçue, pas d\'objection au remboursement.', createdAt: '2026-06-05 11:00:00' },
    { id: 'CMT037', disputeId: 'DSP010', userId: 'OPERATOR001', comment: 'Remboursement validé.', createdAt: '2026-06-06 15:00:00' },
    { id: 'CMT038', disputeId: 'DSP010', userId: 'OPERATOR001', comment: 'Litige clôturé avec succès.', createdAt: '2026-06-07 09:00:00' },
  ];

  for (const c of comments) {
    await run(
      `INSERT INTO dispute_comments (id, disputeId, userId, comment, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [c.id, c.disputeId, c.userId, c.comment, c.createdAt]
    );
  }
  console.log(`  ✓ ${comments.length} commentaires insérés (CMT001–CMT0${comments.length})`);
}

// ─── Seed : pièces justificatives ───────────────────────────────────────────
async function seedDocuments() {
  console.log('Insertion des pièces justificatives...');
  // PDF: W3C dummy.pdf (real test file, 17688 bytes base64)
  const pdfBase64 = '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CmVuZG9iagoKOSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UcnVlVHlwZS9CYXNlRm9udC9CQUFBQUErQXJpYWwtQm9sZE1UCi9GaXJzdENoYXIgMAovTGFzdENoYXIgMTEKL1dpZHRoc1s3NTAgNzIyIDYxMCA4ODkgNTU2IDI3NyA2NjYgNjEwIDMzMyAyNzcgMjc3IDU1NiBdCi9Gb250RGVzY3JpcHRvciA3IDAgUgovVG9Vbmljb2RlIDggMCBSCj4+CmVuZG9iagoKMTAgMCBvYmoKPDwKL0YxIDkgMCBSCj4+CmVuZG9iagoKMTEgMCBvYmoKPDwvRm9udCAxMCAwIFIKL1Byb2NTZXRbL1BERi9UZXh0XT4+CmVuZG9iagoKMSAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDQgMCBSL1Jlc291cmNlcyAxMSAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL0dyb3VwPDwvUy9UcmFuc3BhcmVuY3kvQ1MvRGV2aWNlUkdCL0kgdHJ1ZT4+L0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCgoxMiAwIG9iago8PC9Db3VudCAxL0ZpcnN0IDEzIDAgUi9MYXN0IDEzIDAgUgo+PgplbmRvYmoKCjEzIDAgb2JqCjw8L1RpdGxlPEZFRkYwMDQ0MDA3NTAwNkQwMDZEMDA3OTAwMjAwMDUwMDA0NDAwNDYwMDIwMDA2NjAwNjkwMDZDMDA2NT4KL0Rlc3RbMSAwIFIvWFlaIDU2LjcgNzczLjMgMF0vUGFyZW50IDEyIDAgUj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBlL1BhZ2VzCi9SZXNvdXJjZXMgMTEgMCBSCi9NZWRpYUJveFsgMCAwIDU5NSA4NDIgXQovS2lkc1sgMSAwIFIgXQovQ291bnQgMT4+CmVuZG9iagoKMTQgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSCi9PdXRsaW5lcyAxMiAwIFIKPj4KZW5kb2JqCgoxNSAwIG9iago8PC9BdXRob3I8RkVGRjAwNDUwMDc2MDA2MTAwNkUwMDY3MDA2NTAwNkMwMDZGMDA3MzAwMjAwMDU2MDA2QzAwNjEwMDYzMDA2ODAwNkYwMDY3MDA2OTAwNjEwMDZFMDA2RTAwNjkwMDczPgovQ3JlYXRvcjxGRUZGMDA1NzAwNzIwMDY5MDA3NDAwNjUwMDcyPgovUHJvZHVjZXI8RkVGRjAwNEYwMDcwMDA2NTAwNkUwMDRGMDA2NjAwNjYwMDY5MDA2MzAwNjUwMDJFMDA2RjAwNzIwMDY3MDAyMDAwMzIwMDJFMDAzMT4KL0NyZWF0aW9uRGF0ZShEOjIwMDcwMjIzMTc1NjM3KzAyJzAwJyk+PgplbmRvYmoKCnhyZWYKMCAxNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMTE5OTcgMDAwMDAgbiAKMDAwMDAwMDAxOSAwMDAwMCBuIAowMDAwMDAwMjI0IDAwMDAwIG4gCjAwMDAwMTIzMzAgMDAwMDAgbiAKMDAwMDAwMDI0NCAwMDAwMCBuIAowMDAwMDExMTU0IDAwMDAwIG4gCjAwMDAwMTExNzYgMDAwMDAgbiAKMDAwMDAxMTM2OCAwMDAwMCBuIAowMDAwMDExNzA5IDAwMDAwIG4gCjAwMDAwMTE5MTAgMDAwMDAgbiAKMDAwMDAxMTk0MyAwMDAwMCBuIAowMDAwMDEyMTQwIDAwMDAwIG4gCjAwMDAwMTIxOTYgMDAwMDAgbiAKMDAwMDAxMjQyOSAwMDAwMCBuIAowMDAwMDEyNDk0IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSAxNi9Sb290IDE0IDAgUgovSW5mbyAxNSAwIFIKL0lEIFsgPEY3RDc3QjNEMjJCOUY5MjgyOUQ0OUZGNUQ3OEI4RjI4Pgo8RjdENzdCM0QyMkI5RjkyODI5RDQ5RkY1RDc4QjhGMjg+IF0KPj4Kc3RhcnR4cmVmCjEyNzg3CiUlRU9GCg==';
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAlgAAAGQCAYAAAByNR6YAAAACXBIWXMAAAsTAAALEwEAmpwYAAAfWklEQVR4nO3dZ5c0Vdk24Oc/mRNGVDBhzjmAWcwJA6ISxAwoYsCAGTCLCSMomDBHFBDEfP2DftfZ6xnX/c4zXVU9c/X03NPHh2MJMl2hu7rq7L2vvff/VNUMAIBq8z/rPgAAgDpkBCwAgOolYAEAVC8BCwCgeglYAADVS8ACAKheAhYAQPUSsAAAqpeABQBQvQQsAIDqJWABAFQvAQsAoHoJWAAA1UvAAgCoXgIWAED1ErAAAKqXgAUAUL0ELACA6iVgAQBULwELAKB6CVgAANVLwAIAqF4CFgBA9RKwAACql4AFAFC9BCwAgOolYAEAVC8BCwCgeglYAADVS8ACAKheAhYAQPUSsAAAqpeABQBQvQQsAIDqJWABAFQvAQsAoHoJWAAA1UvAAgCoXgIWAED1ErAAAKqXgAUAUL0ELACA6iVgAQBULwELAKB6CVgAANVLwAIAqF4CFgBA9RKwAACql4AFAFC9BCwAgOolYAEAVC8BCwCgeglYAADVS8ACAKheAhYAQPUSsAAAqpeABQBQvQQsAIDqJWABAFQvAQsAoHoJWAAA1UvAAgCoXgIWAED1ErAAAKqXgAUAUL0ELACA6iVgAQBULwELAKB6CVgAANVLwAIAqF4CFgBA9RKwAACql4AFAFC9BCwAgOolYAEAVC8BCwCgeglYAADVS8ACAKheAhYAQPUSsAAAqpeABQBQvQQsAIDqJWABAFQvAQsAoHoJWAAA1UvAAgCoXgIWAED1ErAAAKqXgAUAUL0ELACA6iVgAQBULwELAKB6CVgAANVLwAIAqF4CFgBA9RKwAACql4AFAFC9BCwAgOolYAEAVC8BCwCgeglYAADVS8ACAKheAhYAQPUSsAAAqpeABQBQvQQsAIDqJWABAFQvAQsAoHoJWAAA1UvAAgCoXgIWAED1ErAAAKqXgAUAUL0ELACA6iVgAQBULwELAKB6CVgAANVLwAIAqF4CFgBA9RKwAACql4AFAFC9BCwAgOolYAEAVC8BCwCgeglYAADVS8ACAKheAhYAQPUSsAAAqpeABQBQvQQsAIDqJWABAFQvAQsAoHoJWAAA1UvAAgCoXgIWAED1ErAAAKqXgAUAUL0ELACA6iVgAQBULwELAKB6CVgAANVLwAIAqF4CFgBA9RKwAACql4AFAFC9BCwAgOolYAEAVC8BCwCgeglYAADVS8ACAKheAhYAQPUSsAAAqpeABQBQvQQsAIDqJWABAFQvAQsAoHoJWAAA1UvAAgCoXgIWAED1ErAAAKqXgAUAUL0ELACA6iVgAQBULwELAKB6CVgAANVLwAIAqF4CFgBA9RKwAACql4AFAFC9BCzgwLvkkktm73rXuxb685//vPZjPExuuOGGwff74osvXvsxQh1wAtYGuPrqq2dXXXXV0n7605/Ofvvb385vtv/5z3/Wfh5srqc97WmzW9ziFgv9+Mc/Xvja3/3udwuv8RtvvHHt53YQ/eIXvxh8v5/0pCet/RihDjgBawPc5ja3GbxZTnXMMcfMHvWoR81e9rKXzS666KL5g2vd58Zm2EvAeu1rX7vwdZdddtnaz+0gErCg9kzA2gBdAWu7W93qVvMHX7oL/v73v6/9PDm8BKz9JWBB7ZmAtQFWFbCOdO9731tdBisjYO0vAQtqzwSsDbAfAWvLC1/4Qq1ZtBOw9peANS73uVe/+tXzsolHPvKR//XZz3527cdGHQgC1gbYz4AVT3ziE4UsWglY+0vAGvehD31ox/fmgx/84NqPjToQBKwNsN8BK1760peu/bw5PASs/SVgjctgHwGLGiBgbYCxgPWIRzxix7luzj333NlZZ501e+UrXzl79KMfPbvd7W63VMj60pe+tPZz53AQsPaXgDXuYQ97mIDFbIiAtQHGAlZ+iU3Zzl//+tfZJz7xidn973//SQHroQ996NrPncNBwNpfAtawf/zjH7Pb3va2AhazIQLWBugKWFtSX5UuwCkh65prrln7+XP0E7D2l4A17Ec/+tHC90bAov6XgLUBugNW/Pvf/56deOKJowErXY3rPn82O2C9+c1vXvi6K664Yu3ndhAJWMM++clPCljMxghYG2AVASt+/vOfzycbHdr205/+9LWfP5sdsD72sY8tfN1111239nM7iASsYW984xsFLGZjBKwNsKqAFSl+H9p2CkHXff5sdsD69re/veNr7nznO6/9vA4qAWvYU57yFAGL2RgBawOsMmCddtppg9s+9thjW8/lj3/843yR3m9961uzK6+8cvab3/xmXny/3+/pX/7yl3kdxne/+93ZN77xjfkx/frXv57961//Wvvn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';

  const docs = [
    { id: 'DOC001', disputeId: 'DSP007', userId: 'CLIENT001', fileName: 'releve_compte_juin2026.pdf', fileType: 'application/pdf', filePath: '/uploads/DSP007/releve_compte_juin2026.pdf', fileSize: 154200, fileContent: pdfBase64, uploadedAt: '2026-06-15 09:15:00' },
    { id: 'DOC002', disputeId: 'DSP003', userId: 'CLIENT001', fileName: 'capture_ecran_suivi.png', fileType: 'image/png', filePath: '/uploads/DSP003/capture_ecran_suivi.png', fileSize: 87300, fileContent: pngBase64, uploadedAt: '2026-07-05 08:45:00' },
  ];

  for (const d of docs) {
    await run(
      `INSERT INTO dispute_documents (id, disputeId, userId, fileName, fileType, filePath, fileSize, fileContent, uploadedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.id, d.disputeId, d.userId, d.fileName, d.fileType, d.filePath, d.fileSize, d.fileContent || null, d.uploadedAt]
    );
    console.log(`  ✓ ${d.id} – ${d.fileName} (${d.fileType}) → ${d.disputeId}`);
  }
}

// ─── Point d'entrée ──────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Seed de la base de données – Dispute Chargeback       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    await cleanAll();
    await seedUsers();
    await seedCards();
    await seedTransactions();
    await seedDisputes();
    await seedStatusHistory();
    await seedComments();
    await seedDocuments();

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  Seed terminé avec succès.                              ║');
    console.log('║  Comptes : Password123                                  ║');
    console.log('║  3 utilisateurs | 2 cartes | 5 transactions            ║');
    console.log('║  10 litiges | 38 historiques | 38 commentaires         ║');
    console.log('║  2 pièces justificatives                                ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
  } catch (err) {
    console.error('\nErreur lors du seed :', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
