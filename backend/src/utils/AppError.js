// Classe d'erreur métier personnalisée.
// Porte un code d'erreur métier (errorCode), un statut HTTP (statusCode)
// et un message lisible pour le client.

class AppError extends Error {
  /**
   * @param {string} message    - Description lisible de l'erreur envoyée au client
   * @param {number} statusCode - Code HTTP (400, 401, 403, 404, 500…)
   * @param {string} errorCode  - Code métier (40001, 40002, …, 50000)
   */
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.name = 'AppError';
  }
}

module.exports = AppError;
