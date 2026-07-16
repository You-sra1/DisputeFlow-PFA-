const express = require('express');
const router = express.Router();
const { createDispute, getDisputes, getDisputeById, respondToInfoRequest,
  getDisputeHistory, getDisputeComments, getDisputeDocuments, uploadDisputeDocument, getDocumentContent } = require('../controllers/disputeController');
const { review, requestInfo, approve, reject, chargeback, merchantResponse, refund, close } = require('../controllers/operatorController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.post('/disputes', authenticate, authorize('CLIENT'), createDispute);
router.get('/disputes', authenticate, authorize('CLIENT', 'OPERATOR'), getDisputes);
router.get('/disputes/:id', authenticate, authorize('CLIENT', 'OPERATOR'), getDisputeById);
router.put('/review/:id', authenticate, authorize('OPERATOR'), review);
router.put('/request-info/:id', authenticate, authorize('OPERATOR'), requestInfo);
router.put('/approve/:id', authenticate, authorize('OPERATOR'), approve);
router.put('/reject/:id', authenticate, authorize('OPERATOR'), reject);
router.put('/chargeback/:id', authenticate, authorize('OPERATOR'), chargeback);
router.put('/merchant-response/:id', authenticate, authorize('OPERATOR'), merchantResponse);
router.put('/refund/:id', authenticate, authorize('OPERATOR'), refund);
router.put('/close/:id', authenticate, authorize('OPERATOR'), close);
router.put('/disputes/:id/respond', authenticate, authorize('CLIENT'), respondToInfoRequest);
router.get('/disputes/:id/history', authenticate, authorize('CLIENT', 'OPERATOR'), getDisputeHistory);
router.get('/disputes/:id/comments', authenticate, authorize('CLIENT', 'OPERATOR'), getDisputeComments);
router.get('/disputes/:id/documents', authenticate, authorize('CLIENT', 'OPERATOR'), getDisputeDocuments);
router.post('/disputes/:id/documents', authenticate, authorize('CLIENT', 'OPERATOR'), uploadDisputeDocument);
router.get('/disputes/documents/:documentId', authenticate, authorize('CLIENT', 'OPERATOR'), getDocumentContent);

module.exports = router;
