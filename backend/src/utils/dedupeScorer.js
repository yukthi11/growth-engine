/**
 * Lightweight Jaro-Winkler implementation used for fuzzy matching.
 *
 * This avoids pulling in the `natural` dependency, which can break in newer Node versions
 * due to ESM-only transitive dependencies.
 */
function jaroWinkler(s1, s2) {
    if (!s1 || !s2) return 0;
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const m = Math.floor(Math.min(s1.length, s2.length) / 2) + 1;
    const matches = []; // indices in s2 that are matched
    let matchCount = 0;

    for (let i = 0; i < s1.length; i++) {
        const start = Math.max(0, i - m + 1);
        const end = Math.min(i + m, s2.length);
        for (let j = start; j < end; j++) {
            if (!matches[j] && s1[i] === s2[j]) {
                matches[j] = true;
                matchCount++;
                break;
            }
        }
    }

    if (!matchCount) return 0;

    const s1Matches = [];
    const s2Matches = [];
    for (let i = 0, j = 0; i < s1.length; i++) {
        if (s2Matches[i]) continue;
        const start = Math.max(0, i - m + 1);
        const end = Math.min(i + m, s2.length);
        for (let k = start; k < end; k++) {
            if (matches[k]) {
                s1Matches.push(s1[i]);
                s2Matches.push(s2[k]);
                matches[k] = false;
                break;
            }
        }
    }

    let transpositions = 0;
    for (let i = 0; i < s1Matches.length; i++) {
        if (s1Matches[i] !== s2Matches[i]) transpositions++;
    }

    const mD = matchCount;
    const tD = transpositions / 2;
    const jaro = (mD / s1.length + mD / s2.length + (mD - tD) / mD) / 3;

    const prefixLength = Math.min(4, Math.min(s1.length, s2.length));
    let prefix = 0;
    for (let i = 0; i < prefixLength; i++) {
        if (s1[i] === s2[i]) prefix++; else break;
    }

    const scalingFactor = 0.1;
    return jaro + prefix * scalingFactor * (1 - jaro);
}

/**
 * Fuzzy match scorer for deduplication engine.
 * Scores a pair of leads based on exact and fuzzy matches.
 * 
 * @param {object} leadA - First normalized lead
 * @param {object} leadB - Second normalized lead
 * @returns {object} { totalScore, breakdown, decision }
 */
function scoreLeadPair(leadA, leadB) {
    const breakdown = {
        phone: 0,
        email: 0,
        businessName: 0,
        location: 0
    };

    // --- 1. Phone Scoring ---
    if (leadA.phone?.isValid && leadB.phone?.isValid && leadA.phone?.e164 && leadB.phone?.e164) {
        if (leadA.phone.e164 === leadB.phone.e164) {
            breakdown.phone = 50;
        } else if (leadA.phone.e164.substring(0, 10) === leadB.phone.e164.substring(0, 10)) {
            breakdown.phone = 30;
        }
    }

    // --- 2. Email Scoring ---
    if (leadA.email?.status && leadA.email.status !== 'invalid' &&
        leadB.email?.status && leadB.email.status !== 'invalid' &&
        leadA.email?.address && leadB.email?.address) {

        const emailA = leadA.email.address.toLowerCase().trim();
        const emailB = leadB.email.address.toLowerCase().trim();

        if (emailA === emailB) {
            breakdown.email = 40;
        } else {
            const domainA = emailA.split('@')[1];
            const domainB = emailB.split('@')[1];
            if (domainA === domainB && domainA) {
                breakdown.email = 20;
            }
        }
    }

    // --- 3. Business Name Fuzzy Scoring ---
    if (leadA.businessName && leadB.businessName) {
        const score = jaroWinkler(leadA.businessName, leadB.businessName);
        if (score >= 0.92) {
            breakdown.businessName = 25;
        } else if (score >= 0.80) {
            breakdown.businessName = 15;
        }
    }

    // --- 4. Location Scoring ---
    if (leadA.location?.normalized && leadB.location?.normalized) {
        if (leadA.location.normalized === leadB.location.normalized) {
            breakdown.location = 10;
        }
    }

    const totalScore = breakdown.phone + breakdown.email + breakdown.businessName + breakdown.location;

    let decision = "separate";
    if (totalScore >= 80) decision = "auto_merge";
    else if (totalScore >= 50) decision = "review";

    return { totalScore, breakdown, decision };
}

module.exports = { scoreLeadPair };

/**
 * Main Test Block
 */
function main() {
    const pairs = [
        {
            name: "Near-identical leads",
            leadA: {
                businessName: "ABC Traders Pvt Ltd",
                phone: { e164: "+919876543210", isValid: true },
                email: { address: "contact@abctraders.com", status: "valid" },
                location: { normalized: "koramangala, bangalore" }
            },
            leadB: {
                businessName: "ABC Traders",
                phone: { e164: "+919876543210", isValid: true },
                email: { address: "contact@abctraders.com", status: "valid" },
                location: { normalized: "koramangala, bangalore" }
            }
        },
        {
            name: "Same company, different area",
            leadA: {
                businessName: "City Traders",
                phone: { e164: "+919999988888", isValid: true },
                email: { address: "info@citytraders.com", status: "valid" },
                location: { normalized: "koramangala, bangalore" }
            },
            leadB: {
                businessName: "City Traders INC",
                phone: { e164: "+917777766666", isValid: true },
                email: { address: "sales@citytraders.com", status: "valid" },
                location: { normalized: "whitefield, bangalore" }
            }
        },
        {
            name: "Completely different leads",
            leadA: {
                businessName: "Unique Bakery",
                phone: { e164: "+911111111111", isValid: true },
                email: { address: "hello@unique.com", status: "valid" },
                location: { normalized: "mumbai" }
            },
            leadB: {
                businessName: "Fast Courier",
                phone: { e164: "+912222222222", isValid: true },
                email: { address: "support@fast.com", status: "valid" },
                location: { normalized: "delhi" }
            }
        }
    ];

    console.log("--- Fuzzy Match Scorer Test Run ---");
    pairs.forEach(pair => {
        const result = scoreLeadPair(pair.leadA, pair.leadB);
        console.log(`\nTest: ${pair.name}`);
        console.log(`Result:`, JSON.stringify(result, null, 2));
    });
}

if (require.main === module) {
    main();
}
