/**
 * UNUSED / DEAD CODE ARTIFACT
 * -------------------------------------------------------------
 * This file is no longer active in the CivicVoice application.
 * All incoming citizen WhatsApp webhook requests are processed synchronously
 * and directly via `whatsapp.routes.js`.
 * 
 * webhookHandler.js
 * -----------------------------------------------------------------------
 * Express route handler for WhatsApp webhooks.
 * Verifies HMAC signature -> ACKs 200 immediately -> normalizes to InternalMessage -> enqueues job.
 */

const { verifyWhatsAppSignature } = require('./whatsapp.signature');
const { parseWhatsAppPayload } = require('./whatsapp.parser');
const { enqueueComplaint } = require('../../ingestion/jobs/processComplaint.job');
const whatsappConfig = require('../../config/whatsapp.config');
const logger = require('../../utils/logger');

/**
 * Handles Meta webhook GET verification handshake.
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === whatsappConfig.verifyToken) {
    logger.info('WhatsApp webhook verification successful');
    return res.status(200).send(challenge);
  }

  logger.warn('WhatsApp webhook verification failed', { mode });
  return res.sendStatus(403);
}

/**
 * Handles Meta incoming webhook POST notifications.
 */
async function receiveWebhook(req, res) {
  const signature = req.headers['x-hub-signature-256'];
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body || {}));

  // Verify Meta's X-Hub-Signature-256 header using app secret
  if (!verifyWhatsAppSignature(rawBody, signature)) {
    logger.warn('WhatsApp webhook signature verification failed', { traceId: req.traceId });
    return res.sendStatus(403);
  }

  // ACK webhook immediately with 200 OK so Meta doesn't trigger retries
  res.status(200).send('EVENT_RECEIVED');

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    logger.error('Failed to parse WhatsApp webhook payload JSON', { traceId: req.traceId, error: err.message });
    return;
  }

  const messages = parseWhatsAppPayload(payload);

  if (!messages || messages.length === 0) {
    logger.info('No actionable messages in WhatsApp payload', { traceId: req.traceId });
    return;
  }

  for (const internalMessage of messages) {
    try {
      // Push normalized message onto Ingestion Queue
      await enqueueComplaint(internalMessage, req.traceId);
    } catch (err) {
      logger.error('Failed to enqueue WhatsApp complaint message', {
        traceId: req.traceId,
        senderId: internalMessage.senderId,
        error: err.message,
      });
    }
  }
}

module.exports = { verifyWebhook, receiveWebhook };
