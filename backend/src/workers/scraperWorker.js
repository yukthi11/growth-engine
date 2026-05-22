const path = require('path');
const envPath = path.resolve(__dirname, '../../../.env');
require('dotenv').config({ path: envPath });

const { getScraper, getAvailableSources } = require('../scrapers');
const pool = require('../config/db');
const normalizeLead = require('../utils/leadNormalizer');
const { runDeduplication } = require('../utils/dedupeEngine');
const { runIntelligence } = require('../utils/intelligencePipeline');
const { getBalance, deductCredits } = require('../utils/creditsManager');
const leadScorer = require('../services/leadScorer');
const { generateFirstMessage } = require('../services/messageGenerator');
const { generateMockup } = require('../services/mockupGenerator');
const { uploadMockup } = require('../lib/r2');
const { launchBrowserInstance, closeBrowser } = require('../utils/stealthBrowser');

const logger = console;

// ==========================================
// DATABASE HELPERS
// ==========================================

/**
 * Upserts a Golden Record into the database.
 * @param {object} goldenRecord - The merged Golden Record
 * @param {number} campaignId - Campaign to assign
 * @param {number} companyId - Company ID
 * @returns {Promise<boolean>} true if inserted/updated
 */
async function upsertGoldenRecord(goldenRecord, campaignId, companyId = 1) {
    if (!goldenRecord.phone?.e164 && !goldenRecord.businessName) {
        logger.warn('[DB] Skipping - no phone and no businessName', { source: goldenRecord.source });
        return false;
    }

    if (!goldenRecord.businessName || goldenRecord.businessName.trim() === '') {
        logger.warn('[DB] Skipping - missing businessName', { phone: goldenRecord.phone?.e164 });
        return false;
    }

    const queryText = `
        INSERT INTO leads (
            business_name, company_id, campaign_id, phone, website, 
            email_address, location_normalized, source, status, sources, merged_at,
            instagram_username, facebook_username,
            intent_score, tier, service_fit, outreach_draft, enriched_at,
            gap_details, gap_top, gap_pillar, gap_vertical, gap_pitch
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING id;
    `;

    const intel = goldenRecord.intelligence || {};
    const values = [
        goldenRecord.businessName,
        companyId,
        campaignId,
        goldenRecord.phone?.e164 || null,
        goldenRecord.website || null,
        goldenRecord.email?.address || null,
        goldenRecord.location?.normalized || null,
        goldenRecord.source,
        'new',
        goldenRecord.sources || [goldenRecord.source],
        goldenRecord.mergedAt || null,
        goldenRecord.instagram_username || goldenRecord.social_username || null,
        goldenRecord.facebook_username || null,
        intel.intentScore || null,
        intel.tier || null,
        intel.serviceFit || null,
        intel.outreachDraft?.message || null,
        intel.enrichedAt || null,
        intel.gap_details ? JSON.stringify(intel.gap_details) : null,
        intel.gap_top || null,
        intel.gap_pillar || null,
        intel.gap_vertical || null,
        intel.gap_pitch || null
    ];

    const res = await pool.query(queryText, values);
    const leadId = res.rows[0]?.id;

    if (leadId) {
        // AI Signal Scoring & Analysis
        const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
        const lead = leadRes.rows[0];
        const scores = leadScorer.scoreLeadIntent(lead);

        await pool.query(`
            UPDATE leads 
            SET visibility_score = $1, footfall_score = $2, partnership_score = $3, primary_intent = $4
            WHERE id = $5
        `, [scores.visibility_score, scores.footfall_score, scores.partnership_score, scores.primary_intent, leadId]);

        // MOCKUP GENERATION — Removed from synchronous worker flow for performance.
        // Mockups are now generated on-demand in the UI when the user views the lead.
        // This saves ~30-60s per lead during search.

        // Save generated outreach draft
        let outreachMessage = intel.outreachDraft?.message;

        // If no AI-generated draft, use the master template (Zero AI)
        if (!outreachMessage) {
            try {
                const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
                const company = companyRes.rows[0] || { name: 'Growth Agency', whatsapp_template: 'Hi {{business_name}}, I noticed your business...' };
                const draft = await generateFirstMessage(lead, company);
                outreachMessage = draft.message;
            } catch (err) {
                logger.error('[DRAFT] Template generation failed:', err.message);
            }
        }

        if (outreachMessage) {
            // Dynamic Channel Routing: WhatsApp for India, Email for International
            let preferredChannel = 'whatsapp';
            const isIndianPhone = goldenRecord.phone?.e164 && goldenRecord.phone.e164.startsWith('+91');
            
            if (isIndianPhone) {
                preferredChannel = 'whatsapp';
            } else if (goldenRecord.email?.address) {
                preferredChannel = 'email';
            } else {
                // If international and no email, we assign email anyway so the dispatcher drops it gracefully
                preferredChannel = 'email'; 
            }

            await pool.query(`
                INSERT INTO messages (lead_id, message_type, content, status, channel, message_text)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING;
            `, [leadId, 'first_outreach', outreachMessage, 'pending', preferredChannel, outreachMessage]);
        }
    }

    return res.rowCount > 0;
}

