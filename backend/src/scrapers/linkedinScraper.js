const BaseScraper = require('./baseScraper');
const { searchAndExtract } = require('./llmExtractor');

/**
 * LinkedIn Scraper — "Invisible Snippet Intelligence" strategy.
 * Instead of logging in or visiting LinkedIn directly, we use Bing and Google search
 * snippets which freely expose contact data from LinkedIn Company pages.
 * 
 * Searching 'site:linkedin.com/company [query] contact' on Bing often reveals emails/phones.
 */
class LinkedInScraper extends BaseScraper {
    constructor() {
        super('LinkedIn');
    }

    async scrape(query, deep = false) {
        try {
            const cleanQuery = query.toLowerCase().replace(/on linkedin/g, '').replace(/linkedin/g, '').trim();
            const encoded = encodeURIComponent(cleanQuery);
            const log = (msg) => this.log(msg);
            const urls = [
                `https://www.bing.com/search?q=site:linkedin.com/company+${encoded}+bangalore+contact`,
                `https://www.google.com/search?q=${encoded}+linkedin+contact+phone+email+bangalore&num=20`
            ];

            if (deep) {
                this.log('Performing deep multi-page LinkedIn scan (Pages 1-5)...');
                for (let i = 1; i <= 4; i++) {
                    urls.push(`https://www.google.com/search?q=${encoded}+linkedin+company+contact+details+bangalore&start=${i * 10}`);
                }
                for (let i = 1; i <= 3; i++) {
                    urls.push(`https://www.bing.com/search?q=site:linkedin.com/company+${encoded}+bangalore+contact&first=${i * 10 + 1}`);
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
                // Filter out common LinkedIn noise
                if (key.includes('linkedin') || key === 'linkedin') return false;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            }).map(biz => ({ 
                ...biz, 
                source: 'LinkedIn',
                linkedin_company_id: biz.social_username || null
            }));

            this.log(`Total unique LinkedIn leads: ${deduped.length}`);
            return deduped;
        } catch (error) {
            this.logError('LinkedIn scraper failed', error);
            return [];
        }
    }
}

module.exports = LinkedInScraper;
