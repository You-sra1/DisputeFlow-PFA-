// Script de migration de la base de données SQLite.
// Crée l'ensemble des tables nécessaires au projet Dispute Chargeback.
// Exécution : node database/migrate.js (depuis la racine du projet)

// ─── Chemins ─────────────────────────────────────────────────────────────────
// On résout les modules depuis backend/node_modules pour éviter les doublons.
const path = require('path');
const sqlite3 = require(path.join(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// ─── Activation des contraintes de clés étrangères ───────────────────────────
// SQLite ne les active pas par défaut ; cette PRAGMA est nécessaire au
// niveau session pour garantir l'intégrité référentielle.
db.run('PRAGMA foreign_keys = ON');

// ─── Migration : suppression des anciennes tables disputes ──────────────────
// Si la base existait déjà avec l'ancien schéma (statuts OPEN/IN_REVIEW/...),
// on recrée les tables pour appliquer les nouveaux statuts et motifs du CDC.
// L'ordre de suppression respecte les contraintes de clés étrangères.
db.run(`DROP TABLE IF EXISTS dispute_documents`);
db.run(`DROP TABLE IF EXISTS dispute_comments`);
db.run(`DROP TABLE IF EXISTS dispute_status_history`);
db.run(`DROP TABLE IF EXISTS disputes`);

// ─── Table : users ───────────────────────────────────────────────────────────
// Regroupe tous les utilisateurs de l'application : clients et opérateurs.
//   id        : identifiant métier (ex: CLIENT001, OPERATOR001)
//   role      : 'CLIENT'  → porteur de carte, initie les litiges
//               'OPERATOR' → agent de traitement, gère les litiges
//   password  : hash bcrypt du mot de passe
//   createdAt : date d'inscription, valeur par défaut : date courante
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    email     TEXT NOT NULL UNIQUE,
    password  TEXT NOT NULL,
    role      TEXT NOT NULL CHECK(role IN ('CLIENT', 'OPERATOR')),
    createdAt TEXT DEFAULT (datetime('now'))
  )
`);

// ─── Table : cards ──────────────────────────────────────────────────────────
// Cartes bancaires associées à un client.
//   userId     : référence vers l'utilisateur propriétaire
//   cardNumber : numéro complet de la carte (16 chiffres)
//   cardType   : VISA, MASTERCARD, etc.
//   expiryDate : date d'expiration au format MM/YY
//   isActive   : permet de désactiver une carte sans la supprimer
db.run(`
  CREATE TABLE IF NOT EXISTS cards (
    id             TEXT PRIMARY KEY,
    userId         TEXT NOT NULL REFERENCES users(id),
    cardNumber     TEXT NOT NULL UNIQUE,
    cardType       TEXT NOT NULL CHECK(cardType IN ('VISA', 'MASTERCARD', 'AMEX')),
    expiryDate     TEXT NOT NULL,
    cardholderName TEXT NOT NULL,
    isActive       INTEGER NOT NULL DEFAULT 1,
    createdAt      TEXT DEFAULT (datetime('now'))
  )
`);

// ─── Table : transactions ───────────────────────────────────────────────────
// Transactions bancaires pouvant faire l'objet d'un litige.
//   userId          : client concerné
//   cardId          : carte utilisée pour le paiement
//   amount          : montant (ex: 250.75)
//   currency        : devise (USD, EUR, etc.)
//   merchant        : nom du commerçant
//   merchantCategory: catégorie MCC du marchand (ex: 5812 pour restaurants)
//   transactionDate : date réelle de l'achat
//   status          : PENDING → COMPLETED / FAILED / REFUNDED / DISPUTED
db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id               TEXT PRIMARY KEY,
    userId           TEXT NOT NULL REFERENCES users(id),
    cardId           TEXT NOT NULL REFERENCES cards(id),
    amount           REAL NOT NULL CHECK(amount > 0),
    currency         TEXT NOT NULL DEFAULT 'USD',
    merchant         TEXT NOT NULL,
    merchantCategory TEXT,
    status           TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK(status IN ('PENDING','COMPLETED','FAILED','REFUNDED','DISPUTED')),
    transactionDate  TEXT NOT NULL,
    description      TEXT,
    createdAt        TEXT DEFAULT (datetime('now'))
  )
`);

