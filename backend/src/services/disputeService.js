// Service de gestion des litiges (disputes).
// Contient la logique métier : validation des transitions de statut,
// création des litiges avec transaction SQL (dispute + historique + commentaire),
// respect du workflow CDC inspiré de Visa/Mastercard.

const { randomUUID } = require('crypto');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { recordStatusChange, recordComment } = require('./disputeHistoryService');

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
  WAITING_FOR_INFORMATION:     ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  APPROVED:                    ['CHARGEBACK_INITIATED'],
  CHARGEBACK_INITIATED:        ['MERCHANT_RESPONSE_RECEIVED', 'REFUND_COMPLETED'],
  MERCHANT_RESPONSE_RECEIVED:  ['REFUND_COMPLETED'],
  REFUND_COMPLETED:            ['CLOSED'],
  REJECTED:                    ['CLOSED'],
  CLOSED:                      [],
};

// Valide qu'une transition de statut est autorisée par le workflow.
// Lance une AppError(409, '40910') si la transition est interdite (conflit d'état).
function validateTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];

  if (!allowed) {
    throw new AppError(`Unknown status: ${currentStatus}`, 409, '40910');
  }

  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Transition from ${currentStatus} to ${newStatus} is not allowed`,
      409,
      '40910'
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

// Recherche un litige par son ID.
// Retourne la ligne complète ou undefined si introuvable.
// Utilisée par les endpoints OPERATOR (review, request-info) pour vérifier
// l'existence du litige et son statut actuel.
function findDisputeById(disputeId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, transactionId, userId, status, amount, currency FROM disputes WHERE id = ?`,
      [disputeId],
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

// ─── PRISE EN CHARGE D'UN LITIGE (REVIEW) ──────────────────────────────────

// Transitionne un litige du statut SUBMITTED vers UNDER_REVIEW.
// Opération réservée à l'OPERATOR.
// Valide la transition autorisée, puis exécute en une seule transaction SQL :
//   1. UPDATE du statut du litige → UNDER_REVIEW
//   2. INSERT dans dispute_status_history (SUBMITTED → UNDER_REVIEW)
//   3. INSERT dans dispute_comments (commentaire de l'opérateur)
//
// Paramètres :
//   disputeId  : identifiant du litige à prendre en charge
//   operatorId : ID de l'opérateur (issu du JWT)
//   comment    : message de l'opérateur justifiant la prise en charge
//
// Retourne : { disputeId, status, reviewedBy, reviewDate }
async function reviewDispute(disputeId, operatorId, comment) {
  // ── 1. Vérifier que le litige existe ──
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    // → errorCode 40402 : disputeId ne correspond à aucun litige en base
    throw new AppError('Dispute not found', 404, '40402');
  }

  // ── 2. Vérifier que le litige est au statut SUBMITTED ──
  // La prise en charge n'est possible que depuis SUBMITTED (première transition opérateur)
  if (dispute.status !== 'SUBMITTED') {
    // → errorCode 40906 : conflit car le litige a déjà été pris en charge ou est clôturé
    throw new AppError(
      `Invalid status transition: dispute must be SUBMITTED, current status is ${dispute.status}`,
      409,
      '40906'
    );
  }

  // ── 3. Exécuter la transaction atomique ──
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        return reject(new AppError('Internal server error', 500, '50000'));
      }

      const run = (sql, params) => new Promise((res, rej) => {
        db.run(sql, params, function (runErr) {
          if (runErr) rej(runErr);
          else res(this);
        });
      });

      // Étape 1 : UPDATE du statut
      run(
        `UPDATE disputes SET status = 'UNDER_REVIEW', updatedAt = ? WHERE id = ?`,
        [now, disputeId]
      )
      .then(() => {
        // Étape 2 : historique de la transition
        return recordStatusChange(disputeId, 'SUBMITTED', 'UNDER_REVIEW', operatorId, comment);
      })
      .then(() => {
        // Étape 3 : commentaire de l'opérateur
        return recordComment(disputeId, operatorId, comment);
      })
      .then(() => {
        // Étape 4 : validation
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            db.run('ROLLBACK', () => {});
            return reject(new AppError('Internal server error', 500, '50000'));
          }
          resolve({
            disputeId,
            status: 'UNDER_REVIEW',
            reviewedBy: operatorId,
            reviewDate: now,
          });
        });
      })
      .catch((sqlErr) => {
        db.run('ROLLBACK', () => {});
        reject(new AppError('Internal server error', 500, '50000'));
      });
    });
  });
}

// ─── DEMANDE D'INFORMATIONS COMPLÉMENTAIRES (REQUEST-INFO) ─────────────────

