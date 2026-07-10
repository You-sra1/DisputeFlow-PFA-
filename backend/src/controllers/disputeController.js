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
    // Supporte body ET query params (le frontend envoie body avec fetch même en GET)
    const source = req.method === 'GET' && Object.keys(req.body || {}).length === 0 ? req.query : { ...req.query, ...req.body };
    const { requestInfo, status, startDate, endDate } = source;
    const { role, id: userId } = req.user; // issus du token JWT (authenticate)

    // ── 1. Validation requestInfo (only for non-GET or when explicitly provided) ──
    if (requestInfo && (!requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID)) {
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

// ─── PRISE EN CHARGE D'UN LITIGE ─────────────────────────────────────────────

// PUT /review
// Permet à un OPERATOR de passer un litige de SUBMITTED à UNDER_REVIEW.
// Valide requestInfo, disputeId et comment, puis délègue la logique métier.
async function review(req, res, next) {
  try {
    const { requestInfo, disputeId, comment } = req.body;
    const operatorId = req.user.id; // issu du token JWT (authenticate)

    // ── 1. Validation requestInfo ─────────────────────────────────────────────
    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    // ── 2. Validation disputeId ──────────────────────────────────────────────
    // disputeId obligatoire : on ne peut pas prendre en charge un litige sans son identifiant
    if (!disputeId || typeof disputeId !== 'string') {
      throw new AppError('Missing disputeId', 400, '40030');
    }

    // ── 3. Validation comment ────────────────────────────────────────────────
    // comment obligatoire : l'opérateur doit justifier la prise en charge
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new AppError('Missing comment', 400, '40031');
    }

    // ── 4. Appel du service ──────────────────────────────────────────────────
    const result = await disputeService.reviewDispute(disputeId, operatorId, comment);

    return res.status(200).json(successResponse({
      disputeId: result.disputeId,
      status: result.status,
      reviewedBy: result.reviewedBy,
      reviewDate: result.reviewDate,
    }));
  } catch (err) {
    next(err);
  }
}

// ─── DEMANDE D'INFORMATIONS COMPLÉMENTAIRES ─────────────────────────────────

// PUT /request-info
// Permet à un OPERATOR de passer un litige de UNDER_REVIEW à WAITING_FOR_INFORMATION.
// Valide requestInfo, disputeId et message, puis délègue la logique métier.
async function requestInfo(req, res, next) {
  try {
    const { requestInfo, disputeId, message, comment } = req.body;
    const operatorId = req.user.id; // issu du token JWT (authenticate)

    // ── 1. Validation requestInfo ─────────────────────────────────────────────
    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    // ── 2. Validation disputeId ──────────────────────────────────────────────
    // disputeId obligatoire : on ne peut pas demander d'infos sans cibler un litige
    if (!disputeId || typeof disputeId !== 'string') {
      throw new AppError('Missing disputeId', 400, '40030');
    }

    // ── 3. Validation message ────────────────────────────────────────────────
    // message obligatoire : l'opérateur doit préciser quelles informations sont demandées
    // Accepte "message" ou "comment" (le frontend envoie "comment")
    const effectiveMessage = message || comment;
    if (!effectiveMessage || typeof effectiveMessage !== 'string' || effectiveMessage.trim().length === 0) {
      throw new AppError('Missing message', 400, '40033');
    }

    // ── 4. Appel du service ──────────────────────────────────────────────────
    const result = await disputeService.requestInfo(disputeId, operatorId, effectiveMessage);

    return res.status(200).json(successResponse({
      disputeId: result.disputeId,
      status: result.status,
      requestedInformation: result.requestedInformation,
    }));
  } catch (err) {
    next(err);
  }
}

// ─── APPROBATION D'UN LITIGE ─────────────────────────────────────────────────

