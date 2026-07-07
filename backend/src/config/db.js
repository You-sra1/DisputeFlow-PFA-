const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.resolve(__dirname, '../../../database/database.sqlite');
// L'email et l'identifiant doivent correspondre à ceux utilisés par le seed
// (database/seed.js) pour que les transactions et cartes soient bien liées
// au même utilisateur que celui qui se connecte.
const DEFAULT_EMAIL = 'client001@example.com';
const DEFAULT_PASSWORD = 'Password123';

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erreur de connexion à SQLite :', err.message);
  } else {
    console.log('Connexion à SQLite établie :', DB_PATH);
    initUsersTable();
  }
});

function isBcryptHash(password) {
  return typeof password === 'string' && password.startsWith('$2');
}

function initUsersTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('CLIENT', 'OPERATOR')),
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `, async (err) => {
    if (err) {
      console.error('Erreur création table users :', err.message);
      return;
    }

    console.log('Table users prête.');

    try {
      const existingUser = await new Promise((resolve, reject) => {
        db.get('SELECT id, email, password FROM users WHERE email = ?', [DEFAULT_EMAIL], (selectErr, row) => {
          if (selectErr) return reject(selectErr);
          resolve(row);
        });
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
            ['CLIENT001', 'Alice Martin', DEFAULT_EMAIL, hashedPassword, 'CLIENT'],
            (insertErr) => {
              if (insertErr) return reject(insertErr);
              resolve();
            }
          );
        });
        console.log('Utilisateur de test créé avec un mot de passe hashé.');
        return;
      }

      // ── Nettoyage : suppression de l'ancien utilisateur USR001 s'il existe ──
      // Cet utilisateur était créé par l'ancienne version de db.js avec
      // l'email client@example.com. Il ne possède aucune carte ni transaction
      // et son ID (USR001) ne correspond pas aux données de seed (CLIENT001).
      // Le laisser en base prête à confusion (login réussi mais données vides).
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM users WHERE id = ?', ['USR001'], (delErr) => {
          if (delErr) return reject(delErr);
          resolve();
        });
      });

      if (!isBcryptHash(existingUser.password)) {
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
        await new Promise((resolve, reject) => {
          db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, existingUser.id], (updateErr) => {
            if (updateErr) return reject(updateErr);
            resolve();
          });
        });
        console.log('Mot de passe utilisateur migré vers un hash bcrypt.');
      }
    } catch (seedErr) {
      console.error('Erreur lors du seed utilisateur :', seedErr.message);
    }
  });
}

module.exports = db;