const express = require('express');
const { createOfficer, listOfficers, resetOfficerPassword } = require('../controllers/admin-officer.controller');
const { createAdmin, listAdmins, updateAdmin } = require('../controllers/admin-user.controller');
const { jwtAuth } = require('../middlewares/auth.middleware');
const Ward = require('../../models/Ward');
const AppError = require('../../utils/AppError');

const router = express.Router();

router.use(jwtAuth);

// Officer management routes
router.post('/officers', createOfficer);
router.get('/officers', listOfficers);
router.post('/officers/:id/reset-password', resetOfficerPassword);

// Admin management routes
router.post('/create-admin', createAdmin);
router.get('/admins', listAdmins);
router.patch('/admins/:id', updateAdmin);

router.get('/wards', async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'ward_admin') {
      throw new AppError('FORBIDDEN', 403, 'Admin access required');
    }
    const wards = await Ward.find({}).sort({ name: 1 }).select('name').lean();
    res.status(200).json({ wards });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
