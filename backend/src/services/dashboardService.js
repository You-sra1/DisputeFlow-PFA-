const db = require('../config/db');
const AppError = require('../utils/AppError');

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve(row);
    });
  });
}

async function getStats(userId, role) {
  const whereUser = role === 'CLIENT' ? 'WHERE d.userId = ?' : '';
  const params = role === 'CLIENT' ? [userId] : [];

  const total = await get(
    `SELECT COUNT(*) AS count FROM disputes d ${whereUser}`,
    params
  );

  const inProgress = await get(
    `SELECT COUNT(*) AS count FROM disputes d
     ${whereUser ? whereUser + ' AND' : 'WHERE'}
     d.status IN ('SUBMITTED', 'UNDER_REVIEW', 'WAITING_FOR_INFORMATION', 'CHARGEBACK_INITIATED')`,
    params
  );

  const approved = await get(
    `SELECT COUNT(*) AS count FROM disputes d
     ${whereUser ? whereUser + ' AND' : 'WHERE'}
     d.status IN ('APPROVED', 'CHARGEBACK_INITIATED', 'REFUND_COMPLETED')`,
    params
  );

  const totalAmount = await get(
    `SELECT COALESCE(SUM(d.amount), 0) AS total FROM disputes d ${whereUser}`,
    params
  );

  return {
    totalDisputes: total.count,
    inProgress: inProgress.count,
    approved: approved.count,
    totalAmount: totalAmount.total,
  };
}

async function getStatusDistribution(userId, role) {
  const whereUser = role === 'CLIENT' ? 'WHERE d.userId = ?' : '';
  const params = role === 'CLIENT' ? [userId] : [];

  const rows = await all(
    `SELECT d.status, COUNT(*) AS count
     FROM disputes d
     ${whereUser}
     GROUP BY d.status
     ORDER BY count DESC`,
    params
  );

  return rows.map((r) => ({ label: r.status, count: r.count }));
}

async function getReasonDistribution(userId, role) {
  const whereUser = role === 'CLIENT' ? 'WHERE d.userId = ?' : '';
  const params = role === 'CLIENT' ? [userId] : [];

  const rows = await all(
    `SELECT d.reason, COUNT(*) AS count
     FROM disputes d
     ${whereUser}
     GROUP BY d.reason
     ORDER BY count DESC`,
    params
  );

  return rows.map((r) => ({ label: r.reason, count: r.count }));
}

module.exports = { getStats, getStatusDistribution, getReasonDistribution };
