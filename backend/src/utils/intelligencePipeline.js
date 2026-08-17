const { analyzeWebsite } = require('./websiteAnalyzer');
const { scoreIntent } = require('./intentScorer');
const { resolveOutreachByPillar } = require('../ai/pillarMessages');
const { processGapIntelligence, computeGapsFromAnalysis } = require('../ai/gapMapper');

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

        // --- GAP INTELLIGENCE — skipped when autoOutreach is false ---
        let gapData = null;
        if (autoOutreach) {
            try {
                // Step 2a: Compute all binary gap flags deterministically (zero LLM tokens)
                const computedGaps = computeGapsFromAnalysis(websiteAnalysis, lead.website);

                // Step 2b: Ask LLM ONLY for the two fields that require genuine judgment:
                // - vertical: which business category this lead belongs to
                // - service_fit: a human-readable summary of why they need our services
                // Everything else (scoring, pillar, topGaps) is derived from computedGaps in code.
                const { generalPrompt } = require('../scrapers/llmExtractor');

                const activeGapNames = Object.entries(computedGaps)
                    .filter(([, v]) => v === true)
                    .map(([k]) => k);

                const slimPrompt = `You are a business growth consultant. Classify this lead.

Business: ${lead.businessName}
Category: ${lead.category || 'Local Business'}
Location: ${lead.location_normalized || 'Unknown'}
Has Website: ${!!lead.website}
Detected Gaps: ${activeGapNames.length > 0 ? activeGapNames.join(', ') : 'None detected'}
Tech Stack: ${websiteAnalysis?.techStack?.join(', ') || 'Unknown'}
Has Social Presence: ${(websiteAnalysis?.hasSocialLinks?.length > 0) ? 'Yes' : 'No'}

Return ONLY this JSON (no extra text):
{
  "vertical": "fitness|restaurant|salon|clinic|education|realestate|retail|other",
  "service_fit": "2 sentence summary of why they need our digital growth services"
}`;

                const rawAiOutput = await generalPrompt(slimPrompt);
                const jsonMatch = rawAiOutput.match(/\{[\s\S]*\}/);

                const aiFields = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

                // Step 2c: Run processGapIntelligence with computed gaps + AI-classified fields merged
                gapData = processGapIntelligence({
                    gaps: computedGaps,
                    vertical: aiFields.vertical || 'other',
                    service_fit: aiFields.service_fit || '',
                    gap_pitch: '',       // Removed — internal field, never sent to lead
                    pillar: null         // Let gapMapper derive pillar from gap weights (more accurate)
                });

            } catch (err) {
                console.error('[Intelligence Pipeline] Gap AI failed:', err.message);
            }
        } else {
            console.log(`[Intelligence Pipeline] Auto-Outreach is OFF. Skipping Gap AI for: ${lead.businessName}`);
        }

        // Step 3: Intent Scoring (Fallback/Legacy — used when Gap AI fails)
        const intentData = scoreIntent(lead, websiteAnalysis);

        // Step 4: Resolve outreach from structured pillar messages (no AI required)
        const pillar = gapData?.gap_pillar || null;
        if (pillar) {
            const businessName = lead.businessName || lead.business_name || '';
            const location = lead.location_normalized || lead.location?.city || '';
            const resolved = resolveOutreachByPillar(pillar, businessName, location, gapData?.gap_details);
            outreachDraft = { message: resolved.whatsapp };
        }

        // Step 5: Return enriched lead
        return {
            ...lead,              // spread must come first
            businessName: lead.businessName,  // FIX - PRESERVE BUSINESS NAME
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