// Transitionne un litige du statut UNDER_REVIEW vers WAITING_FOR_INFORMATION.
// Opération réservée à l'OPERATOR.
// Valide la transition autorisée, puis exécute en une seule transaction SQL :
//   1. UPDATE du statut du litige → WAITING_FOR_INFORMATION
//   2. INSERT dans dispute_status_history (UNDER_REVIEW → WAITING_FOR_INFORMATION)
//   3. INSERT dans dispute_comments (message de l'opérateur)
//
// Paramètres :
//   disputeId  : identifiant du litige concerné
//   operatorId : ID de l'opérateur (issu du JWT)
//   message    : informations demandées au client
//
// Retourne : { disputeId, status, requestedInformation }
async function requestInfo(disputeId, operatorId, message) {
  // ── 1. Vérifier que le litige existe ──
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    // → errorCode 40402 : disputeId ne correspond à aucun litige en base
    throw new AppError('Dispute not found', 404, '40402');
  }

  // ── 2. Vérifier que le litige est au statut UNDER_REVIEW ──
  // La demande d'infos complémentaires n'est possible que depuis UNDER_REVIEW
  if (dispute.status !== 'UNDER_REVIEW') {
    // → errorCode 40907 : conflit car le litige n'est pas en cours d'analyse
    throw new AppError(
      `Invalid status transition: dispute must be UNDER_REVIEW, current status is ${dispute.status}`,
      409,
      '40907'
    );
  }

  // ── 3. Exécuter la transaction atomique ──
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        return reject(new AppError('Internal server error', 500, '50000'));
      }

      const run = (sql, params) => new Promise((res, rej) => {
        db.run(sql, params, function (runErr) {
          if (runErr) rej(runErr);
          else res(this);
        });
      });

      // Étape 1 : UPDATE du statut
      run(
        `UPDATE disputes SET status = 'WAITING_FOR_INFORMATION', updatedAt = ? WHERE id = ?`,
        [now, disputeId]
      )
      .then(() => {
        // Étape 2 : historique de la transition
        return recordStatusChange(disputeId, 'UNDER_REVIEW', 'WAITING_FOR_INFORMATION', operatorId, message);
      })
      .then(() => {
        // Étape 3 : commentaire de l'opérateur
        return recordComment(disputeId, operatorId, message);
      })
      .then(() => {
        // Étape 4 : validation
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            db.run('ROLLBACK', () => {});
            return reject(new AppError('Internal server error', 500, '50000'));
          }
          resolve({
            disputeId,
            status: 'WAITING_FOR_INFORMATION',
            requestedInformation: message,
          });
        });
      })
      .catch((sqlErr) => {
        db.run('ROLLBACK', () => {});
        reject(new AppError('Internal server error', 500, '50000'));
      });
    });
  });
}

// ─── APPROBATION D'UN LITIGE (APPROVE) ─────────────────────────────────────

// Transitionne un litige du statut UNDER_REVIEW ou WAITING_FOR_INFORMATION
// vers APPROVED. Opération réservée à l'OPERATOR.
// Valide la transition autorisée, puis exécute en une seule transaction SQL :
//   1. UPDATE du statut du litige → APPROVED
//   2. INSERT dans dispute_status_history (ancien statut → APPROVED)
//   3. INSERT dans dispute_comments (commentaire de l'opérateur)
//
// Paramètres :
//   disputeId  : identifiant du litige à approuver
//   operatorId : ID de l'opérateur (issu du JWT)
//   comment    : justification de l'approbation
//
// Retourne : { disputeId, status, approvedBy }
async function approveDispute(disputeId, operatorId, comment) {
  // ── 1. Vérifier que le litige existe ──
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    // → errorCode 40402 : disputeId ne correspond à aucun litige en base
    throw new AppError('Dispute not found', 404, '40402');
  }

  // ── 2. Vérifier que le litige est à un statut permettant l'approbation ──
  // L'approbation n'est possible que depuis UNDER_REVIEW ou WAITING_FOR_INFORMATION
  if (dispute.status !== 'UNDER_REVIEW' && dispute.status !== 'WAITING_FOR_INFORMATION') {
    // → errorCode 40902 : conflit car le litige n'est pas dans un statut permettant l'approbation
    throw new AppError(
      `Invalid status transition: dispute must be UNDER_REVIEW or WAITING_FOR_INFORMATION, current status is ${dispute.status}`,
      409,
      '40902'
    );
  }

  // ── 3. Valider la transition via le validateur générique ──
  validateTransition(dispute.status, 'APPROVED');

  // ── 4. Exécuter la transaction atomique ──
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        return reject(new AppError('Internal server error', 500, '50000'));
      }

      const run = (sql, params) => new Promise((res, rej) => {
        db.run(sql, params, function (runErr) {
          if (runErr) rej(runErr);
          else res(this);
        });
      });

      // Étape 1 : UPDATE du statut
      run(
        `UPDATE disputes SET status = 'APPROVED', updatedAt = ? WHERE id = ?`,
        [now, disputeId]
      )
      .then(() => {
        // Étape 2 : historique de la transition
        return recordStatusChange(disputeId, dispute.status, 'APPROVED', operatorId, comment);
      })
      .then(() => {
        // Étape 3 : commentaire de l'opérateur
        return recordComment(disputeId, operatorId, comment);
      })
      .then(() => {
        // Étape 4 : validation
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            db.run('ROLLBACK', () => {});
            return reject(new AppError('Internal server error', 500, '50000'));
          }
          resolve({
            disputeId,
            status: 'APPROVED',
            approvedBy: operatorId,
          });
        });
      })
      .catch((sqlErr) => {
        db.run('ROLLBACK', () => {});
        reject(new AppError('Internal server error', 500, '50000'));
      });
    });
  });
}

