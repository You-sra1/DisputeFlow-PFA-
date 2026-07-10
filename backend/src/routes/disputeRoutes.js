// Définition des routes liées aux litiges (disputes).
// Accessible par CLIENT (ses propres litiges) et OPERATOR (tous les litiges).

const express = require('express');
const router = express.Router();
const { createDispute, getDisputes, review, requestInfo, approve, reject, chargeback, refund, close } = require('../controllers/disputeController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// POST /disputes
// Déclaration d'un litige par un client sur une transaction qu'il possède.
// Protégée par : authentification JWT + rôle CLIENT obligatoire.
router.post('/disputes', authenticate, authorize('CLIENT'), createDispute);

// PUT /review
// Prise en charge d'un litige par un opérateur (SUBMITTED → UNDER_REVIEW).
// Protégée par : authentification JWT + rôle OPERATOR obligatoire.
router.put('/review', authenticate, authorize('OPERATOR'), review);

// PUT /request-info
// Demande d'informations complémentaires par un opérateur (UNDER_REVIEW → WAITING_FOR_INFORMATION).
// Protégée par : authentification JWT + rôle OPERATOR obligatoire.
router.put('/request-info', authenticate, authorize('OPERATOR'), requestInfo);

// PUT /approve
// Approbation d'un litige par un opérateur (UNDER_REVIEW/WAITING → APPROVED).
// Protégée par : authentification JWT + rôle OPERATOR obligatoire.
router.put('/approve', authenticate, authorize('OPERATOR'), approve);

// PUT /reject
// Rejet d'un litige par un opérateur (UNDER_REVIEW/WAITING → REJECTED).
// Protégée par : authentification JWT + rôle OPERATOR obligatoire.
router.put('/reject', authenticate, authorize('OPERATOR'), reject);

// PUT /chargeback
// Initiation de la procédure de chargeback par un opérateur (APPROVED → CHARGEBACK_INITIATED).
// Protégée par : authentification JWT + rôle OPERATOR obligatoire.
router.put('/chargeback', authenticate, authorize('OPERATOR'), chargeback);

// PUT /refund
// Finalisation d'un chargeback par remboursement (CHARGEBACK_INITIATED → REFUND_COMPLETED).
// Protégée par : authentification JWT + rôle OPERATOR obligatoire.
router.put('/refund', authenticate, authorize('OPERATOR'), refund);

// PUT /close
// Clôture définitive d'un dossier de litige par un opérateur
// (REJECTED → CLOSED ou REFUND_COMPLETED → CLOSED).
// Protégée par : authentification JWT + rôle OPERATOR obligatoire.
router.put('/close', authenticate, authorize('OPERATOR'), close);

// GET /disputes
// Consultation des litiges : le CLIENT voit les siens, l'OPERATOR voit tout.
// Protégée par : authentification JWT + rôles CLIENT ou OPERATOR.
router.get('/disputes', authenticate, authorize('CLIENT', 'OPERATOR'), getDisputes);

module.exports = router;
