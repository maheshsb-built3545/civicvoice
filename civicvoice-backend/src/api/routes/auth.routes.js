/**
 * auth.routes.js
 * -----------------------------------------------------------------------
 * Authentication routes: POST /api/auth/login, POST /api/auth/register, GET /api/auth/me
 */

const express = require('express');
const { login, register, me } = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/me', authMiddleware, me);

module.exports = router;
