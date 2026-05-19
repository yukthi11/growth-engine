const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { Worker } = require('bullmq');
const { connection } = require('../config/redis');
const classificationService = require('../services/classificationService');
const leadScorer = require('../services/leadScorer');
const { generateFirstMessage } = require('../services/messageGenerator');
const pool = require('../config/db');

/**
 * Worker to process classification jobs.
 */
const classificationWorker = new Worker(
    'classificationQueue',
    async (job) => {
        const { leadId, business_name, website } = job.data;
        console.log(`[Classification] Processing lead: ${business_name}`);

        try {
            const campaignId = await classificationService.classifyLead({ business_name, website });

            // Update both campaign and company so it shows up in the right workspace
            const updateQuery = `
                UPDATE leads 
                SET 
                    campaign_id = $1,
                    company_id = (SELECT company_id FROM campaigns WHERE id = $1)
                WHERE id = $2
            `;
            await pool.query(updateQuery, [campaignId, leadId]);

            // RE-ENGAGE SCORER after classification (PHASE 6)
            const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
            const lead = leadRes.rows[0];
            const scores = leadScorer.scoreLeadIntent(lead);

            await pool.query(`
                UPDATE leads 
                SET 
                    visibility_score = $1,
                    footfall_score = $2,
                    partnership_score = $3,
                    primary_intent = $4
                WHERE id = $5
            `, [scores.visibility_score, scores.footfall_score, scores.partnership_score, scores.primary_intent, leadId]);

            // GENERATE MESSAGE (Phase 2)
            try {
                const leadResFinal = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
                const preview = await generateFirstMessage(leadResFinal.rows[0]);
                
                await pool.query(`
                    INSERT INTO messages (lead_id, message_type, content, status, channel, message_text)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT DO NOTHING;
                `, [leadId, 'first_outreach', preview.message, 'pending', 'whatsapp', preview.message]);
                
                console.log(`[Classification] SUCCESS: Lead "${business_name}" scored and message generated.`);
            } catch (msgErr) {
                console.warn(`[Classification Warning]: Failed to generate auto-outreach:`, msgErr.message);
            }

            console.log(`[Classification] SUCCESS: Lead "${business_name}" assigned to Campaign ID: ${campaignId}`);
        } catch (error) {
            console.error(`[Classification] Job ${job.id} failed:`, error);
            throw error;
        }
    },
    {
        connection,
        concurrency: 5 // Higher concurrency for AI calls
    }
);

classificationWorker.on('completed', (job) => {
    console.log(`[Classification] Job ${job.id} completed.`);
});

classificationWorker.on('failed', (job, err) => {
    console.error(`[Classification] Job ${job.id} failed with ${err.message}`);
});

/**
 * Trigger classification for leads that are in 'new' status or have default campaign.
 */
async function triggerClassificationBatch(limit = 20) {
    const { addClassificationJob } = require('../queue/classificationQueue');

    try {
        const res = await pool.query(`
            SELECT id, business_name, website 
            FROM leads 
            WHERE campaign_id = 1 OR campaign_id IS NULL
            ORDER BY created_at DESC
            LIMIT $1;
        `, [limit]);

        for (const lead of res.rows) {
            await addClassificationJob({
                leadId: lead.id,
                business_name: lead.business_name,
                website: lead.website
            });
        }
    } catch (error) {
        console.error(`[Classification] Error triggering batch:`, error);
    }
}

module.exports = {
    classificationWorker,
    triggerClassificationBatch
};
