const { analyzeWebsite } = require('./websiteAnalyzer');
const { scoreIntent } = require('./intentScorer');
const { resolveOutreachByPillar } = require('../ai/pillarMessages');

/**
 * Runs the complete AI intelligence pipeline for a lead.
 * @param {Object} lead - Normalized lead data
 * @param {Object} [options] - Pipeline options
 * @param {boolean} [options.autoOutreach=true] - When false, skips Gap AI and outreach draft generation
 * @returns {Promise<Object>} Enriched lead data
 */
async function runIntelligence(lead, options = {}) {
    const { autoOutreach = true, browser = null } = options;
    try {
        let websiteAnalysis = null;
        let outreachDraft = null;

        // Step 1: Website Analysis
        if (lead.website && lead.website.trim().length > 0) {
            try {
                websiteAnalysis = await analyzeWebsite(lead.website, { browser });

                // PROMOTION LOGIC: If website analysis found contacts, fill in the lead blanks
                if (websiteAnalysis) {
                    if ((!lead.email.address || lead.email.status === 'invalid') && websiteAnalysis.emails?.length > 0) {
                        lead.email.address = websiteAnalysis.emails[0];
                        lead.email.status = 'harvested';
                        console.log(`[Intelligence] Harvested EMAIL for ${lead.businessName}: ${lead.email.address}`);
                    }
                    if ((!lead.phone.e164 || !lead.phone.isValid) && websiteAnalysis.phones?.length > 0) {
                        lead.phone.e164 = websiteAnalysis.phones[0];
                        lead.phone.isValid = true;
                        console.log(`[Intelligence] Harvested PHONE for ${lead.businessName}: ${lead.phone.e164}`);
                    }
                    if (!lead.location_normalized && websiteAnalysis.location) {
                        lead.location_normalized = `${websiteAnalysis.location.area}, ${websiteAnalysis.location.state}`;
                        console.log(`[Intelligence] Harvested LOCATION for ${lead.businessName}: ${lead.location_normalized}`);
                    }
                }
            } catch (err) {
                console.warn(`[Intelligence Pipeline] Website analysis failed for ${lead.website}:`, err.message);
                websiteAnalysis = null;
            }
        }

        // --- GAP INTELLIGENCE (AI) — skipped when autoOutreach is false ---
        let gapData = null;
        if (autoOutreach) {
            try {
                const { generalPrompt } = require('../scrapers/llmExtractor');
                const { processGapIntelligence } = require('../ai/gapMapper');
                
                const aiPrompt = `
You are an expert business growth consultant. Analyze this lead and their website profile to identify business gaps.

Lead Info:
Name: ${lead.businessName}
Category: ${lead.category || 'Local Business'}
Location: ${lead.location_normalized || 'Unknown'}
Has Website: ${!!lead.website}

Website Analysis Data:
${JSON.stringify(websiteAnalysis || {}, null, 2)}

Return EXACTLY this JSON structure (do NOT include outreach_draft — gap detection only):
{
  "intent_score": 0,
  "tier": "hot|warm|cold",
  "vertical": "fitness|restaurant|salon|clinic|education|realestate|retail|other",
  "service_fit": "2 sentence summary of why they need our digital growth services",
  "gap_pitch": "1 specific sentence about their actual gaps",
  "pillar": "presence|reputation|automation|chatbot|ads",
  "gaps": {
    "noWebsite": ${!lead.website},
    "brokenWebsite": false,
    "noWhatsApp": ${!(websiteAnalysis?.hasWhatsapp)},
    "noBookingSystem": false,
    "fewReviews": false,
    "lowRating": false,
    "slowWebsite": false,
    "noSSL": false,
    "inactiveSocial": ${!(websiteAnalysis?.hasSocialLinks?.length > 0)},
    "noEmailCapture": ${!(websiteAnalysis?.hasContactForm)},
    "noLeadForm": ${!(websiteAnalysis?.hasContactForm)},
    "noSchema": false,
    "noChat": true,
    "missingGBPFields": false
  },
  "topGaps": []
}
`;
                const rawAiOutput = await generalPrompt(aiPrompt);
                const jsonMatch = rawAiOutput.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    gapData = processGapIntelligence(parsed);
                }
            } catch (err) {
                console.error('[Intelligence Pipeline] Gap AI failed:', err.message);
            }
        } else {
            console.log(`[Intelligence Pipeline] Auto-Outreach is OFF. Skipping Gap AI for: ${lead.businessName}`);
        }

        // Step 2: Intent Scoring (Fallback/Legacy)
        const intentData = scoreIntent(lead, websiteAnalysis);

        // Step 3: Resolve outreach from structured pillar messages (no AI required)
        const pillar = gapData?.gap_pillar || null;
        if (pillar) {
            const businessName = lead.businessName || lead.business_name || '';
            const location = lead.location_normalized || lead.location?.city || '';
            const resolved = resolveOutreachByPillar(pillar, businessName, location);
            outreachDraft = { message: resolved.whatsapp };
        }

        // Step 4: Return enriched lead
        return {
            ...lead,              // spread must come first
            businessName: lead.businessName,  // // FIX - PRESERVE BUSINESS NAME
            intelligence: {
                websiteAnalysis,
                intentScore: gapData ? gapData.intent_score : intentData.intentScore,
                tier: gapData ? gapData.tier : intentData.tier,
                serviceFit: gapData ? gapData.service_fit : intentData.serviceFit,
                outreachDraft: outreachDraft,
                gap_details: gapData ? gapData.gap_details : null,
                gap_top: gapData ? gapData.gap_top : null,
                gap_pillar: gapData ? gapData.gap_pillar : null,
                gap_vertical: gapData ? gapData.gap_vertical : null,
                gap_pitch: gapData ? gapData.gap_pitch : null,
                enrichedAt: new Date().toISOString()
            }
        };

    } catch (error) {
        console.error('[Intelligence Pipeline] Critical failure:', error.message);
        // Return lead unchanged if pipeline fails
        return lead;
    }
}

/**
 * Main test block
 */
async function main() {
    // Load env for Gemini/Groq keys
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

    const mockLead = {
        businessName: "Bangalore Tech Solutions",
        website: "https://www.tatamotors.com", // Using a real site for testing analysis
        location: { city: "Bangalore" },
        category: "Software Development",
        email: { status: "invalid" },
        phone: { isValid: true },
        sources: ["justdial"]
    };

    console.log("Starting Intelligence Pipeline for mock lead...");
    const enrichedLead = await runIntelligence(mockLead);

    console.log("\nFinal Enriched Lead Object:");
    console.log(JSON.stringify(enrichedLead, null, 2));
}

if (require.main === module) {
    main();
}

module.exports = {
    runIntelligence
};