// ─── REJET D'UN LITIGE (REJECT) ────────────────────────────────────────────

// Transitionne un litige du statut UNDER_REVIEW ou WAITING_FOR_INFORMATION
// vers REJECTED. Opération réservée à l'OPERATOR.
// Valide la transition autorisée, puis exécute en une seule transaction SQL :
//   1. UPDATE du statut du litige → REJECTED
//   2. INSERT dans dispute_status_history (ancien statut → REJECTED,
//      avec le champ reason = "Reason: <reason> | Comment: <comment>")
//   3. INSERT dans dispute_comments (commentaire de l'opérateur)
//
// Paramètres :
//   disputeId  : identifiant du litige à rejeter
//   operatorId : ID de l'opérateur (issu du JWT)
//   reason     : motif du rejet (obligatoire)
//   comment    : commentaire complémentaire (optionnel)
//
// Retourne : { disputeId, status, reason }
async function rejectDispute(disputeId, operatorId, reason, comment) {
  // ── 1. Vérifier que le litige existe ──
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    // → errorCode 40402 : disputeId ne correspond à aucun litige en base
    throw new AppError('Dispute not found', 404, '40402');
  }

  // ── 2. Vérifier que le litige est à un statut permettant le rejet ──
  // Le rejet n'est possible que depuis UNDER_REVIEW ou WAITING_FOR_INFORMATION
  if (dispute.status !== 'UNDER_REVIEW' && dispute.status !== 'WAITING_FOR_INFORMATION') {
    // → errorCode 40902 : conflit car le litige n'est pas dans un statut permettant le rejet
    throw new AppError(
      `Invalid status transition: dispute must be UNDER_REVIEW or WAITING_FOR_INFORMATION, current status is ${dispute.status}`,
      409,
      '40902'
    );
  }

  // ── 3. Valider la transition via le validateur générique ──
  validateTransition(dispute.status, 'REJECTED');

  // ── 4. Exécuter la transaction atomique ──
  const now = new Date().toISOString();

  // Concaténation du motif et du commentaire pour l'historique
  const historyComment = comment
    ? `Reason: ${reason} | Comment: ${comment}`
    : `Reason: ${reason}`;

  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        return reject(new AppError('Internal server error', 500, '50000'));
      }

      const run = (sql, params) => new Promise((res, rej) => {
        db.run(sql, params, function (runErr) {
          if (runErr) rej(runErr);
          else res(this);
        });
      });

      // Étape 1 : UPDATE du statut
      run(
        `UPDATE disputes SET status = 'REJECTED', updatedAt = ? WHERE id = ?`,
        [now, disputeId]
      )
      .then(() => {
        // Étape 2 : historique de la transition
        return recordStatusChange(disputeId, dispute.status, 'REJECTED', operatorId, historyComment);
      })
      .then(() => {
        // Étape 3 : commentaire de l'opérateur
        // Si comment n'est pas fourni, on utilise reason à la place
        return recordComment(disputeId, operatorId, comment || reason);
      })
      .then(() => {
        // Étape 4 : validation
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            db.run('ROLLBACK', () => {});
            return reject(new AppError('Internal server error', 500, '50000'));
          }
          resolve({
            disputeId,
            status: 'REJECTED',
            reason,
          });
        });
      })
      .catch((sqlErr) => {
        db.run('ROLLBACK', () => {});
        reject(new AppError('Internal server error', 500, '50000'));
      });
    });
  });
}

