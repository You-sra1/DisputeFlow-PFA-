const jwt = require('jsonwebtoken');

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment');
  }
  return secret;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { generateToken, verifyToken };
