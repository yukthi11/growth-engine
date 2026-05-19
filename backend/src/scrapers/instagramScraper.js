const BaseScraper = require('./baseScraper');
const { searchAndExtract } = require('./llmExtractor');

/**
 * Instagram Scraper — "Invisible Snippet Intelligence" strategy.
 * Extracts contact data from Bing/Google snippets of Instagram business profiles.
 * Instagram's bios (email, phone, website) are indexed by search engines, making
 * direct Instagram access unnecessary and avoiding all login walls.
 */
class InstagramScraper extends BaseScraper {
    constructor() {
        super('Instagram');
    }

    async scrape(query, deep = false) {
        try {
            // Clean query: remove platform mentions to avoid redundant site searches
            const cleanQuery = query.toLowerCase().replace(/on instagram/g, '').replace(/instagram/g, '').trim();
            const encoded = encodeURIComponent(cleanQuery);
            const log = (msg) => this.log(msg);
            const urls = [
                // Pattern 1: Direct IG Bio snippets on Bing
                `https://www.bing.com/search?q=site:instagram.com+${encoded}+bangalore+contact`,
                // Pattern 2: Natural Google search for business profiles
                `https://www.google.com/search?q=${encoded}+instagram+contact+phone+email+bangalore&num=20`
            ];

            if (deep) {
                this.log('Performing deep multi-page Instagram scan (Pages 1-5)...');
                // Google pagination (10 results per page, up to page 5)
                for (let i = 1; i <= 4; i++) {
                    urls.push(`https://www.google.com/search?q=${encoded}+instagram+contact+details+bangalore&start=${i * 10}`);
                }
                // Bing pagination (10 results per page approx)
                for (let i = 1; i <= 3; i++) {
                    urls.push(`https://www.bing.com/search?q=site:instagram.com+${encoded}+bangalore+contact&first=${i * 10 + 1}`);
                }
            }

            const results = [];
            for (const url of urls) {
                const batch = await searchAndExtract(this.page, url, log);
                results.push(...batch);
            }

            // Merge and deduplicate by business_name
            const seen = new Set();
            const deduped = results.filter(biz => {
                if (!biz.business_name) return false;
                const key = biz.business_name.toLowerCase().trim();
                if (key.includes('instagram') || key === 'instagram') return false;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            }).map(biz => ({ 
                ...biz, 
                source: 'Instagram',
                // If social_username was missed by LLM, try to guess from biz name or other info if possible
                instagram_username: biz.social_username || null
            }));

            this.log(`Total unique Instagram leads: ${deduped.length}`);
            return deduped;
        } catch (error) {
            this.logError('Instagram scraper failed', error);
            return [];
        }
    }
}

module.exports = InstagramScraper;
