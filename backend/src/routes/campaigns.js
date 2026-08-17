const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { bulkDispatch } = require('../services/bulkDispatcher');
const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

const sequenceQueue = new Queue('sequenceQueue', { connection });

const DEFAULT_CAMPAIGN_STATUS = 'active';

let campaignColumnsPromise = null;

async function getCampaignColumns() {
    if (!campaignColumnsPromise) {
        campaignColumnsPromise = pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'campaigns'
        `).then((result) => new Set(result.rows.map((row) => row.column_name)))
            .catch((error) => {
                campaignColumnsPromise = null;
                throw error;
            });
    }

    return campaignColumnsPromise;
}

async function insertCampaign({ company_id, name, description, status = DEFAULT_CAMPAIGN_STATUS }) {
    const columns = await getCampaignColumns();
    const insertColumns = ['company_id', 'name'];
    const values = [company_id, name];

    if (columns.has('description')) {
        insertColumns.push('description');
        values.push(description || null);
    }

    if (columns.has('status')) {
        insertColumns.push('status');
        values.push(status);
    }

    const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');
    const query = `
        INSERT INTO campaigns (${insertColumns.join(', ')})
        VALUES (${placeholders})
        RETURNING *;
    `;

    return pool.query(query, values);
}

async function updateCampaign(id, { name, description, status }) {
    const columns = await getCampaignColumns();
    const updates = [];
    const values = [];

    if (name !== undefined) {
        updates.push(`name = $${values.length + 1}`);
        values.push(name);
    }

    if (description !== undefined && columns.has('description')) {
        updates.push(`description = $${values.length + 1}`);
        values.push(description);
    }

    if (status !== undefined && columns.has('status')) {
        updates.push(`status = $${values.length + 1}`);
        values.push(status);
    }

    if (updates.length === 0) {
        return { rowCount: 0, rows: [] };
    }

    values.push(id);

    const query = `
        UPDATE campaigns
        SET ${updates.join(', ')}
        WHERE id = $${values.length}
        RETURNING *;
    `;

    return pool.query(query, values);
}

/**
 * Helper to handle database errors (DRY).
 */
const handleDBError = (res, err, message = 'Database operation failed') => {
    console.error(`[DB Error]: ${err.message}`, err);
    return res.status(500).json({ error: message });
};

/**
 * 1. GET /campaigns
 * Supports optional filtering by company_id.
 */
router.get('/', async (req, res) => {
    const { company_id } = req.query;
    let query = 'SELECT * FROM campaigns';
    const params = [];

    if (company_id) {
        params.push(company_id);
        query += ' WHERE company_id = $1';
    }

    query += ' ORDER BY created_at DESC';

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        return handleDBError(res, err, 'Failed to fetch campaigns');
    }
});

/**
 * 2. POST /campaigns
 * Create a new campaign.
 */
router.post('/', async (req, res) => {
    const { company_id, name, description } = req.body;

    if (!company_id || !name) {
        return res.status(400).json({ error: 'company_id and name are required' });
    }

    try {
        const result = await insertCampaign({
            company_id,
            name: name.trim(),
            description,
        });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        return handleDBError(res, err, 'Failed to create campaign');
    }
});

/**
 * 3. PATCH /campaigns/:id
 * Update name or description.
 */
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, status } = req.body;

    try {
        const result = await updateCampaign(id, {
            name,
            description,
            status,
        });
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});

router.post('/:id/bulk-send', async (req, res) => {
    const { id } = req.params;
    const { channel, companyId } = req.body;
    
    if (!channel || !companyId) {
        return res.status(400).json({ error: 'Channel and companyId are required' });
    }

    try {
        // [SELF-HEALING] Rescue only truly orphaned leads — those marked 'queued' in DB
        // but whose messages were never actually sent (e.g. Redis crashed mid-dispatch).
        // IMPORTANT: We exclude any lead that has a 'sent' message to prevent re-sending.
        const resetRes = await pool.query(`
            UPDATE leads SET status = 'new'
            WHERE campaign_id = $1
              AND status = 'queued'
              AND id NOT IN (
                  SELECT DISTINCT lead_id FROM messages WHERE status = 'sent'
              )`,
            [id]
        );

        // Clean up any pending ghost messages left by a crashed Redis queue
        const resetMsgs = await pool.query(`
            UPDATE messages m
            SET status = 'failed', failure_reason = 'Redis queue dropped (Ghost Message)'
            FROM leads l
            WHERE m.lead_id = l.id
              AND l.campaign_id = $1
              AND m.status = 'pending'`,
            [id]
        );

        if (resetRes.rowCount > 0 || resetMsgs.rowCount > 0) {
            console.log(`📡 [Self-Healing] Rescued ${resetRes.rowCount} leads and cleaned ${resetMsgs.rowCount} ghost messages for campaign ${id}`);
        }

        // [PRE-CHECK] Only count leads that haven't been contacted yet
        let leadCheckQuery = `
            SELECT COUNT(id) FROM leads 
            WHERE campaign_id = $1
              AND status IN ('new', 'draft')
        `;
        let checkValues = [id];

        // For email-only, they need an email address. For whatsapp-only, they need a phone.
        if (channel.toLowerCase() === 'email') {
            leadCheckQuery += ` AND email_address IS NOT NULL`;
        } else if (channel.toLowerCase() === 'whatsapp') {
            leadCheckQuery += ` AND phone IS NOT NULL`;
        }

        const checkRes = await pool.query(leadCheckQuery, checkValues);
        const availableLeads = parseInt(checkRes.rows[0].count, 10);

        if (availableLeads === 0) {
            return res.json({ 
                message: "No fresh leads found! It looks like outreach was already sent, or no leads have valid contact info for this channel." 
            });
        }

        // 1. Return immediately to the UI
        res.json({ message: `🚀 [Human-Like Dispatch Started] Queuing outreach for ${availableLeads} leads via ${channel}. You'll see progress in real-time!` });

        // 2. Start background dispatch
        if (channel.toLowerCase() === 'all') {
            bulkDispatch(id, 'whatsapp', companyId).catch(err => {
                console.error('🔥 [Bulk Dispatch WhatsApp CRASHED]:', err.message);
            });
            bulkDispatch(id, 'email', companyId).catch(err => {
                console.error('🔥 [Bulk Dispatch Email CRASHED]:', err.message);
            });
        } else {
            bulkDispatch(id, channel.toLowerCase(), companyId).catch(err => {
                console.error('🔥 [Bulk Dispatch CRASHED]:', err.message);
            });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to initiate bulk dispatch' });
    }
});

