// Service de gestion des litiges (disputes).
// Contient la logique métier : validation des transitions de statut,
// création des litiges avec transaction SQL (dispute + historique + commentaire),
// respect du workflow CDC inspiré de Visa/Mastercard.

const { randomUUID } = require('crypto');
const db = require('../config/db');
const AppError = require('../utils/AppError');

// ─── GÉNÉRATION D'IDENTIFIANTS ──────────────────────────────────────────────

// Génère un identifiant de litige au format DSP + compteur (ex: DSP001).
// Interroge le dernier ID existant pour incrémenter.
function generateDisputeId() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id FROM disputes ORDER BY rowid DESC LIMIT 1`, [], (err, row) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      let nextNum = 1;
      if (row && row.id) {
        const match = row.id.match(/^DSP(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      resolve(`DSP${String(nextNum).padStart(3, '0')}`);
    });
  });
}

// ─── TRANSITIONS DE STATUT ──────────────────────────────────────────────────

// Carte des transitions autorisées entre statuts.
// Chaque clé = statut actuel, chaque valeur = tableau des statuts atteignables.
// Respecte strictement l'ordre logique du CDC.
const VALID_TRANSITIONS = {
  SUBMITTED:                   ['UNDER_REVIEW'],
  UNDER_REVIEW:                ['WAITING_FOR_INFORMATION', 'APPROVED', 'REJECTED'],
  WAITING_FOR_INFORMATION:     ['UNDER_REVIEW'],
  APPROVED:                    ['CHARGEBACK_INITIATED'],
  CHARGEBACK_INITIATED:        ['MERCHANT_RESPONSE_RECEIVED', 'REFUND_COMPLETED'],
  MERCHANT_RESPONSE_RECEIVED:  ['REFUND_COMPLETED'],
  REFUND_COMPLETED:            ['CLOSED'],
  REJECTED:                    ['CLOSED'],
  CLOSED:                      [],
};

// Valide qu'une transition de statut est autorisée par le workflow.
// Lance une AppError(400, '40020') si la transition est interdite.
function validateTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];

  if (!allowed) {
    // -- Statut actuel inconnu --
    throw new AppError(`Unknown status: ${currentStatus}`, 400, '40020');
  }

  if (!allowed.includes(newStatus)) {
    // -- Transition non autorisée --
    throw new AppError(
      `Transition from ${currentStatus} to ${newStatus} is not allowed`,
      400,
      '40020'
    );
  }

  return true;
}

// Retourne la liste des statuts atteignables depuis un statut donné.
function getAllowedTransitions(currentStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) return [];
  return [...allowed];
}

// ─── RECHERCHES PRÉALABLES ──────────────────────────────────────────────────

// Recherche une transaction par son ID.
// Retourne la ligne complète ou undefined si introuvable.
// Utilisée par le contrôleur pour vérifier que la transaction existe et appartient au client.
function findTransactionById(transactionId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, userId, amount, currency, status FROM transactions WHERE id = ?`,
      [transactionId],
      (err, row) => {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        resolve(row);
      }
    );
  });
}

