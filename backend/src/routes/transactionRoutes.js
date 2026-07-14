const express = require('express');
const router = express.Router();
const { getTransactions, getCards } = require('../controllers/transactionController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/cards', authenticate, authorize('CLIENT'), getCards);
router.get('/transactions', authenticate, authorize('CLIENT'), getTransactions);

module.exports = router;
