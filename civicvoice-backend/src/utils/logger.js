/**
 * logger.js
 * -----------------------------------------------------------------------
 * Minimal structured logger. Deliberately not a full logging library
 * (winston/pino) for this foundation slice — every log line is a single
 * JSON object so it's greppable and can be swapped for a real logger
 * later without changing every call site, since the function signatures
 * (info/error/warn) will stay the same.
 */

function baseLog(level, message, meta = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

const logger = {
  info: (message, meta) => baseLog('info', message, meta),
  warn: (message, meta) => baseLog('warn', message, meta),
  error: (message, meta) => baseLog('error', message, meta),
};

module.exports = logger;
