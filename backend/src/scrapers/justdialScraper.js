const BaseScraper = require('./baseScraper');
const { randomDelay, humanScroll } = require('../utils/humanBehavior');
const { parseQueryIntent, isStrictMatch, tagProximityLead } = require('../utils/queryIntent');

/**
 * JustDial Scraper
 *
 * Confirmed DOM structure (browser-verified 2026-04-11):
 *   Card:    .resultbox                  (10 per page)
 *   Name:    .resultbox_title_anchor
 *   Address: .resultbox_address
 *   Phone:   .callNowAnchor             (renders EMPTY on load — must click to reveal)
 *
 * JustDial hides phone numbers behind a login/click gate.
 * Strategy: click the .callNowAnchor button, wait for a <span> with digits to appear,
 * then read it. If still empty (login required), save the lead without a phone —
 * name + address is still valuable for outreach.
 *
 * URL Pattern:
 *   https://www.justdial.com/{City}/{Category}-in-{Area}
 *   e.g. https://www.justdial.com/Bangalore/Restaurants-in-Koramangala
 */
class JustdialScraper extends BaseScraper {
    constructor() {
        super('Justdial');
    }

    /**
     * Converts a slug ("Hsr-Layout") or raw area name to a
     * canonical lowercase space-separated string for address matching.
     * e.g. "Hsr-Layout" → "hsr layout"
     */
    _normalizeAreaForMatch(area) {
        if (!area) return null;
        return area.toLowerCase().replace(/-/g, ' ').trim();
    }

    /**
     * Parses a freeform query into a JustDial URL.
     * "restaurants in koramangala" → /Bangalore/Restaurants-in-Koramangala
     * "hospitals in bangalore"     → /Bangalore/Hospitals
     */
    parseQuery(query) {
        const DEFAULT_CITY = 'Bangalore';
        // JD routes rely heavily on Top Cities vs Areas.
        const KNOWN_CITIES = [
            'mumbai', 'delhi', 'pune', 'chennai', 'hyderabad', 'kolkata', 'ahmedabad',
            'bangalore', 'bengaluru', 'noida', 'gurugram', 'gurgaon', 'chandigarh', 'jaipur'
        ];

        const lower = query.toLowerCase();
        let city = DEFAULT_CITY;
        let areaSlug = null;
        let category = query;

        const locationMatch = lower.match(/\s+(in|near|around|at|close to|nearby)\s+(.*)/i);
        if (locationMatch) {
            category = query.substring(0, locationMatch.index).trim();
            // User might type "Bagalur, Bangalore, India"
            let locationName = locationMatch[2].trim().split(',')[0].trim();
            const stripped = locationName.replace(/\b(bangalore|bengaluru|india|karnataka)\b/gi, '').trim();

            // If stripping leaves nothing (e.g., they searched "gyms in bangalore"), use the original
            if (stripped.length > 0) {
                locationName = stripped;
            }

            const locationLower = locationName.toLowerCase();

            // Check if the location is a major Indian city
            const isCity = KNOWN_CITIES.some(c => locationLower === c || locationLower.includes(c));

            if (isCity) {
                // It's a top-level city search: "gyms in pune" → /Pune/Gyms
                city = locationName.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
                areaSlug = null;
            } else {
                // It's a hyper-local area search: "universities in bagalur" → /Bangalore/Universities-in-Bagalur
                city = DEFAULT_CITY;
                areaSlug = locationName.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
            }
        }

        category = category
            .replace(/\b(bangalore|bengaluru)\b/gi, '')
            .trim()
            .split(/\s+/)
            .map(w => w[0]?.toUpperCase() + w.slice(1))
            .join('-');

        const urlPath = areaSlug
            ? `/${city}/${category}-in-${areaSlug}`
            : `/${city}/${category}`;

        const url = `https://www.justdial.com${urlPath}`;
        this.log(`Parsed: "${query}" → ${url}`);
        return { city, category, area: areaSlug, url };
    }

