/**
 * mediaDownloader.js
 * -----------------------------------------------------------------------
 * Downloads short-lived media assets (e.g. WhatsApp audio notes) using Meta Graph API.
 */

const whatsappConfig = require('../config/whatsapp.config');
const diskStorage = require('./storage/diskStorage');
const logger = require('../utils/logger');

/**
 * Maps mimeType to file extension.
 * @param {string} mimeType
 * @returns {string} extension
 */
function getExtension(mimeType) {
  if (!mimeType) return 'ogg';
  const mimeLower = mimeType.toLowerCase();
  if (mimeLower.includes('ogg')) return 'ogg';
  if (mimeLower.includes('jpeg') || mimeLower.includes('jpg')) return 'jpg';
  if (mimeLower.includes('png')) return 'png';
  if (mimeLower.includes('webp')) return 'webp';
  return 'bin';
}

/**
 * Downloads media by ID or URL and persists to storage.
 * @param {string} mediaIdOrUrl
 * @param {string} [passedMimeType]
 * @returns {Promise<{ buffer: Buffer, url: string, filePath: string, mimeType: string }>}
 */
async function downloadMedia(mediaIdOrUrl, passedMimeType) {
  if (!mediaIdOrUrl) {
    throw new Error('mediaId parameter is required');
  }

  let downloadUrl = mediaIdOrUrl;
  let mimeType = passedMimeType;

  // If it's a Meta media ID rather than a direct URL, fetch media metadata first
  if (!mediaIdOrUrl.startsWith('http://') && !mediaIdOrUrl.startsWith('https://')) {
    const metaUrl = `${whatsappConfig.graphApiBaseUrl}/${mediaIdOrUrl}`;
    const metaRes = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${whatsappConfig.accessToken}`,
      },
    });

    if (!metaRes.ok) {
      throw new Error(`Failed to fetch media metadata from Meta: ${metaRes.statusText}`);
    }

    const metaData = await metaRes.json();
    downloadUrl = metaData.url;
    if (!mimeType) {
      mimeType = metaData.mime_type;
    }
  }

  // Fallback default mimeType if not resolved
  if (!mimeType) {
    mimeType = 'audio/ogg';
  }

  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${whatsappConfig.accessToken}`,
    },
  });

  if (!response.ok) {
    logger.error('Failed to download media asset', { url: downloadUrl, status: response.status });
    throw new Error(`Media download failed with HTTP status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = getExtension(mimeType);
  const prefix = mimeType.startsWith('image/') ? 'img' : 'voice';
  const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const saved = await diskStorage.saveFile(filename, buffer);

  return {
    buffer,
    url: saved.url,
    filePath: saved.filePath,
    mimeType,
  };
}

module.exports = { downloadMedia };
