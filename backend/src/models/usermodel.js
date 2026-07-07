const db = require('../config/db');

function findByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function findById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, name, email, role FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function create({ id, name, email, password, role }) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [id, name, email, password, role],
      function (err) {
        if (err) return reject(err);
        resolve({ id, name, email, role });
      }
    );
  });
}

// Met à jour le mot de passe d'un utilisateur avec un hash bcrypt.
function updatePassword(id, passwordHash) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET password = ? WHERE id = ?', [passwordHash, id], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
}

function countUsers() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as total FROM users', [], (err, row) => {
      if (err) return reject(err);
      resolve(row.total);
    });
  });
}

module.exports = { findByEmail, findById, create, updatePassword, countUsers };