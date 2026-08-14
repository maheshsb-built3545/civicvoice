/**
 * server.js
 * -----------------------------------------------------------------------
 * Entry point. Responsibilities, in order:
 *   1. Load/validate config (via requiring env.js as a side effect).
 *   2. Connect to MongoDB — and refuse to start serving traffic if that
 *      fails, since a "healthy" server with no DB is worse than no
 *      server at all (it would accept requests it can't actually serve).
 *   3. Start the HTTP server.
 *
 * app.js is deliberately NOT responsible for any of this — it only
 * builds the Express app object, so it stays importable in tests
 * without side effects like opening a DB connection or a port.
 */

const config = require('./src/config/env');
const connectDB = require('./src/config/db');
const createApp = require('./src/app');
const logger = require('./src/utils/logger');

// Global Uncaught Exception and Unhandled Rejection Handlers
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION - Node process did not crash', {
    error: err.message,
    stack: err.stack,
    traceId: err.traceId || null,
  });
});

process.on('unhandledRejection', (reason, promise) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('UNHANDLED REJECTION - Node process did not crash', {
    error: err.message,
    stack: err.stack,
    traceId: err.traceId || null,
  });
});

async function start() {
  try {
    await connectDB();

    // Start background job worker
    require('./src/ingestion/jobs/processComplaint.job');

    // Run legacy officer schema migration
    const migrateOfficerSchema = require('./src/domain/admin/officer-migration');
    await migrateOfficerSchema();

    const app = createApp();

    const startServer = (port) => {
      const server = app.listen(port, () => {
        const actualPort = server.address().port;
        logger.info('CivicVoice backend started', {
          port: actualPort,
          env: config.nodeEnv,
        });
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`Port ${port} is already in use. Another instance of this server may already be running. Stop it before starting a new one.`);
          process.exit(1);
        }

        logger.error('Server failed to start', {
          error: err.message,
          port,
        });
        process.exit(1);
      });
    };

    startServer(config.port);
  } catch (err) {
    logger.error('Server failed to start', { error: err.message });
    process.exit(1);
  }
}

start();
