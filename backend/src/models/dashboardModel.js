const db = require('../config/database');
const AppError = require('../utils/AppError');

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve(rows || []);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve(row);
    });
  });
}

async function getStats() {
  return dbGet(
    `SELECT
       COUNT(*) AS totalDisputes,
       SUM(CASE WHEN status IN ('SOUMIS','EN_COURS_D_ANALYSE','EN_ATTENTE_D_INFORMATIONS','APPROUVE','CHARGEBACK_INITIE') THEN 1 ELSE 0 END) AS inProgress,
       SUM(CASE WHEN status = 'APPROUVE' THEN 1 ELSE 0 END) AS approved,
       COALESCE(SUM(amount), 0) AS totalAmount
     FROM disputes`
  );
}

async function getStatusDistribution() {
  return dbAll(`SELECT status, COUNT(*) AS count FROM disputes GROUP BY status ORDER BY count DESC`);
}

async function getReasonDistribution() {
  return dbAll(`SELECT reason, COUNT(*) AS count FROM disputes GROUP BY reason ORDER BY count DESC`);
}

async function getMerchantDisputes() {
  return dbAll(
    `SELECT t.merchant, COUNT(*) AS count, COALESCE(SUM(d.amount), 0) AS totalAmount
     FROM disputes d
     JOIN transactions t ON d.transaction_id = t.id
     GROUP BY t.merchant
     ORDER BY count DESC`
  );
}

async function getAvgProcessingTime() {
  return dbAll(
    `SELECT
       d.id AS dispute_id,
       d.status,
       d.created_at,
       d.updated_at,
       CAST((julianday(d.updated_at) - julianday(d.created_at)) * 24 AS INTEGER) AS hoursToProcess
     FROM disputes d
     WHERE d.status IN ('CLOTURE', 'REJETE')
     ORDER BY hoursToProcess DESC`
  );
}

async function getMonthlyTrends() {
  return dbAll(
    `SELECT
       strftime('%Y-%m', created_at) AS month,
       COUNT(*) AS totalCreated,
       SUM(CASE WHEN status = 'CLOTURE' THEN 1 ELSE 0 END) AS closed,
       SUM(CASE WHEN status = 'REJETE' THEN 1 ELSE 0 END) AS rejected,
       SUM(CASE WHEN status IN ('APPROUVE', 'CHARGEBACK_INITIE', 'REMBOURSEMENT_EFFECTUE') THEN 1 ELSE 0 END) AS approved
     FROM disputes
     GROUP BY strftime('%Y-%m', created_at)
     ORDER BY month ASC`
  );
}

module.exports = { getStats, getStatusDistribution, getReasonDistribution, getMerchantDisputes, getAvgProcessingTime, getMonthlyTrends };
