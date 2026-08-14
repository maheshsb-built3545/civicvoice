/**
 * analytics.routes.js
 * -----------------------------------------------------------------------
 * GET /api/admin/analytics - fetch aggregated analytics (admin-only)
 */

const express = require('express');
const { getAnalytics, getExportReport } = require('../controllers/analytics.controller');
const { jwtAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(jwtAuth);
router.get('/export', getExportReport);
router.get('/', getAnalytics);

module.exports = router;
