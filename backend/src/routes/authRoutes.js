// Définition des routes d'authentification.
// Elles regroupent la logique de connexion et de consultation du profil utilisateur.
const express = require('express');
const router = express.Router();
const { login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/login', login);
router.get('/me', authenticate, me);

module.exports = router;
