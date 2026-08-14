/**
 * assignmentRule.routes.js
 * -----------------------------------------------------------------------
 * Admin routes for assignment rules: GET/POST /api/assignment-rules
 */

const express = require('express');
const {
  listAssignmentRules,
  createAssignmentRule,
} = require('../controllers/assignmentRule.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('superadmin', 'ward_admin'));

router.get('/', listAssignmentRules);
router.post('/', createAssignmentRule);

module.exports = router;
