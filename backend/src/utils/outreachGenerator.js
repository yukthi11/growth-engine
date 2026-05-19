const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { generateFirstMessage } = require('../services/messageGenerator');

/**
 * Generates a personalized outreach message with fallback support (now signal-based).
 * @param {Object} lead - Normalized lead data
 * @param {Object} intentData - Scored intent data
 * @returns {Promise<Object|null>}
 */
async function generateOutreach(lead, intentData) {
    // Only generate for hot or warm leads
    if (intentData.tier !== 'hot' && intentData.tier !== 'warm') {
        return null;
    }

    try {
        // [PHASE 6] Message Generation Engine (Signal-based)
        // 1. Fetch Company Settings (Essential for templates)
        const pool = require('../config/db');
        const companyId = lead.company_id || 1;
        const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
        const company = companyRes.rows[0];

        if (!company) {
            throw new Error(`Company ${companyId} not found for outreach generation`);
        }

        // 2. Prepare Lead for scoring
        const scoringLead = {
            ...lead,
            primary_intent: lead.primary_intent || intentData.primaryIntent || 'visibility'
        };
        
        const result = await generateFirstMessage(scoringLead, company);

        return {
            businessName: lead.businessName || lead.business_name,
            channel: "whatsapp",
            message: result.message,
            serviceFit: intentData.serviceFit || [],
            tier: intentData.tier,
            model: "signal-based-scoring",
            generatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('[Outreach Generator] Signal-based generation failed:', error.message);
        return null;
    }
}

/**
 * Main test block
 */
async function main() {
    const mockLead = {
        businessName: "Sharma Electronics",
        location: { city: "Bangalore" },
        category: "Electronics Repair Store"
    };

    const mockIntentData = {
        tier: "hot",
        serviceFit: ["website_redesign", "mobile_optimization"]
    };

    console.log("Generating outreach for mock lead...");
    const outreach = await generateOutreach(mockLead, mockIntentData);

    if (outreach) {
        console.log("\nGenerated Outreach Object:");
        console.log(JSON.stringify(outreach, null, 2));
    } else {
        console.log("Failed to generate outreach.");
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    generateOutreach
};
