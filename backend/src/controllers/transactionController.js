// Contrôleur des endpoints liés aux transactions.
// Reçoit la requête HTTP, délègue la validation au service et formate la réponse.
// Les erreurs métier sont levées via AppError et interceptées par errorHandler.

const transactionService = require('../services/transactionService');
const { successResponse } = require('../utils/responseBuilder');
const AppError = require('../utils/AppError');

// GET /transactions
// Valide les paramètres d'entrée (query string ou body), vérifie l'appartenance de la carte,
// puis retourne la liste des transactions pour le client authentifié.
// Si cardNumber n'est pas fourni, on détecte automatiquement la première carte du client.
async function getTransactions(req, res, next) {
  try {
    // Accepte les paramètres depuis query (GET classique) ou body (si envoyé via fetch body)
    const source = req.method === 'GET' && Object.keys(req.body || {}).length === 0 ? req.query : { ...req.query, ...req.body };
    const { requestInfo, cardNumber, startDate, endDate } = source;

    // requestInfo est optionnel en GET (tracebility), mais si fourni doit être complet
    if (requestInfo && (!requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID)) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    // startDate et endDate optionnelles, format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (startDate && !dateRegex.test(startDate)) {
      throw new AppError('Invalid date format', 400, '40003');
    }

    if (endDate && !dateRegex.test(endDate)) {
      throw new AppError('Invalid date format', 400, '40003');
    }

    if (startDate && endDate && startDate > endDate) {
      throw new AppError('startDate must be before endDate', 400, '40004');
    }

    let card;

    if (cardNumber) {
      if (!/^\d{13,19}$/.test(cardNumber)) {
        throw new AppError('Missing or invalid cardNumber', 400, '40002');
      }
      card = await transactionService.findCardByNumber(cardNumber);
      if (!card) {
        throw new AppError('Card not found', 404, '40400');
      }
      if (card.userId !== req.user.id) {
        throw new AppError('Access denied to this card', 403, '40300');
      }
    } else {
      // Auto-détection : récupère la première carte active du client
      card = await transactionService.findCardByUserId(req.user.id);
      if (!card) {
        throw new AppError('No card found for this user', 404, '40400');
      }
    }

    const transactions = await transactionService.getTransactions(
      card.id,
      req.user.id,
      startDate || null,
      endDate || null
    );

    const data = transactions.map((t) => ({
      transactionId: t.id,
      merchant: t.merchant,
      amount: t.amount,
      currency: t.currency,
      transactionDate: t.transactionDate,
      status: t.status,
    }));

    return res.status(200).json(successResponse(data));
  } catch (err) {
    next(err);
  }
}

// GET /cards
// Retourne la liste des cartes actives du client authentifié.
async function getCards(req, res, next) {
  try {
    const cards = await transactionService.findCardsByUserId(req.user.id);
    const data = cards.map((c) => ({
      cardId: c.id,
      cardNumber: c.cardNumber,
      brand: c.cardType,
    }));
    return res.status(200).json(successResponse(data));
  } catch (err) {
    next(err);
  }
}

module.exports = { getTransactions, getCards };
