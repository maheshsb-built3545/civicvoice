/**
 * queue.js
 * -----------------------------------------------------------------------
 * BullMQ ingestion queue configuration and setup.
 */

const { Queue, Worker } = require('bullmq');
const logger = require('../../utils/logger');
const config = require('../../config/env');

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT, 10) || 6379;

const connection = {
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
};

let complaintQueue = null;

try {
  complaintQueue = new Queue('complaint-ingestion', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  complaintQueue.on('error', (err) => {
    logger.warn('BullMQ Queue connection warning (Redis might be offline)', { error: err.message });
  });
} catch (err) {
  logger.warn('Could not initialize BullMQ Queue', { error: err.message });
}

module.exports = { complaintQueue, connection };
