const DEFAULT_USER_AGENT = 'CivicVoice/1.0 (contact@civicvoice.local)';

async function geocodeLocation(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return null;
  }

  const query = rawText.trim();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('countrycodes', 'in');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const [firstMatch] = Array.isArray(data) ? data : [];

    if (!firstMatch) {
      return null;
    }

    return {
      lat: parseFloat(firstMatch.lat),
      lng: parseFloat(firstMatch.lon),
      displayName: firstMatch.display_name || null,
    };
  } catch (error) {
    return null;
  }
}

module.exports = { geocodeLocation };
