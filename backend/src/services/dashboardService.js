const dashboardModel = require('../models/dashboardModel');

async function getStats() {
  const totals = await dashboardModel.getStats();
  return {
    totalDisputes: totals.totalDisputes || 0,
    inProgress: totals.inProgress || 0,
    approved: totals.approved || 0,
    totalAmount: totals.totalAmount || 0,
  };
}

async function getStatusDistribution() {
  return dashboardModel.getStatusDistribution();
}

async function getReasonDistribution() {
  return dashboardModel.getReasonDistribution();
}

async function getMerchantDisputes() {
  return dashboardModel.getMerchantDisputes();
}

async function getAvgProcessingTime() {
  const rows = await dashboardModel.getAvgProcessingTime();
  const avg = rows.length > 0
    ? rows.reduce((sum, r) => sum + r.hoursToProcess, 0) / rows.length
    : 0;
  return { avgHoursToClose: Math.round(avg * 10) / 10, total: rows.length, details: rows };
}

async function getMonthlyTrends() {
  return dashboardModel.getMonthlyTrends();
}

module.exports = { getStats, getStatusDistribution, getReasonDistribution, getMerchantDisputes, getAvgProcessingTime, getMonthlyTrends };
