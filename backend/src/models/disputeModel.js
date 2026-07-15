const db = require('../config/database');
const AppError = require('../utils/AppError');

// ─── HELPERS POUR PROMESSES ──────────────────────────────────────────────────

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

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

// ─── TRANSACTIONS ────────────────────────────────────────────────────────────

function beginTransaction() {
  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve();
    });
  });
}

function commit() {
  return new Promise((resolve, reject) => {
    db.run('COMMIT', (err) => {
      if (err) return reject(new AppError('Internal server error', 500, '50000'));
      resolve();
    });
  });
}

function rollback() {
  return new Promise((resolve) => {
    db.run('ROLLBACK', () => resolve());
  });
}

// ─── GÉNÉRATION D'IDENTIFIANTS ──────────────────────────────────────────────

async function generateDisputeId() {
  try {
    const row = await getOne(
      `SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 0) + 1 AS nextNum FROM disputes`
    );
    return `DSP${String(row.nextNum).padStart(3, '0')}`;
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

// ─── RECHERCHES ──────────────────────────────────────────────────────────────

async function findTransactionById(transactionId) {
  try {
    return await getOne(
      `SELECT id, client_id, amount, currency, status FROM transactions WHERE id = ?`,
      [transactionId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function findActiveDisputeByTransactionId(transactionId) {
  try {
    return await getOne(
      `SELECT id, status FROM disputes
       WHERE transaction_id = ? AND status NOT IN ('REJETE', 'CLOTURE')`,
      [transactionId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function findDisputeById(disputeId) {
  try {
    return await getOne(
      `SELECT id, transaction_id, client_id, status, amount, currency FROM disputes WHERE id = ?`,
      [disputeId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

// ─── CRÉATION ────────────────────────────────────────────────────────────────

async function createDisputeRow(id, transactionId, userId, reason, description, claimAmount, currency) {
  try {
    return await runQuery(
      `INSERT INTO disputes (id, transaction_id, client_id, reason, description, amount, currency, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'SOUMIS')`,
      [id, transactionId, userId, reason, description, claimAmount, currency]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

// ─── MISE À JOUR ─────────────────────────────────────────────────────────────

async function updateDisputeStatus(disputeId, newStatus, now) {
  try {
    return await runQuery(
      `UPDATE disputes SET status = ?, updated_at = ? WHERE id = ?`,
      [newStatus, now, disputeId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

// ─── HISTORIQUE DES STATUTS ─────────────────────────────────────────────────

async function createDisputeHistoryRow(id, disputeId, oldStatus, newStatus, changedBy, reason) {
  try {
    return await runQuery(
      `INSERT INTO dispute_status_history (id, dispute_id, old_status, new_status, changed_by, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, disputeId, oldStatus, newStatus, changedBy, reason]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function getDisputeHistory(disputeId) {
  try {
    return await getAll(
      `SELECT id, dispute_id, old_status, new_status, changed_by, reason, created_at
       FROM dispute_status_history
       WHERE dispute_id = ?
       ORDER BY created_at ASC`,
      [disputeId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

// ─── COMMENTAIRES ───────────────────────────────────────────────────────────

async function createDisputeCommentRow(id, disputeId, clientId, comment) {
  try {
    return await runQuery(
      `INSERT INTO dispute_comments (id, dispute_id, client_id, comment)
       VALUES (?, ?, ?, ?)`,
      [id, disputeId, clientId, comment]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function getDisputeComments(disputeId) {
  try {
    return await getAll(
      `SELECT id, dispute_id, client_id, comment, created_at
       FROM dispute_comments
       WHERE dispute_id = ?
       ORDER BY created_at ASC`,
      [disputeId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

// ─── DOCUMENTS ──────────────────────────────────────────────────────────────

async function getDisputeDocuments(disputeId) {
  try {
    return await getAll(
      `SELECT id, dispute_id, client_id, file_name, file_type, file_size, uploaded_at
       FROM dispute_documents
       WHERE dispute_id = ?
       ORDER BY uploaded_at ASC`,
      [disputeId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function getDocumentContent(documentId) {
  try {
    return await getOne(
      `SELECT id, dispute_id, client_id, file_name, file_type, file_size, file_content, uploaded_at
       FROM dispute_documents
       WHERE id = ?`,
      [documentId]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function createDocumentRow(docId, disputeId, userId, fileName, fileType, filePath, fileSize, fileContent) {
  try {
    return await runQuery(
      `INSERT INTO dispute_documents (id, dispute_id, client_id, file_name, file_type, file_path, file_size, file_content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [docId, disputeId, userId, fileName, fileType, filePath, fileSize, fileContent]
    );
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

// ─── RÉFÉRENCE CHARGEBACK ───────────────────────────────────────────────────

async function generateChargebackReference() {
  try {
    const row = await getOne(
      `SELECT COUNT(*) AS count FROM dispute_status_history WHERE new_status = 'CHARGEBACK_INITIE'`
    );
    const year = new Date().getFullYear();
    const count = (row ? row.count : 0) + 1;
    return `CB${year}${String(count).padStart(5, '0')}`;
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

// ─── RECHERCHE AVEC FILTRES ─────────────────────────────────────────────────

async function getDisputesByFilter({ role, userId, status, startDate, endDate }) {
  try {
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

    return await getAll(sql, params);
  } catch (err) {
    throw new AppError('Internal server error', 500, '50000');
  }
}

module.exports = {
  // Helpers transactions
  beginTransaction,
  commit,
  rollback,
  runQuery,

  // Génération d'identifiants
  generateDisputeId,
  generateChargebackReference,

  // Recherches
  findTransactionById,
  findActiveDisputeByTransactionId,
  findDisputeById,

  // Création
  createDisputeRow,
  createDisputeHistoryRow,
  createDisputeCommentRow,
  createDocumentRow,

  // Mise à jour
  updateDisputeStatus,

  // Consultation
  getDisputesByFilter,
  getDisputeHistory,
  getDisputeComments,
  getDisputeDocuments,
  getDocumentContent,
};
