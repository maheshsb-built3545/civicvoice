/**
 * db.js
 * -----------------------------------------------------------------------
 * MongoDB connection setup using Mongoose.
 *
 * Deliberately isolated from app.js: server.js decides WHEN to connect
 * (before accepting traffic), app.js doesn't need to know HOW the DB
 * connects, and no business-logic module ever imports mongoose directly
 * — they'll import models, which assume a connection already exists.
 */

const dns = require('dns');
const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

// Windows-specific fix: Node's internal resolver (used for the SRV lookup
// that mongodb+srv:// URIs require) sometimes gets ECONNREFUSED even when
// the OS's own DNS config works fine (e.g. `nslookup` succeeds). Pointing
// Node explicitly at public DNS servers sidesteps whatever is going wrong
// in the OS-level resolver path Node would otherwise inherit.
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB connected', { mongoUri: maskUri(config.mongoUri) });
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    // Re-throw so server.js can decide to exit the process — a server
    // with no DB connection should not silently pretend to be healthy.
    throw err;
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
  });
}

/**
 * Avoids ever logging credentials if MONGO_URI includes a username/password.
 */
function maskUri(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}

module.exports = connectDB;
