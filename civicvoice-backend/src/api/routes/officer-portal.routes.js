const express = require('express');
const {
  loginOfficer,
  changePassword,
  getComplaints,
  updateComplaintStatus,
  requestPasswordReset,
  updateComplaintWard,
} = require('../controllers/officer-portal.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

// Public login/reset routes
router.post('/login', loginOfficer);
router.post('/request-password-reset', requestPasswordReset);

// Scoped to authenticated officers only
router.use(authMiddleware);
router.use(requireRole('officer'));

router.post('/change-password', changePassword);
router.get('/complaints', getComplaints);
router.patch('/complaints/:id/status', updateComplaintStatus);
router.patch('/complaints/:id/ward', updateComplaintWard);

router.get('/wards', async (req, res, next) => {
  try {
    const Ward = require('../../models/Ward');
    const wards = await Ward.find({}).sort({ name: 1 }).select('name').lean();
    res.status(200).json({ wards });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
