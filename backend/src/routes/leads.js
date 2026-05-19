const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exportToSheets } = require('../utils/sheetsExporter');
const leadScorer = require('../services/leadScorer');
const { generateFirstMessage, generateEmailDraft } = require('../services/messageGenerator');
const { addWhatsAppJob, whatsappQueue } = require('../queue/whatsappQueue');

/**
 * Helper to handle database errors and avoid repetitive code (DRY).
 */
const handleDBError = (res, err, message = 'Database operation failed') => {
    console.error(`🔥 [DB Error]: ${err.message}`);
    if (err.detail) console.error(`   - Detail: ${err.detail}`);
    if (err.code === '23505') { 
        return res.status(409).json({ 
            error: 'Duplicate Lead Blocked', 
            detail: `You already have this lead in this campaign context.` 
        });
    }
    return res.status(500).json({ error: message, debug: err.message });
};

/**
 * 1. GET /leads
 */
router.get('/', async (req, res) => {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;
    if (limit > 100) limit = 100;
    if (page < 1) page = 1;
    const offset = (page - 1) * limit;

    const { company_id, status, campaign_id, search, intent } = req.query;
    const params = [];
    const conditions = [];

    if (company_id) { params.push(company_id); conditions.push(`company_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (campaign_id) { params.push(campaign_id); conditions.push(`campaign_id = $${params.length}`); }
    if (search) {
        params.push(`%${search}%`);
        const searchIdx = params.length;
        conditions.push(`(business_name ILIKE $${searchIdx} OR email_address ILIKE $${searchIdx} OR phone ILIKE $${searchIdx})`);
    }
    if (intent) { params.push(intent); conditions.push(`primary_intent = $${params.length}`); }

    let query = 'SELECT * FROM leads';
    let countQuery = 'SELECT COUNT(*) FROM leads';
    if (conditions.length > 0) {
        const whereClause = ` WHERE ${conditions.join(' AND ')}`;
        query += whereClause;
        countQuery += whereClause;
    }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const queryParams = [...params, limit, offset];

    try {
        const [result, countResult] = await Promise.all([
            pool.query(query, queryParams),
            pool.query(countQuery, params)
        ]);
        res.status(200).json({
            data: result.rows,
            pagination: { page, limit, total: parseInt(countResult.rows[0].count) }
        });
    } catch (err) { return handleDBError(res, err, 'Failed to fetch leads'); }
});

/**
 * 1b. GET /leads/:id — single lead record
 */
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });
        res.json(result.rows[0]);
    } catch (err) { return handleDBError(res, err, 'Failed to fetch lead'); }
});

/**
 * 2. POST /leads
 */
router.post('/', async (req, res) => {
    const {
        company_id, business_name, contact_name, email_address, phone, 
        source, campaign_id, website, instagram_username, location_normalized,
        gap_pillar, gap_vertical, gap_pitch
    } = req.body;

    if (!company_id || !business_name) {
        return res.status(400).json({ error: 'company_id and business_name are required.' });
    }

    try {
        const query = `
            INSERT INTO leads (
                company_id, business_name, contact_name, email_address, phone, 
                source, status, campaign_id, website, instagram_username, location_normalized,
                gap_pillar, gap_vertical, gap_pitch
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, $8, $9, $10, $11, $12, $13)
            RETURNING *;
        `;
        const values = [
            parseInt(company_id), business_name, contact_name || null, email_address || null, 
            phone || null, source || 'manual', campaign_id ? parseInt(campaign_id) : null,
            website || null, instagram_username || null, location_normalized || null,
            gap_pillar || null, gap_vertical || null, gap_pitch || null
        ];

        const result = await pool.query(query, values);
        const newLead = result.rows[0];

        // Scoring & Classification
        const scores = leadScorer.scoreLeadIntent(newLead);
        const updateRes = await pool.query(`
            UPDATE leads 
            SET visibility_score = $1, footfall_score = $2, partnership_score = $3, primary_intent = $4,
                gap_pillar = COALESCE(gap_pillar, $6)
            WHERE id = $5 RETURNING *;
        `, [scores.visibility_score, scores.footfall_score, scores.partnership_score, scores.primary_intent, newLead.id, scores.gap_pillar]);

        const finalLead = updateRes.rows[0];

        // [Phase 2] Generate and Store Outreach Message
        try {
            const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [finalLead.company_id]);
            const company = compRes.rows[0];
            const preview = await generateFirstMessage(finalLead, company);
            
            // Update the lead's Outreach DNA and Match Score so it shows up in the UI
            const matchScore = Math.min(((scores.visibility_score + scores.footfall_score) / 6) * 100, 100);
            
            await pool.query(`
                UPDATE leads 
                SET outreach_draft = $1, intent_score = $2
                WHERE id = $3
            `, [preview.message, Math.round(matchScore), finalLead.id]);

            await pool.query(`
                INSERT INTO messages (lead_id, message_type, content, status, channel, message_text)
                VALUES ($1, 'first_outreach', $2, 'pending', 'whatsapp', $2)
            `, [finalLead.id, preview.message]);

            res.status(201).json({ ...finalLead, generated_message: preview.message });
        } catch (msgErr) {
            console.warn(`[Phase 2 Warning] Message generation failed:`, msgErr.message);
            res.status(201).json(finalLead);
        }
    } catch (err) { return handleDBError(res, err, 'Failed to create lead'); }
});

/**
 * 3. PATCH /leads/:id
 */
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    const setClause = [];
    const values = [];

    Object.keys(fields).forEach((key, index) => {
        if (key === 'updated_at') return;
        setClause.push(`${key} = $${index + 1}`);
        values.push(fields[key]);
    });

    if (setClause.length === 0) return res.status(400).json({ error: "No fields provided to update" });

    values.push(id);
    const query = `UPDATE leads SET ${setClause.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;

    try {
        const result = await pool.query(query, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });
        res.json(result.rows[0]);
    } catch (err) { return handleDBError(res, err, 'Failed to update lead'); }
});

/**
 * 4. GET /leads/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });
        res.json(result.rows[0]);
    } catch (err) { return handleDBError(res, err); }
});

/**
 * 5. DELETE /leads/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });
        res.json({ message: 'Deleted', id: result.rows[0].id });
    } catch (err) { return handleDBError(res, err); }
});

/**
 * 6. POST /leads/:id/preview-message
 */
router.all('/:id/preview-message', async (req, res) => {
    try {
        const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        if (leadRes.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });
        const lead = leadRes.rows[0];
        
        const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [lead.company_id]);
        const company = compRes.rows[0];
        
        const preview = await generateFirstMessage(lead, company);
        res.json({ ...preview, lead_id: lead.id });
    } catch (err) { res.status(500).json({ error: 'Preview failed' }); }
});