// ─── GÉNÉRATION RÉFÉRENCE CHARGEBACK ──────────────────────────────────────────

// Génère une référence de chargeback unique au format CB + année + compteur
// incrémental à 6 chiffres (ex: CB202600001).
// Interroge le dernier chargebackReference existant dans la base pour incrémenter.
function generateChargebackReference() {
  return new Promise((resolve, reject) => {
    const year = new Date().getFullYear();
    // On regarde s'il existe déjà des chargebackReference stockées dans un champ
    // status_history (car le champ n'existe pas en base). On va chercher dans
    // dispute_status_history une transition vers CHARGEBACK_INITIATED et extraire
    // le commentaire qui contient la référence. Ou bien on peut simplement
    // interroger les litiges au statut CHARGEBACK_INITIATED ou REFUND_COMPLETED
    // et compter le nombre total de chargebacks jamais initiés.
    db.get(
      `SELECT COUNT(*) AS count FROM dispute_status_history WHERE toStatus = 'CHARGEBACK_INITIATED'`,
      [],
      (err, row) => {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        const count = (row ? row.count : 0) + 1;
        resolve(`CB${year}${String(count).padStart(5, '0')}`);
      }
    );
  });
}

// ─── INITIATION D'UN CHARGEBACK ──────────────────────────────────────────────

// Déclenche la procédure de chargeback sur un litige approuvé.
// Transition : APPROVED → CHARGEBACK_INITIATED.
// Génère une référence unique et enregistre l'historique + commentaire.
// Validation : disputeId doit exister et être au statut APPROVED.
//   chargebackReasonCode : code motif chargeback (ex: "4837")
//   network              : "Visa" ou "Mastercard"
//   comment              : texte libre de l'opérateur
async function chargebackDispute(disputeId, operatorId, chargebackReasonCode, network, comment) {
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    throw new AppError('Dispute not found', 404, '40402');
  }

  const currentStatus = dispute.status;
  const newStatus = 'CHARGEBACK_INITIATED';

  if (!VALID_TRANSITIONS[currentStatus] || !VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
    throw new AppError('Invalid status transition: dispute must be APPROVED', 409, '40903');
  }

  const allowedNetworks = ['Visa', 'Mastercard'];
  if (!allowedNetworks.includes(network)) {
    throw new AppError('Invalid network, must be Visa or Mastercard', 400, '40041');
  }

  const chargebackReference = await generateChargebackReference();
  const now = new Date().toISOString();
  const historyComment =
    `Chargeback initiated via ${network} (reason code ${chargebackReasonCode}). ` +
    `Reference: ${chargebackReference}`;

  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) return reject(new AppError('Internal server error', 500, '50000'));

      const run = (sql, params) => new Promise((res, rej) => {
        db.run(sql, params, function (runErr) {
          if (runErr) rej(runErr);
          else res(this);
        });
      });

      run(`UPDATE disputes SET status = ?, updatedAt = ? WHERE id = ?`, [newStatus, now, disputeId])
        .then(() => recordStatusChange(disputeId, currentStatus, newStatus, operatorId, historyComment))
        .then(() => recordComment(disputeId, operatorId, comment))
        .then(() => {
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK', () => {});
              return reject(new AppError('Internal server error', 500, '50000'));
            }
            resolve({ disputeId, status: newStatus, chargebackReference });
          });
        })
        .catch((sqlErr) => {
          db.run('ROLLBACK', () => {});
          reject(new AppError('Internal server error', 500, '50000'));
        });
    });
  });
}

// ─── REMBOURSEMENT APRÈS CHARGEBACK ──────────────────────────────────────────