/**
 * Saves a pair that needs manual review into leads_review table.
 */
async function saveToReview(item) {
    const queryText = `
        INSERT INTO leads_review (lead_a, lead_b, score, breakdown, needs_review)
        VALUES ($1, $2, $3, $4, $5);
    `;
    const values = [
        JSON.stringify(item.leadA),
        JSON.stringify(item.leadB),
        Math.round(item.result.totalScore),
        JSON.stringify(item.result.breakdown),
        true
    ];
    await pool.query(queryText, values).catch(e => {
        logger.warn('[DEDUPE] Could not save to leads_review:', e.message);
    });
}

// ==========================================
// CANCELLATION HELPER
// ==========================================

/**
 * Polls the DB to check if a job has been cancelled.
 * Returns true if the job should stop, false otherwise.
 * @param {number|null} jobId - The discovery_queue row id
 */
async function isCancelled(jobId) {
    if (!jobId) return false;
    try {
        const res = await pool.query(
            "SELECT status FROM discovery_queue WHERE id = $1 LIMIT 1",
            [jobId]
        );
        return res.rows[0]?.status === 'cancelled';
    } catch (_) {
        return false;
    }
}

// ==========================================
// CORE PROCESSING ENGINE
// ==========================================

/**
 * Main execution block for a single scraper source.
 */
