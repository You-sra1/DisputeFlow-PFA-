// Service réutilisable de traçabilité pour les litiges.
// Fournit des fonctions génériques pour enregistrer un changement de statut
// et ajouter un commentaire dans l'historique d'un litige.
// Utilisé par tous les endpoints de workflow (review, request-info, etc.).

const { randomUUID } = require('crypto');
const db = require('../config/db');
const AppError = require('../utils/AppError');

// Exécute une requête db.run dans une promesse (helper interne).
function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Enregistre un changement de statut dans dispute_status_history.
//   disputeId    : identifiant du litige
//   fromStatus   : statut avant le changement (ou null pour création)
//   toStatus     : nouveau statut
//   changedBy    : ID de l'utilisateur ayant effectué le changement
//   comment      : raison ou commentaire associé à la transition
// Retourne une promesse résolue avec le résultat de l'insertion.
async function recordStatusChange(disputeId, fromStatus, toStatus, changedBy, comment) {
  return dbRun(
    `INSERT INTO dispute_status_history (id, disputeId, fromStatus, toStatus, changedBy, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), disputeId, fromStatus, toStatus, changedBy, comment]
  );
}

// Ajoute un commentaire dans dispute_comments.
//   disputeId    : identifiant du litige
//   userId       : auteur du commentaire (CLIENT ou OPERATOR)
//   comment      : texte du message
// Retourne une promesse résolue avec le résultat de l'insertion.
async function recordComment(disputeId, userId, comment) {
  return dbRun(
    `INSERT INTO dispute_comments (id, disputeId, userId, comment)
     VALUES (?, ?, ?, ?)`,
    [randomUUID(), disputeId, userId, comment]
  );
}

module.exports = { recordStatusChange, recordComment };
