const express = require('express');
const { signup, login } = require('../../domain/auth/citizen-auth.service');
const { listMyComplaints, createMyComplaint } = require('../controllers/citizen-complaint.controller');
const { requestOtp, verifyOtpAndSetPassword } = require('../controllers/citizen-otp.controller');
const { jwtAuth } = require('../middlewares/auth.middleware');
const AppError = require('../../utils/AppError');

const router = express.Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp-set-password', verifyOtpAndSetPassword);

router.post('/signup', async (req, res, next) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      throw new AppError('INVALID_INPUT', 400, 'name, phone, and password are required');
    }

    const result = await signup(name, phone, password);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      throw new AppError('INVALID_INPUT', 400, 'phone and password are required');
    }

    const result = await login(phone, password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/my-complaints', jwtAuth, async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'citizen') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Citizen authentication required' });
    }

    return listMyComplaints(req, res, next);
  } catch (err) {
    return next(err);
  }
});

router.get('/complaints', jwtAuth, async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'citizen') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Citizen authentication required' });
    }

    return listMyComplaints(req, res, next);
  } catch (err) {
    return next(err);
  }
});

router.post('/complaints', jwtAuth, async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'citizen') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Citizen authentication required' });
    }

    return createMyComplaint(req, res, next);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
