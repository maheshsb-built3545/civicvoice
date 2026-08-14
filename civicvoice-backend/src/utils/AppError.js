/**
 * AppError.js
 * -----------------------------------------------------------------------
 * Custom error class used for every "expected" failure in the app
 * (validation failures, not-found, upstream service errors, etc).
 *
 * Why this exists instead of just `throw new Error(...)`:
 * The centralized error handler needs to tell the difference between
 * "something we anticipated and can map to a clean HTTP response"
 * (an AppError) and "something unexpected crashed" (a raw Error/bug).
 * That distinction is what lets errorHandler.js return a safe, useful
 * message for the former and a generic 500 (without leaking internals)
 * for the latter.
 *
 * `isOperational: true` marks this as a known, "safe to expose" error.
 */

class AppError extends Error {
  /**
   * @param {string} code - short machine-readable error code, e.g. 'NOT_FOUND'
   * @param {number} statusCode - HTTP status to respond with
   * @param {string} [message] - human-readable message (defaults to code)
   */
  constructor(code, statusCode = 500, message) {
    super(message || code);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
