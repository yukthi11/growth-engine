/**
 * Deduplication Blocker Utility
 * 
 * Generates blocking keys to group potentially identical leads.
 * This allows for efficient deduplication by comparing leads only within the same "block".
 */

/**
 * Generates up to 3 blocking keys for a normalized lead.
 * 
 * @param {object} lead - Normalized lead object (Phase 1 shape)
 * @returns {string[]} Array of generated blocking keys
 */
function generateBlockingKeys(lead) {
    const keys = [];
    const location = lead.location?.normalized || "unknown";

    // --- Key 1: Phone Block ---
    if (lead.phone?.isValid && lead.phone?.e164) {
        // Strip + sign and take first 6 digits
        const cleanPhone = lead.phone.e164.replace('+', '');
        const phonePrefix = cleanPhone.substring(0, 6);
        keys.push(`phone_block:${phonePrefix}_${location}`);
    }

    // --- Key 2: Email Domain Block ---
    if (lead.email?.status && lead.email.status !== 'invalid' && lead.email.address) {
        const parts = lead.email.address.split('@');
        if (parts.length > 1) {
            const domain = parts[1].toLowerCase().trim();
            keys.push(`email_block:${domain}`);
        }
    }

    // --- Key 3: Business Name Block ---
    if (lead.businessName && lead.businessName.trim() !== '') {
        // 1. Lowercase
        let name = lead.businessName.toLowerCase();

        // 2. Remove specific noise words as whole words
        const noiseWords = ['pvt', 'ltd', 'private', 'limited', 'co', 'inc', 'llp', 'and', 'the', '&'];
        const noiseRegex = new RegExp(`\\b(${noiseWords.join('|')})\\b`, 'gi');
        name = name.replace(noiseRegex, '');

        // 3. Remove all special characters and extra spaces
        name = name.replace(/[^a-z0-9]/g, '');

        // 4. Take first 10 characters
        const namePrefix = name.substring(0, 10);

        if (namePrefix) {
            keys.push(`name_block:${namePrefix}_${location}`);
        }
    }

    return keys;
}

module.exports = { generateBlockingKeys };

/**
 * Main Test Block
 */
function main() {
    const testLeads = [
        {
            businessName: "ABC Traders Pvt Ltd",
            phone: { e164: "+919876543210", isValid: true },
            email: { address: "contact@abctraders.com", status: "valid" },
            location: { normalized: "koramangala, bangalore" },
            source: "justdial"
        },
        {
            businessName: "Random Shop",
            phone: { e164: null, isValid: false },
            email: { address: "", status: "invalid" },
            location: { normalized: "mumbai" },
            source: "facebook"
        },
        {
            businessName: "",
            phone: { e164: "+918888888888", isValid: true },
            email: { address: "ceo@infosys.com", status: "valid" },
            location: { normalized: "bangalore" },
            source: "google"
        }
    ];

    console.log("--- Dedupe Blocker Test Run ---");
    testLeads.forEach((lead, i) => {
        console.log(`\nLead ${i + 1}: ${lead.businessName || "[Empty Name]"}`);
        const result = generateBlockingKeys(lead);
        console.log(`Generated Keys:`, JSON.stringify(result, null, 2));
    });
}

if (require.main === module) {
    main();
}
