/**
 * whatsapp.signature.js
 * -----------------------------------------------------------------------
 * Verifies Meta webhook payloads via the X-Hub-Signature-256 header.
 * Uses HMAC SHA256 against the raw request body and App Secret.
 */

const crypto = require('crypto');
const whatsappConfig = require('../../config/whatsapp.config');

/**
 * @param {Buffer|string} rawBody - unparsed request body
 * @param {string|undefined} signatureHeader - value of X-Hub-Signature-256
 * @returns {boolean}
 */
function verifyWhatsAppSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !rawBody) {
    return false;
  }

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', whatsappConfig.appSecret).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

module.exports = { verifyWhatsAppSignature };
