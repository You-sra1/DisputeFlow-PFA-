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
// Utilise COUNT(*) pour éviter les races conditions avec MAX(rowid).
function generateDisputeId() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 0) + 1 AS nextNum FROM disputes`,
      [],
      (err, row) => {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        resolve(`DSP${String(row.nextNum).padStart(3, '0')}`);
      }
    );
  });
}

// ─── TRANSITIONS DE STATUT ──────────────────────────────────────────────────

// Carte des transitions autorisées entre statuts.
// Chaque clé = statut actuel, chaque valeur = tableau des statuts atteignables.
// Respecte strictement l'ordre logique du CDC.
const VALID_TRANSITIONS = {
  SOUMIS:                        ['EN_COURS_D_ANALYSE'],
  EN_COURS_D_ANALYSE:            ['EN_ATTENTE_D_INFORMATIONS', 'APPROUVE', 'REJETE'],
  EN_ATTENTE_D_INFORMATIONS:     ['EN_COURS_D_ANALYSE', 'APPROUVE', 'REJETE'],
  APPROUVE:                      ['CHARGEBACK_INITIE'],
  CHARGEBACK_INITIE:             ['REMBOURSEMENT_EFFECTUE'],
  REMBOURSEMENT_EFFECTUE:        ['CLOTURE'],
  REJETE:                        ['CLOTURE'],
  CLOTURE:                       [],
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
      `SELECT id, client_id, amount, currency, status FROM transactions WHERE id = ?`,
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
       WHERE transaction_id = ? AND status NOT IN ('REJETE', 'CLOTURE')`,
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
      `SELECT id, transaction_id, client_id, status, amount, currency FROM disputes WHERE id = ?`,
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
        `INSERT INTO disputes (id, transaction_id, client_id, reason, description, amount, currency, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'SOUMIS')`,
        [disputeId, transactionId, userId, reason, description, claimAmount, currency]
      )
      .then(() => {
        // ── Étape 2 : insertion dans l'historique des statuts ──
        // previousStatus = NULL car c'est la création, newStatus = SUBMITTED
        return run(
          `INSERT INTO dispute_status_history (id, dispute_id, old_status, new_status, changed_by, reason)
           VALUES (?, ?, NULL, 'SOUMIS', ?, 'Dispute created')`,
          [randomUUID(), disputeId, userId]
        );
      })
      .then(() => {
        // ── Étape 3 : insertion du commentaire initial ──
        // La description fournie par le client est stockée comme premier commentaire
        return run(
          `INSERT INTO dispute_comments (id, dispute_id, client_id, comment)
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
            dispute_id: disputeId,
            transaction_id: transactionId,
            status: 'SOUMIS',
            created_at: now,
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

// Transitionne un litige du statut SOUMIS vers EN_COURS_D_ANALYSE.
// Opération réservée à l'OPERATOR.
// Valide la transition autorisée, puis exécute en une seule transaction SQL :
//   1. UPDATE du statut du litige → EN_COURS_D_ANALYSE
//   2. INSERT dans dispute_status_history (SOUMIS → EN_COURS_D_ANALYSE)
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

  // ── 2. Valider la transition SOUMIS → EN_COURS_D_ANALYSE ──
  validateTransition(dispute.status, 'EN_COURS_D_ANALYSE');

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
        `UPDATE disputes SET status = 'EN_COURS_D_ANALYSE', updated_at = ? WHERE id = ?`,
        [now, disputeId]
      )
      .then(() => {
        // Étape 2 : historique de la transition
        return recordStatusChange(disputeId, 'SOUMIS', 'EN_COURS_D_ANALYSE', operatorId, comment);
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
            dispute_id: disputeId,
            status: 'EN_COURS_D_ANALYSE',
            reviewed_by: operatorId,
            review_date: now,
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

// Transitionne un litige du statut EN_COURS_D_ANALYSE vers EN_ATTENTE_D_INFORMATIONS.
// Opération réservée à l'OPERATOR.
// Valide la transition autorisée, puis exécute en une seule transaction SQL :
//   1. UPDATE du statut du litige → EN_ATTENTE_D_INFORMATIONS
//   2. INSERT dans dispute_status_history (EN_COURS_D_ANALYSE → EN_ATTENTE_D_INFORMATIONS)
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

  // ── 2. Valider la transition EN_COURS_D_ANALYSE → EN_ATTENTE_D_INFORMATIONS ──
  validateTransition(dispute.status, 'EN_ATTENTE_D_INFORMATIONS');

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
        `UPDATE disputes SET status = 'EN_ATTENTE_D_INFORMATIONS', updated_at = ? WHERE id = ?`,
        [now, disputeId]
      )
      .then(() => {
        // Étape 2 : historique de la transition
        return recordStatusChange(disputeId, 'EN_COURS_D_ANALYSE', 'EN_ATTENTE_D_INFORMATIONS', operatorId, message);
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
            dispute_id: disputeId,
            status: 'EN_ATTENTE_D_INFORMATIONS',
            requested_information: message,
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

// Transitionne un litige du statut EN_COURS_D_ANALYSE ou EN_ATTENTE_D_INFORMATIONS
// vers APPROUVE. Opération réservée à l'OPERATOR.
// Valide la transition autorisée, puis exécute en une seule transaction SQL :
//   1. UPDATE du statut du litige → APPROUVE
//   2. INSERT dans dispute_status_history (ancien statut → APPROUVE)
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

  // ── 2. Valider la transition vers APPROUVE ──
  validateTransition(dispute.status, 'APPROUVE');

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
        `UPDATE disputes SET status = 'APPROUVE', updated_at = ? WHERE id = ?`,
        [now, disputeId]
      )
      .then(() => {
        // Étape 2 : historique de la transition
        return recordStatusChange(disputeId, dispute.status, 'APPROUVE', operatorId, comment);
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
            dispute_id: disputeId,
            status: 'APPROUVE',
            approved_by: operatorId,
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

// Transitionne un litige du statut EN_COURS_D_ANALYSE ou EN_ATTENTE_D_INFORMATIONS
// vers REJETE. Opération réservée à l'OPERATOR.
// Valide la transition autorisée, puis exécute en une seule transaction SQL :
//   1. UPDATE du statut du litige → REJETE
//   2. INSERT dans dispute_status_history (ancien statut → REJETE,
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

  // ── 2. Valider la transition vers REJETE ──
  validateTransition(dispute.status, 'REJETE');

  // ── 3. Exécuter la transaction atomique ──
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
        `UPDATE disputes SET status = 'REJETE', updated_at = ? WHERE id = ?`,
        [now, disputeId]
      )
      .then(() => {
        // Étape 2 : historique de la transition
        return recordStatusChange(disputeId, dispute.status, 'REJETE', operatorId, historyComment);
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
            dispute_id: disputeId,
            status: 'REJETE',
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
// Interroge le nombre total de chargebacks pour générer la référence.
// Utilise COUNT(*) pour minimiser les risques de race condition.
function generateChargebackReference() {
  return new Promise((resolve, reject) => {
    const year = new Date().getFullYear();
    db.get(
      `SELECT COUNT(*) AS count FROM dispute_status_history WHERE new_status = 'CHARGEBACK_INITIE'`,
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
// Transition : APPROUVE → CHARGEBACK_INITIE.
// Génère une référence unique et enregistre l'historique + commentaire.
// Validation : disputeId doit exister et être au statut APPROUVE.
//   chargebackReasonCode : code motif chargeback (ex: "4837")
//   network              : "Visa" ou "Mastercard"
//   comment              : texte libre de l'opérateur
async function chargebackDispute(disputeId, operatorId, chargebackReasonCode, network, comment) {
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    throw new AppError('Dispute not found', 404, '40402');
  }

  const currentStatus = dispute.status;
  const newStatus = 'CHARGEBACK_INITIE';

  validateTransition(currentStatus, newStatus);

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

      run(`UPDATE disputes SET status = ?, updated_at = ? WHERE id = ?`, [newStatus, now, disputeId])
        .then(() => recordStatusChange(disputeId, currentStatus, newStatus, operatorId, historyComment))
        .then(() => recordComment(disputeId, operatorId, comment))
        .then(() => {
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK', () => {});
              return reject(new AppError('Internal server error', 500, '50000'));
            }
            resolve({ dispute_id: disputeId, status: newStatus, chargeback_reference: chargebackReference });
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
// Transition : CHARGEBACK_INITIE → REMBOURSEMENT_EFFECTUE.
// Validation : disputeId doit exister et être au statut CHARGEBACK_INITIE.
//   refundAmount : montant remboursé, doit être > 0 et ≤ amount du litige
//   currency     : doit correspondre à la devise du litige original
//   refundMethod : "CARD_CREDIT" ou "BANK_TRANSFER"
async function refundDispute(disputeId, operatorId, refundAmount, currency, refundMethod) {
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    throw new AppError('Dispute not found', 404, '40402');
  }

  const currentStatus = dispute.status;
  const newStatus = 'REMBOURSEMENT_EFFECTUE';

  validateTransition(currentStatus, newStatus);

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

      run(`UPDATE disputes SET status = ?, updated_at = ? WHERE id = ?`, [newStatus, now, disputeId])
        .then(() => recordStatusChange(disputeId, currentStatus, newStatus, operatorId, historyComment))
        .then(() => db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            db.run('ROLLBACK', () => {});
            return reject(new AppError('Internal server error', 500, '50000'));
          }
          resolve({ dispute_id: disputeId, status: newStatus, refund_amount: refundAmount, currency });
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
// Transition : REJETE → CLOTURE ou REMBOURSEMENT_EFFECTUE → CLOTURE.
// La clôture est irréversible : un litige CLOTURE ne peut plus changer de statut.
// closureReason doit être une valeur parmi : CASE_RESOLVED, REJECTED_FINAL,
// REFUND_ISSUED, OTHER.
// La closedDate est générée en ISO 8601 côté serveur.
async function closeDispute(disputeId, operatorId, closureReason, comment) {
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    throw new AppError('Dispute not found', 404, '40402');
  }

  const currentStatus = dispute.status;
  const newStatus = 'CLOTURE';

  validateTransition(currentStatus, newStatus);

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

      run(`UPDATE disputes SET status = ?, updated_at = ? WHERE id = ?`, [newStatus, closedDate, disputeId])
        .then(() => recordStatusChange(disputeId, currentStatus, newStatus, operatorId, historyComment))
        .then(() => recordComment(disputeId, operatorId, comment))
        .then(() => {
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK', () => {});
              return reject(new AppError('Internal server error', 500, '50000'));
            }
            resolve({ dispute_id: disputeId, status: newStatus, closed_date: closedDate });
          });
        })
        .catch((sqlErr) => {
          db.run('ROLLBACK', () => {});
          reject(new AppError('Internal server error', 500, '50000'));
        });
    });
  });
}

// ─── RÉPONSE DU CLIENT À UNE DEMANDE D'INFO ───────────────────────────────
// EN_ATTENTE_D_INFORMATIONS → EN_COURS_D_ANALYSE
async function respondToInfoRequest(disputeId, userId, comment) {
  const dispute = await findDisputeById(disputeId);
  if (!dispute) {
    throw new AppError('Dispute not found', 404, '40402');
  }

  if (dispute.status !== 'EN_ATTENTE_D_INFORMATIONS') {
    throw new AppError(
      `Invalid status transition: dispute must be EN_ATTENTE_D_INFORMATIONS, current status is ${dispute.status}`,
      409,
      '40908'
    );
  }

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

      run(`UPDATE disputes SET status = 'EN_COURS_D_ANALYSE', updated_at = ? WHERE id = ?`, [now, disputeId])
        .then(() => recordStatusChange(disputeId, 'EN_ATTENTE_D_INFORMATIONS', 'EN_COURS_D_ANALYSE', userId, 'Client responded to information request'))
        .then(() => recordComment(disputeId, userId, comment))
        .then(() => {
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK', () => {});
              return reject(new AppError('Internal server error', 500, '50000'));
            }
            resolve({ dispute_id: disputeId, status: 'EN_COURS_D_ANALYSE', respond_date: now });
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
                 d.id AS dispute_id,
                 d.transaction_id,
                 d.reason,
                 d.description,
                 d.amount,
                 d.currency,
                 d.status,
                 d.created_at,
                 d.updated_at`;

    if (role === 'CLIENT') {
      sql += `, t.merchant, t.transaction_date`;
      sql += ` FROM disputes d
               JOIN transactions t ON d.transaction_id = t.id`;
    } else {
      sql += `, u.nom AS client_name, d.client_id`;
      sql += ` FROM disputes d
               LEFT JOIN users u ON d.client_id = u.id`;
    }

    sql += ` WHERE 1=1`;
    const params = [];

    if (role === 'CLIENT') {
      sql += ` AND t.client_id = ?`;
      params.push(userId);
    }

    if (status && status !== 'ALL') {
      sql += ` AND d.status = ?`;
      params.push(status);
    }

    if (startDate) {
      sql += ` AND d.created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND d.created_at <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY d.created_at DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve(rows);
    });
  });
}

// ─── HISTORIQUE DES STATUTS ────────────────────────────────────────────────

function getDisputeHistory(disputeId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, dispute_id, old_status, new_status, changed_by, reason, created_at
       FROM dispute_status_history
       WHERE dispute_id = ?
       ORDER BY created_at ASC`,
      [disputeId],
      (err, rows) => {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        resolve(rows || []);
      }
    );
  });
}

