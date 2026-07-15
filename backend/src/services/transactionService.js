const transactionModel = require('../models/transactionModel');

function findCardByNumber(cardNumber) {
  return transactionModel.findCardByNumber(cardNumber);
}

function findTransactionById(transactionId) {
  return transactionModel.findTransactionById(transactionId);
}

function getTransactions(cardId, userId, startDate, endDate) {
  return transactionModel.getTransactions(cardId, userId, startDate, endDate);
}

function findCardByUserId(userId) {
  return transactionModel.findCardByUserId(userId);
}

function findCardsByUserId(userId) {
  return transactionModel.findCardsByUserId(userId);
}

module.exports = { findCardByNumber, findCardByUserId, findCardsByUserId, findTransactionById, getTransactions };
