/**
 * whatsapp.service.js
 * -----------------------------------------------------------------------
 * Outbound WhatsApp Cloud API service.
 * Exports sendMessage(toPhoneNumber, text) to send text messages via Meta's Graph API.
 */

const logger = require('../../utils/logger');

/**
 * Sends a text message to a specific phone number using WhatsApp Cloud API v20.0.
 * @param {string} toPhoneNumber - Recipient's phone number
 * @param {string} text - The text message body
 * @returns {Promise<object>} The Meta API response JSON payload
 */
async function sendMessage(toPhoneNumber, text) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    logger.error('WhatsApp outgoing sendMessage failed: missing credentials');
    throw new Error('WhatsApp service is misconfigured. Missing credentials.');
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toPhoneNumber,
      type: 'text',
      text: { body: text },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    logger.error('WhatsApp sendMessage failed', {
      status: response.status,
      toPhoneNumber,
      response: data,
    });
    throw new Error(`WhatsApp API returned status ${response.status}`);
  }

  logger.info('Outbound WhatsApp message sent successfully', { toPhoneNumber });
  return data;
}

module.exports = { sendMessage };