// Recherche un litige actif (non rejeté et non clôturé) pour une transaction donnée.
// Retourne la ligne ou undefined si aucun litige actif n'existe.
// Un litige actif empêche la création d'un nouveau litige sur la même transaction.
function findActiveDisputeByTransactionId(transactionId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, status FROM disputes
       WHERE transactionId = ? AND status NOT IN ('REJECTED', 'CLOSED')`,
      [transactionId],
      (err, row) => {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        resolve(row);
      }
    );
  });
}

// ─── CRÉATION D'UN LITIGE (TRANSACTION SQL) ─────────────────────────────────

// Crée un litige avec son historique et son commentaire initial dans une seule
// transaction SQL. Les trois INSERT sont atomiques : si l'un échoue, aucun
// n'est persisté (ROLLBACK).
//
// Paramètres attendus :
//   { transactionId, reason, description, claimAmount, currency, userId }
//
// Retourne : { disputeId, transactionId, status, createdAt }
async function createDispute({ transactionId, reason, description, claimAmount, currency, userId }) {
  const disputeId = await generateDisputeId();
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        return reject(new AppError('Internal server error', 500, '50000'));
      }

      // Exécute une requête db.run dans une promesse, pour chaîner les INSERT
      const run = (sql, params) => new Promise((res, rej) => {
        db.run(sql, params, function (runErr) {
          if (runErr) rej(runErr);
          else res(this);
        });
      });

      // ── Étape 1 : insertion du litige ──
      run(
        `INSERT INTO disputes (id, transactionId, userId, reason, description, amount, currency, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')`,
        [disputeId, transactionId, userId, reason, description, claimAmount, currency]
      )
      .then(() => {
        // ── Étape 2 : insertion dans l'historique des statuts ──
        // previousStatus = NULL car c'est la création, newStatus = SUBMITTED
        return run(
          `INSERT INTO dispute_status_history (id, disputeId, fromStatus, toStatus, changedBy, reason)
           VALUES (?, ?, NULL, 'SUBMITTED', ?, 'Dispute created')`,
          [randomUUID(), disputeId, userId]
        );
      })
      .then(() => {
        // ── Étape 3 : insertion du commentaire initial ──
        // La description fournie par le client est stockée comme premier commentaire
        return run(
          `INSERT INTO dispute_comments (id, disputeId, userId, comment)
           VALUES (?, ?, ?, ?)`,
          [randomUUID(), disputeId, userId, description]
        );
      })
      .then(() => {
        // ── Étape 4 : validation de la transaction ──
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            db.run('ROLLBACK', () => {});
            return reject(new AppError('Internal server error', 500, '50000'));
          }
          resolve({
            disputeId,
            transactionId,
            status: 'SUBMITTED',
            createdAt: now,
          });
        });
      })
      .catch((sqlErr) => {
        // ── Une des étapes a échoué → annulation complète ──
        db.run('ROLLBACK', () => {});
        reject(new AppError('Internal server error', 500, '50000'));
      });
    });
  });
}

// ─── RECHERCHE DE LITIGES AVEC FILTRES ──────────────────────────────────────

// Récupère la liste des litiges selon le rôle et les filtres fournis.
//   CLIENT   : jointure avec transactions pour filtrer par userId du token JWT
//   OPERATOR : pas de restriction utilisateur
// Filtres optionnels : status, startDate, endDate (sur createdAt).
// Retourne un tableau d'objets { disputeId, transactionId, reason, status }.
// Tri par createdAt DESC (litiges les plus récents en premier).
function getDisputes({ role, userId, status, startDate, endDate }) {
  return new Promise((resolve, reject) => {
    // Construction dynamique de la requête SQL
    let sql = `SELECT d.id AS disputeId, d.transactionId, d.reason, d.status
               FROM disputes d`;

    // ── CLIENT : ne voir que ses propres litiges via la jointure transactions ──
    // On joint sur transactions pour récupérer le userId propriétaire de la transaction
    if (role === 'CLIENT') {
      sql += ` JOIN transactions t ON d.transactionId = t.id`;
    }

    sql += ` WHERE 1=1`;

    const params = [];

    // ── Filtre utilisateur (CLIENT uniquement) ──
    if (role === 'CLIENT') {
      sql += ` AND t.userId = ?`;
      params.push(userId);
    }

    // ── Filtre status ──
    // "ALL" signifie pas de filtre ; sinon on ne garde que les litiges avec ce statut
    if (status && status !== 'ALL') {
      sql += ` AND d.status = ?`;
      params.push(status);
    }

    // ── Filtre date de début ──
    if (startDate) {
      sql += ` AND d.createdAt >= ?`;
      params.push(startDate);
    }

    // ── Filtre date de fin ──
    if (endDate) {
      sql += ` AND d.createdAt <= ?`;
      params.push(endDate);
    }

    // ── Tri : plus récents en premier ──
    sql += ` ORDER BY d.createdAt DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve(rows);
    });
  });
}

module.exports = {
  // Transitions
  validateTransition,
  getAllowedTransitions,
  VALID_TRANSITIONS,
  // Création
  createDispute,
  findTransactionById,
  findActiveDisputeByTransactionId,
  // Consultation
  getDisputes,
};
