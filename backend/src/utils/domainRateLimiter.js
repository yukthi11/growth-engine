const Redis = require('ioredis');

let redis = null;
let lastWarningTime = 0;
const WARNING_COOLDOWN = 30000;

const getRedis = () => {
    if (!redis) {
        const REDIS_URL = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
        redis = new Redis(REDIS_URL, { lazyConnect: true });
        redis.on('error', (err) => {
            const now = Date.now();
            if (err.code === 'ECONNREFUSED') {
                if (now - lastWarningTime > WARNING_COOLDOWN) {
                    console.warn(`[RateLimiter] Redis unavailable. Rate limiting will be bypassed.`);
                    lastWarningTime = now;
                }
                return; // Suppress trace
            }
        });
    }
    return redis;
};

const minDelayMap = {
    "google.com": 3000,
    "maps.google.com": 4000,
    "justdial.com": 5000,
    "indiamart.com": 4000,
    "facebook.com": 6000,
    "instagram.com": 6000,
    "yellowpages.com": 3000,
    "default": 3000
};

/**
 * Extracts the root domain from a URL or domain string.
 * @param {string} input 
 * @returns {string}
 */
function getRootDomain(input) {
    try {
        const url = new URL(input.startsWith('http') ? input : `http://${input}`);
        let hostname = url.hostname;

        // Remove 'www.' if present
        if (hostname.startsWith('www.')) {
            hostname = hostname.slice(4);
        }

        // specific check for maps.google.com as it's in our map
        if (hostname === 'maps.google.com') return hostname;

        return hostname;
    } catch (e) {
        return input;
    }
}

/**
 * Waits for the per-domain rate limit to satisfy before proceeding.
 * @param {string} input domain or URL 
 * @returns {Promise<number>} Returns the time waited in ms
 */
async function waitForDomain(input) {
    const domain = getRootDomain(input);
    const minDelay = minDelayMap[domain] || minDelayMap['default'];
    const key = `ratelimit:${domain}`;

    const redis = getRedis();
    let waitTime = 0;

    try {
        const lastTimeStr = await redis.get(key);
        if (lastTimeStr) {
            const lastTime = parseInt(lastTimeStr);
            const currentTime = Date.now();
            const elapsed = currentTime - lastTime;

            if (elapsed < minDelay) {
                waitTime = minDelay - elapsed;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        await redis.set(key, Date.now(), 'EX', 300);
    } catch (e) {
        // Fallback: Skip rate limiting if Redis is down
        console.warn(`[RateLimiter] Skipping limit check for ${domain}: Redis unavailable`);
    }
    
    return waitTime;
}

/**
 * Clears the rate limit for a domain.
 * @param {string} input 
 */
async function clearDomainLimit(input) {
    const domain = getRootDomain(input);
    const key = `ratelimit:${domain}`;
    try {
        await getRedis().del(key);
    } catch (e) {
        // Silent fail
    }
}

// Test block
async function main() {
    const testDomain = "justdial.com";

    try {
        console.log(`Testing rate limits for ${testDomain}...`);

        // Ensure clean start for test
        await clearDomainLimit(testDomain);

        const start1 = Date.now();
        const wait1 = await waitForDomain(testDomain);
        console.log(`Call 1: Waited ${wait1}ms (Actual elapsed: ${Date.now() - start1}ms)`);

        const start2 = Date.now();
        const wait2 = await waitForDomain(testDomain);
        console.log(`Call 2: Waited ${wait2}ms (Actual elapsed: ${Date.now() - start2}ms)`);

        // Close redis connection only if we're done
        await redis.quit();
    } catch (error) {
        console.error("Error in domainRateLimiter main:", error);
        redis.disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    waitForDomain,
    clearDomainLimit
};