/**
 * 7. POST /leads/:id/send (Queues a WhatsApp message)
 */
router.post('/:id/send', async (req, res) => {
    try {
        const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        if (leadRes.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });
        
        const msgRes = await pool.query("SELECT id FROM messages WHERE lead_id = $1 AND message_type = 'first_outreach' AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [req.params.id]);
        if (msgRes.rowCount === 0) return res.status(404).json({ error: 'No pending message found' });

        const job = await addWhatsAppJob({ lead_id: req.params.id, message_id: msgRes.rows[0].id });
        res.json({ queued: true, jobId: job.id });
    } catch (err) { res.status(500).json({ error: 'Dispatch failed' }); }
});

/**
 * 8. POST /leads/sync-campaign
 */
router.post('/sync-campaign', async (req, res) => {
    const { campaignId, companyId } = req.body;
    try {
        const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
        const campRes = await pool.query('SELECT name FROM campaigns WHERE id = $1', [campaignId]);
        const leadsRes = await pool.query('SELECT * FROM leads WHERE campaign_id = $1', [campaignId]);
        
        const { exportToSheets } = require('../utils/sheetsExporter');
        const syncRes = await exportToSheets(leadsRes.rows, compRes.rows[0].spreadsheet_id, campRes.rows[0].name);
        res.json({ success: true, url: syncRes.spreadsheetUrl });
    } catch (err) { res.status(500).json({ error: 'Sync failed' }); }
});

/**
 * 9. POST /leads/:id/suggest-reply
 */
