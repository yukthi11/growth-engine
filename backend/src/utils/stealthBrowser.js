const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

// Add stealth plugin to playwright-extra
chromium.use(stealth);

// PHASE 3 PROFILE FIX: Locked desktop-only profiles
const browserProfiles = [
    {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        viewport: { width: 1366, height: 768 },
        platform: "Win32"
    },
    {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        viewport: { width: 1440, height: 900 },
        platform: "Win32"
    },
    {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
        platform: "MacIntel"
    }
];

/**
 * Launches a standalone browser instance.
 */
async function launchBrowserInstance() {
    return await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars'
        ]
    });
}

/**
 * Creates a new stealth context in an existing browser.
 * @param {import('playwright').Browser} browser 
 */
async function createStealthContext(browser) {
    const profile = browserProfiles[Math.floor(Math.random() * browserProfiles.length)];
    const context = await browser.newContext({
        userAgent: profile.userAgent,
        viewport: profile.viewport,
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata'
    });

    await context.addInitScript((platform) => {
        try {
            const protoDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
            if (protoDesc) delete Navigator.prototype.webdriver;
        } catch (e) { }
        try {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined, enumerable: false, configurable: true });
        } catch (e) { }
        try {
            Object.defineProperty(navigator, 'platform', { get: () => platform });
        } catch (e) { }
    }, profile.platform);

    return context;
}

/**
 * Legacy wrapper: Launches a new browser and a new context.
 * Use for one-off tasks.
 */
async function launchBrowser() {
    const browser = await launchBrowserInstance();
    const context = await createStealthContext(browser);
    return { browser, context };
}

async function closeBrowser(browser) {
    if (browser) {
        try {
            await Promise.race([
                browser.close(),
                new Promise(r => setTimeout(r, 5000))
            ]);
        } catch (e) {
            console.error('[Browser] Force close error:', e.message);
        }
    }
}

module.exports = {
    launchBrowser,
    launchBrowserInstance,
    createStealthContext,
    closeBrowser
};
