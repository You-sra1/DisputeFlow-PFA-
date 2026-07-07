const { verifyToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/responseBuilder');

// Middleware qui vérifie la présence et la validité du token JWT dans l'en-tête Authorization.
// Si le token est valide, on attache les données utilisateur à la requête pour les autres handlers.
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  // ── Token manquant ou mal formé → errorCode 40100 ──
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(errorResponse('Unauthorized', { errorCode: '40100' }));
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    // ── Token invalide ou expiré → errorCode 40100 ──
    return res.status(401).json(errorResponse('Unauthorized', { errorCode: '40100' }));
  }
}

// Ex: authorize('OPERATOR') ou authorize('CLIENT', 'OPERATOR')
// Middleware qui vérifie si l'utilisateur connecté possède un rôle autorisé.
function authorize(...rolesAutorises) {
  return (req, res, next) => {
    // ── Rôle insuffisant ou absent → errorCode 40300 ──
    // Seul un utilisateur avec l'un des rôles autorisés peut accéder à la route
    if (!req.user || !rolesAutorises.includes(req.user.role)) {
      return res.status(403).json(errorResponse('Access denied', { errorCode: '40300' }));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