async function runSource(source, query, campaignId = 1, job = { id: 'manual' }, companyId = 1, deep = false) {
    const jobId = typeof job.id === 'number' ? job.id : null;
    logger.log("-----------------------------------------");
    logger.log(`[Scraper Worker] Source: ${source} | Query: "${query}" | Deep: ${deep} | Campaign: ${campaignId}`);

    // 1. Fetch Company Settings & Credit Validation
    const companyRes = await pool.query('SELECT credits, auto_enrich, auto_outreach FROM companies WHERE id = $1', [companyId]);
    const company = companyRes.rows[0];
    if (!company) {
        logger.error(`[Scraper Worker] Company ${companyId} not found.`);
        return 0;
    }

    const { credits: balance, auto_enrich: autoEnrich, auto_outreach: autoOutreach } = company;
    const estimatedCost = (deep ? 50 : 20) * 2;

    if (balance < estimatedCost) {
        logger.warn('[CREDITS] Insufficient credits', { companyId, balance, required: estimatedCost });
        return 0;
    }

    // 2. Scraping Phase
    if (await isCancelled(jobId)) {
        logger.log(`[Scraper Worker] Job ${jobId} cancelled before scraping started.`);
        return 0;
    }
    const scraper = getScraper(source);
    scraper.cancelCheck = () => isCancelled(jobId); // inject cancel poller
    const businesses = await scraper.run(query, deep);

    if (businesses.length === 0) {
        logger.log(`[Scraper Worker] ${source}: No businesses found.`);
        return 0;
    }

    // 3. Normalization & Contact Validation
    const cleanLeads = [];
    for (const biz of businesses) {
        try {
            const rawLead = {
                ...biz,
                businessName: biz.businessName || biz.business_name,
                extractionMethod: biz.extractionMethod || 'regex',
                location: biz.location || { localArea: null, city: null }
            };
            const cleanLead = await normalizeLead(rawLead);

            // For directory scrapers (justdial, google_maps), phone numbers are often JD proxy
            // numbers or local landlines that fail strict E.164 validation. We keep ANY lead
            // that at least has a business name — the raw phone string is preserved.
            const hasPhone = cleanLead.phone.isValid;
            const hasWebOrSocial = cleanLead.website || cleanLead.instagram_username || cleanLead.facebook_username;

            // STRICT VALIDATION: Must have a phone OR a website. Name-only is not enough.
            if (hasPhone || hasWebOrSocial) {
                cleanLeads.push(cleanLead);
            } else {
                logger.warn(`[VALIDATION FAIL] Dropping lead with no contact info: ${rawLead.businessName}`);
            }

        } catch (innerError) {
            logger.error(`[Scraper Worker] Normalization failed:`, innerError.message);
        }
    }

    // 4. Batched Deduplication (In-memory)
    const { goldenRecords, stats } = await runDeduplication(cleanLeads);

    // 5. Database Duplicate Check (Skip existing leads)
    const filteredRecords = [];
    for (const record of goldenRecords) {
        const existingCheck = await pool.query(
            'SELECT id FROM leads WHERE business_name = $1 AND company_id = $2',
            [record.businessName, companyId]
        );

        if (existingCheck.rowCount > 0) {
            logger.log(`[DEDUPE] Skipping existing lead: ${record.businessName}`);
            continue;
        }
        filteredRecords.push(record);
    }

    if (filteredRecords.length === 0) {
        logger.log(`[Scraper Worker] All ${goldenRecords.length} leads already exist. Skipping.`);
        return 0;
    }

    // 6. Intelligence Enrichment (AI Pipeline)
    // GATE: autoOutreach is the hard outer switch. If OFF, we never enter the AI layer at all —
    // pure scraper mode: contacts collected, AI untouched, maximum performance.
    let finalLeads = [];
    if (autoEnrich) {
        logger.log(`[INTELLIGENCE] Enriching ${filteredRecords.length} leads (Batch size: 5)...`);
        const BATCH_SIZE = 5;
        for (let i = 0; i < filteredRecords.length; i += BATCH_SIZE) {
            // Check for cancellation
            if (await isCancelled(jobId)) break;

            const batch = filteredRecords.slice(i, i + BATCH_SIZE);
            
            // OPTIMIZATION: Launch one browser process for this batch
            let sharedBrowser = null;
            try {
                sharedBrowser = await launchBrowserInstance();
                const batchResults = await Promise.allSettled(
                    batch.map(lead => runIntelligence(
                        { ...lead, company_id: companyId },
                        { autoOutreach, browser: sharedBrowser } // autoOutreach is passed down to optionally skip Gap AI
                    ))
                );
                
                const batchLeads = batchResults
                    .filter(r => r.status === 'fulfilled')
                    .map(r => r.value);
                finalLeads.push(...batchLeads);
            } catch (batchErr) {
                logger.error(`[INTELLIGENCE] Batch ${i} failed:`, batchErr.message);
            } finally {
                if (sharedBrowser) await closeBrowser(sharedBrowser);
            }
        }
    } else {
        logger.log(`[INTELLIGENCE] Auto-Enrich is OFF — Skipping AI enrichment. (${filteredRecords.length} leads)`);
        finalLeads = filteredRecords.map(l => ({ ...l, intelligence: { tier: 'cold', intentScore: 0 } }));
    }

    // 7. Database Persistence (Upsert)
    let insertedCount = 0;
    for (const record of finalLeads) {
        try {
            const saved = await upsertGoldenRecord(record, campaignId, companyId);
            if (saved) insertedCount++;
        } catch (dbError) {
            logger.error(`[Scraper Worker] Database error:`, dbError.message);
        }
    }

    // 8. Save Review Queue Pairs
    for (const reviewPair of stats.reviewQueue) {
        await saveToReview(reviewPair);
    }

    // 9. Credit Deduction
    const actualCost = insertedCount * 2;
    let newBalance = balance;
    if (actualCost > 0) {
        newBalance = await deductCredits(companyId, actualCost, 'scrape', `Scraped ${insertedCount} leads from ${source}`);
        logger.log('[CREDITS] Deducted', { amount: actualCost, remaining: newBalance });
    }

    // 10. Detailed Logging
    logProcessStats(job.id, stats, finalLeads, insertedCount, actualCost, newBalance, companyId, source);

    return insertedCount;
}

