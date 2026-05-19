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

    const targets = Array.isArray(searchTargets) ? searchTargets : [searchTargets];
    const expected = expectedLocation.toString().toLowerCase();
    const normExpected = expected.replace(/[^a-z0-9]/g, '');

    for (const targetString of targets) {
        if (!targetString) continue;

        let target = targetString.toString().toLowerCase();
        let currentExpected = expected;

        // Alias normalization (e.g. Bengaluru <-> Bangalore)
        target = target.replace(/\bbengaluru\b/g, 'bangalore');
        currentExpected = currentExpected.replace(/\bbengaluru\b/g, 'bangalore');

        const normTarget = target.replace(/[^a-z0-9]/g, '');
        const normExpected = currentExpected.replace(/[^a-z0-9]/g, '');

        // 1. Exact or Substring match on raw lowercase
        if (target.includes(currentExpected) || currentExpected.includes(target)) return true;

        // 2. Normalized alphanumeric match
        if (normTarget && normExpected && (normTarget.includes(normExpected) || normExpected.includes(normTarget))) return true;

        // 3. String similarity
        // Only apply direct similarity if target is a short string (like localArea).
        if (target.length < expected.length * 4) {
            const score = stringSimilarity.compareTwoStrings(target, expected);
            if (score > 0.75) return true;
        } else {
            // For full addresses, try matching against individual comma-separated parts
            const parts = target.split(/[\s,]+/);
            for (const part of parts) {
                if (part.length >= 3 && stringSimilarity.compareTwoStrings(part, expected) > 0.75) {
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
