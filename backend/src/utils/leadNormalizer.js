const { normalizePhone } = require('./phoneNormalizer');
const { verifyEmail } = require('./emailVerifier');
const { scoreField } = require('./confidenceScorer');
const { classifyWebsite } = require('./fakeWebsiteDetector');

/**
 * Derives an ISO 3166-1 alpha-2 country hint from a freeform city/country string.
 * Keeps the normalizer's fallback cascade lean by giving it a strong first guess.
 * Add entries here as new markets are targeted.
 * @param {string} cityOrCountry
 * @returns {string|null}
 */
function resolveCountryHint(cityOrCountry) {
    if (!cityOrCountry) return null;
    const s = cityOrCountry.toLowerCase();
    const MAP = {
        // India
        'india': 'IN', 'bangalore': 'IN', 'bengaluru': 'IN', 'mumbai': 'IN',
        'delhi': 'IN', 'hyderabad': 'IN', 'chennai': 'IN', 'pune': 'IN',
        'kolkata': 'IN', 'ahmedabad': 'IN', 'surat': 'IN', 'jaipur': 'IN',
        // US
        'usa': 'US', 'united states': 'US', 'new york': 'US', 'los angeles': 'US',
        'chicago': 'US', 'houston': 'US', 'san francisco': 'US', 'miami': 'US',
        // UK
        'uk': 'GB', 'united kingdom': 'GB', 'london': 'GB', 'manchester': 'GB',
        // UAE
        'uae': 'AE', 'dubai': 'AE', 'abu dhabi': 'AE', 'sharjah': 'AE',
        // Singapore
        'singapore': 'SG',
        // Australia
        'australia': 'AU', 'sydney': 'AU', 'melbourne': 'AU', 'brisbane': 'AU',
        // Canada
        'canada': 'CA', 'toronto': 'CA', 'vancouver': 'CA', 'montreal': 'CA',
        // Germany
        'germany': 'DE', 'berlin': 'DE', 'munich': 'DE', 'hamburg': 'DE',
        // France
        'france': 'FR', 'paris': 'FR',
        // South Africa
        'south africa': 'ZA', 'johannesburg': 'ZA', 'cape town': 'ZA',
    };
    for (const [key, cc] of Object.entries(MAP)) {
        if (s.includes(key)) return cc;
    }
    return null;
}

/**
 * Normalizes and validates a raw lead object.
 * Applies phone normalization, email verification, and confidence scoring.
 * 
 * @param {object} rawLead - The raw lead data from a scraper.
 * @returns {Promise<object>} Normalized and scored lead object.
 */
async function normalizeLead(rawLead) {
    const {
        businessName,
        phone: rawPhone,
        email: rawEmail,
        website,
        location, // LOCATION CHANGE
        source,
        extractionMethod,
        instagram_username,
        facebook_username,
        linkedin_company_id,
        social_username
    } = rawLead;

    // 1. Process Phone — derive country hint from location for smarter parsing
    const locationHint = resolveCountryHint(
        rawLead.location?.country || rawLead.location?.city || rawLead.location?.localArea
    );
    const phoneData = normalizePhone(rawPhone, locationHint);
    let phoneScore = 0;
    if (phoneData.isValid) {
        const scored = scoreField({
            value: phoneData.e164,
            source,
            extractionMethod
        });
        phoneScore = scored.score;
    }

    // 2. Process Email
    const emailData = await verifyEmail(rawEmail);
    let emailScore = 0;
    if (emailData.status !== 'invalid') {
        const scored = scoreField({
            value: rawEmail,
            source,
            extractionMethod
        });
        emailScore = scored.score;
    }

    // 3. Process Location // LOCATION CHANGE
    const city = (location?.city || '').trim().toLowerCase();
    const localArea = (location?.localArea || '').trim().toLowerCase();

    let normalizedLoc = "unknown";
    if (localArea && city) {
        normalizedLoc = `${localArea}, ${city}`;
    } else if (city) {
        normalizedLoc = city;
    } else if (localArea) {
        normalizedLoc = localArea;
    }

    // 4. Classify website: null out social/directory URLs and preserve them for outreach context
    const webClass = classifyWebsite(website);
    const resolvedWebsite = webClass.isFake ? null : (website || null);

    // 5. Construct Clean Lead Object
    return {
        businessName,
        phone: {
            raw: rawPhone,
            e164: phoneData.isValid ? phoneData.e164 : null,
            isValid: phoneData.isValid,
            score: phoneScore
        },
        email: {
            address: rawEmail,
            status: emailData.status,
            score: emailScore
        },
        website: resolvedWebsite,
        social_as_website: webClass.originalUrl,   // preserved original URL if fake, else null
        fake_website: webClass.isFake,
        location: { // LOCATION CHANGE
            localArea: location?.localArea || "",
            city: location?.city || "",
            normalized: normalizedLoc
        },
        source,
        extractionMethod,
        instagram_username: instagram_username || social_username || null,
        facebook_username: facebook_username || null,
        linkedin_company_id: linkedin_company_id || null,
        normalizedAt: new Date().toISOString()
    };
}

// Default export
module.exports = normalizeLead;

/**
 * Main Test Block
 */
async function main() {
    const sampleLeads = [
        {
            businessName: "Test Case 1",
            phone: "98765 43210",
            email: "contact@example.com",
            location: { localArea: "Koramangala", city: "Bangalore" },
            source: "justdial",
            extractionMethod: "regex"
        },
        {
            businessName: "Test Case 2",
            phone: "98765 43210",
            email: "contact@example.com",
            location: { localArea: "", city: "Mumbai" },
            source: "justdial",
            extractionMethod: "regex"
        },
        {
            businessName: "Test Case 3",
            phone: "98765 43210",
            email: "contact@example.com",
            location: { localArea: "", city: "" },
            source: "justdial",
            extractionMethod: "regex"
        }
    ];

    console.log("--- Lead Normalizer Test Run ---");
    for (const lead of sampleLeads) {
        const normalized = await normalizeLead(lead);
        console.log(`Input Business: "${lead.businessName}"`);
        console.log(`Normalized Lead:`, JSON.stringify(normalized, null, 2));
        console.log("-".repeat(50));
    }
}

if (require.main === module) {
    main();
}
