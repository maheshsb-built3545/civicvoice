/**
 * whatsapp.config.js
 * -----------------------------------------------------------------------
 * WhatsApp Cloud API credentials. Validates at import time so the server
 * refuses to start if any required variable is missing.
 */

const REQUIRED_VARS = [
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
];

function validateWhatsAppEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required WhatsApp environment variable(s): ${missing.join(', ')}. ` +
        'Add them to .env — see .env.example for placeholders.'
    );
  }
}

validateWhatsAppEnv();

const whatsappConfig = {
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  appSecret: process.env.WHATSAPP_APP_SECRET,
  graphApiBaseUrl: 'https://graph.facebook.com/v21.0',
};

module.exports = whatsappConfig;
