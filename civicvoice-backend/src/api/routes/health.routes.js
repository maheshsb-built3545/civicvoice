/**
 * health.routes.js
 * -----------------------------------------------------------------------
 * Basic health-check endpoint. Reports process uptime and current
 * MongoDB connection state so a hackathon demo (or later, a real
 * uptime monitor / load balancer) can tell the difference between
 * "server is up" and "server is up but DB is down."
 *
 * No business logic here — this is intentionally the simplest possible
 * route, kept separate from complaint routes (which don't exist yet)
 * so this file never needs to change when complaint features are added.
 */

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const MONGOOSE_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    mongo: MONGOOSE_STATES[mongoose.connection.readyState] || 'unknown',
    traceId: req.traceId,
  });
});

module.exports = router;