/**
 * GET /campaigns/:id/outreach-progress
 * Fetch real-time progress of the active outreach queue
 */
router.get('/:id/outreach-progress', async (req, res) => {
    const { id } = req.params;
    try {
        const progressQuery = `
            SELECT 
                COUNT(*) as total_dispatched,
                SUM(CASE WHEN m.status = 'pending' THEN 1 ELSE 0 END) as queued,
                SUM(CASE WHEN m.status = 'sent' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN m.status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM messages m
            JOIN leads l ON m.lead_id = l.id
            WHERE l.campaign_id = $1 AND m.message_type = 'first_outreach'
        `;
        const result = await pool.query(progressQuery, [id]);
        const stats = result.rows[0];
        
        res.json({
            dispatched: parseInt(stats.total_dispatched) || 0,
            queued: parseInt(stats.queued) || 0,
            completed: parseInt(stats.completed) || 0,
            failed: parseInt(stats.failed) || 0
        });
    } catch (err) {
        console.error('Progress tracking failed:', err);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

/**
 * GET /campaigns/:id/outreach-summary
 * Returns a per-channel breakdown of sent vs. remaining leads.
 * Used by the UI to show "Continue Sending" state before dispatch.
 */
router.get('/:id/outreach-summary', async (req, res) => {
    const { id } = req.params;
    try {
        const [totalRes, sentRes, remainingRes] = await Promise.all([
            pool.query(
                `SELECT COUNT(*) FROM leads WHERE campaign_id = $1`,
                [id]
            ),
            pool.query(
                `SELECT
                    SUM(CASE WHEN m.channel = 'whatsapp' AND m.status = 'sent' THEN 1 ELSE 0 END) AS whatsapp_sent,
                    SUM(CASE WHEN m.channel = 'email' AND m.status = 'sent' THEN 1 ELSE 0 END) AS email_sent
                 FROM messages m
                 JOIN leads l ON m.lead_id = l.id
                 WHERE l.campaign_id = $1 AND m.message_type = 'first_outreach'`,
                [id]
            ),
            pool.query(
                `SELECT
                    SUM(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) AS whatsapp_remaining,
                    SUM(CASE WHEN email_address IS NOT NULL THEN 1 ELSE 0 END) AS email_remaining
                 FROM leads
                 WHERE campaign_id = $1 AND status IN ('new', 'draft')`,
                [id]
            )
        ]);

        const sent = sentRes.rows[0];
        const remaining = remainingRes.rows[0];

        res.json({
            total: parseInt(totalRes.rows[0].count) || 0,
            whatsapp_sent: parseInt(sent.whatsapp_sent) || 0,
            email_sent: parseInt(sent.email_sent) || 0,
            whatsapp_remaining: parseInt(remaining.whatsapp_remaining) || 0,
            email_remaining: parseInt(remaining.email_remaining) || 0
        });
    } catch (err) {
        console.error('Outreach summary failed:', err);
        res.status(500).json({ error: 'Failed to fetch outreach summary' });
    }
});

/**
 * 4. GET /campaigns/:id/leads
 * Fetch all leads belonging to a specific campaign.
 */
router.get('/:id/leads', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM leads WHERE campaign_id = $1 ORDER BY created_at DESC', [id]);
        res.json(result.rows);
    } catch (err) {
        return handleDBError(res, err, 'Failed to fetch campaign leads');
    }
});

/**
 * 5. DELETE /campaigns/:id
 * Deletes a campaign and unassigns its leads instead of deleting them.
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Delete associated leads from this campaign
        // (This will also cascade delete enrollments/history if configured with DELETE CASCADE)
        const leadsResult = await client.query(
            'DELETE FROM leads WHERE campaign_id = $1',
            [id]
        );

        // 2. Now safe to delete the campaign
        const campaignResult = await client.query(
            'DELETE FROM campaigns WHERE id = $1 RETURNING *',
            [id]
        );

        if (campaignResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Campaign not found' });
        }

        await client.query('COMMIT');

        return res.json({
            success: true,
            deletedCampaign: campaignResult.rows[0],
            leadsDeleted: leadsResult.rowCount,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        return handleDBError(res, err, 'Failed to delete campaign');
    } finally {
        client.release();
    }
});

/**
 * 6. POST /campaigns/:id/steps
 * Add a step to the outreach sequence.
 */
router.post('/:id/steps', async (req, res) => {
    const { id } = req.params;
    const { type, delay_days, subject, body, step_order } = req.body;

    if (!type || !body || step_order === undefined) {
        return res.status(400).json({ error: 'type, body, and step_order are required' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO sequence_steps (campaign_id, type, delay_days, subject, body, step_order)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (campaign_id, step_order) 
            DO UPDATE SET type = $2, delay_days = $3, subject = $4, body = $5
            RETURNING *
        `, [id, type, delay_days || 0, subject, body, step_order]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        return handleDBError(res, err, 'Failed to add sequence step');
    }
});

/**
 * 7. GET /campaigns/:id/steps
 * Fetch the full sequence for a campaign.
 */
router.get('/:id/steps', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM sequence_steps WHERE campaign_id = $1 ORDER BY step_order ASC',
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        return handleDBError(res, err, 'Failed to fetch sequence steps');
    }
});

/**
 * 8. POST /campaigns/:id/enroll
 * Enroll a lead into the automated sequence.
 */
router.post('/:id/enroll', async (req, res) => {
    const { id } = req.params; // campaign_id
    const { lead_id } = req.body;

    if (!lead_id) {
        return res.status(400).json({ error: 'lead_id is required' });
    }

    try {
        // 1. Create enrollment record
        const enrollmentRes = await pool.query(`
            INSERT INTO lead_enrollments (lead_id, campaign_id, current_step_order, status, next_run_at)
            VALUES ($1, $2, 1, 'active', NOW())
            ON CONFLICT (lead_id, campaign_id) DO UPDATE SET status = 'active', updated_at = NOW()
            RETURNING id
        `, [lead_id, id]);

        const enrollmentId = enrollmentRes.rows[0].id;

        // 2. Add to BullMQ to process step 1 immediately
        await sequenceQueue.add(
            `enrollment-${enrollmentId}-start`,
            { enrollmentId },
            { removeOnComplete: true }
        );

        res.json({ success: true, enrollmentId, message: 'Lead enrolled and sequence started' });
    } catch (err) {
        return handleDBError(res, err, 'Failed to enroll lead in sequence');
    }
});

/**
 * 9. PATCH /campaigns/:id/leads/update-all-drafts
 * Overwrites the outreach_draft for all leads in this campaign.
 */
router.patch('/:id/leads/update-all-drafts', async (req, res) => {
    const { id } = req.params;
    const { outreach_draft } = req.body;

    try {
        await pool.query(
            'UPDATE leads SET outreach_draft = $1 WHERE campaign_id = $2',
            [outreach_draft, id]
        );
        res.json({ success: true, message: 'All leads updated with new master blueprint' });
    } catch (err) {
        return handleDBError(res, err, 'Failed to update lead drafts');
    }
});

module.exports = router;
module.exports.insertCampaign = insertCampaign;
