const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

function isBcryptHash(password) {
  return typeof password === 'string' && password.startsWith('$2');
}

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, storedPassword) {
  if (!storedPassword) return false;
  if (isBcryptHash(storedPassword)) {
    try { return await bcrypt.compare(plainPassword, storedPassword); }
    catch { return false; }
  }
  return plainPassword === storedPassword;
}

module.exports = { isBcryptHash, hashPassword, comparePassword };
