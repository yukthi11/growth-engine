const { launchBrowser, closeBrowser } = require('../utils/stealthBrowser'); // PHASE 3 CHANGE
const { randomDelay, humanScroll, humanMouseMove } = require('../utils/humanBehavior'); // PHASE 3 CHANGE
const { waitForDomain } = require('../utils/domainRateLimiter'); // PHASE 3 CHANGE

/**
 * Base Scraper Class
 * All scrapers extend this to share browser management and logging.
 */
class BaseScraper {
    constructor(name) {
        this.name = name;
        this.browser = null;
        this.page = null;
        // Injected by scraperWorker to support mid-run cancellation.
        // Should be an async function returning a boolean.
        this.cancelCheck = async () => false;
    }

    /**
     * Convenience: returns true if cancellation has been requested.
     */
    async isCancelRequested() {
        try { return await this.cancelCheck(); } catch (_) { return false; }
    }

    /**
     * Launches a stealth browser and creates a new page.
     */
    async init() {
        const { browser, context } = await launchBrowser(); // PHASE 3 CHANGE
        this.browser = browser;
        this.page = await context.newPage();
        this.log('Browser initialized.');
    }

    /**
     * Closes the browser.
     */
    async close() {
        try {
            if (this.browser) await closeBrowser(this.browser); // PHASE 3 CHANGE
        } catch (e) {
            this.log('Browser already closed or failed to close gracefully.');
        }
    }

    /**
     * Consistent logging.
     */
    log(msg) {
        console.log(`[${this.name}] ${msg}`);
    }

    /**
     * Consistent error logging.
     */
    logError(msg, err) {
        console.error(`[${this.name}] ${msg}`, err?.message || err);
    }

    /**
     * Helper to run the scraper lifecycle.
     */
    async run(query, deep = false) {
        try {
            await this.init();
            const results = await this.scrape(query, deep);
            return results;
        } catch (error) {
            this.logError(`Critical error in ${this.name}`, error);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// Helper available for use in scrapers
global.randomBetween = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports = BaseScraper;

