const BaseScraper = require('./baseScraper');
const { randomDelay, humanScroll } = require('../utils/humanBehavior');
const { waitForDomain } = require('../utils/domainRateLimiter');
const { fastPrompt } = require('./llmExtractor'); // Tier 2: city neighborhood discovery
const { parseQueryIntent, isStrictMatch, tagProximityLead } = require('../utils/queryIntent');

/**
 * Google Maps Scraper
 * Updated to direct URL-based extraction to avoid context destruction issues.
 * // FIX - URL BASED EXTRACTION
 */
class GoogleMapsScraper extends BaseScraper {
    constructor() {
        super('GoogleMaps');
    }

    async scrape(query, deep = false) {
        const { isProximity, location: expectedLocation, hasLocation } = parseQueryIntent(query);

        if (deep) {
            this.log(`Deep Discovery enabled. Splitting "${query}" into hyper-local sub-queries...`);
            return await this.scrapeDeep(query, expectedLocation);
        }
        return await this.scrapeSingle(query, false, expectedLocation, isProximity, hasLocation);
    }

    /**
     * Internal runner for a single search page.
     */
    async scrapeSingle(query, isSubQuery = false, expectedLocation = null, isProximity = false, hasLocation = false) {
        try {
            const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
            this.log(`Search: ${query}`);

            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

            // STEP 1 - Collect all business data upfront
            await this.page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 }).catch(() => {
                this.log(`No initial results for "${query}"`);
            });
            await randomDelay(2000, 3000);

            // Ensure mouse is over the results scrollable area
            const feedSelector = 'div[role="feed"], [aria-label*="Results"], .m6QErb.dS8AEf';
            const feed = this.page.locator(feedSelector).first();
            if (await feed.count() > 0) {
                await feed.hover().catch(() => { });
            }

            const scrollCount = isSubQuery ? 15 : 5; // Sub-queries don't need 30 scrolls each
            for (let i = 0; i < scrollCount; i++) {
                await humanScroll(this.page);
                await randomDelay(1500, 2500);
            }

            const businessLinks = await this.page.evaluate((limit) => {
                const cards = document.querySelectorAll('a[href*="/maps/place/"]');
                const results = [];
                cards.forEach(card => {
                    const href = card.href;
                    if (!href || results.find(r => r.url === href)) return;

                    const nameEl = card.querySelector('.qBF1Pd, .NrDZNb, [class*="fontHeadline"]');
                    
                    // NEW: Extract the metadata line (e.g., "Restaurant · Kammanahalli")
                    // This is the most reliable way to tell the neighborhood before clicking
                    const container = card.closest('.Nv2Yub, .m6QErb');
                    const subtitleEl = container ? container.querySelector('.W4Efsd:nth-child(2) > .W4Efsd:nth-child(1)') : null;
                    const subtitle = subtitleEl ? subtitleEl.textContent.trim() : '';

                    const name = nameEl?.textContent?.trim()
                        || card.getAttribute('aria-label')?.trim()
                        || null;

                    if (href && name) {
                        results.push({ url: href, businessName: name, subtitle });
                    }
                });
                return results.slice(0, limit);
            }, isSubQuery ? 50 : 25); // Increased search list limit to allow for filtering drops

            this.log(`Found ${businessLinks.length} businesses for query segment.`);

