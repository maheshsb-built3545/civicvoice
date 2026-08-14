/**
 * auth.js
 * -----------------------------------------------------------------------
 * Minimal shared-secret API key check. This is NOT a full auth system
 * (no users, no roles, no JWT) — it's the smallest thing that stops
 * anyone with the URL from hitting /api/complaints, which was the
 * explicit risk flagged when this slice shipped with open routes.
 *
 * Full auth (Module 3.11 in the original architecture — real user
 * accounts, officer roles, JWT sessions) is still a separate, later
 * piece of work. This just closes the "anyone can spam the DB and burn
 * the Groq quota" gap cheaply in the meantime.
 *
 * How it works: caller sends header `x-api-key: <value>`, checked
 * against API_KEY from env. Health check is NOT protected by this —
 * it's mounted separately in app.js so uptime monitors don't need a key.
 */

const AppError = require('../../utils/AppError');
const config = require('../../config/env');

function apiKeyAuth(req, res, next) {
  const providedKey = req.header('x-api-key');

  if (!providedKey) {
    return next(new AppError('UNAUTHORIZED', 401, 'Missing x-api-key header'));
  }

  if (providedKey !== config.apiKey) {
    return next(new AppError('UNAUTHORIZED', 401, 'Invalid API key'));
  }

  next();
}

module.exports = { apiKeyAuth };
