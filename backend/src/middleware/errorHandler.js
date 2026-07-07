// Middleware centralisé de gestion des erreurs.
// Capture les instances d'AppError et formate la réponse selon le contrat standard.
// Les erreurs imprévues (non-AppError) sont loggées côté serveur et retournent 500
// sans exposer de détail technique au client.

const { errorResponse } = require('../utils/responseBuilder');
const AppError = require('../utils/AppError');

function errorHandler(err, _req, res, _next) {
  // ── Erreur métier connue (AppError) ──
  // On extrait statusCode et errorCode pour produire une réponse conforme au contrat
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      errorResponse(err.message, { errorCode: err.errorCode })
    );
  }

  // ── Erreur imprévue (bug, panne DB, etc.) ──
  // On logge l'erreur complète en console sans jamais renvoyer la stack au client
  console.error('Erreur serveur imprévue:', err);
  return res.status(500).json(
    errorResponse('Internal server error', { errorCode: '50000' })
  );
}

module.exports = errorHandler;
