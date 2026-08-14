/**
 * officer.routes.js
 * -----------------------------------------------------------------------
 * GET/POST /api/officers, GET/PATCH /api/officers/:id (admin-only, protected by rbac middleware)
 */

const express = require('express');
const {
  createOfficer,
  listOfficers,
  getOfficer,
  updateOfficer,
  deleteOfficer,
  checkOfficerDeletion,
} = require('../controllers/officer.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('superadmin', 'ward_admin', 'admin'));

router.get('/', listOfficers);
router.post('/', createOfficer);
router.get('/:id', getOfficer);
router.get('/:id/deletion-check', checkOfficerDeletion);
router.patch('/:id', updateOfficer);
router.delete('/:id', deleteOfficer);

module.exports = router;