router.post('/:id/suggest-reply', async (req, res) => {
    try {
        const leadRes = await pool.query(`SELECT l.*, c.name as company_name, c.overview, c.goal FROM leads l LEFT JOIN companies c ON l.company_id = c.id WHERE l.id = $1`, [req.params.id]);
        const lead = leadRes.rows[0];
        
        const prompt = `You are Devi from ${lead.company_name}. Goal: ${lead.goal}. Draft a friendly follow-up to ${lead.business_name} under 20 words.`;
        const { generalPrompt } = require('../scrapers/llmExtractor');
        const reply = await generalPrompt(prompt);
        res.json({ suggestedReply: reply });
    } catch (err) { res.status(500).json({ error: 'AI Suggestion failed' }); }
});

/**
 * 10. POST /leads/:id/generate-mockup
 * Generates (or fetches) the mockup for a Presence lead on-demand.
 */
router.post('/:id/generate-mockup', async (req, res) => {
    try {
        const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        if (leadRes.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });
        const lead = leadRes.rows[0];

        // Return existing mockup if already generated
        if (lead.mockup_url) {
            return res.json({ mockup_url: lead.mockup_url, cached: true });
        }

        // Generate on-demand
        const { generateMockup } = require('../services/mockupGenerator');
        const { uploadMockup } = require('../lib/r2');

        console.log(`[Mockup] On-demand generation for lead ${lead.id}: ${lead.business_name}`);
        const buffer = await generateMockup({
            id: lead.id,
            business_name: lead.business_name,
            category: lead.gap_vertical || 'generic',
            location: lead.location_normalized || ''
        });

        if (!buffer) return res.status(500).json({ error: 'Mockup generation returned empty buffer' });

        const mockupUrl = await uploadMockup(buffer, lead.id);
        await pool.query('UPDATE leads SET mockup_url = $1 WHERE id = $2', [mockupUrl, lead.id]);
        console.log(`[Mockup] Saved: ${mockupUrl}`);

        res.json({ mockup_url: mockupUrl, cached: false });
    } catch (err) {
        console.error('[Mockup] On-demand generation failed:', err.message);
        res.status(500).json({ error: 'Mockup generation failed: ' + err.message });
    }
});

/**
 * 11. POST /leads/:id/draft-email
 */
router.post('/:id/draft-email', async (req, res) => {
    try {
        const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        if (leadRes.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });
        let lead = leadRes.rows[0];
        
        const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [lead.company_id]);
        const company = compRes.rows[0];

        let mockupUrl = lead.mockup_url;
        if (!mockupUrl && lead.gap_pillar === 'presence') {
            try {
                const { generateMockup } = require('../services/mockupGenerator');
                const { uploadMockup } = require('../lib/r2');
                console.log(`[Draft Email] Generating on-demand mockup for: ${lead.business_name}`);
                const buffer = await generateMockup({
                    id: lead.id,
                    business_name: lead.business_name,
                    category: lead.gap_vertical || 'generic',
                    location: lead.location_normalized || ''
                });
                if (buffer) {
                    mockupUrl = await uploadMockup(buffer, lead.id);
                    await pool.query('UPDATE leads SET mockup_url = $1 WHERE id = $2', [mockupUrl, lead.id]);
                    console.log(`[Draft Email] Mockup saved: ${mockupUrl}`);
                }
            } catch (mockupErr) {
                console.error(`[Draft Email] On-demand mockup failed:`, mockupErr.message);
            }
        }
        
        let draft = await generateEmailDraft(lead, company);
        
        if (mockupUrl) {
            draft = draft.replace(/\{\{mockup_url\}\}/g, mockupUrl);
        } else {
            // Strip placeholder cleanly so body reads well even without a mockup
            draft = draft.replace(/\n?\{\{mockup_url\}\}\n?/g, '');
        }

        const parts = draft.split('\n\n');
        const subject = parts[0]?.replace('Subject: ', '') || 'Outreach';
        const body = parts.slice(1).join('\n\n');
        
        res.json({ subject, body, mockup_url: mockupUrl, lead_id: lead.id });
    } catch (err) { 
        console.error('Email draft error:', err);
        res.status(500).json({ error: 'Email drafting failed' }); 
    }
});

module.exports = router;
