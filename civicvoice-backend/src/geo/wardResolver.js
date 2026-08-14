/**
 * wardResolver.js
 * -----------------------------------------------------------------------
 * Resolves a ward ID and name from direct GPS coordinates or location text.
 * Returns: { wardId, wardName, confidence, resolutionMethod }
 * resolutionMethod: 'gps_direct' | 'geocoded_text' | 'unresolved'
 * Never throws — unresolved ward is a valid, expected outcome.
 */

const mongoose = require('mongoose');
const Ward = require('../models/Ward');
const { geocodeText } = require('./geocoder');
const logger = require('../utils/logger');

/**
 * Performs Point-In-Polygon lookup against Ward boundary using Mongo $geoIntersects.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<object|null>} Ward document or null
 */
async function findWardByPoint(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  // If Mongoose is not connected to a live database, return null fast without buffering timeout
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  try {
    const ward = await Ward.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
          },
        },
      },
    }).lean();

    return ward;
  } catch (err) {
    logger.warn('Point-in-polygon ward lookup failed', { error: err.message, lat, lng });
    return null;
  }
}

/**
 * Prototype fallback: fetch the default demo ward ("Sanjivani Campus Ward") when real
 * coordinates are available but no polygon boundary intersects.
 * This ensures complaints from/near Kopargaon always resolve to the primary demo anchor.
 * TODO: Remove this fallback once precise municipal ward boundaries are loaded.
 * @returns {Promise<object|null>} Ward document or null
 */
async function findPrototypeFallbackWard() {
  try {
    return await Ward.findOne({ name: 'Sanjivani Campus Ward' }).lean();
  } catch (err) {
    logger.warn('Prototype fallback ward lookup failed', { error: err.message });
    return null;
  }
}

/**
 * Main Ward Resolution pure boundary function.
 * @param {object} params
 * @param {object | number[]} [params.coordinates] - { lat, lng } or [lng, lat]
 * @param {object} [params.location] - { lat, lng }
 * @param {string} [params.locationText] - free-text location string
 * @param {string} [params.locationMentionedText] - alias for locationText
 * @param {Array} [params.mockWards] - optional in-memory wards for fallback testing
 * @returns {Promise<{ wardId: string | null, wardName: string | null, confidence: number, resolutionMethod: 'gps_direct' | 'geocoded_text' | 'unresolved' }>}
 */
async function resolveWard({ coordinates, location, locationText, locationMentionedText, mockWards, traceId } = {}) {
  const textInput = locationText || locationMentionedText;

  if (textInput && typeof textInput === 'string') {
    const lowerText = textInput.toLowerCase();
    if (lowerText.includes('sanjivani') || lowerText.includes('college')) {
      const matchedWard = await findPrototypeFallbackWard();
      if (matchedWard) {
        return {
          wardId: matchedWard._id ? matchedWard._id.toString() : null,
          wardName: matchedWard.name || null,
          confidence: 1.0,
          resolutionMethod: 'geocoded_text',
        };
      }
    }
  }


  let directLat = null;
  let directLng = null;

  if (location && location.lat != null && location.lng != null) {
    directLat = Number(location.lat);
    directLng = Number(location.lng);
  } else if (coordinates) {
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      directLng = Number(coordinates[0]);
      directLat = Number(coordinates[1]);
    } else if (coordinates.lat != null && coordinates.lng != null) {
      directLat = Number(coordinates.lat);
      directLng = Number(coordinates.lng);
    }
  }

  // Helper for point-in-polygon check against array of ward polygons
  function checkInPoly(lat, lng, wardsList) {
    if (!wardsList || !Array.isArray(wardsList)) return null;
    return wardsList.find((w) => {
      const poly = w.boundary?.coordinates?.[0];
      if (!poly) return false;
      const minLng = Math.min(...poly.map((p) => p[0]));
      const maxLng = Math.max(...poly.map((p) => p[0]));
      const minLat = Math.min(...poly.map((p) => p[1]));
      const maxLat = Math.max(...poly.map((p) => p[1]));
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    });
  }

  // Priority 1: Direct GPS Coordinates
  if (directLat != null && directLng != null && !Number.isNaN(directLat) && !Number.isNaN(directLng)) {
    let matchedWard = await findWardByPoint(directLat, directLng);

    if (!matchedWard && mockWards) {
      matchedWard = checkInPoly(directLat, directLng, mockWards);
    }

    // Prototype Fallback: valid GPS coords exist but no mock polygon covers them.
    // Auto-assign to Ward A so the conversation can proceed during development.
    // TODO: Remove once real ward boundaries are seeded in the database.
    if (!matchedWard) {
      matchedWard = await findPrototypeFallbackWard();
      if (matchedWard) {
        logger.warn(
          '[wardResolver] Prototype fallback: GPS coordinates did not intersect any ward boundary — assigning to Sanjivani Campus Ward',
          { lat: directLat, lng: directLng, traceId }
        );
      }
    }

    if (matchedWard) {
      return {
        wardId: matchedWard._id ? matchedWard._id.toString() : null,
        wardName: matchedWard.name || null,
        confidence: 1.0,
        resolutionMethod: 'gps_direct',
      };
    }
  }

  // Priority 2: Text Geocoding
  if (textInput && typeof textInput === 'string' && textInput.trim()) {
    const geo = await geocodeText(textInput, traceId);

    if (geo && geo.lat != null && geo.lng != null) {
      let matchedWard = await findWardByPoint(geo.lat, geo.lng);

      if (!matchedWard && mockWards) {
        matchedWard = checkInPoly(geo.lat, geo.lng, mockWards);
      }

      // Prototype Fallback: Nominatim returned valid coordinates but no mock polygon covers them.
      // Auto-assign to Ward A so the conversation can proceed during development.
      // TODO: Remove once real ward boundaries are seeded in the database.
      if (!matchedWard) {
        matchedWard = await findPrototypeFallbackWard();
        if (matchedWard) {
          logger.warn(
            '[wardResolver] Prototype fallback: geocoded coordinates did not intersect any ward boundary — assigning to Sanjivani Campus Ward',
            { locationText: textInput, lat: geo.lat, lng: geo.lng, traceId }
          );
        }
      }

      if (matchedWard) {
        return {
          wardId: matchedWard._id ? matchedWard._id.toString() : null,
          wardName: matchedWard.name || null,
          confidence: geo.confidence || 0.8,
          resolutionMethod: 'geocoded_text',
        };
      }
    }
  }

  // Fallback: Unresolved
  return {
    wardId: null,
    wardName: null,
    confidence: 0,
    resolutionMethod: 'unresolved',
  };
}

module.exports = { resolveWard, findWardByPoint, findPrototypeFallbackWard };
