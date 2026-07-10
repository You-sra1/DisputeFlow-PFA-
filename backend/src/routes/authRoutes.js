// Définition des routes d'authentification.
// Elles regroupent la logique de connexion et de consultation du profil utilisateur.
const express = require('express');
const router = express.Router();
const { login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/login', login);

// GET /me
// Consultation du profil de l'utilisateur connecté à partir du token JWT.
// Protégée par : authentification JWT obligatoire.
router.get('/me', authenticate, me);

module.exports = router;
