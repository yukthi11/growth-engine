const { launchBrowser, closeBrowser, createStealthContext } = require('./stealthBrowser');
const { waitForDomain } = require('./domainRateLimiter');
const { randomDelay, humanScroll } = require('./humanBehavior');

/**
 * Analyzes a website for lead generation signals.
 * @param {string} websiteUrl 
 * @param {Object} [options]
 * @param {import('playwright').Browser} [options.browser] - Optional pre-launched browser for reuse
 * @returns {Promise<Object|null>}
 */
async function analyzeWebsite(websiteUrl, options = {}) {
    let browser = options.browser;
    let context, internalBrowser;
    
    try {
        // If no browser provided, launch a one-off
        if (!browser) {
            const launch = await launchBrowser();
            browser = launch.browser;
            internalBrowser = launch.browser;
            context = launch.context;
        } else {
            // Reuse browser, create fresh stealth context
            context = await createStealthContext(browser);
        }

        const page = await context.newPage();

        await waitForDomain(websiteUrl);

        try {
            await page.goto(websiteUrl, {
                waitUntil: 'domcontentloaded', // Faster than 'load'
                timeout: 20000 // Reduced from 30s
            });
        } catch (err) {
            console.error(`[Analyzer] Navigation failed for ${websiteUrl}:`, err.message);
            if (context) await context.close();
            if (internalBrowser) await closeBrowser(internalBrowser);
            return null;
        }

        await randomDelay(400, 800); // Reduced delay
        await humanScroll(page);

        const analysis = await page.evaluate((url) => {
            // ... (rest of the internal evaluation logic remains same)
            // Internal Utilities
            const utils = {
                getContacts: () => {
                    const text = document.body.innerText;
                    const html = document.body.innerHTML;

                    // 1. Emails — regex on visible text + mailto: links
                    const emailRegex = /[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                    let emails = Array.from(new Set(text.match(emailRegex) || []));
                    const mailtos = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
                        .map(a => a.href.replace('mailto:', '').split('?')[0].trim());
                    emails = Array.from(new Set([...emails, ...mailtos]))
                        .filter(e => e.includes('@') && !e.match(/\.(png|jpg|jpeg|gif|svg|css|js|webp)$/i));

                    // ── Phones ──────────────────────────────────────────────
                    // Universal ITU-T: optional + or 0, country code (1–3 digits), 6–14 local digits.
                    // Catches: +1-212-555-1234, +44 20 7946 0958, +971 4 123 4567, 98765 43210, 080-1234-5678
                    const phoneRegex = /(?:\+\d{1,3}[\s\-.]?)?(?:\(?\d{1,4}\)?[\s\-.]?){1,4}\d{4,10}/g;
                    let phones = Array.from(new Set(text.match(phoneRegex) || []))
                        .map(p => p.replace(/[^\d+]/g, ''))
                        .filter(p => p.replace(/\D/g, '').length >= 7 && p.replace(/\D/g, '').length <= 15);

                    // 2. Harvest tel: href links (many sites use these exclusively)
                    const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'))
                        .map(a => a.href.replace(/^tel:/, '').replace(/[^\d+]/g, ''))
                        .filter(p => p.length >= 10 && p.length <= 13);
                    phones = Array.from(new Set([...phones, ...telLinks]));

                    return { emails, phones };
                },
                getAddress: () => {
                    const text = document.body.innerText;
                    // Common State patterns (International friendly)
                    const states = ["Karnataka", "Maharashtra", "Tamil Nadu", "Phuket", "Bangkok", "Berlin", "Bavaria"];
                    let detectedState = states.find(s => text.includes(s)) || ""; // Remove hardcoded Karnataka default

                    // Try to find locality/area via common markers
                    const areaMarkers = ["Locality:", "Area:", "Located at:", "Near", "Behind"];
                    let detectedArea = "Unknown Area";
                    
                    const lines = text.split('\n').filter(l => l.trim().length > 10 && l.trim().length < 100);
                    const addressLine = lines.find(l => l.match(/\d{6}/) || states.some(s => l.includes(s)));
                    
                    if (addressLine) {
                        const parts = addressLine.split(',');
                        if (parts.length > 1) {
                            detectedArea = parts[0].trim();
                        }
                    }

                    return { area: detectedArea, state: detectedState, raw: addressLine };
                },
                getTechStack: () => {
                    const techs = ["wordpress", "shopify", "wix", "squarespace", "jquery", "react", "angular"];
                    const detected = new Set();
                    const generator = document.querySelector('meta[name="generator"]')?.content?.toLowerCase() || '';
                    techs.forEach(t => { if (generator.includes(t)) detected.add(t); });
                    const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src.toLowerCase());
                    scripts.forEach(src => {
                        techs.forEach(t => { if (src.includes(t)) detected.add(t); });
                    });
                    const bodyClass = document.body.className.toLowerCase();
                    techs.forEach(t => { if (bodyClass.includes(t)) detected.add(t); });
                    return Array.from(detected);
                },
                getSocialLinks: () => {
                    const platforms = ["facebook.com", "instagram.com", "linkedin.com", "twitter.com", "youtube.com"];
                    const links = Array.from(document.querySelectorAll('a')).map(a => a.href.toLowerCase());
                    return platforms.filter(p => links.some(link => link.includes(p)));
                },
                getWhatsapp: () => {
                    const links = Array.from(document.querySelectorAll('a')).map(a => a.href.toLowerCase());
                    return links.some(link => link.includes('wa.me') || link.includes('whatsapp.com'));
                },
                getCopyrightYear: () => {
                    const text = document.body.innerText;
                    const match = text.match(/(?:©|copyright|copyright\s+©)\s*(?:20\d{2}-)?(20\d{2})/i);
                    return match ? parseInt(match[1]) : null;
                },
                hasContactForm: () => {
                    const forms = Array.from(document.querySelectorAll('form'));
                    return forms.some(form => {
                        const inputs = Array.from(form.querySelectorAll('input, textarea'));
                        return inputs.some(i => {
                            const type = (i.type || '').toLowerCase();
                            const name = (i.name || '').toLowerCase();
                            const placeholder = (i.placeholder || '').toLowerCase();
                            const id = (i.id || '').toLowerCase();
                            return type === 'email' || type === 'tel' ||
                                name.includes('email') || name.includes('phone') || name.includes('mobile') ||
                                placeholder.includes('email') || placeholder.includes('phone') || placeholder.includes('mobile') ||
                                id.includes('email') || id.includes('phone') || id.includes('mobile');
                        });
                    });
                }
            };

            const contactInfo = utils.getContacts();
            const locationInfo = utils.getAddress();
            const lastUpdatedYear = utils.getCopyrightYear();

            return {
                url: url,
                emails: contactInfo.emails,
                phones: contactInfo.phones,
                location: locationInfo,
                hasContactForm: utils.hasContactForm(),
                isOutdated: lastUpdatedYear ? (new Date().getFullYear() - lastUpdatedYear >= 3) : null,
                lastUpdatedYear: lastUpdatedYear,
                hasSocialLinks: utils.getSocialLinks(),
                mobileResponsive: !!document.querySelector('meta[name="viewport"]'),
                hasWhatsapp: utils.getWhatsapp(),
                techStack: utils.getTechStack(),
                analyzedAt: new Date().toISOString()
            };
        }, websiteUrl);

        // --- CONTACT PAGE PIVOT ---
        // Pivot if the homepage is missing EITHER emails OR phones.
        if (analysis && (analysis.emails.length === 0 || analysis.phones.length === 0)) {

            // ── Strategy 1: Smart two-pass link detection ─────────────────────
            // Pass 1 looks only for 'contact' in href/text — this prevents nav
            // links like "About Us" (matched by 'about') from winning over
            // "Contact Us" when both appear in the same DOM traversal.
            const contactPageUrl = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href]'));

                // Pass 1 — strong signal: href or visible text contains 'contact'
                const strong = links.find(a => {
                    const text = (a.innerText || a.textContent || '').toLowerCase().trim();
                    const href = (a.href || '').toLowerCase();
                    return href.includes('contact') || text.includes('contact');
                });
                if (strong) return strong.href;

                // Pass 2 — fallback signals (deliberately excludes 'about' to avoid false matches)
                const FALLBACK_KW = ['reach us', 'reach-us', 'get in touch', 'touch', 'find us', 'connect', 'location'];
                const fallback = links.find(a => {
                    const text = (a.innerText || a.textContent || '').toLowerCase();
                    const href = (a.href || '').toLowerCase();
                    return FALLBACK_KW.some(k => text.includes(k) || href.includes(k));
                });
                return fallback ? fallback.href : null;
            });

            // ── Strategy 2: Direct URL probing ───────────────────────────────
            // If link detection failed, only probe the single most common fallback
            // to prevent 100+ second sequential 404 delays on slow websites.
            const CONTACT_PATHS = ['/contact', '/about'];
            let urlsToScan = [];
            if (contactPageUrl && contactPageUrl !== websiteUrl) {
                urlsToScan.push(contactPageUrl); // Prioritise discovered link
            }
            // Always probe common paths as additional fallback URLs
            try {
                const origin = new URL(websiteUrl).origin;
                // Cap at maximum 2 URLs to scan to keep analysis under 30 seconds
                for (const p of CONTACT_PATHS) {
                    const candidate = origin + p;
                    if (!urlsToScan.includes(candidate) && urlsToScan.length < 2) {
                        urlsToScan.push(candidate);
                    }
                }
            } catch (_) { }

            // ── Harvest contacts from each candidate page ─────────────────────
            const harvestPage = async (targetUrl) => {
                try {
                    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
                    await randomDelay(800, 1500);

                    return await page.evaluate(() => {
                        const text = document.body.innerText;
                        const html = document.body.innerHTML;

                    // 1. Emails — regex on visible text + mailto: links
                    const emailRegex = /[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                    let emails = Array.from(new Set(text.match(emailRegex) || []));
                        const mailtos = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
                            .map(a => a.href.replace('mailto:', '').split('?')[0].trim());
                        emails = Array.from(new Set([...emails, ...mailtos]))
                            .filter(e => e.includes('@') && !e.match(/\.(png|jpg|jpeg|gif|svg|css|js|webp)$/i));

                        // 2. Phones — text regex
                        const phoneRegex = /(?:\+\d{1,3}[\s\-.]?)?(?:\(?\d{1,4}\)?[\s\-.]?){1,4}\d{4,10}/g;
                        let phones = Array.from(new Set(text.match(phoneRegex) || []))
                            .map(p => p.replace(/[^\d+]/g, ''))
                            .filter(p => p.replace(/\D/g, '').length >= 7 && p.replace(/\D/g, '').length <= 15);

                        // 3. tel: href links
                        const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'))
                            .map(a => a.href.replace(/^tel:/, '').replace(/[^\d+]/g, ''))
                            .filter(p => p.replace(/\D/g, '').length >= 7 && p.replace(/\D/g, '').length <= 15);

                        // 4. WhatsApp wa.me links — many Indian/global businesses
                        //    use only WhatsApp buttons, e.g. href="https://wa.me/918073333129"
                        const waLinks = Array.from(document.querySelectorAll('a[href*="wa.me"]'))
                            .map(a => {
                                const m = a.href.match(/wa\.me\/(?:phone=)?(\+?[\d]{7,15})/);
                                return m ? m[1].replace(/[^\d+]/g, '') : null;
                            })
                            .filter(Boolean);

                        phones = Array.from(new Set([...phones, ...telLinks, ...waLinks]));

                        return { emails, phones };
                    });
                } catch (_) {
                    return null;
                }
            };

            // Stop scanning as soon as we find both email AND phone
            for (const targetUrl of urlsToScan) {
                const stillMissingEmail = analysis.emails.length === 0;
                const stillMissingPhone = analysis.phones.length === 0;
                if (!stillMissingEmail && !stillMissingPhone) break; // Already complete

                console.log(`[Analyzer] Probing: ${targetUrl}`);
                const result = await harvestPage(targetUrl);
                if (!result) continue;

                if (result.emails.length > 0 || result.phones.length > 0) {
                    analysis.emails = Array.from(new Set([...analysis.emails, ...result.emails]));
                    analysis.phones = Array.from(new Set([...analysis.phones, ...result.phones]));
                    console.log(`[Analyzer] ✓ Found at ${targetUrl}: ${result.emails.length} emails, ${result.phones.length} phones`);
                    break; // Stop probing other paths if we found data!
                }
            }
        }

        if (analysis) {
            console.log(`[Analyzer] SUCCESS: Scanned ${websiteUrl}`);
            console.log(` - Harvested: ${analysis.emails.length} emails, ${analysis.phones.length} phones`);
            if (analysis.location && analysis.location.area !== 'Unknown Area') {
                console.log(` - Final Location: ${analysis.location.area}, ${analysis.location.state}`);
            }
        }
        return analysis;
    } catch (error) {
        console.error(`[Analyzer] Error analyzing ${websiteUrl}:`, error);
        return null;
    } finally {
        if (context) await context.close();
        if (internalBrowser) await closeBrowser(internalBrowser);
    }
}

// Test block
async function main() {
    const testUrl = "https://www.tatamotors.com"; // Real Indian business
    console.log(`Starting analysis for: ${testUrl}`);

    const results = await analyzeWebsite(testUrl);

    if (results) {
        console.log("Analysis Result:", JSON.stringify(results, null, 2));
    } else {
        console.log("Analysis failed or returned null.");
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    analyzeWebsite
};
