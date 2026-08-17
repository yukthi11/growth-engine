const pool = require('../config/db');
const crypto = require('crypto');

/**
 * AI Cache Utility - To save tokens and costs.
 * Persists LLM responses in the database using a hashed cache key.
 */
class AICache {
    /**
     * Attempts to retrieve a cached response for a given prompt/input.
     * @param {string} input - The full prompt + content
     * @returns {Promise<string|null>} - The cached response or null
     */
    static async get(input) {
        if (!input) return null;
        try {
            const cacheKey = crypto.createHash('md5').update(input).digest('hex');
            const res = await pool.query('SELECT response FROM ai_cache WHERE cache_key = $1 LIMIT 1', [cacheKey]);
            if (res.rowCount > 0) {
                const raw = res.rows[0].response;
                // Self-heal: strip thinking-model tags from any stale cached response
                const cleaned = raw
                    .replace(/<think>[\s\S]*?<\/think>/gi, '')
                    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
                    .trim();
                console.log(`[AI Cache] HIT: Reusing response for ${cacheKey}`);
                return cleaned;
            }
            return null;
        } catch (err) {
            console.error('[AI Cache] Get failed:', err.message);
            return null;
        }
    }

    /**
     * Stores an LLM response in the cache.
     * @param {string} input - The original prompt/input used to generate the response
     * @param {string} response - The response text to cache
     */
    static async set(input, response) {
        if (!input || !response) return;
        try {
            const cacheKey = crypto.createHash('md5').update(input).digest('hex');
            await pool.query(
                // DO UPDATE so fresh responses can overwrite previously bad/stale entries
                'INSERT INTO ai_cache (cache_key, response) VALUES ($1, $2) ON CONFLICT (cache_key) DO UPDATE SET response = EXCLUDED.response',
                [cacheKey, response]
            );
        } catch (err) {
            console.error('[AI Cache] Set failed:', err.message);
        }
    }

    /**
     * Clears old cache entries (older than 30 days).
     */
    static async clearStale() {
        try {
            await pool.query("DELETE FROM ai_cache WHERE created_at < NOW() - INTERVAL '30 days'");
        } catch (err) {
            console.error('[AI Cache] Clear failed:', err.message);
        }
    }
}

module.exports = AICache;
