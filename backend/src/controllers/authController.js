const bcrypt = require('bcryptjs');
const userModel = require('../models/usermodel');
const { generateToken } = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/responseBuilder');

// Nombre de tours de hachage pour bcrypt : plus il est élevé, plus le hash est sécurisé.
const SALT_ROUNDS = 12;

// Vérifie si un mot de passe stocké est déjà un hash bcrypt.
function isBcryptHash(password) {
  return typeof password === 'string' && password.startsWith('$2');
}

// Vérifie un mot de passe en clair contre la valeur stockée en base.
// Supporte à la fois les anciens mots de passe en clair et les hashes bcrypt.
async function verifyPassword(plainPassword, storedPassword) {
  if (!storedPassword) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    try {
      return await bcrypt.compare(plainPassword, storedPassword);
    } catch {
      return false;
    }
  }

  return plainPassword === storedPassword;
}

// Si un utilisateur a encore un mot de passe non hashé, on le migre vers bcrypt.
async function migratePasswordToHash(user, plainPassword) {
  if (!user || !plainPassword || isBcryptHash(user.password)) {
    return;
  }

  const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
  await userModel.updatePassword(user.id, hashedPassword);
}

// Contrôleur de connexion : vérifie les identifiants et retourne un token JWT si tout est correct.
// Cette fonction reçoit le corps de la requête, lit l'email et le mot de passe,
// contrôle les informations en base, puis renvoie un token et les infos utilisateur.
async function login(req, res) {
  try {
    const { requestInfo, email, password } = req.body;

    if (requestInfo && requestInfo.requestUID) {
      console.log(`Login reçu avec requestUID=${requestInfo.requestUID}`);
    }

    if (!email || !password) {
      return res.status(400).json(
        errorResponse('Email and password are required', { errorCode: '40010' })
      );
    }

    const user = await userModel.findByEmail(email);

    if (!user) {
      return res.status(401).json(
        errorResponse('Invalid email or password', { errorCode: '40101' })
      );
    }

    const passwordValide = await verifyPassword(password, user.password);
    if (!passwordValide) {
      return res.status(401).json(
        errorResponse('Invalid email or password', { errorCode: '40101' })
      );
    }

    if (!isBcryptHash(user.password)) {
      await migratePasswordToHash(user, password);
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    return res.status(200).json(
      successResponse({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    );
  } catch (err) {
    console.error('Erreur login :', err.stack || err);
    return res.status(500).json(
      errorResponse('Internal server error', { errorCode: '50000' })
    );
  }
}

// Retourne les informations de l'utilisateur connecté à partir du token JWT.
// Cette route est protégée et ne doit être accessible qu'avec un token valide.
async function me(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json(
        errorResponse('Unauthorized', { errorCode: '40100' })
      );
    }

    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json(
        errorResponse('User not found', { errorCode: '40401' })
      );
    }

    return res.status(200).json(successResponse(user));
  } catch (err) {
    console.error('Erreur /me :', err);
    return res.status(500).json(
      errorResponse('Internal server error', { errorCode: '50000' })
    );
  }
}

module.exports = { login, me };
