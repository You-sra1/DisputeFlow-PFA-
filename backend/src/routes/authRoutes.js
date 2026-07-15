const express = require('express');
const router = express.Router();
const { login, me, updateMe, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/login', login);
router.get('/me', authenticate, me);
router.put('/me', authenticate, updateMe);
router.put('/me/password', authenticate, changePassword);

module.exports = router;
