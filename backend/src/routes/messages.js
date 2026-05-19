const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { addEmailJob } = require('../queue/emailQueue');

/**
 * Helper to handle database errors (DRY).
 */
const handleDBError = (res, err, message = 'Database operation failed') => {
    console.error(`[DB Error]: ${err.message}`, err);
    return res.status(500).json({ error: message });
};

/**
 * 1. GET /messages
 * Supports filtering by lead_id or campaign_id.
 */
router.get('/', async (req, res) => {
    const { lead_id, campaign_id } = req.query;
    let query = 'SELECT * FROM messages';
    const params = [];
    const conditions = [];

    if (lead_id) {
        params.push(lead_id);
        conditions.push(`lead_id = $${params.length}`);
    }

    if (campaign_id) {
        params.push(campaign_id);
        conditions.push(`campaign_id = $${params.length}`);
    }

    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        return handleDBError(res, err, 'Failed to fetch messages');
    }
});

/**
 * 2. POST /messages
 * Record an outreach attempt.
 */
router.post('/', async (req, res) => {
    const { lead_id, campaign_id, channel, message_text, status } = req.body;

    if (!lead_id || !channel || !message_text) {
        return res.status(400).json({ error: 'lead_id, channel, and message_text are required' });
    }

    try {
        // 1. Insert message record (Set to 'pending' for async email delivery)
        const initialStatus = channel === 'email' ? 'pending' : (status || 'sent');
        const sentAt = initialStatus === 'sent' ? new Date() : null;

        const insertQuery = `
            INSERT INTO messages (lead_id, campaign_id, channel, message_text, status, sent_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;

        const msgResult = await pool.query(insertQuery, [
            lead_id,
            campaign_id || null,
            channel,
            message_text,
            initialStatus,
            sentAt
        ]);

        const createdMessage = msgResult.rows[0];

        // 2. Trigger Queue if channel is email
        if (channel === 'email') {
            const leadQuery = `
                SELECT l.email_address, c.email as company_email, c.smtp_password 
                FROM leads l 
                JOIN companies c ON l.company_id = c.id 
                WHERE l.id = $1
            `;
            const leadResult = await pool.query(leadQuery, [lead_id]);
            if (leadResult.rows.length > 0) {
                const lead = leadResult.rows[0];
                await addEmailJob({
                    messageId: createdMessage.id,
                    leadId: lead_id,
                    email: lead.email_address,
                    subject: 'Update from Growth Engine',
                    message: message_text,
                    companyEmail: lead.company_email,
                    smtpPassword: lead.smtp_password
                });
            }
        }

        res.status(201).json(createdMessage);
    } catch (err) {
        return handleDBError(res, err, 'Failed to create message');
    }
});

module.exports = router;