// PUT /approve
// Permet à un OPERATOR d'approuver un litige (UNDER_REVIEW/WAITING → APPROVED).
// Valide requestInfo, disputeId et comment, puis délègue la logique métier.
async function approve(req, res, next) {
  try {
    const { requestInfo, disputeId, comment } = req.body;
    const operatorId = req.user.id; // issu du token JWT (authenticate)

    // ── 1. Validation requestInfo ─────────────────────────────────────────────
    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    // ── 2. Validation disputeId ──────────────────────────────────────────────
    // disputeId obligatoire : on ne peut pas approuver un litige sans son identifiant
    if (!disputeId || typeof disputeId !== 'string') {
      throw new AppError('Missing disputeId', 400, '40030');
    }

    // ── 3. Validation comment ────────────────────────────────────────────────
    // comment obligatoire : l'opérateur doit justifier l'approbation
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new AppError('Missing comment', 400, '40031');
    }

    // ── 4. Appel du service ──────────────────────────────────────────────────
    const result = await disputeService.approveDispute(disputeId, operatorId, comment);

    return res.status(200).json(successResponse({
      disputeId: result.disputeId,
      status: result.status,
      approvedBy: result.approvedBy,
    }));
  } catch (err) {
    next(err);
  }
}

// ─── REJET D'UN LITIGE ───────────────────────────────────────────────────────

// PUT /reject
// Permet à un OPERATOR de rejeter un litige (UNDER_REVIEW/WAITING → REJECTED).
// Valide requestInfo, disputeId, reason et comment (optionnel), puis délègue.
async function reject(req, res, next) {
  try {
    const { requestInfo, disputeId, reason, comment } = req.body;
    const operatorId = req.user.id; // issu du token JWT (authenticate)

    // ── 1. Validation requestInfo ─────────────────────────────────────────────
    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    // ── 2. Validation disputeId ──────────────────────────────────────────────
    // disputeId obligatoire : on ne peut pas rejeter un litige sans son identifiant
    if (!disputeId || typeof disputeId !== 'string') {
      throw new AppError('Missing disputeId', 400, '40030');
    }

    // ── 3. Validation reason ─────────────────────────────────────────────────
    // reason obligatoire : l'opérateur doit fournir le motif du rejet
    // Fallback : si reason n'est pas fourni, on utilise comment (le frontend envoie "comment")
    const effectiveReason = reason || comment;
    if (!effectiveReason || typeof effectiveReason !== 'string' || effectiveReason.trim().length === 0) {
      throw new AppError('Missing reason', 400, '40032');
    }

    // ── 4. comment est optionnel ─────────────────────────────────────────────
    // Si présent, on le passe au service ; sinon undefined

    // ── 5. Appel du service ──────────────────────────────────────────────────
    const result = await disputeService.rejectDispute(disputeId, operatorId, effectiveReason, comment || '');

    return res.status(200).json(successResponse({
      disputeId: result.disputeId,
      status: result.status,
      reason: result.reason,
    }));
  } catch (err) {
    next(err);
  }
}

// ─── INITIATION D'UN CHARGEBACK ────────────────────────────────────────────────

// PUT /chargeback
// Permet à un OPERATOR de lancer la procédure de chargeback sur un litige
// approuvé (APPROVED → CHARGEBACK_INITIATED).
// Valide requestInfo, disputeId, chargebackReasonCode, network, comment.
async function chargeback(req, res, next) {
  try {
    const { requestInfo, disputeId, chargebackReasonCode, network, comment } = req.body;
    const operatorId = req.user.id;

    // ── 1. Validation requestInfo ─────────────────────────────────────────────
    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    // ── 2. Validation disputeId ──────────────────────────────────────────────
    if (!disputeId || typeof disputeId !== 'string') {
      throw new AppError('Missing disputeId', 400, '40030');
    }

    // ── 3. Validation chargebackReasonCode ────────────────────────────────────
    // chargebackReasonCode obligatoire : code motif chargeback fourni par l'opérateur (ex: "4837")
    if (!chargebackReasonCode || typeof chargebackReasonCode !== 'string') {
      throw new AppError('Missing chargebackReasonCode', 400, '40040');
    }

    // ── 4. Validation network ─────────────────────────────────────────────────
    // network obligatoire, doit être "Visa" ou "Mastercard" (validé plus finement dans le service)
    if (!network || typeof network !== 'string') {
      throw new AppError('Invalid network, must be Visa or Mastercard', 400, '40041');
    }

    // ── 5. comment est optionnel ──────────────────────────────────────────────
    // Si non fourni, on passe une chaîne vide au service
    const safeComment = comment || '';

    // ── 6. Appel du service ───────────────────────────────────────────────────
    const result = await disputeService.chargebackDispute(
      disputeId, operatorId, chargebackReasonCode, network, safeComment
    );

    return res.status(200).json(successResponse({
      disputeId: result.disputeId,
      status: result.status,
      chargebackReference: result.chargebackReference,
    }));
  } catch (err) {
    next(err);
  }
}

