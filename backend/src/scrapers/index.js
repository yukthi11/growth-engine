const BaseScraper = require('./baseScraper');
const GoogleMapsScraper = require('./googleMapsScraper');
const JustdialScraper = require('./justdialScraper');
// const IndiaMartScraper = require('./indiamartScraper');
// const SulekhaScraper = require('./sulekhaScraper');
const InstagramScraper = require('./instagramScraper');
const FacebookScraper = require('./facebookScraper');
const LinkedInScraper = require('./linkedinScraper');
// const ArticleScraper = require('./articleScraper');
// const YellowPagesScraper = require('./yellowpagesScraper');
// const GrotalScraper = require('./grotalScraper');
// const NearFoxScraper = require('./nearfoxScraper');
// const TradeIndiaScraper = require('./tradeIndiaScraper');
// const ExportersIndiaScraper = require('./exportersIndiaScraper');
// const EtsyScraper = require('./etsyScraper');
// const TravelTriangleScraper = require('./traveltriangleScraper');


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
    // 'indiamart': () => new IndiaMartScraper(),
    // 'sulekha': () => new SulekhaScraper(),
    // 'yellowpages': () => new YellowPagesScraper(),
    // 'grotal': () => new GrotalScraper(),
    // 'nearfox': () => new NearFoxScraper(),
    // 'tradeindia': () => new TradeIndiaScraper(),
    // 'exportersindia': () => new ExportersIndiaScraper(),
    // 'etsy': () => new EtsyScraper(),
    // 'traveltriangle': () => new TravelTriangleScraper(),

    // ── Social Media ─────────────────────────────────
    'facebook': () => new FacebookScraper(),
    'instagram': () => new InstagramScraper(),
    'linkedin': () => new LinkedInScraper(),
    // 'article_explorer': () => new ArticleScraper(),
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
