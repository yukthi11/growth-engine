const BaseScraper = require('./baseScraper');
const { searchAndExtract } = require('./llmExtractor');

/**
 * Facebook Pages Scraper — "Invisible Snippet Intelligence" strategy.
 * Instead of logging in or visiting Facebook directly, we use Bing and Google search
 * snippets which freely expose contact data from Facebook Page "About" sections.
 * Uses the shared searchAndExtract DRY helper.
 */
class FacebookScraper extends BaseScraper {
    constructor() {
        super('Facebook');
    }

    async scrape(query, deep = false) {
        try {
            const cleanQuery = query.toLowerCase().replace(/on facebook/g, '').replace(/facebook/g, '').trim();
            const encoded = encodeURIComponent(cleanQuery);
            const log = (msg) => this.log(msg);
            const urls = [
                `https://www.bing.com/search?q=site:facebook.com+${encoded}+bangalore+contact`,
                `https://www.google.com/search?q=${encoded}+facebook+contact+phone+email+bangalore&num=20`
            ];

            if (deep) {
                this.log('Performing deep multi-page Facebook scan (Pages 1-5)...');
                for (let i = 1; i <= 4; i++) {
                    urls.push(`https://www.google.com/search?q=${encoded}+facebook+contact+details+bangalore&start=${i * 10}`);
                }
                for (let i = 1; i <= 3; i++) {
                    urls.push(`https://www.bing.com/search?q=site:facebook.com+${encoded}+bangalore+contact&first=${i * 10 + 1}`);
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
                if (key.includes('facebook') || key === 'facebook') return false;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            }).map(biz => ({ 
                ...biz, 
                source: 'Facebook',
                facebook_username: biz.social_username || null
            }));

            this.log(`Total unique Facebook leads: ${deduped.length}`);
            return deduped;
        } catch (error) {
            this.logError('Facebook scraper failed', error);
            return [];
        }
    }
}

module.exports = FacebookScraper;
