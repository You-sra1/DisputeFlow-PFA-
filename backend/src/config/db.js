const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(__dirname, '../../', process.env.DB_PATH)
  : path.resolve(__dirname, '../../../database/database.sqlite');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erreur de connexion a SQLite :', err.message);
    return;
  }
  console.log('Connexion a SQLite etablie :', DB_PATH);
  initializeTables();
});

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function initializeTables() {
  try {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nom TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('CLIENT', 'OPERATOR')),
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        card_number TEXT NOT NULL,
        card_type TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        cardholder_name TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        card_id TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        merchant TEXT NOT NULL,
        merchant_category TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        transaction_date TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS disputes (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'SOUMIS',
        priority TEXT NOT NULL DEFAULT 'NORMAL',
        assigned_to TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS dispute_status_history (
        id TEXT PRIMARY KEY,
        dispute_id TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS dispute_comments (
        id TEXT PRIMARY KEY,
        dispute_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        comment TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS dispute_documents (
        id TEXT PRIMARY KEY,
        dispute_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        file_content TEXT,
        uploaded_at TEXT DEFAULT (datetime('now'))
      )
    `);

    console.log('Toutes les tables sont pretes.');
  } catch (err) {
    console.error("Erreur lors de l'initialisation des tables :", err.message);
  }
}

module.exports = db;