/**
 * Utility to log final execution stats.
 */
function logProcessStats(jobId, dedupeStats, enrichedLeads, insertedCount, cost, balance, companyId, source) {
    logger.log('[DEDUPE]', {
        jobId,
        input: dedupeStats.inputCount,
        output: dedupeStats.outputCount,
        duplicates: dedupeStats.duplicatesFound,
        review: dedupeStats.reviewQueue.length
    });

    logger.log('[INTELLIGENCE]', {
        jobId,
        total: enrichedLeads.length,
        hot: enrichedLeads.filter(l => l.intelligence?.tier === 'hot').length,
        warm: enrichedLeads.filter(l => l.intelligence?.tier === 'warm').length,
        outreach: enrichedLeads.filter(l => l.intelligence?.outreachDraft !== null).length
    });

    logger.log('[CREDITS]', { jobId, companyId, inserted: insertedCount, cost, balance });
    logger.log(`[Scraper Worker] ${source}: Integrated ${insertedCount} unique leads.`);
    logger.log("-----------------------------------------");
}

// ==========================================
// HIGH-LEVEL ENTRY POINTS
// ==========================================

/**
 * Runs ALL scrapers for a given query (Full Discovery Mode).
 */
async function runAllScrapers(query, campaignId = 1, sources = null, companyId = 1, deep = false, jobId = null) {
    const sourcesToRun = sources || getAvailableSources();
    logger.log("=========================================");
    logger.log(`[Full Discovery] Multi-source scan (Deep: ${deep}) for: "${query}"`);
    logger.log(`[Full Discovery] Sources: ${sourcesToRun.join(', ')}`);
    logger.log("=========================================");

    let totalInserted = 0;
    for (const source of sourcesToRun) {
        // Check for cancellation before starting each source
        if (await isCancelled(jobId)) {
            logger.log(`[Full Discovery] Job ${jobId} cancelled — skipping remaining sources.`);
            break;
        }
        try {
            const count = await runSource(source, query, campaignId, { id: jobId }, companyId, deep);
            totalInserted += count;
        } catch (error) {
            logger.error(`[Full Discovery] ${source} failed:`, error.message);
        }
    }

    logger.log("=========================================");
    logger.log(`[Full Discovery] Complete. Total unique leads: ${totalInserted}`);
    logger.log("=========================================");
    return totalInserted;
}

/**
 * Backwards compatible single scraper runner.
 */
async function runScraper(query = "restaurants in Bangalore", campaignId = 1, companyId = 1) {
    logger.log(`[Scraper Worker] Job Started: ${new Date().toLocaleString()}`);
    return await runSource('google_maps', query, campaignId, { id: 'manual' }, companyId);
}

// Manual Execution Entry
if (require.main === module) {
    runScraper().catch(logger.error);
}

module.exports = { runScraper, runSource, runAllScrapers };
