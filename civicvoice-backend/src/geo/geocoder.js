/**
 * geocoder.js
 * -----------------------------------------------------------------------
 * Text-to-coordinates geocoding using OpenStreetMap Nominatim.
 * Returns { lat, lng, confidence } or { lat: null, lng: null, confidence: 0 } on failure.
 * Never throws — resolution failure is a valid, expected outcome.
 */

const USER_AGENT = 'CivicVoice-Geocoder/1.0 (contact@civicvoice.org)';

/**
 * Geocodes free-text location description into approximate GPS coordinates.
 * @param {string} locationText
 * @param {string|null} [traceId]
 * @returns {Promise<{ lat: number | null, lng: number | null, confidence: number }>}
 */
async function geocodeText(locationText, traceId = null) {
  if (!locationText || typeof locationText !== 'string' || !locationText.trim()) {
    return { lat: null, lng: null, confidence: 0 };
  }

  const query = locationText.trim();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('countrycodes', 'in');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim geocoding API returned status ${response.status}`);
    }

    const data = await response.json();
    const [firstMatch] = Array.isArray(data) ? data : [];

    if (!firstMatch) {
      throw new Error('Nominatim returned empty results array');
    }

    const lat = parseFloat(firstMatch.lat);
    const lng = parseFloat(firstMatch.lon);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new Error('Nominatim returned invalid coordinates');
    }

    // Estimate confidence score based on Nominatim importance rating or match type
    const rawImportance = parseFloat(firstMatch.importance || 0.6);
    const confidence = Math.min(1.0, Math.max(0.4, Number(rawImportance.toFixed(2))));

    return { lat, lng, confidence };
  } catch (err) {
    const logger = require('../utils/logger');
    logger.error('Nominatim geocoding call failed', {
      timestamp: new Date().toISOString(),
      step: 'geocoding',
      traceId,
      error: err.message,
      stack: err.stack,
      context: {
        locationText
      }
    });
    const { trackServiceFailure } = require('../utils/redis');
    await trackServiceFailure('geocoding', traceId).catch(() => {});
    return { lat: null, lng: null, confidence: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { geocodeText };
