const stringSimilarity = require('string-similarity');

/**
 * Parses a freeform query string to determine location and user intent.
 * @param {string} query 
 * @returns {Object} { isProximity, location, hasLocation }
 */
function parseQueryIntent(query) {
    if (!query) return { isProximity: false, location: null, hasLocation: false };

    // Matches "in", "near", "around", "at", "close to", "nearby"
    const locationMatch = query.match(/(?:in|near|around|at|close to|nearby)\s+([\w\s]+?)(?:,|$)/i);
    const hasLocation = !!locationMatch;
    const location = hasLocation ? locationMatch[1].trim() : null;

    // Proximity mode if any of these keywords exist before the location
    const isProximity = /\b(near|around|close to|nearby)\b/i.test(query);

    return { isProximity, location, hasLocation };
}

/**
 * Validates if the target location string matches the expected location.
 * Implements exact, substring, normalized alphanumeric, and string similarity matching.
 * @param {string|string[]} searchTargets - Business name, address, or localArea to check against
 * @param {string} expectedLocation - The location parsed from the query
 * @returns {boolean}
 */
function isStrictMatch(searchTargets, expectedLocation) {
    if (!expectedLocation) return true; // No location to check against = pass

    const targets = Array.isArray(searchTargets) ? searchTargets.filter(Boolean) : [searchTargets].filter(Boolean);
    const expected = expectedLocation.toString().toLowerCase().trim();

    // Combined target text for cross-field matching
    const combinedTarget = targets.map(t => t.toString().toLowerCase()).join(' ');

    // 1. Alias normalization (e.g. Bengaluru <-> Bangalore)
    const normCombined = combinedTarget.replace(/\bbengaluru\b/g, 'bangalore');
    const normExpected = expected.replace(/\bbengaluru\b/g, 'bangalore');

    // 2. Exact or Substring match on raw text
    if (normCombined.includes(normExpected) || normExpected.includes(normCombined)) return true;

    // 3. Normalized alphanumeric match
    const alphaCombined = normCombined.replace(/[^a-z0-9]/g, '');
    const alphaExpected = normExpected.replace(/[^a-z0-9]/g, '');
    if (alphaCombined && alphaExpected && (alphaCombined.includes(alphaExpected) || alphaExpected.includes(alphaCombined))) return true;

    // 4. Token-level matching: strip state/country filler (e.g., "Karnataka", "India") to get primary location tokens
    const stateCountryFilter = /\b(karnataka|maharashtra|tamil nadu|kerala|andhra pradesh|telangana|delhi|india|state)\b/gi;
    const primaryLocation = normExpected.replace(stateCountryFilter, '').trim();

    if (primaryLocation.length >= 3) {
        const primaryAlpha = primaryLocation.replace(/[^a-z0-9]/g, '');
        if (alphaCombined.includes(primaryAlpha)) return true;

        const tokens = primaryLocation.split(/\s+/).filter(t => t.length >= 3);
        if (tokens.length > 0 && tokens.every(token => normCombined.includes(token))) {
            return true;
        }
    }

    // 5. String similarity fallback against individual address/target parts
    for (const targetString of targets) {
        let target = targetString.toString().toLowerCase().replace(/\bbengaluru\b/g, 'bangalore');
        if (target.length < normExpected.length * 4) {
            const score = stringSimilarity.compareTwoStrings(target, normExpected);
            if (score > 0.75) return true;
        } else {
            const parts = target.split(/[\s,]+/);
            for (const part of parts) {
                if (part.length >= 3 && stringSimilarity.compareTwoStrings(part, normExpected) > 0.75) {
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Appends intent tags to the lead's location object.
 * @param {Object} lead 
 * @param {string} searchedLocation 
 * @param {boolean} isExactMatch 
 * @returns {Object} Modified lead
 */
function tagProximityLead(lead, searchedLocation, isExactMatch = false) {
    if (!lead.location) lead.location = {};
    lead.location.proximityTag = isExactMatch ? 'exact' : 'nearby';
    lead.location.searchedArea = searchedLocation;
    return lead;
}

module.exports = {
    parseQueryIntent,
    isStrictMatch,
    tagProximityLead
};
