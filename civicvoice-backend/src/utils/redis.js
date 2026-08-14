const Redis = require('ioredis');
const logger = require('./logger');

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT, 10) || 6379;

let redisClient = null;

try {
  redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop retrying and fail open
      }
      return Math.min(times * 100, 2000);
    }
  });

  redisClient.on('error', (err) => {
    // Catch errors silently so Mongoose/App server doesn't crash on connection issues
    logger.warn('Redis Client connection warning (rate limiter)', { error: err.message });
  });
} catch (err) {
  logger.error('Failed to initialize Redis client for rate limiter', { error: err.message });
}

/**
 * Sliding window rate limit checker in Redis using Sorted Sets (ZSET).
 * Window: 10 minutes (600,000 ms)
 * Limit: 5 complaints
 * Fail-open: If Redis connection is offline/error, log error and return limitExceeded = false.
 *
 * @param {string} phoneNumber - citizen's phone number
 * @param {string} traceId - transaction trace ID
 * @returns {Promise<{ limitExceeded: boolean, count: number }>}
 */
async function checkWhatsAppRateLimit(phoneNumber, traceId) {
  try {
    if (!redisClient || redisClient.status !== 'ready') {
      logger.error('Redis is offline or not ready, rate limiter failing open', { traceId });
      return { limitExceeded: false, count: 0 };
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const key = `ratelimit:complaints:${cleanPhone}`;
    const now = Date.now();
    const windowMs = 10 * 60 * 1000; // 10 minutes
    const limit = 5;

    const multi = redisClient.multi();
    
    // Evict timestamps older than 10 minutes
    multi.zremrangebyscore(key, 0, now - windowMs);
    // Count remaining entries
    multi.zcard(key);
    // Add current entry
    const uniqueMember = `${now}:${Math.random().toString(36).substring(2, 7)}`;
    multi.zadd(key, now, uniqueMember);
    // Refresh expiration of the set key
    multi.pexpire(key, windowMs);

    const results = await multi.exec();

    if (!results || !Array.isArray(results)) {
      throw new Error('Invalid multi exec result');
    }

    if (results[1] && results[1][0]) {
      throw results[1][0];
    }
    const countBeforeInsert = results[1] ? results[1][1] : 0;
    const totalCount = countBeforeInsert + 1;

    if (totalCount > limit) {
      return { limitExceeded: true, count: totalCount };
    }

    return { limitExceeded: false, count: totalCount };
  } catch (err) {
    logger.error('Failed to execute rate limit sliding window check, failing open', { traceId, error: err.message });
    return { limitExceeded: false, count: 0 };
  }
}

/**
 * Repeated failure alerting mechanism in Redis.
 * Window: 10 minutes (600 seconds)
 * Threshold: 5 failures
 * Alert suppression: fires once per window using a lock key with EX 600 NX.
 *
 * @param {string} serviceName - 'ai_extraction' | 'geocoding' | 'whatsapp_send'
 * @param {string|null} traceId - transaction trace ID
 * @returns {Promise<void>}
 */
async function trackServiceFailure(serviceName, traceId = null) {
  if (!redisClient || redisClient.status !== 'ready') {
    return; // Fail open silently, rate limiter log already flagged offline Redis
  }

  const windowSeconds = 600; // 10 minutes
  const limit = 5;

  const counterKey = `alertwindow:failures:${serviceName}`;
  const alertedLockKey = `alertwindow:alerted:${serviceName}`;

  try {
    const count = await redisClient.incr(counterKey);
    if (count === 1) {
      await redisClient.expire(counterKey, windowSeconds);
    }

    if (count > limit) {
      // Set the lock key with a TTL. Returns 'OK' only if it doesn't already exist.
      const lockAcquired = await redisClient.set(alertedLockKey, '1', 'EX', windowSeconds, 'NX');
      if (lockAcquired === 'OK') {
        logger.error('Circuit alert: Repeated downstream service failure detected', {
          alertType: 'repeated_failure',
          service: serviceName,
          failureCount: count,
          windowMinutes: 10,
          traceId
        });
      }
    }
  } catch (err) {
    // Fail-open silently to avoid throwing error loops on logging boundaries
  }
}

module.exports = {
  redisClient,
  checkWhatsAppRateLimit,
  trackServiceFailure
};
