const { parsePhoneNumberFromString } = require('libphonenumber-js');

/**
 * Normalizes a raw phone number string into E.164 format.
 *
 * Resolution order:
 *  1. If the string already carries a '+' international prefix, auto-detect
 *     country from the dialling code (no hint needed).
 *  2. Otherwise, try with the provided countryHint (ISO 3166-1 alpha-2).
 *  3. If still invalid and no hint was supplied, try every major-market country
 *     code as a last resort.
 *
 * @param {string}  rawPhone     - Raw phone string from any scraper.
 * @param {string|null} countryHint - ISO 3166-1 alpha-2 hint, e.g. 'IN', 'US', 'GB'.
 *                                   Pass null for fully international / unknown origin.
 * @returns {{ raw, e164, isValid, country }}
 */
function normalizePhone(rawPhone, countryHint = null) {
    if (!rawPhone || typeof rawPhone !== 'string') {
        return { raw: String(rawPhone || ''), e164: null, isValid: false, country: null };
    }

    const cleaned = rawPhone.replace(/[^\d+]/g, '');
    if (cleaned.length < 7) {
        return { raw: rawPhone, e164: null, isValid: false, country: null };
    }

    // ── Helper: attempt a single parse ──────────────────────────────────────
    function tryParse(input, hint) {
        try {
            const n = parsePhoneNumberFromString(input, hint || undefined);
            if (n && n.isValid()) return { e164: n.format('E.164'), country: n.country };
        } catch (_) { /* ignore */ }
        return null;
    }

    // 1. Has explicit '+' prefix — trust the dialling code, no country hint
    if (cleaned.startsWith('+')) {
        const r = tryParse(cleaned) || tryParse(rawPhone);
        if (r) return { raw: rawPhone, isValid: true, ...r };
    }

    // 2. Try with the provided country hint
    if (countryHint) {
        const r = tryParse(cleaned, countryHint) || tryParse(rawPhone, countryHint);
        if (r) return { raw: rawPhone, isValid: true, ...r };
    }

    // 3. Fallback cascade — common international markets
    //    Ordered by volume of global leads (can be tuned per campaign).
    const FALLBACK_COUNTRIES = ['IN', 'US', 'GB', 'AE', 'SG', 'AU', 'CA', 'DE', 'FR', 'ZA'];
    for (const cc of FALLBACK_COUNTRIES) {
        if (cc === countryHint) continue; // already tried
        const r = tryParse(cleaned, cc);
        if (r) return { raw: rawPhone, isValid: true, ...r };
    }

    return { raw: rawPhone, e164: null, isValid: false, country: null };
}

// Named export for use in the platform
module.exports = { normalizePhone };

// --- Main Test Block ---
async function main() {
    const testCases = [
        "98765 43210",
        "+1-800-555-0199",
        "invalid",
        "011-23456789",
        ""
    ];

    console.log("--- Phone Normalizer Test Run ---");
    testCases.forEach(input => {
        const result = normalizePhone(input);
        console.log(`Input: "${input}"`);
        console.log(`Result:`, JSON.stringify(result, null, 2));
        console.log('-'.repeat(30));
    });
}

// Run tests if this file is executed directly
if (require.main === module) {
    main();
}
