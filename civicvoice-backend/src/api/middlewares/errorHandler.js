/**
 * errorHandler.js
 * -----------------------------------------------------------------------
 * Centralized Express error-handling middleware. This is the ONLY place
 * in the app that turns an error into an HTTP response — every route/
 * service should just `throw` (or `next(err)`) and let this handle it.
 *
 * Two error shapes are handled differently on purpose:
 *  - AppError (isOperational: true)  → known failure, safe to expose
 *    code/message/statusCode to the client.
 *  - anything else (bugs, unexpected exceptions) → logged with full
 *    detail server-side, but the client only ever gets a generic 500.
 *    This prevents stack traces / internal details leaking to callers.
 *
 * Every response includes `traceId` so a citizen/officer-facing error
 * message can be correlated back to server logs by whoever's debugging.
 */

const logger = require('../../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const traceId = req.traceId || 'unknown';

  if (err.isOperational) {
    logger.warn('Handled error', {
      traceId,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
    });

    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      traceId,
    });
  }

  // Unexpected error — log full detail, expose nothing.
  logger.error('Unexpected error', {
    traceId,
    message: err.message,
    stack: err.stack,
  });

  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong. Please try again.',
    traceId,
  });
}

module.exports = errorHandler;