// ─── COMMENTAIRES ──────────────────────────────────────────────────────────

function getDisputeComments(disputeId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, dispute_id, client_id, comment, created_at
       FROM dispute_comments
       WHERE dispute_id = ?
       ORDER BY created_at ASC`,
      [disputeId],
      (err, rows) => {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        resolve(rows || []);
      }
    );
  });
}

// ─── DOCUMENTS ─────────────────────────────────────────────────────────────

function getDisputeDocuments(disputeId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, dispute_id, client_id, file_name, file_type, file_size, uploaded_at
       FROM dispute_documents
       WHERE dispute_id = ?
       ORDER BY uploaded_at ASC`,
      [disputeId],
      (err, rows) => {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        resolve(rows || []);
      }
    );
  });
}

function getDocumentContent(documentId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, dispute_id, client_id, file_name, file_type, file_size, file_content, uploaded_at
       FROM dispute_documents
       WHERE id = ?`,
      [documentId],
      (err, row) => {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        resolve(row);
      }
    );
  });
}

function createDocument(disputeId, userId, { fileName, fileType, fileContent }) {
  const docId = randomUUID();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO dispute_documents (id, dispute_id, client_id, file_name, file_type, file_path, file_size, file_content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [docId, disputeId, userId, fileName, fileType, 'base64:inline', fileContent ? Math.ceil(fileContent.length * 3 / 4) : 0, fileContent],
      function (err) {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        resolve({ id: docId, dispute_id: disputeId, client_id: userId, file_name: fileName, file_type: fileType, uploaded_at: new Date().toISOString() });
      }
    );
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
  respondToInfoRequest,
  // Consultation
  getDisputes,
  // Sub-resources
  getDisputeHistory,
  getDisputeComments,
  getDisputeDocuments,
  getDocumentContent,
  createDocument,
};
