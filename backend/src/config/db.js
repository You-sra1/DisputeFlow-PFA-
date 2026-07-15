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
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('CLIENT', 'OPERATOR')),
        createdAt TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        cardNumber TEXT NOT NULL,
        cardType TEXT NOT NULL,
        expiryDate TEXT NOT NULL,
        cardholderName TEXT NOT NULL,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        cardId TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        merchant TEXT NOT NULL,
        merchantCategory TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        transactionDate TEXT NOT NULL,
        description TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS disputes (
        id TEXT PRIMARY KEY,
        transactionId TEXT NOT NULL,
        userId TEXT NOT NULL,
        reason TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'SUBMITTED',
        priority TEXT NOT NULL DEFAULT 'NORMAL',
        assignedTo TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS dispute_status_history (
        id TEXT PRIMARY KEY,
        disputeId TEXT NOT NULL,
        fromStatus TEXT,
        toStatus TEXT NOT NULL,
        changedBy TEXT NOT NULL,
        reason TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS dispute_comments (
        id TEXT PRIMARY KEY,
        disputeId TEXT NOT NULL,
        userId TEXT NOT NULL,
        comment TEXT NOT NULL,
        createdAt TEXT DEFAULT (datetime('now'))
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS dispute_documents (
        id TEXT PRIMARY KEY,
        disputeId TEXT NOT NULL,
        userId TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileType TEXT NOT NULL,
        filePath TEXT NOT NULL,
        fileSize INTEGER,
        fileContent TEXT,
        uploadedAt TEXT DEFAULT (datetime('now'))
      )
    `);

    console.log('Toutes les tables sont pretes.');
  } catch (err) {
    console.error("Erreur lors de l'initialisation des tables :", err.message);
  }
}

module.exports = db;
