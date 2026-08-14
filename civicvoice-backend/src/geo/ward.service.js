const Ward = require('../models/Ward');
const logger = require('../utils/logger');

async function resolveWard({ lat, lng }) {
  if (lat == null || lng == null) {
    return null;
  }

  try {
    const ward = await Ward.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
        },
      },
    });

    return ward;
  } catch (err) {
    logger.error('Ward resolution failed', { error: err.message, lat, lng });
    return null;
  }
}

module.exports = { resolveWard };
