const express = require('express');
const logger = require('../../utils/logger');
const { enqueueWhatsappWebhook } = require('../../ingestion/jobs/processComplaint.job');

const router = express.Router();

// GET /api/webhooks/whatsapp — verification handshake
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verification handshake successful');
    return res.status(200).send(challenge);
  }

  logger.warn('WhatsApp webhook verification handshake failed', { mode });
  return res.sendStatus(403);
});

// POST /api/webhooks/whatsapp — receives incoming message events
router.post('/', async (req, res) => {
  console.log(`[DEBUG-ROUTE-ENTRY] Received POST /api/webhooks/whatsapp at ${new Date().toISOString()}`);

  // Always respond 200 immediately to Meta
  res.status(200).send('EVENT_RECEIVED');

  // Process body parsing safely
  let payload;
  try {
    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse(req.body.toString('utf8'));
    } else if (typeof req.body === 'object' && req.body !== null) {
      payload = req.body;
    } else if (typeof req.body === 'string') {
      payload = JSON.parse(req.body);
    } else {
      logger.warn('WhatsApp webhook received unexpected body format');
      return;
    }
  } catch (err) {
    logger.error('Failed to parse WhatsApp webhook body', { error: err.message });
    return;
  }

  // Push to BullMQ background job queue
  try {
    await enqueueWhatsappWebhook(payload, req.traceId);
  } catch (err) {
    logger.error('Failed to enqueue WhatsApp webhook payload', { error: err.message });
  }
});

module.exports = router;
