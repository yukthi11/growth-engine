-- Migration Phase 7: Geocode Cache
-- Backs the Geospatial Command Center map with real geocoding (OpenStreetMap
-- Nominatim) instead of a hardcoded city dictionary. Caches lookups — including
-- misses (lat/lng NULL) — so repeat requests never re-hit the geocoding API.
CREATE TABLE IF NOT EXISTS geocode_cache (
    location_text VARCHAR(500) PRIMARY KEY,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    geocoded_at TIMESTAMP DEFAULT NOW()
);
