const { randomUUID } = require('crypto');
const AppError = require('../utils/AppError');
const { recordStatusChange, recordComment } = require('./disputeHistoryService');
const disputeModel = require('../models/disputeModel');

const VALID_TRANSITIONS = {
  SOUMIS:                        ['EN_COURS_D_ANALYSE'],
  EN_COURS_D_ANALYSE:            ['EN_ATTENTE_D_INFORMATIONS', 'APPROUVE', 'REJETE'],
  EN_ATTENTE_D_INFORMATIONS:     ['EN_COURS_D_ANALYSE', 'APPROUVE', 'REJETE'],
  APPROUVE:                      ['CHARGEBACK_INITIE'],
  CHARGEBACK_INITIE:             ['REPONSE_MERCHANT_REÇUE'],
  REPONSE_MERCHANT_REÇUE:         ['REMBOURSEMENT_EFFECTUE'],
  REMBOURSEMENT_EFFECTUE:        ['CLOTURE'],
  REJETE:                        ['CLOTURE'],
  CLOTURE:                       [],
};

function validateTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) throw new AppError(`Unknown status: ${currentStatus}`, 409, '40910');
  if (!allowed.includes(newStatus)) {
    throw new AppError(`Transition from ${currentStatus} to ${newStatus} is not allowed`, 409, '40910');
  }
  return true;
}

function getAllowedTransitions(currentStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) return [];
  return [...allowed];
}

function findTransactionById(transactionId) {
  return disputeModel.findTransactionById(transactionId);
}

function findActiveDisputeByTransactionId(transactionId) {
  return disputeModel.findActiveDisputeByTransactionId(transactionId);
}

function findDisputeById(disputeId) {
  return disputeModel.findDisputeById(disputeId);
}

