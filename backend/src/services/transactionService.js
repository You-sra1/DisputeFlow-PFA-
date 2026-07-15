// Service de gestion des transactions bancaires.
// Contient la logique métier : validation de la carte, filtres temporels, requêtes SQL.
// Les erreurs imprévues (DB) sont transformées en AppError avec le code 50000.

const db = require('../config/db');
const AppError = require('../utils/AppError');

// Recherche une carte par son numéro.
// Retourne la ligne complète ou undefined si introuvable.
// En cas d'erreur SQL, rejette avec AppError(50000) pour éviter d'exposer le détail technique.
function findCardByNumber(cardNumber) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, client_id FROM cards WHERE card_number = ?', [cardNumber], (err, row) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve(row);
    });
  });
}

// Recherche une transaction par son ID.
// Retourne la ligne complète ou undefined si introuvable.
// Utilisée par GET /transactions/:id pour le détail d'une transaction.
function findTransactionById(transactionId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, client_id, card_id, amount, currency, merchant, merchant_category,
              status, transaction_date, description, created_at
       FROM transactions WHERE id = ?`,
      [transactionId],
      (err, row) => {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        resolve(row);
      }
    );
  });
}

// Récupère les transactions d'une carte pour un client donné,
// avec filtres optionnels par plage de dates.
// En cas d'erreur SQL, rejette avec AppError(50000).
function getTransactions(cardId, userId, startDate, endDate) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT id, merchant, amount, currency, transaction_date, status
               FROM transactions
               WHERE card_id = ? AND client_id = ?`;
    const params = [cardId, userId];

    if (startDate) {
      sql += ' AND transaction_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND transaction_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY transaction_date DESC';

    db.all(sql, params, (err, rows) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve(rows);
    });
  });
}

// Recherche la première carte active d'un utilisateur par son ID.
// Retourne la ligne complète ou undefined si aucune carte trouvée.
function findCardByUserId(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, client_id FROM cards WHERE client_id = ? AND is_active = 1 LIMIT 1', [userId], (err, row) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve(row);
    });
  });
}

// Recherche toutes les cartes actives d'un utilisateur.
// Retourne la liste des cartes (id, cardNumber, brand).
function findCardsByUserId(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT id, card_number, card_type FROM cards WHERE client_id = ? AND is_active = 1 ORDER BY id',
      [userId],
      (err, rows) => {
        if (err) return reject(new AppError('Internal server error', 500, '50000'));
        resolve(rows);
      }
    );
  });
}

module.exports = { findCardByNumber, findCardByUserId, findCardsByUserId, findTransactionById, getTransactions };
