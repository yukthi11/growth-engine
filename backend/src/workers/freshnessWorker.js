const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const pool = require('../config/db');
const { checkFreshness, markStaleLeads } = require('../utils/freshnessChecker');
const logger = console; // Replace with actual logger if available

/**
 * Lead Freshness Worker
 * Automatically checks all active leads for staleness and marks them.
 */
async function runFreshnessCheck() {
    console.log(`[Freshness Worker] Starting cycle: ${new Date().toLocaleString()}`);

    try {
        // 1. Fetch all leads that aren't already marked stale
        // We limit to 500 per run to prevent memory issues
        const res = await pool.query('SELECT * FROM leads WHERE is_stale = false LIMIT 500');
        const leads = res.rows;

        if (leads.length === 0) {
            console.log('[Freshness Worker] No leads to check.');
            return;
        }

        console.log(`[Freshness Worker] Analyzing ${leads.length} leads...`);

        // 2. Determine which ones are stale
        const results = await checkFreshness(leads);
        const staleCount = results.filter(r => r.isStale).length;

        // 3. Persist to DB
        await markStaleLeads(pool, results);

        console.log(`[Freshness Worker] Cycle complete. Found ${staleCount} stale leads.`);

        return {
            checked: leads.length,
            stale: staleCount
        };

    } catch (error) {
        console.error('[Freshness Worker] Error during run:', error);
        throw error;
    }
}

if (require.main === module) {
    runFreshnessCheck()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { runFreshnessCheck };
