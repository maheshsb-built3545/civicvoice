/**
 * whatsappClient.js
 * -----------------------------------------------------------------------
 * WhatsApp Channel Client wrapping the existing outbound client (whatsapp.client.js).
 */

const { sendMessage: sendWhatsAppMessage } = require('./whatsapp.client');
const logger = require('../../utils/logger');

/**
 * Sends outbound WhatsApp message to citizen or officer.
 * @param {string} recipientId - recipient phone number (wa_id)
 * @param {string|object} payload - message body or text payload
 * @returns {Promise<object>}
 */
async function sendMessage(recipientId, payload) {
  const text = typeof payload === 'string' ? payload : payload?.text || String(payload);
  logger.info('Dispatched WhatsApp outbound message via whatsappClient', { recipientId });
  return sendWhatsAppMessage(recipientId, text);
}

module.exports = { sendMessage };
