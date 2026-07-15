const disputeService = require('../services/disputeService');
const { successResponse } = require('../utils/responseBuilder');
const AppError = require('../utils/AppError');

async function assertDisputeAccess(disputeId, user) {
  const dispute = await disputeService.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');
  if (user.role === 'CLIENT' && dispute.client_id !== user.id) {
    throw new AppError('Access denied', 403, '40300');
  }
  return dispute;
}

const VALID_REASONS = [
  'UNAUTHORIZED_TRANSACTION', 'DOUBLE_CHARGE', 'GOODS_NOT_RECEIVED',
  'SERVICE_NOT_PROVIDED', 'INCORRECT_AMOUNT', 'CANCELLED_RECURRING_PAYMENT',
  'FRAUD', 'ATM_CASH_NOT_DISPENSED', 'OTHER',
];

async function createDispute(req, res, next) {
  try {
    const { requestInfo, transactionId, reason, description, claimAmount, currency } = req.body;
    const userId = req.user.id;

    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }
    if (!transactionId || typeof transactionId !== 'string') throw new AppError('Missing transactionId', 400, '40010');
    if (!reason || !VALID_REASONS.includes(reason)) throw new AppError('Missing or invalid reason', 400, '40011');
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw new AppError('Missing or invalid description', 400, '40012');
    }
    if (claimAmount === undefined || claimAmount === null || typeof claimAmount !== 'number' || claimAmount <= 0) {
      throw new AppError('Invalid claimAmount', 400, '40013');
    }
    if (!currency || typeof currency !== 'string' || currency.trim().length === 0) {
      throw new AppError('Missing or invalid currency', 400, '40014');
    }

    const transaction = await disputeService.findTransactionById(transactionId);
    if (!transaction) throw new AppError('Transaction not found', 404, '40401');
    if (transaction.client_id !== userId) throw new AppError('Access denied to this transaction', 403, '40301');

    const activeDispute = await disputeService.findActiveDisputeByTransactionId(transactionId);
    if (activeDispute) throw new AppError('An active dispute already exists for this transaction', 409, '40901');

    const result = await disputeService.createDispute({ transactionId, reason, description, claimAmount, currency, userId });

    return res.status(201).json(successResponse({
      dispute_id: result.dispute_id,
      transaction_id: result.transaction_id,
      status: result.status,
      created_at: result.created_at,
    }));
  } catch (err) {
    next(err);
  }
}

const VALID_STATUSES = [
  'SOUMIS', 'EN_COURS_D_ANALYSE', 'EN_ATTENTE_D_INFORMATIONS', 'APPROUVE',
  'REJETE', 'CHARGEBACK_INITIE', 'REMBOURSEMENT_EFFECTUE', 'CLOTURE',
];

async function getDisputes(req, res, next) {
  try {
    const source = req.method === 'GET' && Object.keys(req.body || {}).length === 0 ? req.query : { ...req.query, ...req.body };
    const { requestInfo, status, startDate, endDate } = source;
    const { role, id: userId } = req.user;

    if (requestInfo && (!requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID)) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }

    const statusFilter = status || 'ALL';
    if (statusFilter !== 'ALL' && !VALID_STATUSES.includes(statusFilter)) {
      throw new AppError('Invalid status value', 400, '40020');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) throw new AppError('Invalid date format', 400, '40003');
    if (endDate && !dateRegex.test(endDate)) throw new AppError('Invalid date format', 400, '40003');
    if (startDate && endDate && startDate > endDate) throw new AppError('startDate must be before endDate', 400, '40004');

    const disputes = await disputeService.getDisputes({
      role, userId, status: statusFilter, startDate: startDate || null, endDate: endDate || null,
    });

    return res.status(200).json(successResponse(disputes));
  } catch (err) {
    next(err);
  }
}

async function respondToInfoRequest(req, res, next) {
  try {
    const { id } = req.params;
    const comment = req.body.comment || req.body.message;

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new AppError('Comment is required', 400, '40080');
    }

    const dispute = await assertDisputeAccess(id, req.user);
    if (dispute.status !== 'EN_ATTENTE_D_INFORMATIONS') {
      throw new AppError('Dispute must be EN_ATTENTE_D_INFORMATIONS', 409, '40908');
    }

    const result = await disputeService.respondToInfoRequest(id, req.user.id, comment.trim());
    return res.status(200).json(successResponse({
      dispute_id: result.dispute_id, status: result.status, responded_by: req.user.id, respond_date: result.respond_date,
    }));
  } catch (err) { next(err); }
}

async function getDisputeHistory(req, res, next) {
  try {
    const { id } = req.params;
    await assertDisputeAccess(id, req.user);
    const history = await disputeService.getDisputeHistory(id);
    return res.status(200).json(successResponse(history));
  } catch (err) { next(err); }
}

async function getDisputeComments(req, res, next) {
  try {
    const { id } = req.params;
    await assertDisputeAccess(id, req.user);
    const comments = await disputeService.getDisputeComments(id);
    return res.status(200).json(successResponse(comments));
  } catch (err) { next(err); }
}

async function getDisputeDocuments(req, res, next) {
  try {
    const { id } = req.params;
    await assertDisputeAccess(id, req.user);
    const documents = await disputeService.getDisputeDocuments(id);
    return res.status(200).json(successResponse(documents));
  } catch (err) { next(err); }
}

async function uploadDisputeDocument(req, res, next) {
  try {
    const { id } = req.params;
    const { fileName, fileType, fileContent } = req.body;

    if (!fileName || typeof fileName !== 'string') throw new AppError('Missing fileName', 400, '40070');
    if (!fileType || typeof fileType !== 'string') throw new AppError('Missing fileType', 400, '40071');
    if (!fileContent || typeof fileContent !== 'string') throw new AppError('Missing fileContent', 400, '40072');

    await assertDisputeAccess(id, req.user);
    const doc = await disputeService.createDocument(id, req.user.id, { fileName, fileType, fileContent });
    return res.status(201).json(successResponse(doc));
  } catch (err) { next(err); }
}

async function getDocumentContent(req, res, next) {
  try {
    const { documentId } = req.params;
    const doc = await disputeService.getDocumentContent(documentId);
    if (!doc) throw new AppError('Document not found', 404, '40403');

    await assertDisputeAccess(doc.dispute_id, req.user);
    return res.status(200).json(successResponse(doc));
  } catch (err) { next(err); }
}

async function getDisputeById(req, res, next) {
  try {
    const { id } = req.params;
    const dispute = await assertDisputeAccess(id, req.user);
    return res.status(200).json(successResponse({
      dispute_id: dispute.id,
      transaction_id: dispute.transaction_id,
      client_id: dispute.client_id,
      status: dispute.status,
      amount: dispute.amount,
      currency: dispute.currency,
    }));
  } catch (err) { next(err); }
}

module.exports = {
  createDispute, getDisputes, getDisputeById, respondToInfoRequest,
  getDisputeHistory, getDisputeComments, getDisputeDocuments, uploadDisputeDocument, getDocumentContent,
};
