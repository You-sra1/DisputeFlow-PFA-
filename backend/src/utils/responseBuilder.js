const { randomUUID } = require('crypto');

// Construit une réponse standardisée avec le contrat attendu par l'API.
function buildResponse(data, options = {}) {
  const {
    resultID = 'ProceedWithSuccess',
    errorCode = '00000',
    errorDescription = 'PROCESSED WITH SUCCESS',
    responseUID = randomUUID(),
  } = options;

  return {
    responseUID,
    resultID,
    errorCode,
    errorDescription,
    data,
  };
}

// Formatte une réponse de succès avec les valeurs par défaut du contrat.
function successResponse(data, options = {}) {
  return buildResponse(data, {
    ...options,
    resultID: options.resultID || 'ProceedWithSuccess',
    errorCode: options.errorCode || '00000',
    errorDescription: options.errorDescription || 'PROCESSED WITH SUCCESS',
  });
}

// Formatte une réponse d'erreur avec un message explicite et un code métier.
function errorResponse(message, options = {}) {
  return buildResponse(null, {
    ...options,
    resultID: options.resultID || 'Failure',
    errorCode: options.errorCode || '00001',
    errorDescription: options.errorDescription || message || 'Échec du traitement',
  });
}

module.exports = {
  buildResponse,
  successResponse,
  errorResponse,
};
