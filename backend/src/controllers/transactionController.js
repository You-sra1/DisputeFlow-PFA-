// Contrôleur des endpoints liés aux transactions.
// Reçoit la requête HTTP, délègue la validation au service et formate la réponse.
// Les erreurs métier sont levées via AppError et interceptées par errorHandler.

const transactionService = require('../services/transactionService');
const { successResponse } = require('../utils/responseBuilder');
const AppError = require('../utils/AppError');

// GET /transactions
// Valide les paramètres d'entrée, vérifie l'appartenance de la carte,
// puis retourne la liste des transactions pour le client authentifié.
async function getTransactions(req, res, _next) {
  const { requestInfo, cardNumber, startDate, endDate } = req.body;

  // ── 1. Validation requestInfo ─────────────────────────────────────────────
  // requestInfo, requestUID, requestDate et userID sont obligatoires
  if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
    throw new AppError('Missing or invalid requestInfo', 400, '40001');
  }

  // ── 2. Validation cardNumber ──────────────────────────────────────────────
  // cardNumber est obligatoire et doit être une chaîne numérique de 13 à 19 chiffres
  if (!cardNumber) {
    throw new AppError('Missing or invalid cardNumber', 400, '40002');
  }

  if (!/^\d{13,19}$/.test(cardNumber)) {
    throw new AppError('Missing or invalid cardNumber', 400, '40002');
  }

  // ── 3. Validation des dates ───────────────────────────────────────────────
  // startDate et endDate sont optionnelles mais, si fournies, doivent être au format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (startDate && !dateRegex.test(startDate)) {
    throw new AppError('Invalid date format', 400, '40003');
  }

  if (endDate && !dateRegex.test(endDate)) {
    throw new AppError('Invalid date format', 400, '40003');
  }

  // startDate ne peut pas être postérieure à endDate
  if (startDate && endDate && startDate > endDate) {
    throw new AppError('startDate must be before endDate', 400, '40004');
  }

  // ── 4. Vérification de la carte ───────────────────────────────────────────
  // La carte doit exister en base ET appartenir au client identifié par le token JWT
  const card = await transactionService.findCardByNumber(cardNumber);

  if (!card) {
    throw new AppError('Card not found', 404, '40400');
  }

  if (card.userId !== req.user.id) {
    throw new AppError('Access denied to this card', 403, '40300');
  }

  // ── 5. Récupération des transactions ──────────────────────────────────────
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
}

// GET /transactions/:id
// Retourne le détail d'une transaction spécifique pour le client authentifié.
// Vérifie que la transaction existe et appartient au client.
async function getTransactionById(req, res, _next) {
  const { id } = req.params;

  const transaction = await transactionService.findTransactionById(id);

  // ── Transaction introuvable ──
  if (!transaction) {
    throw new AppError('Transaction not found', 404, '40401');
  }

  // ── La transaction n'appartient pas au client ──
  if (transaction.userId !== req.user.id) {
    throw new AppError('Access denied to this transaction', 403, '40301');
  }

  return res.status(200).json(successResponse({
    transactionId: transaction.id,
    cardId: transaction.cardId,
    merchant: transaction.merchant,
    merchantCategory: transaction.merchantCategory,
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
    transactionDate: transaction.transactionDate,
    description: transaction.description,
    createdAt: transaction.createdAt,
  }));
}

module.exports = { getTransactions, getTransactionById };
