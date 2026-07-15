const express = require('express');
const router = express.Router();
const { getDashboardStats, getStatusDistribution, getReasonDistribution, getMerchantDisputes, getAvgProcessingTime, getMonthlyTrends } = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/dashboard/stats', authenticate, authorize('OPERATOR'), getDashboardStats);
router.get('/dashboard/status-distribution', authenticate, authorize('OPERATOR'), getStatusDistribution);
router.get('/dashboard/reason-distribution', authenticate, authorize('OPERATOR'), getReasonDistribution);
router.get('/dashboard/merchant-disputes', authenticate, authorize('OPERATOR'), getMerchantDisputes);
router.get('/dashboard/avg-processing-time', authenticate, authorize('OPERATOR'), getAvgProcessingTime);
router.get('/dashboard/monthly-trends', authenticate, authorize('OPERATOR'), getMonthlyTrends);

module.exports = router;
