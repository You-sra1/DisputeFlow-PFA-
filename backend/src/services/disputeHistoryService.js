const { randomUUID } = require('crypto');
const disputeModel = require('../models/disputeModel');

async function recordStatusChange(disputeId, fromStatus, toStatus, changedBy, comment) {
  return disputeModel.createDisputeHistoryRow(randomUUID(), disputeId, fromStatus, toStatus, changedBy, comment);
}

async function recordComment(disputeId, userId, comment) {
  return disputeModel.createDisputeCommentRow(randomUUID(), disputeId, userId, comment);
}

module.exports = { recordStatusChange, recordComment };