// ─── Table : disputes ──────────────────────────────────────────────────────
// Litiges déposés par un client sur une transaction.
//   transactionId : transaction contestée
//   userId        : client auteur du litige
//   reason        : motif de contestation (parmi les 9 motifs CDC)
//   description   : explication détaillée fournie par le client
//   amount        : montant contesté (peut être partiel)
//   status        : cycle de vie du litige (9 statuts, ordre logique CDC)
//                   SUBMITTED → UNDER_REVIEW → (APPROVED|REJECTED) → ...
//   priority      : niveau de priorité attribué par l'opérateur
//   assignedTo    : opérateur en charge du traitement
//   updatedAt     : dernière modification (déclenché manuellement)
db.run(`
  CREATE TABLE IF NOT EXISTS disputes (
    id             TEXT PRIMARY KEY,
    transactionId  TEXT NOT NULL REFERENCES transactions(id),
    userId         TEXT NOT NULL REFERENCES users(id),
    reason         TEXT NOT NULL
                     CHECK(reason IN (
                       'UNAUTHORIZED_TRANSACTION',
                       'DOUBLE_CHARGE',
                       'GOODS_NOT_RECEIVED',
                       'SERVICE_NOT_PROVIDED',
                       'INCORRECT_AMOUNT',
                       'CANCELLED_RECURRING_PAYMENT',
                       'FRAUD',
                       'ATM_CASH_NOT_DISPENSED',
                       'OTHER'
                     )),
    description    TEXT NOT NULL,
    amount         REAL NOT NULL CHECK(amount > 0),
    currency       TEXT NOT NULL DEFAULT 'USD',
    status         TEXT NOT NULL DEFAULT 'SUBMITTED'
                     CHECK(status IN (
                       'SUBMITTED',
                       'UNDER_REVIEW',
                       'WAITING_FOR_INFORMATION',
                       'APPROVED',
                       'REJECTED',
                       'CHARGEBACK_INITIATED',
                       'MERCHANT_RESPONSE_RECEIVED',
                       'REFUND_COMPLETED',
                       'CLOSED'
                     )),
    priority       TEXT NOT NULL DEFAULT 'NORMAL'
                     CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
    assignedTo     TEXT REFERENCES users(id),
    createdAt      TEXT DEFAULT (datetime('now')),
    updatedAt      TEXT DEFAULT (datetime('now'))
  )
`);

// ─── Table : dispute_comments ──────────────────────────────────────────────
// Historique des échanges entre le client et l'opérateur sur un litige.
//   disputeId : litige concerné
//   userId    : auteur du commentaire (client ou opérateur)
//   comment   : texte du message
db.run(`
  CREATE TABLE IF NOT EXISTS dispute_comments (
    id        TEXT PRIMARY KEY,
    disputeId TEXT NOT NULL REFERENCES disputes(id),
    userId    TEXT NOT NULL REFERENCES users(id),
    comment   TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  )
`);

// ─── Table : dispute_status_history ────────────────────────────────────────
// Traçabilité des changements de statut d'un litige (audit trail).
// Chaque transition est horodatée avec l'auteur et un commentaire optionnel.
//   fromStatus : statut avant le changement (NULL pour la création, valeur parmi les 9 statuts)
//   toStatus   : nouveau statut (parmi les 9 statuts)
//   changedBy  : utilisateur ayant effectué le changement
//   reason     : motif du changement (ex: 'preuves insuffisantes')
db.run(`
  CREATE TABLE IF NOT EXISTS dispute_status_history (
    id        TEXT PRIMARY KEY,
    disputeId TEXT NOT NULL REFERENCES disputes(id),
    fromStatus TEXT,
    toStatus   TEXT NOT NULL,
    changedBy  TEXT NOT NULL REFERENCES users(id),
    reason     TEXT,
    createdAt  TEXT DEFAULT (datetime('now'))
  )
`);

// ─── Table : dispute_documents ─────────────────────────────────────────────
// Pièces jointes associées à un litige (relevés, captures d'écran, etc.).
//   disputeId : litige concerné
//   userId    : utilisateur ayant uploadé le document
//   fileName  : nom original du fichier
//   fileType  : type MIME (image/png, application/pdf, etc.)
//   filePath  : emplacement sur le disque
//   fileSize  : taille en octets
db.run(`
  CREATE TABLE IF NOT EXISTS dispute_documents (
    id         TEXT PRIMARY KEY,
    disputeId  TEXT NOT NULL REFERENCES disputes(id),
    userId     TEXT NOT NULL REFERENCES users(id),
    fileName   TEXT NOT NULL,
    fileType   TEXT NOT NULL,
    filePath   TEXT NOT NULL,
    fileSize   INTEGER,
    uploadedAt TEXT DEFAULT (datetime('now'))
  )
`);

// ─── Finalisation ────────────────────────────────────────────────────────────
// On referme la connexion une fois toutes les migrations terminées.
db.close((err) => {
  if (err) {
    console.error('Erreur lors de la fermeture de la base :', err.message);
    process.exit(1);
  }
  console.log('Migration terminée avec succès.');
  process.exit(0);
});
