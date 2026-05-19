const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { runSource, runAllScrapers } = require('../workers/scraperWorker');
const { getAvailableSources } = require('../scrapers');
const { insertCampaign } = require('./campaigns');

const LOCAL_DISCOVERY_SOURCES = ['google_maps', 'justdial'];
const MARKETPLACE_DISCOVERY_SOURCES = ['indiamart', 'tradeindia', 'exportersindia'];
const SOCIAL_DISCOVERY_SOURCES = ['instagram', 'facebook', 'linkedin'];

async function ensureCampaign({ companyId, campaignId, query }) {
    if (campaignId) {
        const existing = await pool.query(
            'SELECT id FROM campaigns WHERE id = $1 AND company_id = $2 LIMIT 1',
            [campaignId, companyId]
        );

        if (existing.rowCount > 0) {
            return existing.rows[0].id;
        }
    }

    const campaignName = query.trim().slice(0, 255);
    const recentMatch = await pool.query(
        `SELECT id
         FROM campaigns
         WHERE company_id = $1 AND LOWER(name) = LOWER($2)
         ORDER BY created_at DESC
         LIMIT 1`,
        [companyId, campaignName]
    );

    if (recentMatch.rowCount > 0) {
        return recentMatch.rows[0].id;
    }

    const created = await insertCampaign({
        company_id: companyId,
        name: campaignName,
        description: `Auto-generated from discovery query: "${campaignName}"`,
    });

    return created.rows[0].id;
}

function getDiscoverySources({ query, source, sources }) {
    if (Array.isArray(sources) && sources.length > 0) {
        return sources;
    }

    if (source) {
        return [source];
    }

    const normalizedQuery = query.toLowerCase();
    
    // Check for "Curation" keywords (articles, blogs, best lists)
    const impliesCuration = /(top|best|list|article|blog|rated|famous)/.test(normalizedQuery);
    
    // Add "near " and "around " to the location trigger so it routes to both maps and justdial
    const mentionsLocation = /(bangalore|bengaluru|mumbai|delhi|hyderabad|chennai|pune|kolkata|near|around|in )/.test(normalizedQuery);
    const mentionsMarketplace = /(manufacturer|supplier|wholesale|exporter|b2b|distributor|industrial)/.test(normalizedQuery);
    const mentionsSocial = /(instagram|facebook|social|influencer|creator|creator brand)/.test(normalizedQuery);

    if (impliesCuration) {
        // High-intent curative search: prioritize best local directories
        return ['google_maps', 'justdial'];
    }

    if (mentionsMarketplace) {
        return MARKETPLACE_DISCOVERY_SOURCES;
    }

    if (mentionsSocial) {
        return SOCIAL_DISCOVERY_SOURCES;
    }

    // By default globally, always run both Maps and Justdial
    return LOCAL_DISCOVERY_SOURCES; // ['google_maps', 'justdial']
}

/**
 * GET /discovery/sources
 * Returns list of all available scraper sources.
 */
router.get('/sources', (req, res) => {
    res.json({
        sources: getAvailableSources(),
    });
});

/**
 * POST /discovery/run
 * Triggers a discovery run.
 * Body: { query?: string, keywords?: string, campaignId?: number, companyId?: number, source?: string }
 * If source is omitted, runs all sources.
 */
