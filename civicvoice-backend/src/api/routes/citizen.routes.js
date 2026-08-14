/**
 * citizen.routes.js
 * -----------------------------------------------------------------------
 * Public endpoint for citizens to query status: POST /api/citizen/status
 */

const express = require('express');
const { getCitizenStatus } = require('../controllers/citizen.controller');

const router = express.Router();

router.post('/status', getCitizenStatus);

router.get('/config', (req, res) => {
  res.status(200).json({
    whatsappNumber: process.env.WHATSAPP_BOT_NUMBER || '15551765246'
  });
});

module.exports = router;
