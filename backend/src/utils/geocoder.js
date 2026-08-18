const axios = require('axios');
const pool = require('../config/db');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'GrowthEngine-CRM/1.0';
const MIN_REQUEST_INTERVAL_MS = 1100; // Nominatim's usage policy caps free lookups at 1 req/sec

let lastRequestAt = 0;

async function throttle() {
    const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
}

async function readCache(locationText) {
    const result = await pool.query(
        'SELECT lat, lng FROM geocode_cache WHERE location_text = $1',
        [locationText]
    );
    return result.rows[0] || null;
}

async function writeCache(locationText, coords) {
    await pool.query(
        `INSERT INTO geocode_cache (location_text, lat, lng)
         VALUES ($1, $2, $3)
         ON CONFLICT (location_text) DO UPDATE SET lat = $2, lng = $3, geocoded_at = NOW()`,
        [locationText, coords?.lat ?? null, coords?.lng ?? null]
    );
}

async function fetchFromNominatim(locationText) {
    await throttle();
    const response = await axios.get(NOMINATIM_URL, {
        params: { q: locationText, format: 'json', limit: 1 },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 5000,
    });
    const match = response.data?.[0];
    return match ? { lat: parseFloat(match.lat), lng: parseFloat(match.lon) } : null;
}

/**
 * Resolves a free-text location string to {lat, lng} via OpenStreetMap Nominatim.
 * Results — including misses — are cached in Postgres, so this only hits the
 * network the first time a given location string is seen.
 * @param {string} locationText
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
async function geocodeLocation(locationText) {
    const normalized = locationText?.trim().toLowerCase();
    if (!normalized) return null;

    const cached = await readCache(normalized);
    if (cached) {
        return cached.lat != null ? { lat: cached.lat, lng: cached.lng } : null;
    }

    try {
        const coords = await fetchFromNominatim(normalized);
        await writeCache(normalized, coords);
        return coords;
    } catch (err) {
        console.error(`[Geocoder] Failed to geocode "${normalized}":`, err.message);
        return null;
    }
}

module.exports = { geocodeLocation };
