// Définition des routes liées aux transactions bancaires.
// Seul un utilisateur avec le rôle CLIENT peut accéder à ces endpoints.

const express = require('express');
const router = express.Router();
const { getTransactions, getTransactionById } = require('../controllers/transactionController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// GET /transactions
// Protégée par : authentification JWT + rôle CLIENT obligatoire.
router.get('/transactions', authenticate, authorize('CLIENT'), getTransactions);

// GET /transactions/:id
// Détail d'une transaction — nécessaire pour que le client sélectionne
// une transaction et déclare un litige dessus.
router.get('/transactions/:id', authenticate, authorize('CLIENT'), getTransactionById);

module.exports = router;
