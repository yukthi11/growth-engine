/**
 * Golden Record Assembler Utility
 * 
 * Merges multiple duplicate leads into a single "Golden Record" by
 * selecting the highest quality data points across all versions.
 */

const SOURCE_PRIORITY = {
    "maps": 5,
    "justdial": 4,
    "indiamart": 3,
    "facebook": 2,
    "instagram": 1
};

const getSourcePriority = (source) => SOURCE_PRIORITY[source.toLowerCase()] || 0;

/**
 * Assembles a single Golden Record from an array of duplicate leads.
 * 
 * @param {object[]} leads - Array of normalized lead objects
 * @returns {object} The merged Golden Record
 */
function assembleGoldenRecord(leads) {
    if (!leads || leads.length === 0) return null;

    // 1. Phone Selection (Highest score, then source priority)
    const sortedByPhone = [...leads].sort((a, b) => {
        if (b.phone.score !== a.phone.score) return b.phone.score - a.phone.score;
        return getSourcePriority(b.source) - getSourcePriority(a.source);
    });
    const bestPhone = sortedByPhone[0].phone;

    // 2. Email Selection (Highest score, then status validity)
    const sortedByEmail = [...leads].sort((a, b) => {
        if (b.email.score !== a.email.score) return b.email.score - a.email.score;

        const statusScore = (s) => (s === 'valid' ? 2 : s === 'risky' ? 1 : 0);
        return statusScore(b.email.status) - statusScore(a.email.status);
    });
    const bestEmail = sortedByEmail[0].email;

    // 3. Business Name Selection (Source priority)
    const sortedBySource = [...leads].sort((a, b) => getSourcePriority(b.source) - getSourcePriority(a.source));
    const bestBusinessName = sortedBySource[0].businessName;

    // 4. Website Selection (Source priority, first non-empty)
    const websiteLead = sortedBySource.find(l => l.website && l.website.trim() !== '') || sortedBySource[0];
    const bestWebsite = websiteLead.website;

    // 5. Location Selection (Completeness, then source priority)
    const sortedByLocation = [...leads].sort((a, b) => {
        const scoreLoc = (loc) => (loc.localArea ? 1 : 0) + (loc.city ? 1 : 0);
        const diff = scoreLoc(b.location) - scoreLoc(a.location);
        if (diff !== 0) return diff;
        return getSourcePriority(b.source) - getSourcePriority(a.source);
    });
    const bestLocation = sortedByLocation[0].location;

    // 6. Metadata aggregation
    const allSources = Array.from(new Set(leads.map(l => l.source)));

    return {
        businessName: bestBusinessName,
        phone: bestPhone,
        email: bestEmail,
        website: bestWebsite,
        location: bestLocation,
        source: sortedBySource[0].source, // Primary source
        extractionMethod: sortedBySource[0].extractionMethod,
        normalizedAt: sortedBySource[0].normalizedAt,
        sources: allSources,
        mergedAt: new Date().toISOString()
    };
}

module.exports = { assembleGoldenRecord };

/**
 * Main Test Block
 */
function main() {
    const duplicateLeads = [
        {
            businessName: "ABC Traders",
            phone: { raw: "98765 43210", e164: "+919876543210", isValid: true, score: 0.9 },
            email: { address: "contact@abctraders.com", status: "risky", score: 0.8 },
            website: null,
            location: { localArea: null, city: "Bangalore", normalized: "bangalore" },
            source: "justdial",
            extractionMethod: "regex",
            normalizedAt: "2024-01-01T10:00:00Z"
        },
        {
            businessName: "ABC Traders Pvt Ltd",
            phone: { raw: "+91 98765 43210", e164: "+919876543210", isValid: true, score: 0.95 },
            email: { address: "info@abctraders.com", status: "valid", score: 0.95 },
            website: "www.abctraders.com",
            location: { localArea: "Koramangala", city: "Bangalore", normalized: "koramangala, bangalore" },
            source: "facebook",
            extractionMethod: "llm_layer2",
            normalizedAt: "2024-01-01T11:00:00Z"
        },
        {
            businessName: "A.B.C. Traders",
            phone: { raw: "080-12345678", e164: "+918012345678", isValid: true, score: 0.8 },
            email: { address: "sales@abctraders.com", status: "valid", score: 0.9 },
            website: "abctraders.in",
            location: { localArea: "Indiranagar", city: "Bangalore", normalized: "indiranagar, bangalore" },
            source: "maps",
            extractionMethod: "regex",
            normalizedAt: "2024-01-01T12:00:00Z"
        }
    ];

    console.log("--- Golden Record Assembler Test Run ---");
    const golden = assembleGoldenRecord(duplicateLeads);
    console.log(`Leads Merged: ${duplicateLeads.length}`);
    console.log(`Final Golden Record:`, JSON.stringify(golden, null, 2));
}

if (require.main === module) {
    main();
}
