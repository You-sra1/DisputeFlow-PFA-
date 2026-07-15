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

function updateProfile(id, { name, email }) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, id],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      }
    );
  });
}

function updatePassword(id, passwordHash) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET password = ? WHERE id = ?', [passwordHash, id], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
}

module.exports = { findByEmail, findById, updateProfile, updatePassword };
