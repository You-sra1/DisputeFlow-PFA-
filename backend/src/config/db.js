const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.resolve(__dirname, '../../../database/database.sqlite');
const DEFAULT_EMAIL = 'client001@example.com';
const DEFAULT_PASSWORD = 'Password123';

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erreur de connexion à SQLite :', err.message);
    return;
  }

  console.log('Connexion à SQLite établie :', DB_PATH);
  initializeDatabase();
});

function isBcryptHash(password) {
  return typeof password === 'string' && password.startsWith('$2');
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function initializeDatabase() {
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

    console.log('Table users prête.');

    const existingUser = await getRow('SELECT id, email, password FROM users WHERE email = ?', [DEFAULT_EMAIL]);

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
      await runQuery(
        'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
        ['CLIENT001', 'Alice Martin', DEFAULT_EMAIL, hashedPassword, 'CLIENT']
      );
      console.log('Utilisateur de test créé avec un mot de passe hashé.');
      return;
    }

    if (!isBcryptHash(existingUser.password)) {
      const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
      await runQuery('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, existingUser.id]);
      console.log('Mot de passe utilisateur migré vers un hash bcrypt.');
    }
  } catch (seedErr) {
    console.error('Erreur lors de l’initialisation SQLite :', seedErr.message);
  }
}

module.exports = db;