const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateSummaries } = require('../services/companySummarizer');
const { geocodeLocation } = require('../utils/geocoder');
const multer = require('multer');
const path = require('path');

// Configure Multer for local disk storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'media-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only images (JPG, PNG, GIF) are allowed'));
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM companies ORDER BY id'
        );
        // Force 999999 credits for all companies during local testing
        const companiesWithBypassedCredits = result.rows.map(company => ({
            ...company,
            credits: 999999
        }));
        res.json(companiesWithBypassedCredits);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Company not found' });
        
        const company = result.rows[0];
        // Ensure credits are always shown as bypassed for testing
        res.json({ ...company, credits: 999999 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch company' });
    }
});

router.post('/', async (req, res) => {
    const { name, email, overview, goal, whatsapp_number, instagram_id, smtp_password } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO companies (name, email, overview, goal, whatsapp_number, instagram_id, smtp_password) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, email || 'admin@growth-engine.com', overview, goal, whatsapp_number, instagram_id, smtp_password]
        );
        const company = result.rows[0];
        // Trigger non-blocking AI summarization to save tokens on future runs
        generateSummaries(company.id).catch(e => console.error('[Summarizer Trigger] Failed:', e.message));
        res.status(201).json(company);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create company' });
    }
});

router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        name, email, overview, goal, whatsapp_number, instagram_id, 
        credits, smtp_password, whatsapp_template, 
        email_subject_template, email_body_template,
        auto_enrich, auto_outreach
    } = req.body;
    try {
        const result = await pool.query(
            `UPDATE companies 
             SET name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 overview = COALESCE($3, overview),
                 goal = COALESCE($4, goal),
                 whatsapp_number = COALESCE($5, whatsapp_number),
                 instagram_id = COALESCE($6, instagram_id),
                 credits = COALESCE($7, credits),
                 smtp_password = COALESCE($8, smtp_password),
                 whatsapp_template = COALESCE($9, whatsapp_template),
                 email_subject_template = COALESCE($10, email_subject_template),
                 email_body_template = COALESCE($11, email_body_template),
                 auto_enrich = COALESCE($13, auto_enrich),
                 auto_outreach = COALESCE($14, auto_outreach)
             WHERE id = $12 RETURNING *`,
            [name, email, overview, goal, whatsapp_number, instagram_id, credits, smtp_password, whatsapp_template, email_subject_template, email_body_template, id, auto_enrich, auto_outreach]
        );
        const company = result.rows[0];
        // Trigger non-blocking AI summarization to save tokens on future runs
        if (overview || goal) {
            generateSummaries(company.id).catch(e => console.error('[Summarizer Trigger] Failed:', e.message));
        }
        res.json(company);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update company' });
    }
});

/**
 * GET /:id/geo-stats
 * Returns campaign-level location aggregation for the geospatial command center.
 * Groups leads by campaign, and extracts location data from campaign names & lead locations.
 * Includes per-channel pending message counts (WhatsApp vs Email), plus geocoded
 * lat/lng for each campaign's most common lead location (see utils/geocoder.js).
 */
