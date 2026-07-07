const jwt = require('jsonwebtoken');
require('dotenv').config();

// Génère un token JWT à partir des informations utilisateur.
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// Vérifie la validité d'un token JWT et retourne son contenu décodé.
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generateToken, verifyToken };