            // STEP 2 - Visit each URL directly and extract details
            const leads = [];
            for (let i = 0; i < businessLinks.length; i++) {
                const { url, businessName, subtitle } = businessLinks[i];

                // --- EARLY SIDEBAR GUARD ---
                if (expectedLocation && subtitle) {
                    const normalizedSub = subtitle.toLowerCase();
                    const target = expectedLocation.toLowerCase().split(' ')[0]; // e.g. "kammanahalli"
                    
                    // If Google shows a neighborhood in the subtitle and it's NOT ours, skip it instantly
                    if (target && !normalizedSub.includes(target) && normalizedSub.includes('·')) {
                        this.log(`[Sidebar Guard] Skipping ${businessName} - Subtitle says "${subtitle}"`);
                        continue;
                    }
                }

                try {
                    await waitForDomain(url);
                    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await randomDelay(1200, 2000);

                    // Phone — selectors are generic so they work for any country
                    let phone = null;
                    const phoneSelectors = [
                        'button[data-item-id*="phone"] .fontBodyMedium',
                        'button[data-item-id*="phone"]',
                        '[data-tooltip*="phone"]',
                        '[data-tooltip*="call"]',
                        'span[aria-label*="phone"]',
                        'span[aria-label*="call"]',
                        'div.ITvuef'
                    ];
                    for (const sel of phoneSelectors) {
                        try {
                            const el = this.page.locator(sel).first();
                            if (await el.count() > 0) {
                                phone = await el.innerText().catch(() => null)
                                    || await el.getAttribute('aria-label').catch(() => null);
                                if (phone && phone.trim()) break;
                            }
                        } catch (_) { }
                    }

                    // Website
                    let website = null;
                    try {
                        const webEl = this.page.locator('a[data-item-id*="authority"], a[aria-label*="Website"]').first();
                        if (await webEl.count() > 0) {
                            website = await webEl.getAttribute('href').catch(() => null);
                        }
                    } catch (_) { }

                    // Address / City
                    let city = expectedLocation || 'Unknown City';
                    let localArea = 'Unknown Area';
                    let fullAddress = '';
                    try {
                        const addressEl = this.page.locator('button[data-item-id*="address"]').first();
                        if (await addressEl.count() > 0) {
                            const rawText = await addressEl.innerText().catch(() => '') || '';
                            // Google Maps injects an "Address\n" or "Address: " label prefix
                            // into innerText — strip it before parsing.
                            fullAddress = rawText
                                .replace(/^address[:\s]*/i, '')
                                .trim();

                            if (fullAddress) {
                                const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
                                const nonNumericParts = parts.filter(p => !/^\d+$/.test(p));
                                city = nonNumericParts[nonNumericParts.length - 2]
                                    || nonNumericParts[nonNumericParts.length - 1]
                                    || expectedLocation
                                    || 'Unknown City';
                                // Strip postal codes e.g. "10117 Berlin" → "Berlin"
                                city = city.replace(/^\d{4,6}\s+/, '').trim();
                                localArea = parts[0] || '';
                            }
                        }
                    } catch (_) { }

                    // The smart location validation is now handled at the end of scrapeSingle using queryIntent

                    leads.push({
                        businessName,
                        phone: phone || null,
                        email: null,
                        website: website || null,
                        location: { localArea, city, address: fullAddress, subtitle },
                        source: 'maps',
                        extractionMethod: 'playwright'
                    });

                } catch (err) { continue; }
            }

            // Filter leads based on query intent (only for direct queries, sub-queries trust Google)
            if (!isSubQuery && hasLocation) {
                const filteredLeads = [];
                for (const lead of leads) {
                    const isExact = isStrictMatch([lead.businessName, lead.location.address, lead.location.localArea, lead.location.subtitle], expectedLocation);
                    
                    if (isProximity) {
                        filteredLeads.push(tagProximityLead(lead, expectedLocation, isExact));
                    } else {
                        const addressParts = (lead.location.address || '').split(',').map(p => p.trim()).filter(Boolean);
                        const isIncompleteAddress = addressParts.length < 3;
                        
                        if (isExact) {
                            filteredLeads.push(tagProximityLead(lead, expectedLocation, true));
                        } else if (isIncompleteAddress) {
                            this.log(`[Location Uncertain] Allowing ${lead.businessName} — address incomplete (${addressParts.length} parts), cannot validate`);
                            filteredLeads.push(tagProximityLead(lead, expectedLocation, false));
                        } else {
                            this.log(`[Location Block] Skipping ${lead.businessName} — address "${lead.location.address}" does not match "${expectedLocation}"`);
                        }
                    }
                }
                return filteredLeads;
            } else if (isSubQuery && expectedLocation) {
                // Sub-queries tag all results for their respective area
                return leads.map(lead => tagProximityLead(lead, expectedLocation, true));
            }

