const express = require('express');
const router = express.Router();
const { getTransactions, getCards, getTransactionById } = require('../controllers/transactionController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/cards', authenticate, authorize('CLIENT'), getCards);
router.get('/transactions', authenticate, authorize('CLIENT'), getTransactions);
router.get('/transactions/:id', authenticate, authorize('CLIENT'), getTransactionById);

module.exports = router;
