const express = require('express');
const router = express.Router();
const { createDispute, getDisputes, review, requestInfo, approve, reject, chargeback, refund, close, respondToInfoRequest } = require('../controllers/disputeController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.post('/disputes', authenticate, authorize('CLIENT'), createDispute);
router.put('/review', authenticate, authorize('OPERATOR'), review);
router.put('/request-info', authenticate, authorize('OPERATOR'), requestInfo);
router.put('/approve', authenticate, authorize('OPERATOR'), approve);
router.put('/reject', authenticate, authorize('OPERATOR'), reject);
router.put('/chargeback', authenticate, authorize('OPERATOR'), chargeback);
router.put('/refund', authenticate, authorize('OPERATOR'), refund);
router.put('/close', authenticate, authorize('OPERATOR'), close);
router.get('/disputes', authenticate, authorize('CLIENT', 'OPERATOR'), getDisputes);
router.put('/disputes/:id/respond', authenticate, authorize('CLIENT'), respondToInfoRequest);

module.exports = router;