    /**
     * Tries to reveal a phone number from a JustDial card.
     *
     * JustDial renders .callNowAnchor as an empty div on page load.
     * Clicking it triggers their lazy-load which injects a <span> with the number.
     * If still empty after click (login wall), we fall back to an HTML regex scan.
     */
    async extractPhone(card) {
        try {
            // First: Look for a visible 10-11 digit Indian phone number directly in the card text (JD's new UI)
            const rawText = await card.innerText().catch(() => '');
            const textMatch = rawText.match(/(?:^|\s)(0?\d{10})(?:\s|$)/);
            if (textMatch) return textMatch[1];

            const callBtn = card.locator('.callNowAnchor').first();
            if (await callBtn.count() === 0) {
                // If callNowAnchor is missing, do a final regex scan of raw HTML for href="tel:"
                const html = await card.innerHTML().catch(() => '');
                const telMatch = html.match(/tel:([\d+\-\s]{7,15})/);
                return telMatch ? telMatch[1].replace(/\D/g, '') : null;
            }

            // Second: Try reading the parent element (JD often renders phone text next to the callNowAnchor span)
            const parent = callBtn.locator('xpath=..').first();
            if (await parent.count() > 0) {
                const pText = await parent.textContent().catch(() => '');
                const pDigits = pText.replace(/[^\d]/g, '');
                if (pDigits.length >= 10) return pDigits;
            }

            // Fallback: Click-to-reveal (Old JD UI behavior)
            await callBtn.click({ force: true, timeout: 2000 }).catch(() => { });
            await randomDelay(1200, 2000);

            // JD injects a span with the number after click
            const spanText = await callBtn.locator('span').first()
                .textContent({ timeout: 2000 }).catch(() => null);
            if (spanText) {
                const digits = spanText.replace(/[^\d+]/g, '');
                if (digits.length >= 7) return digits;
            }
        } catch { /* click failed — fall through */ }

        // Last resort: regex scan of raw card HTML for any data attributes
        const html = await card.innerHTML().catch(() => '');
        const match = html.match(/data-(?:mobile|phone)=["']([\d+\-\s]{7,15})["']/);
        return match ? match[1].replace(/\D/g, '') : null;
    }

    /**
     * Extracts all leads from the current page.
     */
    async extractCardsFromPage() {
        await this.page.waitForSelector('.resultbox', { timeout: 15000 });
        const cards = await this.page.locator('.resultbox').all();
        this.log(`Found ${cards.length} cards on this page`);

        const leads = [];
        const skipCities = [
            'Mumbai', 'Pune', 'Delhi', 'Chennai', 'Hyderabad', 'Kolkata', 'Ahmedabad',
            'Bhopal', 'Davangere', 'Gadag', 'Satna', 'Udaipur', 'Gangtok', 'Mohali',
            'Chandigarh', 'Indore', 'Lucknow', 'Noida', 'Gurugram', 'Gurgaon', 'Jaipur',
            'Surat', 'Nagpur', 'Patna', 'Kanpur', 'Thane', 'Agra', 'Nashik', 'Faridabad',
            'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar',
            // States
            'Madhya Pradesh', 'Maharashtra', 'Gujarat', 'Rajasthan', 'Punjab', 'Haryana',
            'Uttar Pradesh', 'Kerala', 'Tamil Nadu', 'West Bengal', 'Bihar', 'Odisha',
            'Jharkhand', 'Chhattisgarh', 'Assam', 'Himachal', 'Uttarakhand'
        ].filter(c => c.toLowerCase() !== this.currentCity?.toLowerCase());

        for (let i = 0; i < cards.length; i++) {
            try {
                await cards[i].scrollIntoViewIfNeeded();
                await randomDelay(300, 600);

                // Name
                const businessName = await cards[i].locator('.resultbox_title_anchorbox, .resultbox_title_anchor').first()
                    .textContent({ timeout: 3000 }).catch(() => null);
                if (!businessName?.trim()) continue;

                // JD removed the local street from the address DOM element.
                // However, the full title attribute contains "Business Name Full Address"
                const titleAttr = await cards[i].locator('.resultbox_title_anchorbox, .resultbox_title_anchor').first()
                    .getAttribute('title').catch(() => '');
                
                // Address (might just say "Bangalore" now)
                const address = await cards[i].locator('.resultbox_textbox address, .resultbox_address').first()
                    .textContent({ timeout: 2000 }).catch(() => null);
                
                // For Area Guard, we combine whatever address text we found + the hidden title attribute
                const fullAddressString = `${address || ''} ${titleAttr || ''}`.trim();
                const localArea = titleAttr ? titleAttr.split(',').slice(-2)[0]?.trim() : (address?.split(',')[0]?.trim() || '');

                // Location guard: skip cards injected from other cities or areas
                const addressLower = fullAddressString.toLowerCase();
                const nameLower = businessName.toLowerCase();
                const isOutsideCity = skipCities.some(city =>
                    (addressLower.includes(city.toLowerCase()) || nameLower.includes(city.toLowerCase())) &&
                    (!this.currentCity || !addressLower.includes(this.currentCity.toLowerCase()))
                );

                if (isOutsideCity) {
                    this.log(`[SKIP] Outside target city (${this.currentCity}): ${businessName} | ${address}`);
                    continue;
                }

                // Ad Blocker: Actively reject JD's injected "Sponsored" or "Ad" cards
                // Note: We use strict text matching to avoid falsely flagging legitimate classes like 'address'
                const isSponsored = await cards[i].locator('[class*="sponsored"], :text-is("Ad"), :text-is("Sponsored")').count() > 0;
                if (isSponsored) {
                    this.log(`[Ad Blocker] Skipping Sponsored Ad: ${businessName} | ${localArea}`);
                    continue;
                }

                // Strict Area Guard — now handled by queryIntent
                const { isProximity, location: expectedLocation, hasLocation } = this.queryIntent || {};
                let isExact = false;

                if (hasLocation && expectedLocation) {
                    console.log(`[DEBUG Area Guard] businessName: "${businessName}", addressLower: "${addressLower}", localArea: "${localArea}"`);
                    isExact = isStrictMatch([businessName, addressLower, localArea], expectedLocation);
                    if (!isProximity && !isExact) {
                        this.log(`[Area Guard] Skipping ${businessName} - Not in ${expectedLocation}`);
                        continue;
                    }
                }

                // Phone — click-to-reveal strategy
                const phone = await this.extractPhone(cards[i]);

                const lead = {
                    businessName: businessName.trim(),
                    phone: phone || null,
                    email: null,
                    website: null,
                    address: address?.trim()?.replace(/\s+/g, ' ') || null,
                    location: { localArea, city: this.currentCity || 'Bangalore' },
                    source: 'justdial',
                    extractionMethod: 'playwright-dom'
                };

                if (hasLocation && expectedLocation) {
                    tagProximityLead(lead, expectedLocation, isExact);
                }

                leads.push(lead);

                this.log(`[${i + 1}/${cards.length}] ${businessName.trim()} | ${phone || 'no phone'} | ${localArea}`);
                await randomDelay(400, 700);

            } catch (err) {
                this.log(`Card ${i + 1} failed: ${err.message}`);
            }
        }

        return leads;
    }

    async scrape(query, deep = false) {
        const allLeads = [];
        try {
            this.queryIntent = parseQueryIntent(query);
            const { url, city, area } = this.parseQuery(query);
            this.currentCity = city;
            // The URL generation still uses the parsed area slug, but strict matching
            // relies purely on queryIntent now.
            this.log(`Navigating to Justdial: ${url} (Deep: ${deep})`);
            this.log(`[Area Guard] Intent parsed: ${JSON.stringify(this.queryIntent)}`);

            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

            // JustDial is extremely JS-heavy. We must wait for the cards to actually hydrate.
            this.log('Waiting for results to hydrate...');
            const cardsVisible = await this.page.waitForSelector('.resultbox', { timeout: 10000 }).catch(() => null);

            if (!cardsVisible) {
                // Try one "wake-up" scroll — JD sometimes requires a scroll to populate the skeleton
                this.log('Cards not immediately found. Attempting "wake-up" scroll...');
                await this.page.evaluate(() => window.scrollBy(0, 500));
                await randomDelay(2000, 4000);
            }

            const cardCount = await this.page.locator('.resultbox').count().catch(() => 0);
            if (cardCount === 0) {
                this.log('No .resultbox cards found after wait. JustDial may have no results for this query or showed a CAPTCHA.');
                return allLeads;
            }

            this.log(`Confirmed ${cardCount} results. Starting extraction...`);
            await randomDelay(2000, 4000);

            // Phase 1: First page
            const page1Leads = await this.extractCardsFromPage();
            allLeads.push(...page1Leads);

            // Phase 2: Pagination (deep mode only)
            const maxPasses = deep ? 25 : 1;
            for (let pass = 1; pass <= maxPasses; pass++) {
                // Check for cancellation before each page
                if (await this.isCancelRequested()) {
                    this.log(`[Cancel] Cancellation detected at pagination pass ${pass} — stopping.`);
                    break;
                }
                this.log(`Deep Discovery pass ${pass}/${maxPasses}...`);

                try {
                    await humanScroll(this.page);
                    await randomDelay(2000, 3500);

                    const nextBtn = this.page.locator(
                        '[class*="pagination"] a:has-text("Next"), ' +
                        'a:has-text("Load More"), ' +
                        '.next_page, .nextpage'
                    ).first();

                    if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
                        await nextBtn.click();
                        await randomDelay(3000, 5000);
                        await this.page.waitForSelector('.resultbox', { timeout: 10000 });

                        const nextLeads = await this.extractCardsFromPage();
                        allLeads.push(...nextLeads);
                        this.log(`Pass ${pass} added ${nextLeads.length} more leads.`);

                        // Deduplicate in-memory
                        const seen = new Set();
                        const unique = allLeads.filter(l => {
                            if (seen.has(l.businessName)) return false;
                            seen.add(l.businessName);
                            return true;
                        });
                        allLeads.length = 0;
                        allLeads.push(...unique);
                    } else {
                        this.log('No more pagination found.');
                        break;
                    }
                } catch (paginationErr) {
                    this.log(`Pagination failed at pass ${pass}: ${paginationErr.message}`);
                    break;
                }
            }

            this.log(`Total extracted: ${allLeads.length} unique leads`);
            return allLeads;

        } catch (error) {
            this.logError('JustDial scrape failed', error);
            return allLeads;
        }
    }
}

module.exports = JustdialScraper;
