const dashboardService = require('../services/dashboardService');
const { successResponse } = require('../utils/responseBuilder');

async function getDashboardStats(req, res, next) {
  try {
    const stats = await dashboardService.getStats();
    return res.status(200).json(successResponse(stats));
  } catch (err) { next(err); }
}

async function getStatusDistribution(req, res, next) {
  try {
    const data = await dashboardService.getStatusDistribution();
    return res.status(200).json(successResponse(data));
  } catch (err) { next(err); }
}

async function getReasonDistribution(req, res, next) {
  try {
    const data = await dashboardService.getReasonDistribution();
    return res.status(200).json(successResponse(data));
  } catch (err) { next(err); }
}

async function getMerchantDisputes(req, res, next) {
  try {
    const data = await dashboardService.getMerchantDisputes();
    return res.status(200).json(successResponse(data));
  } catch (err) { next(err); }
}

async function getAvgProcessingTime(req, res, next) {
  try {
    const data = await dashboardService.getAvgProcessingTime();
    return res.status(200).json(successResponse(data));
  } catch (err) { next(err); }
}

async function getMonthlyTrends(req, res, next) {
  try {
    const data = await dashboardService.getMonthlyTrends();
    return res.status(200).json(successResponse(data));
  } catch (err) { next(err); }
}

module.exports = { getDashboardStats, getStatusDistribution, getReasonDistribution, getMerchantDisputes, getAvgProcessingTime, getMonthlyTrends };
