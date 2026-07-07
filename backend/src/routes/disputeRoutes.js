// Définition des routes liées aux litiges (disputes).
// Accessible par CLIENT (ses propres litiges) et OPERATOR (tous les litiges).

const express = require('express');
const router = express.Router();
const { createDispute, getDisputes } = require('../controllers/disputeController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// POST /disputes
// Déclaration d'un litige par un client sur une transaction qu'il possède.
// Protégée par : authentification JWT + rôle CLIENT obligatoire.
router.post('/disputes', authenticate, authorize('CLIENT'), createDispute);

// GET /disputes
// Consultation des litiges : le CLIENT voit les siens, l'OPERATOR voit tout.
// Protégée par : authentification JWT + rôles CLIENT ou OPERATOR.
router.get('/disputes', authenticate, authorize('CLIENT', 'OPERATOR'), getDisputes);

module.exports = router;
