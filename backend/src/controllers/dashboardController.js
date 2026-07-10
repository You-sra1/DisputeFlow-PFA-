const dashboardService = require('../services/dashboardService');
const { successResponse } = require('../utils/responseBuilder');

async function getStats(req, res, next) {
  try {
    const { id: userId, role } = req.user;
    const stats = await dashboardService.getStats(userId, role);
    return res.status(200).json(successResponse(stats));
  } catch (err) {
    next(err);
  }
}

async function getStatusDistribution(req, res, next) {
  try {
    const { id: userId, role } = req.user;
    const distribution = await dashboardService.getStatusDistribution(userId, role);
    return res.status(200).json(successResponse(distribution));
  } catch (err) {
    next(err);
  }
}

async function getReasonDistribution(req, res, next) {
  try {
    const { id: userId, role } = req.user;
    const distribution = await dashboardService.getReasonDistribution(userId, role);
    return res.status(200).json(successResponse(distribution));
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats, getStatusDistribution, getReasonDistribution };
