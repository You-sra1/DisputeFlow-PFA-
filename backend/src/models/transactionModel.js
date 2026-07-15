const db = require('../config/database');
const AppError = require('../utils/AppError');

function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function findCardByNumber(cardNumber) {
  try {
    return await getOne('SELECT id, client_id FROM cards WHERE card_number = ?', [cardNumber]);
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function findTransactionById(transactionId) {
  try {
    return await getOne(
      `SELECT id, client_id, card_id, amount, currency, merchant, merchant_category,
              status, transaction_date, description, created_at
       FROM transactions WHERE id = ?`,
      [transactionId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function getTransactions(cardId, userId, startDate, endDate) {
  try {
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
    return await getAll(sql, params);
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function findCardByUserId(userId) {
  try {
    return await getOne(
      'SELECT id, client_id FROM cards WHERE client_id = ? AND is_active = 1 LIMIT 1',
      [userId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function findCardsByUserId(userId) {
  try {
    return await getAll(
      'SELECT id, card_number, card_type FROM cards WHERE client_id = ? AND is_active = 1 ORDER BY id',
      [userId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

module.exports = { findCardByNumber, findTransactionById, getTransactions, findCardByUserId, findCardsByUserId };
