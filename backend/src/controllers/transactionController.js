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
    const source = req.method === 'GET' && Object.keys(req.body || {}).length === 0 ? req.query : { ...req.query, ...req.body };
    const { requestInfo, cardNumber, startDate, endDate } = source;

    if (requestInfo && (!requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID)) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

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
      if (card.client_id !== req.user.id) {
        throw new AppError('Access denied to this card', 403, '40300');
      }
    } else {
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
      transaction_id: t.id,
      merchant: t.merchant,
      amount: t.amount,
      currency: t.currency,
      transaction_date: t.transaction_date,
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
      card_id: c.id,
      card_number: c.card_number,
      card_type: c.card_type,
    }));
    return res.status(200).json(successResponse(data));
  } catch (err) {
    next(err);
  }
}

async function getTransactionById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('Missing transaction id', 400, '40010');

    const txn = await transactionService.findTransactionById(id);
    if (!txn) throw new AppError('Transaction not found', 404, '40401');
    if (txn.client_id !== req.user.id) throw new AppError('Access denied to this transaction', 403, '40301');

    return res.status(200).json(successResponse({
      transaction_id: txn.id,
      merchant: txn.merchant,
      amount: txn.amount,
      currency: txn.currency,
      transaction_date: txn.transaction_date,
      status: txn.status,
      description: txn.description,
      merchant_category: txn.merchant_category,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = { getTransactions, getCards, getTransactionById };