// ─── REMBOURSEMENT APRÈS CHARGEBACK ────────────────────────────────────────────

// PUT /refund
// Permet à un OPERATOR de finaliser un chargeback par un remboursement
// (CHARGEBACK_INITIATED → REFUND_COMPLETED).
// Valide requestInfo, disputeId, refundAmount, currency, refundMethod.
async function refund(req, res, next) {
  try {
    const { requestInfo, disputeId, refundAmount, currency, refundMethod } = req.body;
    const operatorId = req.user.id;

    // ── 1. Validation requestInfo ─────────────────────────────────────────────
    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    // ── 2. Validation disputeId ──────────────────────────────────────────────
    if (!disputeId || typeof disputeId !== 'string') {
      throw new AppError('Missing disputeId', 400, '40030');
    }

    // ── 3. Validation refundAmount ────────────────────────────────────────────
    // refundAmount obligatoire : nombre strictement positif, sinon on rejette
    if (refundAmount === undefined || refundAmount === null || typeof refundAmount !== 'number' || refundAmount <= 0) {
      throw new AppError('Invalid refundAmount', 400, '40050');
    }

    // ── 4. Validation currency ────────────────────────────────────────────────
    // currency obligatoire : sera comparée à la devise du litige dans le service
    if (!currency || typeof currency !== 'string') {
      throw new AppError('Invalid or mismatched currency', 400, '40052');
    }

    // ── 5. Validation refundMethod ────────────────────────────────────────────
    // refundMethod obligatoire : "CARD_CREDIT" ou "BANK_TRANSFER"
    const allowedMethods = ['CARD_CREDIT', 'BANK_TRANSFER'];
    if (!refundMethod || !allowedMethods.includes(refundMethod)) {
      throw new AppError('Invalid refundMethod', 400, '40053');
    }

    // ── 6. Appel du service ───────────────────────────────────────────────────
    const result = await disputeService.refundDispute(
      disputeId, operatorId, refundAmount, currency, refundMethod
    );

    return res.status(200).json(successResponse({
      disputeId: result.disputeId,
      status: result.status,
      refundAmount: result.refundAmount,
      currency: result.currency,
    }));
  } catch (err) {
    next(err);
  }
}

// ─── CLÔTURE D'UN DOSSIER DE LITIGE ────────────────────────────────────────────

// PUT /close
// Permet à un OPERATOR de clôturer définitivement un dossier de litige
// (REJECTED → CLOSED ou REFUND_COMPLETED → CLOSED).
// Valide requestInfo, disputeId, closureReason, comment.
async function close(req, res, next) {
  try {
    const { requestInfo, disputeId, closureReason, comment } = req.body;
    const operatorId = req.user.id;

    // ── 1. Validation requestInfo ─────────────────────────────────────────────
    // requestInfo obligatoire : traçabilité de l'appel côté client
    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    // ── 2. Validation disputeId ──────────────────────────────────────────────
    // disputeId obligatoire : on ne peut pas clôturer sans identifiant
    if (!disputeId || typeof disputeId !== 'string') {
      throw new AppError('Missing disputeId', 400, '40030');
    }

    // ── 3. Validation closureReason ──────────────────────────────────────────
    // closureReason obligatoire : motif de clôture parmi les 4 valeurs autorisées
    // (CASE_RESOLVED, REJECTED_FINAL, REFUND_ISSUED, OTHER)
    const validClosureReasons = ['CASE_RESOLVED', 'REJECTED_FINAL', 'REFUND_ISSUED', 'OTHER'];
    if (!closureReason || !validClosureReasons.includes(closureReason)) {
      throw new AppError('Missing or invalid closureReason', 400, '40060');
    }

    // ── 4. Validation comment ─────────────────────────────────────────────────
    // comment obligatoire : l'opérateur doit justifier la clôture
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new AppError('Missing comment', 400, '40031');
    }

    // ── 5. Appel du service ───────────────────────────────────────────────────
    const result = await disputeService.closeDispute(disputeId, operatorId, closureReason, comment);

    return res.status(200).json(successResponse({
      disputeId: result.disputeId,
      status: result.status,
      closedDate: result.closedDate,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = { createDispute, getDisputes, review, requestInfo, approve, reject, chargeback, refund, close };