router.post('/run', async (req, res) => {
    const rawQuery = req.body.query || req.body.keywords;
    const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
    const companyId = Number(req.body.companyId) || 1;
    const requestedCampaignId = Number(req.body.campaignId) || null;
    const { source, deep } = req.body;
    const selectedSources = getDiscoverySources({
        query,
        source,
        sources: req.body.sources
    });

    if (!query) {
        return res.status(400).json({ error: 'query or keywords is required.' });
    }

    let resolvedCampaignId;
    let jobId = null;
    try {
        resolvedCampaignId = await ensureCampaign({
            companyId,
            campaignId: requestedCampaignId,
            query,
        });

        // Track this direct search in the queue so it can be cancelled
        const queueRes = await pool.query(
            `INSERT INTO discovery_queue (company_id, campaign_id, query, status, source)
             VALUES ($1, $2, $3, 'processing', 'direct')
             RETURNING id`,
            [companyId, resolvedCampaignId, query]
        );
        jobId = queueRes.rows[0].id;

    } catch (error) {
        console.error('[Discovery API] Failed to resolve campaign or job:', error.message);
        return res.status(500).json({ error: 'Failed to prepare discovery campaign.' });
    }

    try {
        console.log(`[Discovery Engine] 🚀 IGNITION: Starting search for "${query}" (Job: ${jobId}, Sources: ${selectedSources.join(', ')})`);
        
        let leadsFound = 0;
        if (selectedSources.length === 1) {
            console.log(`[Discovery Engine] 🔍 Single Source Mode: ${selectedSources[0]}`);
            leadsFound = await runSource(selectedSources[0], query, resolvedCampaignId, { id: jobId }, companyId, !!deep);
        } else {
            console.log(`[Discovery Engine] 🌊 Multi-Source Mode: Parallel Scan Started...`);
            leadsFound = await runAllScrapers(query, resolvedCampaignId, selectedSources, companyId, !!deep, jobId);
        }

        // Finalize the job status
        await pool.query(
            'UPDATE discovery_queue SET status = $1, leads_found = $2 WHERE id = $3',
            ['completed', leadsFound, jobId]
        );

        console.log(`[Discovery Engine] ✅ SEARCH COMPLETE. Total discovered: ${leadsFound} leads.`);

        return res.json({
            message: `Discovery complete for "${query}". Found and integrated ${leadsFound} leads.`,
            status: 'complete',
            leadsFound,
            campaignId: resolvedCampaignId,
            sources: selectedSources,
            deep: !!deep,
            jobId
        });
    } catch (error) {
        console.error('[Discovery API] Error:', error.message);
        // If it failed, mark the job as failed (unless it was already cancelled)
        if (jobId) {
            await pool.query(
                "UPDATE discovery_queue SET status = 'failed' WHERE id = $1 AND status = 'processing'",
                [jobId]
            );
        }
        return res.status(500).json({ error: 'Discovery engine failed during execution.' });
    }
});

/**
 * POST /discovery/queue
 * Adds multiple queries to the discovery pipeline.
 * Body: { queries: string[], companyId: number, campaignId: number }
 */
router.post('/queue', async (req, res) => {
    const { queries, companyId, campaignId } = req.body;
    if (!Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: 'Queries array is required.' });
    }

    try {
        const values = queries.map(q => `(${companyId}, ${campaignId}, '${q.replace(/'/g, "''")}', 'pending')`).join(',');
        const result = await pool.query(`
            INSERT INTO discovery_queue (company_id, campaign_id, query, status)
            VALUES ${values}
            RETURNING id, query
        `);

        res.json({
            message: `Successfully queued ${result.rowCount} discovery requests.`,
            queued: result.rows
        });
    } catch (error) {
        console.error('[Discovery Queue] Error:', error.message);
        res.status(500).json({ error: 'Failed to queue discovery requests.' });
    }
});

/**
 * GET /discovery/queue
 * Returns the current state of the pipeline for a company.
 */
router.get('/queue/:companyId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM discovery_queue WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50',
            [req.params.companyId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch queue status.' });
    }
});

/**
 * GET /discovery/pending-notifications/:companyId
 * Returns completed batches that the user hasn't acknowledged yet.
 */
router.get('/pending-notifications/:companyId', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, query, leads_found, created_at 
            FROM discovery_queue 
            WHERE company_id = $1 
              AND status = 'completed' 
              AND is_acknowledged = FALSE
            ORDER BY created_at DESC
        `, [req.params.companyId]);
        
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending notifications.' });
    }
});

/**
 * POST /discovery/acknowledge/:id
 * Marks a batch notification as read/acknowledged.
 */
router.post('/acknowledge/:id', async (req, res) => {
    try {
        await pool.query('UPDATE discovery_queue SET is_acknowledged = TRUE WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to acknowledge notification.' });
    }
});

/**
 * POST /discovery/stop/:companyId
 * Cancels all pending and currently processing discovery jobs for a company.
 */
router.post('/stop/:companyId', async (req, res) => {
    try {
        await pool.query(`
            UPDATE discovery_queue 
            SET status = 'cancelled' 
            WHERE company_id = $1 
              AND (status = 'pending' OR status = 'processing')
        `, [req.params.companyId]);
        
        res.json({ success: true, message: 'Discovery stopped successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to stop discovery.' });
    }
});

module.exports = router;
