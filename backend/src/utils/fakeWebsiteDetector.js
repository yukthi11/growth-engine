/**
 * fakeWebsiteDetector.js
 *
 * Classifies a URL as a "fake website" — a social media profile, directory
 * listing, link aggregator, or marketplace page that a business has linked
 * as their official website instead of owning a real domain.
 *
 * These leads are high-value targets for a website creation pitch.
 *
 * Usage:
 *   const { classifyWebsite } = require('./fakeWebsiteDetector');
 *   const { isFake, originalUrl } = classifyWebsite('https://instagram.com/mybrand');
 */

/**
 * Exact hostname matches (www. prefix is stripped before comparison).
 * Grouped by category for readability and easy future maintenance.
 */
const FAKE_DOMAINS = new Set([
    // ── Social Media ─────────────────────────────────────────────────────
    'instagram.com',
    'facebook.com', 'fb.com',
    'twitter.com', 'x.com',
    'youtube.com',
    'linkedin.com',
    'vk.com', 'ok.ru',           // Russia / CIS
    'weibo.com',                  // China
    'line.me',                    // Japan / SE Asia
    'kakao.com',                  // Korea

    // ── Link Aggregators / Bio Pages ──────────────────────────────────────
    'linktr.ee', 'beacons.ai', 'bio.site',
    'lnk.bio', 'solo.to', 'about.me',
    'campsite.bio', 'tap.bio', 'carrd.co',

    // ── Messaging / Contact Links ─────────────────────────────────────────
    'wa.me', 'api.whatsapp.com', 't.me', 'm.me',

    // ── Indian Directories & Marketplaces ─────────────────────────────────
    'zomato.com', 'swiggy.com',
    'justdial.com', 'indiamart.com', 'tradeindia.com',
    'practo.com',
    '99acres.com', 'housing.com',
    'meesho.com',

    // ── International Directories & Review Sites ──────────────────────────
    'yelp.com', 'tripadvisor.com',
    'yellowpages.com', 'yell.com', 'checkatrade.com',
    'trustpilot.com', 'foursquare.com',
    'houzz.com', 'thumbtack.com', 'angi.com',
    'bark.com', 'cylex.com', 'manta.com', 'hotfrog.com',

    // ── Global Marketplaces ───────────────────────────────────────────────
    'etsy.com', 'amazon.com', 'ebay.com',
    'alibaba.com', 'aliexpress.com',

    // ── URL Shorteners / Google Links ─────────────────────────────────────
    'g.co', 'goo.gl', 'maps.google.com',
    'bit.ly', 'tinyurl.com', 't.co',
]);

/**
 * Subdomain suffix patterns for website builder platforms.
 *
 * Only non-custom-domain URLs are "fake":
 *   - mystore.myshopify.com  → fake  (no owned domain)
 *   - mystore.com (on Shopify) → real (business owns the domain)
 */
const FAKE_SUBDOMAIN_PATTERNS = [
    '.myshopify.com',
    '.wixsite.com',
    '.weebly.com',
    '.godaddysites.com',
    '.webflow.io',
    '.strikingly.com',
    '.jimdo.com',
    '.yolasite.com',
    '.wordpress.com',
    '.blogspot.com',
    '.tumblr.com',
];

/**
 * Pre-built array of fake domains for subdomain suffix matching.
 * Built once at module load — no per-call overhead.
 * Catches variants like web.facebook.com, m.instagram.com, business.facebook.com, etc.
 */
const FAKE_DOMAIN_LIST = [...FAKE_DOMAINS];

/**
 * Classifies a raw website URL as genuine or fake.
 *
 * Checks in order:
 *   1. Exact hostname match        — facebook.com
 *   2. Subdomain of a fake domain  — web.facebook.com, m.instagram.com
 *   3. Builder platform subdomain  — mystore.myshopify.com
 *
 * @param {string|null} url - Raw website URL from scraper
 * @returns {{ isFake: boolean, originalUrl: string|null }}
 *   - isFake:     true if the URL belongs to a social/directory/builder platform
 *   - originalUrl: the original URL preserved for outreach context (null if not fake)
 */
function classifyWebsite(url) {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
        return { isFake: false, originalUrl: null };
    }

    try {
        const raw = url.trim();
        const normalized = raw.startsWith('http') ? raw : `https://${raw}`;
        const { hostname } = new URL(normalized);
        const host = hostname.replace(/^www\./, '').toLowerCase();

        // 1. Exact match (e.g. facebook.com)
        if (FAKE_DOMAINS.has(host)) {
            return { isFake: true, originalUrl: raw };
        }

        // 2. Subdomain of a fake domain (e.g. web.facebook.com, m.instagram.com)
        const isFakeSubdomain = FAKE_DOMAIN_LIST.some(domain => host.endsWith(`.${domain}`));
        if (isFakeSubdomain) {
            return { isFake: true, originalUrl: raw };
        }

        // 3. Builder platform subdomain (e.g. mystore.myshopify.com)
        const matchedPattern = FAKE_SUBDOMAIN_PATTERNS.find(pattern => host.endsWith(pattern));
        if (matchedPattern) {
            return { isFake: true, originalUrl: raw };
        }

        return { isFake: false, originalUrl: null };
    } catch {
        // Malformed URL — treat conservatively as not fake
        return { isFake: false, originalUrl: null };
    }
}

module.exports = { classifyWebsite };