router.get('/:id/geo-stats', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                c.id as campaign_id,
                c.name as campaign_name,
                COUNT(DISTINCT l.id)::int as total_leads,
                COUNT(DISTINCT l.id) FILTER (WHERE l.status IN ('outreach', 'contacted', 'messaged'))::int as contacted,
                COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'new')::int as pending,
                (SELECT COUNT(*)::int FROM replies r WHERE r.lead_id = ANY(ARRAY_AGG(DISTINCT l.id)) AND r.intent = 'interested') as responded,
                MODE() WITHIN GROUP (ORDER BY l.location_normalized) as top_location,
                COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'pending' AND m.channel = 'whatsapp')::int as pending_whatsapp,
                COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'pending' AND m.channel = 'email')::int as pending_email,
                COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'sent' AND m.channel = 'whatsapp')::int as sent_whatsapp,
                COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'sent' AND m.channel = 'email')::int as sent_email,
                COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'failed')::int as failed_messages
            FROM campaigns c
            LEFT JOIN leads l ON l.campaign_id = c.id AND l.company_id = $1
            LEFT JOIN messages m ON m.lead_id = l.id
            WHERE c.company_id = $1
            GROUP BY c.id, c.name
            HAVING COUNT(DISTINCT l.id) > 0
            ORDER BY COUNT(DISTINCT l.id) DESC
        `, [id]);

        // Sequential (not Promise.all) so uncached lookups respect Nominatim's rate limit.
        const campaigns = [];
        for (const campaign of result.rows) {
            const coords = (await geocodeLocation(campaign.top_location))
                || (await geocodeLocation(campaign.campaign_name));
            campaigns.push({ ...campaign, lat: coords?.lat ?? null, lng: coords?.lng ?? null });
        }

        res.json(campaigns);
    } catch (err) {
        console.error('[Geo Stats Error]:', err.message);
        res.status(500).json({ error: 'Failed to fetch geo stats' });
    }
});

router.get('/:id/stats', async (req, res) => {
    const { id } = req.params;
    try {
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*)::int as total_leads,
                COUNT(*) FILTER (WHERE status IN ('queued', 'messaged', 'replied'))::int as active_sequences,
                (SELECT COUNT(*)::int FROM replies r JOIN leads l ON r.lead_id = l.id WHERE l.company_id = $1 AND r.intent = 'interested') as interested_replies
            FROM leads
            WHERE company_id = $1
        `, [id]);
        
        // Fetch recent keywords used in discovery
        const keywordsResult = await pool.query(`
            SELECT DISTINCT ON (query) query, created_at 
            FROM discovery_queue 
            WHERE company_id = $1 
            ORDER BY query, created_at DESC 
            LIMIT 5
        `, [id]);
        
        // Sort back by created_at desc since DISTINCT ON forces an order by the distinct column first
        const recentKeywords = keywordsResult.rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const stats = statsResult.rows[0];
        const successRate = stats.total_leads > 0 
            ? Math.round((stats.interested_replies / stats.total_leads) * 100) 
            : 0;

        res.json({
            ...stats,
            success_rate: successRate,
            recent_keywords: recentKeywords.map(k => k.query)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch company stats' });
    }
});

router.post('/:id/generate-template', async (req, res) => {
    const { id } = req.params;
    try {
        const templates = await require('../services/messageGenerator').generateMasterTemplates(id);
        if (!templates) return res.status(404).json({ error: 'Company not found or summarization missing' });
        res.json(templates);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate templates' });
    }
});

// New Route: Local Media Upload
router.post('/:id/upload-media', upload.single('file'), async (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const publicUrl = `http://127.0.0.1:5000/uploads/${req.file.filename}`;
        
        // Auto-update the company's media URL in DB
        await pool.query(
            'UPDATE companies SET email_media_url = $1 WHERE id = $2',
            [publicUrl, id]
        );

        res.json({ 
            success: true, 
            url: publicUrl,
            message: 'Media uploaded and linked to workspace'
        });
    } catch (err) {
        console.error('Upload DB update failed:', err);
        res.status(500).json({ error: 'Failed to link upload to company' });
    }
});

/**
 * POST /:id/sync
 * Syncs the entire workspace (all campaigns) to Google Sheets.
 */
router.post('/:id/sync', async (req, res) => {
    const { id: companyId } = req.params;
    try {
        const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
        if (compRes.rowCount === 0) return res.status(404).json({ error: 'Company not found' });
        let company = compRes.rows[0];

        let spreadsheetId = company.spreadsheet_id;
        const { createSpreadsheet, exportToSheets } = require('../utils/sheetsExporter');
        
        if (!spreadsheetId) {
            spreadsheetId = await createSpreadsheet(company.name);
            await pool.query('UPDATE companies SET spreadsheet_id = $1 WHERE id = $2', [spreadsheetId, companyId]);
        }

        const campRes = await pool.query('SELECT * FROM campaigns WHERE company_id = $1', [companyId]);
        const campaigns = campRes.rows;

        if (campaigns.length === 0) {
            return res.status(404).json({ error: 'No campaigns found for this workspace' });
        }

        const results = [];
        for (const camp of campaigns) {
            const leadsRes = await pool.query('SELECT * FROM leads WHERE campaign_id = $1', [camp.id]);
            if (leadsRes.rowCount > 0) {
                await exportToSheets(leadsRes.rows, spreadsheetId, camp.name);
                results.push({ campaign: camp.name, synced: leadsRes.rowCount });
            }
        }

        res.json({
            success: true,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
            details: results
        });

    } catch (err) {
        console.error('[Workspace Sync Error]:', err.message);
        res.status(500).json({ error: 'Workspace sync failed', detail: err.message });
    }
});

module.exports = router;