// Finalise un chargeback par un remboursement effectif au client.
// Transition : CHARGEBACK_INITIATED → REFUND_COMPLETED.
// Validation : disputeId doit exister et être au statut CHARGEBACK_INITIATED.
//   refundAmount : montant remboursé, doit être > 0 et ≤ amount du litige
//   currency     : doit correspondre à la devise du litige original
//   refundMethod : "CARD_CREDIT" ou "BANK_TRANSFER"
async function refundDispute(disputeId, operatorId, refundAmount, currency, refundMethod) {
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    throw new AppError('Dispute not found', 404, '40402');
  }

  const currentStatus = dispute.status;
  const newStatus = 'REFUND_COMPLETED';

  if (!VALID_TRANSITIONS[currentStatus] || !VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
    throw new AppError('Invalid status transition: dispute must be CHARGEBACK_INITIATED', 409, '40904');
  }

  if (refundAmount === undefined || refundAmount === null || typeof refundAmount !== 'number' || refundAmount <= 0) {
    throw new AppError('Invalid refundAmount', 400, '40050');
  }
  if (refundAmount > dispute.amount) {
    throw new AppError('refundAmount exceeds claim amount', 400, '40051');
  }

  if (currency !== dispute.currency) {
    throw new AppError('Invalid or mismatched currency', 400, '40052');
  }

  const allowedMethods = ['CARD_CREDIT', 'BANK_TRANSFER'];
  if (!allowedMethods.includes(refundMethod)) {
    throw new AppError('Invalid refundMethod', 400, '40053');
  }

  const now = new Date().toISOString();
  const historyComment = `Refund of ${refundAmount} ${currency} via ${refundMethod}`;

  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) return reject(new AppError('Internal server error', 500, '50000'));

      const run = (sql, params) => new Promise((res, rej) => {
        db.run(sql, params, function (runErr) {
          if (runErr) rej(runErr);
          else res(this);
        });
      });

      run(`UPDATE disputes SET status = ?, updatedAt = ? WHERE id = ?`, [newStatus, now, disputeId])
        .then(() => recordStatusChange(disputeId, currentStatus, newStatus, operatorId, historyComment))
        .then(() => db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            db.run('ROLLBACK', () => {});
            return reject(new AppError('Internal server error', 500, '50000'));
          }
          resolve({ disputeId, status: newStatus, refundAmount, currency });
        }))
        .catch((sqlErr) => {
          db.run('ROLLBACK', () => {});
          reject(new AppError('Internal server error', 500, '50000'));
        });
    });
  });
}

// ─── CLÔTURE D'UN DOSSIER DE LITIGE ──────────────────────────────────────────

// Clôture définitivement un dossier de litige.
// Transition : REJECTED → CLOSED ou REFUND_COMPLETED → CLOSED.
// La clôture est irréversible : un litige CLOSED ne peut plus changer de statut.
// closureReason doit être une valeur parmi : CASE_RESOLVED, REJECTED_FINAL,
// REFUND_ISSUED, OTHER.
// La closedDate est générée en ISO 8601 côté serveur.
async function closeDispute(disputeId, operatorId, closureReason, comment) {
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    throw new AppError('Dispute not found', 404, '40402');
  }

  const currentStatus = dispute.status;
  const newStatus = 'CLOSED';

  if (!VALID_TRANSITIONS[currentStatus] || !VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
    throw new AppError('Invalid status transition: dispute must be REJECTED or REFUND_COMPLETED to be closed', 409, '40905');
  }

  const closedDate = new Date().toISOString();
  const historyComment = `Closure reason: ${closureReason} | ${comment}`;

  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) return reject(new AppError('Internal server error', 500, '50000'));

      const run = (sql, params) => new Promise((res, rej) => {
        db.run(sql, params, function (runErr) {
          if (runErr) rej(runErr);
          else res(this);
        });
      });

      run(`UPDATE disputes SET status = ?, updatedAt = ? WHERE id = ?`, [newStatus, closedDate, disputeId])
        .then(() => recordStatusChange(disputeId, currentStatus, newStatus, operatorId, historyComment))
        .then(() => recordComment(disputeId, operatorId, comment))
        .then(() => {
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK', () => {});
              return reject(new AppError('Internal server error', 500, '50000'));
            }
            resolve({ disputeId, status: newStatus, closedDate });
          });
        })
        .catch((sqlErr) => {
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
    let sql = `SELECT
                 d.id AS disputeId,
                 d.transactionId,
                 d.reason,
                 d.description,
                 d.amount AS claimAmount,
                 d.currency,
                 d.status,
                 d.createdAt,
                 d.updatedAt`;

    if (role === 'CLIENT') {
      sql += `, t.merchant`;
      sql += ` FROM disputes d
               JOIN transactions t ON d.transactionId = t.id`;
    } else {
      sql += `, u.name AS clientName, d.userId AS userID`;
      sql += ` FROM disputes d
               LEFT JOIN users u ON d.userId = u.id`;
    }

    sql += ` WHERE 1=1`;
    const params = [];

    if (role === 'CLIENT') {
      sql += ` AND t.userId = ?`;
      params.push(userId);
    }

    if (status && status !== 'ALL') {
      sql += ` AND d.status = ?`;
      params.push(status);
    }

    if (startDate) {
      sql += ` AND d.createdAt >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND d.createdAt <= ?`;
      params.push(endDate);
    }

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
  findDisputeById,
  // Workflow OPERATOR
  reviewDispute,
  requestInfo,
  approveDispute,
  rejectDispute,
  chargebackDispute,
  refundDispute,
  closeDispute,
  // Consultation
  getDisputes,
};
