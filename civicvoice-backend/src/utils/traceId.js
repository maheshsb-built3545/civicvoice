/**
 * traceId.js
 * -----------------------------------------------------------------------
 * Generates a unique ID per incoming request so every log line, error,
 * and (later) queue job related to that request can be correlated.
 *
 * This matters more than it looks like it should for CivicVoice
 * specifically: once the WhatsApp/queue/AI pipeline exists, a single
 * citizen complaint will pass through 5-6 async stages. Without a
 * traceId attached at the very first entry point, debugging "why did
 * this complaint get stuck" becomes guesswork. Attaching it here, now,
 * means every future module just has to read req.traceId instead of
 * inventing its own correlation scheme later.
 */

const { v4: uuidv4 } = require('uuid');

function generateTraceId() {
  return uuidv4();
}

/**
 * Express middleware: attaches a traceId to the request object and
 * echoes it back as a response header for client-side debugging.
 */
function traceIdMiddleware(req, res, next) {
  req.traceId = generateTraceId();
  res.setHeader('X-Trace-Id', req.traceId);
  next();
}

module.exports = { generateTraceId, traceIdMiddleware };
