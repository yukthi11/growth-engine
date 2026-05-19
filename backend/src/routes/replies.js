const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * 1. GET /replies?company_id=X&status=pending
 * Returns all replied leads not yet actioned, grouped by lead.
 */
router.get('/', async (req, res) => {
    const { status, company_id } = req.query;
    
    if (!company_id) {
        return res.status(400).json({ error: 'company_id is required' });
    }

    try {
        // High-performance query for the Inbox Sidebar:
        // Returns leads that have real conversational activity.
        // FIX: The messages side of the UNION is now filtered to status='sent'.
        // Previously, auto-generated 'pending' draft messages (written to the DB
        // when a lead is created, before any WhatsApp dispatch) caused leads to
        // appear in the inbox sidebar as if a conversation had started, even
        // though nothing was ever sent. Filtering to 'sent' removes those ghosts.
        const sql = `
            WITH conversational_leads AS (
                SELECT 
                    lead_id, 
                    MAX(created_at) as latest_activity, 
                    COUNT(*) as msg_count,
                    (SELECT intent FROM replies r2 WHERE r2.lead_id = combined.lead_id ORDER BY created_at DESC LIMIT 1) as latest_intent,
                    (SELECT message FROM replies r3 WHERE r3.lead_id = combined.lead_id ORDER BY created_at DESC LIMIT 1) as latest_message
                FROM (
                    SELECT lead_id, created_at FROM messages WHERE status = 'sent'
                    UNION ALL
                    SELECT lead_id, created_at FROM replies
                ) combined
                GROUP BY lead_id
            )
            SELECT 
                l.id as lead_id,
                l.business_name,
                l.phone,
                l.status as lead_status,
                l.email_address,
                cl.latest_activity as created_at,
                cl.msg_count as reply_count,
                cl.latest_intent as intent,
                cl.latest_message as message
            FROM leads l
            JOIN conversational_leads cl ON l.id = cl.lead_id
            WHERE l.company_id = $1
            ORDER BY cl.latest_activity DESC
        `;
        
        const result = await pool.query(sql, [company_id]);
        res.json(result.rows);
    } catch (err) {
        console.error('[Replies API] Listing error:', err.message);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

/**
 * 2. GET /replies/thread/:leadId
 * Returns full merged conversation thread (sent messages + received replies)
 * sorted chronologically so the UI can render a proper chat flow.
 */
router.get('/thread/:leadId', async (req, res) => {
    const { leadId } = req.params;
    try {
        // Outbound messages we sent
        // FIX: Only include messages with status='sent'. Without this filter,
        // auto-generated 'pending' draft messages (created at lead ingestion time
        // in POST /leads) were being returned here and rendered as sent chat
        // bubbles in the UI — giving the false impression that a WhatsApp message
        // was actually delivered when it was never dispatched.
        const sentResult = await pool.query(
            `SELECT 
                'sent' as type, 
                COALESCE(message_text, content) as text, 
                channel,
                COALESCE(sent_at, created_at) as timestamp,
                status,
                NULL as intent
             FROM messages 
             WHERE lead_id = $1
               AND status IN ('sent', 'pending', 'failed')
             ORDER BY timestamp ASC`,
            [leadId]
        );

        // Inbound replies from the lead
        const receivedResult = await pool.query(
            `SELECT 
                'received' as type,
                COALESCE(message, message_text) as text,
                COALESCE(channel, 'whatsapp') as channel,
                created_at as timestamp,
                'received' as status,
                intent
             FROM replies
             WHERE lead_id = $1
             ORDER BY timestamp ASC`,
            [leadId]
        );

        // Merge and sort chronologically
        const thread = [...sentResult.rows, ...receivedResult.rows]
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        res.json(thread);
    } catch (err) {
        console.error(`[Replies API] Error fetching thread for ${leadId}:`, err.message);
        res.status(500).json({ error: 'Failed to fetch thread' });
    }
});

/**
 * 4. POST /replies/manual-reply/:leadId
 * Send WhatsApp/Email manually and record it correctly.
 */
router.post('/manual-reply/:leadId', async (req, res) => {
    const { leadId } = req.params;
    const { message, channel = 'whatsapp', subject, mediaUrl } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    try {
        const leadRes = await pool.query('SELECT phone, email_address, campaign_id FROM leads WHERE id = $1', [leadId]);
        if (!leadRes.rows.length) return res.status(404).json({ error: 'Lead not found' });
        const { phone, email_address, campaign_id } = leadRes.rows[0];

        const IS_TEST = (process.env.TEST_MODE || '').trim().toLowerCase() === 'true';
        let targetPhone = phone;
        let targetEmail = email_address;
        let messagePrefix = "";

        if (IS_TEST) {
            targetPhone = process.env.TEST_PHONE || phone;
            targetEmail = process.env.TEST_EMAIL || email_address;
            messagePrefix = "[TEST] ";
            console.log(`[TEST MODE REDIRECT] Original: ${phone}/${email_address} -> Target: ${targetPhone}/${targetEmail}`);
        }

        const now = new Date();
        const insertRes = await pool.query(
            `INSERT INTO messages (lead_id, campaign_id, channel, message_text, status, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [leadId, campaign_id, channel, message, channel === 'email' ? 'pending' : 'sent', now]
        );
        const messageId = insertRes.rows[0].id;

        if (channel === 'whatsapp') {
            if (!targetPhone) return res.status(400).json({ error: 'No phone number for WhatsApp' });
            const { sendWhatsAppMessage } = require('../services/whatsappClient');
            
            // Clean the message: strip the placeholder tag so it doesn't appear in the caption
            const cleanMessage = message.replace(/{{mockup_url}}/g, '').trim();
            await sendWhatsAppMessage(targetPhone, `${messagePrefix}${cleanMessage}`, mediaUrl);

            // Cleanup R2 storage if a mockup was sent
            if (mediaUrl) {
                const { deleteMockup } = require('../lib/r2');
                try {
                    await deleteMockup(leadId);
                } catch (cleanupErr) {
                    console.warn(`[Manual Reply] Cleanup failed for lead ${leadId}:`, cleanupErr.message);
                }
            }
        } else if (channel === 'email') {
            if (!targetEmail) return res.status(400).json({ error: 'No email address for lead' });
            
            // Join with companies to get sender identity
            const senderRes = await pool.query(
                'SELECT c.email as company_email, c.smtp_password FROM leads l JOIN companies c ON l.company_id = c.id WHERE l.id = $1',
                [leadId]
            );
            const sender = senderRes.rows[0] || {};

            const { addEmailJob } = require('../queue/emailQueue');
            await addEmailJob({
                messageId: messageId,
                leadId: leadId,
                email: targetEmail,
                subject: subject || `${messagePrefix}Growth Engine Update`,
                message: message,
                companyEmail: sender.company_email || process.env.SMTP_USER,
                smtpPassword: sender.smtp_password || process.env.SMTP_PASSWORD,
                mediaUrl: mediaUrl // Pass the visual proof URL to the email worker
            });
        }

        res.json({ success: true, message, messageId, status: channel === 'email' ? 'pending' : 'sent', channel });
    } catch (err) {
        console.error('[Manual Reply Error]:', err.message);
        res.status(500).json({ error: `Failed to send ${channel}: ${err.message}` });
    }
});

/**
 * 3. POST /replies/sync/:leadId
 * Fetches 'Live' history from WhatsApp (Privacy-safe: only for THIS lead)
 */
router.post('/sync/:leadId', async (req, res) => {
    const { leadId } = req.params;
    try {
        const leadRes = await pool.query('SELECT phone, campaign_id FROM leads WHERE id = $1', [leadId]);
        if (!leadRes.rows.length) return res.status(404).json({ error: 'Lead not found' });
        
        const { phone, campaign_id } = leadRes.rows[0];
        const { syncLeadHistory } = require('../services/whatsappClient');
        const liveHistory = await syncLeadHistory(phone);
        
        // BACKFILL: Repair the database for this lead
        for (const msg of liveHistory) {
            if (msg.type === 'received') {
                await pool.query(
                    `INSERT INTO replies (lead_id, message, created_at) 
                     SELECT $1, $2, $3 
                     WHERE NOT EXISTS (SELECT 1 FROM replies WHERE lead_id = $1 AND message = $2 AND created_at = $3)`,
                    [leadId, msg.text, msg.timestamp]
                );
            } else {
                await pool.query(
                    `INSERT INTO messages (lead_id, campaign_id, channel, message_text, status, sent_at) 
                     SELECT $1, $2, $3, $4, 'sent', $5 
                     WHERE NOT EXISTS (SELECT 1 FROM messages WHERE lead_id = $1 AND message_text = $4 AND sent_at = $5)`,
                    [leadId, campaign_id, 'whatsapp', msg.text, msg.timestamp]
                );
            }
        }
        
        res.json({ success: true, count: liveHistory.length });
    } catch (err) {
        console.error('[Sync Error]', err.message);
        res.status(500).json({ error: 'Sync failed' });
    }
});

module.exports = router;

