// Contrôleur des endpoints liés aux litiges (disputes).
// Valide les paramètres d'entrée, délègue la logique métier au service,
// et formate la réponse selon le contrat standard.
// Les erreurs sont propagées via AppError et interceptées par errorHandler.

const disputeService = require('../services/disputeService');
const { successResponse } = require('../utils/responseBuilder');
const AppError = require('../utils/AppError');

// Motifs de contestation autorisés (doivent correspondre à la CHECK de la table disputes)
const VALID_REASONS = [
  'UNAUTHORIZED_TRANSACTION',
  'DOUBLE_CHARGE',
  'GOODS_NOT_RECEIVED',
  'SERVICE_NOT_PROVIDED',
  'INCORRECT_AMOUNT',
  'CANCELLED_RECURRING_PAYMENT',
  'FRAUD',
  'ATM_CASH_NOT_DISPENSED',
  'OTHER',
];

// POST /disputes
// Valide les données entrantes, vérifie la transaction, puis crée le litige.
// Le litige est inséré en base avec son historique et un commentaire initial,
// le tout dans une seule transaction SQL.
async function createDispute(req, res, next) {
  try {
    const { requestInfo, transactionId, reason, description, claimAmount, currency } = req.body;
    const userId = req.user.id; // issu du token JWT (authenticate)

    // ── 1. Validation requestInfo ─────────────────────────────────────────────
    // requestInfo, requestUID, requestDate et userID sont obligatoires pour tracer l'appel
    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      // → errorCode 40001 : requestInfo manquant ou incomplet
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    // ── 2. Validation transactionId ──────────────────────────────────────────
    // transactionId obligatoire : on ne peut pas déclarer un litige sans cibler une transaction
    if (!transactionId || typeof transactionId !== 'string') {
      // → errorCode 40010 : transactionId manquant
      throw new AppError('Missing transactionId', 400, '40010');
    }

    // ── 3. Validation reason ─────────────────────────────────────────────────
    // reason obligatoire et doit être une des 9 valeurs autorisées par la CHECK SQL
    if (!reason || !VALID_REASONS.includes(reason)) {
      // → errorCode 40011 : motif manquant ou invalide
      throw new AppError('Missing or invalid reason', 400, '40011');
    }

    // ── 4. Validation description ────────────────────────────────────────────
    // description obligatoire et non vide : le client doit expliquer pourquoi il conteste
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      // → errorCode 40012 : description manquante ou vide
      throw new AppError('Missing or invalid description', 400, '40012');
    }

    // ── 5. Validation claimAmount ────────────────────────────────────────────
    // claimAmount obligatoire et strictement positif (on ne conteste pas un montant nul ou négatif)
    if (claimAmount === undefined || claimAmount === null || typeof claimAmount !== 'number' || claimAmount <= 0) {
      // → errorCode 40013 : claimAmount manquant, nul ou négatif
      throw new AppError('Invalid claimAmount', 400, '40013');
    }

    // ── 6. Validation currency ───────────────────────────────────────────────
    // currency obligatoire (ex: USD, EUR) pour savoir dans quelle devise le montant est exprimé
    if (!currency || typeof currency !== 'string' || currency.trim().length === 0) {
      // → errorCode 40014 : currency manquante ou invalide
      throw new AppError('Missing or invalid currency', 400, '40014');
    }

    // ── 7. Vérification de la transaction ─────────────────────────────────────
    // La transaction doit exister ET appartenir au client authentifié (req.user.id du JWT)
    const transaction = await disputeService.findTransactionById(transactionId);

    if (!transaction) {
      // → errorCode 40401 : transaction introuvable en base
      throw new AppError('Transaction not found', 404, '40401');
    }

    // On compare avec l'ID du token JWT, pas avec requestInfo.userID (qui pourrait être falsifié)
    if (transaction.userId !== userId) {
      // → errorCode 40301 : la transaction existe mais n'appartient pas à ce client
      throw new AppError('Access denied to this transaction', 403, '40301');
    }

    // ── 8. Vérification des litiges actifs existants ─────────────────────────
    // On ne peut pas créer un litige sur une transaction qui en a déjà un actif
    // (statut différent de REJECTED ou CLOSED = litige toujours en cours)
    const activeDispute = await disputeService.findActiveDisputeByTransactionId(transactionId);

    if (activeDispute) {
      // → errorCode 40901 : conflit — un litige actif existe déjà sur cette transaction
      throw new AppError('An active dispute already exists for this transaction', 409, '40901');
    }

    // ── 9. Création du litige (transaction SQL) ──────────────────────────────
    const result = await disputeService.createDispute({
      transactionId,
      reason,
      description,
      claimAmount,
      currency,
      userId,
    });

    return res.status(201).json(successResponse({
      disputeId: result.disputeId,
      transactionId: result.transactionId,
      status: result.status,
      createdAt: result.createdAt,
    }));
  } catch (err) {
    // On transmet l'erreur au middleware errorHandler via next()
    // Les AppError sont déjà formatées ; les erreurs imprévues seront catchées par errorHandler
    next(err);
  }
}

// ─── Liste des statuts valides pour le filtre ────────────────────────────────
const VALID_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'WAITING_FOR_INFORMATION',
  'APPROVED',
  'REJECTED',
  'CHARGEBACK_INITIATED',
  'MERCHANT_RESPONSE_RECEIVED',
  'REFUND_COMPLETED',
  'CLOSED',
];

// GET /disputes
// Retourne la liste des litiges selon le rôle de l'utilisateur :
//   CLIENT   → uniquement les litiges liés à ses transactions
//   OPERATOR → tous les litiges sans restriction
// Supporte les filtres optionnels : status (ou "ALL"), startDate, endDate.
async function getDisputes(req, res, next) {
  try {
    const { requestInfo, status, startDate, endDate } = req.body;
    const { role, id: userId } = req.user; // issus du token JWT (authenticate)

    // ── 1. Validation requestInfo ─────────────────────────────────────────────
    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    // ── 2. Validation du filtre status ────────────────────────────────────────
    // "ALL" ou absent → pas de filtre ; sinon doit être un statut valide parmi les 9 du CDC
    const statusFilter = status || 'ALL';
    if (statusFilter !== 'ALL' && !VALID_STATUSES.includes(statusFilter)) {
      // → errorCode 40020 : valeur de status invalide (ni "ALL" ni un statut autorisé)
      throw new AppError('Invalid status value', 400, '40020');
    }

    // ── 3. Validation optionnelle des dates ───────────────────────────────────
    // Mêmes règles que GET /transactions : format YYYY-MM-DD, startDate <= endDate
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

    // ── 4. Récupération des litiges ───────────────────────────────────────────
    // Le service construit dynamiquement la requête SQL selon le rôle et les filtres
    const disputes = await disputeService.getDisputes({
      role,
      userId,
      status: statusFilter,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    return res.status(200).json(successResponse(disputes));
  } catch (err) {
    next(err);
  }
}

module.exports = { createDispute, getDisputes };
