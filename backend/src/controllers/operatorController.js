const disputeService = require('../services/disputeService');
const { successResponse } = require('../utils/responseBuilder');
const AppError = require('../utils/AppError');

function validateRequestInfo(requestInfo) {
  if (!requestInfo || !requestInfo.requestUID || !requestInfo.requestDate || !requestInfo.userID) {
    throw new AppError('Missing or invalid requestInfo', 400, '40001');
  }
}

async function review(req, res, next) {
  try {
    const { id } = req.params;
    const { requestInfo, comment } = req.body;
    const operatorId = req.user.id;

    validateRequestInfo(requestInfo);
    if (!id) throw new AppError('Missing dispute ID', 400, '40030');
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new AppError('Missing comment', 400, '40031');
    }

    const result = await disputeService.reviewDispute(id, operatorId, comment);
    return res.status(200).json(successResponse({
      dispute_id: result.dispute_id, status: result.status, reviewed_by: result.reviewed_by, review_date: result.review_date,
    }));
  } catch (err) { next(err); }
}

async function requestInfo(req, res, next) {
  try {
    const { id } = req.params;
    const { requestInfo, message, comment } = req.body;
    const operatorId = req.user.id;

    validateRequestInfo(requestInfo);
    if (!id) throw new AppError('Missing dispute ID', 400, '40030');

    const effectiveMessage = message || comment;
    if (!effectiveMessage || typeof effectiveMessage !== 'string' || effectiveMessage.trim().length === 0) {
      throw new AppError('Missing message', 400, '40033');
    }

    const result = await disputeService.requestInfo(id, operatorId, effectiveMessage);
    return res.status(200).json(successResponse({
      dispute_id: result.dispute_id, status: result.status, requested_information: result.requested_information,
    }));
  } catch (err) { next(err); }
}

async function approve(req, res, next) {
  try {
    const { id } = req.params;
    const { requestInfo, comment } = req.body;
    const operatorId = req.user.id;

    validateRequestInfo(requestInfo);
    if (!id) throw new AppError('Missing dispute ID', 400, '40030');
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new AppError('Missing comment', 400, '40031');
    }

    const result = await disputeService.approveDispute(id, operatorId, comment);
    return res.status(200).json(successResponse({
      dispute_id: result.dispute_id, status: result.status, approved_by: result.approved_by,
    }));
  } catch (err) { next(err); }
}

async function reject(req, res, next) {
  try {
    const { id } = req.params;
    const { requestInfo, reason, comment } = req.body;
    const operatorId = req.user.id;

    validateRequestInfo(requestInfo);
    if (!id) throw new AppError('Missing dispute ID', 400, '40030');

    const effectiveReason = reason || comment;
    if (!effectiveReason || typeof effectiveReason !== 'string' || effectiveReason.trim().length === 0) {
      throw new AppError('Missing reason', 400, '40032');
    }

    const result = await disputeService.rejectDispute(id, operatorId, effectiveReason, comment || '');
    return res.status(200).json(successResponse({
      dispute_id: result.dispute_id, status: result.status, reason: result.reason,
    }));
  } catch (err) { next(err); }
}

async function chargeback(req, res, next) {
  try {
    const { id } = req.params;
    const { requestInfo, chargebackReasonCode, network, comment } = req.body;
    const operatorId = req.user.id;

    validateRequestInfo(requestInfo);
    if (!id) throw new AppError('Missing dispute ID', 400, '40030');
    if (!chargebackReasonCode || typeof chargebackReasonCode !== 'string') {
      throw new AppError('Missing chargebackReasonCode', 400, '40040');
    }
    if (!network || typeof network !== 'string') {
      throw new AppError('Invalid network, must be Visa or Mastercard', 400, '40041');
    }

    const result = await disputeService.chargebackDispute(id, operatorId, chargebackReasonCode, network, comment || '');
    return res.status(200).json(successResponse({
      dispute_id: result.dispute_id, status: result.status, chargeback_reference: result.chargeback_reference,
    }));
  } catch (err) { next(err); }
}

async function refund(req, res, next) {
  try {
    const { id } = req.params;
    const { requestInfo, refundAmount, currency, refundMethod } = req.body;
    const operatorId = req.user.id;

    validateRequestInfo(requestInfo);
    if (!id) throw new AppError('Missing dispute ID', 400, '40030');
    if (refundAmount === undefined || refundAmount === null || typeof refundAmount !== 'number' || refundAmount <= 0) {
      throw new AppError('Invalid refundAmount', 400, '40050');
    }
    if (!currency || typeof currency !== 'string') throw new AppError('Invalid or mismatched currency', 400, '40052');

    const allowedMethods = ['CARD_CREDIT', 'BANK_TRANSFER'];
    if (!refundMethod || !allowedMethods.includes(refundMethod)) {
      throw new AppError('Invalid refundMethod', 400, '40053');
    }

    const result = await disputeService.refundDispute(id, operatorId, refundAmount, currency, refundMethod);
    return res.status(200).json(successResponse({
      dispute_id: result.dispute_id, status: result.status, refund_amount: result.refund_amount, currency: result.currency,
    }));
  } catch (err) { next(err); }
}

async function close(req, res, next) {
  try {
    const { id } = req.params;
    const { requestInfo, closureReason, comment } = req.body;
    const operatorId = req.user.id;

    validateRequestInfo(requestInfo);
    if (!id) throw new AppError('Missing dispute ID', 400, '40030');

    const validClosureReasons = ['CASE_RESOLVED', 'REJECTED_FINAL', 'REFUND_ISSUED', 'OTHER'];
    if (!closureReason || !validClosureReasons.includes(closureReason)) {
      throw new AppError('Missing or invalid closureReason', 400, '40060');
    }
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new AppError('Missing comment', 400, '40031');
    }

    const result = await disputeService.closeDispute(id, operatorId, closureReason, comment);
    return res.status(200).json(successResponse({
      dispute_id: result.dispute_id, status: result.status, closed_date: result.closed_date,
    }));
  } catch (err) { next(err); }
}

module.exports = { review, requestInfo, approve, reject, chargeback, refund, close };
