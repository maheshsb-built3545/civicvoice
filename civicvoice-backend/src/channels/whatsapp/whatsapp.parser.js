/**
 * whatsapp.parser.js
 * -----------------------------------------------------------------------
 * Parses Meta WhatsApp Cloud API webhook payloads into the channel-agnostic
 * InternalMessage shape used by complaint.service.js.
 *
 * Output shape per message:
 *   { channel: 'whatsapp', senderId, type: 'text'|'location'|'audio', rawText?,
 *     mediaId?, mimeType?, location?: { lat, lng }, timestamp }
 */

/**
 * @param {object} message - a single message object from Meta's webhook
 * @returns {object|null} InternalMessage or null if unsupported
 */
function parseMessage(message) {
  if (!message?.from) {
    return null;
  }

  const base = {
    channel: 'whatsapp',
    senderId: message.from,
    timestamp: message.timestamp
      ? new Date(parseInt(message.timestamp, 10) * 1000)
      : new Date(),
  };

  if (message.type === 'text' && message.text?.body) {
    return {
      ...base,
      type: 'text',
      rawText: message.text.body,
    };
  }

  if ((message.type === 'audio' || message.type === 'voice') && (message.audio || message.voice)) {
    const audioObj = message.audio || message.voice;
    return {
      ...base,
      type: 'audio',
      mediaId: audioObj.id,
      mimeType: audioObj.mime_type || 'audio/ogg',
    };
  }

  if (message.type === 'image' && message.image) {
    const imgObj = message.image;
    return {
      ...base,
      type: 'image',
      mediaId: imgObj.id,
      mimeType: imgObj.mime_type || 'image/jpeg',
      rawText: imgObj.caption || '',
    };
  }

  if (message.type === 'location' && message.location) {
    const { latitude, longitude, name, address } = message.location;
    const parts = [name, address].filter(Boolean);
    const locationLabel = parts.length > 0 ? parts.join(', ') : `${latitude}, ${longitude}`;

    return {
      ...base,
      type: 'location',
      rawText: `[Location shared: ${locationLabel}]`,
      location: { lat: latitude, lng: longitude },
    };
  }

  return null;
}

/**
 * @param {object} payload - full Meta webhook JSON body
 * @returns {object[]} array of InternalMessage objects
 */
function parseWhatsAppPayload(payload) {
  const messages = [];

  if (!payload?.entry || !Array.isArray(payload.entry)) {
    return messages;
  }

  for (const entry of payload.entry) {
    if (!entry.changes || !Array.isArray(entry.changes)) {
      continue;
    }

    for (const change of entry.changes) {
      const value = change.value;
      if (!value?.messages || !Array.isArray(value.messages)) {
        continue;
      }

      for (const message of value.messages) {
        const parsed = parseMessage(message);
        if (parsed) {
          messages.push(parsed);
        }
      }
    }
  }

  return messages;
}

module.exports = { parseWhatsAppPayload, parseMessage };
