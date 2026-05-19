const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const cron = require('node-cron');
const { runAllScrapers } = require('../workers/scraperWorker');
const { triggerEnrichmentBatch } = require('../workers/enrichmentWorker');
const { triggerClassificationBatch } = require('../workers/classificationWorker');
const { runFreshnessCheck } = require('../workers/freshnessWorker');
const { processDiscoveryQueue, autoDraftLeads } = require('../workers/automationWorker');

/**
 * Lead Freshness Scheduler
 * Runs daily at 2 AM to flag stale data for re-scraping.
 */
cron.schedule('0 2 * * *', async () => {
    console.log(`[Scheduler] Triggering Lead Freshness Check: ${new Date().toLocaleString()}`);
    try {
        await runFreshnessCheck();
    } catch (error) {
        console.error("[Scheduler] Error during freshness check run:", error);
    }
});

/**
 * Lead Discovery Scheduler
 * Runs multi-source scraping automatically every 4 hours.
 */
cron.schedule('0 */4 * * *', async () => {
    console.log(`[Scheduler] Triggering multi-source discovery: ${new Date().toLocaleString()}`);

    const DEFAULT_QUERY = "restaurants in Bangalore";
    const DEFAULT_CAMPAIGN_ID = 1;

    try {
        await runAllScrapers(DEFAULT_QUERY, DEFAULT_CAMPAIGN_ID);
    } catch (error) {
        console.error("[Scheduler] Error during automated discovery run:", error);
    }
});

/**
 * Lead Enrichment Scheduler
 * Checks for leads missing emails and tries to discover them every 4 hours.
 * Offset by 30 minutes from Discovery.
 */
cron.schedule('30 */4 * * *', async () => {
    console.log(`[Scheduler] Triggering Lead Enrichment: ${new Date().toLocaleString()}`);
    try {
        await triggerEnrichmentBatch(50);
    } catch (error) {
        console.error("[Scheduler] Error during enrichment run:", error);
    }
});

/**
 * Lead Classification Scheduler
 * Runs categorization for new leads every 4 hours.
 * Offset by 1 hour from Discovery.
 */
cron.schedule('0 1,5,9,13,17,21 * * *', async () => {
    console.log(`[Scheduler] Triggering Lead Classification: ${new Date().toLocaleString()}`);
    try {
        await triggerClassificationBatch(100);
    } catch (error) {
        console.error("[Scheduler] Error during classification run:", error);
    }
});

/**
 * Discovery Queue Pipeline (Every 5 minutes)
 * Picks up new keywords and runs discovery workers.
 */
cron.schedule('*/5 * * * *', async () => {
    // console.log(`[Scheduler] Checking Discovery Pipeline: ${new Date().toLocaleString()}`);
    await processDiscoveryQueue();
});

/**
 * Auto-Drafter (Every 10 minutes)
 * Generates AI outreach for new Tier A leads.
 */
cron.schedule('*/10 * * * *', async () => {
    // console.log(`[Scheduler] Checking Auto-Drafter: ${new Date().toLocaleString()}`);
    await autoDraftLeads();
});

console.log("[Scheduler] Lead Discovery Engine scheduled (Every 4 Hours, Multi-Source)");
console.log("[Scheduler] Lead Enrichment Engine scheduled (Every 4 Hours, offset by 30m)");
console.log("[Scheduler] Lead Classification Engine scheduled (Every 4 Hours, offset by 1h)");
console.log("[Scheduler] Lead Freshness Engine scheduled (Daily at 2 AM)");

// Trigger immediate check on startup
processDiscoveryQueue();
autoDraftLeads();

module.exports = cron;
