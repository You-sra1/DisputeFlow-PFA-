const disputeService = require('../services/disputeService');
const { successResponse } = require('../utils/responseBuilder');
const AppError = require('../utils/AppError');

async function assertDisputeAccess(disputeId, user) {
  const dispute = await disputeService.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');
  if (user.role === 'CLIENT' && dispute.userId !== user.id) {
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
    if (!transactionId || typeof transactionId !== 'string') {
      throw new AppError('Missing transactionId', 400, '40010');
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      throw new AppError('Missing or invalid reason', 400, '40011');
    }
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
    if (transaction.userId !== userId) throw new AppError('Access denied to this transaction', 403, '40301');

    const activeDispute = await disputeService.findActiveDisputeByTransactionId(transactionId);
    if (activeDispute) throw new AppError('An active dispute already exists for this transaction', 409, '40901');

    const result = await disputeService.createDispute({ transactionId, reason, description, claimAmount, currency, userId });

    return res.status(201).json(successResponse({
      disputeId: result.disputeId,
      transactionId: result.transactionId,
      status: result.status,
      createdAt: result.createdAt,
    }));
  } catch (err) {
    next(err);
  }
}

const VALID_STATUSES = [
  'SUBMITTED', 'UNDER_REVIEW', 'WAITING_FOR_INFORMATION', 'APPROVED',
  'REJECTED', 'CHARGEBACK_INITIATED', 'MERCHANT_RESPONSE_RECEIVED',
  'REFUND_COMPLETED', 'CLOSED',
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

async function review(req, res, next) {
  try {
    const { requestInfo, disputeId, comment } = req.body;
    const operatorId = req.user.id;

    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }
    if (!disputeId || typeof disputeId !== 'string') throw new AppError('Missing disputeId', 400, '40030');
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) throw new AppError('Missing comment', 400, '40031');

    const result = await disputeService.reviewDispute(disputeId, operatorId, comment);
    return res.status(200).json(successResponse({
      disputeId: result.disputeId, status: result.status, reviewedBy: result.reviewedBy, reviewDate: result.reviewDate,
    }));
  } catch (err) { next(err); }
}

async function requestInfo(req, res, next) {
  try {
    const { requestInfo, disputeId, message, comment } = req.body;
    const operatorId = req.user.id;

    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }
    if (!disputeId || typeof disputeId !== 'string') throw new AppError('Missing disputeId', 400, '40030');

    const effectiveMessage = message || comment;
    if (!effectiveMessage || typeof effectiveMessage !== 'string' || effectiveMessage.trim().length === 0) {
      throw new AppError('Missing message', 400, '40033');
    }

    const result = await disputeService.requestInfo(disputeId, operatorId, effectiveMessage);
    return res.status(200).json(successResponse({
      disputeId: result.disputeId, status: result.status, requestedInformation: result.requestedInformation,
    }));
  } catch (err) { next(err); }
}

async function approve(req, res, next) {
  try {
    const { requestInfo, disputeId, comment } = req.body;
    const operatorId = req.user.id;

    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }
    if (!disputeId || typeof disputeId !== 'string') throw new AppError('Missing disputeId', 400, '40030');
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) throw new AppError('Missing comment', 400, '40031');

    const result = await disputeService.approveDispute(disputeId, operatorId, comment);
    return res.status(200).json(successResponse({
      disputeId: result.disputeId, status: result.status, approvedBy: result.approvedBy,
    }));
  } catch (err) { next(err); }
}

async function reject(req, res, next) {
  try {
    const { requestInfo, disputeId, reason, comment } = req.body;
    const operatorId = req.user.id;

    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }
    if (!disputeId || typeof disputeId !== 'string') throw new AppError('Missing disputeId', 400, '40030');

    const effectiveReason = reason || comment;
    if (!effectiveReason || typeof effectiveReason !== 'string' || effectiveReason.trim().length === 0) {
      throw new AppError('Missing reason', 400, '40032');
    }

    const result = await disputeService.rejectDispute(disputeId, operatorId, effectiveReason, comment || '');
    return res.status(200).json(successResponse({
      disputeId: result.disputeId, status: result.status, reason: result.reason,
    }));
  } catch (err) { next(err); }
}

