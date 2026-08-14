/**
 * complaint.routes.js
 * -----------------------------------------------------------------------
 * POST /api/complaints      - submit a text complaint
 * GET  /api/complaints/:id  - fetch a complaint by id
 *
 * No auth middleware here — intentional, matches architecture doc
 * section 5/1: auth is Module 3.11, explicitly out of scope for this
 * slice. Do not deploy this publicly before auth exists.
 */

const express = require('express');
const { createComplaint, getComplaint, listComplaints, assignComplaint, updateComplaintStatus, deleteComplaint, updateComplaintWard } = require('../controllers/complaint.controller');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.post('/', createComplaint);
router.get('/', listComplaints);
router.get('/:id', getComplaint);
router.patch('/:id/assign', requireRole('superadmin', 'ward_admin', 'admin'), assignComplaint);
router.patch('/:id/status', requireRole('superadmin', 'ward_admin', 'admin'), updateComplaintStatus);
router.patch('/:id/ward', requireRole('superadmin', 'ward_admin', 'admin'), updateComplaintWard);
router.delete('/:id', requireRole('superadmin', 'ward_admin', 'admin'), deleteComplaint);

module.exports = router;
