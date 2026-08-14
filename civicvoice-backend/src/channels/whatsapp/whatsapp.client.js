/**
 * whatsapp.client.js
 * -----------------------------------------------------------------------
 * Outbound WhatsApp Cloud API client. Sends real text replies via Meta's
 * Graph API messages endpoint.
 */

const whatsappConfig = require('../../config/whatsapp.config');
const logger = require('../../utils/logger');
const { trackServiceFailure } = require('../../utils/redis');

/**
 * @param {string} recipientId - WhatsApp user phone number (wa_id)
 * @param {string} text - message body
 * @returns {Promise<object>} Meta API response JSON
 */
async function sendMessage(recipientId, text, traceId = null) {
  const url = `${whatsappConfig.graphApiBaseUrl}/${whatsappConfig.phoneNumberId}/messages`;
  
  const { formatIndianPhoneNumber } = require('../../utils/phoneHelper');
  const formattedRecipient = formatIndianPhoneNumber(recipientId);
  const cleanRecipientId = formattedRecipient.replace(/\D/g, '');

  const body = {
    messaging_product: 'whatsapp',
    to: cleanRecipientId,
    type: 'text',
    text: { body: text },
  };

  logger.info('WhatsApp Client: Attempting to send message', {
    url,
    recipientId,
    body,
    tokenPreview: whatsappConfig.accessToken ? `${whatsappConfig.accessToken.substring(0, 15)}...` : 'undefined',
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${whatsappConfig.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    logger.info('WhatsApp Client: Received API response', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      data,
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API returned status ${response.status}: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (err) {
    const cleanRecipient = recipientId.replace(/\D/g, '');
    const maskedPhone = cleanRecipient.length > 4
      ? `+${cleanRecipient.substring(0, 2)}******${cleanRecipient.substring(cleanRecipient.length - 4)}`
      : recipientId;

    logger.error('WhatsApp message send failed', {
      timestamp: new Date().toISOString(),
      step: 'whatsapp_send',
      traceId,
      error: err.message,
      stack: err.stack,
      context: {
        phoneNumber: maskedPhone
      }
    });
    await trackServiceFailure('whatsapp_send', traceId).catch(() => {});
    throw err;
  }
}

/**
 * Downloads a media file from WhatsApp Cloud API.
 * @param {string} mediaId - Meta media ID
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>} file buffer and mime type
 */
async function downloadMedia(mediaId) {
  const url = `${whatsappConfig.graphApiBaseUrl}/${mediaId}`;
  logger.info('WhatsApp Client: Fetching media URL metadata', { url, mediaId });
  
  const metaResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${whatsappConfig.accessToken}`,
    },
  });
  
  if (!metaResponse.ok) {
    const errBody = await metaResponse.text();
    throw new Error(`Failed to fetch media metadata for ${mediaId}: status ${metaResponse.status} - ${errBody}`);
  }
  
  const metaData = await metaResponse.json();
  const mediaUrl = metaData.url;
  const mimeType = metaData.mime_type || 'audio/ogg';
  
  if (!mediaUrl) {
    throw new Error(`No media URL found in metadata for ID ${mediaId}`);
  }
  
  logger.info('WhatsApp Client: Downloading media file binary', { mediaUrl });
  const downloadResponse = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${whatsappConfig.accessToken}`,
    },
  });
  
  if (!downloadResponse.ok) {
    const errBody = await downloadResponse.text();
    throw new Error(`Failed to download media binary from ${mediaUrl}: status ${downloadResponse.status} - ${errBody}`);
  }
  
  const arrayBuffer = await downloadResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return { buffer, mimeType };
}

/**
 * Sends a WhatsApp interactive list message.
 * @param {string} recipientId - WhatsApp user phone number
 * @param {string} bodyText - message body text
 * @param {string} buttonLabel - button text (max 20 chars)
 * @param {Array<{ id: string, title: string, description?: string }>} rows - list rows
 * @param {string} [headerText] - optional header text (max 60 chars)
 * @returns {Promise<object>} response JSON
 */
async function sendListMessage(recipientId, bodyText, buttonLabel, rows, headerText = '', traceId = null) {
  const url = `${whatsappConfig.graphApiBaseUrl}/${whatsappConfig.phoneNumberId}/messages`;
  
  const { formatIndianPhoneNumber } = require('../../utils/phoneHelper');
  const formattedRecipient = formatIndianPhoneNumber(recipientId);
  const cleanRecipientId = formattedRecipient.replace(/\D/g, '');

  const body = {
    messaging_product: 'whatsapp',
    to: cleanRecipientId,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonLabel.substring(0, 20),
        sections: [
          {
            title: 'Wards',
            rows: rows.map(row => ({
              id: row.id,
              title: row.title.substring(0, 24),
              ...(row.description && { description: row.description.substring(0, 72) })
            }))
          }
        ]
      }
    }
  };

  if (headerText) {
    body.interactive.header = {
      type: 'text',
      text: headerText.substring(0, 60)
    };
  }

  logger.info('WhatsApp Client: Attempting to send list message', {
    url,
    recipientId,
    body,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${whatsappConfig.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    logger.info('WhatsApp Client: Received list message response', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      data,
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API returned status ${response.status}: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (err) {
    const cleanRecipient = recipientId.replace(/\D/g, '');
    const maskedPhone = cleanRecipient.length > 4
      ? `+${cleanRecipient.substring(0, 2)}******${cleanRecipient.substring(cleanRecipient.length - 4)}`
      : recipientId;

    logger.error('WhatsApp message send failed', {
      timestamp: new Date().toISOString(),
      step: 'whatsapp_send',
      traceId,
      error: err.message,
      stack: err.stack,
      context: {
        phoneNumber: maskedPhone
      }
    });
    await trackServiceFailure('whatsapp_send', traceId).catch(() => {});
    throw err;
  }
}

/**
 * Sends a WhatsApp interactive reply buttons message.
 * @param {string} recipientId - WhatsApp user phone number
 * @param {string} bodyText - message body text
 * @param {Array<{ id: string, title: string }>} buttons - buttons array (max 3)
 * @param {string} [headerText] - optional header text (max 60 chars)
 * @param {string} [footerText] - optional footer text
 * @returns {Promise<object>} response JSON
 */
async function sendButtonMessage(recipientId, bodyText, buttons, headerText = '', footerText = '', traceId = null) {
  const url = `${whatsappConfig.graphApiBaseUrl}/${whatsappConfig.phoneNumberId}/messages`;
  
  const { formatIndianPhoneNumber } = require('../../utils/phoneHelper');
  const formattedRecipient = formatIndianPhoneNumber(recipientId);
  const cleanRecipientId = formattedRecipient.replace(/\D/g, '');

  const body = {
    messaging_product: 'whatsapp',
    to: cleanRecipientId,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map(btn => ({
          type: 'reply',
          reply: {
            id: btn.id.substring(0, 256),
            title: btn.title.substring(0, 20)
          }
        }))
      }
    }
  };

  if (headerText) {
    body.interactive.header = {
      type: 'text',
      text: headerText.substring(0, 60)
    };
  }

  if (footerText) {
    body.interactive.footer = {
      text: footerText
    };
  }

  logger.info('WhatsApp Client: Attempting to send button message', {
    url,
    recipientId,
    body,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${whatsappConfig.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    logger.info('WhatsApp Client: Received button message response', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      data,
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API returned status ${response.status}: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (err) {
    const cleanRecipient = recipientId.replace(/\D/g, '');
    const maskedPhone = cleanRecipient.length > 4
      ? `+${cleanRecipient.substring(0, 2)}******${cleanRecipient.substring(cleanRecipient.length - 4)}`
      : recipientId;

    logger.error('WhatsApp message send failed', {
      timestamp: new Date().toISOString(),
      step: 'whatsapp_send',
      traceId,
      error: err.message,
      stack: err.stack,
      context: {
        phoneNumber: maskedPhone
      }
    });
    await trackServiceFailure('whatsapp_send', traceId).catch(() => {});
    throw err;
  }
}

module.exports = { sendMessage, downloadMedia, sendListMessage, sendButtonMessage };