async function chargeback(req, res, next) {
  try {
    const { requestInfo, disputeId, chargebackReasonCode, network, comment } = req.body;
    const operatorId = req.user.id;

    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }
    if (!disputeId || typeof disputeId !== 'string') throw new AppError('Missing disputeId', 400, '40030');
    if (!chargebackReasonCode || typeof chargebackReasonCode !== 'string') throw new AppError('Missing chargebackReasonCode', 400, '40040');
    if (!network || typeof network !== 'string') throw new AppError('Invalid network, must be Visa or Mastercard', 400, '40041');

    const result = await disputeService.chargebackDispute(disputeId, operatorId, chargebackReasonCode, network, comment || '');
    return res.status(200).json(successResponse({
      disputeId: result.disputeId, status: result.status, chargebackReference: result.chargebackReference,
    }));
  } catch (err) { next(err); }
}

async function refund(req, res, next) {
  try {
    const { requestInfo, disputeId, refundAmount, currency, refundMethod } = req.body;
    const operatorId = req.user.id;

    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }
    if (!disputeId || typeof disputeId !== 'string') throw new AppError('Missing disputeId', 400, '40030');
    if (refundAmount === undefined || refundAmount === null || typeof refundAmount !== 'number' || refundAmount <= 0) {
      throw new AppError('Invalid refundAmount', 400, '40050');
    }
    if (!currency || typeof currency !== 'string') throw new AppError('Invalid or mismatched currency', 400, '40052');

    const allowedMethods = ['CARD_CREDIT', 'BANK_TRANSFER'];
    if (!refundMethod || !allowedMethods.includes(refundMethod)) throw new AppError('Invalid refundMethod', 400, '40053');

    const result = await disputeService.refundDispute(disputeId, operatorId, refundAmount, currency, refundMethod);
    return res.status(200).json(successResponse({
      disputeId: result.disputeId, status: result.status, refundAmount: result.refundAmount, currency: result.currency,
    }));
  } catch (err) { next(err); }
}

async function close(req, res, next) {
  try {
    const { requestInfo, disputeId, closureReason, comment } = req.body;
    const operatorId = req.user.id;

    if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
      throw new AppError('Missing or invalid requestInfo', 400, '40001');
    }
    if (!disputeId || typeof disputeId !== 'string') throw new AppError('Missing disputeId', 400, '40030');

    const validClosureReasons = ['CASE_RESOLVED', 'REJECTED_FINAL', 'REFUND_ISSUED', 'OTHER'];
    if (!closureReason || !validClosureReasons.includes(closureReason)) {
      throw new AppError('Missing or invalid closureReason', 400, '40060');
    }
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new AppError('Missing comment', 400, '40031');
    }

    const result = await disputeService.closeDispute(disputeId, operatorId, closureReason, comment);
    return res.status(200).json(successResponse({
      disputeId: result.disputeId, status: result.status, closedDate: result.closedDate,
    }));
  } catch (err) { next(err); }
}

async function respondToInfoRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new AppError('Comment is required', 400, '40080');
    }

    const dispute = await assertDisputeAccess(id, req.user);
    if (dispute.status !== 'WAITING_FOR_INFORMATION') {
      throw new AppError('Dispute must be WAITING_FOR_INFORMATION', 409, '40908');
    }

    const result = await disputeService.respondToInfoRequest(id, req.user.id, comment.trim());
    return res.status(200).json(successResponse({
      disputeId: result.disputeId, status: result.status, respondedBy: req.user.id, respondDate: result.respondDate,
    }));
  } catch (err) { next(err); }
}

module.exports = { createDispute, getDisputes, review, requestInfo, approve, reject, chargeback, refund, close, respondToInfoRequest };
