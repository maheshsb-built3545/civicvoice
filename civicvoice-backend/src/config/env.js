/**
 * env.js
 * -----------------------------------------------------------------------
 * Loads environment variables via dotenv and validates that required configuration
 * is present BEFORE the server boots. Fail fast, fail loud, fail at startup.
 */

const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const CORE_REQUIRED_VARS = [
  'MONGO_URI',
  'GROQ_API_KEY',
  'API_KEY',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
];
const PRODUCTION_REQUIRED_VARS = [
  ...CORE_REQUIRED_VARS,
  'JWT_SECRET',
  'WHATSAPP_APP_SECRET',
];

function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const checkList = isProduction ? PRODUCTION_REQUIRED_VARS : CORE_REQUIRED_VARS;

  const missing = checkList.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `[CONFIG ERROR] Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Check your .env file or deployment environment variables.`
    );
  }
}

validateEnv();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:5000',
  mongoUri: process.env.MONGO_URI,
  groqApiKey: process.env.GROQ_API_KEY,
  apiKey: process.env.API_KEY,
  jwtSecret: process.env.JWT_SECRET || process.env.API_KEY || 'dev-jwt-secret',
  redisUrl: process.env.REDIS_URL || null,
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: parseInt(process.env.REDIS_PORT, 10) || 6379,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
};

module.exports = config;