            return leads;
        } catch (error) {
            this.logError('Search segment failed', error);
            return [];
        }
    }

    /**
     * Uses phi3 (Tier 2) to discover the top commercial neighborhoods for any city.
     * Falls back to static Bangalore list if LLM is unavailable or city is unclear.
     */
    async _discoverAreas(city) {
        // Static fallback for Bangalore (most common use-case, no LLM needed)
        const BANGALORE_FALLBACK = [
            'MG Road', 'Brigade Road', 'Residency Road', 'Richmond Town', 'Vasanth Nagar',
            'Indiranagar', 'Domlur', 'Marathahalli', 'Brookefield', 'Whitefield', 'Bellandur',
            'Sarjapur Road', 'Banaswadi', 'Kammanahalli', 'Jayanagar', 'JP Nagar',
            'Banashankari', 'Basavanagudi', 'BTM Layout', 'HSR Layout', 'Electronic City',
            'Rajajinagar', 'Vijayanagar', 'Hebbal', 'Yelahanka', 'RT Nagar',
            'Nagavara', 'Hennur', 'Mahadevapura', 'Panathur', 'Varthur'
        ];

        const isBangalore = /bangalore|bengaluru/i.test(city);
        if (isBangalore) return { areas: BANGALORE_FALLBACK, city: 'Bangalore' };

        try {
            this.log(`Discovering neighborhoods for "${city}" via LLM...`);
            const geographyPrompt = `
You are a geography assistant.

Task:
List the 8 most well-known large administrative districts or neighborhoods in the city: ${city}.

STRICT RULES:
- Return ONLY a valid JSON array of strings. No preamble, no explanation, no markdown.
- NO LANDMARKS (e.g., skip Alexanderplatz, Eiffel Tower, etc.).
- NO STREET NAMES.
- NO COMBINED NAMES (e.g., if you have "Tempelhof-Schöneberg", return them as two separate items "Tempelhof", "Schöneberg").
- Each item must be a distinct district.
- If the city is small, return at least 3 items.

Example: ["Mitte", "Charlottenburg", "Kreuzberg", "Neukölln"]

City: ${city}
`.trim();

            const raw = await fastPrompt(geographyPrompt);
            // Strip markdown fences if model returned them
            const cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/gi, '').trim();
            const areas = JSON.parse(cleaned);

            if (Array.isArray(areas) && areas.length >= 3) {
                this.log(`Discovered ${areas.length} areas for ${city}: ${areas.join(', ')}`);
                return { areas, city };
            }
            throw new Error('LLM returned an invalid area list');
        } catch (err) {
            this.log(`LLM area discovery failed (${err.message}). Defaulting to Bangalore list.`);
            return { areas: BANGALORE_FALLBACK, city: 'Bangalore' };
        }
    }

    /**
     * Splits query into hyper-local areas to bypass Google's 9-result guest wall.
     * Supports any city worldwide via dynamic LLM neighborhood discovery.
     */
    async scrapeDeep(query, manualLocation = null) {
        // Extract city from query: "dance classes in Bangkok" → "Bangkok"
        const cityMatch = query.match(/(?:in|near|at|around|close to|nearby)\s+([\w\s]+?)(?:,|$)/i);
        const detectedCity = cityMatch ? cityMatch[1].trim() : (manualLocation || 'Bangalore');

        const { areas: targetAreas, city } = await this._discoverAreas(detectedCity);
        const combinedLeads = [];
        const seenNames = new Set();

        // Strip the city from the base query to avoid duplication in sub-queries
        const baseQuery = query
            .toLowerCase()
            .replace(new RegExp(`\\s*(?:in|near|at)\\s+${detectedCity}`, 'i'), '')
            .trim();

        this.log(`City: "${city}" | ${targetAreas.length} areas to search | Limit: 100 leads`);

        for (const area of targetAreas) {
            // Check for cancellation before starting each area
            if (await this.isCancelRequested()) {
                this.log(`[Cancel] Cancellation detected — stopping after ${combinedLeads.length} leads.`);
                break;
            }

            const subQuery = `${baseQuery} in ${area}, ${city}`;
            // For sub-queries, the area itself is the expected location.
            // isProximity = false, hasLocation = true
            const subLeads = await this.scrapeSingle(subQuery, true, area, false, true);

            for (const lead of subLeads) {
                if (!seenNames.has(lead.businessName)) {
                    seenNames.add(lead.businessName);
                    combinedLeads.push(lead);
                }
            }

            this.log(`Progress: ${combinedLeads.length} unique leads found so far...`);
            if (combinedLeads.length >= 100) break;

            await randomDelay(3000, 5000); // Breathe between areas
        }

        return combinedLeads;
    }
}

module.exports = GoogleMapsScraper;
