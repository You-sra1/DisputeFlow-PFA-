const express = require('express');
const router = express.Router();
const { getStats, getStatusDistribution, getReasonDistribution } = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/dashboard/stats', authenticate, authorize('CLIENT', 'OPERATOR'), getStats);
router.get('/dashboard/status-distribution', authenticate, authorize('CLIENT', 'OPERATOR'), getStatusDistribution);
router.get('/dashboard/reason-distribution', authenticate, authorize('CLIENT', 'OPERATOR'), getReasonDistribution);

module.exports = router;
