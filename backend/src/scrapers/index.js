const BaseScraper = require('./baseScraper');
const GoogleMapsScraper = require('./googleMapsScraper');
const JustdialScraper = require('./justdialScraper');
const InstagramScraper = require('./instagramScraper');
const FacebookScraper = require('./facebookScraper');
const LinkedInScraper = require('./linkedinScraper');


/**
 * Scraper Registry
 * ─────────────────────────────────────────────────────────────────────
 * Keys: what the frontend/API calls
 * Values: factory functions that return a new scraper instance
 */
const SCRAPERS = {
    // ── Directories ──────────────────────────────────
    'google_maps': () => new GoogleMapsScraper(),
    'justdial': () => new JustdialScraper(),

    // ── Social Media ─────────────────────────────────
    'facebook': () => new FacebookScraper(),
    'instagram': () => new InstagramScraper(),
    'linkedin': () => new LinkedInScraper(),
};

/**
 * Returns a new instance of the requested scraper.
 * @param {string} sourceName - Key from SCRAPERS registry
 * @returns {BaseScraper}
 */
function getScraper(sourceName) {
    const factory = SCRAPERS[sourceName];
    if (!factory) {
        throw new Error(`Unknown scraper: "${sourceName}". Available: ${Object.keys(SCRAPERS).join(', ')}`);
    }
    return factory();
}

/**
 * Returns list of all available scraper names.
 * @returns {string[]}
 */
function getAvailableSources() {
    return Object.keys(SCRAPERS);
}

module.exports = { getScraper, getAvailableSources };