async function createDispute({ transactionId, reason, description, claimAmount, currency, userId }) {
  const disputeId = await disputeModel.generateDisputeId();
  const now = new Date().toISOString();

  await disputeModel.beginTransaction();
  try {
    await disputeModel.createDisputeRow(disputeId, transactionId, userId, reason, description, claimAmount, currency);
    await disputeModel.createDisputeHistoryRow(randomUUID(), disputeId, null, 'SOUMIS', userId, 'Dispute created');
    await disputeModel.createDisputeCommentRow(randomUUID(), disputeId, userId, description);
    await disputeModel.commit();
    return { dispute_id: disputeId, transaction_id: transactionId, status: 'SOUMIS', created_at: now };
  } catch (err) {
    await disputeModel.rollback();
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function reviewDispute(disputeId, operatorId, comment) {
  const dispute = await disputeModel.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');
  validateTransition(dispute.status, 'EN_COURS_D_ANALYSE');
  const now = new Date().toISOString();

  await disputeModel.beginTransaction();
  try {
    await disputeModel.updateDisputeStatus(disputeId, 'EN_COURS_D_ANALYSE', now);
    await recordStatusChange(disputeId, dispute.status, 'EN_COURS_D_ANALYSE', operatorId, comment);
    await recordComment(disputeId, operatorId, comment);
    await disputeModel.commit();
    return { dispute_id: disputeId, status: 'EN_COURS_D_ANALYSE', reviewed_by: operatorId, review_date: now };
  } catch (err) {
    await disputeModel.rollback();
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function requestInfo(disputeId, operatorId, message) {
  const dispute = await disputeModel.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');
  validateTransition(dispute.status, 'EN_ATTENTE_D_INFORMATIONS');
  const now = new Date().toISOString();

  await disputeModel.beginTransaction();
  try {
    await disputeModel.updateDisputeStatus(disputeId, 'EN_ATTENTE_D_INFORMATIONS', now);
    await recordStatusChange(disputeId, dispute.status, 'EN_ATTENTE_D_INFORMATIONS', operatorId, message);
    await recordComment(disputeId, operatorId, message);
    await disputeModel.commit();
    return { dispute_id: disputeId, status: 'EN_ATTENTE_D_INFORMATIONS', requested_information: message };
  } catch (err) {
    await disputeModel.rollback();
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function approveDispute(disputeId, operatorId, comment) {
  const dispute = await disputeModel.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');
  validateTransition(dispute.status, 'APPROUVE');
  const now = new Date().toISOString();

  await disputeModel.beginTransaction();
  try {
    await disputeModel.updateDisputeStatus(disputeId, 'APPROUVE', now);
    await recordStatusChange(disputeId, dispute.status, 'APPROUVE', operatorId, comment);
    await recordComment(disputeId, operatorId, comment);
    await disputeModel.commit();
    return { dispute_id: disputeId, status: 'APPROUVE', approved_by: operatorId };
  } catch (err) {
    await disputeModel.rollback();
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function rejectDispute(disputeId, operatorId, reason, comment) {
  const dispute = await disputeModel.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');
  validateTransition(dispute.status, 'REJETE');
  const now = new Date().toISOString();
  const historyComment = comment ? `Reason: ${reason} | Comment: ${comment}` : `Reason: ${reason}`;

  await disputeModel.beginTransaction();
  try {
    await disputeModel.updateDisputeStatus(disputeId, 'REJETE', now);
    await recordStatusChange(disputeId, dispute.status, 'REJETE', operatorId, historyComment);
    await recordComment(disputeId, operatorId, comment || reason);
    await disputeModel.commit();
    return { dispute_id: disputeId, status: 'REJETE', reason };
  } catch (err) {
    await disputeModel.rollback();
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function chargebackDispute(disputeId, operatorId, chargebackReasonCode, network, comment) {
  const dispute = await disputeModel.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');

  const currentStatus = dispute.status;
  const newStatus = 'CHARGEBACK_INITIE';
  validateTransition(currentStatus, newStatus);

  const allowedNetworks = ['Visa', 'Mastercard'];
  if (!allowedNetworks.includes(network)) {
    throw new AppError('Invalid network, must be Visa or Mastercard', 400, '40041');
  }

  const chargebackReference = await disputeModel.generateChargebackReference();
  const now = new Date().toISOString();
  const historyComment =
    `Chargeback initiated via ${network} (reason code ${chargebackReasonCode}). ` +
    `Reference: ${chargebackReference}`;

  await disputeModel.beginTransaction();
  try {
    await disputeModel.updateDisputeStatus(disputeId, newStatus, now);
    await recordStatusChange(disputeId, currentStatus, newStatus, operatorId, historyComment);
    await recordComment(disputeId, operatorId, comment);
    await disputeModel.commit();
    return { dispute_id: disputeId, status: newStatus, chargeback_reference: chargebackReference };
  } catch (err) {
    await disputeModel.rollback();
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function merchantResponse(disputeId, operatorId, merchantDecision, comment) {
  const dispute = await disputeModel.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');

  const currentStatus = dispute.status;
  const newStatus = 'REPONSE_MERCHANT_REÇUE';
  validateTransition(currentStatus, newStatus);

  const allowedDecisions = ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED'];
  if (!allowedDecisions.includes(merchantDecision)) {
    throw new AppError('Invalid merchantDecision, must be ACCEPTED, PARTIALLY_ACCEPTED, or REJECTED', 400, '40045');
  }

  const now = new Date().toISOString();
  const historyComment = `Merchant response received: ${merchantDecision}${comment ? ` — ${comment}` : ''}`;

  await disputeModel.beginTransaction();
  try {
    await disputeModel.updateDisputeStatus(disputeId, newStatus, now);
    await recordStatusChange(disputeId, currentStatus, newStatus, operatorId, historyComment);
    await recordComment(disputeId, operatorId, historyComment);
    await disputeModel.commit();
    return { dispute_id: disputeId, status: newStatus, merchant_decision: merchantDecision };
  } catch (err) {
    await disputeModel.rollback();
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function refundDispute(disputeId, operatorId, refundAmount, currency, refundMethod) {
  const dispute = await disputeModel.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');

  const currentStatus = dispute.status;
  const newStatus = 'REMBOURSEMENT_EFFECTUE';
  validateTransition(currentStatus, newStatus);

  if (refundAmount === undefined || refundAmount === null || typeof refundAmount !== 'number' || refundAmount <= 0) {
    throw new AppError('Invalid refundAmount', 400, '40050');
  }
  if (refundAmount > dispute.amount) {
    throw new AppError('refundAmount exceeds claim amount', 400, '40051');
  }
  if (currency !== dispute.currency) {
    throw new AppError('Invalid or mismatched currency', 400, '40052');
  }
  const allowedMethods = ['CARD_CREDIT', 'BANK_TRANSFER'];
  if (!allowedMethods.includes(refundMethod)) {
    throw new AppError('Invalid refundMethod', 400, '40053');
  }

  const now = new Date().toISOString();
  const historyComment = `Refund of ${refundAmount} ${currency} via ${refundMethod}`;

  await disputeModel.beginTransaction();
  try {
    await disputeModel.updateDisputeStatus(disputeId, newStatus, now);
    await recordStatusChange(disputeId, currentStatus, newStatus, operatorId, historyComment);
    await disputeModel.commit();
    return { dispute_id: disputeId, status: newStatus, refund_amount: refundAmount, currency };
  } catch (err) {
    await disputeModel.rollback();
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function closeDispute(disputeId, operatorId, closureReason, comment) {
  const dispute = await disputeModel.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');

  const currentStatus = dispute.status;
  const newStatus = 'CLOTURE';
  validateTransition(currentStatus, newStatus);

  const closedDate = new Date().toISOString();
  const historyComment = `Closure reason: ${closureReason} | ${comment}`;

  await disputeModel.beginTransaction();
  try {
    await disputeModel.updateDisputeStatus(disputeId, newStatus, closedDate);
    await recordStatusChange(disputeId, currentStatus, newStatus, operatorId, historyComment);
    await recordComment(disputeId, operatorId, comment);
    await disputeModel.commit();
    return { dispute_id: disputeId, status: newStatus, closed_date: closedDate };
  } catch (err) {
    await disputeModel.rollback();
    throw new AppError('Internal server error', 500, '50000');
  }
}

async function respondToInfoRequest(disputeId, userId, comment) {
  const dispute = await disputeModel.findDisputeById(disputeId);
  if (!dispute) throw new AppError('Dispute not found', 404, '40402');

  if (dispute.status !== 'EN_ATTENTE_D_INFORMATIONS') {
    throw new AppError(
      `Invalid status transition: dispute must be EN_ATTENTE_D_INFORMATIONS, current status is ${dispute.status}`,
      409,
      '40908'
    );
  }

  const now = new Date().toISOString();

  await disputeModel.beginTransaction();
  try {
    await disputeModel.updateDisputeStatus(disputeId, 'EN_COURS_D_ANALYSE', now);
    await recordStatusChange(disputeId, 'EN_ATTENTE_D_INFORMATIONS', 'EN_COURS_D_ANALYSE', userId, 'Client responded to information request');
    await recordComment(disputeId, userId, comment);
    await disputeModel.commit();
    return { dispute_id: disputeId, status: 'EN_COURS_D_ANALYSE', respond_date: now };
  } catch (err) {
    await disputeModel.rollback();
    throw new AppError('Internal server error', 500, '50000');
  }
}

function getDisputes({ role, userId, status, startDate, endDate }) {
  return disputeModel.getDisputesByFilter({ role, userId, status, startDate, endDate });
}

function getDisputeHistory(disputeId) {
  return disputeModel.getDisputeHistory(disputeId);
}

function getDisputeComments(disputeId) {
  return disputeModel.getDisputeComments(disputeId);
}

function getDisputeDocuments(disputeId) {
  return disputeModel.getDisputeDocuments(disputeId);
}

function getDocumentContent(documentId) {
  return disputeModel.getDocumentContent(documentId);
}

function createDocument(disputeId, userId, { fileName, fileType, fileContent }) {
  const docId = randomUUID();
  const filePath = 'base64:inline';
  const fileSize = fileContent ? Math.ceil(fileContent.length * 3 / 4) : 0;
  return disputeModel.createDocumentRow(docId, disputeId, userId, fileName, fileType, filePath, fileSize, fileContent)
    .then(() => ({
      id: docId,
      dispute_id: disputeId,
      client_id: userId,
      file_name: fileName,
      file_type: fileType,
      uploaded_at: new Date().toISOString(),
    }));
}

module.exports = {
  validateTransition,
  getAllowedTransitions,
  VALID_TRANSITIONS,
  createDispute,
  findTransactionById,
  findActiveDisputeByTransactionId,
  findDisputeById,
  reviewDispute,
  requestInfo,
  approveDispute,
  rejectDispute,
  chargebackDispute,
  merchantResponse,
  refundDispute,
  closeDispute,
  respondToInfoRequest,
  getDisputes,
  getDisputeHistory,
  getDisputeComments,
  getDisputeDocuments,
  getDocumentContent,
  createDocument,
};
